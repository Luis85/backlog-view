import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { createCard, wireCardActivation, wireItemMenu, wireOpenGestures } from './board';
import { renderBarProgress } from './barProgress';
import { RowContext } from './columns';
import { drawIcon } from './icons';
import { renderBadge, renderChevron } from './rows';
import { promptAddAbsence, showAbsenceMenu } from '../interactions/absences';
import { CardDragController } from '../interactions/cardDrag';
import { wireBarLink } from '../interactions/linkDrag';
import { BacklogViewHost, DrawnColors } from '../host';
import { Absence, absencesConfigured, absenceTitle, awayWeeks, crossedAbsences, daysLost, packLanes } from '../../domain/absences';
import { BarHold, barHolds, timelineRows, TimelineBar, TimelineRow } from '../../domain/bars';
import { displayType, isIterationType, isMarkerType } from '../../domain/itemTypes';
import { BacklogItem } from '../../domain/model';
import { CivilDate } from '../../domain/noteFields';
import { markerLane, markerLaneCaption, ResourceLane } from '../../domain/roadmap';
import { ownWorkflowReading, stateKeyFor, WorkflowReading } from '../../domain/board';
import { sanitizeTitle } from '../../storage/createNote';
import {
	BarGeometry,
	barGeometry,
	DateSpan,
	daysBetween,
	formatCivil,
	mergeSpans,
	MIN_BAR_PX,
	TimelineScale,
	TimelineWindow,
} from '../../domain/timeline';

/**
 * WHAT the grid draws and in what order — `TimelineEntry` and the two axes' entry lists —
 * plus how the resources axis's own two additions are drawn: a header per resource, and
 * the bar-less row an excluded note gets inside one.
 *
 * Both halves live here rather than in `./timeline.ts`, for two reasons that point the
 * same way. The import has to run one direction only: the grid draws these rows, so the
 * grid imports this module, and the entry vocabulary it takes as a parameter cannot then
 * be declared over there. And `timeline.ts` is at its 400-line budget — an entry list the
 * resources axis made necessary belongs beside the rows that made it necessary.
 *
 * Everything else about the grid is the dated axis's and is untouched: the window, the day
 * header, the gridlines, the today line, the milestone lines, the dependency layer and the
 * drop overlay are all derived from the bars in the list handed over, which is what makes
 * rows cost no second grid.
 */

/**
 * One thing the grid draws, in draw order. The dated axis produces nothing but `row`
 * entries; the resources axis interleaves a `lane` header before each row's group, and a
 * `context` entry for a note the Base excluded that the row places but cannot position.
 *
 * An ENTRY list rather than a row list, because lanes then cost no second grid: the
 * window, the day header, the gridlines, the today line, the drop overlay and the
 * dependency layer are all derived from the bars in this list and are the same for both
 * axes. A second renderer over the same geometry is what would drift.
 */
export type TimelineEntry =
	| { kind: 'lane'; lane: ResourceLane; collapsed: boolean }
	| { kind: 'row'; row: TimelineRow }
	| { kind: 'context'; item: BacklogItem };

/**
 * What a mark says about the WINDOW it is drawn in — clipped at one end, running past it
 * entirely, and which side. One statement for every mark this grid positions, because
 * `barGeometry` CLAMPS a span that reaches past the window: reading `startDay` and
 * `spanDays` without asking whether the clamp happened paints the mark on days it does not
 * cover, and a filled block on a calendar is the claim that THESE are the days whether it
 * is a bar or an absence.
 *
 * Here rather than in `./timeline.ts` beside `barClasses`, which is its other caller, only
 * because the imports run one way: the grid draws these rows. What `barClasses` adds on top
 * is everything about a BAR — its milestone shape, its provenance, whether it can be
 * grabbed, and an open end that is a date the note never stated rather than one this window
 * cannot reach. An absence has none of those: both its ends are stated by construction.
 *
 * It was written twice for a day (2026-08-14) and that is exactly the duplication to keep
 * out of here — the mapping from three geometry flags to three class names is one rule, and
 * a second copy is what drifts the next time a mark learns a fourth edge state.
 */
/**
 * What `drawMarkerDiamonds` needs of the grid it draws into — the four fields of
 * `BarRowMounts` a diamond actually uses, named structurally rather than imported, so this
 * module stays reachable from `./timeline.ts` and never back.
 */
export interface MarkerMounts {
	tracks: Map<string, HTMLElement>;
	/** Where a dependency arrow anchors, per path — see `BarRowMounts.anchors`. */
	anchors: Map<string, HTMLElement>;
	scroller: HTMLElement;
	/** The scrolling box the link gesture draws its preview line into. */
	content: HTMLElement;
	dnd: CardDragController;
}

function edgeClasses(geometry: BarGeometry): string[] {
	if (geometry.outside) return ['pbl-bar-outside', geometry.clippedStart ? 'pbl-bar-open-start' : 'pbl-bar-open-end'];
	const classes: string[] = [];
	if (geometry.clippedStart) classes.push('pbl-bar-open-start');
	if (geometry.clippedEnd) classes.push('pbl-bar-open-end', 'pbl-bar-clipped-end');
	return classes;
}

/**
 * The dated axis's own entries: the milestones' row first, then every work row in order.
 *
 * **A marker is drawn in one shared row here too, exactly as it is on the resources axis**
 * ([[Milestones out of the resource rows]]) — one `lane` entry holding every marker on the
 * grid, never a `row` entry apiece. A point in time has no duration to read along and no
 * subtree to fold, so a column of one-diamond rows spent a row each saying what one row says,
 * pushing the work down the pane the more dates the plan commits to. What a reader needs of a
 * milestone is where it falls against the bars beneath it, and the diamond plus the
 * full-height line ([[A milestone line across the plan]]) is that whole answer.
 *
 * The row is minted by its first PLACED marker and is absent otherwise — a header standing
 * for nothing on every base says nothing — and it is never folded, because it produces no
 * rows to fold.
 *
 * The split happens BEFORE `timelineRows` rather than after it, and that is the load-bearing
 * part: the fold walk decides a chevron from the bars it is HANDED, so a marker left in the
 * list would go on standing between a work bar and its drawn ancestor. Handed the work alone,
 * a chevron reaches exactly the bars it sits above — the same argument that makes a fold safe
 * per band one axis over.
 */
export function datedEntries(bars: TimelineBar[], collapsed: (path: string) => boolean): TimelineEntry[] {
	const markers = bars.filter((bar) => isMarkerType(bar.item.typeName));
	const work = bars.filter((bar) => !isMarkerType(bar.item.typeName));
	const entries: TimelineEntry[] =
		markers.length > 0 ? [{ kind: 'lane', lane: markerLane(markers), collapsed: false }] : [];
	for (const row of timelineRows(work, collapsed)) entries.push({ kind: 'row', row });
	return entries;
}

/**
 * Every span this grid will DRAW — which is not the same list as its bars, and the
 * difference is a shipped bug. The window used to be the bars alone, so an absence stretch
 * beyond their reach was clamped to the edge and painted on a day it does not cover; worst
 * in a row an absence MINTED, which holds no bar at all, so nothing the row exists to draw
 * had any say in the window it is drawn against. See
 * `docs/bugs/An absence drew at the edge of a window it never widened.md`.
 *
 * The stretches come from the LANES rather than from the entries, since 2026-08-14: they
 * are no longer entries at all, they are drawn in each header's own track. The hazard is
 * unchanged and so is the fix — a source that stops reaching this list is a window that
 * stops holding what it draws. The dated axis passes no lanes.
 *
 * A folded BAND's own bars carry the identical hazard since the load rail
 * (`renderLaneRail`, 2026-08-14): `laneEntries` drops a collapsed lane's bar rows from
 * `entries` entirely, so a band folded over work whose only span is far away would narrow
 * the window out from under the very rail meant to show where that work lies. Read from
 * `entries` rather than from `lanes` directly, and gated on the lane entry's own
 * `collapsed` — an OPEN band's bars already arrive through their own `'row'` entries, and
 * widening for them a second time from `lanes` is how a row-collapsed SUBTREE inside an
 * open band (its bar correctly missing from `entries`, `timelineRows`' own fold) would
 * still have widened the window for a mark that draws nowhere. Absences stay read from
 * `lanes` directly beside this, because a stretch draws in its header's track whether the
 * band is open or shut — `lanes` earns its keep for that reason alone now.
 */
