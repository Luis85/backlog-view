---
adr: 3
title: Four layers, enforced by lint
status: Accepted
date: 2026-07-30
area: architecture
---

# ADR 0003 — Four layers, enforced by lint

## Context

The plugin does four separable things: work out what a backlog *is* from a set of notes,
decide what a change should write, put bytes in the vault, and draw and handle a tree. Two
of those are pure and testable in milliseconds; two are not.

Left to itself, that separation erodes. Not dramatically — one import at a time, each
individually reasonable, until the tree-building code needs a DOM to test.

## Decision

Four layers, outermost first, **each reaching anything below it and nothing above**:

```
main → commands → view → storage → domain
```

with `ui/` a leaf of reusable dialogs that knows about none of them.

The direction is a per-directory `no-restricted-imports` rule. A crossing fails
`npm run lint`, not review. Files carry size budgets (400 lines, 100 per function,
complexity 16) so a layer cannot quietly become one file that does everything.

Two corollaries follow from the same principle:

- **A type belongs with the code that produces it**, not the code that consumes it —
  `DropTarget` and `DropZone` live in `domain/dropTargets.ts`. Both sat upstream once and
  made the pure layer depend on the effectful one.
- **The view is reached through an interface.** Modules take `BacklogViewHost`, and
  `src/view/host.ts` holds no runtime code, so imports stay cycle-free.

## Consequences

- `domain/` reads the vault and never writes it, and never touches the DOM. It is
  testable in Node with no jsdom, which is why the tree, ranking and level maths have the
  coverage they do.
- "Where does this go" has an answer before the code is written — the question the
  budgets exist to force.
- A file at its cap must be **split along a real seam**, a responsibility that can be
  named. The line count only asks the question; the seam is the answer. Three of this
  project's refactors are exactly that, recorded as Tasks.
- The rule is checkable by reading one directory, which is what makes the write-safety
  invariants auditable at all.
- The cost is indirection: a change that spans layers touches more files, and `host.ts`
  grows a method whenever the view gains state something else needs.

## Alternatives

- **Convention alone, documented in a `CLAUDE.md`.** A rule that lives only in prose is
  followed until someone is in a hurry. This project's position on that is now its own
  PBI: invariants become checks wherever they can.
- **Separate packages per layer.** Genuine enforcement, and a build and release story out
  of all proportion to a single-bundle Obsidian plugin.
- **Fewer layers** — merge `storage` into `domain`. Cheaper, and it destroys the property
  the whole design rests on: that the pure layer cannot write.

## Revisit when

A fifth concern appears that fits none of the four, or `host.ts` hits the same 400-line
cap every other file in the layers already carries. That number is not special to it, but
a file this project already treats as one concern crossing the line every other one does
is evidence it has become two.
