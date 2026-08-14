---
type: PBI
parent: "[[A third projection]]"
order: 40
status: Done
priority: P2
created: 2026-08-01
files:
  - src/view/render/emptyStates.ts
  - src/view/render/roadmap.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Roadmap empty states

**As** someone who has just switched to the roadmap and seen nothing, **I want** it to
say which of the possible reasons applies and where to fix it, **so that** I correct
the one thing actually missing instead of guessing among a blank pane's explanations.

The roadmap tells the truth about why it is empty, the way the tree and the board
already do: no axis configured is a different problem from an axis with nothing placed
on it, and both are different from a base whose notes are not work items. Each answer
names the option or the action it points at.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders with nothing to place |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | The roadmap never renders a blank pane. Whatever is missing, what renders names it and says where it is set. |

**Main flow**

1. The roadmap resolves its axis from the view options.
2. With an axis but nothing placed, the frame still renders — the declared buckets, or
   the dated grid around today — every region a drop target and every bucket a creation
   target, with the shelf beside it carrying everything unplaced.
3. The tree's empty-state honesty renders as an advisory beside the frame: how many
   notes the Base returned that are not work items, and the path to creating one.
4. The user acts on the named thing — configuring an axis, planning an item, creating
   one — and the next render places it.

**Extensions**

- **1a — no axis is configured.** Guidance names both ways to get one — the horizon
  property and its values, or the date properties — and where each is set. This is the
  one case with no frame, and it is guidance rather than a roadmap precisely because a
  roadmap would be a lie about an axis that does not exist. Beside the naming, one
  press does it: the same action the toolbar's ✨ runs
  ([[Backfill missing properties]]), which binds the horizon property and creates it on
  the items, so the next render is the Now-Next-Later frame with everything on the
  shelf. The same action, not a second idea of what setting the view up means — a fresh
  vault otherwise needs a property hand-written into a note before the picker will
  offer it, which is a loop guidance alone cannot break.
- **1b — every axis property is one the user cleared.** No button: there is nothing
  left to bind, and a button whose press would do nothing is worse than none. The
  guidance still names the options to set.
- **2a — every result is on the shelf.** The frame renders empty beside a full shelf.
  That is the honest report of a backlog not yet planned — the state every fresh backlog
  starts in — and the shelf's count is the fact; nothing suggests dates or horizons the
  user has not chosen.
- **2b — a declared bucket holds nothing.** It renders anyway
  ([[Buckets from a horizon property]]): a horizon exists whether or not anything
  currently sits in it, the board's own empty-column rule.
- **2c — the user creates while the timeline shows.** The New flow runs unchanged and
  the note lands on the shelf until it is scheduled. A grid cell is a pair of dates
  picked by pointer position, and a creation that routes through the naming prompt no
  longer means them; create-then-schedule keeps both acts specified, and the shelf is
  one drag from the plan ([[Drag from the shelf to schedule]]). Where the filter itself
  excludes a dateless note — a base admitting only dated items — the note is still
  created and still leaves the shelf's count: `createFromPrompt` emits the generic
  `Created` notice and nothing else, not the open-path announcement
  [[New cards in place]] describes for the board and horizon axes. That mechanism is
  the outcome report this increment does not build — see
  [[The outcome report was built from one sentence]] — so the guarantee here narrows to
  what ships rather than claiming what a comment once promised.
- **3a — the base returned notes that are not work items.** They are counted in the
  advisory rather than shown, the same report the tree and board make — and it renders
  beside the frame, never instead of it. An empty roadmap is an empty frame, never no
  frame.

## Acceptance criteria

- With no axis configured, the roadmap names the options to set and where, instead of
  rendering nothing — and offers the one press that sets them up, unless every one of
  them is a property the user cleared.
- With an axis and no placements, the frame still renders — every region a drop
  target, every bucket a creation target — beside the shelf and the ignored-notes
  advisory, never replaced by them; a note created while the timeline shows lands on
  the shelf until it is scheduled — or, where the filter excludes it dateless, is
  still created, with the generic `Created` notice and no open-path announcement.
- A declared bucket with nothing in it still renders its column.
- The all-shelved state renders the empty frame beside the full shelf and lets the
  count speak; the view suggests no placement the user has not made.

## Where it lives

Built. The no-axis guidance — missing-half wording included, and the setup press
(`renderSetupCta`, which runs `runInit` in `src/view/interactions/structure.ts`) — is
`renderRoadmapNoAxisState` in `src/view/render/emptyStates.ts`, beside the tree's and
the board's answers; the frame-beside-advisory rule is `renderRoadmapAdvisory` in
`src/view/render/roadmap.ts`. Driven in `test/view/roadmap.test.ts` and
`test/view/roadmapFrame.test.ts`. "Every region a drop target and every bucket a
creation target" arrived across three increments — [[Moving between horizons]] on the
horizon axis, the bucket's New flow ([[Buckets from a horizon property]]), and now
[[Drag from the shelf to schedule]] and [[Move and resize a bar]] on the timeline, whose
drop overlay — created in `src/view/render/timeline.ts`, wired as the one positional
target by `src/view/interactions/timelineDrag.ts` — spans the whole grid past the
sticky lead column so the empty space below the last row is a drop target too — which
is why this note now closes.
