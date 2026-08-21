import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { createCard, renderCardBody, renderColumnFold, wireCardActivation } from './board';
import { RowContext, renderPropCells } from './columns';
import { renderShelfControls } from './shelfControls';
import { spanText } from './lanes';
import { dependencyNote } from './timelineArrows';
import { BacklogViewHost } from '../host';
import { CardDragController, CardSource } from '../interactions/cardDrag';
import { renderShelfResize, SHELF_HEIGHT_VAR } from '../interactions/shelfResize';
import { canSchedule, unschedulePlan } from '../interactions/plan';
import { BacklogItem } from '../../domain/model';
import { placeItem, ShelfCard, statedEnds, unscheduledLabel, withoutEnds } from '../../domain/bars';
import { placementEnds } from '../../domain/itemTypes';
import { BacklogSettings } from '../../domain/settings';
import { drawsGrid, RoadmapAxis } from '../../domain/roadmap';
import { organizeShelf, searchShelf, ShelfGroup } from '../../domain/shelf';

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
	/**
	 * Which axis is drawing, or **null on a board's shelf**, which has no axis at all —
	 * and so states nothing about what a card waits for, exactly as the horizon axis
	 * does not.
	 */
	axis: RoadmapAxis | null;
	/**
	 * What the header calls this shelf. The roadmap's is a PLACEMENT (`shelfLabel`) and
	 * the iteration board's is a POPULATION (`shelf.backlog`), so the word is the
	 * caller's rather than this module's — passed rather than defaulted, because a
	 * default here is the roadmap's own reading arriving unasked on a board.
	 */
	name: string;
	/**
	 * Whether the header carries the sort, type filter and search. The roadmap's shelf
	 * does; a board's does not, and that is a scope decision rather than a shape one —
	 * the pickers' keyboard path is the card menu's shelf section, which is built for
	 * the roadmap alone, and their focus rule reads the roadmap's own snapshot.
	 */
	picks: boolean;
	/**
	 * Where this shelf's own collapse is kept, and how it is set. The roadmap's is the
	 * view-state store's `shelfExpanded`; the iteration board's is a COLUMN fold
	 * (`ColumnScope` `'backlog'`), which is the same mechanism the type groups inside it
	 * already use and defaults to OPEN — a shelf a reader has to find before they can
	 * pull from it answers nothing. Passed rather than read here, so one component can
	 * draw two bands without either owning the other's bit.
	 */
	fold: { collapsed: boolean; set: (collapsed: boolean) => void };
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
			tooltip: t('shelf.removeHorizon'),
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
			tooltip: t('shelf.removeAssignee'),
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
		plan: (source) =>
			void host.performScheduleMove(source.item, unschedulePlan(source.item, host.settings, source.ends), undefined, source.ends),
		tooltip: t('shelf.removeDates'),
		// The bar BODY alone: a grip released here is a resize, not an unschedule, and
		// a shelf card's own hold is null — both refused by the same test. Refused
		// rather than ignored, so the strip never highlights for a drag it would not
		// honour.
		accepts: (source) => source.hold === 'body',
		outcome: (item) => removalOutcome(item, host.settings),
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
function removalOutcome(item: BacklogItem, settings: BacklogSettings): string {
	const ends = placementEnds(item.typeName, settings.iterationBars);
	const left = placeItem(item, withoutEnds(statedEnds(item), ends), settings.iterationBars);
	return left.kind === 'shelf' ? unscheduledLabel() : t('shelf.removalKeeps', { span: spanText(left.bar) });
}

