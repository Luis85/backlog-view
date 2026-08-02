---
type: PBI
parent: "[[Hierarchy on the roadmap]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/itemTypes.ts
---

# Focus level picks the rows

**As** someone whose roadmap should speak epic to stakeholders and feature to the team,
**I want** the focus level to decide which rung becomes roadmap rows, **so that** both
readings come from one configuration instead of two documents.

Every surveyed roadmap picks a level: Jira plans epics, Azure lets each team row show
epics, features or stories, Linear rolls issues into projects. Here that selector
already exists — the focus level, which re-roots the tree and picks the board's cards
([[Focus level picks the cards]]) — and the roadmap gives it its third meaning: which
rung becomes rows, with everything beneath surviving in rollups and inferred spans.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Setting the focus level from the toolbar while the roadmap is showing |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | Focus is a render decision that writes nothing to any note and loses nothing: below the level survives in rollups and inferred spans, above it as context, and clearing focus restores every result. |

**Main flow**

1. The user picks a level from the toolbar — the same control the tree and board use,
   persisted the same way.
2. The roadmap's rows are that level's items, plus the extra types that rank beside it,
   exactly as focus mode already surfaces them.
3. Results below the focused level surface through their ancestors: counted in progress
   fills, gathered into inferred spans, never rendered as rows of their own.
4. Clearing focus restores every result to a row, badges carrying the difference.

**Extensions**

- **2a — no focus level is set.** Every result is a row, and each row's type badge
  carries the difference — the tree's own default, unchanged.
- **2b — a focused-level item is itself outside the filter.** It still places its
  results, as the board's inert context card does: visible, styled and announced as
  context, carrying only what its visible results give it. On the horizon axis it sits
  in the bucket its own value names only where that bucket already exists — a context
  value never adds one; on the timeline its span is the one its visible results give
  it ([[Spans roll up the tree]]), never one drawn from its own dates; with neither,
  it renders beside the shelf as context, apart from the shelf's count. Never
  draggable, never counted, never written.
- **2c — "Show parents outside the filter" is off.** The model holds no such parent to
  render, and the focused empty state answers honestly, as the tree's does.
- **2d — hiding finished work hides everything a context row stood for.** The row goes
  too: it renders only while it places a visible result, its own state never the thing
  keeping it on screen.
- **3a — the counts.** Bucket counts and the shelf count narrow with the rows, so the
  roadmap and its numbers always agree — the same pairing the board keeps between its
  columns and their counts.
- **3b — the quick filter's match sits below the focused level.** The row stays, by the
  match-path contract every projection shares — and while the filter is active it
  names its matching descendants, each opening its note, exactly as a kept card does
  on the board ([[The quick filter on the board]]). A fill and a span alone would
  leave the search's own result found, counted, and impossible to get to.

## Acceptance criteria

- With a focus level set, rows are that level's items plus the extra types ranking
  beside it; with none, every result is a row.
- Below-focus results are counted in fills and spans, never rendered as rows; ancestors
  render only as context; clearing focus restores every result.
- A focused-level context item places its visible results as an inert context row —
  placed only into a bucket that already exists or at the span its visible results
  give it, never one its own value or dates would add — never draggable, counted or
  written, and never part of the shelf's count.
- Changing focus writes nothing to any note — the choice itself persists as the view
  option it already is — and bucket and shelf counts narrow with the rows.
- While the quick filter is active, a focused row kept only by a descendant's match
  names those matching descendants, each opening its note — the board's rule,
  unchanged on the roadmap.
- The same toolbar control drives all three projections and persists as it does today.

## Where it lives

The row set and the context forms shipped with [[A third projection]]: `roadmapRows`
in `src/domain/roadmap.ts` asks the focus question the board asks — rendered roots
when focused, every result otherwise — and a focused context item places only into a
bucket that already exists, or stands beside the shelf apart from its count, never on
the timeline by its own dates (driven in `test/domain/roadmap.test.ts` and
`test/view/roadmapFrame.test.ts`). Which types rank beside a level is
`src/domain/itemTypes.ts`, already shared. The inferred spans, the fills counting
below-focus results, and the quick filter's descendant naming remain this note's work,
which is why it stays open.
