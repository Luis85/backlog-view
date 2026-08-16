---
type: PBI
order: 10
parent: "[[Safe writes]]"
status: Open
priority: P2
area: feature
created: 2026-08-01
reopened: 2026-08-01
source: 2026-08-01 plugin review; reopened by user request
shipped: 0.3.0 (single level — see The 0.3.0 record)
files:
  - src/storage/frontmatter.ts
  - src/view/interactions/undo.ts
  - src/view/writeGate.ts
  - src/view/render/toolbar.ts
  - src/domain/viewOptions.ts
started: ""
finished: ""
horizon: Next
start: 2026-08-17
due: 2026-08-30
risk: ""
assignee: ""
---

# Undo and redo the last few backlog changes

**As** someone who has just made several changes in a row, **I want** to step back through
them and forward again with two obvious buttons, **so that** taking something back is a
thing I can see and reverse — rather than a guess about what pressing the same button
twice is going to do.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The ↩ **undo** and ↪ **redo** toolbar buttons, or `Ctrl`/`Cmd`+`Z` and `Ctrl`/`Cmd`+`Shift`+`Z` in the tree |
| **Preconditions** | For undo: a batch has landed this session. For redo: a batch has been undone, with no new change since. |
| **Guarantee** | Undo never *deletes*. Creation stays out of the history, because the inverse of creating a note is removing one. |

**Main flow**

1. Every batch that changes at least one note is pushed onto an **undo stack**, newest
   first.
2. The stack holds **five** batches by default, and the depth is configurable. Pushing
   onto a full stack drops the oldest: that change stops being undoable, and nothing in
   the UI pretends otherwise.
3. The user presses ↩. The newest entry's inverses are replayed — compare-and-swap per
   key, exactly as today — and the entry moves to the **redo stack**.
4. Pressing ↩ again takes back the batch before that one, and so on to the bottom of the
   stack.
5. The user presses ↪. The newest redo entry is re-applied and moves back onto the undo
   stack.
6. Each button's tooltip names the batch it would act on — *"Undo: move 3 items"*,
   *"Redo: assign missing properties"* — so the next step is knowable before it is taken.

**Extensions**

- **1a — the batch changed nothing** (re-picking an item's current state). Nothing is
  pushed and the stack is untouched. A no-op must not cost the user a real entry.
- **2a — the configured depth is lowered** below what is held. The excess oldest entries
  are dropped at once. Raising it again resurrects nothing.
- **3a — a key was hand-edited between the write and the undo.** It is **kept**, not
  overwritten, and the notice counts it. Refusing the whole undo over one edited note
  would make it useless on exactly the large batches that need it.
- **3b — a note was deleted in between.** Skipped whole; the rest of the batch restores.
- **3c — a note was recreated at the same path.** Counted as missing: identity is the
  file, not the path, so a replacement never inherits the original's history.
- **3d — the write moved its own target out of the Base's filter** (a parent marked done
  in a base that excludes done items). Still undoable. Authorization comes from **capture
  time**: an entry can only name files its forward batch wrote while they were results
  ([[Filtered bases keep their tree]]).
- **3e — the replay fails partway.** The **unfinished remainder** goes back on top of the
  undo stack, so the next ↩ finishes the job, and the restored prefix goes on the redo
  stack. Two stacks make this ordinary bookkeeping — see *Why this is changing*.
- **4a — the undo stack empties.** The ↩ button disables. It is never hidden: a control
  that vanishes has to be re-found.
- **5a — a new forward change is made while the redo stack holds entries.** The redo stack
  is **cleared**. Redo can only mean "put back the thing I just took back"; offering it
  after the history has diverged would re-apply a change against a state it was never
  captured against, and compare-and-swap would mostly refuse it — silently, which is
  worse than not offering it.
- **5b — while a batch is applying.** Both buttons pause with the other write controls,
  and re-enable to **their own stack's** state rather than to idle.
- **6a — the view is closed and reopened, or Obsidian restarts.** Both stacks are empty.
  The history is per view and session-only, deliberately: restoring it would offer to undo
  a change from days ago against notes that have moved on since.

