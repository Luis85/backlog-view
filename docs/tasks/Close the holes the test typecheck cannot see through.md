---
type: Task
order: 250
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-08-31
closed: 2026-08-31
source: a cast census over test/ after the typecheck gate landed
files:
  - test/helpers/view.ts
  - test/domain/itemTypes.test.ts
  - test/view/cardDrag.test.ts
started: 2026-08-31
finished: 2026-08-31
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Close the holes the test typecheck cannot see through

## Evidence

[[Typecheck the test suite]] got `test/` to zero errors and made
`npm run typecheck:test` a step of the gate. It did not ask what the suite was
already doing to get around a checker it did not yet have.

Counted afterwards: **340 `as never` casts** in `test/`. `never` is assignable to
everything, so each one is a place the new gate reads nothing at all. Two shapes were
most of them — **72 `<vault>.app as never`** and **57
`view.model?.byPath.get('X.md') as never`**.

The first shape was already dead when it was counted. `FakeVault.app` became `T & App`
in the previous task, so the cast converts a value that already satisfies the parameter.
Measured by deleting every one of them from `test/commands/readme.test.ts` and running
the gate: zero errors. The cast was load-bearing before that change and nothing removed
it afterwards.

The second shape was never about a double at all. `byPath.get` returns
`BacklogItem | undefined`, and the cast says "this lookup cannot fail" — at the cost of
turning a broken fixture from a named error into whatever the function does with
`undefined`.

## Approach

Both shapes are deletions rather than replacements.

The dead `.app` casts go, with nothing put in their place. The lookups go through
`itemAt(view, path)` in `test/helpers/view.ts`, which throws `no item loaded: <path>` —
a local copy of it already existed in `test/view/cardDrag.test.ts`, so this is that
function moved to where the other callers can reach it rather than a new idea.

One hand-rolled config went the same way: `test/domain/itemTypes.test.ts` built a
`{ get, getAsPropertyId } as never` object of its own, which is `FakeViewConfig` with two
of its methods and no type. It calls the helper now.

`as never` is not banned. What is left after this pass is 101, and they are the cases
where a double genuinely cannot satisfy the real type — `contextCardWrites.test.ts` alone
holds 16. Those are the subject of the next pass, and the rule for them is the previous
task's: widen once in the helper that makes the double, never at the call site.

## Acceptance criteria

- `npm run check` passes whole, with no coverage floor moved and all 4299 tests passing.
- No `as never` is added, and no `any` or suppression replaces one that is removed.
- Every removal is type-only: `as` is erased before anything runs, so a test whose
  behaviour changed would be a mistake rather than a trade-off.

## Outcome

340 `as never` → **101**. Both mechanical shapes are at zero. 67 files changed.

Two of the removals broke the build and are worth naming, because both are the same
mistake and the gate caught both: an import left behind when the thing that used it went
(`FakeViewConfig` newly needed in `itemTypes.test.ts`, `ProductBacklogView` no longer
needed in `cardDrag.test.ts`). A cast census is a mechanical edit across sixty-odd files,
which is exactly the shape that needs a checker rather than a reading — and the checker
this pass is about is the one that reported them.
