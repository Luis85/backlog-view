---
type: PBI
parent: "[[Finding work]]"
order: 30
status: Done
---

# Filtered bases keep their tree

A Base filtered to one level or one tag returns matches without their parents, which would
flatten the tree. The view loads the missing ancestors from the vault and renders them as
**context**.

## Acceptance criteria

- A context row renders and parents, and does nothing else: never written to, never ranked,
  never counted, never a source of the base's vocabulary.
- The view refuses a whole write batch that would touch one, rather than dropping the
  offending write and half-applying the rest.
- Controls that would produce such a write are withheld from the UI.
