---
adr: 17
title: Bounded undo history with an explicit redo
status: Proposed
date: 2026-08-01
area: storage
---

# ADR 0017 — Bounded undo history with an explicit redo

> **Proposed.** [ADR 0015](0015-undo-by-captured-inverses.md) is still in force and still
> describes the shipped code. This would supersede its "one level" decision — and only
> that one — when it is accepted and built. See [[Undo and redo]].

## Context

[ADR 0015](0015-undo-by-captured-inverses.md) chose a **single slot**: the last effective
batch, session-only, in memory. Redo came free, because a replay records its own inverses,
so undoing an undo re-applies. Its Revisit-when read:

> Someone asks to take back more than the last thing they did. The capture mechanism
> already supports a stack; only the slot is single.

That trigger has fired, and with a second complaint the ADR did not anticipate: **the free
redo is the part users cannot read.** One ↩ button whose second press reverses its first
press is a toggle wearing an undo icon, and nothing on screen says which of the two things
the next press will do.

One step is also short for the gestures this plugin encourages. Dragging a subtree into
place is three or four moves; discovering the shape was wrong and being able to take back
only the last of them is close to not being able to take it back.

## Decision

Two stacks in place of one slot:

- An **undo stack**, bounded — **5 batches by default**, configurable as a view option.
  Pushing onto a full stack drops the oldest.
- A **redo stack**, fed by undo and **cleared by any new forward change**.
- A **dedicated ↪ redo control** beside ↩, with its own chord, each disabled — not hidden
  — when its stack is empty, and each naming the batch it would act on.

The capture machinery is untouched: inverses, compare-and-swap, incremental hand-over,
capture-time authorization and the tag-delta rule all stay exactly as
[ADR 0015](0015-undo-by-captured-inverses.md) describes them. This decision is about
**where entries are kept and how they are reached**, not about how they are made.

## Consequences

- Undo means undo. Pressing it twice takes back two batches, which is what every other
  application has taught people it does.
- **`UndoRecovery` stops having a reason to exist.** It is there only because one slot had
  to hold both directions at once: when a replay failed partway, the restored prefix had
  already installed its redo *into the slot the remainder needed*, so the prefix's redo was
  stashed aside and rejoined when the retry completed. Seven review rounds went into that
  edge. With two stacks the remainder goes on one and the prefix's redo on the other,
  which is where each belongs, and the stash has nothing left to do. **This decision
  removes more state than it adds** — the strongest argument for it.
- Clearing redo on any forward change is a real loss of capability, taken deliberately.
  Keeping it would offer to re-apply a change against a state it was never captured
  against, and compare-and-swap would mostly refuse it *silently* — worse than not
  offering it.
- Memory grows with depth, in **batches, not files**: a backfill is one entry that may
  hold hundreds of files' worth of prior values. Five is chosen to be obviously safe rather
  than measured, and the option exists partly to find out whether that is right.
- The history stays **per view and session-only**. Persisting it would offer to undo a
  change from days ago against notes that have moved on.
- Two more controls on a toolbar that is already dense, and a first view option that
  configures the *session* rather than the data — the register records both as open
  questions rather than settling them here.

## Alternatives

- **Keep the single slot** — [ADR 0015](0015-undo-by-captured-inverses.md). Cheapest, and
  it is the thing being complained about.
- **A stack with no redo control**, undo-again still meaning redo. Fixes the depth and
  keeps the unreadable affordance, and the two are the same complaint.
- **An unbounded stack.** No dropped entries, unbounded memory over a long session, and an
  undo that can reach back further than the user's memory of what they did. A bound the
  user can raise is the honest version.
- **A visible history list** — a menu of the last five with labels, undoing to a chosen
  point. More discoverable still, and it needs a name per batch, a UI surface, and a
  decision about partial replay. Worth considering *after* two buttons, not instead of
  them.
- **Persist the stacks.** See the consequence above; the failure mode is silent and
  arrives days later.

## Revisit when

The bound is hit in practice often enough to be noticed — which the option makes
measurable — or someone asks to undo to a chosen point rather than step by step, which is
the visible-history alternative above.
