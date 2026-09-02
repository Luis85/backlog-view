import { App } from 'obsidian';
import { CivilDate, linkpathFromRawValue, ownValue, readDate, readString } from '../domain/noteFields';
import { reversedSpan } from '../domain/timeline';
import { BacklogSettings } from '../domain/settings';
import {
	AXIS_FIELDS,
	AxisField,
	OptionalField,
	optionalKeyFor,
	resolvedDeliverableStateKey,
	resolvedTestStateKey,
} from '../domain/optionalProperties';
import { AxisWrite, ItemWrite } from '../domain/writePlan';

/**
 * Which frontmatter keys a write will touch — the question `applyWrites` asks to capture
 * each write's inverse, and the one `missingKeyStubs` asks to create the keys a backfill
 * names.
 *
 * Its own module because `frontmatter.ts` reached its 400-line budget when `risk` and the
 * Deliverable workflow merged into one write path. The seam is not arbitrary: everything
 * here answers "which keys", and everything left behind answers "what value goes in them".
 * Applying and capturing must read the SAME answer, so it belongs in one place either way.
 *
 * {@link plannedAxis} widens that by one word and no more — which of the keys an axis
 * write NAMES it actually lands, asked of the live note. It is here for the same budget
 * reason and it is the same kind of question; what it must never become is a filter on
 * {@link touchedKeys}, which has to keep naming every key the write could touch or a value
 * that did change would have no inverse to undo it with.
 */

/** One axis key a write names, with the value it would put there. */
export interface AxisEntry {
	field: AxisField;
	key: string;
	value: string | null;
}

/**
 * The configured keys one axis write touches, each with the value it will write.
 * Applying and capturing read the SAME list: a key written but not captured would
 * be a change no undo could reach, which is exactly how a hole gets in.
 */
export function axisEntries(settings: BacklogSettings, axis?: AxisWrite): AxisEntry[] {
	if (!axis) return [];
	const entries: AxisEntry[] = [];
	for (const field of AXIS_FIELDS) {
		const key = optionalKeyFor(settings, field);
		const value = axis[field];
		if (key !== '' && value !== undefined) entries.push({ field, key, value });
	}
	return entries;
}

/**
 * The frontmatter keys this write will touch, in the order they are written.
 *
 * Deduped before it returns: the requirements state and the Deliverable state may
 * explicitly share one key (`configProblems`' `WORKFLOW_STATE_LABELS`), and a
 * Deliverable item missing that key gets it named twice by `missingKeyStubs`, once for
 * each field's own gap-check. A duplicate key makes `captureInverse` record the same
 * before/after pair twice, and the second entry reads on `applyRestores` as a conflict —
 * the first has already restored the value, so the compare-and-swap on the second sees
 * something other than what the write wrote — inflating `RestoreOutcome.conflicts` for a
 * restore that fully succeeded. Ordinary (non-exempt) collisions never reach here at
 * all: `configProblems` gates every write while one is reported.
 */
