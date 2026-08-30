---
type: Test case
order: 50
parent: "[[Smoke test the board]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-30
source: Decomposition of [[New cards in place]]
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Creating a card in a column

A verification to run.

## Why this exists

[[New cards in place]] main flow step 4 — *"the next render places its card in that
column"* — is the one step of that use case jsdom cannot answer. The harness has no
Bases, so nothing there can say whether a real query returns the new note, whether it
returns it in time to be the next render, or where folder mode actually put it. jsdom
asserts the write; only a vault asserts the placement.

The touch half is the same shape as the verdict [[Keyboard, menu and touch]] left to a
device: whether the column header's `+` is reachable by thumb is not a claim the
stylesheet can settle here.

**Preconditions** — `npm run test-build` has installed the plugin into this repository,
this repository is open as a vault, and `docs/Product Backlog.base` is open in board
mode.

**Setup, and why it is needed.** That base configures `stateValues: Open, Active, Done`
and every one of the three holds notes, so **the vault has no empty column to test
with**. Add two throwaway states — `Blocked, Waiting` — to `stateValues` before starting,
so steps 2 and 5 each get their own genuinely empty column rather than the second one
finding the first already filled. The vault also holds `Accepted`, `Superseded` and
`Proposed`, which no `stateValues` names, so it draws stray columns without any setup —
that is step 6's subject.

**Restore afterwards**: remove `Blocked, Waiting` from `stateValues`, set
`folderHierarchy` back to where you found it, and delete the notes created below.

## How to check

1. Press the `+` on a column whose state holds cards already. Give the note a title.
   Watch the next render.
2. Repeat on `Blocked`, which holds none.
3. Repeat on the leading no-state column, then open the created note and read its
   frontmatter.
4. Repeat step 1 from the column's context menu.
5. With the keyboard: select the still-empty `Waiting` column and press Enter. (Its own
   column, because step 2 filled `Blocked` — a toggle cannot un-fill it.)
6. Look at the `Accepted`, `Superseded` and `Proposed` columns: each should offer no
   creation by any of the three paths, while still accepting a dropped card.
7. **Folder placement, one fresh note per mode.** Folder mode is read *when the note is
   created* and relocates nothing afterwards, so this cannot be checked by toggling and
   re-reading the notes above. With `folderHierarchy` off, create one note from a column
   and note where it landed; turn it on, create another from the same column, and compare.
8. On a phone or tablet, try the `+` and the menu entry.

## Acceptance criteria

- Each created note appears as a card in the column it was created from, on the next
  render rather than after a manual refresh.
- The note created from the no-state column carries no state key at all — not an empty
  value.
- Each of the two notes created in step 7 lands where the tree's own creation puts it
  under that mode; the column it was created from changes its state and nothing else
  about its placement.
- The menu and keyboard paths create the same note the `+` does, in the same column.
- A stray column — one whose value `stateValues` does not name — offers creation by none
  of the three paths, and still takes a drop ([[New cards in place]] extension 1b).
- The `+` and the menu entry are usable on touch, or the failure is recorded here.

## Outcome
