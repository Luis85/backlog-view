---
type: PBI
parent: "[[Columns from the workflow]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
---

# WIP limits

A work-in-progress limit per column, defined in the view options beside the states it
limits. The Kanban Guide makes WIP control the element that turns a status board into a
kanban system, and it sanctions rare exceedance — which is why every surveyed tool
treats the limit as a signal: Azure Boards calls its limits "soft constraints... you
can exceed", Jira's column constraints are "purely visual", Trello's list limits
highlight and "won't stop you". Signals, never refusals, is also this plugin's own
rule.

## Acceptance criteria

- A limit per configured state can be set in the view options; unset means unlimited.
- The column header shows the count against the limit, and an over-limit column
  signals in more than colour alone.
- No drop, keyboard move or menu write is ever refused because of a limit.
- Limits apply to workflow states only — not to the no-state column, not to done
  columns. WIP is what sits between started and finished.
