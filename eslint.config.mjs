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
 * The Obsidian ruleset is about *shipped plugin* code, and `test/` is not that: the test
 * doubles exist precisely to do what those rules forbid — the DOM helper defines
 * `createEl`, the fake vault casts to `TFile`. So the plugin rules stop at `src/`, and
 * `test/` gets the TypeScript baseline plus this repo's own budgets, below.
 *
 * The reason used to be that `test/` had no tsconfig at all and so could not carry a
 * type-aware rule. `tsconfig.test.json` covers it now (`npm run typecheck:test`), so what
 * is left is the reason that was always the real one — the doubles.
 */
const pluginRules = obsidianmd.configs.recommended.map((c) => ({ ...c, ignores: [...(c.ignores ?? []), TESTS] }));

/**
 * Every mutation of the vault goes through storage/, so the write-safety invariants
 * can be verified by reading one directory instead of trusting every call site. This
 * is the single most important rule in the codebase, which is why it is not prose.
 *
 * **Three arms, and every region takes all three.** They were three named constants and one
 * array over them for a while, against the day a directory needed to keep some arms and drop
 * another — and the one case that ever asked for it was refused: `src/view/release/` creates
 * notes, but through `createRelease`, a plain function call no arm of this rule matches, so
 * no carve-out was needed. Each name had exactly one consumer, the array on its own next
 * line. Collapsed back on 2026-08-25; split it again when a second consumer actually exists,
 * and never spread the split over an index into this array, which a later edit can reorder.
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
 * "Is this projection tree-shaped" is `treeShaped()` in `src/view/projection.ts`, and that
 * predicate is `'tree' || 'catalog'` — so a bare comparison against `'tree'` alone is
 * exactly the shape that silently excludes the catalog from a gate it belongs in: no
 * column fitting, no refit on resize, the fit classes cleared as though it were a card
 * projection, a row menu with no Move up/down. That is the drift the module exists to
 * stop, and until 2026-09-02 two guides claimed this rule already existed.
 *
 * **`'tree'` only, and that is a classification rather than a shortcut.** The other
 * comparisons an AST sweep finds — `=== 'board'`, `=== 'roadmap'`, `=== 'deliverables'`,
 * `=== 'iteration'`, and the two `=== 'catalog'` in `render/emptyStates.ts` and
 * `render/projections.ts` — are dispatch on ONE projection's own behaviour, which is the
 * question no predicate on that module answers and which a ban could only permit through
 * an exemption list that goes stale. They are sorted, named and left alone in
 * `docs/issues/The projection predicate has no lint rule behind it.md`. There was nothing
 * to grandfather: the same rule reported zero violations across `src/` before it was
 * turned on.
 *
 * What it SEES is an equality comparison with `projection`, `<x>.projection` or
 * `<x>?.projection` on one side and the literal `'tree'` on the other. The optional-chain
 * spelling needed its own term and did not have one for a day: typescript-eslint wraps an
 * optional member access in a `ChainExpression`, so `left.property.name` reads nothing
 * through it and `host?.projection === 'tree'` linted clean (Codex, PR #252) — verified by
 * planting it, watching lint pass, and watching it fail once the term was added. It does not see `switch (projection)` with a
 * `case 'tree'`, nor a projection first copied into a differently named local. The claim
 * is therefore "no bare `projection === 'tree'`", not "nothing compares to `'tree'`", and
 * `src/view/CLAUDE.md` states it that narrowly.
 */
