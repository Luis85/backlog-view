import { TFile } from 'obsidian';
import { CivilDate, ownValue, readDate, readString } from './noteFields';
import { BacklogSettings } from './settings';
import { DateSpan, daysBetween, reversedSpan, unionDays } from './timeline';

/**
 * What a resource's own unavailable stretch IS, whether the configuration can carry one,
 * and how one is read back off a note. Pure, and the only producer of an `Absence` —
 * which is what lets everything downstream take both ends of a range for granted.
 */

/**
 * A resource's own unavailable stretch: four facts and no hierarchy. Deliberately not a
 * `BacklogItem` and deliberately not built from one — it has no parent, no rank, no
 * ladder rung and no state, so every field a `BacklogItem` carries would be a placeholder
 * here, and every walk that reads one would have to learn to skip it.
 *
 * Both ends are non-null by construction: `readAbsence` is the only producer and refuses
 * anything else, so nothing downstream has to ask whether a range is a range.
 */
export interface Absence {
	file: TFile;
	title: string;
	/** The resource whose row it draws in — matched case-insensitively, as bars are. */
	resource: string;
	start: CivilDate;
	target: CivilDate;
}

/**
 * What an absence SAYS — the three facts that reach its frontmatter, as strings, straight
 * from the form that produced them and already validated.
 *
 * Here rather than in `storage/`, where it was declared until 2026-08-14: it is what an
 * absence IS, this layer is where that is defined, and `absenceTitle` below consumes it —
 * a type belongs with the code that produces it, and `domain/` may not import `storage/`
 * to reach one. `AbsenceSpec` in `src/storage/absenceNotes.ts` still extends it with the
 * two facts that decide where the note IS rather than what it says.
 *
 * Distinct from `Absence` and deliberately so: that one holds parsed `CivilDate`s and a
 * `TFile`, and is what reading a note back produces.
 */
export interface AbsenceFacts {
	resource: string;
	/** Both ends as `YYYY-MM-DD` — this is a request to write, not a reading. */
	start: string;
	target: string;
}

/**
 * Whether the configuration can carry an absence at all: BOTH date properties, and the
 * assignee that says whose row it is.
 *
 * Sharper than the resources axis's own gate, which accepts either date property alone
 * (`hasDateAxis`) — a work item with one end open infers the other from its subtree, and
 * an absence has nothing beneath it to infer from. Asked of CREATING one and of READING
 * one back, from this single definition: a note with both dates still in its frontmatter
 * must not be read as a one-ended ordinary range just because the setting naming its
 * other end went away, and nothing distinguishes that case from a note that was never a
 * two-ended absence.
 */
export function absencesConfigured(settings: BacklogSettings): boolean {
	return settings.assigneeKey !== '' && settings.startKey !== '' && settings.targetKey !== '';
}

/**
 * One absence, or null for anything this axis cannot trust to be what it claims.
 *
 * The same validation the prompt applies, applied again here — not belt-and-braces, but
 * the only reading that cannot mislead. The prompt is not the only way a note's
 * frontmatter changes: Obsidian's own editor is always available and this plugin cannot
 * intercept it, so a hand edit can produce the exact shapes the prompt was built to
 * refuse. A work item's answer to a broken range is the shelf, and a written absence has
 * no shelf — it draws in one row or nowhere — so the answer here is nowhere, silently.
 */
export function readAbsence(
	file: TFile,
	fm: Record<string, unknown> | undefined,
	settings: BacklogSettings,
): Absence | null {
	if (!absencesConfigured(settings)) return null;
	const resource = readString(ownValue(fm, settings.assigneeKey));
	if (resource === null) return null;
	const start = readDate(ownValue(fm, settings.startKey));
	const target = readDate(ownValue(fm, settings.targetKey));
	// Both ends STATED and readable: `invalid` is a value the reader refused, and null is
	// a key that said nothing. Neither is a range.
	if (start.value === null || target.value === null) return null;
	// The same comparison a bar's own pair goes through, so "reversed" means one thing in
	// this plugin rather than two that must agree.
	if (reversedSpan(start.value, target.value)) return null;
	return { file, title: file.basename, resource, start: start.value, target: target.value };
}

