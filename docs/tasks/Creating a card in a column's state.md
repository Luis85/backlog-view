---
type: Task
order: 10
parent: "[[New cards in place]]"
status: Open
priority: P2
area: storage
created: 2026-08-30
source: Decomposition of [[New cards in place]]
files:
  - src/storage/createNote.ts
  - src/view/interactions/create.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Creating a card in a column's state

## Evidence

[[New cards in place]] main flow steps 2 and 3, extension 1a, and two of its four
acceptance criteria: the gated flow runs with the column's state preset, the note is
written in one call, the no-state column writes no state at all, and creation writes the
new note only.

The surface this needs already exists and is one property short. `promptCreateItem`
takes a `CreatePlacement` — *"what the surface the user created FROM adds to that
note"* — and `CreatePlacement` holds `horizon` alone. `createBacklogItem` writes that
placement inside the same `vault.create` call that writes the type, the parent and the
order. The roadmap's bucket header already drives the whole path with
`{ horizon: bucket.value }`.

The column has carried the value to preset since the board was built:
`BoardColumn.state` is *"the canonical state string this column stands for — what a drop
writes, byte for byte. Null for the leading no-state column"*. Nothing has to derive it.

## Why it matters

Creating from a column and then writing its state would be two writes, and the second
one can fail: the note would exist in no state, on a board that has no way to show that
it half-happened. The atomic write is the rule `createBacklogItem` already keeps for the
horizon, and the reason is stated there — *"a create-then-update pair could fail in
between and leave a blank note without its hierarchy properties behind"*.

## Approach

1. `CreatePlacement` gains `state?: string`, and `NewItemSpec` with it.
2. `createBacklogItem` writes it under `settings.stateKey`, gated by `seeded` — the same
   condition the iteration and release keys carry, so a `Release` created from a column
   is seeded nothing, and by `settings.stateKey` being configured at all.
3. The no-state column passes **no** `state`, rather than an empty one. This is
   `applyLabels`' rule arriving on the creation path: an unconfigured or absent key is
   never written, and `''` is a key the register says is not written at all.

Not in this task: which columns offer creation, and from where. That is
[[Creation from the column's three inputs]].

## Acceptance criteria

- A note created from a column carries that column's state, written in the same
  `vault.create` call as its type, parent and order — never a second write.
- A note created from the no-state column carries **no** state key. Not an empty string,
  not a null: the key is absent.
- A `Release` created from a column is seeded no state, exactly as it is seeded no
  sprint and no horizon today.
- With no state property configured, creation writes no state key and does not fail.
- Creation writes the new note only, never a sibling.

## Risks

The `seeded` guard is the one that has already produced a recorded defect elsewhere —
`docs/issues/Creation seeds a placement the type may not hold.md` records a `Milestone`
receiving an iteration's `start`. Adding a fourth seeded property to that list without
reading that note is how the same defect arrives a second time.

## Outcome
