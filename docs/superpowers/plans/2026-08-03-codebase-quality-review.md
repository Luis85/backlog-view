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
| Size | largest `src/` file 376 effective lines against a 400 cap (`domain/model.ts`); 49 modules |
| Dependencies | 0 advisories, 3 runtime deps, all three admitted by ADR 0018 |

[[Codebase health]] closed on 2026-08-01 saying *"this epic is done; the next one should
be opened by new evidence, not by grooming this one."* What follows is that evidence, and
it opens a **second round under that same epic** — its closing paragraph kept as the dated
record of what the first round bought, a new one added beside it (finding 11).

**The through-line:** every finding below is the same defect this repository already named
in [[A comment that states a rule is not a check]] — a property that is true today, stated
in prose, with nothing that would notice it becoming false. The four biggest are the four
places where enforcement stops: the stylesheet, the manifest's platform promise, the
architecture table, and render cost.

---

## Findings, ranked by risk removed per unit of work

### 1. The stylesheet has regression pins, not rules — **Ready**

**What is already there.** `test/view/rendering.test.ts:15` reads `styles.css` and asserts
against it through a `ruleAt` helper that answers cascade questions by source position.
Six assertions, and each is a **pin on a defect that already shipped**: every declared type
gets a badge colour and every extra type its own icon; a struck-through done title stays
removed; both hover-revealed create buttons have a `(hover: none)` reveal written *after*
the `opacity: 0` it overrides; the double-clipped bar override wins on specificity rather
than order; the milestone line takes `pointer-events: none` and its label does not; an
inferred bar stays open at an undated end. So the earlier draft of this note was wrong to
say the gate never reads the stylesheet — it does, and what it checks it checks well.

**The gap.** Those are pins on known failures, not properties of the file. `styles.css` is
**1995 lines and 280 rule blocks**, larger than the two biggest `src/` modules combined,
and `eslint.config.mjs` ignores everything that is not a `.ts` file — so of the budgets
the rest of the codebase lives under (400 effective lines, complexity, layer direction,
banned syntax) it is subject to none, and no rule holds for the file as a whole. Nothing
would notice a literal colour, an `!important`, an unscoped selector, a
direction-dependent value or a `:has()` on a container arriving tomorrow.

The sharpest gap is one no existing pin covers: `src/view/render/columns.ts` computes
`ROW_LEAD_WIDTH` from terms `src/view/CLAUDE.md` says are *"written as its terms … so it
can be checked against `styles.css`"* — **by hand**. A padding changed in the stylesheet
moves a threshold in TypeScript that nothing re-derives, and the symptom is a clipped row
rather than a failed build. Seventeen `--pbl-*` custom properties cross that boundary the
other way.

**Shape.** [[Styling rules are checks]] specifies the file-wide rules down to their
extensions (`transparent` is not a literal colour; a literal in a `var()` fallback still
counts; the direction rule must not key on property names). Its stated precondition —
*"the direction fixes have landed, so the rules pass on today's file"* — belongs to
[[Theming and styling]] and goes first. **Scope the new checker to what the six pins do
not cover**, and leave them where they are: a pin on a specific past defect is a different
instrument from a rule about the file, and folding one into the other loses the reason the
pin exists.

**Cost.** One script step in `npm run check`, in the shape `docs-check.mjs` already has,
plus its own accept/reject corpus the way `test/docs/checkerRejects.test.ts` guards the
docs gate. No new dependency: the rules are line-oriented, and the one that needs
TypeScript (icon-name classification) reads source the way `test/docs/surfaces.test.ts`
already does.

**Why first.** Best risk-to-effort ratio in the list, and the only finding whose
specification is finished.

---

### 2. The touch path is decided, built, and has never met a device

**What is already decided.** Mobile support is not an open question, and this note does
not reopen it. [[Keyboard, menu and touch]] settles it in prose — *"The menu is the
answer on every platform either way"* — and in its acceptance criteria, where Set state
in the context menu is *"the equivalent non-drag path on every platform, and the required
one on touch."* `src/view/render/board.ts:288` wires it, saying so in the comment: *"The
menu is the non-drag path, and on touch the only one."* `styles.css` carries a
`(hover: none)` block revealing the two hover-hidden create buttons, and
`test/view/rendering.test.ts` pins that reveal's cascade order because it once shipped
broken. So `isDesktopOnly: false` is a supported claim, not a careless one, and **flipping
it would remove a path this project deliberately built.**

