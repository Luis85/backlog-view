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
/**
 * Anchored on `**\/` rather than on the repository root: every `files`/`ignores` pattern is
 * matched against the LINTER's base path, and an editor's ESLint server need not put that
 * where the CLI does. A test excluded by `test/**` alone is only excluded when it is —
 * otherwise the type-aware rules meet a file the tsconfig does not cover.
 */
const TESTS = '**/test/**';

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
const pluginRules = obsidianmd.configs.recommended.map((c) => ({ ...c, ignores: [...(c.ignores ?? []), TESTS] }));

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
 * `board.ts` states its own guarantee in a comment: "Nothing that PLANS a write
 * imports this" — a WIP limit is display math over a count, never a refusal, which is
 * the cheapest guarantee a limit can make (`docs/requirements/WIP limits.md`). This
 * guards `overBy` itself, not limits in general: `settings.wipLimits` stays reachable
 * from every planner, since every planner takes `BacklogSettings` whole — only the
 * derived "how far over" belongs to the chrome that draws it.
 */
const OVERBY = {
	selector: "ImportSpecifier[imported.name='overBy']",
	message:
		'overBy (src/domain/board.ts) is the board column’s over-limit display math, imported only by src/view/render/ where it is drawn. A limit refuses nothing, and a planner that cannot see overBy cannot start consulting one.',
};

/**
 * `ALL_TYPES` is the whole type vocabulary; a projection offers only the types it can
 * show (`offerableTypes`, src/view/interactions/menu.ts) — the requirements board
 * withholds Deliverable, the Deliverables board withholds everything else. Reading
 * `ALL_TYPES` straight anywhere else in view/ is how a sixth type-offering surface
 * arrives at the same bug the first four did (see the doc comment on `offerableTypes`).
 * Scoped to view/, not domain/: `ALL_TYPES` is the correct thing for domain code
 * (settings, shelf grouping, the README table, `childTypeChoices` itself) to name.
 *
 * This selector sees the name `ALL_TYPES` entering a file as a named import —
 * including a renamed one (`import { ALL_TYPES as AT }`, since it is `imported.name`
 * being matched, not `local.name`) — but not a namespace import: `import * as settings
 * from '../../domain/settings'; settings.ALL_TYPES` never creates an `ImportSpecifier`
 * at all, and closing that needs type information (is `settings` really that module?)
 * this invariant is not worth building, the same trade `TREE_SCAN` states for its own
 * receiver. `childTypeChoices(null)` (`src/domain/itemTypes.ts`) is a second, narrower
 * route to the exact same array with no import to catch — `CHILD_TYPE_CHOICES_NULL`,
 * below, bans that call directly rather than trying to trace a return value back to
 * the name it came from.
 */
const ALL_TYPES_IMPORT = {
	selector: "ImportSpecifier[imported.name='ALL_TYPES']",
	message:
		'Route through offerableTypes (src/view/interactions/menu.ts) instead of importing ALL_TYPES — the whole type vocabulary is not what a given projection can show.',
};

/**
 * `childTypeChoices(null)` — the "what may go at top level" case in
 * `src/domain/itemTypes.ts` — returns `ALL_TYPES` itself, unfiltered, so it is a second
 * way for a view file to reach the whole vocabulary without ever importing that name
 * (see `ALL_TYPES_IMPORT`, above, which this selector sits beside rather than replaces
 * — an import of the name is still worth catching at the point it enters a file). Every
 * view/ call site passes the item whose children are being offered
 * (`buildItemMenu`/`showItemMenu`'s `childTypes`, `renderRow`'s add button); none has a
 * reason to ask the top-level question, which is the toolbar's own and already goes
 * through `offerableTypes` instead. `backlogReadme.ts` calls it with `null` on purpose
 * (a type with no declared parent reads as a root in the generated table) and is
 * domain/, not view/, so it is out of this selector's scope the same way `settings.ts`
 * is out of `ALL_TYPES_IMPORT`'s.
 */
