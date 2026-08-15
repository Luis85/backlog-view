---
type: Feature
parent: "[[Codebase health]]"
order: 70
status: Done
area: testing
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: 2026-08-03
due: 2026-08-14
risk: ""
assignee: Ben
---

# The model build states its cost as a check

[[The render path states its costs as checks]] asked the cost question of the view and
never asked it of the layer underneath, though it **quoted** the sentence that admits the
gap: `src/view/CLAUDE.md` says *"Data updates still rebuild everything."* `buildModel`
makes a fixed list of passes over every item on every data update, and a write batch ends
in a refresh — so this cost is paid on each move, not only when the vault changes
underneath. Nothing stated the bound and nothing checked it.

**Outcome** — The build's bound is written down, and the part of it a test can reach fails
`npm run check` when it stops being true.

## Landmines, before implementation

**This layer can be measured honestly, which is why it is worth doing here.** `domain/`
has node tests and no harness, so nothing in this feature is measured through jsdom the
way a render benchmark would have been.

**The bound is O(n log n), not O(n).** `sortSiblingsDeep` calls `Array.sort` per sibling
group — comparison sorting, and the right tool for ranking siblings. A requirement written
as O(n) sends an implementer at correct code: they would either replace working ordering
logic or write an operation count that has to be fudged to pass. The superlinear step is
named as the bound, and what is checked is that nothing *else* joins it.

**Do not build a seam to count a traversal.** The two properties below are observable from
outside `buildModel` because the vault read and the sort are calls a spy can already see.
A walk is not, and a counter threaded through the phases to make one visible would be a
seam built for the test — the thing `test/helpers/register.ts` refuses one level up.
Narrow the guide sentence instead.

## Acceptance criteria

- `src/domain/CLAUDE.md` states the build's bound, and separates the part backed by a
  check from the part that is prose — a claim that reads like a guarantee and is backed by
  nothing is what this whole round exists to remove.
- Every claim it presents as checked fails a test when broken, and the test is watched
  failing before it is trusted.
- No check in this feature asserts on elapsed time.

## Where it lives

`src/domain/model.ts` · `test/domain/modelCost.test.ts` · `src/domain/CLAUDE.md`
