import { setIcon, setTooltip } from 'obsidian';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderTimeline, spanText } from './timeline';
import { BacklogViewHost, RoadmapSnapshot, ScrollBox } from '../host';
import { CardDragController, CardSource } from '../interactions/cardDrag';
import { newItemType, promptCreateItem } from '../interactions/create';
import { canSchedule, unschedulePlan } from '../interactions/plan';
import { wireTimelineDrag } from '../interactions/timelineDrag';
import { BacklogItem } from '../../domain/model';
import { placeItem, ShelfCard, statedEnds, UNSCHEDULED_LABEL, withoutEnds } from '../../domain/bars';
import { placementEnds } from '../../domain/itemTypes';
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
 * per axis by `renderBucket`/`wireTimelineDrag` below. A bar already placed is a drag
 * source too — a hold reads a delta rather than a position — and the dated axis's own
 * shelf is where either direction lands: a shelf card onto the grid places it, a held
 * bar back onto the shelf un-places it (`shelfRemoval` below is what tells `renderShelf`
 * which write that is, per axis).
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
	const removal = shelfRemoval(host, axis);
	const shelf = renderShelf(ctx, frameEl, roadmap.shelf, dnd, removal);
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
	setIcon(btn, 'plus');
	setTooltip(btn, `New ${type} in "${bucket.value}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { horizon: bucket.value }));
}

/** What dropping a card on the shelf MEANS, the words that promise it, and its preview. */
interface ShelfRemoval {
	plan: (source: CardSource) => void;
	tooltip: string;
	/** Which sources this strip honours — the bar BODY alone on the dated axis. */
	accepts: (source: CardSource) => boolean;
	/** What this removal would LEAVE, said before the release; null where it says nothing. */
	outcome: ((item: BacklogItem) => string) | null;
	/**
	 * Whether a SHELVED item may be picked up as a drag source at all — folded in here
	 * rather than a sixth `renderShelf` parameter (the lint budget's own `max-params`),
	 * and it belongs beside the axis's other decisions anyway: every shelved item can
	 * always be re-placed by horizon, while a marker with no writable end offers no grip
	 * on the dated axis, the same gate the row's own Schedule entry uses.
	 */
	canDrag: (item: BacklogItem) => boolean;
}

/**
 * The removal this axis's shelf plans and the words it says it in — `renderShelf`
 * stops reading `dnd` as "the horizon axis" and takes both from here instead. Handed a
 * controller unchanged, a bar dropped on the timeline's shelf would clear its
 * **horizon** while the tooltip promised exactly what it always has: consistent
 * wording for the wrong write, worse than either alone on its own.
 */
function shelfRemoval(host: BacklogViewHost, axis: RoadmapAxis): ShelfRemoval {
	if (axis === 'horizons') {
		return {
			plan: (source) => void host.performHorizonMove(source.item, null),
			tooltip: 'Results this axis cannot place — dropping a card here removes its horizon',
			// A shelf card dropped back on the shelf is NOT refused here, unlike the
			// dated axis: a horizon-shelved card can still carry an unreadable value
			// worth clearing (`computeHorizonWrites` plans that write), and refusing the
			// drop outright would withhold exactly the cleanup the reason is asking for.
			// A re-drop with nothing to clear already plans zero writes and no-ops.
			accepts: (source) => source.hold === null,
			outcome: null,
			canDrag: () => true,
		};
	}
	return {
		// The captured shape rides along, not the item's own: `source.ends` is what the
		// hold was picked up under, from `CardSource`, and it may disagree with the
		// item's CURRENT type by release if the model refreshed mid-hold. Both the plan
		// AND the write's expected shape are built from it — `unschedulePlan` too — so a
		// PBI that became a Milestone mid-drag gets refused whole by the writer's own
		// shape check rather than quietly narrowed to a target-only removal. See
		// `performScheduleMove`'s own comment on why neither may be recomputed here.
		plan: (source) => void host.performScheduleMove(source.item, unschedulePlan(source.item, source.ends), undefined, source.ends),
		tooltip: 'Results this axis cannot place — dropping a bar here removes its dates',
		// The bar BODY alone: a grip released here is a resize, not an unschedule, and
		// a shelf card's own hold is null — both refused by the same test. Refused
		// rather than ignored, so the strip never highlights for a drag it would not
		// honour.
		accepts: (source) => source.hold === 'body',
		outcome: removalOutcome,
		canDrag: (item) => canSchedule(host.settings, item),
	};
}

/**
 * What this removal would LEAVE, predicted from the function that places. `deriveBars`
 * decides bar-or-shelf over several rules that do not compose into one — a marker goes
 * through `placeMarker`, which ignores the start entirely and shelves whenever the
 * target is absent, so a marker keeping a stale start still shelves and never reaches
 * `inferSpan`; an unreadable or reversed pair shelves with its reason before any
 * inference is asked. A comparison written beside those and expected to agree with them
 * is exactly what drifted when the second axis arrived.
 *
 * The preview PREDICTS and the announcement REPORTS: this is drawn from the model in
 * hand, and a descendant's dates changed by another editor mid-drag can make the real
 * outcome differ. That is true of every preview here and needs no machinery — the
 * announcement names the placement from the REBUILT model instead.
 */
function removalOutcome(item: BacklogItem): string {
	const left = placeItem(item, withoutEnds(statedEnds(item), placementEnds(item.typeName)));
	return left.kind === 'shelf' ? UNSCHEDULED_LABEL : `Keeps ${spanText(left.bar)}`;
}

/**
 * Everything the axis could not place, in sibling order, counted — the roadmap
 * reports how much of the backlog is not yet planned instead of implying the
 * plan is the whole story.
 *
 * An EMPTY shelf stays in the DOM regardless of axis: a drop on it means something on
 * both now — un-placing a horizon or a bar's own dates — and a target that exists only
 * while it is occupied is one nothing can ever reach. Before a bar could be held, the
 * dated axis's empty shelf really did promise a write it could not make and stayed out
 * of the DOM for exactly that reason; this task is what closes that gap.
 */
function renderShelf(
	ctx: RowContext,
	frameEl: HTMLElement,
	shelf: ShelfCard[],
	dnd: CardDragController,
	removal: ShelfRemoval,
): { cards: BacklogItem[]; el: HTMLElement | null } {
	const empty = shelf.length === 0;
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
	// The outcome line is only where a removal has one to say — the horizon axis's
	// drop always un-places, so it has nothing to distinguish before the release.
	const outcomeEl = removal.outcome ? header.createDiv({ cls: 'pbl-shelf-outcome' }) : null;
	// The one target whose drop REMOVES rather than writes has to say so, exactly as
	// the board's no-state column does.
	setTooltip(header, removal.tooltip);
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
		// A gesture whose only possible batch is empty must not begin: `removal.canDrag`
		// is `canSchedule` on the dated axis, the same gate the row's own Schedule entry
		// uses (`interactions/plan.ts`) — a marker with no writable end offers no grip at
		// all. A shelf card is always wired with `hold: null`, which is exactly what each
		// axis's `removal.accepts` refuses on its own strip.
		if (removal.canDrag(entry.item)) dnd.wireCard(card, entry.item);
	}
	// Entering the vocabulary is the triage gesture on the horizon axis, and un-placing
	// a bar's dates is the dated axis's mirror of the same drop — both wired here,
	// through the removal the axis supplied.
	dnd.wireDropTarget(shelfEl, removal.plan, {
		accepts: removal.accepts,
		onEnter: (source) => outcomeEl?.setText(removal.outcome?.(source.item) ?? ''),
		onLeave: () => outcomeEl?.setText(''),
	});
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
