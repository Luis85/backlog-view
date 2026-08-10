/**
 * The work-item type vocabulary, and where a type's notes are filed.
 *
 * A LEAF module: it imports nothing, which is the whole reason it is one. `byName` used
 * to sit in `settings.ts` with a comment saying it read more naturally in `itemTypes.ts`
 * and could not go there because that module imports this one — a dependency that could
 * not run both ways. Splitting the NAMES out from the settings that carry them dissolves
 * that: `itemTypes.ts` and `settings.ts` both sit above this file, and neither has to sit
 * above the other.
 *
 * What belongs here is what a type IS and where its notes go. What a type MEANS for the
 * ladder — rungs, pinned ranks, markers — is `itemTypes.ts`, one layer up.
 */

/**
 * The work-item vocabulary, fixed. This plugin is opinionated about it on purpose: a
 * configurable ladder means every level rule has to hold for any list a user can type,
 * and the reward was a rename. What it cost was real — collision rules between levels
 * and extra types, defaults that could not be stated for a name nobody chose, and a
 * schema that had to be generated per view.
 *
 * `LEVELS` is the ladder, top to bottom; `EXTRA_TYPES` sit beside it (see `itemTypes.ts`).
 */
export const LEVELS = ['Epic', 'Feature', 'PBI', 'Task'];
/** The Deliverable workflow's own type name, named once so `EXTRA_TYPES` and every
 * `isDeliverableType` call site read the identical string rather than two spellings
 * that can drift. */
export const DELIVERABLE_TYPE = 'Deliverable';
export const EXTRA_TYPES = ['Issue', 'Bug', 'Idea', DELIVERABLE_TYPE];
/**
 * The third category: a declared **marker**. It occupies no rung, holds nothing, and
 * hangs from nothing — the opposite of an extra type on all three counts, which is why
 * the name is here rather than in `EXTRA_TYPES`. That list means *pinned at
 * `EXTRA_TYPE_RANK`, children are Tasks, hangs from an Epic, a Feature or a PBI*
 * (`itemTypes.ts` states it), so adding a marker to it would not extend the contract but
 * falsify it, and `isExtraType` would start meaning two things at four call sites.
 */
export const MARKER_TYPES = ['Milestone'];
/** Every declared type, ladder first — the whole vocabulary in one list. */
export const ALL_TYPES = [...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES];
/**
 * The default mapping, kept as the text the option shows so the shipped default and the
 * parsed one cannot drift: `defaultSettings` parses this very string.
 */
export const DEFAULT_HOME_FOLDER = 'docs';
/**
 * Where each of the DEFAULT types is filed, under the home folder. Only the shipped
 * vocabulary has an opinion — a level someone renames has no default and falls through
 * to the home folder, which is the honest answer for a name this plugin never chose.
 */
const DEFAULT_TYPE_SUBFOLDERS: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, {
	epic: 'requirements',
	feature: 'requirements',
	pbi: 'requirements',
	task: 'tasks',
	issue: 'issues',
	bug: 'bugs',
	idea: 'ideas',
	deliverable: 'deliverables',
	milestone: 'milestones',
});

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
 * It lives here rather than in `itemTypes.ts`, which is where it reads more naturally,
 * because that module imports this one and the dependency cannot run both ways.
 */
export function byName<T>(table: Record<string, T>, name: string | null): T | undefined {
	if (name === null) return undefined;
	const key = name.toLowerCase();
	return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * The persisted option key for one type's folder. Shared by the schema that declares
 * these options and the resolver that reads them back, because a key spelled twice is
 * a key that can differ — and these are user data in the `.base` file.
 */
export function typeFolderKey(typeName: string): string {
	return `typeFolder.${typeName.toLowerCase()}`;
}

/**
 * The shipped folder for a type, under the given home folder, or '' for a type this
 * plugin did not name. Derived from the home folder rather than fixed, so relocating a
 * backlog stays ONE setting even though each type has its own picker: the options are
 * generated per view, so the default in each box follows the home folder above it.
 */
export function defaultTypeFolder(typeName: string, homeFolder = DEFAULT_HOME_FOLDER): string {
	const sub = byName(DEFAULT_TYPE_SUBFOLDERS, typeName);
	if (!sub) return '';
	return homeFolder ? `${homeFolder}/${sub}` : sub;
}