/**
 * Which of these stretches a span actually crosses — the fact behind the mark a bar carries
 * when it is scheduled over days nobody should be scheduled across.
 *
 * Judged on the days the bar DRAWS: `start ?? target` … `target ?? start`, which is
 * `barGeometry`'s own borrowing. So a one-ended bar is judged at the single day it renders
 * rather than treated as unbounded in the direction it has no date for — and a backlog
 * stating targets and no starts is the ordinary case here rather than an edge one, so that
 * reading would report a crossing on nearly every stretch behind it.
 *
 * From DATES, never from geometry, so a crossing outside the drawn window still marks its
 * row: `dependencyArrows`' own rule read again — the row is where the fact lives, and a
 * window-derived mark would narrow it to wherever the reader happens to be scrolled.
 *
 * Inclusive at both boundary days: a bar ending on an absence's first day is scheduled across
 * it.
 */
export function crossedAbsences(span: DateSpan, absences: Absence[]): Absence[] {
	// `deriveBars` admits no fully dateless span, the same fact `spanText` leans on.
	const start = (span.start ?? span.target) as CivilDate;
	const end = (span.target ?? span.start) as CivilDate;
	return absences.filter((absence) => daysBetween(start, absence.target) >= 0 && daysBetween(absence.start, end) >= 0);
}

/**
 * Has this stretch not ended? One comparison, not two: a stretch whose target is today or
 * later has either not started or not finished, and there is no third case — written as two
 * conditions it invites a reader to "fix" a missing start comparison that would drop every
 * running absence.
 *
 * Inclusive at today, `crossedAbsences`' own boundary rule, so one absence does not mean two
 * different things on one row. From DATES and never from geometry, so a stretch outside the
 * drawn window still counts and the answer does not change as the reader scrolls.
 *
 * Private, and it was `pendingAbsences` — an exported COUNT — until the band header stopped
 * reporting one (2026-08-14). What the header shows now is weeks, so the count had no caller
 * left and only the filter survived.
 *
 * `today` is a parameter because nothing in this layer reads a clock — `todayCivil()` is
 * computed in the view and injected, which is what lets a test say which day today is.
 */
function isPending(absence: Absence, today: CivilDate): boolean {
	return daysBetween(today, absence.target) >= 0;
}

/**
 * What an absence note is CALLED, derived from the facts it holds — so recording one asks
 * for the dates and nothing else.
 *
 * The one producer, which is the point rather than tidiness: creating an absence and editing
 * one already share a single form, a single validator and a single set of refusals, and a
 * name computed separately in each act is exactly how the two would come to disagree about
 * what an absence is.
 *
 * Both dates are in it, so two absences for one resource over DIFFERENT days get different
 * names — `Alice away 1` beside `Alice away 2` is two names that say nothing apart, and a
 * basename is read in the explorer, in search and in a link, none of which has a row beside
 * it to supply the dates. Not "never collides": the same resource over the same days derives
 * the same name, and so does any note already sitting at it, so `uniqueNotePath` still
 * appends a number sometimes — which is why a rename asks it about the note's own path
 * (`self`) rather than assuming the question cannot arise. Every character here survives
 * `sanitizeTitle`, which replaces `\/:*?"<>|#^[]` and leaves the arrow and the hyphens alone.
 *
 * **A hand rename does not survive the next edit**, and that is the accepted cost of the
 * name being a function of the facts rather than a defect: rename the note in Obsidian, edit
 * a date, and it takes the derived name back. The alternative — comparing against the name
 * this would have produced for the OLD facts — is a second rule whose failure mode is a note
 * that silently stops following its own dates.
 */
export function absenceTitle(facts: AbsenceFacts): string {
	return `${facts.resource} away ${facts.start} → ${facts.target}`;
}

