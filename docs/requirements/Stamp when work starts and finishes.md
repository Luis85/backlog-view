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

The one thing a board cannot retrofit is history. Cycle time, ageing work and the
Kanban Guide's service level expectation all read two facts — when an item started and
when it finished — and mainstream trackers recover them from an item history that notes
do not have. A state change that is not stamped at write time is unrecoverable. This
register already stamps `closed:` by hand on every note it finishes; the board can do
it on the transition, into properties the user names.

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
