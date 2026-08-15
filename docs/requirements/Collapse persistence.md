---
type: PBI
parent: "[[View state]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Collapse persistence

**As** someone who comes back to the same backlog every day, **I want** it to open where I
left it, **so that** I am not re-collapsing the same eight branches every morning to reach
the one I am working in.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Expanding or collapsing a row; reopening the view |
| **Preconditions** | The base can be identified |
| **Guarantee** | Never written to the `.base` file. This is one person's working position, not shared configuration — and a path per row is growth that file should not take. |

**Main flow**

1. The user expands or collapses a row.
2. The change is recorded and saved, debounced, to **vault-scoped local storage**, keyed by
   base and by view.
3. Reopening that base and view restores exactly those rows.

**Extensions**

- **1a — the row is one nobody has ruled on.** It opens **collapsed**, once, the first
  time it is seen — so a large backlog starts readable. The decision is remembered as
  settled, so a data update never re-collapses what the user expanded, and a restored
  session is not undone by the very pass meant to honour it.
- **1b — a row is expanded to reveal a drop or a new child.** That also settles the path,
  so the refresh following the write does not collapse it again. A childless row is not a
  "parent" until that write lands, so nothing else would have settled it.
- **2a — the base cannot be identified.** The state is **session-only**. A shared fallback
  key would mean two different bases silently sharing one person's collapse state.
- **3a — a note, a view or a base is renamed.** The stored state is **migrated** rather
  than orphaned, so a rename does not silently reset the tree.
- **3b — stored paths no longer exist.** They are pruned, so the entry cannot grow forever.
- **3c — the vault cannot answer whether a path exists.** Nothing is pruned at all. The
  prune deletes other views' entries, and "I cannot see it" is only evidence when the
  reader can see anything — which is asked of the base this very view is drawing.

## Acceptance criteria

- It is never written to the `.base` file: it is one person's working position, not shared
  configuration, and a path per row is growth that file should not take.
- A row nobody has ruled on opens collapsed, so a large backlog starts readable.
- Renaming a note, a view or a base migrates the state rather than orphaning it.
- When the base cannot be identified the state is session-only — never a shared key.
- A malformed stored value is read defensively and discarded, not thrown on.
- A save made while the vault cannot resolve its own base prunes nothing.
- An entry carries the shape it was written in, so the next shape change can migrate it
  rather than reset it. A shape this version does not know is dropped; an unstamped entry
  is this shape.

## Where it lives

`src/storage/viewIdentity.ts` (which saved view this is: the leaf walk that finds the
`.base`, the storage key, and the rename arithmetic both halves need) ·
`src/storage/viewStateStore.ts` (what is stored: the defensive read, the one reader table
both directions run through, and pruning — the only module allowed to touch local
storage) · `src/view/viewState.ts` (which rows are shut, the once-only default, the
debounced save) · `src/view/viewStateController.ts` (the read/write pair each stored pick
exposes to the toolbar, and the render depth each change needs).
Tests: `test/storage/viewStateStore.test.ts`, `test/storage/viewIdentity.test.ts`,
`test/view/viewStatePersistence.test.ts`.
Base identity in a live vault is the one part this repository cannot check — see
[[Verify base identity in a live vault]].