const CHILD_TYPE_CHOICES_NULL = {
	selector: "CallExpression[callee.name='childTypeChoices'][arguments.0.value=null]",
	message:
		'childTypeChoices(null) returns the unfiltered ALL_TYPES vocabulary. Pass the item whose children are being offered, or route through offerableTypes (src/view/interactions/menu.ts) for the top-level case.',
};

/**
 * The tree element is the container; querying it is a walk of every rendered row to
 * find something the view already has by reference (`rowEls`, the selected row, the
 * drag source). A full-tree `querySelectorAll` on every `dragend` shipped once. The
 * ban is on the RECEIVER, not on a directory: every legitimate query in `src/` narrows
 * to a row, a column or the toolbar first, so none of them names `treeEl` and none
 * needs an exemption. It sees the receiver's SPELLING — dotted (`this.els.treeEl`),
 * bare (`treeEl`) and computed (`this.els['treeEl']`, a Literal with no `.name`, which
 * is why the third alternative reads `object.property.value`) — but not an alias:
 * `const el = this.els.treeEl; el.querySelectorAll(...)` passes, and closing that needs
 * type information about the receiver, which is a bigger tool than this invariant is
 * worth.
 *
 * The alternation has to be GROUPED. `All?` makes only the trailing `l` optional, so
 * `/^querySelectorAll?$/` matches `querySelectorAl` and `querySelectorAll` and never
 * plain `querySelector` — it let every single-element query through, and lint stayed
 * green on a planted one. Ordinary regex semantics, not an esquery quirk.
 */
const TREE_SCAN = {
	selector:
		"MemberExpression[property.name=/^querySelector(All)?$/]:matches([object.name='treeEl'], [object.property.name='treeEl'], [object.property.value='treeEl'])",
	message:
		'Reach rows through the rowEls index (or the element already held) — querying treeEl walks every rendered row.',
};

/**
 * Which workflow tracks an item is a property of its TYPE, not of whoever is asking —
 * `ownWorkflowReading` (`src/domain/board.ts`) states that once, so the chip
 * (`render/columns.ts`) and the menu (`interactions/menu.ts`) cannot go back to two
 * hand-written `isDeliverableType(item) ? deliverable : requirements` ternaries, which
 * is how they came to disagree in the first place. Banned everywhere in view/ except
 * the two files that read one workflow's raw fields ON PURPOSE, by BOARD rather than by
 * item type — a different question from the chip's and the menu's: `cardMoves.ts`
 * (`performDeliverablesBoardMove` already knows which board's move it is performing)
 * and `render/board.ts` (whose `doneOf` is the Deliverables board's own workflow,
 * never asked per item).
 *
 * Sees the DOTTED member read (`item.deliverableStateValue`, `item.deliverableDone`) —
 * the spelling both past disagreements were. A computed or destructured read
 * (`item['deliverableDone']`, `const { deliverableDone } = item`) needs type
 * information about the receiver to close, the same trade `TREE_SCAN` states for an
 * aliased one.
 */