export function touchedKeys(settings: BacklogSettings, write: ItemWrite): string[] {
	const keys: string[] = [];
	if (write.removeParentKey || write.parent !== undefined) keys.push(settings.parentKey);
	if (write.order !== undefined) keys.push(settings.orderKey);
	if (write.typeName !== undefined) keys.push(settings.typeKey);
	if ((write.removeStateKey || write.state !== undefined) && settings.stateKey) keys.push(settings.stateKey);
	// One rule, five-now-eight properties: listed whenever the write TOUCHES the key and a
	// property names it — the same condition each `apply*` writes on, so applying and
	// capturing cannot drift. A key written but not captured is a change no undo could
	// reach; a key whose value did not change emits no inverse anyway, which is what lets
	// the stamps ride the state's own undo. Stated as a list because each such property
	// should add a line here rather than another branch — the assignee did exactly that.
	const carried: [boolean, string][] = [
		// Same RESOLVED keys `applyInto` just wrote: capture and apply must read the same
		// fallback, or a key written under it would have no inverse to undo it with.
		[write.removeDeliverableStateKey || write.deliverableState !== undefined, resolvedDeliverableStateKey(settings)],
		[write.removeTestStateKey || write.testState !== undefined, resolvedTestStateKey(settings)],
		[write.startedDate !== undefined, settings.startedDateKey],
		[write.finish !== undefined, settings.finishedDateKey],
		[write.risk !== undefined, settings.riskKey],
		[write.priority !== undefined, settings.priorityKey],
		[write.assignee !== undefined, settings.assigneeKey],
		[write.iteration !== undefined, settings.iterationKey],
		[write.release !== undefined, settings.releaseKey],
		[write.iterationGoal !== undefined, settings.iterationGoalKey],
		// Not "carries a value": this is the ONLY prerequisite change listed here, for the
		// whole-key REMOVAL alone. The add and the entry removals restore as a DELTA,
		// exactly as the tags do — listing a key for both would have undo put the prior
		// value back AND replay the inverse delta over it, restoring twice.
		[write.dependsOn?.removeKey === true, settings.dependsOnKey],
	];
	for (const [written, key] of carried) if (written && key) keys.push(key);
	for (const { key } of axisEntries(settings, write.axis)) keys.push(key);
	for (const key of stubKeys(settings, write.stubs)) keys.push(key);
	return [...new Set(keys)];
}
/**
 * The configured keys a write's stubs name. Unconfigured fields drop out here, which
 * is the state key's rule applied to the one write that creates keys rather than
 * setting them: never a key no property names. Applying and capturing read this same
 * list, exactly as they do `axisEntries` — a key written but not captured would be a
 * change no undo could reach.
 */
export function stubKeys(settings: BacklogSettings, stubs?: OptionalField[]): string[] {
	if (!stubs) return [];
	return stubs.map((field) => optionalKeyFor(settings, field)).filter((key) => key !== '');
}

/**
 * The axis entries this write actually lands — every one it names, minus what a
 * **fill-only** write withholds against the note as it
 * stands ([ADR 0033](../../docs/adrs/0033-a-stale-rule-is-decided-at-the-writer.md);
 * [[Joining a release dates the work]] 6c). Every other write withholds nothing and lands
 * all of them, which is what keeps overwriting the default for the horizon drag, the
 * timeline resize and the iteration join.
 *
 * Three questions, and each is one only the writer can ask because the answer can change
 * between the row being drawn and the batch landing:
 *
 * - **Is this pick still a join?** A membership another view wrote while the submenu sat
 *   open makes the link write a no-op, and topping the dates up on a note that was already
 *   a member is exactly what extension 2a forbids. Read with the PLANNER's own semantics —
 *   a resolved path with cardinality beside it — because raw text is wrong in both
 *   directions: an alias or a relative spelling of the target reads as a non-match and
 *   tops up a member, and a `release: [R, E]` starting with the target reads as a match
 *   and skips the repair that IS the join.
 * - **Does the note still hold that end?** A readable DATE, never a present key: a
 *   backfilled `start: ''` is what ✨ Assign missing properties leaves behind, and asking
 *   presence would make this write nothing in the vaults most likely to have it.
 * - **Would writing it reverse the span against the end that stands?** In both directions,
 *   and the end that "stands" for the start is the item's own due where it kept one and
 *   the release's otherwise.
 *
 * **Both ends are decided from ONE snapshot, and that is why this is a function rather
 * than a test inside `applyAxis`'s loop.** `AXIS_FIELDS` runs `start` before `target`, so a
 * check written in that loop reads, at `target`, a start it wrote itself one iteration
 * earlier — an undated item joining a past release then takes today as a start, nothing
 * having stood to forbid it, and loses the due against it. That is the precise inverse of
 * extension 4b. Called before `applyLinks` for the same reason `leaving` is: the membership
 * has to be read before the write replaces it.
 */
export function plannedAxis(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
): AxisEntry[] {
	const skip = suppressedAxis(app, fm, settings, write);
	return axisEntries(settings, write.axis).filter((entry) => !skip.has(entry.field));
}

