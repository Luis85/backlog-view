import { setTooltip } from 'obsidian';
import { formatNumber, t } from '../../i18n/t';
import { drawIcon } from './icons';
import { createCard, renderCardBody, renderColumnFold, wireCardActivation } from './board';
import {
	columnsWithContent,
	metaColWidth,
	publishColumnWidths,
	RowContext,
	renderPropCells,
	rollupChars,
	shelfBadgeWidth,
} from './columns';
import { renderShelfControls } from './shelfControls';
import { spanText } from './lanes';
import { dependencyNote } from './timelineArrows';
import { BacklogViewHost, Column } from '../host';
import { CardDragController, CardSource } from '../interactions/cardDrag';
import { publishShelfHeight, renderShelfResize } from '../interactions/shelfResize';
import { canSchedule, unschedulePlan } from '../interactions/plan';
import { BacklogItem } from '../../domain/model';
import { placeItem, ShelfCard, statedEnds, unscheduledLabel, withoutEnds } from '../../domain/bars';
import { isMarkerType, placementEnds } from '../../domain/itemTypes';
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
 *
 * Carried a fourth field, `picks`, until 2026-08-21: whether the header carried the
 * sort, type filter and search, withheld on the iteration board because their keyboard
 * path — the card menu's shelf section — was the roadmap's alone. That reason is gone
 * (`addShelfSection` serves both surfaces now), and with it the last caller that could
 * ever pass `false`: every band this module draws carries the picks, unconditionally,
 * so the field had become a boolean that could only read `true` — removed rather than
 * left as a distinction nothing can any longer make.
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
			// Every shelved item can be re-assigned — every item that a drop here would
			// ASSIGN, which is not all of them. A MARKER released in a band never writes a
			// row (`wireLaneDrop`: the milestones' row stands for nobody, and a marker draws
			// there whatever its assignee says), so the only write its drag can make is the
			// DATE the release names — and a marker with no writable end has neither. That
			// is a `Resource` always, and a `Milestone` in a view with no target key: the
			// card would pick up, the band would highlight, and the release would write and
			// announce nothing. This gate used to say no type here could want the dated
			// axis's own, which was true while every marker was a date.
			canDrag: (item) => !isMarkerType(item.typeName) || canSchedule(host.settings, item),
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
	// `null` — a type the axis does not place at all — reads as unscheduled here for the
	// same reason the shelf does: nothing would be left drawn. Unreachable today, since a
	// card on this shelf was placed by the same call.
	return left?.kind !== 'bar' ? unscheduledLabel() : t('shelf.removalKeeps', { span: spanText(left.bar) });
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
	// Which EDGE of this band is the one that moves. The grid axes draw the shelf after the
	// grid, so it sits at the foot of the frame and the edge between it and the grid is its
	// TOP; every other surface — the horizon axis since 2026-08-17, both boards — leads with
	// the shelf, so that edge is its foot. `styles/shelfControls.css` moves the grip to
	// whichever it is and `shelfResize.ts` flips what a downward drag means; the class is
	// what tells them, and it also buys the band a real bottom gutter (`styles/shelf.css`),
	// since with nothing pinned to that edge the cards would otherwise end 4px from it.
	const below = shelf.axis !== null && drawsGrid(shelf.axis);
	const shelfEl = frameEl.createDiv({
		cls:
			'pbl-shelf' +
			(empty ? ' pbl-shelf-empty' : '') +
			(collapsed ? ' pbl-shelf-collapsed' : '') +
			(below ? ' pbl-shelf-below' : '') +
			(list ? ' pbl-shelf-list' : ''),
		attr: {
			role: 'group',
			'aria-label': t('roadmap.groupLabel', { name: shelf.name, count: shelfCards.length }),
		},
	});
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	renderShelfControls(host, header, shelfCards, { name: shelf.name, fold: shelf.fold });
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

	const cards: BacklogItem[] = [];
	// **A narrowing belongs to the control that shows it.** The search and the type filter
	// both HIDE cards and both say on their own face that they are doing so — the button
	// goes active, the box keeps the text that caused it — which is exactly why they used
	// to be gated on `ShelfInput.picks`: a shelf drawn without those controls could take
	// cards off the iteration board's shelf with nothing on screen to show why and nothing
	// to clear it with (found by review, Codex on PR #182). That gate is gone with the
	// field (see `ShelfInput`'s own header) because every band this module draws now
	// carries the controls the narrowing needs — apply them unconditionally rather than
	// re-deciding a question with only one answer left. The SORT was never in this rule and
	// is applied either way: it orders what is drawn and hides nothing, so a pick made on
	// the roadmap costs a reader nothing here.
	// **Nor is the LAYOUT** (`list`, above), for the identical reason and stated here rather
	// than beside it because this is where the two categories are told apart: cards or rows
	// changes how much room each card takes and draws every one of them either way, so a
	// reader who has never seen the picker has lost no work and needs no way back to it. The
	// shelf's HEIGHT is one value for both bands on the same argument. The register said the
	// opposite of this paragraph for one commit and neither direction was checked at the time
	// (Codex, PR #183) — `test/view/shelfLayout.test.ts` drives both now.
	// Searched first, then grouped: `searchShelf` states why that order is the rule.
	// Materialized rather than iterated in place: the rollup reservation below is sized from
	// what the type filter LEFT, and `organizeShelf` is the only thing that applies it.
	const groups = organizeShelf(searchShelf(shelfCards, host.shelfSearch), host.shelfSort, host.shelfHiddenTypes);
	// What the band holds, once, for the two reservations below it: the columns a row keeps
	// and the rollup label's own width. From the GROUPS on both counts — the rule and its
	// reason are stated at the rollup, which found it.
	const shown = groups.flatMap((group) => group.cards).map((entry) => entry.item);
	// `dnd` and `removal` travel together to every card below, and so do which of them is in
	// conflict (2b), which axis is drawing and which columns this band keeps — grouped once
	// here rather than threading five arguments through both `renderShelfGroup` and
	// `renderShelfCard`.
	//
	// **A compact row reserves a column the band has something to show in, and no other.**
	// The per-ROW rule beside it is `holdEmpty` and is unchanged: a row that dropped its own
	// empty cell would move every cell after it and the column would stop being one. This is
	// the per-BAND question, and it is only askable here — a row has no column header to say
	// what an empty column is, so a column no card in the band draws is a stretch of nothing
	// between the title and the metadata rather than an empty column a reader can see.
	// Measured at a 1280px pane over the demo backlog's twenty unplaced items: three of the
	// five reserved columns drew on zero rows, 384px of the row, while every title sat at its
	// own 16ch floor. The CARD grid asks nothing of this — it already drops an empty cell per
	// card (`dropEmpty`), so a column nothing draws is absent from every card in it anyway.
	const wiring: ShelfWiring = {
		dnd,
		removal,
		conflicts: shelf.conflicts,
		axis: shelf.axis,
		list,
		columns: list ? columnsWithContent(host, ctx.columns, shown) : undefined,
	};
	for (const group of groups) {
		cards.push(...renderShelfGroup(ctx, shelfEl, group, wiring));
	}
	// Last, and after the groups rather than beside the header: the grip sits at the band's
	// FOOT, which is the edge a taller shelf moves, and it is the one control here that has
	// to be measured against a band already built. An empty or collapsed shelf returned
	// above and gets none — there is no open height to size.
	//
	// **The stored height is published HERE, past that same return, rather than up with the
	// band's other attributes.** A picked height is a real `height` now, so a band carrying
	// one is exactly that tall — including a band with nothing to show: published
	// unconditionally, a collapsed shelf drew its 24px header and 376px of blank space under
	// a 400px pick (measured), and the empty drop strip `.pbl-dragging` reveals would be
	// 400px of target. The height belongs to precisely the states the GRIP belongs to, so it
	// is set where the grip is set and the two cannot come apart. (Codex, PR #183 — a
	// regression from the height model, and the call site I failed to re-read when the
	// meaning of the value changed under it.)
	//
	// A compact row's columns are shared across rows, so the widths have to be somewhere both
	// this band and every cell in it can see — and the tree's publisher does not run for a
	// card projection. Published per render on the band, so nothing here can inherit a stale
	// number from a tree pass that happened before a projection switch. Only in list mode: a
	// card sizes its cells to content and would be overruled by a width it never asked for.
	// Past the empty/collapsed return above for the same reason the height is: a band with
	// nothing to show reserves nothing, exactly as it publishes no height.
	if (list) {
		publishColumnWidths(shelfEl, ctx.columns, host);
		// The badge slot, from the fixed vocabulary — and the ROLLUP's own reservation, which is
		// what `--pbl-meta-col` and `--pbl-rollup-label` actually mean. `styles/columns.css`
		// already sizes `.pbl-meta-col` from the pair, so publishing them here makes the box
		// `renderRollup` draws into a fixed width on this band, computed from THIS band's items
		// rather than inherited from a tree pass. `rollupChars` returns 0 where nothing reports
		// one, and the label variable is left off entirely in that case — absent is the only
		// honest spelling of "none", the same rule `renderTree` keeps.
		//
		// **From the GROUPS, never from the searched list.** Two narrowings reach this band and
		// only one of them is in `searchShelf`: `organizeShelf` is where `shelfHiddenTypes` is
		// applied, so sizing off its input let a hidden type's widest ratio go on reserving a
		// lane nothing draws into — the search moved the columns and the type filter did not.
		// A FOLDED group still counts, and that is the point of reading the groups rather than
		// the rendered cards: folding a group is not a narrowing, and a width that moved on it
		// would jump the columns every time a reader opened one. (Codex, PR #187.)
		const chars = rollupChars(host, shown);
		shelfEl.setCssProps({
			'--pbl-shelf-badge': `${shelfBadgeWidth()}px`,
			'--pbl-meta-col': `${metaColWidth(chars)}px`,
		});
		if (chars > 0) shelfEl.setCssProps({ '--pbl-rollup-label': `${chars}ch` });
		else shelfEl.style.removeProperty('--pbl-rollup-label');
	}
	publishShelfHeight(shelfEl, host.shelfHeight);
	renderShelfResize(host, shelfEl, below);
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
	/**
	 * The columns this BAND has anything to show in, or undefined in the card grid, which
	 * drops an empty cell per card and needs no such list — see `renderShelf`, where it is
	 * computed from the groups.
	 */
	columns?: Column[];
}