const DELIVERABLE_FIELD_READ = {
	selector: "MemberExpression[property.name=/^(deliverableStateValue|deliverableDone)$/]",
	message:
		'Read ownWorkflowReading(item) (src/domain/board.ts) instead of hand-picking deliverableStateValue/deliverableDone by type — that ternary is how the chip and the menu came to disagree.',
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
// Ranking code lives in one domain file and one view file; split so a view-only rule
// (ALL_TYPES_IMPORT) can apply to the latter without reaching into domain/.
const RANKING_DOMAIN = ['src/domain/writePlan.ts'];
const RANKING_VIEW = ['src/view/interactions/create.ts'];
const RANKING = [...RANKING_DOMAIN, ...RANKING_VIEW];
const RENDER = 'src/view/render/**/*.ts';
// The Deliverables board's own workflow read, exempt from DELIVERABLE_FIELD_READ —
// carved out of RENDER the same way RANKING_VIEW was carved out of RANKING, because a
// rule applies to the rest of the region and not to this one file.
const RENDER_BOARD = 'src/view/render/board.ts';
// The rest of view/, once menu.ts, render/ and create.ts are carved out below.
const VIEW = 'src/view/**/*.ts';
// The card-move orchestration, exempt from DELIVERABLE_FIELD_READ for the same reason
// RENDER_BOARD is: carved out of VIEW, not out of RENDER, because this file sits in the
// "rest of view/" region.
const CARD_MOVES = 'src/view/cardMoves.ts';

const syntaxRules = (selectors) => ({ 'no-restricted-syntax': ['error', ...selectors] });

export default defineConfig([
	{
		// Everything that is not this plugin's source. The build scripts are Node, not
		// plugin code, so the Obsidian ruleset does not apply to them; `.obsidian/` is a
		// test-build vault (vendored plugin bundles), `.harness/` is the browser page
		// `npm run harness` bundles, `.claude/` is agent tooling. They
		// were only invisible while `lint` named `src test` — an editor lints the whole
		// tree, and a type-aware rule on a file outside tsconfig crashes the run.
		ignores: [
			'main.js',
			'node_modules/**',
			'coverage/**',
			'dist/**',
			'.obsidian/**',
			'.harness/**',
			'.claude/**',
			'docs-check.mjs',
			'eslint.config.mjs',
			'esbuild.config.mjs',
			'harness.mjs',
			'styles-assemble.mjs',
			'test-build.mjs',
			'version-bump.mjs',
			'vitest.config.mts',
		],
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
	// Disjoint regions of src/; see the note above `syntaxRules`. Two splits are one
	// region divided along the view/ boundary — the general region and RANKING, split
	// because ALL_TYPES_IMPORT and CHILD_TYPE_CHOICES_NULL apply to the view/ half and
	// would be false positives on the other (domain code legitimately names ALL_TYPES —
	// settings.ts, shelf.ts, itemTypes.ts, backlogReadme.ts, model.ts — and
	// backlogReadme.ts legitimately calls childTypeChoices(null)). Two more splits are
	// narrower still, one file carved out of an otherwise-uniform region: RENDER_BOARD
	// out of RENDER and CARD_MOVES out of VIEW, both exempt from DELIVERABLE_FIELD_READ
	// because each reads one workflow's raw fields by BOARD rather than by item type —
	// a different question from the one every other view/ file is asking.
	{
		// Everything that is not view/ and not one of the other special cases: domain/,
		// storage/, ui/, commands/, main.ts.
		files: ['src/**/*.ts'],
		ignores: [STORAGE, VIEW, ...RANKING_DOMAIN],
		rules: syntaxRules([...WRITE_BOUNDARY, MENU_ANCHOR, OVERBY, TREE_SCAN]),
	},
	{
		// storage/ IS the writer, so the write boundary cannot apply to it. Nothing else
		// about it is special — the menu rule and the overBy rule still do.
		files: [STORAGE],
		rules: syntaxRules([MENU_ANCHOR, OVERBY, TREE_SCAN]),
	},
	{
		// The menu helper is where the anchoring decision is made, so it is the one place
		// allowed to make it. It writes nothing and plans nothing, so both other rules hold.
		// It is also the one place allowed to read ALL_TYPES straight — offerableTypes'
		// own default parameter — which is why it is the exemption from ALL_TYPES_IMPORT
		// rather than a fifth place carrying it. It asks Set state's own question — which
		// workflow does THIS item track — so DELIVERABLE_FIELD_READ applies here like
		// everywhere else that is not RENDER_BOARD or CARD_MOVES.
		files: [MENU],
		rules: syntaxRules([...WRITE_BOUNDARY, OVERBY, TREE_SCAN, DELIVERABLE_FIELD_READ]),
	},
	{
		// Ranking code, domain half: what it writes is an order among real siblings, and
		// a type is the rung its parent chain puts it on — never the depth it is drawn
		// at. It plans writes, which is exactly what overBy must stay out of. No
		// ALL_TYPES_IMPORT: this file is domain/, not view/.
		files: RANKING_DOMAIN,
		rules: syntaxRules([...WRITE_BOUNDARY, MENU_ANCHOR, RENDERED_ROOTS, VISUAL_DEPTH, OVERBY, TREE_SCAN]),
	},
	{
		// Ranking code, view half: the same rules as the domain half, plus
		// ALL_TYPES_IMPORT, CHILD_TYPE_CHOICES_NULL and DELIVERABLE_FIELD_READ — this file
		// offers types (`promptCreateItem`'s callers) like any other view/ module, and
		// asks the chip's and the menu's question rather than RENDER_BOARD's or
		// CARD_MOVES'.
		files: RANKING_VIEW,
		rules: syntaxRules([
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			RENDERED_ROOTS,
			VISUAL_DEPTH,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
		]),
	},
	{
		// view/render/, minus RENDER_BOARD (its own block below): draws the column, never
		// plans a write, so it is the one region allowed to import overBy. The write
		// boundary and the menu-anchor rule still apply — nothing here is exempt from
		// those, only from OVERBY. It offers types on the toolbar, so ALL_TYPES_IMPORT and
		// CHILD_TYPE_CHOICES_NULL apply here too, and so does DELIVERABLE_FIELD_READ — the
		// chip (`columns.ts`) is exactly the surface that must not hand-pick the raw
		// fields itself.
		files: [RENDER],
		ignores: [RENDER_BOARD],
		rules: syntaxRules([
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
		]),
	},
	{
		// The Deliverables board's own render, carved out of RENDER: `doneOf` reads
		// `item.deliverableDone` directly because this board only ever draws Deliverable
		// cards — it is the board's workflow, not a per-item type dispatch, so
		// DELIVERABLE_FIELD_READ does not apply here. Everything else RENDER carries does.
		files: [RENDER_BOARD],
		rules: syntaxRules([...WRITE_BOUNDARY, MENU_ANCHOR, TREE_SCAN, ALL_TYPES_IMPORT, CHILD_TYPE_CHOICES_NULL]),
	},
	{
		// The rest of view/ — everything under it once menu.ts, render/, create.ts and
		// cardMoves.ts (handled above and below) are carved out. Same rules the general
		// region has, plus ALL_TYPES_IMPORT and CHILD_TYPE_CHOICES_NULL (any of these
		// files is a candidate sixth type-offering surface) and DELIVERABLE_FIELD_READ
		// (any of these files is a candidate third hand-written workflow ternary).
		files: [VIEW],
		ignores: [MENU, RENDER, ...RANKING_VIEW, CARD_MOVES],
		rules: syntaxRules([
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
		]),
	},
	{
		// Card-move orchestration, carved out of VIEW: `performDeliverablesBoardMove`
		// reads `item.deliverableStateValue` directly because the METHOD already says
		// which board's move this is — a call that has already chosen the workflow, not
		// one dispatching on the item's type. Everything else VIEW carries does apply.
		files: [CARD_MOVES],
		rules: syntaxRules([
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
		]),
	},
	{
		// Everything but `test/`, rather than `src/**` by name: a `files` pattern is
		// matched against the LINTER's base path, so a run whose working directory is not
		// this one — which is what an editor's ESLint server may be — matches this block
		// on none of its files, leaving the Obsidian ruleset's type-aware rules to run
		// with no type information at all. That is the "unsafe assignment of an error
		// typed value" on a file `tsc` compiles cleanly. Nothing else in the repository
		// is a `.ts` file, so the set is the same one either way.
		files: ['**/*.ts'],
		ignores: [TESTS],
		languageOptions: {
			parser: tsparser,
			// Likewise `project: './tsconfig.json'` resolves against the working directory.
			// The project service is what the TypeScript language server itself uses, and
			// the root is pinned to this file rather than to whoever invoked eslint.
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
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
			// Debug logging has no other gate. console.error on a genuine failure path
			// is the one console call this codebase makes on purpose.
			'no-console': ['error', { allow: ['error'] }],
		},
	},
	{
		files: [`${TESTS}/*.ts`],
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
