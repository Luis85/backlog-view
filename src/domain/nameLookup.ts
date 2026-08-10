/**
 * Look a user-supplied type name up in a table keyed by lowercased type name.
 *
 * Type names are user data, so `table[name]` is not safe: `constructor`, `toString`,
 * `valueOf` and `__proto__` all find something inherited from `Object`, and every one of
 * those hits is truthy — so a guard like `if (!found)` passes and a function ends up
 * being used as a folder path or a CSS class. This has now been shipped three times, on
 * three different tables, so it is a function rather than a rule to remember: reach for
 * this instead of a bare index whenever the key came from the user.
 *
 * It lived in `settings.ts` for one reason its own comment gave — `itemTypes.ts`, where it
 * reads more naturally, imports that module and the dependency cannot run both ways. A
 * leaf of its own answers that without choosing between them, and it had to: `typeFolders.ts`
 * needs this too, and importing it back from `settings.ts` made a cycle.
 */
export function byName<T>(table: Record<string, T>, name: string | null): T | undefined {
	if (name === null) return undefined;
	const key = name.toLowerCase();
	return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}