**The gap.** None of it has been run on a phone. Three questions have no answer:

1. **Does `contextmenu` fire from a long press** in Obsidian mobile? Every non-drag path
   on touch — the card menu, the row menu's move section — hangs off that one event. If
   it does not fire, the "required one on touch" criterion is unmet everywhere at once.
2. **Is mobile drag-plus-menu or menu-only?** [[Keyboard, menu and touch]] names the
   uncertainty exactly — *"on Obsidian mobile native drag from touch has historically not
   fired — the chosen engine claims otherwise, a verdict the smoke test owns"* — and
   assigns it to [[Pragmatic drag and drop for the board]]. Still unrun.
3. **Are the hover-revealed controls actually reachable?** The cascade order is pinned by
   a test; that the reveal *works on a device* is not something jsdom can answer.

Alt+arrow is not a mobile path and is not expected to be — it needs a keyboard.

**Shape.** A verification, not code: run the menu paths on a phone against
`npm run test-build` and record the three answers. Question 2's outcome belongs on
[[Pragmatic drag and drop for the board]], which already owns it. If question 1 fails,
*that* is a defect worth a bug note — the fallback the design rests on being absent —
and it is exactly the kind of thing nothing here can discover.

**Cost.** An afternoon with a phone. **Do not** build a pointer-events drag layer off the
back of it — Pragmatic ships no touch adapter this project has admitted, and ADR 0018
admits runtime dependencies by exception, not by convenience.

**Why second.** It is the only finding whose subject can be wrong in a user's hands today,
and the cheapest thing here is finding out.

---

### 3. Delete the module table rather than gate it

**Evidence.** The root `CLAUDE.md` opens with a table claiming one row per module — the
first thing any contributor or agent reads. It names 48 modules. `src/` holds **49**. The
missing one is **`src/domain/vocabulary.ts`**, there since `798a0c1` folded the three
vocabulary collectors onto one walk. `docs/README.md` has the same hole in miniature: its
folder table lists six and `docs/milestones/` is not one of them, though the prose names it.

**The measurement that decides the shape.** Counting what each guide actually contains:

| File | Table rows | Reads as |
| --- | --- | --- |
| `CLAUDE.md` (root) | **57** | a module inventory plus a rules table |
| `src/domain/CLAUDE.md` | 0 | prose rules, naming a file where a rule is about that file |
| `src/storage/CLAUDE.md` | 0 | the same |
| `src/view/CLAUDE.md` | 0 | the same |
| `test/CLAUDE.md` | 0 | the same |

**The layer guides are already the shape to aim for** and need no rework. That is not an
accident: [[Invariants as checks, not conventions]] step 4 decided it — *"If it cannot be
mechanised, it goes in the layer's own `CLAUDE.md`, beside the code"* — and its extension
4a decided against one wall of text. The entire staleness surface is the root file.

**The rule worth writing down:** *a table that enumerates code goes stale; a table that
states a rule does not.* The module inventory is the first kind. `docs/README.md`'s
conventions, hierarchy pairs and note-kind tables are the second — a code change cannot
falsify them — and they stay.

**Shape.** **Delete the module table**, and replace it with what the layer guides do:
prose saying what each layer is for and which invariants live where, naming a module only
where the sentence is about that module. Nothing is lost, because the fact the table
carries already exists once and is already gated — `docs-check.mjs` rule 7 asserts every
module in `src/` is named by a note under `docs/`, which is how this defect was findable
at all. The table was a second copy of a checked fact, which is the shape
[[Check that a feature lists its use cases]] already retired once for the same reason.

**This supersedes the earlier draft of this finding**, which proposed a new `docs-check`
rule gating the table against `src/`. Gating a duplicate is more machinery than deleting
it. Fix `docs/README.md`'s folder table in the same change — that one is short enough to
be worth keeping accurate.

**Cost.** A documentation edit and one deletion. No new gate.

---

### 4. "A few hundred rows" is a comment, not a check

**Evidence.** `src/view/CLAUDE.md` opens its Cost section with *"Rendering cost is the
scaling limit (a few hundred rows is a normal backlog)"* and then states four structural
claims that keep it true. **Two are already tested**, in
`test/view/rendering.test.ts`'s *targeted subtree rendering* block: `:365` asserts that
collapsing and re-expanding leaves untouched rows' element identities unchanged — which is
exactly the "never `render()`" guarantee — and `:405` asserts that a collapsed subtree
leaves the selection index, which is `refreshRowChildren` pruning `rowEls`.

