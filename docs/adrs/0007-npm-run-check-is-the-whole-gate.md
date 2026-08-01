---
adr: 7
title: npm run check is the whole gate
status: Accepted
date: 2026-07-30
area: tooling
---

# ADR 0007 — `npm run check` is the whole gate

## Context

This repository is worked on by both a human and an agent, often in long sessions with no
reviewer present between commits. Whatever verifies the work has to be **one command**:
something that is always run because it is trivial to run, and that cannot be partially
run by accident.

Splitting it — build here, tests there, lint sometimes — produces the failure mode where
each step passes for someone and the combination has never passed for anyone.

## Decision

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow static analysis
```

All four must pass before committing. CI runs the identical four steps, in the same order.

Each step gates something different:

| Step | Gates |
| --- | --- |
| `build` | Typecheck (`tsc -noEmit`) then bundle |
| `lint` | The Obsidian ruleset, plus **this project's structural rules**: layer direction, the write boundary, ranking over real roots, menu anchoring, level maths, and size budgets |
| `test:coverage` | The suite, under thresholds that **only ever go up** |
| `analyze` | fallow: dead code, duplication, complexity/CRAP fed by the coverage file, dependency hygiene |

## Consequences

- The structural invariants of [ADR 0003](0003-four-layers-enforced-by-lint.md) and
  [ADR 0004](0004-one-write-boundary-planning-separate-from-applying.md) are enforced by a
  command rather than by review. A rule that lives only in prose is followed until someone
  is in a hurry.
- Each mechanical rule is **verified by planting the violation** and watching lint reject
  it. A check nobody has seen fail is a check nobody knows works.
- Coverage thresholds sit just below measured, and rise. That makes deleting a test a
  visible act rather than a quiet one.
- fallow's complexity signal is fed by the coverage file, so "complex and untested" is one
  number rather than two reports to correlate by hand.
- Framework-invoked members that look dead to static analysis (`BasesView.type`, suggest
  callbacks) are **declared** in `.fallowrc.json`, not suppressed inline. A suppression
  comment hides the question; a declaration answers it in one place.
- The cost is a slower commit loop, and a check that fails for reasons unrelated to the
  change in hand — a coverage threshold, a duplication warning. That is the intended
  trade: the alternative is those problems arriving later, in a batch, attributed to
  nobody.

## Alternatives

- **Tests only.** Would have caught none of the layering violations, the second write
  path, or the dead code the fixed vocabulary left behind.
- **CI-only enforcement.** Same four steps, discovered ten minutes later and after a push.
  For an agent working in long sessions that is the difference between a fix and a
  rewrite.
- **A pre-commit hook.** Same steps, made invisible and skippable, and it hides the
  command being run. `check` being typed on purpose is part of why it is trusted.
- **Separate quality gates per concern** with their own schedules. Nobody runs the
  quarterly one.

## Revisit when

The command gets slow enough that it stops being run — the whole decision rests on it
being cheap. That is the metric to watch, not the number of steps.
