import { setTooltip } from 'obsidian';
import { createCard } from './board';
import { RowContext } from './columns';
import { drawIcon } from './icons';
import { renderBadge, renderChevron, renderTitleText } from './rows';
import { promptAddAbsence, showAbsenceMenu } from '../interactions/absences';
import { BacklogViewHost } from '../host';
import { Absence, absencesConfigured, pendingAbsences } from '../../domain/absences';
import { timelineRows, TimelineRow } from '../../domain/bars';
import { BacklogItem } from '../../domain/model';
import { CivilDate } from '../../domain/noteFields';
import { ResourceLane } from '../../domain/roadmap';
import {
	BarGeometry,
	barGeometry,
	DateSpan,
	formatCivil,
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
	| { kind: 'absence'; absence: Absence }
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
export function edgeClasses(geometry: BarGeometry): string[] {
	if (geometry.outside) return ['pbl-bar-outside', geometry.clippedStart ? 'pbl-bar-open-start' : 'pbl-bar-open-end'];
	const classes: string[] = [];
	if (geometry.clippedStart) classes.push('pbl-bar-open-start');
	if (geometry.clippedEnd) classes.push('pbl-bar-open-end', 'pbl-bar-clipped-end');
	return classes;
}

/** The dated axis's own entries: every row, in order, and nothing else. */
export function barEntries(rows: TimelineRow[]): TimelineEntry[] {
	return rows.map((row): TimelineEntry => ({ kind: 'row', row }));
}

/**
 * Every span this grid will DRAW — which is not the same list as its bars, and the
 * difference is a shipped bug. The window used to be the bars alone, so an absence stretch
 * beyond their reach was clamped to the edge and painted on a day it does not cover; worst
 * in a row an absence MINTED, which holds no bar at all, so nothing the row exists to draw
 * had any say in the window it is drawn against. See
 * `docs/bugs/An absence drew at the edge of a window it never widened.md`.
 *
 * Here rather than in `./timeline.ts` because the entry vocabulary is this module's: a
 * kind added to `TimelineEntry` that positions itself against the day grid is answered by
 * editing the one function beside the type, not by remembering a second walk in the
 * renderer.
 */
export function drawnSpans(entries: TimelineEntry[]): DateSpan[] {
	return entries.flatMap((entry) => {
		if (entry.kind === 'row') return [entry.row.bar.span];
		return entry.kind === 'absence' ? [{ start: entry.absence.start, target: entry.absence.target }] : [];
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
		const collapsed = folded.lane(lane.name);
		entries.push({ kind: 'lane', lane, collapsed });
		if (collapsed) continue;
		// Absences lead the band: an unavailable stretch is a fact about the ROW, and the
		// work in it reads against that rather than the other way round. One entry each —
		// two overlapping stretches are two lines, never packed into one (4a), because a
		// packing rule is a second geometry to keep in step with the one the bars use.
		for (const absence of lane.absences) entries.push({ kind: 'absence', absence });
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
 */
export function renderLaneHead(
	ctx: RowContext,
	content: HTMLElement,
	lane: ResourceLane,
	collapsed: boolean,
	today: CivilDate,
): HTMLElement {
	const head = content.createDiv({
		cls: 'pbl-lane-head' + (lane.declared ? '' : ' pbl-lane-undeclared') + (collapsed ? ' pbl-lane-collapsed' : ''),
	});
	const lead = head.createDiv({ cls: 'pbl-timeline-lead' });
	renderLaneChevron(ctx.host, lead, lane, collapsed);
	lead.createSpan({ cls: 'pbl-lane-name', text: lane.name });
	lead.createSpan({ cls: 'pbl-lane-count', text: laneReadout(lane, today) });
	if (!lane.declared) {
		const mark = lead.createSpan({ cls: 'pbl-lane-stray' });
		drawIcon(mark, 'circle-help');
		setTooltip(
			head,
			`"${lane.name}" is not one of the declared resources. Add it to "Resources (in order)" in the view options, or re-assign its items.`,
		);
	}
	renderLaneAbsenceAdd(ctx, lead, lane);
	head.createDiv({ cls: 'pbl-timeline-track' });
	return head;
}

/**
 * What a band's header reports: its result bars, and the absences that have not ended.
 *
 * **The item half is RESULT bars and stays so**, the rule a bucket's count already keeps —
 * a context row placed here is placement, not population, and an absence is furniture of
 * the row. Only its spelling changed on 2026-08-14; a band whose only content is an absence
 * still reads `0 items`.
 *
 * **The absence half is a glyph's refusal answered in words.** One was built on 2026-08-14
 * and removed the same day, for two reasons that still hold: the stretch's own hatched row
 * sits directly beneath the header, and a fourth `user-x` in this lead competed with the
 * Add absence button that reveals on hover in the same place. The glyph stays refused. What
 * words buy that the mark could not is the two things the rows below cannot say — a
 * FILTER on today, since the band draws every stretch a resource ever had, and a count that
 * survives folding, since `laneEntries` skips a collapsed band's absences entirely.
 *
 * It is dropped at zero rather than reading `0 absences`, which would sit on nearly every
 * band reporting nothing anyone asked for.
 *
 * Plurals inline, this codebase's own idiom at eleven other call sites rather than a shared
 * helper for two words.
 */
function laneReadout(lane: ResourceLane, today: CivilDate): string {
	const items = `${lane.bars.length} item${lane.bars.length === 1 ? '' : 's'}`;
	const away = pendingAbsences(lane.absences, today);
	if (away === 0) return items;
	return `${items} / ${away} absence${away === 1 ? '' : 's'}`;
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
		label: `${collapsed ? 'Show' : 'Hide'} ${lane.name}'s work`,
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
	if (!absencesConfigured(ctx.host.settings)) return;
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
 */
export function renderLaneContextRow(ctx: RowContext, content: HTMLElement, item: BacklogItem): HTMLElement {
	const row = createCard(ctx, content, item);
	row.addClass('pbl-timeline-row');
	row.addClass('pbl-lane-context');
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderBadge(ctx.host, lead, item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	renderTitleText(ctx.host, title, item.title);
	setTooltip(lead, item.title);
	row.createDiv({ cls: 'pbl-timeline-track' });
	return row;
}

/**
 * One unavailable stretch, drawn where a bar would be drawn and by the same arithmetic —
 * `barGeometry` against the same window, so a stretch and the work it crosses cannot
 * disagree about which day is which.
 *
 * NOT a card: `createCard` gives a `BacklogItem` its selection, its context styling and
 * its place in the pane's roving walk, and an absence is none of those things — it is not
 * in `roadmap.cards`, cannot be selected, and has no note-opening activation. What it has
 * is a title, a range, and a context menu to delete it
 * (`view/interactions/absences.ts`).
 *
 * The dates go in the row's own accessible name rather than on the mark: the mark is a
 * plain div, where ARIA prohibits a name, and a reader who cannot see the stretch needs
 * to be told which days it covers — which no neighbouring element says for it. Whose row
 * it is in is `renderLaneRowDescription`'s, exactly as it is for every other row of the
 * band.
 */
export function renderLaneAbsence(
	ctx: RowContext,
	content: HTMLElement,
	absence: Absence,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): HTMLElement {
	const { window, scale } = ruler;
	const host: BacklogViewHost = ctx.host;
	const row = content.createDiv({ cls: 'pbl-timeline-row pbl-absence-row' });
	row.addEventListener('contextmenu', (evt) => showAbsenceMenu(host, absence, evt));
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	drawIcon(lead.createSpan({ cls: 'pbl-absence-icon', attr: { 'aria-hidden': 'true' } }), 'user-x');
	const title = lead.createDiv({ cls: 'pbl-card-title', text: absence.title });
	setTooltip(title, absence.title);
	const track = row.createDiv({ cls: 'pbl-timeline-track' });
	const geometry = barGeometry(window, { start: absence.start, target: absence.target });
	const mark = track.createDiv({ cls: ['pbl-absence', ...edgeClasses(geometry)].join(' ') });
	mark.setCssProps({
		'--pbl-bar-left': `${geometry.startDay * scale.dayPx}px`,
		'--pbl-bar-width': `${Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = `${formatCivil(absence.start)} → ${formatCivil(absence.target)}`;
	setTooltip(mark, dates);
	row.setAttribute('aria-label', `${absence.title} — unavailable ${dates}`);
	return row;
}

/**
 * The days one resource is unavailable, shaded across a WORK row of their own band — OVER the
 * bars, so a bar and the stretch it crosses are read on one line rather than two. The band's
 * own named line (`renderLaneAbsence`) still leads it and is where the title, the dates and
 * the menu live; this is the same fact where the collision actually happens, which is what
 * this feature's user story asks for and what a line of its own could not give.
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
 * A stretch wholly outside the window draws nothing. `barGeometry` CLAMPS one, so shading it
 * would colour days it does not cover — the mark can say "past this edge" because
 * `.pbl-bar-outside` is a direction rather than a span, and a column of shaded days has no
 * way to say that.
 */
export function renderAbsenceWash(
	track: HTMLElement,
	absences: Absence[],
	ruler: { window: TimelineWindow; scale: TimelineScale },
): void {
	for (const absence of absences) {
		const geometry = barGeometry(ruler.window, { start: absence.start, target: absence.target });
		if (geometry.outside) continue;
		const wash = track.createDiv({ cls: 'pbl-absence-wash', attr: { 'aria-hidden': 'true' } });
		wash.setCssProps({
			'--pbl-bar-left': `${geometry.startDay * ruler.scale.dayPx}px`,
			'--pbl-bar-width': `${Math.max(geometry.spanDays * ruler.scale.dayPx, MIN_BAR_PX)}px`,
		});
	}
}

/**
 * The mark a bar carries when it is scheduled across days its own resource is away — the
 * dependency conflict's SHAPE reused rather than reinvented: a glyph in the lead, where a
 * column of them is scannable, and the words it stands for in the row's own content.
 *
 * The sentence is not a nicety. The wash over the bar tells this in colour alone, which
 * WCAG 1.4.1 refuses and which a screen reader gets nothing of at all. `.pbl-sr-only`
 * CONTENT rather than an `aria-label`, for `stateNote`'s reason: a label REPLACES the name
 * the row derives from its badge, its title and its bar's dates.
 *
 * No row-level class beside `.pbl-row-conflict`. That one exists because a broken dependency
 * draws nothing else anywhere; here the wash is already on this very row, so a second accent
 * would restate what the reader is looking at. Add one when someone can say what it buys.
 *
 * The tooltip goes on the GLYPH, not on the lead, which already tooltips the row's title.
 */
export function noteAbsenceClash(row: HTMLElement, lead: HTMLElement, crossed: Absence[]): void {
	if (crossed.length === 0) return;
	const spans = crossed.map((one) => `${one.title} ${formatCivil(one.start)} → ${formatCivil(one.target)}`).join('; ');
	const said = `Crosses ${crossed.length === 1 ? 'an absence' : `${crossed.length} absences`}: ${spans}`;
	row.createSpan({ cls: 'pbl-sr-only', text: said });
	const flag = lead.createSpan({ cls: 'pbl-away-flag', attr: { 'aria-hidden': 'true' } });
	// `calendar-x`, NOT the `user-x` this shipped with. That glyph already means three things
	// in one band — the Add absence button, an absence row's own icon, and a resource being
	// away — so a fourth use for "this bar CROSSES an absence" left the two facts a reader
	// most needs to tell apart wearing one mark: *this row is an absence* and *this row runs
	// through one*. `user-x` stays with the person, and the crossing is about DAYS.
	drawIcon(flag, 'calendar-x');
	setTooltip(flag, said);
}

/**
 * Whose row this is, on the row itself. A DESCRIPTION rather than a label: a label would
 * replace the content-derived accessible name and cost a reader the badge, the title and
 * the dates — `renderCardBody`'s outside-filter marker makes the same choice for the same
 * reason.
 */
export function renderLaneRowDescription(row: HTMLElement, name: string): void {
	row.setAttribute('aria-description', `Assigned to ${name}`);
}