/**
 * Everything the axis could not place, in sibling order, counted, narrowed by the
 * shelf's own title search, grouped by type, sorted within each group and filtered by
 * type — all four of the last display-only, never written. The count above them stays
 * the TRUE total whatever they leave showing, so the roadmap reports how much of the
 * backlog is not yet planned instead of implying the plan is the whole story.
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
	const collapsed = !empty && shelf.fold.collapsed;
	const list = host.shelfLayout === 'list';
	const shelfEl = frameEl.createDiv({
		cls:
			'pbl-shelf' +
			(empty ? ' pbl-shelf-empty' : '') +
			(collapsed ? ' pbl-shelf-collapsed' : '') +
			(list ? ' pbl-shelf-list' : ''),
		attr: {
			role: 'group',
			'aria-label': t('roadmap.groupLabel', { name: shelf.name, count: shelfCards.length }),
		},
	});
	// Only once a height has been PICKED. Absent, the stylesheet's own `var()` fallback is
	// the share of the pane the band has always taken — the store's "a default is written
	// as nothing at all" rule, kept up here so the two cannot name different defaults.
	if (host.shelfHeight !== null) shelfEl.setCssProps({ [SHELF_HEIGHT_VAR]: `${host.shelfHeight}px` });
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	renderShelfControls(host, header, shelfCards, { name: shelf.name, picks: shelf.picks, fold: shelf.fold });
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
	// The shelf is a scrollport of its own — the band rule's cap plus `overflow-y: auto`
	// (`styles/roadmap.css`) — so a card held at its bottom edge has to scroll it, exactly
	// as `.pbl-bucket-cards`, `.pbl-board-col-cards` and the timeline's own scroller do.
	// It had no auto-scroll at all until 2026-08-17: nineteen unplaced cards measured 1301px
	// of content in a 143px box in the browser harness, so eighteen of them were out of
	// reach for the whole drag — on the horizon axis, where the shelf is what a card is
	// dragged FROM. Wired here beside the drop target rather than after the return below:
	// collapsed there is nothing to scroll, but the scroller and the target are one piece of
	// drag machinery and splitting them across an early return is how one gets forgotten.
	dnd.wireScroller(shelfEl);
	if (empty || collapsed) return { cards: [], el: shelfEl };

	// `dnd` and `removal` travel together to every card below, and now so does which
	// of them is in conflict (2b) and which axis is drawing — grouped once here rather
	// than threading a fourth and fifth argument through both `renderShelfGroup` and
	// `renderShelfCard`.
	const wiring: ShelfWiring = { dnd, removal, conflicts: shelf.conflicts, axis: shelf.axis, list };
	const cards: BacklogItem[] = [];
	// **A narrowing belongs to the control that shows it.** The search and the type filter
	// both HIDE cards and both say on their own face that they are doing so — the button
	// goes active, the box keeps the text that caused it — so a shelf drawn without those
	// controls applies neither: the picks are the roadmap's (see `ShelfInput.picks`), and
	// a type hidden there would otherwise take cards off the iteration board's shelf with
	// nothing on screen to show why and nothing to clear it with. Found by review (Codex,
	// PR #182). The SORT is not in this rule and is applied either way: it orders what is
	// drawn and hides nothing, so a pick made on the roadmap costs a reader nothing here.
	// Searched first, then grouped: `searchShelf` states why that order is the rule.
	const shown = shelf.picks ? searchShelf(shelfCards, host.shelfSearch) : shelfCards;
	for (const group of organizeShelf(shown, host.shelfSort, shelf.picks ? host.shelfHiddenTypes : NO_HIDDEN)) {
		cards.push(...renderShelfGroup(ctx, shelfEl, group, wiring));
	}
	// Last, and after the groups rather than beside the header: the grip sits at the band's
	// FOOT, which is the edge a taller shelf moves, and it is the one control here that has
	// to be measured against a band already built. An empty or collapsed shelf returned
	// above and gets none — there is no open height to size.
	renderShelfResize(host, shelfEl);
	return { cards, el: shelfEl };
}

/** What every card in the expanded shelf needs beyond its own data — see `renderShelf`. */
interface ShelfWiring {
	dnd: CardDragController;
	removal: ShelfRemoval;
	/** Which of each dependent's prerequisites are in conflict (2b) — see `ShelfInput`. */
	conflicts: ReadonlyMap<string, ReadonlySet<string>>;
	/** Which axis is drawing, null on a board — see `ShelfInput`. */
	axis: RoadmapAxis | null;
	/** Whether this shelf is drawing compact rows rather than cards — see `renderShelfCard`. */
	list: boolean;
}

/** Shared by every card with no conflicting prerequisite, so nothing is allocated for the common case. */
const NO_CONFLICTS: ReadonlySet<string> = new Set();

/** A shelf whose header carries no type filter hides no type — see `renderShelf`. */
const NO_HIDDEN: ReadonlySet<string> = new Set();

/**
 * One type group inside the expanded shelf: its header, then its cards in sort order —
 * unless the reader has folded this type away, which is the board column's own fold asked
 * of a TYPE (`ColumnScope`'s `shelf`), so it persists per saved view and per device with
 * every other fold and needs nothing of its own in the store. `false` for the default: a
 * type nobody has ruled on is open, since an axis has no notion of a finished type and the
 * shelf's whole purpose is showing what is still untriaged.
 *
 * A folded group draws no card and RETURNS none — `renderBucket`'s rule, and for its
 * reason: `cards` is the keyboard's walk and what the pane's `listbox`/`region` role is
 * decided from, so a card that is not drawn must not be selectable. What it keeps is its
 * COUNT, which is the difference between this and the type filter beside it: hiding a type
 * takes the group away, folding it says how much is behind the fold.
 */
