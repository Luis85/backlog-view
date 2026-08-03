# Codebase quality, stability and maintainability — review and plan

> **For agentic workers:** this is a **review with a proposed sequence**, not a task-by-task
> implementation plan. Each item below names its evidence and its shape; the ones marked
> **Ready** are specified elsewhere in this register and need writing, not designing. Turn an
> item into backlog notes before building it — that is what this repository does.

**Reviewed:** `main` at `ae55e2d`, version `0.4.0`, on 2026-08-03.
**Method:** `npm run check` from a clean `npm ci`, per-file coverage, the fallow health
report, `docs-check.mjs` totals, and a read of every layer's `CLAUDE.md` against the code
it governs.

---

## The baseline, stated honestly

Everything the gate can see is green, and most of it is not merely passing:

| Signal | Reading |
| --- | --- |
| `npm run check` | all five steps pass, from a clean install |
| Coverage | 97.77 stmts / 93.44 branches / 99.08 funcs / 99.12 lines, thresholds just below |
| fallow | 0 findings above threshold, 916 symbols analysed, maintainability **88.5 (good)** |
| `npm run docs` | 179 backlog notes, 88 use cases, 19 ADRs, 49 modules — consistent |
| Layering | `main → commands → view → storage → domain` enforced by `no-restricted-imports`, not by prose |
| Write boundary | `processFrontMatter`, `vault.create`, `load/saveLocalStorage` banned outside `storage/` by `no-restricted-syntax` |
| Size | largest `src/` file 652 raw lines (652 → under the 400 effective-line cap); 49 modules, one concern each |
| Dependencies | 0 advisories, 3 runtime deps, all three admitted by ADR 0018 |

`Codebase health` closed on 2026-08-01 saying *"this epic is done; the next one should be
opened by new evidence, not by grooming this one."* What follows is that evidence.

**The through-line:** every finding below is the same defect this repository already named
in [[A comment that states a rule is not a check]] — a property that is true today, stated
in prose, with nothing that would notice it becoming false. The four biggest are the four
places where enforcement stops: the stylesheet, the manifest's platform promise, the
architecture table, and render cost.

---

## Findings, ranked by risk removed per unit of work

### 1. The stylesheet is the one ungoverned file in the repository — **Ready**

**Evidence.** `styles.css` is **1995 lines and 280 rule blocks**, larger than the two
biggest `src/` modules combined. `eslint.config.mjs` ignores everything that is not a
`.ts` file, so of the budgets the rest of the codebase lives under — 400 effective lines,
complexity 16, layer direction, banned syntax — the stylesheet is subject to **none**.
`npm run check` never reads it.

It is not decoration. `src/view/render/columns.ts` computes `ROW_LEAD_WIDTH` from terms
that `src/view/CLAUDE.md` says are *"written as its terms … so it can be checked against
`styles.css`"* — by hand. A padding value changed in the stylesheet moves a threshold in
TypeScript that nothing re-derives, and the symptom is a clipped row rather than a failed
build. Seventeen `--pbl-*` custom properties cross that boundary in the other direction.

**Shape.** Already fully specified in [[Styling rules are checks]], down to the extensions
(`transparent` is not a literal colour; a literal in a `var()` fallback still counts; the
direction rule must not key on property names). Its stated precondition — *"the direction
fixes have landed, so the rules pass on today's file"* — belongs to [[Theming and styling]]
and has to go first.

**Cost.** One new script step in `npm run check`, in the shape `docs-check.mjs` already
has, plus its own accept/reject corpus the way `test/docs/checkerRejects.test.ts` guards
the docs gate. No new dependency: the rules are line-oriented and the one that needs
TypeScript (icon-name classification) reads source the way `test/docs/surfaces.test.ts`
already does.

**Why first.** Highest risk-to-effort ratio in the list, and the only finding whose
specification is finished.

---

### 2. `isDesktopOnly: false` is a promise nothing checks

**Evidence.** `manifest.json` ships the plugin to mobile. All direct manipulation is
HTML5 drag: `src/view/render/rows.ts:136` sets `row.draggable`, and
`src/view/interactions/cardDrag.ts` uses Pragmatic's `element/adapter`, which is the same
native drag events underneath. Touch fires none of them. So on a phone, in all three
projections, **every drag is silently absent** — not refused, not explained, just inert.

The non-drag paths exist and are good — the card menu, the row menu's move section,
`performBoardMove` / `performHorizonMove` reachable from three inputs each — but
Alt+arrow needs a keyboard, and `styles.css:983` already carries a `(hover: none)` block
admitting the reveal-on-hover controls are unreachable. [[Keyboard, menu and touch]] is
`status: Active`, `priority: P2`, and has never been answered by a device.

**Shape.** Not code, at first: a verification. Run the existing menu paths on a phone
against `npm run test-build`, and then take one of two decisions and record it —
either the menu paths are the documented mobile story (README says so, and the drag
affordances hide under `(hover: none)` rather than pretending), or `isDesktopOnly` flips
to `true` until a touch drag layer exists.

