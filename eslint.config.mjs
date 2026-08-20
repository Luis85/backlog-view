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
		message:
			'All frontmatter writes go through src/storage/ — frontmatter.ts (applyWrites / applyRestores) edits a note, createNote.ts (createBacklogItem) makes one.',
	},
	{
		selector: "CallExpression[callee.property.name='create'][callee.object.property.name='vault']",
		message: 'Creating files in the vault belongs in src/storage/ (createNote.ts / createBacklogBase).',
	},
	{
		selector: "MemberExpression[property.name=/^(save|load)LocalStorage$/]",
		message: 'Persisted view state goes through src/storage/viewStateStore.ts.',
	},
];

/**
 * Enter or Space on a focused button synthesizes a click at (0, 0), so anchoring a
 * menu to the pointer drops it in the viewport corner. This shipped once already.
 */
/**
 * Obsidian hands an SVG node's `cls` straight to `classList.add` — `addClass` lives on
 * `HTMLElement` — so a space-separated STRING throws `InvalidCharacterError` where
 * `createEl` would have split it happily. This shipped: a two-class arrow path threw on
 * every conflicting edge in a vault, and because the throw aborted the render before the
 * timeline wired its grid, dragging a bar silently did nothing.
 *
 * Stated HERE rather than left to the suite, because `test/helpers/dom.ts` was the reason
 * nothing caught it — a fake kinder than the real API. That file is faithful now, so a
 * driven path fails a test; this rule is for the path nothing drives yet.
 */
const SVG_CLASS_TOKENS = [
	{
		selector:
			"CallExpression[callee.property.name='createSvg'] Property[key.name='cls'] Literal[value=/ /]",
		message:
			'createSvg passes cls to classList.add, which rejects spaces. Pass an array of class names, not one space-separated string.',
	},
	{
		selector:
			"CallExpression[callee.property.name='createSvg'] Property[key.name='cls'] TemplateElement[value.raw=/ /]",
		message:
			'createSvg passes cls to classList.add, which rejects spaces. Build an array of class names rather than interpolating a space-separated string.',
	},
];

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
		'Route through offerableTypes (src/view/projection.ts) instead of importing ALL_TYPES — the whole type vocabulary is not what a given projection can show.',
};

/**
 * `childTypeChoices(null)` — the "what may go at top level" case in
 * `src/domain/itemTypes.ts` — returns `ALL_TYPES` itself, unfiltered, so it is a second
 * way for a view file to reach the whole vocabulary without ever importing that name
 * (see `ALL_TYPES_IMPORT`, above, which this selector sits beside rather than replaces
 * — an import of the name is still worth catching at the point it enters a file). No
 * view/ call site has a reason to ask the top-level question: it is the toolbar's own and
 * already goes through `offerableTypes` instead.
 *
 * Passing an ITEM is not the fix on its own, and this selector cannot say so — what
 * `childTypeChoices(item)` returns is the rung below plus `EXTRA_TYPES`, and
 * `Deliverable` is one of those, which is the exact route the requirements board's type
 * button took to offering Deliverables. Every view/ call site therefore hands the result
 * to `offerableTypes` — two through `buildItemMenu`, one at `renderRow`'s add button —
 * and the message below says so rather than stopping at the item. Nothing checks that:
 * a fourth call site could iterate the raw list with lint green, which is what
 * `docs/tasks/Follow-ups from enforcing the Deliverables invariants.md` records.
 * `backlogReadme.ts` calls it with `null` on purpose
 * (a type with no declared parent reads as a root in the generated table) and is
 * domain/, not view/, so it is out of this selector's scope the same way `settings.ts`
 * is out of `ALL_TYPES_IMPORT`'s.
 */
