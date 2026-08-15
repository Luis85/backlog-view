---
type: Epic
order: 20
status: Open
created: 2026-08-01
source: user request
area: product
started: ""
finished: ""
risk: ""
assignee: Sarah
start: 2026-08-03
due: 2026-08-30
---

# Product Roadmap

A roadmap mode for the backlog view: the same notes, the same hierarchy, projected onto
time. The projection toggle the board epic specifies ([[Switching projections]]) gains a
third position, and the axis is whichever the view options declare — confidence horizons
written on the notes, or a timeline drawn from two date properties. Every placement the
roadmap shows is frontmatter, and every change to one is a write through the same gate
the tree and the board write through.

## Why it exists

The tree answers "what exists, under what, and in what order". The board answers "where
is everything in the flow" ([[Product Kanban]]). Neither answers the question a backlog
is asked by everyone who does not work in it daily — what is happening now, what comes
next, and roughly when — and Obsidian has no good answer to it over *notes*:

- Core Bases ships Table, Cards, List and Map layouts; no first-party timeline exists,
  and a Bases Gantt/timeline view is a standing, well-supported request on the official
  forum.
- The closest community view — a Gantt over Bases — detects date properties by keyword
  and draws well, and states the gap this epic must not repeat: notes without dates
  simply do not appear. A roadmap that silently omits the unplanned majority of a
  backlog answers its question with a lie of omission.
- The other timeline suite in beta reports the two hard lessons first-hand: horizontal
  space is the scarce resource in an Obsidian pane, and keyboard access is where every
  ecosystem timeline is weakest.

What none of them have is what this plugin already has: a typed hierarchy, rollups,
sibling ranking, one write boundary, and undo. Like the board before it, this epic is
not a new data model — it is a third projection of the backlog that already exists.

## Two ways to say "when"

The roadmap literature and the trackers disagree about the axis, and the disagreement
is load-bearing. Dated timelines are what every surveyed tracker ships — Jira's
Timeline and Plans, Azure DevOps Delivery Plans, GitHub Projects' roadmap layout,
Linear's initiatives — and what the product-management canon warns against: a feature
on a dated bar reads as a commitment, and the Now-Next-Later format exists precisely to
organize by *confidence* instead of calendar. ProductPlan states the compromise as
practice: day-level precision only near term, month-level to ninety days, quarter-level
beyond — precision that decays with distance.

So the roadmap takes no side: both axes exist, the configuration decides, and each axis
is honest about what it knows:

| The roadmap's question | Here |
| --- | --- |
| Which horizon | A horizon property and its ordered values — declared in the view options, exactly as the workflow states are |
| When | A start and a target property, dates read tolerantly like every other field |
| How far along | The rollups the model already computes — never a stored percentage |
| Where is the rest | The shelf: what the axis cannot place stays visible and counted |
| What actually happened | The board's transition stamps ([[Stamp when work starts and finishes]]) — different keys, deliberately |

The last row is a rule, not a coincidence: a start the user *plans* and a start the
board *observed* are different facts, and a roadmap that wrote its plan over the record
would falsify history in the name of tidiness.

## Definition of done, for anything under this epic

The product epic's rules apply unchanged — never write to a note the Base excluded,
every property change can be taken back, nothing is maintained by hand — and the board
epic's "the projections never disagree" extends to three: one model, one result set,
one write gate, one undo history. On top of them:

- The roadmap exists only where an axis can: a horizon property with at least one
  value, or a date property, is the mode's prerequisite, and without one the mode is
  guidance, never a blank pane.
- The roadmap never loses a result: at full scope every result renders exactly once —
  in a bucket, on the timeline, or on the shelf. The narrowing that exists belongs to
  the controls the tree and board already share — the focus level and "Show completed
  items", with the quick filter as session state carried across — and restoring them
  restores every result to its place.
- Buckets are placements, never computations: an item's horizon is what its note
  declares, and no date is ever read as one. The format's inventors are blunt that a
  Now-Next-Later roadmap is not a release planner wearing new labels, and deriving
  buckets from dates would rebuild exactly that.
- Display inference is never written back: a parent's span rolled up from its children
  (the Jira Plans rule — earliest child start, latest child target, the parent's own
  dates always winning) exists on screen only. What lands in frontmatter is what a
  user did, on the note they did it to.