The two still asserted only in prose are the ones that need instrumentation rather than
assertions on the DOM:

- **No interaction scans the tree** — and this one **is already false as written**.
  `src/view/interactions/dragDrop.ts:139` ends every drag with
  `treeEl.querySelectorAll('.pbl-drag-source')`, a full-tree scan on every `dragend`. So
  the claim in `view/CLAUDE.md` is not merely untested; a test written to it would fail
  today, which is the strongest possible argument for writing it. (The two other scans in
  `src/` are bounded and fine: `rows.ts:75` searches one row, `toolbar.ts:129,150` search
  the toolbar.)

  Two ways to make it true, and the smaller one is better: `clearDragState` already holds
  `activeDropRow` as a single element reference and nulls it on render — the drag source
  can be held the same way, since a mid-drag rebuild detaches the stale element and makes
  it irrelevant by the same reasoning. **Replace the scan** rather than narrowing the
  invariant to the paths that happen to honour it; a rule with an exception carved to fit
  the one violator is not much of a rule.
- **Config lookups are hoisted out of the per-row path.** `chipProps` resolves the columns
  once per data update onto `host.chips`, and `RowContext` carries that snapshot; the
  expensive calls behind it are `config.getOrder()` and `config.getDisplayName()`. Nothing
  fails today if one moves back inside the row loop — the tree still renders, just once
  per row instead of once per pass.

(The `CLAUDE.md` sentence naming `getOrder` / `getDisplayName` as living "on `RowContext`"
is itself slightly stale — they resolve through `chipProps` into `host.chips`. Worth
correcting in the same change.)

**Shape.** Not a benchmark — a benchmark in jsdom measures jsdom. **Both claims are about
calls that should not happen, so both are spies, not assertions on state.**

- Hoisting: spy `getOrder` / `getDisplayName` on the harness's fake config, render a
  several-hundred-row fixture, assert the count is bounded by the column count rather than
  growing with the rows.
- No DOM scan: spy `querySelector` / `querySelectorAll` on the tree element and assert
  neither is called. **Drive drag cleanup as well as selection and a subtree refresh** —
  exercising only the latter two would pass today while `dragDrop.ts:139` is still
  scanning, which is a test that agrees with the comment instead of checking it. Fix the
  scan first, then the spy is a regression guard rather than a known failure.

  Asserting on `rowEls` instead does not test this at all — an interaction that swapped
  `rowEls.get(path)` for `treeEl.querySelector(...)` leaves the map the right size and
  still resolves the right element, so the map-shaped assertion passes while the O(1)
  guarantee is gone. The check has to watch the call that must not be made.

**Cost.** One test file under `test/view/`, using `makeView` and the existing fixtures.
Smaller than the earlier draft of this note assumed, because half the work is done.

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

### 7. Eighteen live-vault verifications are open and there is no cadence for them

**Evidence.** Counted by status rather than by filename: `docs/issues/` holds 20 notes of
the "verification to run" kind, of which **18 are `Open`** — the tree's badges, columns,
menu, drag, keyboard, filter and undo; the board's cards, moves, filtered headers and
column agreements; the roadmap's axis picker, month header, inferred bars and milestones;
the folder-note layout; the visual changes. Every one exists because jsdom cannot see it,
and `docs/README.md` says so plainly: *"appearance and base identity cannot be tested
here."* Several are explicitly written to be **re-run**, not closed.

**Two are already `Done`, and one of those must stay out of the sweep.**
[[Verify base identity in a live vault]] passed on 2026-08-01 and asks to be repeated
only **after an Obsidian or bundler upgrade** — a conditional trigger, not a release
cadence. Folding it into a per-release checklist would silently replace the cadence its
own outcome specifies, and the checks it would replace it with are the ones least likely
to find anything. Conditional verifications keep their own trigger; only the re-runnable
ones join the release step. (An earlier draft of this note said "sixteen", counted off
filenames rather than frontmatter — wrong in both directions.)

This is the project's real stability ceiling, and it is currently a stack rather than a
process. `npm run test-build` already made each run cheap — the note recording the last
pre-release sweep (`cfb655d`) is the proof.

