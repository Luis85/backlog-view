---
type: Task
order: 260
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-08-31
closed: 2026-08-31
source: a census of the injection cast over test/, re-run on the merged tree with a tested instrument
files:
  - test/helpers/vault.ts
  - test/helpers/view.ts
  - test/helpers/release.ts
  - test/helpers/estimation.ts
  - test/harness/mount.ts
started: 2026-08-31
finished: 2026-08-31
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The mount injection was a cast nothing needed

## Evidence

[[Close the holes the test typecheck cannot see through]] left the 16-instance mount clone
as its own change. It is the same defect the `as never` census found, wearing a different
cast: **`view as unknown as Record<string, unknown>`**, at **55 lines across 33 files**
(`grep -rcP 'as unknown as Record<string, unknown>' test/ --include=*.ts`, on the merged
tree — `-c` counts LINES, and every match here is on its own line, which `-o` confirms at
the same 55). The earlier note's 35/34 was taken before this branch and is not what the
merged tree measures.

Of those 55, **36 were the mount** — `anyView.app`, `anyView.config`, `anyView.data`, then
`onDataUpdated()` — and **8 more were the same injection re-run** to hand a view a second
result set. The remaining 11 are three other subjects and stay: the DOM prototype
extensions in `test/helpers/dom.ts`, `window.__pbl` in the three browser-harness entries,
and `workspace.getLeaf` stubbed in `test/view/estimation/openNote.test.ts`.

**The cast was not needed, and had not been for two tasks.** Measured by writing the three
assignments against the real types and running `typecheck:test`: `view.app = vault.app`
passes because `FakeVault.app` became `T & App` in [[Typecheck the test suite]], and
`view.config = new FakeViewConfig(…)` passes because `FakeViewConfig` already implements
every member `BasesViewConfig` declares. Only `view.data` failed, and only because
`{ data: entries }` is not a `BasesQueryResult`.

So one narrow double was doing duty for three assignments, and the two that had stopped
needing it went on being cast — the same shape as the 72 dead `.app as never` casts the
previous task found, and found the same way: by deleting the cast and asking the checker
rather than by reading the code.

## Approach

`FakeQueryResult` in `test/helpers/vault.ts` is the double the one real gap needed: `data`,
plus `groupedData`, `properties` and `getSummaryValue` `declare`d — the mock `TFile`'s own
trade, no runtime cost, and a module that starts reading one fails loudly rather than
finding a silent stub. With it, **no mount in the suite casts at all**.

`mountView(view, vault, config, entries)` is the injection stated once, and `setResults`
is its second half for the eight re-injections. Both live in `vault.ts` rather than beside
`makeView`: the browser harness bundles three of their callers, and `view.ts` imports
vitest.

`makeView` then absorbed the hand-written mounts. It needed **one** new option to do it —
`except`, the denylist that 19 of the sites were spelling as a `filter` predicate, and the
way nearly every context-row fixture is written (cut one ancestor, keep the rest). `only`,
`order`, `focus`, `collapsed` and `hideCompleted` already existed and covered the rest;
`setProjection` and `setAxisPick` are public view methods and needed no option at all.
Deliberately no `makeView` variant per caller — that would trade 35 casts for 35 helpers.

Measured by the thing the clone was made of: hand-built
`new ProductBacklogView(fakeController(), containerEl)` mounts in `test/view/`, **30 → 2**
(instrument tested on a positive and a negative line first). The two that stay are the two
that are ABOUT the pre-data state — `toolbar.test.ts`'s loading state and
`toolbarControls.test.ts`'s null model — and neither mounts anything.

## What the cast was hiding

One, found the moment the mount stopped casting. `dependencyMenu.test.ts` built its
replacement entry as `{ ...entry, file: new TFile(path) }`, and a spread does not carry a
prototype method — so on a real `BasesEntry` that fixture would have had no `getValue` at
all. It worked here only because the fake's entries are object literals, which is exactly
the hazard [[The fake vault can hold a cache Obsidian would not produce]] records. The
entry now carries `getValue` explicitly.

## Acceptance criteria

- `npm run check` passes whole, all seven steps, with no coverage floor moved.
- No `any`, no `@ts-expect-error`, and no cast replaces the one removed: every site is a
  corrected call.
- `except` is watched failing: made a no-op it turns 26 tests red across four suites, and
  green again restored. An option nothing depends on would have shown 0.

## Outcome

`as unknown as Record<string, unknown>` in `test/`: **55 → 10**, and the ten are three
subjects that are not a mount. Hand-built mounts: **30 → 2**. Clone groups with the
duplication default off: **454 → 423**; duplication reported by `npm run analyze` fell
**181 → 153 lines**. 4299 tests, unchanged.

Six suites — `contextCardWrites`, `contextRowWrites`, `contextRows`, `menu`, `shelfUx` and
`assignee` — now drive `makeView`, which is what made this its own change rather than part
of the census.

## What is left

1. **`scripts/*.mjs` are still unchecked at the boundary** — unchanged from
   [[Close the holes the test typecheck cannot see through]].
2. **The doubles are still widened rather than verified**, and this task adds one:
   `FakeQueryResult` asserts a `BasesQueryResult` shape and nothing checks that the three
   `declare`d members behave like Bases's. Owned by
   [[The fake vault can hold a cache Obsidian would not produce]].
3. **`mountLeaf` is now the nesting every converted suite mounts in**, where they used a
   bare `document.body.createDiv()`. Strictly closer to what Bases does, and no test
   asserted on the difference — but it is a change to what 28 tests are mounted in, stated
   here rather than left to be discovered.
4. **The remaining ten casts were classified, not swept.** Three subjects, each with a
   reason above; none is a mount.
