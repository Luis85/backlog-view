---
type: Issue
order: 100
parent: "[[A view per capability]]"
status: Done
priority: P1
area: architecture
created: 2026-08-16
closed: 2026-08-16
source: software design document, 2026-08-16
files:
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

# The SDD's layers are not the four this repository enforces

## The question

The software design document of 2026-08-16 proposes a five-area structure —
`plugin/`, `core/`, `application/`, `infrastructure/`, `views/` — with dependencies running
inward and the domain importing neither Obsidian nor the DOM. This repository already
enforces a four-layer structure with the same *intent* and different names and edges:

```
main → commands → view → storage → domain
```

with `ui/` and `i18n/` as leaves, checked by per-directory `no-restricted-imports` in
`eslint.config.mjs` and recorded in [ADR 0003](../adrs/0003-four-layers-enforced-by-lint.md).

Both say the pure logic must not reach the effectful code. They disagree about what the
boxes are called, where the boundary between "decide" and "do" sits, and whether the layer
between them is a use-case layer of its own.

Nothing in the register or the code has been changed to match the document. That is
deliberate: **the shipped architecture is the one `npm run check` enforces**, and a
document is not a lint rule.

## Why it is not obvious

The two are not the same shape with different labels:

- **`storage/` is one directory because "everything that puts bytes in the vault is in one
  place" is a checkable sentence** — a `no-restricted-syntax` rule bans `processFrontMatter`,
  `vault.create` and the localStorage calls everywhere else. The SDD's `infrastructure/`
  splits that across `vault/`, `metadata/`, `bases/`, `events/` and `mutations/`. The split
  is more descriptive; the question is whether the ban survives it as one rule or becomes
  five.
- **The SDD adds an application layer this codebase does not have.** Today a use case is a
  host method plus a planner in `domain/`, and the planners are pure. Whether an
  `application/` layer buys anything beyond a directory is a real question, and the honest
  answer probably depends on how many views end up sharing a use case.
- **The proposed tree is deep**, and this repository's line and file rules are tuned to a
  flat one. A rename touches every import, every layer rule, every `## Where it lives`
  section in the register, and the docs check that verifies them.

**The test tree is the same disagreement, one directory down.** The document proposes
`tests/unit`, `tests/integration` and `tests/fixtures`; this repository's `test/` mirrors
`src/` directory for directory, which is what makes "where does the test for this module
live" answerable without a convention nobody can check. Whichever way the source tree goes,
these two answers have to agree, because a test tree organised by *kind* and a source tree
organised by *layer* is the arrangement where a moved module leaves its test behind.

## What a decision would look like

Not a big-bang rename. The parts that can be answered separately:

1. Does a shared kernel need its own directory, or is today's `domain/` already it under
   another name? Answer this first — it decides how much else moves.
2. Does an application layer earn its place once a second view exists, measured by what two
   views would otherwise duplicate?
3. If the names change, the layer rules, ADR 0003 and every register path move in the same
   change, because a layering nothing checks is a diagram.

Whichever way it goes, the outcome is an ADR that supersedes or confirms 0003, and this
issue closes naming it.

**Closed on 2026-08-16 by [ADR 0030](../adrs/0030-domain-is-the-kernel.md).**

1. Answered: today's `domain/` already is the shared kernel — pure, node-tested,
   lint-fenced — under its own name. No directory moves.
2. Answered: no application layer, not yet. A use case stays a host method plus a pure
   planner; the test for adding one is two views measurably duplicating the same use
   case, counted in code once a second view exists rather than predicted now.
3. Does not trigger: the names do not change, so the layer rules, ADR 0003 and every
   register path stay where they are.

That answers the three criteria below, in the same order: the first is met by this
record landing in writing before any directory is created under `src/` — this closing
task is docs-only, nothing under `src/` moved to reach it. The second holds because
nothing has moved yet: the one deferral ADR 0030 names, splitting `view/` once a third
view directory lands, is deferred together with the lint edge that would keep it, never
split first and fenced after. The third is met — ADR 0003 is confirmed, not superseded.

## Acceptance criteria

- The first question above is answered in writing before any directory is created under
  `src/`.
- No module moves without the lint rule that keeps it where it moved to.
- ADR 0003 is either confirmed as still current, or superseded by a record that states what
  the rename cost and what it bought.
