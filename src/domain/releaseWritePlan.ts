import { TFile } from 'obsidian';
import { PropertyWrite } from './estimationWritePlan';
import { CivilDate, sameValue } from './noteFields';
import { formatCivil } from './timeline';
import { RELEASE_TYPE } from './typeVocabulary';

/**
 * What editing a release's own fields WOULD write — the release view's planner, and the
 * whole of the decision that view makes about a note that already exists.
 *
 * It plans the same `PropertyWrite` batches the estimation view does, because they are the
 * same shape of change: plain key/value sets on one note, applied by
 * `storage/propertyWrite.ts`, which captures each write's inverse so the shared undo slot
 * can take it back. The TYPE is imported from `domain/estimationWritePlan.ts` rather than
 * moved somewhere neutral, and that is a deliberate debt rather than an oversight: that
 * module's own header states the "a type belongs with the code that PRODUCES it" rule, and
 * with a second producer the honest home is a leaf neither view owns. Moving it is six
 * files of churn for a name; it is worth paying when a third producer arrives, and this
 * sentence is what stops the reason being lost in the meantime.
 *
 * Nothing here reads a note. Both planners are handed the value the row already carries
 * (`ReleaseRow`'s own figure, read once by `releaseIndex`) and answer what to write —
 * which is what keeps the "same value writes nothing" rule out of the view and out of the
 * writer, where two copies of it would be two answers to one question.
 */

/**
 * One key set on one release, or NOTHING. An empty batch is the honest answer to three
 * different questions and the gate treats all three alike — `applySafely` returns on
 * `writes.length === 0` before it touches the lock, so no undo slot is spent and no
 * refresh is triggered:
 *
 * - the key is unconfigured, which is never written to (the rule `applyPropertyWrites`
 *   keeps at the writer and this keeps at the plan, so a plan never CLAIMS a write the
 *   writer would drop);
 * - the value is what the note already holds, so there is nothing to change;
 * - the value is being cleared from a note that carries nothing under that key.
 *
 * `value: null` REMOVES the key rather than blanking it — `PropertySet`'s own contract,
 * and the rule [[Releases as their own type]] 3b makes necessary here: an empty string is
 * UNREADABLE to this view's own reader, so a cleared field written as `''` would come back
 * as somebody's mistake rather than as an unset field.
 */
function fieldWrite(file: TFile, key: string, value: string | null): PropertyWrite[] {
	// `requiresType` on every write this module plans: these three fields belong to a
	// RELEASE, and the note may have been retyped between the menu opening and the pick —
	// a window nothing upstream can see. See `PropertyWrite.requiresType` for what the
	// writer does with it, and why the common `status`-sharing configuration is what makes
	// this more than defensive.
	return key === '' ? [] : [{ file, sets: [{ key, value }], requiresType: RELEASE_TYPE }];
}

/**
 * Picking a status: the value, or null to take the key off.
 *
 * The no-op comparison is `sameValue` — case-insensitive — which is the rule every other
 * pick in this plugin keeps ("a re-pick of the horizon an item already holds plans
 * nothing, case-insensitively"). The consequence worth knowing: a note holding `planned`
 * where the vocabulary declares `Planned` is already AT that status, so picking it writes
 * nothing rather than rewriting the note to the declared casing. That is the same trade
 * the horizon and the state menus make — a write nobody asked for is worse than a casing
 * nobody sees — and it is why the menu's checkmark asks this planner rather than comparing
 * beside it.
 */
export function releaseStatusWrites(
	file: TFile,
	key: string,
	current: string | null,
	pick: string | null,
): PropertyWrite[] {
	if (pick === null && current === null) return [];
	if (pick !== null && current !== null && sameValue(current, pick)) return [];
	return fieldWrite(file, key, pick);
}

