import { setTooltip } from 'obsidian';
import { drawIcon } from './icons';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderContextStrip, renderShelf, shelfRemoval } from './shelf';
import { syncShelfTabStops } from './shelfControls';
import { renderTimeline } from './timeline';
import { DrawnColors, RoadmapSnapshot, ScrollBox } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { newItemType, promptCreateItem } from '../interactions/create';
import { wireTimelineDrag } from '../interactions/timelineDrag';
import { StatePalette, statePalettes } from '../../domain/board';
import { timelineRows } from '../../domain/bars';
import { BacklogItem } from '../../domain/model';
import { buildRoadmap, HorizonBucket, RoadmapAxis } from '../../domain/roadmap';
import { scaleFor, TimelineScale, TimelineWindow } from '../../domain/timeline';
import { CivilDate } from '../../domain/noteFields';

/**
 * The roadmap projection: the same model the tree and the board render,
 * projected onto the configured axis — horizon buckets, or the dated grid — with
 * the shelf beside it carrying every result the axis could not place. The frame
 * always renders once an axis exists: an empty roadmap is an empty frame, never
 * no frame.
 *
 * Both axes write: the horizon axis's bucket and shelf are drop TARGETS, the board's
 * rule; the dated axis's grid is one POSITIONAL target instead — there are no lanes
 * yet, so only the pointer's X says anything, and `interactions/timelineDrag.ts`
 * decides what it means. `dnd` is the same controller either way, wired differently
 * per axis by `renderBucket`/`wireTimelineDrag` below. A bar already placed is a drag
 * source too — a hold reads a delta rather than a position — and the dated axis's own
 * shelf is where either direction lands: a shelf card onto the grid places it, a held
 * bar back onto the shelf un-places it (`shelfRemoval`, in `./shelf`, is what tells
 * `renderShelf` which write that is, per axis).
 */
