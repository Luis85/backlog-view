import { byName } from './nameLookup';

/**
 * Where a new item of each DECLARED type is filed by default, and the home folder those
 * defaults hang from.
 *
 * Its own module because `settings.ts` is at its line cap and this is the block that
 * comes out cleanly: a table of folder names and one function over it, which nothing else
 * in that file reaches for. `stateColors.ts` was split off for the same reason one
 * increment earlier, and the split is by SUBJECT rather than by size — "where does a type
 * file itself" is a question `BacklogSettings` consumes rather than one it is about.
 *
 * The persisted option key stays in `settings.ts` beside the schema that declares it
 * (`typeFolderKey`): a key spelled twice is a key that can differ, and the schema and the
 * resolver both reach for that one and never for this table.
 *
 * `byName` moved to a leaf of its own (`nameLookup.ts`) to make this split possible at
 * all — reaching back into `settings.ts` for it would have been a cycle.
 */

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
 * Null-prototype and read through `byName`, because a type name is user data: `constructor`
 * and `__proto__` all find something inherited off `Object`, and every one of those hits is
 * truthy. The two test entries keep their SPACE — `byName` lowercases and then requires an
 * exact key, so `testSuite` would simply never be found and the type would silently fall
 * through to the home folder.
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
