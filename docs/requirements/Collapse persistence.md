---
type: PBI
parent: "[[View state]]"
order: 10
status: Done
---

# Collapse persistence

Which rows are open is remembered per base and per view, in vault-scoped local storage.

## Acceptance criteria

- It is never written to the `.base` file: it is one person's working position, not shared
  configuration, and a path per row is growth that file should not take.
- A row nobody has ruled on opens collapsed, so a large backlog starts readable.
- Renaming a note, a view or a base migrates the state rather than orphaning it.
- When the base cannot be identified the state is session-only — never a shared key.
