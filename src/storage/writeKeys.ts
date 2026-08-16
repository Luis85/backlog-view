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
 */

/**
 * The configured keys one axis write touches, each with the value it will write.
 * Applying and capturing read the SAME list: a key written but not captured would
 * be a change no undo could reach, which is exactly how a hole gets in.
 */
export function axisEntries(
	settings: BacklogSettings,
	axis?: AxisWrite,
): { field: AxisField; key: string; value: string | null }[] {
	if (!axis) return [];
	const entries: { field: AxisField; key: string; value: string | null }[] = [];
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
	// One rule, five-now-seven properties: listed whenever the write TOUCHES the key and a
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
