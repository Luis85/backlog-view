import { TFile } from 'obsidian';
import { CardDragController, CardSource } from './cardDrag';
import { applyDependencyWrite, dependenciesAvailable, legalTargets } from './dependencies';
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
 * Legality is likewise not decided here: `legalTargets` asks `candidates` from the
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
	/**
	 * The legal targets as FILES, never as paths. A rename mid-gesture mutates the one
	 * `TFile` in place, so a path swept at drag start goes stale against a target that
	 * did not change — and `accepts` would then refuse a drop that stayed valid, before
	 * `drop` could re-ask anything. Same fact `CardDragController.resolve` leans on.
	 */
	legal: Set<TFile>;
	line: SVGPathElement | null;
	fromX: number;
	fromY: number;
}

const live = new WeakMap<HTMLElement, LiveLink>();

/**
 * Wire one bar's two roles.
 *
 * Skipped entirely where the feature is off — `dependenciesAvailable`, the same predicate
 * the menu and the connector gate on — since nothing there could ever mint a payload for
 * this target to accept. That gate no longer asks whether the KEY is bound, only whether
 * one could be ([[Bind a property by using it]]), so it is now false in one configuration
 * rather than in every base that had not named the property.
 *
 * **Which hands back a real saving, and the bill is not where this comment used to say.**
 * Measured in the browser harness, folders fixture, `?notes=800`, 811 expanded bars,
 * Chromium, median of nine `render()` calls: the roadmap render goes from **~274 ms with
 * the feature off to ~318 ms with it on**, and that ~16% is now paid by every base except
 * one that cleared the option. Split three ways, ~35 ms of the 44 is `renderConnector`'s
 * `<button>` — 811 more DOM nodes, at the same per-node cost the rest of the render is
 * made of — and the two wirings together are ~9 ms, inside the run-to-run spread.
 *
 * So registering the drop targets at drag start, which is the optimisation this paragraph
 * proposed before it was measured, would buy almost nothing. The cost is the handle, and
 * the handle is the feature. What would actually move it is drawing fewer bars, which is
 * [[The render is the whole cost of a data update]]'s own axis and not this feature's.
 *
 * Within that, the source half is skipped where no connector was drawn — no bar on screen
 * — and the TARGET half is wired regardless, because a bar with no connector of its own is
 * still something another bar's link may legitimately point at. That refusal is
 * `geometry.outside`, the one `renderConnector` itself withholds a dot for. The target is
 * `wireDropTarget` called with `kind: 'link'`, not a method of its own — see that method's
 * own comment for why the two collapsed into one.
 */
export function wireBarLink(ctx: RowContext, parts: BarLinkParts): void {
	const host: BacklogViewHost = ctx.host;
	if (!dependenciesAvailable(host)) return;
	const { dnd, content, row, barEl, connector, item } = parts;
	if (connector) {
		dnd.wireLinkSource(connector, item, {
			onStart: () => begin(host, content, row, item, connector),
			onEnd: () => end(content),
		});
	}
	dnd.wireDropTarget(
		barEl,
		(source) => drop(host, source, item),
		{ accepts: (source) => (live.get(content)?.legal.has(item.file) ?? false) && source.item.file !== item.file },
		'link',
	);
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
	const legal = legalTargets(host, model, item);
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
	// The rows are addressed by path because that is what the DOM carries, and resolved
	// to files through the model before asking `legal` — which is keyed by file. Safe
	// here and nowhere later: this runs at drag START, when every rendered path is current.
	for (const other of Array.from(content.querySelectorAll<HTMLElement>('.pbl-timeline-row'))) {
		const path = other.dataset.pblPath;
		const file = path === undefined ? undefined : model.byPath.get(path)?.file;
		if (other !== row && file !== undefined && !legal.has(file)) other.addClass(ILLEGAL);
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
 *
 * Skipped where the feature is off, the same `dependenciesAvailable` gate `wireBarLink`
 * uses: there `renderConnector` draws no connector anywhere on the grid, so no link drag
 * can ever start and this monitor would never see one.
 */
export function wireLinkPreview(host: BacklogViewHost, dnd: CardDragController, content: HTMLElement): void {
	if (!dependenciesAvailable(host)) return;
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
	if (!legalTargets(host, model, source.item).has(target.file)) return;
	applyDependencyWrite(host, liveTarget, { add: source.item.file });
}
