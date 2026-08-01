---
type: PBI
parent: "[[Columns from the workflow]]"
order: 50
status: Open
priority: P3
created: 2026-08-01
files:
  - src/domain/viewOptions.ts
---

# Explicit policies on the column

The Kanban Guide's "explicit policies", made cheap: a line of exit criteria per column,
one hover away. Azure DevOps puts a per-column definition of done behind an info icon
on the column header; none of the other surveyed tools has it natively, and it is the
difference between a board that shows states and one that shows the working agreement.

## Acceptance criteria

- Each configured state can carry a short policy text in the view options, generated
  one option per state the way the per-type folder options already are.
- A column whose state has a policy shows an affordance on its header; the text is
  reachable by pointer and keyboard, and read to assistive technology.
- Policies render. Nothing enforces them — a card moves into a column whether or not
  its policy is met, exactly as the ladder guides and never refuses.
- With no policies configured, headers are unchanged: no empty affordances.
