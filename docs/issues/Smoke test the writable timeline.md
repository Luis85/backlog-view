---
type: Issue
order: 110
parent: "[[Product Backlog]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-04
files:
  - src/domain/timeline.ts
  - src/domain/bars.ts
  - src/view/interactions/timelineDrag.ts
  - src/view/render/timeline.ts
  - src/view/render/toolbar.ts
  - src/view/render/projections.ts
  - src/storage/collapseStore.ts
  - src/view/collapseState.ts
  - styles/roadmap.css
  - styles/timeline.css
---

# Smoke test the writable timeline

## Why this exists

The jsdom harness drives real DOM events against the real view, so it covers structure
and behaviour well. It computes no layout, so it cannot see a nested scroller, a sticky
containing block, a pointer engaging auto-scroll toward a pane edge, or whether a
one-pixel line at 0.55 opacity actually reads as a mark. The writable-timeline increment
restructured the dated axis onto two scroll boxes and put five gestures behind a
pointer, which is a larger surface only a live vault can answer for than this register
has carried at once on the roadmap.

## Getting a vault to look in

`npm run test-build` bundles the plugin into `.obsidian/plugins/product-backlog-view/`
in this repository and adds it to the enabled list, so the repository root opens as a
vault with the plugin installed. `docs/Product Backlog.base` is a real backlog with a
real milestone on it — open it and switch to the roadmap's timeline axis: the plugin
displaying its own register is the smoke test.

## How to check

**Exactly one thing scrolls.** Pan the timeline sideways and scroll it down: the pane
itself must never move, the header must stay pinned to the top of what does scroll, and
the sticky lead column must stay pinned to its left. jsdom can assert which element
carries which class and never that the pane actually stopped overflowing or that the
month labels held their place while the rows moved under them, so this is the two-axis
restructure's own claim and the part most worth looking at first.

**A drop over the sticky date header actually lands.** The header band sits above the
grid the same way the sticky lead column does, and both are hit-testing questions jsdom
cannot answer. Start a shelf-card drag, or grab a bar's body or a grip, and release with
the pointer over the row of month/week labels rather than the grid below it: the ghost
preview should still be legible there and the release should write the date under it,
not nothing.

**The preview reads as a contract.** Drag a shelf card over the grid, and drag a bar's
body and each of its end grips: the ghost bar and the dates it means should be legible
while the pointer is still moving, not only after release.

**An end grip is reachable at four pixels per day.** At month zoom (the default), grab
the end of a short bar and confirm the grip is a comfortable target rather than a sliver.
Then check whether all three densities — week at 16px, month at 4px, quarter at 2px —
are three *usable* scales rather than three numbers: 16, 4 and 2 are reasoned, not
measured, and the width of a real pane is the only thing that can say whether quarter
zoom shows enough plan to be worth having.

**Dragging toward the pane edge pans the grid.** Pick up a bar and hold the pointer near
the right edge of the timeline: the grid should auto-scroll, and at a usable rate.
Registering the scroller is checkable in tests; that it engages toward an edge at all is
a pointer-position behaviour of the drag library, which jsdom does not run.

**Today's line and a milestone dated today read as two marks at quarter zoom.** Create
or find a milestone dated today, zoom to quarter, and confirm two one-pixel lines are
visible rather than one. If a one-pixel line cannot be seen at all, the answer is a
denser `quarter`, not a thinner mark.

**The narrow-pane shelf compaction, and clipping under the header.** Narrow the pane (or
open the base embedded in a note) until the shelf toggle appears: press it and confirm
the shelf opens and closes, and that nothing clips under the sticky header in the
embedded case.

**The today line and jump-to-today from a scrolled position.** Pan away from today,
then press jump-to-today: confirm it returns in one action and the line is where it
lands.

**The band rule holds on the dated axis.** Shrink the pane's height until the shelf,
the context strip and the advisory cannot all fit. Confirm each one caps its own
height and scrolls its own content — none of them sticks to the scrollport the way
they do on the horizon axis, because the frame no longer scrolls sideways under them
there. `styles/roadmap.css` states this cascade; jsdom cannot compute a winner between
two same-specificity rules, so whether the cap actually applies is a vault question.

**The ghost's date label can render off-screen at a bar's far grip.** Pan the timeline
so a bar's start sits off the left edge of the pane — a plan spanning back before the
window's current view — and grab that bar's END grip. The pointer and the grip are
both plainly visible, but `timelineDrag.ts`'s preview positions
`.pbl-drop-ghost-dates` at the bar's START day (`--pbl-ghost-left`, the same variable
the ghost bar itself uses), so the date text can render off-screen or under the sticky
lead column while the thing being dragged is in full view. This is the specific case
where "the preview reads as a contract" above is reliably answered no — not a general
claim about the preview, but this one grip, on this one shape of bar. Not a fix for
this note: the label is chrome and legitimately wants a viewport-relative position,
unlike everything else this module draws, and that redesign is not this note's call.

## Acceptance criteria

- Checked in both light and dark themes.
- Anything adjusted is adjusted in a `styles/` partial only — none of this should
  require a behaviour change.

## Outcome

**Run 2026-08-04, in a live vault. Everything above passed except the preview's
placement**, which failed in a way no item here had predicted — the checks asked whether
the ghost was *legible*, and the answer was that it was legible and meaningless.

The ghost was drawn into `.pbl-timeline-drop`, a single overlay spanning the full height
of the grid, and `.pbl-drop-ghost` is `top: 50%`. So every preview appeared at the
vertical middle of the WHOLE timeline: never in the row being dragged, never anywhere a
reader could relate it to a note. Reported as "the ghosts are a bit confusing and not
related to anything", which is the accurate description.

Fixed by mounting rather than by arithmetic. A day track — a row's or the header's — is
`position: relative`, starts past the lead column, and `.pbl-bar` and `.pbl-drop-ghost`
carry identical geometry, so a ghost mounted in a track lands exactly where a real bar
would with no coordinate maths of its own. A MOVE now draws in the dragged item's own
row, beside the bar it proposes to replace; a PLACEMENT draws on the header's day strip,
because a card still on the shelf has no row and inventing one would claim a position in
an order the drop does not decide. `docs/requirements/Move and resize a bar.md` main flow
3 and `Drag from the shelf to schedule.md` step 1 now state this, which nothing did
before — the register specified the preview's CONTRACT and never its position, which is
how it drifted.

Two things stay open and are NOT closed by this run, both needing another look:

- The ghost's date label still takes the ghost's own `--pbl-ghost-left`, so on an end-grip
  drag of a bar whose start is off-screen the text can still render out of view. Moving
  the ghost into the row changes where that is, not whether it happens. The item above
  stands.
- `.pbl-drop-ghost-dates` sits at `top: calc(50% + 14px)`, which inside a 34px row places
  it against the row's lower edge rather than mid-grid as before. Whether that reads well
  — and whether it collides with the row below — is a look question this run predates.

**Not answered by this run, because it was not asked:** whether the today line swallows a
row's clicks, and whether nearby milestone labels cover each other. Both are parked
decisions waiting on exactly this kind of look, and both should ride the next pass:
[[The today line swallows a row's clicks]] and
[[Nearby milestone labels cover each other]].