**Shape.** Not automation. Make the sweep a **release step**: `RELEASING.md` gains a line
saying the **re-runnable** verifications run against a `test-build` vault before a tag,
and each note's `Outcome` is dated. Conditional ones stay on their own trigger and are
named as such, so the checklist says which instrument each note is. If a subset turns out
never to catch anything across two releases, that is evidence to retire it — also worth
recording.

**Explicitly rejected:** driving a real Obsidian from Playwright. It would be a second
harness with its own failure modes, gating releases on an app this repository does not
ship, to replace a checklist that takes under an hour.

---

### 8. Modal is already a service — the remaining gap is small

**Evidence.** All four dialogs (`TitlePromptModal`, `FolderPromptModal`,
`TagPromptModal`, `SchedulePromptModal`) live in `src/ui/prompts.ts`, and every caller
imports from there: `interactions/create.ts`, `interactions/plan.ts`,
`interactions/tags.ts`, `commands/scaffold.ts`. No `Modal` subclass exists anywhere else
in `src/`. [[One file per concern]] extension 2b already decided this — *"the code is a
reusable dialog. It goes in `ui/`, a leaf that knows about none of the layers"* — and
`eslint.config.mjs` enforces the leaf with `forbidden('ui', [...])`.

So the consolidation this asks for is **done**. What is left is a shape question, not a
structural one: callers construct with a callback options object
(`new TitlePromptModal(app, { onSubmit })`) rather than awaiting a result. Promise-returning
helpers — `promptForTitle(app, opts): Promise<string | null>` — would read better beside
the `await`-heavy write paths that call them.

**Cost and rank.** Small, and low. It buys readability at four call sites and no
correctness. Take it opportunistically when one of those files is open for another
reason; it does not deserve a branch. The one thing that would raise it: if
`ui/prompts.ts` needs splitting anyway (finding 9), do both in the same pass.

**A `Notice` service was considered and dropped.** `new Notice(...)` is constructed at 19
sites across three layers — `view/writeGate.ts` (5), `view/interactions/*` (8),
`commands/*` (6) — so there is no place to read the plugin's whole voice, and
`src/view/CLAUDE.md` carves out an exception for it (*"Notices are its own"*) precisely
because it is reachable from anywhere. That is a real observation and still not worth its
own work item: [[A bare string cannot reach the UI]] **already requires a typed wrapper
over `new Notice`**, among every other text sink, with a `no-restricted-syntax` ban behind
it. A service built now is the same call wrapped twice, the second wrap unpicking the
first. The seam arrives with finding 5 or not at all; it is recorded here so nobody
proposes it a second time as if it were new.

---

### 9. File structure: nothing forced, three seams worth taking when nearby

Measured in the metric lint actually uses — effective lines, blanks and comments skipped
against the 400 cap:

| File | Effective | Note |
| --- | --- | --- |
| `domain/model.ts` | 376 | closest to the cap; three typed build phases, a real single concern |
| `domain/backlogReadme.ts` | 369 | next closest |
| `view/interactions/keyboard.ts` | 339 | three projections' key handling |
| `view/backlogView.ts` | 330 | down from its pre-`writeGate` size |
| `domain/settings.ts` | 310 | **34 exports** — the most concerns in one file by a distance |

**Nothing is over the cap, so nothing is forced.** Three observations, in the order I
would act on them:

1. **The type vocabulary sits in `settings.ts` to break a cycle.** `LEVELS`,
   `EXTRA_TYPES`, `MARKER_TYPES` and `ALL_TYPES` are declared in `domain/settings.ts`, and
   `byName` — the safe lookup for user-supplied type names — carries the reason in its own
   comment: *"It lives here rather than in `itemTypes.ts`, which is where it reads more
   naturally, because that module imports this one and the dependency cannot run both
   ways."* A cycle broken by putting code in the wrong file is a seam wearing a workaround.
   A vocabulary leaf below both would let `itemTypes.ts` be what its name and the module
   table both say it is. **This is the one I would actually do** — and it becomes cheaper
   the moment finding 5 needs a dependency-free leaf anyway, since that is the same
   structural move twice.
2. **`ui/prompts.ts` is four unrelated dialogs in one file** (258 effective, 12 exports).
   Under the cap, so not urgent — but it is the same shape as the test suite that grew to
   59% of all test code while every source file stayed in budget, and the fix there was to
   split by subject *before* the cap forced it. One file per dialog, or two by kind.
