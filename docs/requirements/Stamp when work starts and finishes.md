---
type: PBI
parent: "[[Moving cards]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/storage/frontmatter.ts
---

# Stamp when work starts and finishes

**As** someone who will eventually want to know how long things take, **I want** the
board to record when an item started and finished as it happens, **so that** the
question is answerable later — because a transition nobody stamped is gone.

The one thing a board cannot retrofit is history. Cycle time, ageing work and the
Kanban Guide's service level expectation all read two facts — when an item started and
when it finished — and mainstream trackers recover them from an item history that notes
do not have. A state change that is not stamped at write time is unrecoverable. This
register already stamps `closed:` by hand on every note it finishes; the board can do
it on the transition, into properties the user names.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | A state write that crosses into a started state, or across the done boundary |
| **Preconditions** | The view options name a started-date or finished-date property |
| **Guarantee** | A stamp is never a second write. It rides the batch that caused it, so one undo takes back the state and its dates together, and a stamp can never overwrite another key the plugin owns. |

**Main flow**

1. The user names a started-date property, a finished-date property, and which states
   count as started.
2. A card moves into a started state; the started date is written in the same batch.
3. A card moves from not-done into done; the finished date is written in the same batch.
4. Undo takes the state and its dates back together, because they were one batch.

**Extensions**

- **1a — nothing is configured.** Nothing is written. Every part of this is opt-in, and an
  unconfigured property is not a property with a default name.
- **2a — the item enters a started state it has been in before.** The started date is
  written once and kept: the earliest start survives rework, or the measure counts the
  last restart rather than the age of the work.
- **3a — the move is done to done** (re-labelling Done as Dropped). The finished date is
  unchanged. That is not a new finish, and shifting it forward would rewrite the item's
  history to say the work took longer than it did.
- **3b — the item leaves done.** The finished date is removed, so a reopened item never
  claims a finish it no longer has.
- **4a — a stamp property names a key the plugin already owns.** It is refused by the same
  key-collision checks that gate every other write: a stamp must never overwrite the
  parent, order, type, state or tags key.
- **4b — the user expects a chart.** None ships with this. The stamps are *capture*, which
  keeps the flow measures possible rather than promising them; a metric drawn from data
  nobody has been recording is the failure this PBI exists to avoid.

## Acceptance criteria

- The view options may name a started-date and a finished-date property, and which
  states count as started; nothing configured, nothing written.
- Entering a started state writes the started date once — the earliest start survives
  rework.
- The finished date is written only when a change crosses from not-done into done, and
  kept unchanged across done-to-done moves — re-labelling Done as Dropped is not a new
  finish, and must not shift the item's history forward. Leaving done removes it, so a
  reopened item never claims a finish it no longer has.
- Stamps ride the same batch as the state write: one undo takes back the state and its
  dates together.
- The stamp properties join the key-collision checks that gate every write, so a stamp
  can never overwrite the parent, order, type, state or tags key.
- No chart ships with this: the stamps are capture, so the flow metrics stay possible
  rather than promised.

## Where it lives

**Nothing yet — this note is design.** The property names and the started-state set join
the configuration in `src/domain/settings.ts`, beside the key-collision checks that will
have to accept two more keys; the writes themselves go where every write goes, in
`src/storage/frontmatter.ts`, riding the state batch rather than following it.
