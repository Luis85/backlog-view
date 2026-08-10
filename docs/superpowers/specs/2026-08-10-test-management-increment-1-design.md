# Test management, increment 1 — design

Scope: the four PBIs of [[A catalog of tests]] and [[The test catalog projection]] that
ship together —

| PBI | Feature |
| --- | --- |
| [[Test suite and test case as a ladder of their own]] | A catalog of tests |
| [[A badge when the palette is full]] | A catalog of tests |
| [[A projection for the tests]] | The test catalog projection |
| [[Tests stay out of the plan]] | The test catalog projection |

Deliberately **not** in this increment: [[A template for a test case]] (the open-on-create
half is shippable but is not needed for the catalog to be usable), and the whole of
[[Test coverage]]. Those three PBIs are the next increment.

The register notes above are the requirement. This document states only the **mechanism**
— the shapes chosen to satisfy them, and why those shapes rather than the obvious ones.
Where it disagrees with a register note, the note wins and this file is wrong.

## 1. A second ladder that shares its deepest rung

```ts
export const TEST_LEVELS = ['Test suite', 'Test case', 'Task'];
```

`Task` is a rung of **both** ladders. That is the load-bearing choice, and it is what
turns three separately-argued register rules into consequences of one structure:

- [[Test suite and test case as a ladder of their own]] 4c — a typeless child of a suite
  is a `Test case`, of a case is a `Task`. Plain `childLevelIndex` clamping, on the right
  ladder, with no rule of its own.
- [[Tests stay out of the plan]] 2b — *a `Task` takes its parent's projection when that
  parent is in the model; every other type takes its own.* That sentence **is** ladder
  chaining. It is not implemented; it is what the chain does.
- [[Tests stay out of the plan]] 2e — a `Task` whose `Test case` parent is not in the
  model has no parent ladder to chain from, so it falls to its own type's ladder, which
  is the plan's. No vault read, because there is nothing to read: absence is already the
  answer.

### `ladderFor`

One function in `src/domain/itemTypes.ts`:

- a type name that names a rung of exactly one ladder decides the ladder itself — so a
  `Test suite` dragged under an `Epic` is still on the test ladder (4b), and a `Bug` under
  a `Test case` is still on the plan's;
- `Task`, which both ladders name, and a note with no `type` at all, chain from the
  parent's ladder;
- everything else — an extra type, a marker, an unknown custom type — is the plan's.

`BacklogItem` gains `ladder: string[]`, assigned by `computeLevel` in the same pre-order
walk that already resolves the parent's before the child's.