3. **The README feature spans six files across three layers** — `domain/backlogReadme.ts`,
   `readmeText.ts`, `readmeStamps.ts`, `readmeMarker.ts`, `storage/readmeFile.ts`,
   `commands/readme.ts`. Each split has a stated reason and I am not proposing to undo any
   of them; recorded because it is the one place the codebase reads as *over*-split, and a
   future reader deserves to know it was noticed and left alone deliberately.

**What I am not proposing:** splitting `create.ts` or `dropTargets.ts` on fallow's ROI
hints. Both are far under budget in a report reading "0 above threshold", and the signal
there is fan-in, not size — splitting a file to lower a coupling number moves the coupling.

---

### 10. Rule 7's stated reason is about to be deleted, and its real value is somewhere else

**The objection, and it is half right.** `docs-check.mjs` rule 7 requires every module in
`src/` to be named by at least one note under `docs/`. The register **already retired this
exact rule for `test/`**, in its own words: *"what the rule actually asserts is that a path
token appears somewhere under `docs/` — satisfiable by mentioning the file and describing
nothing — so every new test file cost a register edit that guaranteed no reader
anything."* That criticism is sound, and it applies to `src/` word for word.

Worse, the reason given for keeping it on `src/` is anchored to something finding 3
deletes: *"A module is different: **the architecture table names one per concern**, so a
module nothing describes is a real gap."* Take the table away and the stated justification
goes with it. On the documents alone, the rule should go.

**But the documents are not what it is doing.** Measured against every module in `src/`:

| Question | Answer |
| --- | --- |
| Modules named only in record notes (`tasks/`, `issues/`, `bugs/`) | **0** |
| Modules named inside a `## Where it lives` section of a use case | **48 / 49** |
| The exception | `src/view/host.ts`, named in ADR 0003 — an interface, not a behaviour |

So in practice the rule is not "a path token appears somewhere". It is **every module is
claimed by a use case that says what it is for**, with the one architectural module
claimed by an ADR instead. That is a real property, and it is the strongest one this
register has: every line of shipped code traces to a specified behaviour, and a module
that traces to none is a capability built without anyone asking for it.

**Where "self-documenting code" stops.** Code documents *how* it works, and this codebase
does that unusually well. It cannot document *why the module exists* or *which
user-visible behaviour it serves*. `domain/roadmap.ts` can make its bucket partition
obvious; it cannot say that someone wanted a shelf that un-places and stays reachable
while empty. That sentence lives in a use case or nowhere.

**Recommendation: re-anchor, do not delete.** Change rule 7 from *"named somewhere under
`docs/`"* to *"named in a `## Where it lives` section, or in an ADR"*. That:

- **costs nothing to adopt** — it is already true 48/49, and the 49th is legitimately the
  ADR case, so the rule lands on a clean file the way [[Styling rules are checks]] argues
  for;
- **closes the hole the `test/` retirement named** — mentioning a path in passing stops
  satisfying it, which is precisely what made the old rule hollow;
- **survives finding 3**, because it stops depending on a table that is being deleted.

**The cost, stated plainly, because it is the real objection.** This keeps one obligation:
splitting a module means adding a path to an existing use case's `Where it lives`. The
400-line cap says *split*, and this rule says *and name the halves* — two rules pulling
against each other, one line of friction each time. For `test/` that trade was refused
because the line bought nothing. Here it buys the traceability above. **That is a judgment
call about how much the trace is worth, and it is the maintainer's to make** — if the
answer is that it is not worth the line, delete rule 7 outright and let the layer guides
and the code carry it. What should not happen is keeping the rule with its current
justification, which finding 3 is about to falsify.

---

### 11. The findings above are not backlog notes yet

This plan lives in `docs/superpowers/`, which `docs-check.mjs` exempts from work-item
frontmatter. That is right for a plan and wrong as a resting place: nothing here is
ranked, nothing shows up in `Product Backlog.base`, and the register cannot see it.

**Where they go: a second round under the existing [[Codebase health]] epic.** Its
frontmatter is already `status: Open`; what closed was its prose, which says *"As of
2026-08-01 every actionable finding is closed … This epic is done; the next one should be
opened by new evidence, not by grooming this one."*

Reopening it and keeping that paragraph are not in conflict, and both matter. The
paragraph is a **dated record** of what the first round bought, and this register's own
rule is that a record of a moment is not rewritten. So it stays as written, and a second
paragraph is added beside it opening the next round and naming this plan as the evidence
the first one asked for. What must not happen is editing "every actionable finding is
closed" into something hedged — that sentence was true on the day it was written, and its
being true then is the whole reason the second round is legible as a second round.

