---
type: PBI
parent: "[[codebase-health]]"
order: 50
status: Open
priority: P2
area: tooling
created: 2026-07-31
source: PR #14 maintainability review
files:
  - CLAUDE.md
  - eslint.config.mjs
---

# Enforce the invariants that can be enforced, co-locate the rest

## Evidence

`CLAUDE.md` is 317 lines. The **"Invariants that bite" section is 135 of them — 43%** —
as a flat list of 46 bullets.

## Why it matters

That section is the single most valuable artefact in the repository and its largest
point of rot. Prose drifts from code silently; nothing fails when it does. It is also
re-read in full on every agent turn, and a flat 46-item list is past the length where a
human reads it before touching the code.

Two of these invariants have already been converted into checks, and both paid for
themselves immediately:

- The layer DAG → per-directory `no-restricted-imports`.
- "Never write frontmatter outside the writer" → `no-restricted-syntax` banning
  `processFrontMatter`, `vault.create` and `load/saveLocalStorage` outside `storage/`.

**Every invariant that becomes a check is one that can never rot.** That is the lever.

## Approach

### 1. Enforce what is enforceable

Candidates, in order of value:

- **"Never derive levels from depth"** — `no-restricted-syntax` on `.depth` arithmetic
  outside `domain/model.ts`. Note this currently *would* flag `computeTypeChanges`; fix
  [stop-deriving-levels-from-depth](stop-deriving-levels-from-depth.md) first.
- **"Data operations use `realRoots`, not `roots`"** — harder, but a rule banning
  `model.roots` inside `domain/writePlan.ts` would cover the paths that matter.
- **Test file size** — see [split-the-view-test-suite](split-the-view-test-suite.md).

### 2. Co-locate the remainder

`src/` is now layered, so invariants can sit with the layer they govern: the context-row
rules with `domain/`, the render-cost rules with `view/render/`. `CLAUDE.md` keeps the
cross-cutting ones and an index, and stops being a single wall.

### 3. Prune what is now structural

Some entries describe defences that are now enforced in code (`applySafely` refusing a
whole batch, the write boundary). Those can shrink to one line naming the mechanism
rather than arguing the case.

## Acceptance criteria

- At least one further invariant converted from prose to a failing check.
- "Invariants that bite" materially shorter, with nothing lost — moved, not deleted.
- Each remaining bullet still says *why*, not just *what*; the reasoning is the part
  that stops someone undoing it.
