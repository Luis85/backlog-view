import { TFile } from 'obsidian';
import { CivilDate, ownValue, readDate, readString } from './noteFields';
import { BacklogSettings } from './settings';
import { DateSpan, daysBetween, reversedSpan } from './timeline';

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