**Cost.** An afternoon with a phone plus one note. **Do not** build a pointer-events drag
layer to close this — Pragmatic ships no touch adapter this project has admitted, and
ADR 0018 admits runtime dependencies by exception, not by convenience.

**Why second.** It is the only finding that can be wrong in a user's hands today, and the
cheapest thing here is finding out.

---

### 3. The architecture table nothing gates is already wrong

**Evidence.** The root `CLAUDE.md` opens with a table claiming one row per module —
the first thing any contributor or agent reads. It names 48 modules. `src/` holds **49**.
The missing one is **`src/domain/vocabulary.ts`**, which has been there since
`798a0c1` folded the three vocabulary collectors onto one walk.

`docs-check.mjs` rule 7 already asserts that every module in `src/` is named by at least
one note under `docs/` — so the register caught it and the table did not, because nothing
reads the table. `docs/README.md` has the same hole in miniature: its folder table lists
six folders and `docs/milestones/` is not one of them, though the prose names it.

**Shape.** One rule in `docs-check.mjs`, the same shape as rule 7 and matching whole
paths for the same reason: every `src/**/*.ts` appears in the root `CLAUDE.md` table, and
every path the table names exists. Add the reject case to
`test/docs/checkerRejects.test.ts` and the accept case beside it.

**Cost.** Perhaps twenty lines and two test cases. Fix the two current gaps in the same
change so the rule lands on a clean file — the argument [[Styling rules are checks]]
already makes for itself.

---

### 4. "A few hundred rows" is a comment, not a check

**Evidence.** `src/view/CLAUDE.md` opens its Cost section with *"Rendering cost is the
scaling limit (a few hundred rows is a normal backlog)"* and then states four structural
claims that keep it true: expand/collapse calls `refreshSubtree` and never `render()`;
`rowEls` indexes path → element so no interaction scans the DOM; `refreshRowChildren`
prunes the subtree it removes from `rowEls`; per-render config lookups are hoisted onto
`RowContext`. It also admits the one that is not true: *"Data updates still rebuild
everything."*

Every one of those is a testable structural property, and **none is tested**. The
repository's own rule says an invariant asserted in a comment gets a test that fails
without it — six of ten review findings on one pull request were exactly this
([[A comment that states a rule is not a check]]).

**Shape.** Not a benchmark — a benchmark in jsdom measures jsdom. One regression guard:
build a several-hundred-item model through the existing view harness, then assert the
structural claims. Expanding a row leaves the sibling rows' element identities unchanged
(so `render()` did not run); collapsing prunes `rowEls` to the rows on screen; the row
count is the visible count and not the model count. Each fails if someone reaches for
`render()` in the targeted path.

**Cost.** One test file under `test/view/`, using `makeView` and the existing fixtures.

---

### 5. Every user-visible string is inline, in ~141 places — **Ready, and larger than it looks**