/**
 * Whether a write's membership link still CHANGES the note — the same question
 * {@link plannedAxis} asks as its third, asked for the link itself so a settled race is a
 * true no-op rather than a re-spelling.
 *
 * `applyLinks` writes `wikilinkTo`'s canonical form, and `captureInverse` compares RAW
 * values, so a live `[[Releases/2.4|2.4]]` or a one-element list naming the same note
 * counted as a change: the undo slot went on tidying a spelling nobody asked to tidy. The
 * register already refuses that one field over — `applyAxis` skips an equal civil date
 * rather than rewrite `2026-8-1`, because the spelling on disk is the user's.
 *
 * Only a fill-only join is asked. Every other write lands its link as it always did, and a
 * removal never reaches here: `write.release` is `null` and this returns true, which is
 * what deletes the key.
 */
export function landsMembership(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
): boolean {
	return !write.axis?.fillOnly || stillJoining(app, fm, settings, write);
}

/** Which of them {@link plannedAxis} withholds — see its own comment for the three questions. */
function suppressedAxis(
	app: App,
	fm: Record<string, unknown>,
	settings: BacklogSettings,
	write: ItemWrite,
): ReadonlySet<AxisField> {
	if (!write.axis?.fillOnly) return NO_FIELDS;
	if (!stillJoining(app, fm, settings, write)) return new Set(AXIS_FIELDS);
	const liveStart = liveEnd(fm, settings, 'start');
	const liveTarget = liveEnd(fm, settings, 'target');
	// The due this write COULD land — `null` under an unconfigured key, because `axisEntries`
	// drops that entry and a value nothing will write is not one the start has to be earlier
	// than. Read here rather than at the comparison: a vault naming a start property and no
	// due one asked for scheduling, and suppressing its start against a phantom due left the
	// join with no date at all, which is 4c's own case answered backwards (Codex, PR #242).
	const wanted = optionalKeyFor(settings, 'target') === '' ? null : readDate(write.axis.target).value;
	const skip = new Set<AxisField>();
	if (liveTarget !== null || reversedSpan(liveStart, wanted)) skip.add('target');
	// The due this write LEAVES standing — the item's own where it kept one, otherwise the
	// release's where that one lands. Never a due the line above just suppressed.
	const due = liveTarget ?? (skip.has('target') ? null : wanted);
	if (liveStart !== null || reversedSpan(readDate(write.axis.start).value, due)) skip.add('start');
	return skip;
}

const NO_FIELDS: ReadonlySet<AxisField> = new Set();

/** One end as the note READS right now — absent for an unconfigured key, and for a value no reader accepts. */
function liveEnd(fm: Record<string, unknown>, settings: BacklogSettings, field: AxisField): CivilDate | null {
	const key = optionalKeyFor(settings, field);
	return key === '' ? null : readDate(ownValue(fm, key)).value;
}

/**
 * Whether the membership this write carries would still CHANGE the note — `computeReleaseWrites`'
 * `settled` test asked of the live frontmatter instead of the model: exactly one slot, and
 * it resolves to the file that was picked. Every other shape is a join, including the
 * two-valued key whose first entry names the target, because membership is one value and
 * repairing it is the join.
 */
function stillJoining(app: App, fm: Record<string, unknown>, settings: BacklogSettings, write: ItemWrite): boolean {
	const target = write.release;
	if (!target || !settings.releaseKey) return false;
	const raw = ownValue(fm, settings.releaseKey);
	if (Array.isArray(raw) && raw.length !== 1) return true;
	const scalar: unknown = Array.isArray(raw) ? raw[0] : raw;
	// A link is TEXT, refused for a non-string exactly as `readLinkList` and
	// `membershipTarget` refuse one — a coerced `release: 2.4` would read as a membership
	// here that neither of them sees.
	const text = typeof scalar === 'string' ? readString(scalar) : null;
	if (text === null) return true;
	return app.metadataCache.getFirstLinkpathDest(linkpathFromRawValue(text), write.file.path)?.path !== target.path;
}
