---
type: PBI
parent: "[[Finding work]]"
order: 10
status: Done
---

# Quick filter

Type in the toolbar to narrow the tree; matches keep their ancestors and their subtrees.

## Acceptance criteria

- Ancestors of a match render even when they do not match.
- Collapse state is ignored while filtering, and restored after.
- The filter is session state: it is never written anywhere.
