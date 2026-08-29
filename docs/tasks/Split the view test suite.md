---
type: Task
order: 10
parent: "[[A test suite that can be navigated]]"
status: Done
priority: P1
area: testing
created: 2026-07-31
source: PR
files:
  - test/helpers/view.ts
  - eslint.config.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Split the view test suite, and give test files a size budget

## Evidence

`test/view/backlogView.test.ts` is **2,800 lines of 4,728 total test lines — 59% of the
suite in one file**, holding 37 `describe` blocks. The next largest test file is 743 lines.

## Why it matters

`src/` has a 400-line `max-lines` cap enforced by lint. `test/` has no cap at all, which
is precisely why this grew unnoticed while every source file stayed in budget. The
asymmetry is the root cause, not the file.

The cost is felt on every future change: you cannot find the test for a behaviour
without searching, and any tweak to the shared harness touches the single largest file
in the repository. It also makes [cover-the-drag-and-drop-branches](Cover%20the%20drag%20and%20drop%20branches.md)
harder than it needs to be — there is nowhere natural for drag/drop tests to grow.

## Approach

Order matters here; the split is not safe until the harness moves.

1. **Lift the shared harness** out to `test/helpers/view.ts`: `makeView`, `expandAll`,
   `rows`, `titlesOf`, `rowByTitle`, `treeOf`, `flush`, `stubRect`, `drag`, `key`,
   `fixture`, `submitPrompt`. This is the prerequisite — without it every split file
   would duplicate it.
2. **Split by subject**, roughly along the existing `describe` groupings:
   `rendering`, `dragDrop`, `keyboard`, `menu`, `filter`, `state`, `contextRows`,
   `persistence`, `batching`, `creation`.
3. **Add a `max-lines` budget to `test/**`** in `eslint.config.mjs` so this cannot
   recur. `test/` is currently in the lint `ignores` list, so it needs its own config
   block rather than a rule change.

## Acceptance criteria

- All 303 tests still pass, with **no assertion changed** — this is pure motion.
- No test file over the new budget.
- `npm run check` green.

## Risks

Low, but the volume is the risk: a mis-split can silently drop a `describe` block. Guard
it by asserting the total test count is unchanged before and after, not just that the
suite is green.

## Outcome

Done. The harness moved to `test/helpers/view.ts` first, with the per-test reset as
`useViewHarness()` — called explicitly by each suite rather than run from the helper's
body, so importing a helper never installs a hook the file did not ask for.
`backlogView.test.ts` then split into twelve subject files, and the two domain suites
that were also over budget (`model.test.ts` at 743 lines, `writePlan.test.ts` at 504)
split along the same seam their outside-filter blocks already formed.

303 tests before, 303 after, no assertion changed.

The budget is `max-lines: 450` (blank lines and comments skipped, as in `src/`) over
`test/**`. Enforcing it meant linting `test/` at all, which needed one decision the
issue did not anticipate: the Obsidian ruleset is type-aware and `tsconfig.json` covers
`src/` only, and its rules are about *shipped plugin* code — the DOM helper exists to
define `createEl`, the fake vault exists to cast to `TFile`. So the plugin rules stop at
`src/` and `test/` gets the TypeScript baseline plus the budget. That alone found two
dead imports and an unused helper.
