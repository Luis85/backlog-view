import { AXIS_FIELDS, AxisField, BacklogSettings, OptionalField, optionalKeyFor, resolvedDeliverableStateKey } from '../domain/settings';
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
 * Whether a write carries a Deliverable-state change, set or removed. Its own function
 * to keep `touchedKeys` inside the complexity budget — inlined, the pair of branches
 * puts it at 17 against a cap of 16.
 */
function deliverableStateWritten(write: ItemWrite): boolean {
	return write.removeDeliverableStateKey || write.deliverableState !== undefined;
}
/** The frontmatter keys this write will touch, in the order they are written. */
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

export function touchedKeys(settings: BacklogSettings, write: ItemWrite): string[] {
	const keys: string[] = [];
	if (write.removeParentKey || write.parent !== undefined) keys.push(settings.parentKey);
	if (write.order !== undefined) keys.push(settings.orderKey);
	if (write.typeName !== undefined) keys.push(settings.typeKey);
	if ((write.removeStateKey || write.state !== undefined) && settings.stateKey) keys.push(settings.stateKey);
	// Same resolved key `applyInto` just wrote: capture and apply must read the SAME
	// fallback, or a key written under it would have no inverse to undo it with.
	const deliverableStateKeyTouched = resolvedDeliverableStateKey(settings);
	if (deliverableStateWritten(write) && deliverableStateKeyTouched) keys.push(deliverableStateKeyTouched);
	// One rule, three properties: listed whenever the write CARRIES a value and a property
	// names the key — the same condition each `apply*` writes on, so applying and capturing
	// cannot drift. A key written but not captured is a change no undo could reach; a key
	// whose value did not change emits no inverse anyway, which is what lets the stamps
	// ride the state's own undo. Stated as a list because a fourth such property should
	// add a line here rather than another branch.
	const carried: [boolean, string][] = [
		[write.startedDate !== undefined, settings.startedDateKey],
		[write.finish !== undefined, settings.finishedDateKey],
		[write.risk !== undefined, settings.riskKey],
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