## Acceptance criteria

- The undo stack holds the configured number of batches, **five** by default, and undo
  steps back through them in order.
- Redo is its **own** control, on the toolbar and on its own chord. Pressing undo twice
  undoes two batches — it never redoes.
- A new forward change clears the redo stack.
- Dropping the oldest entry when the stack is full is silent to the tree but honest in
  the UI: nothing offers to undo a batch that is no longer held.
- The depth is a view option with a default of 5, and lowering it drops the excess
  immediately.
- Each button says what it would act on before it is pressed, and is disabled — not
  hidden — when its stack is empty.
- Everything the shipped implementation already guarantees still holds, unchanged:
  raw-shape restores, compare-and-swap conflict keeps, skipped deleted notes,
  capture-time authorization, the partial-failure prefix, and the tag-delta rule.
- A replay that fails partway leaves the remainder on the undo stack and the prefix on
  the redo stack, and finishing the remainder does not re-apply the prefix.

## Why this is changing

`0.3.0` shipped a **single slot**, where undoing an undo was redo for free. That was the
cheapest thing that could work — the replay records its own inverses, so redo needed no
machinery at all — and it is the part users cannot read.

Two specific problems:

- **The affordance lies about what it does.** One ↩ button whose second press reverses
  its first press is a toggle wearing an undo icon. Nothing on screen says which of the
  two things the next press will do, and the answer depends on invisible state.
- **One step is not enough for the gestures this plugin encourages.** Dragging a subtree
  into place is three or four moves, not one. Discovering the shape was wrong and being
  able to take back only the last of them is close to not being able to take it back.

There is a third reason, and it is the reason to prefer this design rather than merely
accept it: **two stacks delete the machinery the one slot needed.** `UndoRecovery` exists
only because a single slot had to hold both directions at once — when a replay failed
partway, the restored prefix had already installed its redo *into the slot the remainder
needed*, so the prefix's redo had to be stashed aside and rejoined when the retry
completed. Seven review rounds went into that. With separate stacks the remainder goes on
one and the prefix's redo goes on the other, which is where they each belong, and the
stash has nothing left to do.

## What already holds

Everything below is built, tested and unchanged by this. It is listed so the work is
understood as *changing where entries are kept*, not as rewriting undo:

- Inverses are captured inside the same `processFrontMatter` call that writes, per key,
  with absence a first-class state.
- Replay is compare-and-swap: a key goes back only where the note still holds what the
  batch wrote.
- Inverses are handed over incrementally, so a batch that fails partway leaves an
  undoable prefix.
- Authorization is capture-time, not replay-time.
- Tags restore by effective delta, never by snapshot.
- Both directions go through `runExclusively`, so the config gate and serialization apply.

## Open questions

- **Where the depth option lives.** None of the four existing option groups (Hierarchy,
  Progress, New items, Display) is a home for it. A new **Editing** group is the obvious
  answer and would give later write-related options somewhere to go — but a group holding
  one slider is thin, and this is the first option that is about the *session* rather than
  about the data.
- **The bound's units.** Five *batches*, not five files — a backfill is one entry and may
  hold hundreds of files. Whether a large-batch vault wants a lower depth is unknown; the
  option exists partly to find out.
- **`Ctrl`+`Y`.** `Ctrl`/`Cmd`+`Shift`+`Z` matches Obsidian. Whether to also accept
  `Ctrl`+`Y` on Windows and Linux is a small question with no evidence either way yet.

## Where it lives

As built, and where the change lands:
`src/storage/frontmatter.ts` (`RestoreWrite` capture inside `processFrontMatter`,
`applyRestores` with per-key compare-and-swap — **unchanged**) ·
`src/view/interactions/undo.ts` (today the slot's state machine and `UndoRecovery`;
becomes the two stacks) · `src/view/writeGate.ts` (`runExclusively`, `undoLast`,
`canUndo` — gains the redo half) · `src/view/render/toolbar.ts` (the ↩ button; gains ↪) ·
`src/view/interactions/keyboard.ts` (`Ctrl`/`Cmd`+`Z`; gains the redo chord) ·
`src/domain/viewOptions.ts` (the new depth option).
Tests: `test/storage/restore.test.ts`, `test/view/undo.test.ts`,
`test/view/contextRowWrites.test.ts`.