function renderShelfGroup(ctx: RowContext, shelfEl: HTMLElement, group: ShelfGroup, wiring: ShelfWiring): BacklogItem[] {
	const host = ctx.host;
	const folded = host.columnCollapsed('shelf', group.type, false);
	const groupEl = shelfEl.createDiv({
		cls: 'pbl-shelf-group' + (folded ? ' pbl-shelf-group-collapsed' : ''),
		attr: {
			role: 'group',
			// Folded is said in the NAME, the bucket's reason exactly: the count survives the
			// fold, so a group that stayed silent about it would announce cards it is not
			// drawing.
			'aria-label': t(folded ? 'roadmap.groupLabelCollapsed' : 'roadmap.groupLabel', {
				name: group.type,
				count: group.cards.length,
			}),
		},
	});
	const header = groupEl.createDiv({ cls: 'pbl-shelf-group-header' });
	renderColumnFold(host, header, 'shelf', group.type, { folded, label: group.type });
	header.createSpan({ cls: 'pbl-shelf-group-name', text: group.type });
	header.createSpan({ cls: 'pbl-shelf-group-count', text: String(group.cards.length) });
	if (folded) return [];
	const cardsEl = groupEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const entry of group.cards) renderShelfCard(ctx, cardsEl, entry, wiring);
	return group.cards.map((entry) => entry.item);
}

/** One shelved card: its body, its shelving reason, what it waits for, and its drag source. */
function renderShelfCard(ctx: RowContext, cardsEl: HTMLElement, entry: ShelfCard, wiring: ShelfWiring): void {
	const card = createCard(ctx, cardsEl, entry.item);
	renderCardBody(ctx, card, entry.item);
	ctx.placed.add(entry.item.file.path);
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
	const waits = wiring.axis !== null && drawsGrid(wiring.axis) ? dependencyNote(entry.item, conflicting) : '';
	if (waits) {
		const dep = card.createDiv({ cls: 'pbl-shelf-dependency' + (conflicting.size > 0 ? ' pbl-shelf-conflict' : '') });
		drawIcon(dep.createSpan({ cls: 'pbl-shelf-dependency-icon' }), conflicting.size > 0 ? 'alert-triangle' : 'link');
		dep.createSpan({ text: waits });
	}
	// **The one thing a list row shows that a card does not.** A card draws no state chip
	// because its own POSITION already says the state — a board column is a state and a
	// bucket is a horizon — and the shelf is precisely where that argument does not hold:
	// a shelved card is in no column and no bucket, so its state appears nowhere else on
	// screen. It is drawn here rather than in `renderCardBody` because the row is where
	// there is a line to spare for it; in the card grid the stacked body already carries
	// enough, and adding a chip to it would be a change to the card the shelf was not
	// asked for. Through the resolved columns and `renderPropCells` like every other cell,
	// so a context row gets the static form and the write gate is the one the tree uses —
	// this is not a second idea of what a state chip is.
	if (wiring.list) renderShelfState(ctx, card, entry.item);
	wireCardActivation(ctx, card, entry.item);
	// A gesture whose only possible batch is empty must not begin: `removal.canDrag`
	// is `canSchedule` on the dated axis, the same gate the row's own Schedule entry
	// uses (`interactions/plan.ts`) — a marker with no writable end offers no grip at
	// all. A shelf card is always wired with `hold: null`, which is exactly what each
	// axis's `removal.accepts` refuses on its own strip.
	if (wiring.removal.canDrag(entry.item)) wiring.dnd.wireCard(card, entry.item);
}

/**
 * The state cell a compact row carries at its end, in a wrapper of its own so the
 * stylesheet can push it there — `renderPropCells` names its own box `.pbl-props`, which
 * the card body above has already used once, and a rule addressing the second one by
 * position would be a rule about a sibling count.
 *
 * The columns are the RESOLVED ones (`ctx.columns`), never a second reading of the
 * settings: a Base that draws no state property draws no chip here either, which is the
 * tree's own answer — the chip IS that property's cell. Both state columns are passed
 * where two are configured, and `renderStateChip` fills exactly the one whose key this
 * item's workflow writes, leaving the other empty; `dropEmpty` then detaches it, so a row
 * never carries a chip-shaped gap for a workflow it is not in.
 */
function renderShelfState(ctx: RowContext, card: HTMLElement, item: BacklogItem): void {
	const stateColumns = ctx.columns.filter((column) => column.kind === 'state');
	if (stateColumns.length === 0) return;
	const stateEl = card.createDiv({ cls: 'pbl-shelf-state' });
	renderPropCells(ctx, stateEl, item, stateColumns, { dropEmpty: true });
}