export function renderRoadmap(
	ctx: RowContext,
	treeEl: HTMLElement,
	axis: RoadmapAxis,
	today: CivilDate,
	dnd: CardDragController,
): RoadmapSnapshot {
	const host = ctx.host;
	const model = host.model;
	if (!model) {
		return {
			roadmap: { axis, buckets: [], bars: [], shelf: [], context: [], placedCount: 0 },
			cards: [],
			shelfEl: null,
			todayLeft: null,
			scroller: null,
			boxes: [],
			window: null,
			scale: null,
			leadWidth: null,
			drawn: { done: false, milestone: false, accent: false },
			palettes: [],
		};
	}
	const roadmap = buildRoadmap(model, host.settings, (item) => !host.isRowHidden(item), axis);

	const frameEl = treeEl.createDiv({ cls: 'pbl-roadmap' });
	const cards: BacklogItem[] = [];
	let todayLeft: number | null = null;
	let scroller: HTMLElement | null = null;
	let window: TimelineWindow | null = null;
	let scale: TimelineScale | null = null;
	let leadWidth: number | null = null;
	let drawn: DrawnColors = { done: false, milestone: false, accent: false };
	// The dated axis's own dependency conflicts (see `TimelineRender.dependencyConflicts`)
	// — empty on the horizon axis, where a shelved dependent's stated START has no
	// meaning at all.
	let dependencyConflicts: ReadonlyMap<string, ReadonlySet<string>> = new Map();
	// Built once, drawn from by the bars and then carried out on the snapshot for the
	// legend — see `RoadmapSnapshot.palettes`. Empty on the horizon axis, which draws no bar.
	let palettes: StatePalette[] = [];
	if (axis === 'horizons') {
		const bucketsEl = frameEl.createDiv({ cls: 'pbl-roadmap-buckets' });
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket, dnd));
		// The pane is the scroller, not the frame: the frame is `max-content` wide and
		// scrolls nothing, so auto-scroll toward an edge has to watch the box that does.
		dnd.wireScroller(treeEl);
	} else {
		const activeScale = scaleFor(host.zoom);
		palettes = statePalettes(model, host.settings);
		// The rows the grid draws, which is the bars minus whatever a collapsed bar above
		// them is holding shut. Asked here rather than inside `buildRoadmap`: collapse is
		// the view's own state, and the shelf beside the grid is a statement about what the
		// axis could not place — a row hidden by a disclosure has not become unplaced.
		const rows = timelineRows(roadmap.bars, (path) => host.isCollapsed(path));
		const timeline = renderTimeline(ctx, frameEl, rows, {
			today,
			scale: activeScale,
			dnd,
			shelf: roadmap.shelf,
			palettes,
			// The PANE's width, not the frame's or the not-yet-built scroller's: this is
			// the element `backlogView.ts`'s `ResizeObserver` watches, so a render here and
			// a resize-driven re-render there measure the same box. They can still read it
			// a scrollbar apart, since this measurement happens after `treeEl.empty()` —
			// see `TimelineDrawing.available`, which states what that costs.
			available: treeEl.clientWidth,
		});
		cards.push(...timeline.cards);
		todayLeft = timeline.todayLeft;
		scroller = timeline.scroller;
		window = timeline.window;
		scale = activeScale;
		leadWidth = timeline.leadWidth;
		drawn = timeline.drawn;
		dependencyConflicts = timeline.dependencyConflicts;
		wireTimelineDrag(ctx, dnd, {
			overlay: timeline.overlay,
			scroller: timeline.scroller,
			window: timeline.window,
			scale: activeScale,
			headerTrack: timeline.headerTrack,
			tracks: timeline.tracks,
			leadWidth: timeline.leadWidth,
		});
	}
	// Captured before the shelf renders: collapsing the shelf changes ITS contribution
	// to `cards` (see `renderShelf`), never the axis's own — this is the true "does the
	// roadmap have anything to show" count, including context cards already placed in
	// a bucket, which no domain-model counter answers on its own.
	const axisCardCount = cards.length;
	const removal = shelfRemoval(host, axis);
	const shelf = renderShelf(ctx, frameEl, { cards: roadmap.shelf, conflicts: dependencyConflicts, axis }, dnd, removal);
	cards.push(...shelf.cards);
	const context = renderContextStrip(ctx, frameEl, roadmap.context);
	cards.push(...context.cards);
	// `cards` is final here, and it is what the pane's `listbox`/`region` role is decided
	// from downstream — so it is also what decides whether the shelf's own controls may
	// leave the tab order. See `syncShelfTabStops`.
	syncShelfTabStops(shelf.el, cards.length > 0);
	const advisoryEl = renderRoadmapAdvisory(
		ctx,
		frameEl,
		axisCardCount + roadmap.shelf.length + roadmap.context.length,
		treeEl,
	);

	// Keyed by WHICH BAND IT IS, in the order the bands render — a band that did not
	// render (an empty shelf with nothing to un-place, no context, cards on screen) is
	// simply absent, so `captureScroll`/`restoreScroll` neither read nor write it.
	const boxes: ScrollBox[] = [];
	if (scroller) boxes.push({ key: 'timeline', el: scroller });
	boxes.push({ key: 'shelf', el: shelf.el });
	if (context.el) boxes.push({ key: 'context', el: context.el });
	if (advisoryEl) boxes.push({ key: 'advisory', el: advisoryEl });

	return { roadmap, cards, shelfEl: shelf.el, todayLeft, scroller, boxes, window, scale, leadWidth, drawn, palettes };
}

/**
 * One horizon bucket — a declared placement, or one minted by a result's own
 * value and marked as outside the declared vocabulary, the board's stray-column
 * rule. Empty declared buckets render anyway: a horizon exists whether or not
 * anything currently sits in it.
 */