export function drawnSpans(entries: TimelineEntry[], lanes: ResourceLane[]): DateSpan[] {
	const bars = entries.flatMap((entry) => (entry.kind === 'row' ? [entry.row.bar.span] : []));
	// A folded band's bars, and the milestones' row's — the same hazard reached two ways.
	// Neither draws a `'row'` entry, and both draw a mark in the header's own track, so a
	// window read from the entries alone would be narrowed out from under the very marks it
	// is meant to hold. The markers row is not gated on `collapsed`: it never has row
	// entries, open or shut.
	const laneBars = entries.flatMap((entry) =>
		entry.kind === 'lane' && (entry.collapsed || entry.lane.markers) ? entry.lane.bars.map((bar) => bar.span) : [],
	);
	const stretches = lanes.flatMap((lane) =>
		lane.absences.map((absence) => ({ start: absence.start, target: absence.target })),
	);
	return [...bars, ...laneBars, ...stretches];
}

/**
 * Every item this grid gives a selectable row to, in DRAW order — the reading order the
 * pane's roving keyboard walk uses, so a kind is inserted where it draws and never
 * appended at the end.
 *
 * Beside `drawnSpans` and for its reason: the entry vocabulary is this module's, so a
 * kind added to `TimelineEntry` that puts a note on screen is answered by editing the one
 * function beside the type. It used to be `bars.map(...)` in `renderTimeline`, which is
 * how a lane's context row came to draw a `role="option"` nothing could ever select —
 * see [[A lane context row could not be reached]].
 */
export function drawnCards(entries: TimelineEntry[]): BacklogItem[] {
	return entries.flatMap((entry) => {
		if (entry.kind === 'row') return [entry.row.bar.item];
		return entry.kind === 'context' ? [entry.item] : [];
	});
}

/**
 * The resources axis's entries: each row's header, then its bars, then any note the Base
 * excluded that the row places but cannot position — last, because such a note has no
 * position for anything to interleave it by.
 *
 * **A band folds two ways and they are different questions.** `collapsed` shuts the whole
 * band — everything under one resource, absences included — and is asked of the resource's
 * NAME. Inside an open band, `timelineRows` folds a bar's own subtree exactly as it does on
 * the plain dated axis.
 *
 * That second one is asked PER LANE, and the scoping is the whole of why it is safe here.
 * Membership is the note's own assignee, so a parent and its child routinely sit in
 * different bands — and this file used to say a fold was therefore impossible, because one
 * person's chevron would hide another person's bar. It is `timelineRows`' own `drawn` set
 * that answers it: handed one lane's bars, `barAncestors` can only find an ancestor drawn
 * in THAT band, so a chevron reaches exactly the rows beneath it in its own row and
 * nothing else. A parent in Chris's band with a child in Alex's draws no disclosure at all
 * — correctly, since it is holding nothing back from where it sits.
 */
export function laneEntries(lanes: ResourceLane[], folded: LaneFolds): TimelineEntry[] {
	const entries: TimelineEntry[] = [];
	for (const lane of lanes) {
		// The markers row is never folded, and asking that HERE is what makes it true of
		// everything downstream — the head's class, its rails, and the entries below. Its
		// caption is a name a roster may legitimately hold (extension 1a of
		// [[Milestones out of the resource rows]] accepts the two rows), and a band's fold is
		// keyed by name, so `folded.lane` answers for a resource called `Milestones` and the
		// diamonds' row alike. It has no disclosure to undo that with.
		const collapsed = !lane.markers && folded.lane(lane.name);
		entries.push({ kind: 'lane', lane, collapsed });
		// **The milestones' row is the header and nothing else.** Every marker draws as a
		// diamond in that one header's own track (`drawMarkerDiamonds` in `./timeline.ts`),
		// so the row never produces bar rows to fold, which is why it draws no disclosure
		// either — there is nothing under it to disclose. A date is a point and a column of
		// one-diamond rows was a row per point saying what one row says.
		if (collapsed || lane.markers) continue;
		// Header, then rows, then context — the stretches are the header's own furniture
		// now (`renderLaneAbsences`), drawn in its track whether the band is open or shut,
		// so there is no entry for them here at all.
		for (const row of timelineRows(lane.bars, folded.row)) entries.push({ kind: 'row', row });
		for (const item of lane.context) entries.push({ kind: 'context', item });
	}
	return entries;
}

/**
 * The two fold questions a band asks, taken together so a caller cannot supply one and
 * forget the other. Predicates rather than sets, for `timelineRows`' own reason: the view
 * owns both bits and this module stays pure.
 */
export interface LaneFolds {
	/** Is this resource's whole band shut? Asked of the NAME — a lane is not a note. */
	lane: (name: string) => boolean;
	/** Is this bar's subtree shut? Asked of the path, the dated axis's own bit. */
	row: (path: string) => boolean;
}

/**
 * One resource's header row. The lead is `.pbl-timeline-lead` like every row's, so it
 * sticks and sizes off the one `--pbl-tl-lead` the grid publishes, and the empty track
 * carries the header's band across the day area.
 *
 * The count is RESULT bars, exactly as a bucket's count is: a context row placed here is
 * placement, not population.
 *
 * **The accessibility cost, stated rather than smoothed over.** This is a div among
 * `option` rows inside a pane that is a `listbox` while cards render, and it labels the
 * rows below it by nothing but proximity — a header cannot be their container, because
 * every row is positioned against one shared day grid. So the resource's name goes onto
 * each of its rows as well (`renderLaneRowDescription`) and this header claims no role of
 * its own. Same accepted deviation as the lead-resize grip's; how a screen reader
 * actually reads it is a live-vault check this harness cannot make.
 *
 * Returns the element, so the caller can wire it: this module draws a row's header and
 * has no opinion about what dropping on one should write. Not being a container is what
 * makes that the caller's problem per ELEMENT rather than once per band.
 *
 * Four parameters rather than six, and the grouping is not cosmetic: this was at the
 * `max-params` limit of five when it took `today`, and the header now needs the window and
 * the scale to place the stretches it draws. Both groupings already exist as shapes — `entry`
 * is the `TimelineEntry` `'lane'` member without its tag, and `ruler` is what
 * `renderAbsenceWash` already takes plus the day the readout asks about — so nothing new was
 * invented to fit under the cap.
 */