---

## The 0.3.0 record

What follows is the record of the single-slot implementation that shipped in `0.3.0`,
kept because it is why the capture machinery looks as it does — and because the work
above is a change to it, not a replacement for it.

### Evidence

- One gesture can rewrite many notes: `renumberWrites` produces a write per sibling
  when order gaps are spent, and the ✨ backfill (`computeInitWrites`) touches
  every note missing `type` or `order` — over a real backlog, hundreds of files. A third
  case counted here when this was written — a re-typing cascade down a moved subtree —
  was removed on 2026-08-11, and the two that remain are why the machinery still looks
  as it does.
- None of it could be taken back. `processFrontMatter` writes bypass the editor's undo
  stack, and File Recovery restores one note at a time — reconstructing a thirty-note
  renumber by hand is not a recovery path.
- The write path is a single choke point: every batch flows through `applySafely` →
  `applyWrites`, and `applyWrites` already runs inside `processFrontMatter`, where the
  note's prior values are in hand at exactly the moment the write lands.

### Why it mattered

The plugin's whole pitch is "let a view write your frontmatter for you", and every
guardrail before it protected against the *plugin* misbehaving — the config gate, the
serialized batches, the context-row refusal. Nothing protected against the *user*: a
drop into the wrong parent is applied faithfully, across many notes, with no way back.
Undo was the missing half of that trust story.

### Approach

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
   shape would re-normalize rather than restore.
3. Restoring is a **compare-and-swap**, never a blind write: a key goes back to its
   prior value only where the note still holds what the batch wrote. A conflicted key
   is skipped and the rest of the file restores, with the notice counting what was
   kept.
4. Authorization comes from **capture time**, not replay time. The write being
   undone can itself move its target out of the filter, and the replay-time
   context-row check would refuse exactly the inverse that puts it back, while a
   childless note gone from the model entirely would slip through the same check.
   An undo batch satisfies the rule by construction: it targets only files its
   forward batch wrote while they were results.
5. Inverses are handed over **incrementally as each write lands**, not returned at the
   end: `applyWrites` is deliberately not transactional, and a batch that fails partway
   leaves its earlier writes applied — which is exactly when undo is wanted most.
6. Tags are the one key restored by **effective delta** rather than raw value, so undo
   composes with edits made in between instead of clobbering them.

Out of scope then and now: creation. The inverse of `createBacklogItem` is deleting a
note, and this feature must never delete.

### Outcome

Shipped as designed. `storage/frontmatter.ts` captures inverses inside
`processFrontMatter` and hands each to `onInverse` as its write lands; `applyRestores`
replays with per-key compare-and-swap, skips deleted notes, and records its own
inverses — which is what made undoing an undo redo with no extra machinery, and is
what the work above replaces with something a user can read.

Seven review rounds went into the single slot's state machine, almost all of it in the
partial-failure path: the slot installs on the first *effective* inverse only; a replay
that completed but restored nothing consumes the slot rather than re-offering a dead
batch forever; a replay that fails partway swaps the slot to its unfinished remainder;
the stranded prefix redo is stashed in `UndoRecovery` and rejoined when the retry
completes, chained failures included; a retry consumed whole by conflicts leaves the
carried redo as the slot. **That is the machinery two stacks make unnecessary.**

Sixteen tests came with it: raw-shape round-trips (aliased link, string order,
absent-vs-empty parent), no-op slot preservation, the partial-failure prefix, conflict
keeps, deleted notes, redo, effective tag deltas, and the filter-demotion case.

Not verifiable here, as ever: the button's look in a live vault — the standing jsdom
limit recorded in [[Smoke test the visual changes]].
