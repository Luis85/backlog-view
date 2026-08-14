---
type: Epic
order: 30
status: Active
created: 2026-08-01
source: user request
horizon: Next
area: product
started: ""
finished: ""
risk: ""
assignee: Chris
---

# Product Kanban

A kanban mode for the backlog view: the same notes, the same hierarchy, projected onto
a board whose columns are the workflow states the view options already define. One
toolbar toggle switches projections, and every card move is a frontmatter write through
the same gate the tree writes through.

## Why it exists

The tree answers "what exists, under what, and in what order". It cannot answer "where
is everything in the flow" — that is a board's question, and Obsidian does not have a
good board over *notes*:

- Core Bases ships Table, Cards, List and Map layouts; a kanban view sits on the
  official roadmap as in progress, unshipped as of 2026-08-01.
- The long-standing Kanban community plugin stores a whole board as one note. Cards are
  lines of text rather than notes — invisible to Bases — the single board file is a
  sync-conflict magnet, and the plugin is looking for maintainers.
- Since the Bases view API shipped, at least seven community board views have appeared,
  all "group by a property" boards, and their issue trackers repeat the same failures:
  columns vanish when no note holds a value, one writes a slugified column name into
  frontmatter, another invented a board-only `kanban_order` property.

What none of them have is what this plugin already has: a typed hierarchy, rollups,
sibling ranking, one write boundary, and undo. This epic is not a new data model — it
is a second projection of the backlog that already exists.

## The workflow is the definition

The Kanban Guide's "definition of workflow" names the minimum a kanban system must
define: the work items, their started and finished points, the states between them, how
work in progress is controlled, explicit policies, and a service level expectation —
and then says plainly: "The visualization of a DoW is a Kanban board." Most of that
definition already lives in this view's options, which is what makes the epic small
enough to build:

| Definition of workflow | Here |
| --- | --- |
| Work items | Notes carrying the plugin's frontmatter |
| States, in order | `stateValues` — already ordered; the board is why the order matters |
| Finished | `doneValues` |
| WIP control | Per-column limits ([[WIP limits]]) |
| Explicit policies | Per-column exit criteria ([[Explicit policies on the column]]) |
| Started, and the SLE | Out of scope until transitions carry dates ([[Stamp when work starts and finishes]] is the seed) |

The guide is blunt that a board without limits and policies is a status sorter, not a
kanban system. This mode is honest about that the way the plugin is honest everywhere:
the columns come first and work on their own, and the options that make them kanban are
one field away — offered, never enforced.

## Definition of done, for anything under this epic

The product epic's own rules apply unchanged — never write to a note the Base
excluded, every property change can be taken back, nothing is maintained by hand.
Creation keeps its documented exception: undo never deletes a note, so a card made in
place sits outside the undo history here exactly as a new item does in the tree. On
top of them:

- The two projections never disagree: one model, one result set, one write gate, one
  undo history. A change made on the board is the change the tree shows.
- The board exists only where a workflow can: a configured state property — the
  Deliverables board's own, or (falling back) the requirements board's — is the
  mode's prerequisite, and without one board mode is guidance, not columns. Past that
  gate, the board never loses a result to its OWN population: at full scope, every
  result the model holds renders in exactly one column on the board that shows its
  type, and that board's column counts sum to that count. The hierarchy scope ("Ignore
  notes outside the hierarchy") prunes ahead of every projection alike, its toll
  carried by the same ignored-note advisory the tree shows; past it, exactly two
  controls narrow a board's population further, in every projection alike — the focus
  level (descendants surface in card rollups, ancestors as context) and "Show completed
  items" (fully-done subtrees hide, by the tree's own `subtreeDone` predicate). The
  narrowing belongs to those two controls, never to a board picking and choosing among
  its OWN type's results — with one deliberate exception that is not really an
  exception: **type** itself decides which of the two boards a result is even eligible
  for. The requirements board excludes every `Deliverable`, and the Deliverables board
  excludes everything else, each scoped to the one kind of work it exists to show (see
  [[A Deliverables board]]). Restoring the two controls restores every eligible result
  to a column; nothing restores a Deliverable to the requirements board's columns,
  because it was never that board's result to begin with — the tree and the roadmap
  still hold it, and it still counts there. The Deliverables board carries a second,
  later exception of its own: neither of the two controls narrows IT at all — the
  focus level was reversed to leave it alone entirely, and "Show completed items"
  never applied there to begin with — so only the quick filter narrows this one
  board's population (see [[A board scoped to Deliverables]] extension 3b).
- No second source of truth: no board-only rank property, no board-only state, no
  state string written that the user did not configure or observe.
- A row outside the Base's filter obeys the context-row rule on the board exactly as
  in the tree — it renders, it parents, and that is all: a breadcrumb, a lane header,
  or an inert context card when focus lands on its level. Never counted, never
  written, never a source of columns.

## Shape in the codebase

The layers keep their jobs. Deriving columns from the model and the settings is pure
`domain/` work beside `dropTargets.ts`; the board DOM is new `view/render/` and
`view/interactions/` files beside the tree's, under the same one-file-per-concern
budgets, with Atlassian's Pragmatic drag and drop as the drag layer
([[Pragmatic drag and drop for the board]]); the only writer stays `storage/frontmatter.ts`, gaining a remove-the-state-key
write (the mirror of `removeParentKey`) and the optional transition stamps; and the
mode itself is working position, toggled from the toolbar and held per saved view in
the collapse store's vault-scoped localStorage — the rule throughout: base settings
are saved on the view, UI state in localStorage. Column collapse goes to the same
store, never the `.base`.

## Evidence

Grounded in a survey run on 2026-08-01 of the Kanban Guide and the boards of Azure
DevOps, Jira, GitHub Projects, Linear, Trello and Notion, plus the Obsidian ecosystem
(core Bases, the Kanban and Projects community plugins, and the Bases boards that
followed the view API). Load-bearing sources:

- Kanban Guide, 2020.12 and 2025.5 — the definition of workflow, WIP control, flow
  measures: https://kanbanguides.org/
- Obsidian roadmap (kanban view for Bases: active, unshipped) and Bases layouts:
  https://obsidian.md/roadmap/ and https://obsidian.md/help/bases/views
- Column-to-state mapping and soft WIP limits: Azure Boards and Jira documentation
  (https://learn.microsoft.com/en-us/azure/devops/boards/boards/add-columns,
  https://support.atlassian.com/jira-software-cloud/docs/configure-columns/)
- Layout as a persisted per-view setting, and the sorted-board rule: GitHub Projects
  and Linear documentation
  (https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout,
  https://linear.app/docs/board-layout)
- Accessible board interaction: Atlassian's Pragmatic drag and drop accessibility
  guidelines (https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines)
  and WCAG 2.2 SC 2.5.7. The library those guidelines describe is the chosen drag
  engine (https://github.com/atlassian/pragmatic-drag-and-drop, Apache-2.0).