function renderBucket(
	ctx: RowContext,
	bucketsEl: HTMLElement,
	bucket: HorizonBucket,
	dnd: CardDragController,
): BacklogItem[] {
	const colEl = bucketsEl.createDiv({
		cls: 'pbl-bucket' + (bucket.declared ? '' : ' pbl-bucket-undeclared'),
		attr: { role: 'group', 'aria-label': `${bucket.value}, ${bucket.count} item${bucket.count === 1 ? '' : 's'}` },
	});
	const header = colEl.createDiv({ cls: 'pbl-bucket-header' });
	header.createSpan({ cls: 'pbl-bucket-name', text: bucket.value });
	header.createSpan({ cls: 'pbl-bucket-count', text: String(bucket.count) });
	if (!bucket.declared) {
		const mark = header.createSpan({ cls: 'pbl-bucket-stray' });
		drawIcon(mark, 'circle-help');
		setTooltip(
			colEl,
			`"${bucket.value}" is not one of the declared horizons. Add it to "Horizons (in order)" in the view options, or re-place its items.`,
		);
	}
	renderBucketNew(ctx, header, bucket);
	const cardsEl = colEl.createDiv({ cls: 'pbl-bucket-cards' });
	for (const item of bucket.cards) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
		dnd.wireCard(card, item);
	}
	// The whole bucket is the target, the board's rule: within a bucket the order is
	// the Base's own sort, so there is no between-cards edge to indicate. A minted
	// bucket is a target like any other — its value is observed vocabulary, and
	// observed vocabulary is writable.
	dnd.wireDropTarget(colEl, (source) => void ctx.host.performHorizonMove(source.item, bucket.value));
	dnd.wireScroller(cardsEl);
	return bucket.cards;
}

/**
 * Create straight into this bucket. The New flow runs exactly as it does from the
 * toolbar — the same config gate, the same type folders, the same type the toolbar
 * would offer — with this bucket's own value written in the creation write, so a
 * note never exists in a bucket its frontmatter does not claim.
 *
 * `tabindex="-1"` like the tree's add button, because the pane is one tab stop — but
 * unlike the tree's, this one has no keyboard equivalent behind it: a bucket is not a
 * keyboard stop, so nothing selects one to act on. What is NOT lost is the capability,
 * only the shortcut: the toolbar's New button is an ordinary tab stop, and Alt+arrow
 * walks the new card into any bucket, so the same note in the same place is two
 * keystrokes further away rather than out of reach. Closing the gap properly means
 * bucket stops, which is `docs/requirements/Keyboard and menu on the roadmap.md`'s
 * work — its main flow already has arrows moving across the roadmap's regions.
 *
 * The stylesheet has to reveal it on hoverless devices explicitly (`hover: none`), or
 * a touch user gets neither the hover nor the tab stop and the control is unreachable
 * rather than merely hidden.
 */
function renderBucketNew(ctx: RowContext, header: HTMLElement, bucket: HorizonBucket): void {
	const host = ctx.host;
	const model = host.model;
	if (!model) return;
	const type = newItemType(host.settings, model);
	const btn = header.createEl('button', {
		cls: 'clickable-icon pbl-bucket-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': `New ${type} in ${bucket.value}` },
	});
	drawIcon(btn, 'plus');
	setTooltip(btn, `New ${type} in "${bucket.value}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { horizon: bucket.value }));
}

/**
 * Why the roadmap has no cards, said beside the frame rather than instead of it — the
 * board's advisory rule. Gated on the roadmap's actual population — the axis's own
 * cards (results and any context card already placed in a bucket), the shelf's real
 * count and the standalone context strip's count — never on how many are currently
 * keyboard-reachable: a collapsed shelf legitimately contributes zero cards to that
 * walk, and an all-shelved, collapsed backlog is not empty, it is a backlog not yet
 * planned.
 *
 * `root` is `treeEl` — the view's one stable element — passed down from `renderRoadmap`:
 * `frameEl` and `aside` are both created fresh every pass (`renderRoadmap`'s own first
 * line, and this function's own second), so neither survives to be resolved from later.
 * See `renderEmptyState`'s doc comment in `render/emptyStates.ts`.
 */
function renderRoadmapAdvisory(
	ctx: RowContext,
	frameEl: HTMLElement,
	renderedCards: number,
	root: HTMLElement,
): HTMLElement | null {
	const host = ctx.host;
	const model = host.model;
	if (!model || renderedCards > 0) return null;
	const aside = frameEl.createDiv({ cls: 'pbl-board-advisory' });
	if (model.results.length === 0) renderEmptyState(host, aside, root);
	else if (host.isFiltering()) renderFilterEmptyState(host, aside, root);
	else renderAllDoneState(host, aside, model.results.length, root);
	return aside;
}
