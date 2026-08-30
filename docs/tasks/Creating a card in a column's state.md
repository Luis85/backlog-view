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
  - src/domain/writePlan.ts
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

1. `CreatePlacement` gains `state?: string | null`, and `NewItemSpec` with it. **The
   three values are three different facts and the type has to say so**: a string is that
   column's state, `null` is the no-state column's *deliberate* absence, and the property
   being missing is creation with no column context at all — the tree's `+`, the
   toolbar's **New**, a row's context menu.

   Collapsing the last two into one omission is the defect this step exists to avoid, and
   the register already names the case: [[Creating an item from a template]] extension 5c
   says a template's state survives ordinary creation but must **not** survive the
   no-state column, because *"the no-state column's placement is an explicit absence, not
   the absence of a placement"*. With `state?: string` and nothing written in both cases,
   nothing downstream can tell them apart. Found by review (Codex, PR #225).
2. `createBacklogItem` writes it under `settings.stateKey`, gated by `seeded` — the same
   condition the iteration and release keys carry, so a `Release` created from a column
   is seeded nothing, and by `settings.stateKey` being configured at all.
3. **The transition stamps ride the same write.** A card created into a started state
   carries `started: today`, and one created into a done state carries the finish stamp —
   under the same two conditions every other stamp has, that the key is configured and
   the state qualifies (`isStartedValue` / `isDoneValue`).

   `computeStateWrites` is where that logic lives, and it is reached only from
   `cardMoves.ts` today, so creation would otherwise write the state and no stamp.
   [[Stamp when work starts and finishes]] is unambiguous about the cost: *"a transition
   nobody stamped is gone"*, and *"a state change that is not stamped at write time is
   unrecoverable"*. That use case's own guarantee — *"a stamp is never a second write. It
   rides the batch that caused it"* — is what fixes the shape here: the batch that caused
   it is the `vault.create`, so the stamp belongs inside it and not in a write after it.

   Reuse the stamp decision rather than restating it; a second copy of "which values count
   as started" is the drift this repository has already paid for elsewhere. Found by
   review (Codex, PR #225).
4. The no-state column passes `state: null`, and `createBacklogItem` writes **no** key
   for it, rather than an empty one. This is `applyLabels`' rule arriving on the creation
   path: an unconfigured or absent key is never written, and `''` is a key the register
   says is not written at all. The distinction of step 1 is about what the *placement*
   records, never about what reaches the frontmatter — both cases write nothing.

Not in this task: which columns offer creation, and from where. That is
[[Creation from the column's three inputs]].

## Acceptance criteria

- A note created from a column carries that column's state, written in the same
  `vault.create` call as its type, parent and order — never a second write.
- A note created from the no-state column carries **no** state key. Not an empty string,
  not a null: the key is absent.
- The placement distinguishes the no-state column from creation with no column context,
  even though both write the same frontmatter — the bit [[Creating an item from a
  template]] extension 5c needs in order to strip a template's state in the first case
  and keep it in the second.
- A card created into a started state carries `started` with the creation date, and one
  created into a done state carries the finish stamp — both in the same `vault.create`
  call, and both only where the key is configured.
- A card created into a state that is neither carries neither stamp.
- A `Release` created from a column is seeded no state, exactly as it is seeded no
  sprint and no horizon today — and therefore no stamp either, since the stamps follow
  the state.
- With no state property configured, creation writes no state key and does not fail.
- Creation writes the new note only, never a sibling.

## Risks

The `seeded` guard is the one that has already produced a recorded defect elsewhere —
`docs/issues/Creation seeds a placement the type may not hold.md` records a `Milestone`
receiving an iteration's `start`. Adding a fourth seeded property to that list without
reading that note is how the same defect arrives a second time.

## Outcome
