import { setIcon, setTooltip } from 'obsidian';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderTimeline } from './timeline';
import { BacklogViewHost, RoadmapSnapshot, ScrollBox } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { newItemType, promptCreateItem } from '../interactions/create';
import { canSchedule } from '../interactions/plan';
import { wireTimelineDrag } from '../interactions/timelineDrag';
import { BacklogItem } from '../../domain/model';
import { ShelfCard } from '../../domain/bars';
import { buildRoadmap, HorizonBucket, RoadmapAxis, SHELF_LABEL } from '../../domain/roadmap';
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
 * per axis by `renderBucket`/`wireTimelineDrag` below. What is still withheld on the
 * dated axis is a BAR as a drag source — moving one already placed reads a delta, not
 * a position, and is the next increment's — so today only a shelf card can be picked
 * up there.
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
			allCards: [],
			shelfPaths: new Set(),
			shelfEl: null,
			todayLeft: null,
			scroller: null,
			boxes: [],
			window: null,
			scale: null,
		};
	}
	const roadmap = buildRoadmap(model, host.settings, (item) => !host.isRowHidden(item), axis);

	const frameEl = treeEl.createDiv({ cls: 'pbl-roadmap' });
	const cards: BacklogItem[] = [];
	let todayLeft: number | null = null;
	let scroller: HTMLElement | null = null;
	let window: TimelineWindow | null = null;
	let scale: TimelineScale | null = null;
	if (axis === 'horizons') {
		const bucketsEl = frameEl.createDiv({ cls: 'pbl-roadmap-buckets' });
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket, dnd));
		// The pane is the scroller, not the frame: the frame is `max-content` wide and
		// scrolls nothing, so auto-scroll toward an edge has to watch the box that does.
		dnd.wireScroller(treeEl);
	} else {
		const activeScale = scaleFor(host.zoom);
		const timeline = renderTimeline(ctx, frameEl, roadmap.bars, { today, scale: activeScale, dnd });
		cards.push(...timeline.cards);
		todayLeft = timeline.todayLeft;
		scroller = timeline.scroller;
		window = timeline.window;
		scale = activeScale;
		wireTimelineDrag(ctx, dnd, {
			overlay: timeline.overlay,
			scroller: timeline.scroller,
			window: timeline.window,
			scale: activeScale,
		});
	}
	const shelf = renderShelf(ctx, frameEl, roadmap.shelf, dnd, axis);
	cards.push(...shelf.cards);
	const context = renderContextStrip(ctx, frameEl, roadmap.context);
	cards.push(...context.cards);
	const advisoryEl = renderRoadmapAdvisory(ctx, frameEl, cards.length);

	// Keyed by WHICH BAND IT IS, in the order the bands render — a band that did not
	// render (an empty shelf with nothing to un-place, no context, cards on screen) is
	// simply absent, so `captureScroll`/`restoreScroll` neither read nor write it.
	const boxes: ScrollBox[] = [];
	if (scroller) boxes.push({ key: 'timeline', el: scroller });
	if (shelf.el) boxes.push({ key: 'shelf', el: shelf.el });
	if (context.el) boxes.push({ key: 'context', el: context.el });
	if (advisoryEl) boxes.push({ key: 'advisory', el: advisoryEl });

	// `cards` and `allCards` are the same reading order at render time — `syncShelfFit`
	// is what may later narrow `cards` on the dated axis, and it filters FROM this
	// unnarrowed list rather than from itself, so a widening resize can restore what an
	// earlier narrowing removed.
	const shelfPaths = new Set(roadmap.shelf.map((entry) => entry.item.file.path));
	return { roadmap, cards, allCards: cards, shelfPaths, shelfEl: shelf.el, todayLeft, scroller, boxes, window, scale };
}

/** Below this the shelf's cards cost more than they are worth beside the grid. */
const SHELF_COMPACT_PX = 560;

