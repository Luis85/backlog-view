---
type: Task
order: 20
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: correctness
closed: 2026-08-01
created: 2026-07-31
source: PR
files:
  - src/domain/writePlan.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
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
  outside `domain/model.ts` — see [enforce-and-colocate-invariants](Enforce%20and%20colocate%20invariants.md).

---

## Outcome

Done, and the product question the plan reserved turned out not to exist.

The swap the plan warned against — `child.effectiveLevelIndex - dragged.effectiveLevelIndex`
— really is not equivalent, and it is also not the right shape. The cascade is planning
types for a subtree *that has not been written yet*, so the levels to descend by are the
new ones, not the stale ones. It now carries the parent's **new** level down the walk:

```ts
const walk = (node, nodeLevel) => {
  const childLevel = nextLevelIndex(nodeLevel, settings.levels);
  ...
  walk(child, childLevel);
};
walk(dragged, newBaseIdx);
```

That is the same chain `computeLevel` runs once the writes land, so the plan and the
model it produces cannot disagree — and it is *provably* what the depth arithmetic
computed, since `min(min(x + 1, L) + 1, L) = min(x + 2, L)`. Chaining clamps at every
rung; the old form clamped once at the end; the results are identical. So there was no
behaviour change to decide about, and the 131 domain tests passed untouched.

The clamp is now stated once, in `nextLevelIndex` — `childLevelIndex` is that rule
applied to an item, and the cascade is the same rule applied to a level still being
planned. Three tests were added anyway, because the equivalence is an argument and the
tests are evidence: a five-deep subtree against the four-level ladder (the case the plan
asked for, where the two deepest notes are already `Task` and are not written at all), a
`Task` nested straight under an `Epic` (tree distance 1, declared distance 3 — retyped by
the rung it occupies), and a custom `Bugfix` that keeps its type while still consuming a
rung for its children.

**The lint rule is live.** `VISUAL_DEPTH` bans `.depth` in the two ranking files, and was
verified the way this repo verifies such rules — plant the violation, watch lint reject
it (2 errors), restore, clean. It is scoped rather than global because `rows.ts` reads
`depth` for `aria-level`, where visual depth is exactly the right answer. This closes the
last item deferred by
[enforce-and-colocate-invariants](Enforce%20and%20colocate%20invariants.md).
