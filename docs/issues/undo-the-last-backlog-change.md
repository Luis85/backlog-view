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
2. The inverse is therefore its **own write shape**, not an `ItemWrite`: a per-file
   map of key → prior raw value or "absent". `ItemWrite` cannot carry it — `parent`
   is `TFile | null`, which has no room for an aliased or *unresolved* prior link
   (and `wikilinkTo` would normalize whatever it was given), `order` is a `number`
   while `readNumber` tolerates a string on disk — and a replay through the planner's
   shape would re-normalize rather than restore. A dedicated restore function in
   `storage/frontmatter.ts` applies it: same module, same boundary, and the batch
   still goes through `applySafely`, so config problems, the `applying` flag and the
   context-row refusal apply unchanged.
3. Inverses are handed over **incrementally as each write lands** (a collector beside
   `onProgress`), not returned at the end: `applyWrites` is deliberately not
   transactional (see `src/storage/CLAUDE.md`), and a batch that fails partway leaves
   its earlier writes applied — which is exactly when undo is wanted most. The view
   keeps the most recent batch — single level, session-only, in memory.
4. An **Undo last backlog change** affordance replays that batch. Undoing an undo is
   redo for free: the replay records its own inverses the same way.
5. Tags are the one key restored by **effective delta** rather than raw value: the
   list is shared with the user's own edits, so undo must compose with changes made
   in between instead of clobbering them (`TagDelta` already has the right shape) —
   at the accepted price that a scalar-shaped prior value comes back as the YAML list
   the write path writes anyway. Capture the delta that actually changed the note,
   inside `processFrontMatter`, so undoing an add that was already present cannot
   remove it.

Out of scope: creation. The inverse of `createBacklogItem` is deleting a note, and
this feature must never delete.

## Acceptance criteria

- Every `applySafely` batch — drop, move menu, Alt+arrows, indent/outdent, state
  change, tag add/remove, backfill, "Use folder position", "Clear parent link" — is
  undoable immediately afterwards, and frontmatter the batch never touched is
  byte-identical after write + undo.
- Restored keys round-trip in their raw shape: an aliased parent link, an unresolved
  parent link, a string-typed order and the absent-vs-empty parent distinction all
  come back exactly; tags restore by effective delta, per the decision above.
- A batch that fails partway leaves its applied prefix undoable.
- The undo is a write path like any other: driven as an entry point in
  `test/view/contextRowWrites.test.ts`, refused under the same conditions.
- A note deleted between write and undo does not corrupt the rest of the batch; the
  behaviour (skip with a notice naming the file, or refuse whole) is decided and
  tested, not incidental.

## Risks

Contained, with one addition to the write surface: a raw-restore write shape beside
`ItemWrite`, living in the same module and replayed through the same gate — no new
write *paths*. The real risk is snapshot fidelity — absent vs empty vs value, link
and scalar shapes — which is exactly what the acceptance criteria pin.
