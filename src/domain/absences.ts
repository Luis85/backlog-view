import { App, CachedMetadata, TFile } from 'obsidian';
import { CivilDate, LinkEntry, ownValue, readDate, readFirstLinkEntry } from './noteFields';
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
	/**
	 * The resource this stretch names — a link, read exactly as an item's own assignee is
	 * (`readFirstLinkEntry`, the same field on the same key), and matched against a row by
	 * the note it RESOLVES to (`deriveLanes`, `domain/roadmap.ts`) rather than by any name
	 * either side spells. Unresolved is a real value here and not a defect: a stale rename,
	 * a resource note that left the base's results, or a hand-typed value that is not a
	 * link at all all draw nowhere, the same one-answer-three-cases rule `placeAssigned`
	 * already keeps for a work item's own assignee.
	 */
	resource: LinkEntry;
	start: CivilDate;
	target: CivilDate;
}

/**
 * The two DATES an absence note is asked for — what names it, minus the resource, which
 * is no longer a field here (see `absenceTitle` below for why it moved to that
 * function's own second argument).
 *
 * Here rather than in `storage/`, where it was declared until 2026-08-14: it is what an
 * absence IS CALLED, this layer is where that is defined, and `domain/` may not import
 * `storage/` to reach one. `AbsenceSpec` in `src/storage/absenceNotes.ts` does NOT extend
 * this any more (Task 6) — that one carries the resource as an already-resolved `TFile`,
 * because by the time a spec exists the resource has been chosen from the roster and
 * there is no unresolved case left to represent.
 */
export interface AbsenceFacts {
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
	app: App,
	file: TFile,
	cache: CachedMetadata | null,
	settings: BacklogSettings,
): Absence | null {
	if (!absencesConfigured(settings)) return null;
	const resource = readFirstLinkEntry(app, file, cache, settings.assigneeKey);
	if (resource === null) return null;
	// `resolveParent`'s own shape (`noteFields.ts`): derived from the cache already in
	// hand rather than taken as a fourth reading of it, which is what let the caller's
	// param count stay under the lint budget without a bundled object to carry it.
	const fm = cache?.frontmatter;
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
 * What an absence note is CALLED — the dates it holds, plus a caller-supplied LABEL for
 * who it names, so recording one asks for a resource and the dates and nothing else.
 *
 * **The label is not a fact about the absence**, which is why it is a second argument
 * rather than a field on `AbsenceFacts` alongside the dates: it is the collision-aware
 * name `namedTargets` gives the resource (`domain/readItems.ts`, read through
 * `BacklogModel.resourceLabels` — see `resourceLabelsOf`), the same disambiguation every
 * other surface that names a resource to the reader goes through — the assignee chip, the
 * roadmap's lane headers, `Set iteration`. Two `Resource` notes sharing a basename in
 * different folders (`Team/Alex.md`, `Support/Alex.md`) derived the identical name here
 * until this label existed, so a reader could not tell whose absence an Explorer entry
 * was even from the note's own title. This function stays pure and stays here rather than
 * taking the model itself: it does one string, and the roster walk that produces a label
 * belongs where every other reader of it already goes.
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
 * `sanitizeTitle`, which replaces `\/:*?"<>|#^[]` and leaves the arrow and the hyphens alone
 * — including a label carrying a `/` for a collision, which is filed as `Support-Alex away
 * …` rather than refused or nested into a folder.
 *
 * **A hand rename does not survive the next edit**, and that is the accepted cost of the
 * name being a function of the facts rather than a defect: rename the note in Obsidian, edit
 * a date, and it takes the derived name back. The alternative — comparing against the name
 * this would have produced for the OLD facts — is a second rule whose failure mode is a note
 * that silently stops following its own dates.
 *
 * **The label widens that cost, and it is worth saying plainly rather than glossing over
 * it: the derived name is no longer a function of the two dates and the roster alone stays
 * fixed.** Add or remove a SECOND resource sharing this one's basename, touch nothing about
 * this absence, and the label — and so the name this function derives for the identical
 * dates — changes underneath it. That is a real weakening of "renaming the note and then
 * editing a date takes the derived name back", because the roster the label depends on can
 * itself move between those two edits. Paid anyway: an ambiguous filename — two notes an
 * Explorer entry, a search result or a link cannot tell apart — is a worse failure than a
 * name that re-derives differently after a roster change, and the collision case is exactly
 * the one a reader most needs the name to resolve.
 */
export function absenceTitle(facts: AbsenceFacts, label: string): string {
	return `${label} away ${facts.start} → ${facts.target}`;
}

/**
 * The sub-lane each drawn box goes on: the first line holding as many as fit without
 * overlapping, the next taking what is left, and so on. One index per box, in the order
 * given.
 *
 * **It packs the boxes the marks are DRAWN as, and that is the whole of what makes it
 * right.** Its predecessor grouped the absences by their civil DATES, which is the same
 * answer only while a day's width is what separates two marks — and twice it is not. A
 * stretch wholly past the window draws at the EDGE rather than at its dates, so two months
 * apart are one rectangle; and every mark is floored at `MIN_BAR_PX`, so at quarter zoom two
 * one-day stretches on consecutive dates are 4px wide and 2px apart. Both share no day, both
 * were given one line, and in both the later mark covered the earlier — taking its tooltip
 * and the only route to Edit and Delete with it. The first was patched at the drawing loop
 * with a line reserved per clamped mark; the second arrived anyway, which is what says the
 * patch was at the wrong level. Days and pixels disagree wherever the pixels are not a
 * function of the days alone, and only the pixels can answer which marks overlap.
 *
 * **This is still not the lane-packing extension 4a refused, and it is now a better answer
 * to it than the day pack was.** That refusal's reason was "a packing rule is a second
 * geometry to keep in step with the one the bars use" — and this reads `barGeometry`'s own
 * output through the very helper that writes the mark's `--pbl-bar-left` and
 * `--pbl-bar-width` (`spanBox` in `src/view/render/lanes.ts`), so there is no second
 * geometry to keep in step. It runs over absences and never over bars, and moves no bar: the
 * commitment 4a protects is that every bar is placed by `barGeometry` against the one shared
 * window, unmoved by any absence grouping, and that two stretches that would overlap get two
 * sub-lanes rather than one hiding the other. Both halves are checked at the drawer rather
 * than assumed here — each mark's own `--pbl-sublane` in
 * `test/view/resourceAbsences.test.ts`, and the 17px pitch the two stylesheet rules must
 * agree on in `test/view/timelineBoxing.test.ts`.
 *
 * Greedy FIRST-fit, so a long stretch holds line 0 and the short ones slot in beneath it
 * rather than each new one pushing the pile down. That tightness is the CALLER's ordering,
 * not this function's: give it boxes sorted by `left`. The assignment is valid whatever the
 * order — `Math.max` keeps each line's end honest — but an unsorted list may spend lines it
 * did not need. Ends are exclusive, so two boxes that merely touch share a line; that is the
 * pixel reading of the day pack's own rule, where two stretches sharing a day did not.
 */
export function packLanes(boxes: readonly { left: number; right: number }[]): number[] {
	const ends: number[] = [];
	return boxes.map((box) => {
		let line = ends.findIndex((end) => end <= box.left);
		if (line < 0) line = ends.push(0) - 1;
		ends[line] = Math.max(ends[line], box.right);
		return line;
	});
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