- A row outside the Base's filter obeys the context-row rule on the roadmap exactly as
  in the tree and on the board — it renders, it parents, and that is all: a
  breadcrumb, or an inert context row when focus lands on its level. Never
  counted, never written, never a source of buckets, spans or vocabulary.

Two neighbouring ideas were deliberately out of scope, so they would be re-decided
knowingly rather than rediscovered. One of them has been: **dependency arrows** were
refused because the schema had no dependency field and this epic adds no data model, and
on 2026-08-08 [[Dependencies]] took the question up and found the second clause did not
apply — a prerequisite list is one more user-named optional property, resolved like
`parent` and written through the same gate, so nothing about it is a second graph. The
refusal it keeps is the stronger one that was never stated as a scope boundary: no
dependency ever moves a bar or writes a date, because that would write to notes the user
did not touch on the strength of a drawing.

The other stands: a computed health signal (the surveyed trackers treat health as a
hand-set judgement; a hand-set property already renders as a chip through the property
columns, so it needs no feature here).

## Shape in the codebase

The layers keep their jobs. Which axis is configured, what a span is, and which bucket
or grid cell a result occupies are pure `domain/` questions beside `dropTargets.ts`;
the roadmap DOM is new `view/render/` and `view/interactions/` files beside the tree's
and the board's, under the same one-file-per-concern budgets; the only writer stays
`storage/frontmatter.ts`, gaining date and horizon writes plus their key removals (the
mirror of `removeParentKey`) under the same key-collision checks; the mode itself is
the persisted option [[Switching projections]] already defines, one value wider. Zoom
is a per-screen working position and goes to the view-state store, never
the `.base`.

## Evidence

Grounded in a survey run on 2026-08-01 of the roadmap-format literature, the roadmap
surfaces of the major trackers, and the Obsidian ecosystem. Load-bearing sources:

- Now-Next-Later's semantics and its case against dated commitment: ProdPad
  (https://www.prodpad.com/blog/invented-now-next-later-roadmap/ and
  https://www.prodpad.com/glossary/now-next-later-roadmap/); the feature-factory
  critique of dated output roadmaps: SVPG
  (https://www.svpg.com/the-alternative-to-roadmaps/); precision that decays with
  distance: ProductPlan (https://www.productplan.com/learn/what-is-a-product-roadmap).
- Rollup rules — earliest child start, latest child target, manual dates win, inferred
  bars styled as inferred, rolled-up values never written to the items: Jira Plans
  (https://support.atlassian.com/jira-software-cloud/docs/how-advanced-roadmaps-rolls-up-dates/).
- Placement fields and the scheduling gesture — start and target date or iteration,
  drag to set: GitHub Projects roadmap layout
  (https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout)
  and Azure DevOps Delivery Plans
  (https://learn.microsoft.com/en-us/azure/devops/boards/plans/review-team-plans).
- The unscheduled section and the parking lot — undated work visible beside the
  timeline, never omitted: Linear (https://linear.app/docs/projects) and Aha!
  (https://www.aha.io/support/roadmaps/strategic-roadmaps/releases-and-schedules/parking-lot-backlog).
- Obsidian prior art: the Bases view API
  (https://docs.obsidian.md/plugins/guides/bases-view), the forum request for a Bases
  timeline (https://forum.obsidian.md/t/bases-add-gantt-timeline-view/102390), the
  Gantt Bases view whose undated notes do not appear
  (https://github.com/lhassa8/obsidian-bases-gantt), the Time & Line beta's
  narrow-pane and accessibility lessons
  (https://forum.obsidian.md/t/time-line-a-set-of-gantt-chart-timeline-views-for-bases-beta/112884),
  and the Tasks plugin's date vocabulary the shipped placeholders stay compatible with
  (https://publish.obsidian.md/tasks/Getting+Started/Dates).
- Accessible timeline interaction: the treegrid shape commercial Gantt components
  document (https://www.telerik.com/design-system/docs/components/gantt/accessibility/),
  GitHub's keyboard pick-up, move, commit pattern
  (https://github.blog/news-insights/the-library/project-navigation-for-the-way-you-work/),
  and WCAG 2.2 SC 2.5.7 on single-pointer alternatives to dragging — the same
  obligation the board epic already carries.
