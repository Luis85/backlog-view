---
type: Task
order: 310
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: tooling
created: 2026-09-02
closed: 2026-09-02
source: npm run analyze, the widest clone family in src/
files:
  - src/view/scopeRow.ts
  - src/view/mywork/renderTree.ts
  - src/view/release/scopeTree.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The second scope tree was a copy, and stayed one

## Evidence

[[A second fallow pass, and the three findings it was worth acting on]] named this and
declined it, twice: **the widest clone family in `src/`**, four groups and 139 lines
between `view/mywork/renderTree.ts` and `view/release/scopeTree.ts`, with fallow's own
advice to extract them into a shared directory.

Read the register before the code, and the register says it was already intended.
`docs/superpowers/plans/2026-08-31-assigned-work-in-the-sidebar.md` planned the second tree
as a copy of the first and planned to extract what they share — and it DID, for the halves
it named: `scopeFolds.ts`, `scopeKeys.ts`, `selection.ts`, `domain/scopeRows.ts` and
`render/badges.ts` are imported by both. What it did not reach was the row DRAWING, and
that is what stayed copied.

## Approach

`src/view/scopeRow.ts` — the family `scopeFolds.ts` and `scopeKeys.ts` already established,
one more member. Three parts, and each differs between the two copies by at most one value:

- **`wireRowOpen`** — the primary and middle click that open a row's note. Byte-identical
  in both, modulo comment length. NOT `wireOpenGestures`, which looks like the same helper
  and is not: that one reads `BacklogViewHost.openItem`, while both of these views carry an
  `opener` and an `openContext()` instead. The shared interface is those two members,
  structural, so a third tree earns it by carrying what it already needs.
- **`drawScopeBadge`** — the type badge. See below.
- **`drawScopeStateChip`** — the static state chip. The column class is the whole of what
  varied; each tree owns its own cell width.

**The disclosure is deliberately not among them.** Its two copies differ in their labels
AND in what a toggle does — one folds per person, one per release — so sharing it means a
callback plus a label pair, leaving a function whose whole body is its arguments. Its 15
lines are two of the 27 that remain.

## The two files disagreed about a fact, and neither had checked it

`scopeTree.ts`'s badge carried `if (!badgeText) return;`. `renderTree.ts`'s carried a
seven-line comment arguing that guard is unreachable — every row either tree draws is a
`ScopeRow` from `scopeRows.ts`'s own walk, which keeps only a real `BacklogItem`, and
`displayType` answers `''` only for an item both off the ladder and untyped.

**Both draw from that same walk, so they cannot both be right**, and nothing checked
either. The guard is KEPT in the shared function, and that is the cheap direction rather
than a verdict: an unreachable guard costs a comparison, while removing one that turns out
to be reachable draws an empty badge box on a real row. Settling it means a test over
`scopeRows`' output, which is its own change and is not owed by this one.

## Acceptance criteria

- `npm run check` passes whole, no coverage floor moved: 4563 tests.
- No behaviour changes on either screen — same markup, same classes, same listeners, in the
  same order. The one exception is the badge guard above, which is unreachable if
  `renderTree.ts`'s comment is right and an improvement if it is not.
- `npm run harness` still bundles; both scope suites (21 files, 286 tests) green.

## Outcome

The `renderTree`/`scopeTree` clone family: **4 groups and 139 lines → 2 groups and 27
lines**. Duplication reported by `npm run analyze`: **714 → 543 lines**. The two modules
lose 65 and 84 lines; `scopeRow.ts` is 131, most of it the comments both copies were
carrying separately.

**What the 27 remaining lines are is worth stating, because one of them is not a finding.**
Fifteen are the disclosure, left on purpose above. The other twelve are the two files
CALLING the shared parts in the same order — `drawDisclosure`, `wireRowOpen`,
`drawScopeBadge`, then the title and its tooltip. That is the extraction working rather
than a leftover: removing it would mean sharing `drawRow` itself, whose two halves diverge
immediately afterwards (a rollup on one, a next-marker on the other).

## What is left

1. **`myWorkView.ts` and `releaseView.ts` are the other family** — 2 groups, 40 lines,
   unchanged by this. Not looked at here.
2. **Whether the badge guard is reachable**, above.
3. **No live-vault check is owed by this change** and one is not claimed either way: it
   moves code without changing what is drawn, and the harness plus 286 scope tests are what
   say so. A change that altered either row's appearance would owe one.