const CHILD_TYPE_CHOICES_NULL = {
	selector: "CallExpression[callee.name='childTypeChoices'][arguments.0.value=null]",
	message:
		'childTypeChoices(null) returns the unfiltered ALL_TYPES vocabulary. Route through offerableTypes (src/view/projection.ts) — and pass its result, not childTypeChoices(item) raw, which carries EXTRA_TYPES including Deliverable.',
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
 * A row's controls are wired on the PANE, never on the element. A listener built during
 * a render closes over that render's `BacklogItem`, which is the previous model's object
 * the moment an update lands — and reusing a row element is exactly what this codebase
 * now does. The rule sits at the call rather than on a list of the controls, because the
 * next control is the one a list would miss.
 *
 * It sees this spelling. A listener added through an aliased reference
 * (`const on = el.addEventListener`) is not caught here and is caught by
 * `test/view/rowControls.test.ts` only on the paths that test drives.
 */
const ROW_LISTENER = {
	selector: "CallExpression[callee.property.name='addEventListener']",
	message:
		'A per-row control may not carry its own listener: it would close over this render\'s BacklogItem and go stale when the model is rebuilt. Add it to wireChipEvents in render/rows.ts, which resolves the item from data-path per event.',
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
// The two regions outside view/ that render text and have been SWEPT, so the ternary ban
// lands on a clean file rather than opening with a wall of errors. Carved out of the
// general region for that one rule and nothing else. domain/ and main.ts stay out until
// their own sweeps run — `docs/requirements/Every surface translated.md`.
const SWEPT = ['src/ui/**/*.ts', 'src/commands/**/*.ts'];
const MENU = 'src/view/interactions/menu.ts';
// The rest of the menu surface, carved out of VIEW for the two text bans alone — swept
// into the catalog on 2026-08-20 alongside `menu.ts` itself, so the bans land on clean
// files rather than opening with a wall of errors on the rest of a directory nobody has
// swept yet. That ORDER is the rule, and `RENDER_EMPTY_STATES` above states it: a ban
// ahead of its sweep is a ban somebody switches off. Everything else VIEW carries applies
// here unchanged.
//
// The four files are one subject: `shelfMenu.ts` and `columnMenu.ts` are menus of their
// own, and `tags.ts` and `labels.ts` are the submenu builders `menu.ts` delegates to. The
// unswept remainder of `view/interactions/` — `create.ts`, `absences.ts`,
// `dependencies.ts`, `plan.ts`, `structure.ts` and the drag modules — stays under VIEW
// with no text ban at all, which is why this is a file list rather than a glob.
// `view/interactions/` is swept WHOLE as of 2026-08-20 — the menu surface first, then the
// prompts, notices and the backfill's outcome. Enumerated rather than globbed on purpose:
// `menu.ts` and `create.ts` carry rule sets of their own, and a second block matching the
// same file would OVERRIDE `no-restricted-syntax` rather than merge with it, silently
// dropping whichever set lost. A glob replaces this list the day the rest of `view/` is
// swept and the three rule sets can be one.
//
// A file ADDED to this directory is therefore not covered until it is named here. That is
// the cost of the override rule above, and it is why the runtime halves exist:
// `test/i18n/menus.test.ts` and `test/i18n/interactions.test.ts` read rendered strings back
// rather than trusting the region list.
const MENU_SWEPT = [
	'src/view/interactions/shelfMenu.ts',
	'src/view/interactions/columnMenu.ts',
	'src/view/interactions/tags.ts',
	'src/view/interactions/labels.ts',
	'src/view/interactions/absences.ts',
	'src/view/interactions/dependencies.ts',
	'src/view/interactions/structure.ts',
	'src/view/interactions/plan.ts',
	'src/view/interactions/undo.ts',
	'src/view/interactions/stateColors.ts',
];
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
// The empty states, carved out of RENDER for one text ban alone — swept into the catalog
// on 2026-08-20, so `UI_TEXT_PROPERTY` lands on a clean file rather than opening with a
// wall of errors on the rest of a directory nobody has swept yet. That ORDER is the rule:
// a ban ahead of its sweep is a ban somebody switches off. Everything else RENDER carries
// applies here unchanged.
const RENDER_EMPTY_STATES = 'src/view/render/emptyStates.ts';
// The row's own controls, carved out of RENDER for ROW_LISTENER: `rows.ts` wires the
// tree's row and chip delegation (the only place a per-row listener may live),
// `columns.ts` draws the state and horizon chips those delegate for, and `chips.ts`
// draws the rest of them (the label and date chips) — main moved the chip renderers
// there once `columns.ts` hit its own line budget, so a rule that stopped at the first
// two would leave that third file free to grow a captured listener again. `reconcile.ts`
// is the same story a third time: the walk that PLACES rows came out of `rows.ts` when it
// hit ITS budget, and a render module outside this list is a render module free to wire a
// listener onto a row element it is about to keep. The rule names FILES, so every file the
// row path is split across has to be in it.
const ROW_CONTROLS = [
	'src/view/render/rows.ts',
	'src/view/render/reconcile.ts',
	'src/view/render/columns.ts',
	'src/view/render/chips.ts',
];
// The rest of view/, once menu.ts, render/ and create.ts are carved out below.
const VIEW = 'src/view/**/*.ts';
// The card-move orchestration, exempt from DELIVERABLE_FIELD_READ for the same reason
// RENDER_BOARD is: carved out of VIEW, not out of RENDER, because this file sits in the
// "rest of view/" region.
const CARD_MOVES = 'src/view/cardMoves.ts';
// The types section, exempt from ALL_TYPES_IMPORT alone: every other view/ file asks
// "what can THIS projection offer", which is the question ALL_TYPES_IMPORT protects,
// but this one asks a different question on purpose — "what does the whole vocabulary
// contain" — and states that as its own guarantee (`typesSection`'s doc comment,
// checked by `test/view/manualTypes.test.ts`'s "explains every type" assertion). A
// sixth creation surface reading ALL_TYPES raw is the bug that rule exists to catch; a
// documentation surface reading it whole is what the rule was never about.
//
// Named to the ONE FILE, like MENU and CARD_MOVES above, not to `src/view/manual/**` —
// the exemption is what `typesSection.ts` itself needs, not a property of the
// directory. `sections.ts`, `src/view/manual/`'s other module, derives its content from
// view options, not from the type vocabulary, and has never asked to import ALL_TYPES;
// a directory-wide carve-out would have granted it — and every later file dropped in
// beside them — a permission neither needs, silently. Widen this to a glob only if a
// second file in the directory earns the same exemption on its own facts.
const TYPES_SECTION = 'src/view/manual/typesSection.ts';

// A sentence assembled by picking between two string literals — `${n === 1 ? '' : 's'}`,
// `${folded ? 'Expand' : 'Collapse'} ${label}`, `const label = a ? 'Show' : 'Hide'`. All
// the same defect: a two-form rule with the forms hard-coded at the call site, which no
// locale can reorder, inflect, or give a third form to. Nineteen of the first shape were
// swept into the catalog and the twentieth still arrived, in a merge, written the old way
// because the old way was the only way when it was written — so the rule is put on the
// SHAPE rather than left to a grep somebody remembers to run.
//
// Two selectors, because they refuse different things and neither contains the other.
//
// TEMPLATE is the original: any ternary between two literals INSIDE a template. It is what
// catches the plural suffix, whose two forms are `''` and `'s'` and so carry no capital
// between them.
//
// PICKED drops the template — the half a contributor gets past by assigning to a local
// one line above, which is not an exotic workaround but the first thing anyone writes
// when a sentence needs a conditional. What it cannot drop with it is the literal's
// SHAPE, and the numbers are why: a bare ConditionalExpression between two Literals fires
// **97 times across `src/`, 70 in `src/view/` alone**, and only ten of those are text.
// The rest are class fragments (`cond ? ' pbl-done' : ''`), Lucide icon ids, ARIA and
// `data-` values, and — five times — a ternary between two CATALOG KEYS, which is the
// correct post-sweep idiom the rule would be refusing. A ban with fifty-seven false
// positives is a ban that gets switched off, so the shape is narrowed by the one property
// that separates the two sets here: **every identifier this plugin writes is lowercase**
// (CSS class, icon id, ARIA value, `data-` key, catalog key), so a capital letter in a
// picked literal is prose. The `t()` exclusion is what keeps the key ternaries legal.
//
// That property is a heuristic and its ceiling is a lowercase sentence. It had two live
// examples; one is left. `' — inferred from children'` in `render/lanes.ts` still passes
// inside a banned directory, and `'are'`/`'is'` in `manual/typesSection.ts` did until
// 2026-08-18, when that paragraph became one catalog key. Naming what slips through is
// what stops this rule being read as "these directories are clean" — the remaining one is
// not a regression it let in.
//
// **Scope: `render/`, `interactions/menu.ts`, and `manual/typesSection.ts`.** The menu is
// not decoration — it holds the twin of `render/timeline.ts`'s fold label, so a ban
// stopping at render/ would leave half of a guarantee two surfaces are supposed to keep
// together. The types section joined when its own last instance went, which is the only
// order this can happen in: a directory is banned once it is swept, never before, or the
// ban is a wall of errors somebody switches off. It stops short of the
// rest of `interactions/`: `structure.ts` holds `runInit`'s outcome notice, whose OUTER
// sentence is assembled too and is owed to `Every surface translated` — keying the
// fragment alone would be this same defect one level up. `domain/` stays unbanned on SIX
// instances rather than the seven this comment claimed, and they are not all README prose:
// five are, and `markerLaneCaption` (`domain/roadmap.ts`) is live roadmap UI text. Counted
// on 2026-08-18 rather than recalled, after the wrong figure was restated twice — "all
// README prose" is what would tell the next sweeper this directory is safe to skip.
// `ui/` and `commands/` joined on 2026-08-19, when their own sweep ran; the rest of
// `manual/` stays out — `sections.ts` is unswept and the ban is named to the ONE FILE for
// the reason `TYPES_SECTION` itself is.
//
// Neither selector can tell a class name from a sentence, only lowercase from capitalised
// — `styles`-bound interpolation has to be written another way under TEMPLATE, which
// `render/toolbar.ts` now is. That is the accepted cost of checking a shape: the
// alternative is a rule that reads the string's meaning, and there is no such selector.
const TEXT_TERNARY_MESSAGE =
	'A sentence picked between two literals cannot be translated — no locale can reorder or inflect either half. Give each direction its own catalog key in src/i18n/en.ts and call t(). If this is a class name rather than text, build it with addClass instead.';

const TEXT_TERNARY = [
	{
		selector: "TemplateLiteral > ConditionalExpression[consequent.type='Literal'][alternate.type='Literal']",
		message: TEXT_TERNARY_MESSAGE,
	},
	{
		selector:
			"ConditionalExpression[consequent.type='Literal'][alternate.type='Literal']:matches([consequent.value=/[A-Z]/],[alternate.value=/[A-Z]/]):not(CallExpression[callee.name='t'] > *)",
		message: TEXT_TERNARY_MESSAGE,
	},
];

// A sentence spelled AT the place it is used, in a directory that has none left. The
// ternary ban above catches a sentence PICKED between two literals; this one catches the
// ordinary case underneath it, which is the one a sweep leaves behind by omission rather
// than by cleverness — and it is what makes the swept region stay swept for code nobody
// has written yet, instead of for the call sites someone thought to check.
//
// **It sees the SPELLINGS listed and no others.** The setter calls and `new Notice`, quoted
// or backticked, with the same lowercase-is-an-identifier heuristic TEXT_TERNARY uses.
// Three shapes stay outside it, and each is stated rather than implied because a reader who
// assumes otherwise stops checking:
//
//   - A literal reaching the DOM through a `text:` or `'aria-label'` property. That is a
//     choice with one live instance: `ui/manualDialog.ts`'s nav heading is the plugin's own
//     NAME, which `Every surface translated` says is not translated, so a rule covering the
//     property would open on an exemption for the one thing allowed to be there.
//   - A template whose FIRST quasi is empty — `` `${name} was moved` `` — since the capital
//     test has nothing to read at the position it reads. The interpolation-first sentence is
//     rarer than the ban is worth widening for; it is not covered by accident.
//   - A sentence built in a helper and returned to the call site (`outcomeNotice` in
//     `commands/readme.ts`). Lint sees the return, not the `new Notice` two frames up.
//
// The runtime half is what holds those: a call site spelling its own English renders it
// beside overridden neighbours in `test/i18n/sweptSurfaces.test.ts`. Neither half covers
// what the other does. A wider rule belongs to `A bare string cannot reach the UI`, which
// makes a bare string unable to reach the UI at all rather than naming where it may not be
// written.
const UI_TEXT_LITERAL = {
	selector:
		"CallExpression[callee.property.name=/^(setName|setDesc|setPlaceholder|setTooltip|setButtonText|setText|setTitle)$/] > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), NewExpression[callee.name='Notice'] > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/])",
	message:
		'A sentence spelled where it is used cannot be translated. Add a key to src/i18n/en.ts and call t() — and if this is a value the plugin writes, matches or persists rather than text, it belongs in neither place.',
};

// The FIRST of the three shapes `UI_TEXT_LITERAL` states it cannot see, banned where the
// exemption that keeps it out of that rule does not apply.
//
// `view/render/emptyStates.ts` reaches the DOM entirely through `createDiv`/`createEl`
// option bags, so it spells no setter and no `new Notice` and `UI_TEXT_LITERAL` would have
// held nothing in it at all. What it does spell is `text:`, `label:` and `'aria-label':`,
// which that rule leaves alone for one live instance in `ui/manualDialog.ts` — the plugin's
// own NAME, which `Every surface translated` says is not translated. Scoped here, there is
// no such instance to open on.
//
// **It sees that property shape and no other.** The two that remain uncovered in this file:
// a template whose first quasi is empty (`UI_TEXT_LITERAL`'s own second exemption, for the
// same reason — the capital test has nothing to read), and a prose literal handed to a
// helper as a positional ARGUMENT, which is how `guidanceShell` takes every title and hint
// this module draws. That second one is the file's commonest shape and lint cannot reach
// it: the runtime half in `test/i18n/emptyStates.test.ts` is what holds it, by asserting
// that every string a frame drew carries the fixture catalog's marker.
const UI_TEXT_PROPERTY = {
	selector:
		"Property[key.name=/^(text|label|title)$/]:matches([value.type='Literal'][value.value=/^[A-Z]/], [value.type='TemplateLiteral'][value.quasis.0.value.raw=/^[A-Z]/]), Property[key.value='aria-label']:matches([value.type='Literal'][value.value=/^[A-Z]/], [value.type='TemplateLiteral'][value.quasis.0.value.raw=/^[A-Z]/])",
	message:
		'A sentence spelled where it is used cannot be translated. Add a key to src/i18n/en.ts and call t() — and if this is a value the plugin writes, matches or persists rather than text, it belongs in neither place.',
};

const syntaxRules = (selectors) => ({ 'no-restricted-syntax': ['error', ...selectors] });

export default defineConfig([
	{
		// Everything that is not this plugin's source. The build scripts are Node, not
		// plugin code, so the Obsidian ruleset does not apply to them; `.obsidian/` is a
		// test-build vault (vendored plugin bundles), `.harness/` is the browser page
		// `npm run harness` bundles, `.claude/` is agent tooling. They
		// were only invisible while `lint` named `src test` — an editor lints the whole
		// tree, and a type-aware rule on a file outside tsconfig crashes the run.
		// Prose is not code here. `docs/` is a BACKLOG written in this plugin's own schema
		// and read by `npm run docs`, whose rules are about the register — hierarchy,
		// wikilinks, source paths — and nothing a code linter has an opinion about. Stated
		// even though no config below matches a `.md` today: a markdown-aware plugin added
		// for the README would otherwise arrive owning three hundred notes.
		ignores: [
			'main.js',
			'node_modules/**',
			'coverage/**',
			'dist/**',
			'.obsidian/**',
			'.harness/**',
			'.claude/**',
			'scripts/**',
			'docs/**',
			'**/*.md',
			'eslint.config.mjs',
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
	forbidden(
		'i18n',
		['view', 'commands', 'domain', 'storage', 'ui'],
		'i18n/ is the leaf below every layer: every one of them renders text, so it may import none of them. An edge back up would make the catalog unreachable from whichever layer it reached into.',
	),
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
		ignores: [STORAGE, VIEW, ...RANKING_DOMAIN, ...SWEPT],
		rules: syntaxRules([...WRITE_BOUNDARY, ...SVG_CLASS_TOKENS, MENU_ANCHOR, OVERBY, TREE_SCAN]),
	},
	{
		// ui/ and commands/, carved out of the general region for the two text bans alone:
		// both were swept into the catalog on 2026-08-19, so the bans have a clean file to
		// hold. Everything else the general region carries applies here unchanged.
		files: SWEPT,
		rules: syntaxRules([
			...WRITE_BOUNDARY,
			...SVG_CLASS_TOKENS,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
		]),
	},
	{
		// storage/ IS the writer, so the write boundary cannot apply to it. Nothing else
		// about it is special — the menu rule and the overBy rule still do.
		files: [STORAGE],
		rules: syntaxRules([...SVG_CLASS_TOKENS, MENU_ANCHOR, OVERBY, TREE_SCAN]),
	},
	{
		// The menu helper is where the anchoring decision is made, so it is the one place
		// allowed to make it. It writes nothing and plans nothing, so both other rules hold.
		// It asks Set state's own question — which workflow does THIS item track — so
		// DELIVERABLE_FIELD_READ applies here like everywhere else that is not
		// RENDER_BOARD or CARD_MOVES. ALL_TYPES_IMPORT and CHILD_TYPE_CHOICES_NULL apply
		// too: `offerableTypes` moved to `view/projection.ts`, which is where "what can
		// THIS projection offer" is now answered, and the exemption moved with it.
		files: [MENU],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			OVERBY,
			TREE_SCAN,
			DELIVERABLE_FIELD_READ,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// Ranking code, domain half: what it writes is an order among real siblings, and
		// a type is the rung its parent chain puts it on — never the depth it is drawn
		// at. It plans writes, which is exactly what overBy must stay out of. No
		// ALL_TYPES_IMPORT: this file is domain/, not view/.
		files: RANKING_DOMAIN,
		rules: syntaxRules([...WRITE_BOUNDARY, ...SVG_CLASS_TOKENS, MENU_ANCHOR, RENDERED_ROOTS, VISUAL_DEPTH, OVERBY, TREE_SCAN]),
	},
	{
		// Ranking code, view half: the same rules as the domain half, plus
		// ALL_TYPES_IMPORT, CHILD_TYPE_CHOICES_NULL and DELIVERABLE_FIELD_READ — this file
		// offers types (`promptCreateItem`'s callers) like any other view/ module, and
		// asks the chip's and the menu's question rather than RENDER_BOARD's or
		// CARD_MOVES'.
		files: RANKING_VIEW,
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			RENDERED_ROOTS,
			VISUAL_DEPTH,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			// `create.ts` is in `view/interactions/` and was swept with the rest of it; it
			// keeps its own block for the ranking rules above, so the three text bans are
			// repeated here rather than inherited. The repetition is the override rule
			// stated at MENU_SWEPT: one file, one block.
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// view/render/, minus RENDER_BOARD and ROW_CONTROLS (their own blocks below): draws
		// the column, never plans a write, so it is the one region allowed to import overBy.
		// The write boundary and the menu-anchor rule still apply — nothing here is exempt
		// from those, only from OVERBY. It offers types on the toolbar, so ALL_TYPES_IMPORT
		// and CHILD_TYPE_CHOICES_NULL apply here too, and so does DELIVERABLE_FIELD_READ —
		// the chip (`columns.ts`) is exactly the surface that must not hand-pick the raw
		// fields itself.
		files: [RENDER],
		ignores: [RENDER_BOARD, RENDER_EMPTY_STATES, ...ROW_CONTROLS],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			...TEXT_TERNARY,
		]),
	},
	{
		// The swept empty states: RENDER's own rules plus the property ban above.
		files: [RENDER_EMPTY_STATES],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			...TEXT_TERNARY,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// The Deliverables board's own render, carved out of RENDER: `doneOf` reads
		// `item.deliverableDone` directly because this board only ever draws Deliverable
		// cards — it is the board's workflow, not a per-item type dispatch, so
		// DELIVERABLE_FIELD_READ does not apply here. Everything else RENDER carries does.
		files: [RENDER_BOARD],
		rules: syntaxRules([...SVG_CLASS_TOKENS, ...WRITE_BOUNDARY, MENU_ANCHOR, TREE_SCAN, ALL_TYPES_IMPORT, CHILD_TYPE_CHOICES_NULL, ...TEXT_TERNARY]),
	},
	{
		// The row's own controls, carved out of RENDER: everything RENDER carries, plus
		// ROW_LISTENER — the rule that keeps a per-row control from wiring its own listener,
		// so a render may KEEP a row element without leaving a handler pointing into the
		// model the update replaced. See ROW_CONTROLS's own comment above for why all three
		// files, and render/rows.ts for the delegation and its exemptions.
		files: ROW_CONTROLS,
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			ROW_LISTENER,
			...TEXT_TERNARY,
		]),
	},
	{
		// The rest of view/ — everything under it once menu.ts, render/, create.ts,
		// cardMoves.ts and typesSection.ts (handled above and below) are carved out. Same
		// rules the general region has, plus ALL_TYPES_IMPORT and CHILD_TYPE_CHOICES_NULL
		// (any of these files is a candidate sixth type-offering surface) and
		// DELIVERABLE_FIELD_READ (any of these files is a candidate third hand-written
		// workflow ternary).
		files: [VIEW],
		ignores: [MENU, ...MENU_SWEPT, RENDER, ...RANKING_VIEW, CARD_MOVES, TYPES_SECTION],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
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
		// The rest of the swept menu surface: VIEW's own rules plus the two text bans.
		//
		// **Between them they still miss this slice's commonest prompt shape**, and saying
		// so is the point of writing it here: `ValuePromptModal` takes its heading, its
		// field name, its placeholder and its call to action as an option bag, and of those
		// four only `title:` is a property `UI_TEXT_PROPERTY` reads. `fieldName:`,
		// `placeholder:` and `ctaLabel:` are named nowhere in either selector and a literal
		// at any of them fails no rule. `test/i18n/menus.test.ts` is what holds those, by
		// opening each prompt under a marked catalog and reading the rendered strings back.
		files: MENU_SWEPT,
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// `view/projection.ts` answers what a projection IS, `offerableTypes` among them —
		// so it is the one place allowed to read ALL_TYPES straight, as that function's own
		// default parameter, and the exemption from ALL_TYPES_IMPORT lives here rather than
		// in a second file carrying it. It renders nothing, writes nothing and opens no
		// menu, so every other rule holds.
		files: ['src/view/projection.ts'],
		rules: syntaxRules([...SVG_CLASS_TOKENS, ...WRITE_BOUNDARY, MENU_ANCHOR, OVERBY, TREE_SCAN]),
	},
	{
		// The types section, carved out of VIEW: see TYPES_SECTION's own comment above for
		// why ALL_TYPES_IMPORT does not apply here, and why this is one file rather than a
		// directory. CHILD_TYPE_CHOICES_NULL and DELIVERABLE_FIELD_READ still apply —
		// nothing about needing the whole vocabulary excuses the other two type-offering
		// and workflow-dispatch bugs.
		files: [TYPES_SECTION],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			...TEXT_TERNARY,
		]),
	},
	{
		// Card-move orchestration, carved out of VIEW: `performDeliverablesBoardMove`
		// reads `item.deliverableStateValue` directly because the METHOD already says
		// which board's move this is — a call that has already chosen the workflow, not
		// one dispatching on the item's type. Everything else VIEW carries does apply.
		files: [CARD_MOVES],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
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
			// A fixture built by spreading the defaults carries the FIELDS of
			// `BacklogSettings` and none of the relationships BETWEEN them that
			// `resolveSettings` establishes — so it can express a vault nobody could
			// configure, which stays invisible until some function reads two fields
			// together and then asserts behaviour for a configuration that cannot occur.
			// `test/helpers/settings.ts` applies those derivations and checks the result;
			// this is the rule at the forbidden thing, so it holds for tests not yet
			// written rather than for the fixtures someone thought to look at.
			//
			// What it does NOT see, stated because the gap is real: spreading a settings
			// object under any OTHER name (`{ ...settings, tagsKey: 'x' }`) breaks the same
			// relationships and is invisible to a syntactic rule. `buildModel`'s
			// `assertResolvedSettings` is the runtime net under that case, and it reaches
			// only the tests that build a model. See
			// `docs/issues/A hand-built fixture can model a state the producer cannot produce.md`.
			'no-restricted-syntax': [
				'error',
				{
					selector: "SpreadElement > CallExpression[callee.name='defaultSettings']",
					message:
						'Spreading defaultSettings() skips the relationships resolveSettings establishes between fields. Use settingsWith({ ... }) or settingsFrom(options) from test/helpers/settings.ts.',
				},
			],
			// The harness deliberately reaches past the view's public surface.
			'@typescript-eslint/no-explicit-any': 'off',
			// A stand-in has to accept the arguments the real API is called with, whether
			// or not the fake reads them; the underscore says so.
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
]);
