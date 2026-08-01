---
adr: 15
title: Undo by captured inverses, not snapshots
status: Accepted
date: 2026-08-01
area: storage
---

# ADR 0015 — Undo by captured inverses, not snapshots

## Context

One gesture can rewrite many notes: a renumbering drop writes a note per sibling, the
auto-type cascade retypes a whole subtree, the backfill touches every note missing a
property — over a real backlog, hundreds of files.

None of it could be taken back. Frontmatter writes bypass the editor's undo stack, and File
Recovery restores one note at a time; reconstructing a thirty-note renumber by hand is not
a recovery path.

Every guardrail up to that point protected against the *plugin* misbehaving — the config
gate, serialized batches, the context-row refusal. Nothing protected against the *user*: a
drop into the wrong parent is applied faithfully, across many notes, with no way back.

## Decision

Capture each write's **inverse at the moment it lands**, inside the same
`processFrontMatter` call that performs it: per key, what was there **before** — including
"key absent" — and what the write put there.

Replay is a **compare-and-swap**: a key goes back only where the note still holds what the
batch wrote.

Three properties follow, each load-bearing:

- The inverse is its **own write shape**, not a plan. A plan would re-normalize rather than
  restore — an aliased or unresolved link, a string-typed order, absent-versus-empty — and
  those distinctions are live.
- Inverses are handed over **incrementally**, so a batch that fails partway leaves its
  applied prefix undoable. That is exactly when undo is wanted most.
- **Authorization comes from capture time, not replay time.** An undo batch can only name
  files its forward batch wrote *while they were results*, so it satisfies the rule the
  context-row invariant exists for ([ADR 0010](0010-load-excluded-ancestors-as-context-rows.md))
  by construction — and the replay-time check would get it wrong in both directions,
  refusing the inverse that puts back a parent the write itself pushed out of the filter.

## Consequences

- Every batch is undoable: drop, the four moves, indent, outdent, state, tags, backfill,
  the parent-link actions. Undoing an undo is **redo for free** — the replay records its
  own inverses the same way.
- Undo composes with other editors instead of overwriting them. A key hand-edited in
  between is **kept** and counted, and the rest of the file restores. Refusing the whole
  undo over one edited note would make it useless on exactly the large batches that need
  it.
- Tags restore by **effective delta**, never by snapshot, so they compose too — at the
  accepted price that a scalar-shaped prior value comes back as the list the writer writes
  anyway.
- Identity is the file, not the path: a note recreated where a deleted one was counts as
  missing, so a replacement never inherits the original's history.
- **Creation is out of scope.** The inverse of creating a note is deleting one, and this
  feature must never delete.
- One level, session-only, in memory. Not a stack, not persisted.
- The state machine is the real cost, and it took seven review rounds to settle: a no-op
  batch keeps the previous slot; a replay that completed but restored nothing consumes it;
  a replay that fails partway swaps the slot to its **unfinished remainder**, and the
  stranded prefix's redo is stashed and rejoined when the retry completes. Each of those is
  a rule someone has to keep in their head when editing that file.

## Alternatives

- **Snapshot the file and restore it.** Simple, and it silently reverts every edit made in
  between, including ones in the note's body that have nothing to do with this plugin.
- **Transactions with rollback.** Rollback is itself a batch of writes that can fail, so it
  converts "some writes landed" into "some writes landed and some unwinds did not". See
  [ADR 0004](0004-one-write-boundary-planning-separate-from-applying.md).
- **Re-plan the inverse from the model** — compute what would put things back. It
  re-normalizes rather than restores, and it cannot represent "the key was absent", which
  is a live distinction in folder mode.
- **Rely on the vault's File Recovery.** Per note, per snapshot interval, and no notion of
  a batch. It is a backup, not an undo.
- **A multi-level stack.** More useful and much more state; one level answers the reported
  need — the slip you just made — and redo already gives the second step for free.

## Revisit when

Someone asks to take back more than the last thing they did. The capture mechanism already
supports a stack; only the slot is single.

**That trigger fired on 2026-08-01**, along with a second complaint this record did not
anticipate: the free redo is the part users cannot read. See
[ADR 0017](0017-bounded-undo-history-with-an-explicit-redo.md) (Proposed) and
[[Undo and redo]]. This record stays in force until that one is built — it still describes
the shipped code, and everything in it except "one level" would survive the change.
