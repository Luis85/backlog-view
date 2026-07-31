---
type: PBI
parent: "[[codebase-health]]"
order: 40
status: Open
priority: P2
area: correctness
created: 2026-07-31
source: PR #14 maintainability review
files:
  - src/domain/writePlan.ts
---

# `computeTypeChanges` derives levels from depth

## Evidence

`CLAUDE.md` states the rule plainly:

> `depth` is VISUAL only (focus mode re-roots it). Level math must use
> `effectiveLevelIndex` … **Never derive levels from depth.**

`computeTypeChanges` in `src/domain/writePlan.ts` does exactly that:

```ts
const targetLevel = settings.levels[Math.min(newBaseIdx + (child.depth - dragged.depth), lastIdx)];
```

## Why it matters

It is **safe today**, for reasons that take a paragraph to establish: the walk only
visits descendants of `dragged`, both depths therefore come from the same
`assignVisualDepth` pass, and the relative difference survives focus re-rooting. So the
bug is not live.

The cost is that a documented invariant has a visible exception, and every future reader
has to re-derive why it is fine — or, more likely, copy the pattern somewhere it is not.
An invariant with an unexplained exception stops being load-bearing.

## Approach — and why it is not mechanical

The obvious swap is `child.effectiveLevelIndex - dragged.effectiveLevelIndex`. **This is
not equivalent.** Effective levels clamp at the deepest configured level, so once a
subtree runs deeper than the ladder, the level difference is smaller than the depth
difference, and `Math.min(..., lastIdx)` does not always absorb the discrepancy.

So this needs:

1. A test that pins current behaviour for a subtree deeper than `settings.levels`
   (four levels, five levels of nesting) — before changing anything.
2. A decision about which answer is *correct* for that case, which is a product
   question, not a refactor.
3. The change, with the test updated deliberately if the answer differs.

## Acceptance criteria

- Level maths in `writePlan.ts` no longer reads `.depth`.
- A test covers a subtree deeper than the configured ladder, either way.
- Once true everywhere, add a `no-restricted-syntax` rule banning `.depth` arithmetic
  outside `domain/model.ts` — see [enforce-and-colocate-invariants](enforce-and-colocate-invariants.md).
