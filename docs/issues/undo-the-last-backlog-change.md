---
type: Feature
order: 20
status: Open
priority: P2
area: feature
created: 2026-08-01
source: 2026-08-01 plugin review
files:
  - src/storage/frontmatter.ts
  - src/view/backlogView.ts
  - test/view/contextRowWrites.test.ts
---

# Undo the last backlog change

## Evidence

- One gesture can rewrite many notes: `renumberWrites` produces a write per sibling
  when order gaps are spent, the `autoType` cascade retypes every explicitly-typed
  descendant of a moved subtree, and the ✨ backfill (`computeInitWrites`) touches
  every note missing `type` or `order` — over a real backlog, hundreds of files.
- None of it can be taken back. `processFrontMatter` writes bypass the editor's undo
  stack, and File Recovery restores one note at a time — reconstructing a thirty-note
  renumber by hand is not a recovery path.
- The write path is a single choke point: every batch flows through `applySafely` →
  `applyWrites`, and `applyWrites` already runs inside `processFrontMatter`, where the
  note's prior values are in hand at exactly the moment the write lands.

## Why it matters

The plugin's whole pitch is "let a view write your frontmatter for you", and every
guardrail so far protects against the *plugin* misbehaving — the config gate, the
serialized batches, the context-row refusal. Nothing protects against the *user*: a
drop into the wrong parent is applied faithfully, across many notes, with no way back.
Undo is the missing half of that trust story. It also softens the recorded
duplicate-orders limitation: a drop that landed somewhere surprising becomes a slip to
take back rather than advice to reorder in an unfiltered base.

## Approach

Capture inverses at the only place they are knowable — inside `applyWrites`, before
each write lands:

1. For every key an `ItemWrite` touches (`parent`, `order`, `type`, `state`, tags),
   record the prior **raw** value, including "key absent". Absent vs empty parent is a
   live distinction in folder mode (`explicitRoot` pin vs `removeParentKey`), so the
   inverse restores exactly what was there, never a re-planned equivalent.
2. `applyWrites` returns the inverse batch; the view keeps the most recent one —
   single level, session-only, in memory.
3. An **Undo last backlog change** affordance replays the inverse through
   `applySafely`, the same gate as every other write, so config problems, the
   `applying` flag and the context-row refusal apply unchanged. Undoing an undo is
   redo for free: the replay produces its own inverse.
4. Tag inverses are already delta-shaped (`TagDelta`), so an undo composes with edits
   made in between instead of clobbering them.

Out of scope: creation. The inverse of `createBacklogItem` is deleting a note, and
this feature must never delete.

## Acceptance criteria

- Every `applySafely` batch — drop, move menu, Alt+arrows, indent/outdent, state
  change, tag add/remove, backfill, "Use folder position", "Clear parent link" — is
  undoable immediately afterwards, and frontmatter the batch never touched is
  byte-identical after write + undo.
- The undo is a write path like any other: driven as an entry point in
  `test/view/contextRowWrites.test.ts`, refused under the same conditions.
- A note deleted between write and undo does not corrupt the rest of the batch; the
  behaviour (skip with a notice naming the file, or refuse whole) is decided and
  tested, not incidental.

## Risks

Contained: the feature adds no new write *shapes*, only replays recorded ones through
the existing gate. The real risk is snapshot fidelity — absent vs empty vs value —
which is exactly what the acceptance criteria pin.