The three existing features (`Test harness and coverage`, `Enforced invariants`,
`Module structure`, all `Done`, orders 10/20/30) stay closed and stay where they are.

**Shape.** New features at orders 40+, grouping the findings by kind:

| Feature | Covers |
| --- | --- |
| the gates that do not exist yet | findings 1, 4 |
| guides and structure | findings 3, 9, 10 |
| the verifications and their cadence | findings 2, 7 |

with a PBI per finding in the enforced use-case shape: the
`**As** … **I want** … **so that** …` opening, the four-field table, main flow,
extensions carrying their reasons, testable acceptance criteria, and `## Where it lives`.
Finding 6 (branch coverage) hangs off the existing `Test harness and coverage` rather than
a new feature — it is that feature's own subject, and a second feature saying the same
thing is the duplication [[Check that a feature lists its use cases]] retired. Finding 5
stays where it already lives, under `Cross-cutting concerns`, and finding 8 is recorded
prose rather than a note.

`npm run docs` gates all of it: sibling orders unique, every parent pair legal, every
wikilink resolving, every use-case section present once and in order, every extension
labelled against a step the main flow has.

**Cost.** Around eight notes. The extensions are where the work is — that is where this
register puts the thinking, and eight review findings on this plan alone say the hard
parts are the ones a first draft states too confidently.

---

## Sequence

Each step is independently shippable and ends `npm run check` green.

0. **Write the notes** (finding 11) — reopen [[Codebase health]] for a second round and
   hang a feature-plus-PBIs off it per finding, so the rest of this list is ranked in the
   register rather than in a plan file. Everything below is then picked from the backlog,
   not from here.
1. **Delete the module table, fix the folder table** (finding 3) — smallest diff, removes
   a gate rather than adding one.
2. **Answer the mobile question** (finding 2) — a verification, not code; it may change
   what "done" means for the drag work below it.
3. **`cardDrag.ts` branch coverage, then `tags.ts`** (finding 6) — raises the floor under
   everything the card projections do.
4. **The two untested render-cost claims** (finding 4) — the other two are already pinned.
5. **The direction fixes, then `Styling rules are checks`** (finding 1) — the largest item,
   and the one with the most already decided.
6. **The `Multilang` layer, then the sweep, then the sink ban** (finding 5) — after
   the styling gate, because both touch the same render modules and doing them together
   doubles the merge surface. The `Notice` seam arrives here, as the typed wrapper
   [[A bare string cannot reach the UI]] specifies — not as a service of its own. Its own
   epic, not a step in a polish pass.
7. **Fold the verification sweep into `RELEASING.md`** (finding 7) — one line, any time.

Steps 1–4 are a coherent first increment: nothing in them changes shipped behaviour, and
together they close every finding that is *only* a missing check. Steps 5 and 6 are the
two real bodies of work and each deserves its own branch — 6 more than one.

**Findings 8 and 9 are deliberately not in this sequence.** Nothing in them is over a
budget or failing a check, so scheduling them would be scheduling churn. Take them when a
branch already has the file open — with one exception: the vocabulary leaf (finding 9.1)
is the same structural move the catalog needs (finding 5), so if step 6 happens, do both
in it.

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
- `test/view/rendering.test.ts` — the six stylesheet pins, and the two render-cost claims
  already checked
- `src/view/render/columns.ts`, `src/view/render/rows.ts` — the TS↔CSS geometry boundary
- `src/view/interactions/cardDrag.ts`, `src/view/interactions/tags.ts`,
  `src/view/interactions/undo.ts` — the thin branches
- `CLAUDE.md` — the 57 table rows that are the whole staleness surface; the four layer
  guides carry 0 and are the shape to copy
- `src/domain/vocabulary.ts` — the module the architecture table forgot
- `src/domain/settings.ts` — 34 exports, and the type vocabulary parked there to break a
  cycle with `src/domain/itemTypes.ts`
- `src/ui/prompts.ts` — the four dialogs, and the Modal consolidation that already happened
- `src/domain/viewOptions.ts`, `src/ui/prompts.ts` — the two string sites that prove the
  catalog cannot live in either existing directory
- `manifest.json` — the platform promise