export function renderLaneHead(
	ctx: RowContext,
	content: HTMLElement,
	entry: { lane: ResourceLane; collapsed: boolean },
	ruler: { window: TimelineWindow; scale: TimelineScale; today: CivilDate },
): { head: HTMLElement; track: HTMLElement } {
	const { lane, collapsed } = entry;
	const quiet = lane.bars.length === 0 && lane.absences.length === 0 && lane.context.length === 0;
	const head = content.createDiv({
		cls:
			'pbl-lane-head' +
			(lane.markers ? ' pbl-lane-markers' : '') +
			(lane.declared ? '' : ' pbl-lane-undeclared') +
			(collapsed ? ' pbl-lane-collapsed' : '') +
			(quiet ? ' pbl-lane-quiet' : ''),
	});
	const lead = head.createDiv({ cls: 'pbl-timeline-lead' });
	// No disclosure on the milestones' row. `laneEntries` gives it no rows to fold, so a
	// chevron there would be a control with nothing under it — and a fold bit able to take
	// the dates the whole plan is measured against off screen is the very thing this row
	// exists to prevent.
	if (!lane.markers) renderLaneChevron(ctx.host, lead, lane, collapsed);
	// The milestones' row captions itself by what it holds (`markerLaneCaption`) — never
	// `lane.name`, which stays the constant identity every other reader (the fold key, the
	// roster refusal) has to keep matching. Every other row is still named by itself.
	lead.createSpan({ cls: 'pbl-lane-name', text: lane.markers ? markerLaneCaption(lane.bars) : lane.name });
	if (lane.bars.length > 0) {
		lead.createSpan({ cls: 'pbl-lane-count', text: t('count.items', { count: lane.bars.length }) });
	}
	renderAwayPill(lead, lane, ruler.today);
	if (!lane.declared) {
		const mark = lead.createSpan({ cls: 'pbl-lane-stray' });
		drawIcon(mark, 'circle-help');
		setTooltip(
			head,
			`"${lane.name}" is not one of the declared resources. Add it to "Resources (in order)" in the view options, or re-assign its items.`,
		);
	}
	renderLaneAbsenceAdd(ctx, lead, lane);
	const track = renderLaneAbsences(ctx, head, lane, ruler);
	if (collapsed) renderLaneRail(track, lane, ruler);
	// The track is handed back rather than found again: the milestones' row draws into this
	// very element (`drawMarkerDiamonds`), and a caller that had to query for it would carry
	// a null branch nothing can reach.
	return { head, track };
}

/**
 * How long this resource is still away, as a pill beside their item count — counted FROM
 * TODAY, so a stretch already running contributes only the days left of it and a four-week
 * absence with two days to go reads `1 wk away`. `awayWeeks` is where that clamp lives.
 *
 * **Weeks rather than a count of stretches**, which is what this reported until 2026-08-14:
 * two stretches is not a quantity a planner can act on, and three weeks is. `awayWeeks`
 * unions them, so a resource with two overlapping stretches is not away twice.
 *
 * Dropped entirely at zero, like the item count beside it. A roster row for someone with
 * nothing to say draws nothing rather than a column of zeroes — which is the whole of what
 * "one row per person" buys once the stretches move into the header.
 *
 * Weighted up when the resource ALSO holds work, because that row is the one a planner has
 * to do something about: away with nothing booked is information, away with four items
 * booked is a problem.
 */
function renderAwayPill(lead: HTMLElement, lane: ResourceLane, today: CivilDate): void {
	const weeks = awayWeeks(lane.absences, today);
	if (weeks === 0) return;
	const busy = lane.bars.length > 0 ? ' pbl-lane-away-busy' : '';
	lead.createSpan({ cls: `pbl-lane-away${busy}`, text: `${weeks} wk away` });
}

/**
 * The band's own disclosure — `renderChevron`, the same control every other fold in this
 * plugin draws, rather than a second one written beside it.
 *
 * What that function needed to serve a band is what a band does not have: a note. Its
 * three per-caller answers are now all parameters — which BIT to flip, what to REDRAW, and
 * whether the row's own role already announces the state — so this passes a toggle over a
 * NAME and inherits the four guards it would otherwise have had to remember: the filter
 * override, the real `disabled` flag on a control assistive tech can activate, the middle
 * click that never fires `click`, and the focus report. That last one is not academic
 * here: folding a band re-renders the whole projection, so the button pressed is gone and
 * a keyboard reader would be dropped on the document without it.
 *
 * `label` is passed, which makes it a BUTTON — the header claims no role of its own, so
 * there is nothing else for `aria-expanded` to sit on.
 *
 * `hasChildren` is true on every band including an empty one. A declared resource with
 * nothing assigned is exactly the row a roster exists to put on screen, and a disclosure
 * that appeared only once work arrived would be a control moving under the reader — the
 * leaf placeholder a childless tree row draws is the same decision made the other way, and
 * it is the wrong one here because folding an empty band is still how a long roster is got
 * out of the way.
 */
function renderLaneChevron(host: BacklogViewHost, lead: HTMLElement, lane: ResourceLane, collapsed: boolean): void {
	const state = {
		hasChildren: true,
		collapsed,
		label: `${collapsed ? 'Show' : 'Hide'} ${lane.markers ? lane.name.toLowerCase() : `${lane.name}'s work`}`,
		toggle: () => host.setLaneCollapsed(lane.name, !collapsed),
	};
	// The whole projection redraws — the window, the gridlines and every full-height mark
	// come off the row set this changed — so focus goes to the PANE rather than to the
	// replacement control, `render/shelfControls.ts`' rule: the pane's key handler ignores
	// any event whose target is not the pane itself, so focusing a `tabindex="-1"` control
	// inside the composite would look right and silently kill the arrow keys.
	renderChevron(host, lead, state, (heldFocus) => {
		if (heldFocus) host.roadmap?.scroller?.closest<HTMLElement>('.pbl-tree')?.focus();
	});
}

/**
 * Mark this resource unavailable for a stretch. Gated on `absencesConfigured` rather than
 * on the axis being drawn — sharper than the axis's own precondition, which accepts either
 * date property alone — so the control is absent rather than opening a form whose range
 * could never be written.
 *
 * `tabindex="-1"` like the row's New button, and with the same gap behind it: the pane is
 * one tab stop and a row is not a keyboard stop, so there is no keyboard route to this
 * control, nor to the delete on the stretch it creates. Closing that properly means row
 * stops, which is `docs/requirements/Keyboard and menu on the roadmap.md`'s work — the
 * identical statement the New button beside it already carries, not a new one.
 */
function renderLaneAbsenceAdd(ctx: RowContext, lead: HTMLElement, lane: ResourceLane): void {
	// The milestones' row is not a person and has nobody to be away — the same reason it
	// takes no assignee write when something is dropped on it.
	if (lane.markers || !absencesConfigured(ctx.host.settings)) return;
	const host = ctx.host;
	const btn = lead.createEl('button', {
		cls: 'clickable-icon pbl-lane-ctl pbl-lane-absence-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': `Add absence for ${lane.name}` },
	});
	drawIcon(btn, 'user-x');
	setTooltip(btn, `Add absence for "${lane.name}"`);
	btn.addEventListener('click', () => promptAddAbsence(host, lane));
}

/**
 * A note the Base excluded, drawn in the row that places it. It renders, it says whose
 * row it is in, and that is all: no bar, own dates or inferred, because the dated axis
 * this one derives from never draws a context row's dates either — `deriveBars` routes
 * one to the context collection before `placeItem` is asked about it. So there is no
 * "what if it has no date" case to answer separately here.
 *
 * It IS a card in every other respect, which is what `wireCardActivation` states: the row
 * carries `role="option"` from `createCard`, so a click opens it, Enter opens it, and the
 * row menu — the keyboard path behind every `tabindex="-1"` control this row now carries,
 * its match links included — opens on it. That was missing until 2026-08-15; see
 * [[A lane context row could not be reached]].
 *
 * It REGISTERS in `ctx.placed` like every other surface, which is a claim about being on
 * screen and not about what it can show: `cardedPaths` reads that register and
 * `menuChildren` subtracts it, so a row drawn and not registered would have its parent's
 * menu offer `Open child "…"` for the row the reader is looking at. It draws no disclosure
 * of its own, so it joins no `cardKids` and hosts no children section itself.
 */
