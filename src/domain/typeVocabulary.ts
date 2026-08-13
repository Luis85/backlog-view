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
/**
 * The TEST catalog's own ladder — a second one, rooted at a type that hangs from
 * nothing, and the reason `LEVELS` can no longer be read as *the* ladder.
 *
 * It ends on `LEVELS`' own deepest rung, and that sharing is deliberate rather than a
 * coincidence of both ladders wanting a leaf type. Three rules the register argues
 * separately are consequences of it instead of code:
 *
 * - a typeless child of a `Test suite` is a `Test case`, and of a `Test case` a `Task`
 *   — `childLevelIndex` clamping, on the right ladder;
 * - *a `Task` takes its parent's projection, every other type takes its own* IS the
 *   ladder chain, so catalog membership needs no second rule to except one type;
 * - a `Task` whose `Test case` parent is not in the model has no parent ladder to chain
 *   from, so it falls to its own type's — the plan's — with nothing read to find out.
 *
 * `Task` therefore names a rung of BOTH ladders, which is why `ladderFor` decides from
 * the parent for that one name and from the name alone for every other.
 */
export const TEST_LEVELS = ['Test suite', 'Test case', LEVELS[LEVELS.length - 1]];
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
/**
 * The one DECLARED name that is not a work-item type at all — a resource's own
 * unavailable stretch. It joins none of the lists above and, deliberately, not
 * `ALL_TYPES` either: that list is what admits a name everywhere a work item's name
 * matters (`childTypeChoices` offers every entry at the top level, `focusTarget` accepts
 * one as a focus root, the shelf groups by it, the generated README and the in-app manual
 * document it as a declared type), and every one of those is exactly what an absence must
 * refuse. Keeping it out is what makes each of those consumers need NO edit, rather than
 * six exclusions somebody has to remember.
 *
 * It is the opposite POLARITY from a marker on the read, too: a marker is recognized and
 * KEPT — ranked out of the ladder, still a `BacklogItem` — while this is recognized and
 * DROPPED, never read as an item at all. See ADR 0028.
 *
 * Deliberately absent from `DEFAULT_TYPE_SUBFOLDERS`: an absence with no folder of its
 * own falls through to the home folder, which is what the spec asks for and what a type
 * this plugin ships no opinion about already gets.
 */
export const ABSENCE_TYPE = 'Absence';
/**
 * Every declared type, ladder first — the whole vocabulary in one list, and now the one
 * place the two ladders' shared rung is spent exactly once. `TEST_LEVELS` ends on
 * `LEVELS`' deepest rung by construction, so it is filtered against what is already here
 * rather than concatenated: a duplicated `Task` would give the type a second folder
 * option under the same key, two entries in every creator menu, and two shelf groups.
 */
export const ALL_TYPES = [...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES, ...TEST_LEVELS.filter((t) => !LEVELS.includes(t))];
/**
 * The default mapping, kept as the text the option shows so the shipped default and the
 * parsed one cannot drift: `defaultSettings` parses this very string.
 */
export const DEFAULT_HOME_FOLDER = 'docs';
/**
 * Where each of the DEFAULT types is filed, under the home folder. Only the shipped
 * vocabulary has an opinion — a level someone renames has no default and falls through
 * to the home folder, which is the honest answer for a name this plugin never chose.
 *
 * The two test entries keep their SPACE: `byName` lowercases and then requires an exact
 * key, so `testSuite` would simply never be found and the type would fall through to the
 * home folder without anything reporting it.
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
	// The catalog files under one root of its own, one folder per rung — the shape
	// `requirements/` already has for the three types that share it.
	'test suite': 'tests/suites',
	'test case': 'tests/cases',
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