/**
 * These stretches grouped into the sub-lanes they can be drawn on — the first holding as
 * many as fit without sharing a day, the next taking what is left, and so on.
 *
 * **This is not the lane-packing extension 4a refused, and the difference is the whole
 * argument.** That refusal's reason was "a packing rule is a second geometry to keep in step
 * with the one the bars use". This returns `Absence[][]` and computes no pixel: it runs over
 * ABSENCES only and never over bars, and calls neither `barGeometry` nor anything that draws.
 *
 * What 4a was protecting is therefore a commitment owed by whatever renders this, not a fact
 * about this function: the drawer must still place every bar by `barGeometry` against the
 * one shared window, unmoved by any absence grouping, and must give two stretches that share
 * a day two sub-lanes rather than hiding or merging either. The drawer is
 * `renderLaneAbsences` in `src/view/render/lanes.ts`, and both halves of that commitment are
 * checked there rather than assumed: each packed mark's own `--pbl-sublane` index in
 * `test/view/resourceAbsences.test.ts`, and the 17px pitch the two stylesheet rules must
 * agree on in `test/view/timelineBoxing.test.ts`. Neither is a fact this function can state,
 * which is why they are named rather than restated here.
 *
 * Greedy FIRST-fit rather than best-fit, deliberately: a long stretch then holds sub-lane 0
 * and everything short slots in beneath it, instead of each new stretch pushing the pile
 * down. The boundary is `crossedAbsences`' — inclusive at both ends — so two that merely
 * touch do not share a line, because one of them would have to lie about the shared day.
 */
export function packAbsences(absences: Absence[]): Absence[][] {
	const sorted = [...absences].sort((a, b) => daysBetween(b.start, a.start));
	const packed: Absence[][] = [];
	for (const absence of sorted) {
		const room = packed.find((sub) => daysBetween(sub[sub.length - 1].target, absence.start) >= 1);
		if (room === undefined) packed.push([absence]);
		else room.push(absence);
	}
	return packed;
}

/**
 * How many of the days this span DRAWS are days its resource is away — the number the row
 * reports beside a bar scheduled across a stretch.
 *
 * Each crossed stretch is clamped to the bar's own days first and the results are UNIONED,
 * never summed: two overlapping stretches must not cost the same day twice, which is the
 * defect this shares its primitive with `awayWeeks` to prevent.
 *
 * `crossedAbsences` decides WHICH stretches count, so the two cannot disagree about whether
 * a bar is affected at all — a row that carries the clash mark and reports zero days lost
 * would be two answers to one question.
 */
export function daysLost(span: DateSpan, absences: Absence[]): number {
	const from = (span.start ?? span.target) as CivilDate;
	const to = (span.target ?? span.start) as CivilDate;
	return unionDays(
		crossedAbsences(span, absences).map((absence) => ({
			start: daysBetween(from, absence.start) > 0 ? absence.start : from,
			target: daysBetween(absence.target, to) > 0 ? absence.target : to,
		})),
	);
}

/**
 * How much of this resource's absence is still AHEAD, in whole weeks rounded UP — the band
 * header's pill.
 *
 * Rounded up because a partial week is still time nobody can be scheduled into, and reported
 * in weeks because a header is scanned rather than read: "3 wk away" answers the question a
 * roster is being looked at to answer, and the exact days are on the stretches themselves.
 *
 * **Clamped at `today`, which is what makes "still" true rather than only intended.** Each
 * pending stretch contributes the days left of it and never the days it has already spent —
 * counted whole, a four-week absence with two days to run reported `4 wk away` and then fell
 * to nothing overnight, which is the number being loudest exactly where it is least true.
 * `isPending` decides WHETHER a stretch counts and this clamp decides FROM WHEN; both are the
 * same inclusive boundary at today, so a stretch ending today is one day rather than none.
 *
 * Only the stretches that have not ended (`isPending`), and their union rather than their
 * sum — `daysLost`'s rule, from the same primitive, so the two numbers on one screen cannot
 * disagree about how long one set of stretches lasts. The clamp is `daysLost`'s too: that one
 * narrows each stretch to the BAR's own days, this one to the days not yet gone.
 */
export function awayWeeks(absences: Absence[], today: CivilDate): number {
	const pending = absences.filter((absence) => isPending(absence, today));
	const ahead = pending.map((absence) => ({
		start: daysBetween(absence.start, today) > 0 ? today : absence.start,
		target: absence.target,
	}));
	return Math.ceil(unionDays(ahead) / 7);
}
