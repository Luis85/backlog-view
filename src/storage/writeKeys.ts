import { AXIS_FIELDS, AxisField, BacklogSettings, OptionalField, optionalKeyFor } from '../domain/settings';
import { AxisWrite, ItemWrite } from '../domain/writePlan';

/**
 * Which frontmatter keys one write touches — the list `applyWrites` captures its
 * inverses from.
 *
 * Beside `frontmatter.ts` rather than in it, and the reason is the rule these functions
 * all state: **a key written but not captured is a change no undo can reach.** Applying
 * and capturing read the SAME list, so it has to be one answer; keeping that answer in
 * its own file is what stops a new optional property being added to the writer and
 * forgotten here.
 */

/** The frontmatter keys this write will touch, in the order they are written. */
export function touchedKeys(settings: BacklogSettings, write: ItemWrite): string[] {
	const keys: string[] = [];
	if (write.removeParentKey || write.parent !== undefined) keys.push(settings.parentKey);
	if (write.order !== undefined) keys.push(settings.orderKey);
	if (write.typeName !== undefined) keys.push(settings.typeKey);
	keys.push(...optionalTouchedKeys(settings, write));
	for (const { key } of axisEntries(settings, write.axis)) keys.push(key);
	for (const key of stubKeys(settings, write.stubs)) keys.push(key);
	// ONLY for the whole-key removal, which is a key write like `removeStateKey` and is
	// captured as one. The add and the entry removals restore as a DELTA, exactly as the
	// tags do — and the tags key is absent here for that same reason. Listing this key
	// for both would have undo put the prior value back AND replay the inverse delta over
	// it, restoring twice.
	return keys;
}

/**
 * The optional-property keys a write touches — each listed only where the property is
 * CONFIGURED, which is the same rule `stubKeys` and `axisEntries` keep and the reason
 * they are all asked separately rather than inline.
 */
function optionalTouchedKeys(settings: BacklogSettings, write: ItemWrite): string[] {
	const keys: string[] = [];
	if ((write.removeStateKey || write.state !== undefined) && settings.stateKey) keys.push(settings.stateKey);
	// Listed whenever the write CARRIES a stamp, including the started date it may
	// decline to write: a key whose value did not change emits no inverse anyway, and
	// listing it is what makes the dates ride the state's own undo.
	if (write.startedDate !== undefined && settings.startedDateKey) keys.push(settings.startedDateKey);
	if (write.finish !== undefined && settings.finishedDateKey) keys.push(settings.finishedDateKey);
	// ONLY for the whole-key removal, which is a key write like `removeStateKey` and is
	// captured as one. The add and the entry removals restore as a DELTA, exactly as the
	// tags do — and the tags key is absent here for that same reason. Listing this key
	// for both would have undo put the prior value back AND replay the inverse delta over
	// it, restoring twice.
	if (write.dependsOn?.removeKey && settings.dependsOnKey) keys.push(settings.dependsOnKey);
	return keys;
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
