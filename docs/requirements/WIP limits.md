---
type: PBI
parent: "[[Columns from the workflow]]"
order: 30
status: Done
priority: P2
created: 2026-08-01
closed: 2026-08-02
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-02
risk: ""
assignee: ""
---

# WIP limits

**As** someone trying to finish work rather than start it, **I want** each column to say
how much is in it against how much I agreed to allow, **so that** the board tells me I
have overcommitted at the moment I do it rather than at the retrospective.

A work-in-progress limit per column, defined in the view options beside the states it
limits. The Kanban Guide makes WIP control the element that turns a status board into a
kanban system, and it sanctions rare exceedance — which is why every surveyed tool
treats the limit as a signal: Azure Boards calls its limits "soft constraints... you
can exceed", Jira's column constraints are "purely visual", Trello's list limits
highlight and "won't stop you". Signals, never refusals, is also this plugin's own
rule.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Setting a limit in the view options, or moving a card into a limited column |
| **Preconditions** | Board mode is on and the column's state is one the workflow names |
| **Guarantee** | A limit never refuses a write. Every move that would be allowed without limits is allowed with them; what changes is what the board says afterwards. |

**Main flow**

1. The user sets a limit for a configured state in the view options.
2. That state's column header shows its count against the limit.
3. Work moves into the column as usual.
4. When the count passes the limit, the column signals — in more than colour alone, so
   the signal survives a colour-blind reader and a monochrome screenshot.

**Extensions**

- **1a — no limit is set.** The column is unlimited and its header is unchanged. An unset
  limit is not a limit of zero, and not an invitation to configure one.
- **1b — the column is the no-state column, or a done column.** Limits do not apply.
  WIP is what sits between started and finished; capping the backlog or the archive is a
  different idea wearing the same word.
- **3a — the move would put the column over its limit.** It still happens: no drop,
  keyboard move or menu write is ever refused because of a limit. The Kanban Guide
  sanctions rare exceedance, and a board that refuses teaches people to work around it.
- **4a — a quick filter is active.** The signal keeps reading the full population, not the
  matches ([[The quick filter on the board]]). A filter that made an over-limit column
  look under its limit would turn a search into a lie about the work.

## Acceptance criteria

- A limit per configured state can be set in the view options; unset means unlimited.
- The column header shows the count against the limit, and an over-limit column
  signals in more than colour alone.
- No drop, keyboard move or menu write is ever refused because of a limit.
- Limits apply to workflow states only — not to the no-state column, not to done
  columns. WIP is what sits between started and finished.

## Where it lives

One generated option per configured state — `wipLimit.<state>`, lowercased, the
mechanism the per-type folder keys already use — declared in
`src/domain/viewOptions.ts` and resolved in `src/domain/settings.ts`, which is also
where a done state is refused a limit. The column carries its own limit
(`src/domain/board.ts`), the header draws it (`src/view/render/board.ts`), and no
write path imports `overBy` at all — the cheapest possible guarantee that a limit
refuses nothing.

Driven by `test/domain/settings.test.ts`, `test/domain/viewOptions.test.ts`,
`test/domain/board.test.ts` and `test/view/board.test.ts`.

`test/view/columnAgreements.test.ts` is where this use case's own checks live,
including the guarantee that a limit refuses nothing: it puts the drop, the Alt+arrow
and the menu each into a column already over its limit and confirms the write lands,
then — following a drop with a refresh — confirms the column still says it is over
afterward rather than having stopped signalling.