/** Shared by every card with no conflicting prerequisite, so nothing is allocated for the common case. */
const NO_CONFLICTS: ReadonlySet<string> = new Set();

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
	header.createSpan({ cls: 'pbl-shelf-group-count', text: formatNumber(group.cards.length) });
	if (folded) return [];
	const cardsEl = groupEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const entry of group.cards) renderShelfCard(ctx, cardsEl, entry, wiring);
	return group.cards.map((entry) => entry.item);
}

/** One shelved card: its body, its shelving reason, what it waits for, and its drag source. */
function renderShelfCard(ctx: RowContext, cardsEl: HTMLElement, entry: ShelfCard, wiring: ShelfWiring): void {
	const card = createCard(ctx, cardsEl, entry.item);
	// **A compact row needs its summary in a box of its own, and only a compact row does.**
	// The row is one flex LINE, and `.pbl-card-kids` is a direct child of the card — so a
	// shelved parent with children drew its disclosure and its expanded list BESIDE the
	// title, at the far end of the line, with the whole summary then centred against it
	// (measured in the harness: 35px against 28px with the list still shut, and taller with
	// it open). It cannot be solved on the line itself: letting the card wrap so the list
	// falls beneath it also lets the property cells wrap, which is a 28px row becoming 59px
	// the moment a Base exposes a few — both measured, and that is why this is a wrapper
	// rather than a `flex-wrap`. Found by review (Codex, PR #183).
	//
	// The card grid creates no wrapper at all (`summary` IS the card), so nothing about it
	// changes; `kidsEl` is passed either way and resolves to the same element there.
	const summary = wiring.list ? card.createDiv({ cls: 'pbl-card-summary' }) : card;
	// The fold slot leads the line and is reserved whether or not this item has children, so
	// every badge after it starts at one x — the tree's own arrangement. Created here rather
	// than by `renderCardChildren`, which returns early for a leaf and would leave the row
	// without one.
	const fold = wiring.list ? summary.createDiv({ cls: 'pbl-shelf-fold' }) : null;
	// **One always-drawn box for the three things that are otherwise absent on some rows.**
	// The rollup, the shelving reason and the dependency note are each present or not per
	// item, and each one that is missing takes its width off the row and moves every fixed
	// column after it. Reserved once, filled by whichever apply, and empty on a row with none
	// — which is the same trade `holdEmpty` makes for the cells one line down. Only in list
	// mode: the card grid stacks its children and has no such trailing geometry to fix.
	const notes = wiring.list ? summary.createDiv({ cls: 'pbl-shelf-notes' }) : null;
	// **`rollupEl` stays.** Task 4 added it so the rollup lands in the fixed notes reservation;
	// dropped here, `renderRollup` appends to the summary instead and every row with a rollup
	// gets its own trailing width back — the exact variation Task 4 exists to remove, undone by
	// the task after it. (Codex, PR #187.)
	renderCardBody(ctx, summary, entry.item, {
		kidsEl: card,
		holdEmpty: wiring.list,
		rollupEl: notes ?? undefined,
		toggleEl: fold ?? undefined,
		columns: wiring.columns,
	});
	ctx.placed.add(entry.item.file.path);
	renderShelfNotes(summary, notes, entry, wiring);
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
	if (wiring.list) renderShelfState(ctx, summary, entry.item, wiring.list);
	wireCardActivation(ctx, card, entry.item);
	// A gesture whose only possible batch is empty must not begin: `removal.canDrag`
	// is `canSchedule` on the dated axis, the same gate the row's own Schedule entry
	// uses (`interactions/plan.ts`) — a marker with no writable end offers no grip at
	// all. A shelf card is always wired with `hold: null`, which is exactly what each
	// axis's `removal.accepts` refuses on its own strip.
	if (wiring.removal.canDrag(entry.item)) wiring.dnd.wireCard(card, entry.item);
}

