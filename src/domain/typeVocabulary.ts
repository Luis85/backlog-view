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
export const EXTRA_TYPES = ['Issue', 'Bug', 'Idea', DELIVERABLE_TYPE, 'Improvement'];
/**
 * The second declared marker. Named once, like `DELIVERABLE_TYPE`, so `MARKER_TYPES`
 * reads the same string rather than a second spelling that could drift from it. A
 * predicate reading it by name (`isIterationType`, the same shape as
 * `isDeliverableType`) arrives with its first caller, `Set iteration`.
 */
export const ITERATION_TYPE = 'Iteration';
/**
 * The third category: a declared **marker**. It occupies no rung, holds nothing, and
 * hangs from nothing — the opposite of an extra type on all three counts, which is why
 * the name is here rather than in `EXTRA_TYPES`. That list means *pinned at
 * `EXTRA_TYPE_RANK`, children are Tasks, hangs from an Epic, a Feature or a PBI*
 * (`itemTypes.ts` states it), so adding a marker to it would not extend the contract but
 * falsify it, and `isExtraType` would start meaning two things at four call sites.
 */
/**
 * The first declared marker, named for the same reason `ITERATION_TYPE` is: a surface
 * that captions what it drew names the TYPE, and a type name is data — matched in
 * frontmatter, never translated — so the name has to come from here rather than be
 * spelled a second time beside the swatch that shows it.
 */
export const MILESTONE_TYPE = 'Milestone';
/**
 * The third declared marker, named for the reason the other two are: a surface that
 * captions what it drew names the TYPE, and a type name is data — matched in frontmatter,
 * never translated — so the name lives here rather than being spelled again beside every
 * reader. A release holds no work: membership is a property on the item
 * ([[Releases as their own type]]), which is exactly what makes it a marker and not an
 * extra type.
 */
export const RELEASE_TYPE = 'Release';
export const MARKER_TYPES = [MILESTONE_TYPE, ITERATION_TYPE, RELEASE_TYPE];
/**
 * A person, and the SECOND name recognized in order to be refused — `ABSENCE_TYPE` below
 * states the whole of that polarity and this shares it. A resource is pointed at by the
 * plan and contains none of it, so it is not a work item at any rung, beside any rung, or
 * as a marker: `readItems` drops it before a `BacklogItem` exists, and no projection this
 * plugin draws has to remember to leave it out.
 *
 * **It was a marker for one day and that was wrong.** As a marker it inherited the
 * structural rules correctly — no rung, no children, no parent — and then had to have the
 * DATE questions carved back out of it one surface at a time, because every marker before
 * it was a date. What the carving kept producing was a type that appeared in the tree, in
 * the New menu, in Set type, in the toolbar's count and on the shelf, none of which is
 * where a person belongs. The refusal is one gate instead, and it is the same gate an
 * absence goes through.
 *
 * Out of `MARKER_TYPES`, out of `ALL_TYPES` and out of `DEFAULT_TYPE_SUBFOLDERS`, each for
 * the reason stated at `ABSENCE_TYPE`. Nothing creates one yet: the dedicated resource
 * view does that, and `docs/requirements/Rows from the Resource notes.md` is where the
 * roadmap starts READING them — at this same gate, so the roster still comes from the
 * base's own results and no second read path into the vault is opened.
 *
 * Named once because a type name is data — matched in frontmatter, never translated.
 */
export const RESOURCE_TYPE = 'Resource';
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
	improvement: 'improvements',
	milestone: 'milestones',
	iteration: 'iterations',
	release: 'releases',
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
 * The types the backlog view FILES, and the one list the folder options, their defaults
 * and their resolver are all built from — `ALL_TYPES` minus `Release`, which is the only
 * subtraction and is a statement about which view owns the gesture rather than about the
 * vocabulary. A release is created by the release view alone, which carries its own
 * `releaseFolder` option; a `typeFolder.release` beside it would be a second value naming
 * the same folder, in a view that cannot read the other's configuration. It stays in
 * `ALL_TYPES` — the type vocabulary, the badge table and the release view's own reading
 * are built from that — so the difference between the two lists is "no folder box" rather
 * than "no such type". `Iteration` is deliberately NOT subtracted: no surface offers that
 * type either, but the board's scope picker still files the note it makes by this option.
 *
 * `RESOURCE_TYPE` is absent from both lists and needs no subtraction here; its folder is
 * its own option (see {@link defaultResourceFolder}).
 */
export const FILED_TYPES = ALL_TYPES.filter((type) => type !== RELEASE_TYPE);

/**
 * Every name that gets a `typeFolder.*` box — `FILED_TYPES` plus the absence, which has a
 * folder like any other note this plugin writes and is a type in no other sense.
 *
 * Named here because it was spelled inline at BOTH ends of the same contract: the schema
 * that declares the boxes (`viewOptions.ts`) and the resolver that reads them back
 * (`settingsResolve.ts`), whose own comment asserted *"It is the SAME list the options are
 * declared from"* with nothing checking it — a comment stating a rule, which is the shape
 * this repository keeps finding broken. The rule it states is real and worth keeping: a
 * key resolved with no box to set it is how `typeFolder.release` came to print a folder in
 * the generated README that no release is ever written to. One list is how it holds.
 *
 * Not a widening of `FILED_TYPES`: that list is the work-item vocabulary minus `Release`,
 * and an absence is not a work item at all. This is the FOLDER question asked of both.
 */
export const FOLDER_OPTION_TYPES = [...FILED_TYPES, ABSENCE_TYPE];

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

/** The subfolder a `RESOURCE_TYPE` note is filed under, by default. Private like
 * `DEFAULT_TYPE_SUBFOLDERS` beside it: nothing outside `defaultResourceFolder` needs it. */
const DEFAULT_RESOURCE_SUBFOLDER = 'resources';

/**
 * The shipped folder for a `RESOURCE_TYPE` note, under the given home folder.
 *
 * Not a `typeFolder.<name>` entry: that list is generated one per `ALL_TYPES` member, and
 * `RESOURCE_TYPE` is deliberately never added to `ALL_TYPES` (see its own doc comment
 * above) — the gates that keep it out of the backlog read that list, and joining it would
 * make a resource a work item. Its folder is its own option (`resourceFolder`) instead,
 * resolved the same way a type folder is: derived from the home folder so relocating the
 * backlog moves it too.
 */
export function defaultResourceFolder(homeFolder = DEFAULT_HOME_FOLDER): string {
	return homeFolder ? `${homeFolder}/${DEFAULT_RESOURCE_SUBFOLDER}` : DEFAULT_RESOURCE_SUBFOLDER;
}