export function renderLaneContextRow(ctx: RowContext, content: HTMLElement, item: BacklogItem): HTMLElement {
	const row = createCard(ctx, content, item);
	row.addClass('pbl-timeline-row');
	row.addClass('pbl-lane-context');
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderBadge(ctx.host, lead, item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	title.setText(item.title);
	setTooltip(lead, item.title);
	renderBarProgress(ctx.host, { row, bar: null, lead }, item);
	row.createDiv({ cls: 'pbl-timeline-track' });
	ctx.placed.add(item.file.path);
	wireCardActivation(ctx, row, item);
	return row;
}

/**
 * What one stretch is CALLED, with its range stated once — the string behind every place a
 * stretch is named: the header's one `aria-description`, the mark's own tooltip, and the
 * sentence a crossed bar carries. Between them that is the whole of what a reader who cannot
 * see the hatch gets, so a defect here is invisible and total.
 *
 * `Absence.title` is the note's BASENAME, and since 2026-08-14 the create and the edit paths
 * both derive that basename from the very facts this would otherwise append (`absenceTitle`,
 * the one producer — [[Resource absences]] 4l). Appending unconditionally therefore read
 * `Alice away 2026-08-04 → 2026-08-06 2026-08-04 → 2026-08-06`, with no separator, on every
 * note this plugin has ever made.
 *
 * The condition is asked of that PRODUCER rather than of the string's shape: a title equal to
 * what `absenceTitle` derives from this stretch's own three facts already carries the range.
 * Anything else — a note named before 4l, or one a reader named `Offsite` by hand — does not,
 * and still needs it, which is why this is a condition and not a deletion: the title is the
 * only legible name a stretch has left.
 *
 * **A PREFIX rather than an equality, because the plugin files its own collisions under a
 * suffix.** Two absences for one resource over the same days derive the same name, so
 * `uniqueNotePath` appends a number and the second is `… 2026-08-06 1`. Under an equality
 * that note failed the test and got the range a second time — the defect above, surviving in
 * exactly the case the derivation cannot avoid. `startsWith` is not the suffix parsed back
 * off: it asks whether the derived name is where this basename BEGINS, which is the same
 * question for `… 1` as for a reader's own `… offsite`, and both of those already carry the
 * range. Raised independently by two reviewers before it was fixed.
 *
 * **Both sides are SANITIZED, because a basename has already been through `sanitizeTitle`
 * and the derivation has not.** A resource holding `/` is filed as `A-B away …` where
 * `absenceTitle` says `A/B away …`, so the raw comparison failed on a note the plugin wrote
 * itself and appended the range to a name that already carried it — the same defect as the
 * collision suffix, reached through the other escape, and raised by a reviewer once the
 * first was fixed. Sanitizing the derived side asks about the name the note ACTUALLY has,
 * which closes the gap rather than narrowing it: the basename IS `sanitizeTitle` of the
 * derivation (plus a suffix), the facts have not changed, so the two agree wherever the
 * note was written from these facts — through a character swap, a collapsed run of spaces
 * or a trimmed leading dot alike.
 *
 * Reaching into `storage/` for it is legal and not a shortcut: the layering is
 * view → storage → domain, and `eslint.config.mjs` forbids this layer only `commands/`.
 * `domain/` genuinely may not, which is why the question is asked here rather than beside
 * `absenceTitle` — the sanitizer is what a title becomes ON DISK, and only the two layers
 * that can see a disk may ask.
 */
function absenceSaid(absence: Absence): string {
	const start = formatCivil(absence.start);
	const target = formatCivil(absence.target);
	if (absence.title.startsWith(sanitizeTitle(absenceTitle({ resource: absence.resource, start, target }))))
		return absence.title;
	return `${absence.title} — ${start} → ${target}`;
}

/**
 * Where a positioned mark's day span goes, in pixels — `--pbl-bar-left` and
 * `--pbl-bar-width`, the latter floored at `MIN_BAR_PX` so a span too short to reach it
 * does not vanish. One pair of custom properties, extracted because THREE identical
 * copies of the same two `setCssProps` lines already sat in this file — an absence's own
 * mark, a folded band's load rail, and the wash a bar carries under it — on the review
 * instruction that three is where this codebase consolidates rather than copies again
 * (`applyLabels` replacing `applyRisk` is the same call made once already). The days-lost
 * sentence beside a bar briefly used this too, positioned as a sibling of the bar; it now
 * lands inside the bar's own title label instead (`drawBandCollision`, below), which needs
 * no position of its own. The fourth caller is the milestones' row (`drawMarkerDiamonds`),
 * which is what a fourth copy would have been: the same two lines under a different name.
 */
function placeSpan(el: HTMLElement, geometry: BarGeometry, scale: TimelineScale): void {
	const { left, right } = spanBox(geometry, scale);
	el.setCssProps({ '--pbl-bar-left': `${left}px`, '--pbl-bar-width': `${right - left}px` });
}

/**
 * The same box in numbers, for the one caller that has to REASON about where a mark lands
 * rather than only put it there — `packLanes`, which separates the marks that would overlap.
 *
 * Extracted rather than recomputed beside the pack, and that is the point of it: a pack fed
 * its own idea of the arithmetic is a second geometry to keep in step with this one, which is
 * exactly what [[Resource absences]] 4a refused. Reading the box off the function that writes
 * it means the two cannot disagree about which pixels a mark covers.
 */
function spanBox(geometry: BarGeometry, scale: TimelineScale): { left: number; right: number } {
	const left = geometry.startDay * scale.dayPx;
	return { left, right: left + Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX) };
}

/**
 * One resource's unavailable stretches, drawn in that resource's own header track — which
 * is what makes a band one row per person whatever they have.
 *
 * Positioned by `barGeometry` against the same window a bar is, so a stretch and the work it
 * crosses cannot disagree about which day is which, and packed by `packLanes` so two that
 * would overlap get two sub-lanes instead of two rows. The sub-lane count goes onto the
 * HEADER as `--pbl-lane-sublanes` and the stylesheet does the arithmetic: one number crossing
 * the boundary rather than a height computed here.
 *
 * **What is packed is the BOX each mark draws as, never its dates**, and the difference is
 * what two review findings were: a mark clamped to the window's edge, and a one-day mark
 * floored at `MIN_BAR_PX`, both cover pixels their days do not. `spanBox` is the one place
 * either is computed, so the pack and the draw read the same numbers.
 *
 * **The count is not the mechanism — `--pbl-sublane` per MARK is.** The header's count only
 * grows the track; the index each mark carries is what puts it on its own line, so 4a's
 * "two stretches that share a day are two marks on two lines" rests on that one
 * `setCssProps` below. Two checks stand under it, because a header with two marks and a
 * count of `2` stays true with the index wiring deleted and the marks stacked on one line:
 * `test/view/resourceAbsences.test.ts` asserts each packed mark's own index, and
 * `test/view/timelineBoxing.test.ts` ties the 17px pitch `.pbl-absence` steps by to the one
 * the header's own track grows by, since a pitch changed in one rule alone overlaps the
 * marks. That same file refuses `.pbl-absence` a `pointer-events: none`, which is the
 * paragraph below stated where it can actually be seen — jsdom dispatches events whatever
 * the stylesheet says, so no drop or menu test can catch that declaration.
 *
 * **Each mark keeps its pointer events, and that is deliberate in both directions.** It needs
 * them for the context menu, which is now the ONLY route to Edit and Delete — the row that
 * used to carry them is gone. And the band's drop still works because a mark is a CHILD of
 * the header, an element `TimelineDrawing.laneElement` registers, so `dragover` and `drop`
 * bubble to it. That is exactly what
 * `docs/bugs/An absence stretch is a dead spot in its own band.md` was: a stretch that drew
 * into a band as a SIBLING without joining it. A `pointer-events: none` here would kill the
 * menu; a `stopPropagation` would recreate the dead spot.
 *
 * The stretches' names and dates go on the header as one `aria-description`, because none of
 * them has a row to be named by any more. That is a REGRESSION and not a substitution —
 * three stretches become one string a reader cannot move within — accepted as the cost of
 * one row per person and recorded as such in `docs/requirements/Resource absences.md`.
 */
