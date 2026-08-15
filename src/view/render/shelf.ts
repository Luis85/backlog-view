import { setTooltip } from 'obsidian';
import { drawIcon } from './icons';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderShelfControls } from './shelfControls';
import { spanText } from './timeline';
import { dependencyNote } from './timelineArrows';
import { BacklogViewHost } from '../host';
import { CardDragController, CardSource } from '../interactions/cardDrag';
import { canSchedule, unschedulePlan } from '../interactions/plan';
import { BacklogItem } from '../../domain/model';
import { placeItem, ShelfCard, statedEnds, UNSCHEDULED_LABEL, withoutEnds } from '../../domain/bars';
import { placementEnds } from '../../domain/itemTypes';
import { drawsGrid, RoadmapAxis, SHELF_LABEL } from '../../domain/roadmap';
import { organizeShelf, ShelfGroup } from '../../domain/shelf';

/** What dropping a card on the shelf MEANS, the words that promise it, and its preview. */
/**
 * The shelf to render, which of each card's prerequisites are in dependency conflict
 * (2b), and which axis is drawing — grouped into one param so `renderShelf` stays
 * under the five-parameter budget. `conflicts` is keyed by dependent path, empty on
 * the horizon axis, where this conflict has no meaning — see `dependencyArrows`'s own
 * `conflicts` (`TimelineRender.dependencyConflicts` on the dated axis). `axis` is what
 * gates the dependency statement itself (below): `Arrows between bars`' Preconditions
 * scope the whole feature — statement included — to "Roadmap mode is on with the
 * dated axis", so a shelf card drawn on the horizon axis must say nothing about what
 * it waits for, not merely leave the conflict half unmarked.
 */
export interface ShelfInput {
	cards: ShelfCard[];
	conflicts: ReadonlyMap<string, ReadonlySet<string>>;
	axis: RoadmapAxis;
}

