---
type: Feature
parent: "[[Codebase health]]"
order: 50
status: Done
area: testing
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-03
risk: ""
assignee: Chris
priority: ""
iteration: ""
---

# The render path states its costs as checks

The four claims `src/view/CLAUDE.md` makes about what keeps rendering cheap are checks.
Two already are. One of the remaining two is not merely unchecked — it is false.

**Outcome** — A change that quietly makes rendering O(n) where it was O(1) fails a
command, instead of arriving as "the tree got slow somewhere around six hundred rows".

## Landmines, before implementation

**Fix the scan before writing the test that watches for it.** The invariant *"no
interaction scans the DOM"* is already violated by `src/view/interactions/dragDrop.ts`
(see [[The drag cleanup scans the whole tree]]). Write the spy first and it fails on
`main`, which reads as a broken test rather than a found defect, and the likely response
is to narrow the assertion until it passes — around the one violator, which is how a rule
becomes decoration.

**A benchmark is the wrong instrument and jsdom makes that obvious.** Nothing here
measures time; both remaining claims are about **calls that must not happen**, so both are
spies. A timing assertion in jsdom measures jsdom, and would be the kind of check that
fails on a loaded CI runner and gets deleted.

## Acceptance criteria

- Each of the four cost claims in `src/view/CLAUDE.md` is either checked or deleted from
  the guide — no claim survives there unbacked.
- The two claims already checked keep their existing tests rather than gaining duplicates.
- No check in this feature asserts on elapsed time.

## Where it lives

`src/view/CLAUDE.md` · `src/view/interactions/dragDrop.ts` · `src/view/render/columns.ts` ·
`test/view/rendering.test.ts`