function renderLaneAbsences(
	ctx: RowContext,
	head: HTMLElement,
	lane: ResourceLane,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): HTMLElement {
	// Annotated rather than left as `ctx.host`, the fallow gotcha in the root `CLAUDE.md`:
	// an interface member reached only through a property access reports as an unused class
	// member even though it is called.
	const host: BacklogViewHost = ctx.host;
	const track = head.createDiv({ cls: 'pbl-timeline-track' });
	if (lane.absences.length === 0) return track;
	// Left to right, which is what `packLanes` wants to pack tightly and what a reader hears
	// the description in — the same list answers both, so the order the marks draw in and the
	// order they are named in cannot come apart.
	const marks = lane.absences
		.map((absence) => {
			const geometry = barGeometry(ruler.window, { start: absence.start, target: absence.target });
			return { absence, geometry, box: spanBox(geometry, ruler.scale) };
		})
		.sort((a, b) => a.box.left - b.box.left);
	const sublanes = packLanes(marks.map((mark) => mark.box));
	head.setAttribute('aria-description', `Unavailable: ${marks.map((mark) => absenceSaid(mark.absence)).join('; ')}`);
	for (const [index, { absence, geometry }] of marks.entries()) {
		const mark = track.createDiv({ cls: ['pbl-absence', ...edgeClasses(geometry)].join(' ') });
		placeSpan(mark, geometry, ruler.scale);
		mark.setCssProps({ '--pbl-sublane': String(sublanes[index]) });
		setTooltip(mark, absenceSaid(absence));
		mark.addEventListener('contextmenu', (evt) => showAbsenceMenu(host, absence, evt));
	}
	head.setCssProps({ '--pbl-lane-sublanes': String(Math.max(...sublanes) + 1) });
	return track;
}

/**
 * Where a folded band's work LIES, as one thin strip per continuous run of days.
 *
 * Only while the band is folded: an open one draws its own bars, and a rail beneath them
 * would restate what the reader is already looking at. It is decoration and nothing else —
 * `aria-hidden`, no pointer events, no tooltip — because everything it stands for is one
 * click away and the band's own count already says how much there is.
 *
 * `mergeSpans` rather than one strip per bar, so two bars that overlap read as the one run
 * they are: drawn per bar, a busy fortnight is a row of seams.
 *
 * **The `opacity` on this is exempt from the rule beside it, and the exemption is why it is
 * stated here.** `styles/lanes.css` says muting is done to a row's CONTENT and never to the
 * row, because a row-level `opacity` takes the sticky lead column down with it. This is an
 * aria-hidden decorative child inside one track, so it dims nothing that carries meaning.
 *
 * `geometry.outside` skips a run wholly past `MAX_TIMELINE_DAYS`' clamp — rare now that
 * `drawnSpans` widens the window for a folded band's own bars, and not gone: a plan too
 * long to draw whole still clips around today, and a run entirely beyond that clip draws
 * no rail at all rather than one pinned to an edge it does not run through. A BAR in that
 * same wholly-outside state still draws something: `edgeClasses` returns `pbl-bar-outside`
 * for it — not because any part of it is in view (`outside` means none is), but because a
 * bar can still assert a direction past the edge. This is not the ONE place a rail and a
 * bar answer the window question differently, either: the other is a run merely CLIPPED,
 * one edge past the window and one still in it, where a bar's `pbl-bar-open-start` /
 * `pbl-bar-open-end` marks which edge it runs past and this function applies no
 * `edgeClasses` at all — a clipped rail draws edge-to-edge with no beyond-the-edge hint.
 */
function renderLaneRail(
	track: HTMLElement,
	lane: ResourceLane,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): void {
	for (const run of mergeSpans(lane.bars.map((bar) => bar.span))) {
		const geometry = barGeometry(ruler.window, run);
		if (geometry.outside) continue;
		const rail = track.createDiv({ cls: 'pbl-lane-rail', attr: { 'aria-hidden': 'true' } });
		placeSpan(rail, geometry, ruler.scale);
	}
}

/**
 * The days one resource is unavailable, shaded across a WORK row of their own band — OVER the
 * bars, so a bar and the stretch it crosses are read on one line rather than two. The mark in
 * the header's own track (`renderLaneAbsences`) still carries the title, the dates and the
 * menu; this is the same fact where the collision actually happens, which is what this
 * feature's user story asks for and what the header's mark alone could not give.
 *
 * `barGeometry` against the same window the mark is placed against, so the shading and the
 * stretch cannot disagree about which day is which.
 *
 * **Appended, and that is the whole layer story: no `z-index` anywhere.** It shipped
 * *under* the bars on 2026-08-14 and was corrected the same day from a live vault — a wash a
 * bar paints over marks the days that are free and hides exactly the ones the reader is
 * looking for. Over it, the tint lands on the bar itself. What must NOT be reached for is a
 * `z-index` on either element: the track is `position: relative` with `z-index: auto` and so
 * establishes no stacking context, so a layer here would compete with the sticky lead column
 * at 2 — the trap `styles/dependencyArrows.css` records. Document order decides it, exactly
 * as it decides the arrow layer's sandwich, and this drawer runs after `renderBarRow` has
 * finished the row.
 *
 * **Over the bar is not over everything, and the difference is the row's TITLE.** The wash
 * paints over `.pbl-bar` and under `.pbl-bar-label`, which its caller arranges by moving the
 * label to the end of the track once this has run (`drawBandCollision` in
 * `./timeline.ts`) — reported from a vault on 2026-08-15, where a title read through the
 * hatch and so was not read at all. The same one mechanism either way: append order, never a
 * `z-index`. A caller that draws this and leaves the label where it was gets a legible bar
 * and an illegible name.
 *
 * A stretch wholly outside the window draws nothing. `barGeometry` CLAMPS one, so shading it
 * would colour days it does not cover — the mark can say "past this edge" because
 * `.pbl-bar-outside` is a direction rather than a span, and a column of shaded days has no
 * way to say that.
 */
function renderAbsenceWash(
	track: HTMLElement,
	absences: Absence[],
	ruler: { window: TimelineWindow; scale: TimelineScale },
	label: HTMLElement | null,
): void {
	for (const absence of absences) {
		const geometry = barGeometry(ruler.window, { start: absence.start, target: absence.target });
		if (geometry.outside) continue;
		const wash = track.createDiv({ cls: 'pbl-absence-wash', attr: { 'aria-hidden': 'true' } });
		placeSpan(wash, geometry, ruler.scale);
	}
	// The label goes back on top, HERE rather than at the call site: this function is what put
	// something over the row, so it is what owes the row its title back. `appendChild` on an
	// element already in the track MOVES it, so nothing is created and only the painting
	// changes — the label is absolutely positioned either way.
	if (label !== null) track.appendChild(label);
}

/**
 * The mark a bar carries when it is scheduled across days its own resource is away — the
 * dependency conflict's SHAPE reused rather than reinvented: a swatch in the lead, where a
 * column of them is scannable, and the words it stands for in the row's own content.
 * Hatched in the away key (`--pbl-away`) rather than the `calendar-x` glyph it shipped
 * with, so the lead mark and the wash it sits beside on the SAME row read as one thing —
 * a colour rather than a second icon competing with the Add absence button, which is the
 * one `user-x` left in this band: the absence row's own icon went with the row (4n) and the
 * header's own glyph was refused (`docs/requirements/Resource absences.md`), so the three
 * this sentence used to count are one.
 *
 * The sentence is not a nicety. The wash over the bar tells this in colour alone, which
 * WCAG 1.4.1 refuses and which a screen reader gets nothing of at all. `.pbl-sr-only`
 * CONTENT rather than an `aria-label`, for `stateNote`'s reason: a label REPLACES the name
 * the row derives from its badge, its title and its bar's dates. Written unconditionally —
 * never gated on room the way the VISIBLE cost is — so a reader always gets the fact even
 * where `drawBandCollision` finds no label to hang the cost sentence on.
 *
 * No row-level class beside `.pbl-row-conflict`. That one exists because a broken dependency
 * draws nothing else anywhere; here the wash is already on this very row, so a second accent
 * would restate what the reader is looking at. Add one when someone can say what it buys.
 *
 * The tooltip goes on the SWATCH, not on the lead, which already tooltips the row's title.
 *
 * Draws only the sr-only sentence and the lead swatch — the VISIBLE cost is
 * `drawBandCollision`'s own business now, appended into the bar's title label rather than
 * placed here, so this function needs no opinion about width or position at all.
 *
 * `costSentence` is `absenceCost`'s FULL form of the same fact `.pbl-days-lost`
 * abbreviates on the row — folded into `said` so the tooltip and the sr-only span always
 * carry the whole count even where the row itself only ever shows the short token, or
 * shows nothing at all because the title's own label was dropped.
 */
