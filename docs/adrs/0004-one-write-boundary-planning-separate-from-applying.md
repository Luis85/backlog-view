---
adr: 4
title: One write boundary, planning separate from applying
status: Accepted
date: 2026-07-30
area: architecture
---

# ADR 0004 — One write boundary, planning separate from applying

## Context

This plugin edits the user's notes as a side effect of dragging things. That is its whole
pitch and its whole risk. The gestures that write are spread across four interaction
modules, and every one of them is a place a write-safety rule could be forgotten:

| Module | Gestures |
| --- | --- |
| `interactions/structure.ts` | drop · move up · move down · move to top · move to bottom · indent · outdent · backfill |
| `interactions/menu.ts` | Set state · Set type · Clear parent link · Use folder position |
| `interactions/tags.ts` | add tag · remove tag |
| `interactions/create.ts` | new item — the one that creates rather than edits |

Plus undo, which replays inverses of any of them.

The list is greppable rather than remembered: every forward path above is a call to
`applySafely`, so `grep -rn 'applySafely(' src/` is the inventory, and a new one that
does not appear there is a write that skipped the gate.

Write safety cannot be a property each caller remembers. It has to be a property of the
place writes happen.

## Decision

**Planning and applying are separate, and applying happens in one module.**

- `domain/writePlan.ts` decides what a change *would* write. It is pure: it takes the
  model and returns a batch, and touches nothing.
- `storage/frontmatter.ts` is the only module that may write frontmatter or create a note.
- Every batch passes one gate (`runExclusively`): serialized, and blocked while the view
  options are misconfigured.

Enforced, not described: `no-restricted-syntax` bans `processFrontMatter`, `vault.create`
and local-storage access everywhere outside `storage/`.

## Consequences

- A new write path cannot appear by accident. It fails lint before it fails a user.
- What a gesture would do is testable without a vault, in Node, by calling the planner and
  reading the batch — which is why drop, rank, cascade and backfill maths have the
  coverage they do.
- The rules that must hold for *every* write are stated once. The context-row refusal
  ([ADR 0010](0010-load-excluded-ancestors-as-context-rows.md)) is a single check in the
  gate rather than nine.
- `applyWrites` is serialized but **deliberately not transactional**: a mid-batch failure
  leaves earlier writes applied. Obsidian offers no multi-file transaction, and pretending
  otherwise would mean an unwind path that can itself fail. The honest answer is that the
  applied prefix stays and stays undoable.
- A batch is **one refresh**, not one per file. Every file written comes back as its own
  change event; rebuilding the tree on each would render a half-applied backlog hundreds
  of times.
- The cost is a plan/apply round trip for changes that would otherwise be two lines, and a
  planner that must model everything the writer can do.

## Alternatives

- **Write where the interaction happens.** Direct and obvious, and it puts nine copies of
  every safety rule in nine files. Two of this project's bugs were exactly a rule applied
  in one place and not another.
- **A transactional write layer** with rollback. Rollback is itself a batch of writes that
  can fail, so it converts "some writes landed" into "some writes landed and some unwinds
  did not" — strictly worse. Undo answers the real need instead, at a moment when the user
  is present to see the result.
- **Optimistic local model, flush later.** Snappier, and it puts the truth in memory
  instead of the vault, which contradicts [ADR 0002](0002-keep-the-hierarchy-in-frontmatter.md).

## Revisit when

Obsidian offers an atomic multi-file write. That changes the non-transactional consequence
above, and only that one.