`nextLevelIndex` takes the ladder whose length it clamps to. Every `LEVELS[…]` index
becomes `ladder[…]` — the five the register enumerates (`ladderChild` and `displayType`
in `itemTypes.ts`, the move cascade's two branches and `initWriteFor` in `writePlan.ts`),
found by `grep 'LEVELS\['` rather than by reasoning about which look like ladder
decisions.

### Membership

```ts
export function inCatalog(item: { ladder: string[] }): boolean;
```

One predicate, read from both directions, satisfying [[Tests stay out of the plan]]'s last
acceptance criterion by construction: the catalog draws the items it answers true for and
the plan draws the rest, so neither can claim an item the other also claims.

It asks the **effective** type, not the raw `type` field, because the ladder is chained
from the parent when the field is absent — which is 2b's *"a child of a `Test suite` with
no `type` at all is a `Test case`"* arriving for free rather than as a special case.

### The one guard this costs

`collectFocusRoots` matches `item.levelIndex === focusIdx` against indices into `LEVELS`.
A catalog `Task` has `levelIndex` 2 on **its** ladder, which would make it match a `PBI`
focus. Focus is a plan control ([[A projection for the tests]] 3a), so `collectFocusRoots`
skips catalog members. Stated as *focus is the plan's*, not as an index repair.

## 2. The badge

`renderBadge` branches on `item.levelIndex >= 0` today and indexes `LEVEL_ICONS` and
`pbl-lvl-${levelIndex}` with it. That index is ladder-ambiguous now, so the branch goes.

The replacement is one lookup keyed off `displayType(item)` — the name the badge already
shows:

1. the named-type table, which gains `'test suite'` and `'test case'` (lowercase, space
   kept, per [[A badge when the palette is full]] step 1);
2. failing that, the position of that name in `LEVELS` → `LEVEL_ICONS[i]` / `pbl-lvl-i`;
3. failing that, `pbl-lvl-unknown`.

Shorter than the code it replaces, and correct on both ladders without asking which one
an item is on: a catalog `Task` draws Task's check-square and `pbl-lvl-3`, because
`displayType` says `Task`.

The table is renamed from `NON_RUNG_STYLE` — the test types **are** rungs, so the old name
would be false of two of its own entries.

### Hue and axis

**Orange, borrowed from `Epic`.** An `Epic` is a root by position in the plan and a
`Test suite` is a root by nature in the catalog; after [[Tests stay out of the plan]] the
two populations are disjoint by construction, so no screen can draw both. That is the
strongest available reading of *the one whose existing wearer a test is least likely to
sit beside* — not the least crowded token, which is the reasoning [[A badge when the
palette is full]] 2b refuses.

**The test axis is a solid outline in the borrowed hue.** Every badge carries
`border: 1px solid transparent`; a test badge fills that border in at `0.55` alpha, so it
keeps its tinted fill and gains a visible edge. (Written here as "boxed where the rest read
as filled" before the harness was looked at; it is an ADDITION, not a swap, and the
stylesheet says so now.) It composes with `.pbl-implied`, which overrides to dashed and
transparent — an implied `Test case` therefore reads as outlined *and* as implied, which is
the honest pair rather than a collision.

Stated once in `styles/badges.css`, applied to both entries, beside the Idea/Task pairing
and by the same standard. No colour originates in `styles/`: the hue is
`var(--color-orange-rgb)`, so the Borrowed Palette Rule holds.

Nothing is added to explain the axis (step 4) and `render/legend.ts` is untouched (4a).

## 3. The fifth projection

`Projection` gains `'catalog'`. The stored round trip is **fixed rather than extended**,
per [[A projection for the tests]]' *Where it lives*:

| | Today | After |
| --- | --- | --- |
| `PROJECTION_MODE` | `Record<Projection, …>`, compiler-checked | unchanged |
| `projection()` | a manual `if` chain ending in an unguarded `return 'tree'` | derived by inverting `PROJECTION_MODE` |
| `readEntry`'s allowlist | a hand-written array literal | one exported list of the mode constants in `storage/collapseStore.ts` |

The list runs storage → view, never the reverse: `storage/` may not import `view/`, and
the mode constants already live in storage. All three then agree by construction, and the
next projection inherits every one. Without this the catalog is written correctly and
never activates — `setProjection` stores the constant and renders, and the render asks
`projection()`, so the toggle does nothing the moment it is clicked.

## 4. Projection roots

`renderForest` drops a hidden sibling **without descending through it**, so a projection
that only hides rows loses everything under a hidden parent. Both projections therefore
compute a forest:

```
projectionForest(roots, member) =
  every item the projection draws whose parent it does not draw,
  marked focusRoot when promoted, with depth re-derived by assignVisualDepth
```

One function beside `collectFocusRoots` in `src/domain/model.ts` — the function that
already answers *what does the rendered tree root at when it is not the model's own
roots* — asked twice with opposite predicates. Symmetry is the mechanism, not a courtesy:
[[A projection for the tests]] 2c and [[Tests stay out of the plan]] 2a are one rule read
both ways.

- **The plan's forest replaces `model.roots`** in the unfocused branch. Everything
  downstream that renders, navigates or counts the plan keeps reading `model.roots` and
  gets the exclusion for nothing; `realRoots` stays the true roots for the data
  operations, unchanged.
- **The catalog's forest is `model.catalog`** — `{ roots, items, results }` — computed off
  the **unfocused** tree beside `deliverableResults`, before either focus branch narrows
  anything, for the precedent that field already sets. A stored plan focus therefore
  cannot empty the catalog (3b).

`host.projectionRoots` picks between them per render. Which consumers take it is the
category question `grep model.roots` answers, and the register's table decides each: the
renderer, the filter index, the keyboard walk, the drop targets' positionable list, the
structure ops and `create.ts`'s "which roots a new one is created among" take the
projection's; `create.ts`'s `hasItems`/`inferFolder` and `writePlan.ts`'s backfill and
ranking group keep the whole tree.

Because that is a category invariant, it gets a check at the forbidden thing rather than
six tests: `no-restricted-syntax` makes `model.roots` / `model.realRoots` readable only
inside the module that computes projection roots, with the vault-wide consumers exempted
by name.

### Ranking, which is a third list

Three lists, and conflating any two breaks something ([[A projection for the tests]] 2d):

| List | What it answers | Who reads it |
| --- | --- | --- |
| rendered roots | what is on screen | renderer, keyboard, filter index, collapse seed |
| positionable roots | where a drop lands | `rootDropTarget`, indent/outdent |
| ranking group | what `order` number it gets | `computeInsertOrder`, `renumberWrites`, `endOfSiblingsOrder` |

The third is `model.realRoots` — every parentless item the model holds — and no projection
may narrow it. A promoted root is a `focusRoot`, so it is in the first list and in neither
of the others; a genuine catalog root is in the first two and ranks against the third.

## 5. `treeShaped`

`projection === 'tree'` appears in six gates and `hideCompleted` is written
`!== 'deliverables'`. A predicate answers all seven, and a lint rule forbidding a bare
`projection === 'tree'` outside it is what makes the predicate hold rather than merely
exist — the seventh gate someone writes tomorrow is correct without being told.

`collapsiblePopulation` is deliberately **not** behind it: it decides what a bulk collapse
*touches* rather than whether a button is enabled, so it takes the catalog's forest by
name.

## 6. Rollups stop at a test

The exclusion is a **model** rule, in `assignAll`, not a projection one — the counts are
computed while the tree is built, so a predicate applied at draw time would hide the row
and leave the number it changed ([[Tests stay out of the plan]] 3b).

A test is the **third** exception in that walk and a stronger one than the two that exist:
a context row and a marker each contribute nothing themselves while their subtrees still
reach their ancestors; a test contributes nothing **and nothing from beneath it**, because
a `Task` under a `Test case` is test work. The subtree is still walked — every item needs
its fields — and its rollup is discarded.

The stated cost (3c): a suite shows no "3 of 5 cases done". Accepted here rather than
solved with a second pass.

## 7. Vocabularies

Four of them (`grep 'observed[A-Z]'`), and one sentence applied to each: *a vocabulary is
scoped to the population of the projection that offers it.*

- What the **plan** draws and offers comes from the plan's population — the population,
  not the type list, so a `Task` beneath a `Test case` cannot mint a board column.
- What a **catalog** row's menus offer comes from the catalog's population, so one test
  can be given a value another test already carries.
- `observedDeliverableStates` needs nothing: it is already scoped to `Deliverable`s.
- The generated README keeps the whole vocabulary — it describes the vault.

## 8. Two statements each, twice

- `scripts/docs-check.mjs`: `LEGAL_CHILDREN` gains the pair **and** `ROOT_TYPES` gains
  `Test suite`. Only the second decides whether a parentless suite is legal, and it is a
  set that lists `Epic` and `Milestone` alone.
- `src/domain/backlogReadme.ts`: the hierarchy **table** gains the rungs, and the
  **move-rule prose** stops naming `EXTRA_TYPES` as the types a move leaves alone. It is
  fixed by **deriving** — asking the same predicate `computeTypeChanges` uses — so the
  generated contract cannot drift from the behaviour it describes. Naming `EXTRA_TYPES` is
  what made it wrong here and would again at the next type that is neither a rung nor an
  extra.

## What this design does not answer

**Appearance.** jsdom asserts classes, not pixels. That the orange outline reads as *a
test* at a glance in a real theme, light and dark, is a live-vault check and goes on
[[Smoke test the visual changes]]. `npm run harness` can show the badge's shape and the
catalog's layout against the real stylesheet; it cannot answer the colour, which is
precisely the question.

**Whether Bases accepts a generated view-option key holding a space.** `typeFolderKey`
produces `typeFolder.test suite` — the first multi-word type name in the vocabulary. Not
answerable in this repository; it goes on the smoke-test checklist beside the badge.