const PROJECTION_TREE = [
	{
		selector:
			"BinaryExpression[operator=/^[!=]==$/]:matches([left.name='projection'], [left.property.name='projection'], [left.expression.property.name='projection'])[right.value='tree']",
		message:
			"A bare projection === 'tree' misses the catalog, which is tree-shaped too. Ask src/view/projection.ts — treeShaped(), hidesCompleted(), hasRollup(), projectionPopulation() and the rest.",
	},
	{
		selector:
			"BinaryExpression[operator=/^[!=]==$/][left.value='tree']:matches([right.name='projection'], [right.property.name='projection'], [right.expression.property.name='projection'])",
		message:
			"A bare 'tree' === projection misses the catalog, which is tree-shaped too. Ask src/view/projection.ts — treeShaped(), hidesCompleted(), hasRollup(), projectionPopulation() and the rest.",
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
 * Every surface that names a resource to the reader disambiguates through
 * `namedTargets`/`resourceLabelsOf` (`domain/readItems.ts`, `BacklogModel.resourceLabels`)
 * — two `Resource` notes sharing a basename in different folders must read apart wherever
 * a person's name is shown, and a bare `.basename` read is exactly the earlier, ambiguous
 * name. Missed seven times before this rule existed — the menu, the absence picker, the
 * roadmap's lane headers, the assignee chip, a resource move's notice, an absence note's
 * own derived name, and its creation notice — five of the seven found only AFTER the rule
 * above was already written down in prose, which is this codebase's own argument for
 * putting a check on the call rather than trusting the sentence.
 *
 * Scoped to `view/` only, not `domain/`: `domain/roadmap.ts`'s `labelOf` and
 * `domain/readItems.ts`'s `assigneeName` ARE the label lookup this rule sends every other
 * caller to, and both fall back to `entry.file?.basename` through OPTIONAL chaining —
 * which this selector's `??` exemption below does not see through (`?.` wraps the access
 * in a `ChainExpression`, so it is no longer a direct child of the `??`). Widening the
 * scope to `domain/` would flag the two functions that exist to be the exception.
 *
 * **What this promises, measured rather than asserted (2026-08-29).** It refuses TWO
 * SPELLINGS of one mistake — a local named `resource` or `target` read for `.basename`,
 * and the one-level-deeper `resource.file.basename` — and it promises nothing about any
 * other way the same name can be reached. That is the whole guarantee. It is a fifth of
 * the naming rule, not the rule.
 *
 * The reach was measured with a probe file planted under `view/` carrying eight spellings
 * of one resource's name, then thrown away. It flags three of the eight — the two banned
 * shapes, plus one of them inside a template literal — and goes past `.title` (the field
 * `Linking an item to a resource` created, and the natural spelling now), `TFile.name`, an
 * aliased read (`const f = resource.file; f.basename`), a local named anything else, and a
 * read through a callback parameter (`list.map((r) => r.title)`). Read the selector and it
 * looks like a rule about naming a resource; run it and it is a rule about two identifiers
 * and one property.
 *
 * **Widening it to `.title` on the same two identifiers was tried on that measurement and
 * refused.** It gains no true positive, costs two false ones — `cardMoves.ts`'s release
 * announcement and `dependencies.ts`'s prerequisite list, both `target.title` on a
 * `BacklogItem` — and still misses the one real `.title` resource read in `view/`
 * (`resourceNotes.ts`'s `r.title`), whose local is named neither. `.basename` is safe to
 * ban on those two names because only a `TFile` has one and a `TFile` named `target` in
 * `view/` is a resource; `.title` is a `BacklogItem`'s commonest field, so the same ban on
 * it fires on items far more often than on resources. A rule exempted more often than it
 * holds is one a reader learns to switch off, which is the failure this whole block exists
 * to avoid.
 *
 * **What actually holds the rule is not here.** An AST sweep of `src/` for every read of
 * `.basename` or `.title` — 102 of them — found 11 that read a RESOURCE's own name, and
 * every one is a place raw is CORRECT: the roster's own definition and sort
 * (`readItems.ts`, `model.ts`), `namedTargets` itself, the two `domain/` functions that ARE
 * the lookup (`assigneeName`, `roadmap.ts`'s `resourceLabel`/`resourceTargetLabel`), the
 * two `??` fallbacks below, `New resource...`'s duplicate-warning list (which must compare
 * typed text against bare titles, or it warns about nothing), and the notice for a note
 * created a moment ago, which no roster carries yet. So this rule flags nothing today and
 * would flag nothing if it were three times wider. What would catch the next miss is a
 * category test driving two same-named resources through every naming surface and asserting
 * they read apart — `test/i18n/` (root `CLAUDE.md`) and `test/domain/absences.test.ts`
 * (Task 6 follow-up) carry that shape. This selector is the cheap half, kept because a
 * banned spelling costs one line to refuse. Of the seven historical sites it was measured
 * against, it would have caught two; the other five reached the name by a spelling above.
 *
 * The one legitimate shape in `view/` — falling back to a bare `.basename` for a target
 * the label map does not carry, beside a real `resourceLabelsOf(...).get(...)` lookup
 * (`cardMoves.ts`'s `resourceLabel`, `interactions/absences.ts`'s `absenceResourceLabel`)
 * — is written `resourceLabelsOf(...).get(...) ?? …basename` and is exempted by asking
 * whether the `.basename` read is a direct child of a `??`. Every other spelling of THOSE
 * TWO SHAPES is still flagged — which is not the same as every other way of reaching the
 * name, per the measurement above.
 */
const RESOURCE_LABEL_BYPASS = [
	{
		selector:
			"MemberExpression[property.name='basename'][object.type='Identifier'][object.name=/^(resource|target)$/]:not(LogicalExpression[operator='??'] > *)",
		message:
			"A resource is named to the reader through namedTargets/resourceLabelsOf (src/domain/readItems.ts), never its own .basename — two Resource notes sharing a basename in different folders must read apart. This catches ONE spelling of that: a bare resource.basename / target.basename. It does not see .title, TFile.name, an aliased read, a differently named local, or a read through a callback — measured, not assumed. Passing it is not evidence the name reads apart; see this rule's own comment in eslint.config.mjs.",
	},
	{
		selector:
			"MemberExpression[property.name='basename'][object.type='MemberExpression'][object.object.name=/^(resource|target)$/]:not(LogicalExpression[operator='??'] > *)",
		message:
			"Same rule one level deeper: resource.file.basename is still the resource's own name, not the collision-aware label resourceLabelsOf gives it. The second of the two spellings this block promises to see — see the sibling selector's message for the five it does not.",
	},
];

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
// Everything outside view/ that renders text and has been SWEPT, so the text bans land on
// clean files rather than opening with a wall of errors. Carved out of the general region
// for those rules and nothing else — the rest of domain/ stays out, per the block below,
// and `docs/requirements/Every surface translated.md` says why file by file.
// The directories swept into the catalog, plus `main.ts` — two command NAMES and the
// plugin's own name, which is never translated and carries an inline disable rather than
// an exemption for the file, `ui/manualDialog.ts`'s nav heading exactly — and the five
// `domain/` files whose own text is now keyed.
const SWEPT = [
	'src/ui/**/*.ts',
	'src/commands/**/*.ts',
	'src/main.ts',
	'src/domain/viewOptions.ts',
	'src/domain/estimationOptions.ts',
	'src/domain/board.ts',
	'src/domain/bars.ts',
	'src/domain/roadmap.ts',
	'src/domain/releaseOptions.ts',
];
const MENU = 'src/view/interactions/menu.ts';
// The rest of the menu surface, carved out of VIEW for the two text bans alone — swept
// into the catalog on 2026-08-20 alongside `menu.ts` itself, so the bans land on clean
// files rather than opening with a wall of errors on the rest of a directory nobody has
// swept yet. That ORDER is the rule, and the empty-states carve-out that used to state it
// here is gone with the region collapse below: a ban
// ahead of its sweep is a ban somebody switches off. Everything else VIEW carries applies
// here unchanged.
//
// The four files are one subject: `shelfMenu.ts` and `columnMenu.ts` are menus of their
// own, and `tags.ts` and `labels.ts` are the submenu builders `menu.ts` delegates to.
// **Nothing under `view/` is without a text ban any more**: VIEW's own block carries all
// three, so a file added to this directory is covered the day it is written. This comment
// said the opposite — that `create.ts`, `absences.ts`, the drag modules and the rest
// "stay under VIEW with no text ban at all" — for as long as it took VIEW to gain them,
// which made a stale half-sentence contradict the true one directly under it.
// `view/interactions/` is swept WHOLE as of 2026-08-20 — the menu surface first, then the
// prompts, notices and the backfill's outcome. Enumerated rather than globbed on purpose:
// `menu.ts` and `create.ts` carry rule sets of their own, and a second block matching the
// same file would OVERRIDE `no-restricted-syntax` rather than merge with it, silently
// dropping whichever set lost. A glob replaces this list the day the rest of `view/` is
// swept and the three rule sets can be one.
//
// A file ADDED to this directory is therefore not covered by THIS block until it is named
// here — it falls to VIEW instead, which carries the same three text bans, so the text
// rules reach it either way and only the rest of this block's set is at stake. That is the
// cost of the override rule above, and it is why the runtime halves exist:
// `test/i18n/menus.test.ts` and `test/i18n/interactions.test.ts` read rendered strings back
// rather than trusting the region list. `resourceNotes.ts` is the worked example: added
// with the resource work, named in no list here, and its literals refused all the same
// (planted 2026-08-22 and watched erroring).
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
// `columns.ts` alone, carved out of ROW_CONTROLS below for ALL_TYPES_IMPORT —
// `shelfBadgeWidth` (Task 4 of [[Cards or a list on the shelf]]'s follow-up) asks
// TYPES_SECTION's own question, "what does the whole vocabulary contain", not "what can
// THIS projection offer": the badge slot has to be one number for the life of the view,
// sized off every declared type rather than off whichever ones the active projection
// would offer, or the slot would resize as work moves between types the current
// projection cannot even show. Everything else ROW_CONTROLS carries still applies.
const COLUMNS = 'src/view/render/columns.ts';
// The rest of view/, once menu.ts, render/ and create.ts are carved out below.
const VIEW = 'src/view/**/*.ts';
// The Estimation view, carved out of VIEW for the two text bans and the ternary ban —
// swept into the catalog on 2026-08-20 by its own UX polish pass, so they land on a clean
// directory rather than opening with a wall of errors. That ORDER is the rule, stated at
// RENDER_EMPTY_STATES above: a ban ahead of its sweep is a ban somebody switches off.
// Everything else VIEW carries applies here unchanged.
//
// A GLOB, unlike MENU_SWEPT and RENDER_TOOLBAR: those two had to be enumerated because
// unswept siblings share their directory and a second block matching one file would
// OVERRIDE `no-restricted-syntax` rather than merge with it. Nothing in `view/estimation/`
// is unswept and no file in it carries a rule set of its own, so the glob is what those
// lists say they want the day their own directories are finished — and it covers a file
// ADDED here, which an enumeration would not.
//
// What the bans do NOT reach is the shape RENDER_TOOLBAR names: a prose literal handed to
// a helper as a positional ARGUMENT. `test/i18n/estimation.test.ts` is the runtime half
// that holds that.
const ESTIMATION = 'src/view/estimation/**/*.ts';
// The manual's authored prose — the ONE part of view/ still holding English, and so the
// one part the three text bans do not reach. 334 prose literals by an AST walk on
// 2026-08-21, against the 9 a setter grep sees: this is long-form documentation built
// from concatenated `text:` entries, not a handful of labels, and whether it belongs in a
// message catalog at all is `Every surface translated`'s own open question rather than
// work left undone. `typesSection.ts` is named separately below for ALL_TYPES_IMPORT.
// **The DIRECTORY, not the three files in it today.** ADR 0031 decides what the manual IS,
// so the scope has to be the thing the decision is about: a fourth content module — the
// per-locale `ManualSection[]` the ADR itself anticipates — matched `VIEW` under a
// three-path list, which reversed both halves of the decision at once. It took the three
// text bans it must never have, and lost `MANUAL_FIXED_PROSE`, the one rule it must.
// Found in review (Codex, PR #202).
const MANUAL = ['src/view/manual/**/*.ts'];
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
	// The MIXED shape, which is neither of the two above and slipped both: one branch a
	// literal and the other a template. `view/interactions/create.ts` spelled
	// `choices.length > 1 ? 'New item' : `New ${choices[0]}`` at a `heading:` property in a
	// directory carrying all three text bans, and no rule fired — the first rule wants a
	// template AROUND the ternary and the second wants literals on BOTH sides. Found by an
	// AST walk over a region the register called swept whole (2026-08-21), not by review.
	{
		selector:
			"ConditionalExpression:matches([consequent.type='TemplateLiteral'],[alternate.type='TemplateLiteral']):matches([consequent.type='Literal'][consequent.value=/^[A-Z]/],[alternate.type='Literal'][alternate.value=/^[A-Z]/]):not(CallExpression[callee.name='t'] > *)",
		message: TEXT_TERNARY_MESSAGE,
	},
];

// A sentence spelled AT the place it is used, in a directory that has none left. The
// ternary ban above catches a sentence PICKED between two literals; this one catches the
// ordinary case underneath it, which is the one a sweep leaves behind by omission rather
// than by cleverness — and it is what makes the swept region stay swept for code nobody
// has written yet, instead of for the call sites someone thought to check.
//
// **It sees the SPELLINGS listed and no others.** The setter calls, `new Notice`, and
// `setTooltip` as a BARE function — quoted or backticked, with the same
// lowercase-is-an-identifier heuristic TEXT_TERNARY uses. That last spelling joined on
// 2026-08-20 with the toolbar's sweep, and it is the same rule read twice rather than a
// widening: `Setting.setTooltip` is a method and the `obsidian` export of the same name is
// a free function taking the element, which is how every module under `view/render/` calls
// it — so the method form alone held NOTHING across the whole directory. Planting proved
// it: `setTooltip(btn, 'Timeline zoom')` in a banned file produced zero errors before and
// errors now, and the swept tree stayed clean, so the widening cost no exemption.
//
// Two shapes stay outside it, and each is stated rather than implied because a reader who
// assumes otherwise stops checking:
//
//   - A template whose FIRST quasi is empty — `` `${name} was moved` `` — since the capital
//     test has nothing to read at the position it reads. The interpolation-first sentence is
//     rarer than the ban is worth widening for; it is not covered by accident.
//   - A sentence built in a helper and returned to the call site (`outcomeNotice` in
//     `commands/readme.ts`), or handed to one as a positional ARGUMENT (`guidanceShell`,
//     and the toolbar's `iconButton`/`menuButton`/`collapseButton`). Lint sees the call it
//     is written at, not the `new Notice` or the `aria-label` two frames down.
//
// `name:` joined that list on 2026-08-21 with `main.ts`'s two command names, and it cost
// exactly one exemption across the whole swept tree — `registerBasesView`'s own `name`,
// the plugin's identity, disabled at the line the way `ui/manualDialog.ts`'s nav heading
// is. It is the widest property name here and the only one that is routinely DATA
// elsewhere (a resource, a lane, a file), which is why it is safe only while the ban is
// scoped to swept regions: pointing it at `domain/` without sweeping it first would fire
// on values the plugin matches on.
//
// A `text:` or `'aria-label'` property is NOT in that list any more: `UI_TEXT_PROPERTY`
// below covers it, and `ui/manualDialog.ts`'s nav heading — the plugin's own NAME, which
// `Every surface translated` says is not translated — carries an `eslint-disable-next-line`
// rather than an exemption for the file.
//
// The runtime half is what holds those: a call site spelling its own English renders it
// beside overridden neighbours in `test/i18n/sweptSurfaces.test.ts`. Neither half covers
// what the other does. A wider rule belongs to `A bare string cannot reach the UI`, which
// makes a bare string unable to reach the UI at all rather than naming where it may not be
// written.
const UI_TEXT_LITERAL = {
	selector:
		"CallExpression[callee.property.name=/^(setName|setDesc|setPlaceholder|setTooltip|setButtonText|setText|setTitle)$/] > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), CallExpression[callee.property.name=/^(setName|setDesc|setPlaceholder|setTooltip|setButtonText|setText|setTitle)$/] > ConditionalExpression > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), CallExpression[callee.name='setTooltip'] > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), CallExpression[callee.name='setTooltip'] > ConditionalExpression > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), NewExpression[callee.name='Notice'] > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), NewExpression[callee.name='Notice'] > ConditionalExpression > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/])",
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
// The property list covers the option-bag names too — `heading:`, `description:`,
// `placeholder:`, `cta:`, `ctaLabel:`, `fieldName:`, `displayName:` — and that was the whole of this rule's
// blind spot rather than a corner of it. `ui/`'s prompts take their frame as an option bag,
// so a swept caller could hand any of them a literal and fail nothing; the runtime half
// caught it and lint did not, which made the "pair" one mechanism wearing two names for
// every prompt in the plugin. Verified by planting at each name, and the swept tree stays
// clean, so the widening costs no exemption.
//
// `reason:` joined on 2026-08-22 with `domain/`'s shelf reasons, and it is the narrowest
// name here rather than a widening of the same kind: `bars.ts` and `roadmap.ts` are the
// only two files in `src/` that spell it as a property at all, and in both it is the
// sentence the shelf card draws under its title. Planted at each of the four and watched
// erroring; nothing else in the tree matches it.
//
// a template whose first quasi is empty (`UI_TEXT_LITERAL`'s own second exemption, for the
// same reason — the capital test has nothing to read), and a prose literal handed to a
// helper as a positional ARGUMENT, which is how `guidanceShell` takes every title and hint
// this module draws. That second one is the file's commonest shape and lint cannot reach
// it: the runtime half in `test/i18n/emptyStates.test.ts` is what holds it, by asserting
// that every string a frame drew carries the fixture catalog's marker.
const UI_TEXT_PROPERTY = {
	selector:
		"Property[key.name=/^(text|label|title|heading|description|placeholder|cta|ctaLabel|fieldName|name|displayName|duplicateWarning|reason)$/]:matches([value.type='Literal'][value.value=/^[A-Z]/], [value.type='TemplateLiteral'][value.quasis.0.value.raw=/^[A-Z]/]), Property[key.name=/^(text|label|title|heading|description|placeholder|cta|ctaLabel|fieldName|name|displayName|duplicateWarning|reason)$/] > ConditionalExpression > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/]), Property[key.value='aria-label']:matches([value.type='Literal'][value.value=/^[A-Z]/], [value.type='TemplateLiteral'][value.quasis.0.value.raw=/^[A-Z]/]), Property[key.value='aria-label'] > ConditionalExpression > :matches(Literal[value=/^[A-Z]/], TemplateLiteral[quasis.0.value.raw=/^[A-Z]/])",
	message:
		'A sentence spelled where it is used cannot be translated. Add a key to src/i18n/en.ts and call t() — and if this is a value the plugin writes, matches or persists rather than text, it belongs in neither place.',
};

// The manual's side of ADR 0031, at the forbidden call rather than in prose. The catalog
// holds sentences the plugin COMPOSES; `view/manual/`'s authored paragraphs are a document
// the dialog displays, and they stay in the module. A `t()` call with no parameters is
// therefore fixed prose that has moved to the wrong artifact — `manual.typesIntro` is the
// one paragraph the plugin composes (the type vocabulary rides in as five parameters, and
// its `are`/`is` agreement cannot survive being joined at a call site), and it passes.
//
// The reverse — a parameterised paragraph left in the module, joined from pieces — is not
// reachable by a selector and is stated rather than checked: the module's entries are
// fixed strings, so composing one means writing the join, which review reads.
const MANUAL_FIXED_PROSE = {
	selector: "CallExpression[callee.name='t'][arguments.length=1]",
	message:
		'The manual is a document, not a catalog (ADR 0031). A paragraph the plugin does not compose belongs in the ManualSection module beside this one, not in src/i18n/en.ts.',
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
		rules: syntaxRules([...WRITE_BOUNDARY, ...PROJECTION_TREE, ...SVG_CLASS_TOKENS, MENU_ANCHOR, OVERBY, TREE_SCAN]),
	},
	{
		// ui/ and commands/, carved out of the general region for the two text bans alone:
		// both were swept into the catalog on 2026-08-19, so the bans have a clean file to
		// hold. Everything else the general region carries applies here unchanged.
		//
		// `domain/viewOptions.ts` joined on 2026-08-21 with its own sweep, and it is the file
		// that made `displayName` worth banning — the option-bag property no other module in
		// `src/` spells. Four more joined on 2026-08-22 with theirs: `estimationOptions.ts`,
		// which is the same object literal for the other view, and `board.ts`, `bars.ts` and
		// `roadmap.ts`, which is what made `reason` worth banning. `releaseOptions.ts` is the
		// fifth and joined on arrival rather than after a sweep — it is the release view's
		// own options bag, the third of the same object literal, and it was written keyed.
		//
		// The REST of `domain/` stays unbanned, and each part of it for its own reason rather
		// than for want of a sweep: `backlogReadme.ts` and `readmeStamps.ts` write English
		// INTO the vault, `defaultModel.ts` is the shipped scoring model's own defaults,
		// `typeVocabulary.ts` and `settings.ts` are the type names and the shipped value
		// lists, and `timeline.ts`'s month names are a formatting question rather than a
		// catalog one. `docs/requirements/Every surface translated.md` states each.
		files: SWEPT,
		rules: syntaxRules([
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			...SVG_CLASS_TOKENS,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// storage/ IS the writer, so the write boundary cannot apply to it. Nothing else
		// about it is special — the menu rule and the overBy rule still do.
		//
		// The three text bans joined on 2026-08-22, and this directory is why "swept" has
		// to be re-derived rather than read: the register called `view/manual/` the only
		// thing left in `src/`, and `storage/` was spelling three live sentences at two
		// `new Notice` calls — one of them the exact ternary-between-two-literals shape
		// `TEXT_TERNARY` exists for, in a directory carrying none of the three. It is not a
		// missed sweep so much as a directory nobody classified: `storage/` persists what it
		// is given, so a sentence here reads as plumbing rather than as UI, and both arrived
		// with a refusal path rather than with a surface.
		//
		// It costs no exemption. Everything else quoted in here is a KEY, a tag or a
		// wikilink fragment — data by the vault test, and none of it capitalised prose at a
		// banned spelling. `baseFile.ts`'s `'Product Backlog'` is the generated view's own
		// title written INTO the `.base`, and it survives because it is at no setter and no
		// banned property.
		files: [STORAGE],
		// `PROJECTION_TREE` joins the list here even though this directory carries no
		// WRITE_BOUNDARY — it IS the write boundary — because the projection ban is about
		// reach rather than about layer: it holds across `src/` with `view/projection.ts`
		// as its ONE exemption, and a directory that quietly fell outside it is exactly the
		// hole this register keeps finding. Verified by planting the comparison here and
		// watching lint go from silent to red (2026-09-02).
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			OVERBY,
			TREE_SCAN,
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
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
			...PROJECTION_TREE,
			OVERBY,
			TREE_SCAN,
			DELIVERABLE_FIELD_READ,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			...RESOURCE_LABEL_BYPASS,
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
		rules: syntaxRules([...WRITE_BOUNDARY, ...PROJECTION_TREE, ...SVG_CLASS_TOKENS, MENU_ANCHOR, RENDERED_ROOTS, VISUAL_DEPTH, OVERBY, TREE_SCAN]),
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
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
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
		//
		// **The three text bans are on the GLOB now** (2026-08-21), which is the collapse
		// the toolbar and empty-state carve-outs were written to wait for: this directory
		// is swept whole, so a file ADDED to it is covered the moment it exists rather than
		// when somebody remembers to name it. That was the standing cost of enumerating —
		// two flat-config blocks matching one file OVERRIDE `no-restricted-syntax` rather
		// than merging, so a swept file needing rules of its own had to repeat the bans,
		// and the two blocks below still do. `view/manual/` is the one part of `view/`
		// still unswept and is not under this glob.
		files: [RENDER],
		ignores: [RENDER_BOARD, ...ROW_CONTROLS],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
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
		// The Deliverables board's own render, carved out of RENDER: `doneOf` reads
		// `item.deliverableDone` directly because this board only ever draws Deliverable
		// cards — it is the board's workflow, not a per-item type dispatch, so
		// DELIVERABLE_FIELD_READ does not apply here. Everything else RENDER carries does.
		files: [RENDER_BOARD],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			// Repeated rather than inherited from RENDER's glob above: one file, one block.
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// The row's own controls, carved out of RENDER: everything RENDER carries, plus
		// ROW_LISTENER — the rule that keeps a per-row control from wiring its own listener,
		// so a render may KEEP a row element without leaving a handler pointing into the
		// model the update replaced. See ROW_CONTROLS's own comment above for why all three
		// files, and render/rows.ts for the delegation and its exemptions.
		files: ROW_CONTROLS,
		ignores: [COLUMNS],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			ROW_LISTENER,
			// Repeated rather than inherited from RENDER's glob above: one file, one block.
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// `columns.ts`, carved out of ROW_CONTROLS above: see COLUMNS's own comment for why
		// ALL_TYPES_IMPORT does not apply here. Everything else ROW_CONTROLS carries does,
		// including ROW_LISTENER — this file still draws the state and horizon chips the
		// tree's delegated listener serves.
		//
		// **What this carve-out no longer sees**, stated because a lifted ban that goes
		// unnamed is the one nobody re-reads: it drops ALL_TYPES_IMPORT for the WHOLE file,
		// not for `shelfBadgeWidth` alone, and this file also draws state and horizon chips.
		// A future type-OFFERING surface added here would import `ALL_TYPES` with lint green
		// — which is the regression ALL_TYPES_IMPORT's own comment exists to stop. eslint
		// scopes by file and cannot scope by symbol, so the narrower rule is not available;
		// what protects it is this sentence and a reviewer reading it. (Final review,
		// PR #187.)
		files: [COLUMNS],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			TREE_SCAN,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			ROW_LISTENER,
			// Repeated rather than inherited from RENDER's glob above: one file, one block.
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// The rest of view/ — everything under it once menu.ts, render/, create.ts,
		// cardMoves.ts and typesSection.ts (handled above and below) are carved out. Same
		// rules the general region has, plus ALL_TYPES_IMPORT and CHILD_TYPE_CHOICES_NULL
		// (any of these files is a candidate sixth type-offering surface) and
		// DELIVERABLE_FIELD_READ (any of these files is a candidate third hand-written
		// workflow ternary).
		//
		// The three text bans joined on 2026-08-21 with the sweep of `writeGate.ts` and
		// `cardMoves.ts`, which were the last English left in this region. `MANUAL` is what
		// the ignore holds out, and it has a block of its own below carrying everything
		// here except those three — a carve-out with no block matches NO
		// `no-restricted-syntax` block at all, since the general `src/**` region ignores
		// `VIEW`. That is the sweep order intact rather than an omission: the manual's
		// prose is unswept, and a ban ahead of a sweep is a ban somebody switches off.
		files: [VIEW],
		ignores: [MENU, ...MENU_SWEPT, RENDER, ESTIMATION, ...RANKING_VIEW, CARD_MOVES, TYPES_SECTION, ...MANUAL],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
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
		// The Estimation view: VIEW's own rules plus the two text bans and the ternary ban.
		// See ESTIMATION above for why this one is a glob where the other swept slices are
		// file lists.
		files: [ESTIMATION],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
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
		// The rest of the swept menu surface: VIEW's own rules plus the two text bans.
		//
		// This paragraph used to say the prompt option bag was outside both rules —
		// `ValuePromptModal` takes its heading, field name, placeholder and call to action
		// that way, and `UI_TEXT_PROPERTY` read only `title:` of the four. That was the
		// rule's whole blind spot rather than a corner of it, so the selector was widened
		// to name them (2026-08-20) and this comment corrected rather than left standing.
		// `test/i18n/menus.test.ts` still reads each prompt back under a marked catalog:
		// lint cannot tell whether a key is READ, only that a literal is not spelled.
		files: MENU_SWEPT,
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
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
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			OVERBY,
			TREE_SCAN,
			// Repeated rather than inherited from VIEW above: one file, one block. It draws
			// nothing and holds no text today, so these three ban a shape rather than guard
			// a sweep — which is the point of putting them on a region instead of a file.
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
		]),
	},
	{
		// The manual DIRECTORY's authored prose, carved out of VIEW for the three text bans
		// alone — the directory rather than its current files, so a content module added
		// tomorrow inherits the decision instead of falling back into VIEW and getting the
		// opposite of it on both sides.
		// That carve-out was temporary until 2026-08-24 — a ban ahead of its sweep —
		// and ADR 0031 makes it permanent: these paragraphs are a DOCUMENT the dialog
		// displays, not messages the plugin composes, so they never move to the catalog and
		// the three bans never apply. `MANUAL_FIXED_PROSE` below is the other direction of
		// the same decision, and it is the only text rule this region carries.
		// Everything else VIEW carries applies here
		// unchanged, and that is the whole reason this block exists rather than an
		// `ignores` entry: the general `src/**` region IGNORES `VIEW`, so a file carved out
		// of VIEW and given no block of its own matches no `no-restricted-syntax` block at
		// all and silently loses the write boundary, the menu-anchor rule and the rest.
		// Verified by planting `menu.showAtMouseEvent` here with no block and watching lint
		// pass (2026-08-21). `typesSection.ts` has its own block below for the same reason.
		files: MANUAL,
		ignores: [TYPES_SECTION],
		rules: syntaxRules([
			...SVG_CLASS_TOKENS,
			...WRITE_BOUNDARY,
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			MANUAL_FIXED_PROSE,
		]),
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
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			OVERBY,
			TREE_SCAN,
			CHILD_TYPE_CHOICES_NULL,
			DELIVERABLE_FIELD_READ,
			...TEXT_TERNARY,
			// This file holds the one keyed paragraph, so it is where the rule matters most:
			// `manual.typesIntro` takes five parameters and passes; a second key added here
			// without any would be prose in the wrong artifact. See ADR 0031.
			MANUAL_FIXED_PROSE,
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
			...PROJECTION_TREE,
			MENU_ANCHOR,
			...RESOURCE_LABEL_BYPASS,
			OVERBY,
			TREE_SCAN,
			ALL_TYPES_IMPORT,
			CHILD_TYPE_CHOICES_NULL,
			// Repeated rather than inherited from VIEW above: one file, one block.
			...TEXT_TERNARY,
			UI_TEXT_LITERAL,
			UI_TEXT_PROPERTY,
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
		// The catalog is DATA, and the one file rule the size budget exists to enforce is
		// already true of it: one concern, no imports, no logic. What it grows with is the
		// number of SURFACES the plugin draws, not the number of things this module does,
		// so the budget can only ever be met by splitting the file a translator is meant
		// to copy whole (`en.ts`'s own header) — which trades the property that makes it
		// translatable for a number. Every other rule above still applies to it.
		//
		// `t.ts` beside it is deliberately NOT exempt: it is code, and it is where any
		// growth in the catalog's own machinery has to justify itself.
		files: ['src/i18n/en.ts'],
		rules: { 'max-lines': 'off' },
	},
	{
		files: [`${TESTS}/*.ts`],
		extends: [tseslint.configs.recommended],
		// Typed, against `tsconfig.test.json` — the project service reads `tsconfig.json`
		// by name and that one covers `src/` only, so a type-aware rule here reports every
		// test file as "not found by the project service" rather than as clean.
		languageOptions: { parser: tsparser, parserOptions: { project: './tsconfig.test.json', tsconfigRootDir: import.meta.dirname } },
		rules: {
			// ONE type-aware rule, not the Obsidian ruleset. Measured on 2026-08-31: the
			// whole ruleset reports 212 findings here, and 164 of them are the doubles doing
			// what they exist to do — `no-nodejs-modules` at a suite that reads files,
			// `prefer-create-el` at the DOM helper that DEFINES `createEl`, the five
			// `no-unsafe-*` rules at every fake. Nine exemptions to buy the 48 that are
			// real, and all 48 come from this rule: an assertion the compiler can see is
			// doing nothing. That is the cast census as a check rather than a grep, so it
			// holds for casts not yet written.
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
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