**Evidence.** [[Multilang]] already counted it, from a derived grep rather than a
recalled list: **about 141 user-facing text sites across 15 files**, every one an English
literal spelled inline. `domain/viewOptions.ts` alone holds 30, `render/toolbar.ts` 23,
`render/columns.ts` 20, `interactions/menu.ts` 16, `ui/prompts.ts` 13. There is no place
to read the plugin's whole voice, and the marketplace's sentence-case rule is enforced by
eye. (An earlier draft of this note said "40-odd" — that was a narrow grep of `Notice`
and `text:`, and the register's number is the right one.)

**Shape.** Specified across [[The string catalog]], [[A bare string cannot reach the UI]]
and the feature note above them. Three of that specification's decisions are already
argued, and this plan defers to all three rather than re-deciding them:

- **The catalog is a new leaf below everything**, not a file in an existing directory.
  [[Multilang]]'s *"Where the catalog lives"* works it out: `ui/` may import nothing
  (`forbidden('ui', ['view', 'commands', 'domain', 'storage'])`) yet `ui/prompts.ts` has
  13 sites, and `domain/` may not reach `ui/` yet `domain/viewOptions.ts` has 30. A
  catalog in either is unreachable from at least one caller, so it needs its own
  directory plus its own `forbidden` entry naming every other one.
- **The enforcement is typed rendering wrappers plus bans on the raw sinks**, not a
  selector over `Notice`. [[A bare string cannot reach the UI]] derives the sink
  inventory from the code — `setTooltip` 23, `setTitle` 20, `new Notice` 14, `setText`
  11, `text:` 30, `displayName:` 21, and the native DOM assignments a branded type cannot
  reach — and records that listing that set from memory came up short three times. A
  narrower rule would leave a literal assigned to a local, or returned from a helper,
  passing.
- **The whole layer lands before the sweep.** [[Multilang]]'s *"Order of work"* refuses
  the tempting split — catalog first, locale resolution later — with the reason: *"A
  half-built layer means a hundred strings get moved against an interface that then
  changes."* English still ships as the only catalog ([[English ships alone]]); that is a
  scope decision, not a staging one.

**Cost.** Real: the layer, then a 141-site sweep, then the lint rule. This is the largest
item in this plan and the one whose specification is most complete. It is here as the
maintainability finding it is, not as something to squeeze into a polish pass.

---

### 6. The thin coverage is concentrated in the failure branches of shared code

**Evidence.** The four weakest branch figures are not random:

| Module | Branches | Why it matters |
| --- | --- | --- |
| `view/interactions/cardDrag.ts` | **60%** (lowest in `src/`) | the ONE drag controller both card projections ride |
| `view/interactions/tags.ts` | 71% | the delta write, whose whole reason is a race |
| `view/interactions/undo.ts` | 80% | the partial-failure remainder and `UndoRecovery` |
| `view/backlogView.ts` | 80.5% | the projection dispatch and lifecycle |

Uncovered ranges point at the same thing in each: `cardDrag.ts:40-57` and `:157-161` are
the registration cleanup and the announcement, `tags.ts:20-22,36-39` the normalization
refusals, `undo.ts:102,118` the recovery path.

**Shape.** Named increments, not a coverage push. `cardDrag.ts` first — it is the module
`docs/issues/Pragmatic drag and drop for the board.md` introduced, and the one whose
failure would be silent in two projections at once. Raise the branch threshold in
`vitest.config.mts` as each lands; that file already says thresholds only go up.

---

### 7. Sixteen live-vault verifications are open and there is no cadence for them

**Evidence.** `docs/issues/` holds 16 notes of the "verification to run" kind — the tree's
badges, columns, menu, drag, keyboard, filter and undo; the board's cards, moves and
filtered headers; the roadmap's axis picker, month header, inferred bars and milestones;
the folder-note layout; base identity. Every one exists because jsdom cannot see it, and
`docs/README.md` says so plainly: *"appearance and base identity cannot be tested here."*
Several are explicitly written to be **re-run**, not closed.

This is the project's real stability ceiling, and it is currently a stack rather than a
process. `npm run test-build` already made each run cheap — the note recording the last
pre-release sweep (`cfb655d`) is the proof.

**Shape.** Not automation. Make the sweep a **release step**: `RELEASING.md` gains a line
saying the re-runnable verifications run against a `test-build` vault before a tag, and
each note's `Outcome` is dated. If a subset turns out never to catch anything across two
releases, that is evidence to retire it — also worth recording.

**Explicitly rejected:** driving a real Obsidian from Playwright. It would be a second
harness with its own failure modes, gating releases on an app this repository does not
ship, to replace a checklist that takes under an hour.

---

## Sequence

Each step is independently shippable and ends `npm run check` green.

1. **Fix the two documentation gaps and gate the table** (finding 3) — smallest diff, and
   it lands the enforcement on a clean file.
2. **Answer the mobile question** (finding 2) — a verification, not code; it may change
   what "done" means for the drag work below it.
3. **`cardDrag.ts` branch coverage, then `tags.ts`** (finding 6) — raises the floor under
   everything the card projections do.
4. **The render-cost regression guard** (finding 4) — turns four prose claims into checks.
5. **The direction fixes, then `Styling rules are checks`** (finding 1) — the largest item,
   and the one with the most already decided.
6. **The `Multilang` layer, then the sweep, then the sink ban** (finding 5) — after the
   styling gate, because both touch the same render modules and doing them together
   doubles the merge surface. Its own epic, not a step in a polish pass.
7. **Fold the verification sweep into `RELEASING.md`** (finding 7) — one line, any time.

Steps 1–4 are a coherent first increment: nothing in them changes shipped behaviour, and
together they close every finding that is *only* a missing check. Steps 5 and 6 are the
two real bodies of work and each deserves its own branch — 6 more than one.

---

## Deliberately not doing

- **Splitting `create.ts` or `dropTargets.ts`.** fallow lists them as refactoring targets
  on ROI, at 190 and 115 LOC — both far under budget in a report that says *"0 above
  threshold"*. Fan-in is the signal there, not size, and splitting a file to lower a
  coupling number moves the coupling.
- **Rebuilding the outcome report.** [[The outcome report was built from one sentence]]
  records eleven findings across seven rounds without reaching a correct rule, and names
  the reason: nothing correlates a Bases pass with a write. Read that note before anyone
  proposes it again.
- **Adding `npm audit` to `check`.** ADR 0019 refuses it with a reason.
- **Chasing coverage on `src/main.ts`.** It is excluded by policy and exercised by
  `test/docs/surfaces.test.ts`, which runs `onload()` to discover the commands. Covering it
  for a number would test the Obsidian `Plugin` runtime.
- **Widening the TypeScript or `@types/node` ranges.** `.github/dependabot.yml` states why
  both are pinned; neither is staleness.

## Where it lives

- `styles.css`, `eslint.config.mjs`, `docs-check.mjs`, `vitest.config.mts` — the four gates
- `src/view/render/columns.ts`, `src/view/render/rows.ts` — the TS↔CSS geometry boundary
- `src/view/interactions/cardDrag.ts`, `src/view/interactions/tags.ts`,
  `src/view/interactions/undo.ts` — the thin branches
- `src/domain/vocabulary.ts` — the module the architecture table forgot
- `src/domain/viewOptions.ts`, `src/ui/prompts.ts` — the two string sites that prove the
  catalog cannot live in either existing directory
- `manifest.json` — the platform promise
