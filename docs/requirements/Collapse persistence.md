---
type: PBI
parent: "[[View state]]"
order: 10
status: Done
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

## Acceptance criteria

- It is never written to the `.base` file: it is one person's working position, not shared
  configuration, and a path per row is growth that file should not take.
- A row nobody has ruled on opens collapsed, so a large backlog starts readable.
- Renaming a note, a view or a base migrates the state rather than orphaning it.
- When the base cannot be identified the state is session-only — never a shared key.
- A malformed stored value is read defensively and discarded, not thrown on.

## Where it lives

`src/storage/collapseStore.ts` (identity, defensive read, pruning — the only module
allowed to touch local storage) · `src/view/collapseState.ts` (which rows are shut, the
once-only default, the debounced save).
Tests: `test/storage/collapseStore.test.ts`, `test/view/persistence.test.ts`.
Base identity in a live vault is the one part this repository cannot check — see
[[Verify base identity in a live vault]].