function noteAbsenceClash(bar: { row: HTMLElement; lead: HTMLElement }, crossed: Absence[], costSentence: string): void {
	if (crossed.length === 0) return;
	const spans = crossed.map(absenceSaid).join('; ');
	const said = t('lane.absenceClash', { count: crossed.length, cost: costSentence, spans });
	bar.row.createSpan({ cls: 'pbl-sr-only', text: said });
	// A hatched swatch in the away key rather than the `calendar-x` glyph it replaced, so the
	// lead mark and the column it stands for read as one thing — and the legend can key it.
	const flag = bar.lead.createSpan({ cls: 'pbl-away-flag pbl-away-swatch', attr: { 'aria-hidden': 'true' } });
	setTooltip(flag, said);
}

/**
 * Whose row this is, on the row itself. A DESCRIPTION rather than a label: a label would
 * replace the content-derived accessible name and cost a reader the badge, the title and
 * the dates — `renderCardBody`'s outside-filter marker makes the same choice for the same
 * reason.
 *
 * The milestones' row needs no guard here and deliberately has none: it draws no row of its
 * own (`laneEntries`) and its header is the one element `drawEntries` passes as unnamed, so
 * a resource's name is the only thing this can ever be asked about.
 */
export function renderLaneRowDescription(row: HTMLElement, name: string): void {
	row.setAttribute('aria-description', `Assigned to ${name}`);
}

/**
 * Every hold a bar or a mark offers, wired to the drag controller — one function because
 * a bar row (`renderBarRow`, `./timeline.ts`) and a marker's own diamond
 * (`drawMarkerDiamonds`, below) wire the identical holds through the identical call, and
 * the second copy of the loop is exactly what a fallow clone group caught (2026-08-17).
 *
 * The body hold IS `el` itself — no child created for it, which is what keeps a click on
 * the bar or the diamond opening its note rather than landing on an invisible grip
 * covering the whole surface — and every other entry in `holds` becomes its own
 * `pbl-bar-grip` child. `barHolds` puts `'body'` last whenever it is present at all, so
 * the loop always finishes the edges before it ever touches the element the caller passed
 * in; nothing here depends on that order, but nothing needs to fight it either.
 *
 * A press that never travels far enough to become a drag still fires `click`, and a grip
 * is a control inside whatever `wireCardActivation`/`wireOpenGestures` wired on `el` —
 * `fromRowControl` (`render/rows.ts`) is what keeps that click from opening the note
 * instead of starting a resize, because `.pbl-bar-grip` is one of `ROW_CONTROL`'s
 * documented non-buttons. `timelineDrag.test.ts` drives both halves for the bar row — the
 * grips stay silent, the bar still opens — and the marker's own mark inherits the
 * identical guard through the identical class.
 */
export function wireBarHolds(el: HTMLElement, item: BacklogItem, holds: BarHold[], dnd: CardDragController, scrollLeft: () => number): void {
	for (const hold of holds) {
		const target = hold === 'body' ? el : el.createDiv({ cls: `pbl-bar-grip pbl-bar-grip-${hold}` });
		// Stated on the element like every grip's: what a gesture will be resolved AS is
		// readable off the thing the reader takes hold of.
		target.dataset.pblHold = hold;
		// The scroller's offset at drag start rides the payload, for the delta a hold
		// measures — see `CardSource.scrollLeft` and `interactions/timelineDrag.ts`.
		dnd.wireCard(target, item, hold, scrollLeft);
	}
}

/**
 * Every marker on the axis, as diamonds in the ONE header track the milestones' row is —
 * [[Milestones out of the resource rows]]. A point in time has no duration to fold and no
 * subtree to disclose, so a row apiece said per row what one row says; what a reader needs
 * of a milestone here is where it falls against the bands beneath it, and the diamond is
 * that whole answer.
 *
 * **The name is not lost with the row, and that is what makes a bare diamond legible.**
 * `renderMilestoneLines` already draws each marker's title in the coarse header tier above
 * a full-height line, so the row's job is the mark and the line's is the name. This adds
 * the same fact where a pointer can reach it — the title and the exact date on the
 * diamond's own tooltip and `aria-label` — because a line's label is a different element
 * from the mark and the two are read at opposite ends of the grid.
 *
 * **A marker registers TWO mounts and they are deliberately different elements.**
 * `mounts.tracks` takes this one shared track, because that is where a move's drag preview
 * belongs — it is the positioned box every `--pbl-bar-left` on this row is measured from.
 * `mounts.anchors` takes the DIAMOND, because that is what a dependency arrow reads a Y
 * off, and a sub-lane belongs to one marker where the track holds every one of them. Both
 * were the track until 2026-08-15, which was right while markers could not stack and wrong
 * the moment they could: two on one day put both arrows on the header's centre, on neither
 * diamond and exactly on top of each other. The X is `dependencyAnchor`'s either way.
 *
 * Done is asked per DIAMOND and lands on the diamond, unlike every other bar on this grid,
 * whose `pbl-done` sits on the row: the row here is shared by every marker and one of them
 * being finished says nothing about the next. `styles/timeline.css` carries the matching
 * rule beside the row-level one.
 *
 * **Everything else a bar ROW carries has to be asked of the mark here, and two of them
 * were missed when the row went (2026-08-15).** Both are on the diamond because the row is
 * shared and a fact about one marker is not a fact about the next:
 *
 * - The dependency handle. `wireBarLink` draws it and wires both halves — a marker refuses
 *   both menu entries by design (`addDependencyItems`: a point in time waits for nothing),
 *   so the connector is the ONLY route by which anything comes to wait on a date, and
 *   without it the axis that draws a calendar per person was the one where nothing could.
 *   `row` is the diamond itself rather than the track, or a drag from one date would
 *   outline every date on the plan as its origin. That makes the mark a control's parent,
 *   so the click below has to ask `fromRowControl` — the identical guard
 *   `wireCardActivation` gives a bar row, and the identical defect (a handle that opened
 *   the note) it was written for.
 * - A sub-lane per mark, where two markers land on the same drawn day. `barGeometry` gives
 *   both the same `left` and a diamond is 12px of opaque mark, so the later one covered the
 *   earlier outright — its tooltip, its click and its drag all unreachable, which a row
 *   apiece could never produce. Counted by drawn POSITION rather than by date, so two dates
 *   that resolve to one pixel column stack too; what it does NOT answer is marks a day or
 *   two apart at a coarse zoom, which overlap partially and are the "spacing of marks that
 *   fall close together" a live vault still owes an opinion on. The stack is the header's
 *   own `--pbl-lane-sublanes` mechanism, unchanged — the same two custom properties an
 *   absence packs with (`renderLaneAbsences`), so the row grows by the same pitch.
 */
