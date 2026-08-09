import { CardDragController, CardSource } from './cardDrag';
import { applyDependencyWrite, legalTargetPaths } from './dependencies';
import { RowContext } from '../render/columns';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';

/**
 * The Gantt gesture: drag from a bar's connector onto another bar to say *that item
 * waits for this one*.
 *
 * It plans NOTHING. The drop calls `applyDependencyWrite`, which is what the context
 * menu's Depends on… calls, so the batch, its refusals, its announcement and its undo
 * are identical either way — one move, two inputs, one place the batch is made. Adding a
 * third input means calling that same function, never writing a plan beside it.
 *
 * Legality is likewise not decided here: `legalTargetPaths` asks `candidates` from the
 * end the drop writes to. What this module owns is only WHEN that question is asked
 * (once, at drag start) and what the answer LOOKS like while the drag is held.
 */

/** What one bar contributes to the gesture: a place to drag from, and a place to drop on. */
export interface BarLinkParts {
	dnd: CardDragController;
	/** The scrolling content box every mark and the preview line are drawn into. */
	content: HTMLElement;
	row: HTMLElement;
	barEl: HTMLElement;
	/** Absent where `renderConnector` refused to draw one. */
	connector: HTMLElement | null;
	item: BacklogItem;
}

/** The class the content box wears while a link drag is live. */
const LINKING = 'pbl-linking';
const ILLEGAL = 'pbl-link-illegal';
const SOURCE = 'pbl-link-source';

/**
 * The live gesture's own state, held per CONTENT BOX rather than per bar: every bar wires
 * itself, and all of them have to agree about one drag. A render pass rebuilds the grid
 * wholesale and mints a new box, so nothing here can outlive the frame it belongs to.
 */
interface LiveLink {
	legal: Set<string>;
	line: SVGPathElement | null;
	fromX: number;
	fromY: number;
}

const live = new WeakMap<HTMLElement, LiveLink>();

/**
 * Wire one bar's two roles.
 *
 * The source half is skipped where no connector was drawn — the key unbound, or no bar
 * on screen — and the TARGET half is wired regardless, because a bar with no connector of
 * its own is still something another bar's link may legitimately point at.
 */
export function wireBarLink(ctx: RowContext, parts: BarLinkParts): void {
	const host: BacklogViewHost = ctx.host;
	const { dnd, content, row, barEl, connector, item } = parts;
	if (connector) {
		dnd.wireLinkSource(connector, item, {
			onStart: () => begin(host, content, row, item, connector),
			onEnd: () => end(content),
		});
	}
	dnd.wireLinkTarget(barEl, (source) => drop(host, source, item), {
		accepts: (source) => (live.get(content)?.legal.has(item.file.path) ?? false) && source.item.file !== item.file,
	});
}

/**
 * Start of a drag: sweep legality ONCE, mark what the drop would refuse, and open the
 * preview line.
 *
 * Only the illegal targets are marked. Most bars are legal, so marking legal marked four
 * of six rows in the browser harness and read as a multi-select; refusal is the scarce
 * thing, and it is the thing the acceptance criterion asks to be visible before release.
 */
function begin(host: BacklogViewHost, content: HTMLElement, row: HTMLElement, item: BacklogItem, connector: HTMLElement): void {
	// Asserted rather than guarded: `renderRoadmap`'s own `if (!model) return` is what
	// let this row — and its connector — exist at all, and `host.model` goes from null
	// to set once and never back (`renderRoadmap`'s own reasoning, restated for a
	// gesture that starts later than the render that drew it). A second null check here
	// would guard nothing reachable.
	const model = host.model as BacklogModel;
	const legal = legalTargetPaths(host.app, model, item);
	const box = content.getBoundingClientRect();
	const dot = connector.getBoundingClientRect();
	const state: LiveLink = {
		legal,
		line: null,
		fromX: dot.left + dot.width / 2 - box.left,
		fromY: dot.top + dot.height / 2 - box.top,
	};
	live.set(content, state);
	content.addClass(LINKING);
	row.addClass(SOURCE);
	for (const other of Array.from(content.querySelectorAll<HTMLElement>('.pbl-timeline-row'))) {
		const path = other.dataset.pblPath;
		if (other !== row && path !== undefined && !legal.has(path)) other.addClass(ILLEGAL);
	}
}

/** End of a drag, however it ended. Nothing the gesture drew may outlive it. */
function end(content: HTMLElement): void {
	const state = live.get(content);
	state?.line?.parentElement?.remove();
	live.delete(content);
	content.removeClass(LINKING);
	for (const row of Array.from(content.querySelectorAll<HTMLElement>(`.${ILLEGAL}, .${SOURCE}`))) {
		row.removeClass(ILLEGAL);
		row.removeClass(SOURCE);
	}
}

/**
 * The preview line, redrawn per frame by moving ONE path's `d` — the layer and the path
 * are minted on the first frame and never per frame, since a drag is many frames and a
 * node per frame is a node per frame to remove.
 */
export function wireLinkPreview(dnd: CardDragController, content: HTMLElement): void {
	dnd.wireLinkPointer({
		onDrag: (clientX, clientY) => {
			const state = live.get(content);
			if (!state) return;
			const box = content.getBoundingClientRect();
			const toX = clientX - box.left;
			const toY = clientY - box.top;
			if (!state.line) {
				const layer = content.createSvg('svg', { cls: ['pbl-link-preview'], attr: { 'aria-hidden': 'true' } });
				state.line = layer.createSvg('path', { cls: ['pbl-link-preview-line'] });
			}
			state.line.setAttribute(
				'd',
				`M ${state.fromX} ${state.fromY} C ${state.fromX + 40} ${state.fromY}, ${toX - 40} ${toY}, ${toX} ${toY}`,
			);
		},
		onEnd: () => end(content),
	});
}

/**
 * What a release on a legal bar MEANS. Re-asked of the current model rather than trusted
 * from drag start: the graph can change while a gesture is held, exactly as it can while
 * a suggester is open, and the same silence is refused for the same reason.
 *
 * Matched on `.file`, never on the path — a note deleted and another created at the same
 * path satisfies a path compare while being a different note.
 */
function drop(host: BacklogViewHost, source: CardSource, target: BacklogItem): void {
	// Asserted for the reason `begin` states: this drop landed on a bar that is still on
	// screen, which only a non-null model could have drawn.
	const model = host.model as BacklogModel;
	const liveTarget = model.byPath.get(target.file.path);
	if (liveTarget?.file !== target.file) return;
	if (!legalTargetPaths(host.app, model, source.item).has(target.file.path)) return;
	applyDependencyWrite(host, liveTarget, { add: source.item.file });
}
