import tsparser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

/**
 * The layers, outermost first. Each may reach anything below it and nothing above:
 *
 *   main → commands → view → storage → domain
 *                       ↘________________↗
 *
 * `ui` is a leaf of reusable Obsidian dialogs that knows about none of them. The
 * rules below are what keep this a fact rather than an aspiration — a layering
 * documented only in prose is one commit away from being wrong.
 */
const forbidden = (layer, groups, reason) => ({
	files: [`src/${layer}/**/*.ts`],
	rules: {
		'no-restricted-imports': [
			'error',
			{ patterns: [{ group: groups.flatMap((g) => [`**/${g}/*`, `**/${g}/**/*`]), message: reason }] },
		],
	},
});

/**
 * The Obsidian ruleset is about *shipped plugin* code, and it is type-aware, which
 * `test/` cannot satisfy: tsconfig.json covers `src/` only, and the test doubles exist
 * precisely to do what those rules forbid — the DOM helper defines `createEl`, the fake
 * vault casts to `TFile`. So the plugin rules stop at `src/`, and `test/` gets the
 * TypeScript baseline plus this repo's own budgets, below.
 */
const pluginRules = obsidianmd.configs.recommended.map((c) => ({ ...c, ignores: [...(c.ignores ?? []), 'test/**'] }));

/**
 * Every mutation of the vault goes through storage/, so the write-safety invariants
 * can be verified by reading one directory instead of trusting every call site. This
 * is the single most important rule in the codebase, which is why it is not prose.
 */
const WRITE_BOUNDARY = [
	{
		selector: "MemberExpression[property.name='processFrontMatter']",
		message: 'All frontmatter writes go through src/storage/frontmatter.ts (applyWrites / createBacklogItem).',
	},
	{
		selector: "CallExpression[callee.property.name='create'][callee.object.property.name='vault']",
		message: 'Creating files in the vault belongs in src/storage/ (createBacklogItem / createBacklogBase).',
	},
	{
		selector: "MemberExpression[property.name=/^(save|load)LocalStorage$/]",
		message: 'Persisted view state goes through src/storage/collapseStore.ts.',
	},
];

/**
 * Enter or Space on a focused button synthesizes a click at (0, 0), so anchoring a
 * menu to the pointer drops it in the viewport corner. This shipped once already.
 */
const MENU_ANCHOR = {
	selector: "MemberExpression[property.name='showAtMouseEvent']",
	message: 'Open menus with showMenuForClick (src/view/interactions/menu.ts) so a keyboard-activated button anchors to its own rect.',
};

/**
 * `model.roots` is the RENDERED forest — synthetic under focus mode, where the top row
 * groups items that are not really siblings. Ranking against it writes an order among
 * rows that only look adjacent.
 */
const RENDERED_ROOTS = {
	selector: "MemberExpression[property.name='roots']",
	message: 'Ranking runs over model.realRoots. model.roots is what is drawn, which under focus mode is not a sibling group.',
};

/**
 * `depth` is VISUAL — focus mode re-roots it — so a level derived from it is a level
 * derived from where a row happens to be drawn. Scoped to the files that decide types:
 * `rows.ts` reads depth for `aria-level`, where visual depth IS the answer.
 */
const VISUAL_DEPTH = {
	selector: "MemberExpression[property.name='depth']",
	message: 'Level math chains down the parent levels (nextLevelIndex / childLevelIndex). depth is visual and focus mode re-roots it.',
};

/**
 * Flat config sets a rule wholesale per file: a narrower block REPLACES the wider one's
 * options rather than adding to them, so two blocks matching the same file would leave
 * it with only the later one's selectors — silently dropping the rest.
 *
 * So the blocks below partition `src/` into regions that do not overlap, and each names
 * every selector that applies to it. Adding a region means removing its files from the
 * one it came out of; adding a selector means asking which regions want it. The
 * `syntaxRules` wrapper exists so that is the only decision, and the shape is uniform.
 */
const STORAGE = 'src/storage/**/*.ts';
const MENU = 'src/view/interactions/menu.ts';
const RANKING = ['src/domain/writePlan.ts', 'src/view/interactions/create.ts'];

const syntaxRules = (selectors) => ({ 'no-restricted-syntax': ['error', ...selectors] });

export default defineConfig([
	{
		ignores: ['main.js', 'node_modules/**', 'esbuild.config.mjs', 'version-bump.mjs', 'vitest.config.ts'],
	},
	...pluginRules,
	forbidden(
		'domain',
		['view', 'storage', 'ui', 'commands'],
		'domain/ is the backlog itself: tree shape, ranking, config. It may read the vault but must not reach the DOM, the writer or the plugin shell — that is what keeps it testable without Obsidian.',
	),
	forbidden(
		'storage',
		['view', 'ui', 'commands'],
		'storage/ persists what it is given. It may use domain types but must not reach into the view or the plugin shell.',
	),
	forbidden('ui', ['view', 'commands', 'domain', 'storage'], 'ui/ holds standalone dialogs; it must stay free of app structure.'),
	forbidden('view', ['commands'], 'The view is mounted by the plugin shell, not the other way round.'),
	// -- invariants that are checked rather than described -----------------------
	// Four disjoint regions of src/; see the note above `syntaxRules`.
	{
		// Everything that is not one of the three special cases below.
		files: ['src/**/*.ts'],
		ignores: [STORAGE, MENU, ...RANKING],
		rules: syntaxRules([...WRITE_BOUNDARY, MENU_ANCHOR]),
	},
	{
		// storage/ IS the writer, so the write boundary cannot apply to it. Nothing else
		// about it is special — the menu rule still does.
		files: [STORAGE],
		rules: syntaxRules([MENU_ANCHOR]),
	},
	{
		// The menu helper is where the anchoring decision is made, so it is the one place
		// allowed to make it. It writes nothing, so the boundary still applies.
		files: [MENU],
		rules: syntaxRules([...WRITE_BOUNDARY]),
	},
	{
		// Ranking code: what it writes is an order among real siblings, and a type is
		// the rung its parent chain puts it on — never the depth it is drawn at.
		files: RANKING,
		rules: syntaxRules([...WRITE_BOUNDARY, MENU_ANCHOR, RENDERED_ROOTS, VISUAL_DEPTH]),
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
		},
		rules: {
			// Un-awaited promises around frontmatter writes silently reorder the vault;
			// force every async call site to await or explicitly void.
			'@typescript-eslint/no-floating-promises': 'error',
			// Size and complexity budgets keep modules focused and reviewable.
			'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 16],
			'max-depth': ['error', 4],
			'max-params': ['error', 5],
		},
	},
	{
		files: ['test/**/*.ts'],
		extends: [tseslint.configs.recommended],
		languageOptions: { parser: tsparser },
		rules: {
			// `src/` had a size budget and `test/` had none, which is how one view suite
			// grew to 59% of all test code while every source file stayed in budget. The
			// cap is looser than src/'s 400 — a test file is mostly fixture setup — and it
			// is there to force a split by subject long before a file becomes the place
			// tests go to hide.
			'max-lines': ['error', { max: 450, skipBlankLines: true, skipComments: true }],
			// The harness deliberately reaches past the view's public surface.
			'@typescript-eslint/no-explicit-any': 'off',
			// A stand-in has to accept the arguments the real API is called with, whether
			// or not the fake reads them; the underscore says so.
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
]);