export function drawMarkerDiamonds(
	ctx: RowContext,
	mounts: MarkerMounts,
	band: { head: HTMLElement; track: HTMLElement; lane: ResourceLane },
	ruler: { window: TimelineWindow; scale: TimelineScale },
	drawn: DrawnColors,
): void {
	const track = band.track;
	const stacked = new Map<number, number>();
	for (const bar of band.lane.bars) {
		const geometry = barGeometry(ruler.window, bar.span);
		// Asked ONCE — `renderBarRow`'s own rule: what looks grabbable (`holdable`, read by
		// `barClasses` below) and what a gesture actually registers (`wireBarHolds` further
		// down) have to read the same list, or a mark could look draggable and refuse the
		// drop, or the reverse.
		const holds = barHolds(bar.item, ctx.host.settings, bar);
		const holdable = holds.includes('body');
		const done = ownWorkflowReading(bar.item).done;
		const el = track.createDiv({ cls: barClasses(bar, geometry, holdable) + (done ? ' pbl-done' : '') });
		placeSpan(el, geometry, ruler.scale);
		const sublane = stacked.get(geometry.startDay) ?? 0;
		stacked.set(geometry.startDay, sublane + 1);
		el.setCssProps({ '--pbl-sublane': String(sublane) });
		// The state in words, folded into the mark's OWN label: the diamond has no row to put
		// a `.pbl-sr-only` span in, and done is a green mark and nothing else without it —
		// colour alone, which WCAG 1.4.1 refuses and a screen reader gets none of.
		const state = stateNote(stateKeyFor(ctx.host.settings, bar.item), ownWorkflowReading(bar.item));
		const said = `${bar.item.title} — ${spanText(bar)}${state ? ` — ${state}` : ''}`;
		// **CONTENT, never an `aria-label`** — this repository's own rule about this exact
		// element, stated at `stateNote` and broken here until 2026-08-16: `.pbl-bar` is a
		// plain div, so its implicit role is `generic`, and ARIA PROHIBITS an accessible name
		// on one. A label there may be announced by nobody, which would mean the words a
		// marker's row used to carry were LOST when the row went rather than moved. Text is in
		// the accessibility tree whatever the element's role is. Found in review, on both grid
		// axes, since the mark is one mark. The tooltip beside it is the pointer's own route to
		// the same sentence and needs no role at all.
		el.createSpan({ cls: 'pbl-sr-only', text: said });
		setTooltip(el, said);
		// The path on the MARK, which is where every other grid puts it (`renderBarRow` puts
		// it on the row): the link drag's own sweep reads it back to mark what a held gesture
		// may not be dropped on, and here the mark is the only element that is one marker's.
		el.dataset.pblPath = bar.item.file.path;
		// REGISTERED even though the mark draws no card body and no row of its own:
		// `cardedPaths` takes its "already on screen" set from this register and
		// `menuChildren` subtracts it, so a marker drawn and not registered makes its
		// parent bar's menu offer `Open child "…"` for a diamond on the same grid — the
		// shipped defect [[Milestones in one row on the dated axis]] 3d records. Being on
		// screen and being NAVIGABLE stay separate: it is off the keyboard walk regardless,
		// since that list is `drawnCards`, read from the entries.
		ctx.placed.add(bar.item.file.path);
		mounts.tracks.set(bar.item.file.path, track);
		// The TRACK is where a move's preview mounts, and it is this one shared box; the
		// ANCHOR an arrow reads a Y off is the diamond, because a sub-lane is one marker's
		// and the track holds every one of them. Registering the track for both put both
		// arrows on the header's centre — see `BarRowMounts.anchors`.
		mounts.anchors.set(bar.item.file.path, el);
		// A POINT's `holds` never carries an edge — `barHolds`' own point branch returns at
		// most `['body']` — so a bar-mode Iteration's own stated ends are what first put a
		// grip on this row, one per end whose key is actually configured.
		wireBarHolds(el, bar.item, holds, mounts.dnd, () => mounts.scroller.scrollLeft);
		// `row` is the diamond itself — see `BarLinkParts.row`, and 2d in the note above.
		wireBarLink(ctx, { dnd: mounts.dnd, content: mounts.content, row: el, barEl: el, outside: geometry.outside, item: bar.item });
		// **The mark carries every gesture a bar ROW carried, minus the selection.** The row
		// went and `wireCardActivation` went with it, and what was written here in its place
		// was the primary click alone — so a middle click opened no tab (a browser fires no
		// `click` for it) and a right click reached no menu, which on this grid is the only
		// pointer route to Schedule, Unschedule and Set state for a date. Both found in
		// review (2026-08-16), and both are the same mistake: a mark that inherits a row's
		// job inherits all of it.
		//
		// What it does NOT inherit is `selectItem`. A diamond is not an `option` and has no
		// element `aria-activedescendant` could point at ([[Milestones out of the resource
		// rows]] 3c), so selecting one would leave the pane's roving walk on a path with no
		// stop. `wireOpenGestures` and `wireItemMenu` are the two halves of
		// `wireCardActivation` that do not need one; a card still gets both through it.
		wireOpenGestures(ctx.host, el, bar.item);
		wireItemMenu(ctx.host, el, bar.item);
		// `barClasses` gives a wholly-outside mark no `pbl-bar-milestone`, so it draws the
		// plain accent rather than the cyan diamond — the legend has to key what was
		// actually painted, which is `Other` and not `Milestone`. Reported here rather than
		// recomputed in the legend, `reportColors`' own rule: a copy of `barClasses`'
		// precedence is exactly what missed this case on the dated axis once already.
		// Milestone and Iteration share the one cyan diamond class (`geometry.milestone`), so
		// which of the two keys the legend is asked of the ITEM's own type, never of the
		// mark's colour — the same content-aware split `markerLaneCaption` makes for the row's
		// own caption. `!geometry.milestone` used to be reachable only through `outside` —
		// every stated point drew equal-ended — until bar mode gave an Iteration mismatched
		// ends in this very track: an accent-coloured span, keyed `Other` the same way a
		// wholly-outside mark already was, never claimed as the cyan `barClasses` did not draw.
		if (done) drawn.done = true;
		else if (geometry.outside || !geometry.milestone) drawn.accent = true;
		else if (isIterationType(bar.item.typeName)) drawn.iteration = true;
		else drawn.milestone = true;
	}
	band.head.setCssProps({ '--pbl-lane-sublanes': String(Math.max(0, ...stacked.values())) });
}

/**
 * Everything a WORK row owes its own band about the stretch it crosses: the shading behind
 * the bar, the mark and its cost beside it, and the report the legend keys from — three
 * things that must agree about which stretches this bar actually crosses, so they are
 * decided together here rather than left as three separate asks inside `drawEntries`, which
 * is already at the branching budget `npm run analyze` enforces just telling the three entry
 * kinds apart.
 *
 * `crossed` is computed once, here, and threaded into `absenceCost` and `noteAbsenceClash`
 * — passed rather than each asking `crossedAbsences` again over the band's full `absences`
 * list, which used to run that walk twice for one row and left the answers free to
 * disagree if the band's own absences ever changed between the calls.
 *
 * The cost text is appended HERE, as a plain child of `bar.label` — the very element
 * `renderBarLabel` already decided has room for a title, or dropped — rather than
 * positioned as a sibling of the bar with its own width check. A bar too cramped for its
 * own title is too cramped for a sentence about it, by the SAME reserve, so there is no
 * second "is there room" to keep in step and no second offset to compute: `bar.label ===
 * null` is the whole suppression rule now. `drawn.daysLost` follows from whether that
 * append actually happened — a crossing with a dropped title still flags the lead swatch,
 * but the legend's "Days lost" key is about the TOKEN, and keying it where none landed
 * anywhere is the exact "keys a mark nothing on screen makes" defect `DrawnColors.daysLost`'s
 * own comment warns against for `absence` beside it.
 */
