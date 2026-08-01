---
type: Feature
order: 20
status: Done
priority: P2
area: feature
closed: 2026-08-01
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
   record two raw values inside `processFrontMatter`: what the key held **before** —
   including "key absent" — and what the write **put there**. Absent vs empty parent
   is a live distinction in folder mode (`explicitRoot` pin vs `removeParentKey`), so
   the inverse restores exactly what was there, never a re-planned equivalent.
2. The inverse is therefore its **own write shape**, not an `ItemWrite`: a per-file
   map of key → the value pair. `ItemWrite` cannot carry it — `parent` is
   `TFile | null`, which has no room for an aliased or *unresolved* prior link
   (and `wikilinkTo` would normalize whatever it was given), `order` is a `number`
   while `readNumber` tolerates a string on disk — and a replay through the planner's
   shape would re-normalize rather than restore. A dedicated restore function in
   `storage/frontmatter.ts` applies it: same module, same boundary, and the batch
   still goes through `applySafely` for the `configProblems` gate and the `applying`
   serialization.
3. Restoring is a **compare-and-swap**, never a blind write: a key goes back to its
   prior value only where the note still holds what the batch wrote. Undo is not the
   only editor — parent, order, type and state can change in the note or the
   property editor in between, and an unconditional snapshot restore would silently
   overwrite the newer edit. A conflicted key is skipped and the rest of the file
   restores, with the notice counting what was kept: refusing the whole undo for one
   hand-edited note would make undo useless on exactly the large batches that need
   it most.
4. Authorization comes from **capture time**, not replay time. The write being
   undone can itself move its target out of the filter: in a base that excludes
   `status: Done`, marking a parent done reloads it as an `outsideFilter` context
   row — and the replay-time context-row check would refuse exactly the inverse that
   puts it back, while a childless note, gone from the model entirely, would slip
   through the same check. That predicate answers the wrong question for undo in
   both directions. The rule this feature must keep is the one the context-row
   invariant exists for — the view never writes to a note the user could not act
   on — and an undo batch satisfies it by construction: it targets only files its
   forward batch wrote while they were results, and nothing else. The root
   `CLAUDE.md` statement of the invariant is amended in the same change.
5. Inverses are handed over **incrementally as each write lands** (a collector beside
   `onProgress`), not returned at the end: `applyWrites` is deliberately not
   transactional (see `src/storage/CLAUDE.md`), and a batch that fails partway leaves
   its earlier writes applied — which is exactly when undo is wanted most. The view
   keeps the most recent batch — single level, session-only, in memory — and the
   slot is replaced on the first **effective** inverse only: a write that changed
   nothing emits none, so a no-op batch (re-picking an item's checked state still
   calls `applySafely`) cannot cost the user the undo of the change before it.
6. An **Undo last backlog change** affordance replays that batch. Undoing an undo is
   redo for free: the replay records its own inverses the same way.
7. Tags are the one key restored by **effective delta** rather than raw value: the
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
  undoable immediately afterwards, and every key the batch never touched holds the
  same **value** after write + undo. Value equivalence, not byte identity, is what
  `processFrontMatter` can promise: it re-serializes the block on any write, so
  formatting was already the forward write's to change.
- Restored keys round-trip in their raw shape: an aliased parent link, an unresolved
  parent link, a string-typed order and the absent-vs-empty parent distinction all
  come back exactly; tags restore by effective delta, per the decision above.
- A batch that fails partway leaves its applied prefix undoable.
- A write that moved its own target out of the filter — a parent marked done in a
  base that excludes done items — is still undoable; a note the forward batch never
  wrote is still never written. Driven as its own entry point in
  `test/view/contextRowWrites.test.ts`.
- A key hand-edited between write and undo is kept, not overwritten, and the notice
  says so.
- A note deleted between write and undo does not corrupt the rest of the batch: it
  is skipped whole and the notice counts it.

## Risks

Contained, with two deliberate amendments to the write rules: a raw-restore write
shape beside `ItemWrite` (same module, same gate for config problems and
serialization), and capture-time authorization in place of the replay-time
context-row check — narrower, not looser, since an undo batch can only name files
its accepted forward batch wrote. The real risk is snapshot fidelity — absent vs
empty vs value, link and scalar shapes, the compare-and-swap — which is exactly
what the acceptance criteria pin.

## Outcome

Done as designed, the three review rounds' amendments included:

- `storage/frontmatter.ts` captures inverses inside `processFrontMatter`
  (`RestoreWrite`: per-key prior/written raw pairs, absence included; tags as the
  reverse of the *effective* delta) and hands each to `onInverse` as its write
  lands. `applyRestores` replays with per-key compare-and-swap, skips deleted
  notes, and records its own inverses — so undoing an undo redoes, with no extra
  machinery.
- The view's `runExclusively` is the one gate both paths share (config problems,
  serialization, busy progress, the deferred refresh); the undo slot installs on
  the first effective inverse only. `undoLast` replays without the replay-time
  context-row check — capture-time authorization, driven in the context-row stress
  suite and across the filter boundary (a parent marked done in a base that
  excludes done items comes back on undo).
- Affordances: an ↩ toolbar button (disabled until a batch lands, paused with the
  other write controls mid-batch, re-enabled to the slot's state rather than to
  idle) and Ctrl/Cmd+Z in the tree. The undo notice counts kept hand-edits and
  skipped deleted notes; a clean undo shows in the tree itself.
- Sixteen new tests: raw-shape round-trips (aliased link, string order,
  absent-vs-empty parent), no-op slot preservation, the partial-failure prefix,
  conflict keeps, deleted notes, redo, effective tag deltas, and the
  filter-demotion case. Coverage held at 98.7% statements / 94.1% branches.

A fourth review round on the implementation tightened three edges, each now
pinned by a test: the Ctrl/Cmd+Z chord runs before the empty-model return, so it
works when the change being undone is what emptied the tree; a note recreated at
a captured path counts as missing (TFile identity, not path — a replacement must
not inherit the original's history); and a replay that completed but restored
nothing consumes the slot instead of re-offering a dead batch forever, while a
failed replay keeps it for the retry a transient error deserves. A fifth round
sharpened that last rule: a replay that fails partway swaps the slot to its
unfinished remainder, because the restored prefix had already installed its redo
— retrying from that would re-apply the prefix while the rest stayed forward.
The next undo now finishes the job; the prefix's redo is the accepted price, and
redo returns once an undo completes.

Not verifiable here, as ever: the button's look in a live vault — the standing
jsdom limit recorded in [smoke-test-the-visual-changes](smoke-test-the-visual-changes.md).