export interface ShelfRemoval {
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
export function shelfRemoval(host: BacklogViewHost, axis: RoadmapAxis): ShelfRemoval {
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
	if (axis === 'resources') {
		return {
			// No gesture rides along: this strip un-places on the axis it draws, which here
			// means the ASSIGNEE. A bar's dates are untouched — a row is who, and where the
			// work sits on the calendar is not a fact this drop was asked about.
			plan: (source) => void host.performResourceMove(source.item, null),
			tooltip: 'Results this axis cannot place — dropping a card here removes its assignee',
			// Everything but a GRIP. The horizon axis's rule and its reason for the shelf
			// card: one already DRAWN here can still carry a name — assigned, with no date to
			// sit beside — so refusing a re-drop would withhold exactly the cleanup its
			// shelving reason is asking for, and one with nothing to clear plans zero writes
			// and no-ops. A bar arrives by its body hold. A grip is refused, the dated axis's
			// own rule: dragging an end onto the shelf is a resize that overshot, not a
			// request to un-assign.
			accepts: (source) => source.hold !== 'start' && source.hold !== 'end',
			// Nothing to distinguish before the release: a drop here always un-assigns.
			outcome: null,
			// Every shelved item can be re-assigned. Unlike the dated axis there is no type
			// here whose only writable end might be unconfigured, so no gate is needed.
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
 * Everything the axis could not place, in sibling order, counted, grouped by type,
 * sorted within each group and filtered by type — all three of the last display-only,
 * never written. The roadmap reports how much of the backlog is not yet planned
 * instead of implying the plan is the whole story.
 *
 * An EMPTY shelf stays in the DOM regardless of axis: a drop on it means something on
 * both now — un-placing a horizon or a bar's own dates — and a target that exists only
 * while it is occupied is one nothing can ever reach. Before a bar could be held, the
 * dated axis's empty shelf really did promise a write it could not make and stayed out
 * of the DOM for exactly that reason.
 *
 * Collapsing contributes zero cards, exactly as an empty shelf already did, so the
 * caller's keyboard-walk array and the pane's listbox/region role stay correct with no
 * extra logic for either case. The drop target and its preview are wired BEFORE the
 * collapsed/empty check below, never after: collapsing is a view convenience and must
 * never gate the one thing that un-places.
 *
 * The header renders unconditionally — collapsed, expanded or empty — because it is the
 * ONE label a user sees while their attention and cursor are actually over the shelf
 * mid-drag, and because it carries the disclosure that opens a shut shelf: controls for
 * the shelf live in it (`renderShelfControls`), not in the view's toolbar.
 */
export function renderShelf(
	ctx: RowContext,
	frameEl: HTMLElement,
	shelf: ShelfInput,
	dnd: CardDragController,
	removal: ShelfRemoval,
): { cards: BacklogItem[]; el: HTMLElement } {
	const host = ctx.host;
	const shelfCards = shelf.cards;
	const empty = shelfCards.length === 0;
	const collapsed = !empty && host.shelfCollapsed;
	const shelfEl = frameEl.createDiv({
		cls: 'pbl-shelf' + (empty ? ' pbl-shelf-empty' : '') + (collapsed ? ' pbl-shelf-collapsed' : ''),
		attr: {
			role: 'group',
			'aria-label': `${SHELF_LABEL}, ${shelfCards.length} item${shelfCards.length === 1 ? '' : 's'}`,
		},
	});
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	renderShelfControls(host, header, shelfCards);
	// The outcome line is only where a removal has one to say — the horizon axis's
	// drop always un-places, so it has nothing to distinguish before the release.
	const outcomeEl = removal.outcome ? header.createDiv({ cls: 'pbl-shelf-outcome' }) : null;
	// The one target whose drop REMOVES rather than writes has to say so, exactly as
	// the board's no-state column does.
	setTooltip(header, removal.tooltip);
	// Entering the vocabulary is the triage gesture on the horizon axis, and un-placing
	// a bar's dates is the dated axis's mirror of the same drop — both wired here,
	// through the removal the axis supplied, and wired before collapsing can ever
	// short-circuit the render below.
	dnd.wireDropTarget(shelfEl, removal.plan, {
		accepts: removal.accepts,
		onEnter: (source) => outcomeEl?.setText(removal.outcome?.(source.item) ?? ''),
		onLeave: () => outcomeEl?.setText(''),
	});
	if (empty || collapsed) return { cards: [], el: shelfEl };

	// `dnd` and `removal` travel together to every card below, and now so does which
	// of them is in conflict (2b) and which axis is drawing — grouped once here rather
	// than threading a fourth and fifth argument through both `renderShelfGroup` and
	// `renderShelfCard`.
	const wiring: ShelfWiring = { dnd, removal, conflicts: shelf.conflicts, axis: shelf.axis };
	const cards: BacklogItem[] = [];
	for (const group of organizeShelf(shelfCards, host.shelfSort, host.shelfHiddenTypes)) {
		cards.push(...renderShelfGroup(ctx, shelfEl, group, wiring));
	}
	return { cards, el: shelfEl };
}

/** What every card in the expanded shelf needs beyond its own data — see `renderShelf`. */
interface ShelfWiring {
	dnd: CardDragController;
	removal: ShelfRemoval;
	/** Which of each dependent's prerequisites are in conflict (2b) — see `ShelfInput`. */
	conflicts: ReadonlyMap<string, ReadonlySet<string>>;
	/** Which axis is drawing — see `ShelfInput`. */
	axis: RoadmapAxis;
}

/** Shared by every card with no conflicting prerequisite, so nothing is allocated for the common case. */
const NO_CONFLICTS: ReadonlySet<string> = new Set();

/** One type group inside the expanded shelf: its header, then its cards in sort order. */
function renderShelfGroup(ctx: RowContext, shelfEl: HTMLElement, group: ShelfGroup, wiring: ShelfWiring): BacklogItem[] {
	const groupEl = shelfEl.createDiv({ cls: 'pbl-shelf-group' });
	const header = groupEl.createDiv({ cls: 'pbl-shelf-group-header' });
	header.createSpan({ cls: 'pbl-shelf-group-name', text: group.type });
	header.createSpan({ cls: 'pbl-shelf-group-count', text: String(group.cards.length) });
	const cardsEl = groupEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const entry of group.cards) renderShelfCard(ctx, cardsEl, entry, wiring);
	return group.cards.map((entry) => entry.item);
}

/** One shelved card: its body, its shelving reason, what it waits for, and its drag source. */
function renderShelfCard(ctx: RowContext, cardsEl: HTMLElement, entry: ShelfCard, wiring: ShelfWiring): void {
	const card = createCard(ctx, cardsEl, entry.item);
	renderCardBody(ctx, card, entry.item);
	ctx.placed.set(entry.item.file.path, { item: entry.item, mount: card, listsChildren: true, face: 'links' });
	// Unreadable is unplaced, and the card says why rather than rendering
	// somewhere a guess put it.
	if (entry.reason !== null) {
		const reason = card.createDiv({ cls: 'pbl-shelf-reason' });
		drawIcon(reason.createSpan({ cls: 'pbl-shelf-reason-icon' }), 'alert-triangle');
		reason.createSpan({ text: entry.reason });
	}
	// 1b: no bar exists here for any arrow to reach — the shelf card IS this
	// dependent's row, so what it waits for (and which of that runs past this card's
	// own stated start, 2b, or never resolved at all, 1d) has to be stated here or it
	// is stated nowhere — but only on the DATED axis: `Arrows between bars`'
	// Preconditions scope the whole feature to "Roadmap mode is on with the dated
	// axis", and `Dependencies`' "It marks damage in one place" refuses this exact
	// promise on the other three surfaces a prerequisite can be set from. Gated on the
	// axis itself, not on `conflicting` being empty — that would also silence a
	// dated card with no conflict, which is the bug the previous round fixed. Same
	// string `dependencyNote` builds for a dated row, so a reader gets one phrasing of
	// one fact wherever it does show. Visible content, like the reason above it, so it
	// reaches the card's accessible name the same content-derived way.
	const conflicting = wiring.conflicts.get(entry.item.file.path) ?? NO_CONFLICTS;
	const waits = drawsGrid(wiring.axis) ? dependencyNote(entry.item, conflicting) : '';
	if (waits) {
		const dep = card.createDiv({ cls: 'pbl-shelf-dependency' + (conflicting.size > 0 ? ' pbl-shelf-conflict' : '') });
		drawIcon(dep.createSpan({ cls: 'pbl-shelf-dependency-icon' }), conflicting.size > 0 ? 'alert-triangle' : 'link');
		dep.createSpan({ text: waits });
	}
	wireCardActivation(ctx, card, entry.item);
	// A gesture whose only possible batch is empty must not begin: `removal.canDrag`
	// is `canSchedule` on the dated axis, the same gate the row's own Schedule entry
	// uses (`interactions/plan.ts`) — a marker with no writable end offers no grip at
	// all. A shelf card is always wired with `hold: null`, which is exactly what each
	// axis's `removal.accepts` refuses on its own strip.
	if (wiring.removal.canDrag(entry.item)) wiring.dnd.wireCard(card, entry.item);
}

/**
 * Context rows with no place on the axis — a focused item outside the filter
 * whose value names no existing bucket, or whose own dates never place it. They
 * stand beside the shelf, apart from its count: a context row is not a result,
 * and the shelf is a statement about the results. Never grouped, sorted or
 * filtered: the context-row rule (never a ranking peer, never a source of
 * anything derived from the results) applies here exactly as everywhere else.
 */
export function renderContextStrip(
	ctx: RowContext,
	frameEl: HTMLElement,
	context: BacklogItem[],
): { cards: BacklogItem[]; el: HTMLElement | null } {
	if (context.length === 0) return { cards: [], el: null };
	const stripEl = frameEl.createDiv({ cls: 'pbl-roadmap-context', attr: { role: 'group', 'aria-label': 'Context' } });
	const header = stripEl.createDiv({ cls: 'pbl-shelf-header' });
	drawIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'corner-left-down');
	header.createSpan({ cls: 'pbl-shelf-name', text: 'Context' });
	setTooltip(header, "Not in this base's filter — shown for the hierarchy, never counted");
	const cardsEl = stripEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const item of context) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		ctx.placed.set(item.file.path, { item, mount: card, listsChildren: true, face: 'links' });
		wireCardActivation(ctx, card, item);
	}
	return { cards: context, el: stripEl };
}