/**
 * Recording the day a release actually shipped: the date the reader picked, or null when
 * they emptied the field.
 *
 * `current` is the date the note STATES, and the comparison is against its own canonical
 * spelling (`formatCivil`) rather than against the raw value — which is what keeps a note
 * holding `2026-9-1` from being rewritten as `2026-09-01` by a reader who opened the
 * dialog and confirmed. Re-confirming a date must not be a write, the rule
 * `computeScheduleWrites` states for the roadmap's own two ends.
 *
 * An UNREADABLE released date reaches this as `null`, exactly as an absent one does — and
 * that is why the control that opens the dialog is withheld for it (`renderScope.ts`): the
 * two are the same input here and must not be the same offer, or clearing a broken value
 * would look available and write nothing.
 */
export function releaseReleasedWrites(
	file: TFile,
	key: string,
	current: CivilDate | null,
	entry: string,
): PropertyWrite[] {
	const next = entry.trim() === '' ? null : entry.trim();
	const held = current === null ? null : formatCivil(current);
	if (next === held) return [];
	return fieldWrite(file, key, next);
}

/**
 * Editing a description: the trimmed text, or null when the reader emptied the box.
 *
 * Compared EXACTLY, not through `sameValue`, and the difference from the status above is
 * the difference between a label and prose: `Fix the typo` and `fix the typo` are one
 * status and two descriptions. Trimmed on the way in, so trailing whitespace alone is not
 * an edit and a box holding only spaces clears the key.
 */
export function releaseDescriptionWrites(
	file: TFile,
	key: string,
	current: string | null,
	text: string,
): PropertyWrite[] {
	const next = text.trim() === '' ? null : text.trim();
	// ONE comparison, where the status above needs two: `next === current` already answers
	// the both-null case here, since neither side has been through `sameValue`. A second
	// line for it was unreachable and is not defensive — an unreachable branch is a claim
	// nothing can check.
	if (next === current) return [];
	return fieldWrite(file, key, next);
}

/**
 * Whether a batch names a key the CURRENT settings no longer give this view to edit — the
 * question `ReleaseView.applyRelease` asks before it hands anything to the gate.
 *
 * Every planner above is handed a key CAPTURED when its control was drawn, which is the
 * rule the root guide states for a move's own vocabulary: read it before the await, or a
 * dialog left open while the `.base` is re-pointed writes the reader's text to a property
 * they never saw. What that capture cannot answer is whether the captured key is still one
 * of THIS view's, and the gap between the two is a real corruption (found by review, PR
 * #211): with `descriptionProperty` aliasing `typeProperty`, `releaseNoteProblems` blocks
 * every write — so the reader opens the dialog, fixes the collision while it is open, and
 * submits into a configuration the gate now calls clean, carrying a key that is the TYPE
 * key. The release loses its type and disappears from its own view, which is PR #203's
 * corruption arriving through the one door that fix did not cover.
 *
 * Stated as a WHITELIST rather than as "does it collide", and that is what makes it hold
 * for a fourth field nobody has written yet: this view edits three roles, a batch may name
 * nothing else, and a key that has stopped being one of the three is by definition a key
 * this view was not given. It refuses the harmless case with the dangerous one — the
 * description property merely re-pointed at some unrelated key, where the old write would
 * land somewhere nothing reads — and refusing there is the better answer anyway: the
 * reader retypes into a box that now names the property they configured.
 *
 * An unconfigured key never enters the set, so a batch naming one is refused here before
 * `applyPropertyWrites` drops it. Both are right; this one is loud.
 *
 * Answers the offending KEY rather than a flag, because the refusal names it: a reader told
 * only that something was wrong has to guess which of three editors to reopen.
 */
export function reconfiguredKey(
	settings: { statusKey: string; descriptionKey: string; releasedDateKey: string },
	writes: PropertyWrite[],
): string | null {
	const editable = new Set([settings.statusKey, settings.descriptionKey, settings.releasedDateKey].filter((k) => k !== ''));
	for (const write of writes) for (const set of write.sets) if (!editable.has(set.key)) return set.key;
	return null;
}