export function drawBandCollision(bar: { row: HTMLElement; lead: HTMLElement; track: HTMLElement; label: HTMLElement | null }, row: TimelineRow, lane: ResourceLane, ruler: { window: TimelineWindow; scale: TimelineScale }, drawn: DrawnColors): void {
	// The label is handed over so the wash can put it back on top: the tint belongs over the
	// BAR and under the row's own NAME, and both halves are append order rather than a
	// `z-index` — see `renderAbsenceWash`, and `styles/dependencyArrows.css` for why a layer
	// here may not have one.
	renderAbsenceWash(bar.track, lane.absences, ruler, bar.label);
	const crossed = crossedAbsences(row.bar.span, lane.absences);
	if (crossed.length === 0) return;
	const cost = absenceCost(row, crossed);
	noteAbsenceClash(bar, crossed, cost.full);
	if (bar.label === null) return;
	bar.label.createSpan({ cls: 'pbl-days-lost', text: cost.short, attr: { 'aria-hidden': 'true' } });
	drawn.daysLost = true;
}

/**
 * What a crossing costs — the SHORT token for the row and the FULL sentence for the
 * tooltip and the sr-only span, computed together so the two can never disagree about the
 * number. Two strings rather than `clashCost` and a `clashCostSentence` beside it, because
 * both need the SAME `lost`/`whole` arithmetic and a caller asking for one alone was the
 * shape that risked the two drifting apart, the same reason `crossed` above is computed once
 * for both this and `noteAbsenceClash`.
 *
 * The short form exists because `.pbl-bar-label`'s content box measures 118px (`max-width:
 * 144px`, `box-sizing: border-box`, `padding: 0 8px` plus the `after` variant's own
 * `padding-left: 18px`), and a full sentence never fitted there even with an empty title in
 * front of it — "15 days lost to absence" alone is ~128px at `--font-ui-smaller`. These
 * short forms are ~40–55px, small enough that `.pbl-days-lost`'s own `flex: 0 0 auto`
 * (`styles/lanes.css`) can hold the whole token unshrunk and still leave the title
 * (`.pbl-bar-label-title`, `min-width: 0`) room to ellipsize into what is left — the flex
 * row `.pbl-bar-label` became for exactly this reason, since `text-overflow: ellipsis`
 * truncates at the LINE's end and could not tell the token from the title on its own. The
 * full form is never lost, only moved off the row itself.
 *
 * **There is no milestone case any more, and its absence is the rule rather than an
 * omission.** This answered `· away` for a point before any arithmetic until 2026-08-15,
 * when a marker stopped sitting in a resource's band at all — it draws in the milestones'
 * own row, which has no absences, so nothing a marker crosses can reach this function. A
 * branch that cannot be reached is a claim nothing keeps; the loss it stands for is
 * recorded in [[Milestones out of the resource rows]].
 *
 * `lost` is real calendar days, off the note's own span; the unnamed unclamped total below
 * is that same span's REAL length, which is what "whole" has to mean — `geometry.spanDays`
 * is the window-CLAMPED width and a narrower number for a bar clipped at the window's edge,
 * so comparing against it would call a few days lost off a sliver of a decades-long plan
 * "all" of it.
 */
function absenceCost(row: TimelineRow, crossed: Absence[]): { short: string; full: string } {
	const lost = daysLost(row.bar.span, crossed);
	const whole = lost >= daysBetween((row.bar.span.start ?? row.bar.span.target) as CivilDate, (row.bar.span.target ?? row.bar.span.start) as CivilDate) + 1;
	return whole
		? { short: `all ${lost}d`, full: t('lane.daysLostWhole', { count: lost }) }
		: { short: `${lost}d lost`, full: t('lane.daysLost', { count: lost }) };
}

/**
 * A dateless end is styled open — the plan's gap stays visible instead of being
 * filled in — and an end past the window's edge is styled the same way: both say
 * "this continues beyond what is drawn", and the tooltip carries the exact dates.
 *
 * An inferred bar is a different claim: it HAS dates, but the view drew them from
 * below rather than reading them off the note, so it is outlined rather than
 * filled and never reads as a plan somebody stated.
 *
 * ponytail: one class covers "inferred" and "inferred, some children undated" —
 * an inferred end is uncertain by construction. Split them when someone can
 * describe the two pixels apart.
 */
export function barClasses(bar: TimelineBar, geometry: BarGeometry, hasBodyHold: boolean): string {
	const holdable = hasBodyHold ? ' pbl-bar-holdable' : '';
	// Nothing of it is in view. Drawing the clamp would put a diamond at a date the item
	// does not have, and a diamond IS the claim that this is the date — so the row carries
	// only the direction it lies past, in the same open-end vocabulary a clipped bar uses.
	// The exact date is in the bar's tooltip and in the row's accessible name.
	// What the WINDOW does to this mark is `edgeClasses`, shared with the absence stretch
	// drawn by the same arithmetic. Everything below is what a BAR adds on top of it.
	const inferred = bar.inferredStart || bar.inferredEnd ? ' pbl-bar-inferred' : '';
	const edges = edgeClasses(geometry).join(' ');
	if (geometry.outside) {
		// Provenance must not be silently upgraded: an inferred span that lands wholly
		// past the edge is still inferred, not a date the note stated, so the class
		// that says so travels with it into this branch too.
		return `pbl-bar ${edges}${inferred}${holdable}`;
	}
	let cls = 'pbl-bar';
	if (geometry.milestone) cls += ' pbl-bar-milestone';
	// A bar's open end is the wider claim: a date the note never stated, as well as one
	// this window cannot reach. `edgeClasses` answers only the second, which is the whole
	// of what an absence — both ends stated by construction — can have.
	if (bar.span.start === null) cls += ' pbl-bar-open-start';
	if (bar.span.target === null) cls += ' pbl-bar-open-end';
	// `pbl-bar-clipped-end` is distinct from open-end, which also covers a bar with no
	// target date at all. The two want different connector placement: an open end has an
	// on-screen edge to sit past, a clamped one does not.
	return [cls, edges].filter(Boolean).join(' ') + inferred + holdable;
}

/**
 * A mark's workflow state in words, or '' where there is none to say.
 *
 * A grid axis draws state as a bar COLOUR and nothing else: `renderStateChip`'s only call
 * site is a tree row's own column, so without these words the slot colours are the whole of
 * it — unreadable to a screen reader, and colour alone for everyone else (WCAG 1.4.1). Done
 * is spelt out for the same reason: `pbl-done` is a class and a green bar.
 *
 * Two callers with two placements, decided by what the mark HAS. A bar row puts it in the
 * row's own visually hidden CONTENT, never an `aria-label` anywhere: `.pbl-bar` is a plain
 * div — role `generic`, where ARIA prohibits an accessible name — and a label on the row
 * would REPLACE the badge and title the row derives its name from. A DIAMOND has no row and
 * no content of its own, so it folds these words into the label it already carries.
 *
 * Here rather than in `./timeline.ts`, `edgeClasses`' reason exactly: the grid imports this
 * module and never the other way, so anything both a bar row and a diamond need has to live
 * on this side of that edge.
 */
export function stateNote(stateKey: string, reading: WorkflowReading): string {
	if (!stateKey) return '';
	if (reading.done) return reading.value === null ? 'Done' : `${reading.value} — done`;
	return reading.value ?? '';
}

/** One sentence about a span, said identically on the grid and in the drop ghost. */
export function spanText(bar: TimelineBar): string {
	const span = bar.span;
	const inferred = bar.inferredStart || bar.inferredEnd ? ' — inferred from children' : '';
	if (span.start !== null && span.target !== null) {
		// The item's OWN type, never the literal word "Milestone" — a coincident pair draws
		// the same diamond whatever the item is (an inferred equal span included), so the
		// sentence has to say what THIS item is rather than what a point used to always mean.
		if (formatCivil(span.start) === formatCivil(span.target)) {
			return `${displayType(bar.item)} ${formatCivil(span.start)}${inferred}`;
		}
		return `${formatCivil(span.start)} → ${formatCivil(span.target)}${inferred}`;
	}
	if (span.start !== null) return `Starts ${formatCivil(span.start)}, target not set${inferred}`;
	// deriveBars admits no fully dateless span, so the remaining end exists.
	return `Target ${formatCivil(span.target as CivilDate)}, start not set${inferred}`;
}

