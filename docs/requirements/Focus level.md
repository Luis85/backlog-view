---
type: PBI
parent: "[[Finding work]]"
order: 20
status: Done
---

# Focus level

Re-root the tree at one level, the way Azure DevOps has separate Epics / Features / Stories
backlogs.

## Acceptance criteria

- Items keep their real parents; only the rendering is re-rooted.
- Ranking, indent and outdent are disabled across the synthetic top row, which is not a
  real sibling group.
- Types that rank with the focused level appear beside it rather than vanishing.