/**
 * Resolve the shelf's compaction and apply it — the ONE decider. The width sets the
 * default and a press overrides it, and `aria-expanded` states whatever that resolved
 * to, because CSS cannot write an ARIA attribute and a container query plus a flag are
 * two deciders that desynchronise.
 *
 * It runs after render and on resize, gated to the dated axis, and it needs no second
 * render pass — unlike the column ladder, whose verdict can only be shown by rebuilding
 * the rows. So there is no `refitting` guard here, because there is no re-entry.
 *
 * Three things follow from the verdict and are done here, together, because separately
 * they were three defects: the class, the NAVIGABLE set (a hidden card an arrow can
 * still reach is a keyboard user with no visible position), and the pane's role (a
 * composite promising options it no longer has).
 */
export function syncShelfFit(host: BacklogViewHost, treeEl: HTMLElement): void {
	const snapshot = host.roadmap;
	if (!snapshot || snapshot.roadmap.axis !== 'dates' || !snapshot.shelfEl) return;
	// Same rule as the toggle's: the cards decide. An empty shelf is still an element —
	// the drop target a drag needs — and compacting THAT would put `pbl-shelf-compact` on
	// the strip that has to be reachable while a card is in the air.
	if (snapshot.shelfPaths.size === 0) return;
	// Zero while detached or before the first layout — the same guard `syncColumnFit`
	// keeps for the tree's own ladder: keep the last decision rather than reading an
	// unmeasured pane as narrow. Only the width-decided branch can be fooled by it; a
	// press overrides the width outright and must still take effect at zero.
	if (host.shelfOpen === null && treeEl.clientWidth === 0) return;
	// Two cases, not three: no press yet means the width decides, and a press means the
	// press decides. Written as one conditional so nothing else can be read into it.
	const compact = host.shelfOpen === null ? treeEl.clientWidth < SHELF_COMPACT_PX : !host.shelfOpen;
	snapshot.shelfEl.toggleClass('pbl-shelf-compact', compact);
	snapshot.cards = compact ? snapshot.allCards.filter((item) => !snapshot.shelfPaths.has(item.file.path)) : snapshot.allCards;
	// The selection is reconciled HERE, in the one place compaction resolves, rather than
	// beside each caller: a resize is not the only way a card leaves the navigable set —
	// pressing the toggle does it too, and that path re-renders nothing, so a selection
	// left behind would keep `aria-activedescendant` pointing into hidden content until
	// some later navigation happened to move it. Same shape as a vanished board column
	// clamping `selectedBoardColumn`, put where every caller inherits it.
	if (host.selectedPath !== null && !snapshot.cards.some((card) => card.file.path === host.selectedPath)) {
		host.clearSelection();
	}
	// Resolved AFTER compaction, never at render: on a narrow pane whose only cards are
	// shelved, every option leaves the navigable set and the pane would stay an empty
	// listbox — a composite promising options it no longer has.
	treeEl.setAttribute('role', snapshot.cards.length > 0 ? 'listbox' : 'region');
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
		setIcon(mark, 'circle-help');
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
	dnd.wireDropTarget(colEl, (item) => void ctx.host.performHorizonMove(item, bucket.value));
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
	setIcon(btn, 'plus');
	setTooltip(btn, `New ${type} in "${bucket.value}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { horizon: bucket.value }));
}

/**
 * Everything the axis could not place, in sibling order, counted — the roadmap
 * reports how much of the backlog is not yet planned instead of implying the
 * plan is the whole story.
 *
 * An EMPTY shelf stays in the DOM only where a drop on it means something — the
 * horizon axis, where it is the target that un-places, and a target that exists
 * only while it is occupied is one nothing can ever reach. On the dated axis a drop
 * back onto the shelf writes nothing yet (a bar is not a drag source until the hold
 * gestures ship), so an empty strip there would be the projection promising a write
 * it cannot make — [[Roadmap empty states]]'s own rule, restated for this band. A
 * NON-empty shelf always renders regardless: its cards are worth reading, and on the
 * dated axis they are now a drag source of their own, one gesture onto the grid.
 */
function renderShelf(
	ctx: RowContext,
	frameEl: HTMLElement,
	shelf: ShelfCard[],
	dnd: CardDragController,
	axis: RoadmapAxis,
): { cards: BacklogItem[]; el: HTMLElement | null } {
	const empty = shelf.length === 0;
	if (empty && axis !== 'horizons') return { cards: [], el: null };
	const shelfEl = frameEl.createDiv({
		cls: 'pbl-shelf' + (empty ? ' pbl-shelf-empty' : ''),
		attr: { role: 'group', 'aria-label': `${SHELF_LABEL}, ${shelf.length} item${shelf.length === 1 ? '' : 's'}` },
	});
	// Fixed for the life of the VIEW (`host.shelfId`), not minted per render: the
	// toolbar's toggle names this id in `aria-controls`, and the toolbar survives a
	// content-only render that rebuilds this element — a per-render id would leave
	// the button pointing at a detached node the instant that happened.
	shelfEl.id = ctx.host.shelfId;
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
	header.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
	header.createSpan({ cls: 'pbl-shelf-count', text: String(shelf.length) });
	// The one target whose drop REMOVES rather than writes has to say so, exactly as
	// the board's no-state column does.
	setTooltip(
		header,
		axis === 'horizons'
			? 'Results this axis cannot place — dropping a card here removes its horizon'
			: 'Results this axis cannot place — drag one onto the grid to schedule it',
	);
	const cardsEl = shelfEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const entry of shelf) {
		const card = createCard(ctx, cardsEl, entry.item);
		renderCardBody(ctx, card, entry.item);
		// Unreadable is unplaced, and the card says why rather than rendering
		// somewhere a guess put it.
		if (entry.reason !== null) {
			const reason = card.createDiv({ cls: 'pbl-shelf-reason' });
			setIcon(reason.createSpan({ cls: 'pbl-shelf-reason-icon' }), 'alert-triangle');
			reason.createSpan({ text: entry.reason });
		}
		wireCardActivation(ctx, card, entry.item);
		// A gesture whose only possible batch is empty must not begin: on the dated
		// axis that is `canSchedule`, the same gate the row's own Schedule entry uses
		// (`interactions/plan.ts`) — a marker with no writable end offers no grip at
		// all. On the horizon axis every shelved item can always be placed.
		if (axis === 'horizons' || canSchedule(ctx.host.settings, entry.item)) dnd.wireCard(card, entry.item);
	}
	// Entering the vocabulary is the triage gesture, so the shelf is a drag SOURCE as
	// much as a target — and dropping back on it un-places, the mirror write. Only on
	// the horizon axis: the dated axis has no drag source that would land here yet.
	if (axis === 'horizons') dnd.wireDropTarget(shelfEl, (item) => void ctx.host.performHorizonMove(item, null));
	return { cards: shelf.map((entry) => entry.item), el: shelfEl };
}

/**
 * Context rows with no place on the axis — a focused item outside the filter
 * whose value names no existing bucket, or whose own dates never place it. They
 * stand beside the shelf, apart from its count: a context row is not a result,
 * and the shelf is a statement about the results.
 */
function renderContextStrip(
	ctx: RowContext,
	frameEl: HTMLElement,
	context: BacklogItem[],
): { cards: BacklogItem[]; el: HTMLElement | null } {
	if (context.length === 0) return { cards: [], el: null };
	const stripEl = frameEl.createDiv({ cls: 'pbl-roadmap-context', attr: { role: 'group', 'aria-label': 'Context' } });
	const header = stripEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'corner-left-down');
	header.createSpan({ cls: 'pbl-shelf-name', text: 'Context' });
	setTooltip(header, "Not in this base's filter — shown for the hierarchy, never counted");
	const cardsEl = stripEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const item of context) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
	}
	return { cards: context, el: stripEl };
}

/**
 * Why the roadmap has no cards, said beside the frame rather than instead of it —
 * the board's advisory rule. Gated on rendered cards, shelf and context included:
 * an all-shelved roadmap is not empty, it is a backlog not yet planned, and the
 * shelf's count is the fact — nothing suggests placements the user has not made.
 */
function renderRoadmapAdvisory(ctx: RowContext, frameEl: HTMLElement, renderedCards: number): HTMLElement | null {
	const host = ctx.host;
	const model = host.model;
	if (!model || renderedCards > 0) return null;
	const aside = frameEl.createDiv({ cls: 'pbl-board-advisory' });
	if (model.results.length === 0) renderEmptyState(host, aside);
	else if (host.isFiltering()) renderFilterEmptyState(host, aside);
	else renderAllDoneState(host, aside, model.results.length);
	return aside;
}