/**
 * The always-drawn notes lane's own content: the shelving reason, the dependency note and
 * the parent breadcrumb — carved out of `renderShelfCard` at the complexity budget, and a
 * natural seam rather than an arbitrary split: these three are exactly the things the lane
 * exists to hold (see `renderShelfCard`'s own comment on `notes`), so one function draws
 * all three and moves nothing else.
 */
function renderShelfNotes(summary: HTMLElement, notes: HTMLElement | null, entry: ShelfCard, wiring: ShelfWiring): void {
	// Unreadable is unplaced, and the card says why rather than rendering
	// somewhere a guess put it.
	if (entry.reason !== null) {
		const reason = (notes ?? summary).createDiv({ cls: 'pbl-shelf-reason' });
		drawIcon(reason.createSpan({ cls: 'pbl-shelf-reason-icon' }), 'alert-triangle');
		reason.createSpan({ text: entry.reason });
		// The sentence is hidden on a compact row and the icon is all that is left, so this is
		// the only place a pointer reader can still get it. `entry.reason` is already a
		// translated sentence from `deriveBars`; nothing is composed here.
		setTooltip(reason, entry.reason);
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
		const dep = (notes ?? summary).createDiv({
			cls: 'pbl-shelf-dependency' + (conflicting.size > 0 ? ' pbl-shelf-conflict' : ''),
		});
		drawIcon(dep.createSpan({ cls: 'pbl-shelf-dependency-icon' }), conflicting.size > 0 ? 'alert-triangle' : 'link');
		dep.createSpan({ text: waits });
		// Same reason as the shelving reason above: the sentence is visually hidden on a
		// compact row and the tooltip is what carries it to a pointer reader.
		setTooltip(dep, waits);
	}
	// To the END of the line, now that the body has filled it. The lane had to exist before the
	// body ran, which put it between the fold slot and the badge; `appendChild` on an existing
	// child MOVES it, so the document ends up in the order the row is read in. A CSS `order`
	// would have left the two disagreeing — invisible to a pointer, and a screen reader in
	// browse mode announcing a card's shelving reason before its title. (Codex, PR #187.)
	if (notes) summary.appendChild(notes);
	// The parent breadcrumb joins them, and for the alignment rule rather than for tidiness: it
	// is drawn only for an item that HAS a parent and its width is its own text, so left on the
	// line it is a top-level item that differs from row to row twice over. In the lane it is
	// metadata beside the two notes, still just after the title, ellipsising inside a width that
	// no longer depends on it. (Codex, PR #187.)
	const parent = notes && summary.querySelector<HTMLElement>(':scope > .pbl-card-parent');
	if (notes && parent) notes.appendChild(parent);
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
 * item's workflow writes, leaving the other empty.
 *
 * **`dropEmpty` is amended for extension 4b, and that split from 4a is the register's own
 * correction (review, Task 4) rather than something this file invented.** 4b's per-row case
 * — a row's own workflow writes a different key than the one drawn — used to read as 4a's
 * "no chip, and no gap where one would have been", written for a CARD, where cells are
 * content-sized and a blank one is a gap with nothing to reserve. In a ROW the state is a
 * shared column exactly like the ones in `.pbl-props`: dropping it on the rows whose
 * workflow does not write that property would move every row's cells relative to every
 * other's — the very shift `holdEmpty` exists to stop one line up. So `list` holds it open
 * here too. 4a's own case — a Base drawing no state column at ALL — is unchanged: no box at
 * all, decided above before any of this runs.
 */
function renderShelfState(ctx: RowContext, card: HTMLElement, item: BacklogItem, list: boolean): void {
	const stateColumns = ctx.columns.filter((column) => column.kind === 'state');
	if (stateColumns.length === 0) return;
	const stateEl = card.createDiv({ cls: 'pbl-shelf-state' });
	renderPropCells(ctx, stateEl, item, stateColumns, { dropEmpty: !list });
}
