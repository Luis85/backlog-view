---
type: Issue
order: 10
parent: "[[Zoom and the today marker]]"
status: Open
priority: P3
area: defect
created: 2026-08-02
source: 2026-08-02 Codex review of PR #56, found while fixing the milestone line's twin
files:
  - src/view/render/timeline.ts
  - styles.css
---

# The today line swallows a row's clicks

## The defect

`.pbl-today` is a full-height mark drawn across the dated grid: `position: absolute`,
`top: 0`, `bottom: 0`, `width: 2px`, `z-index: 1`. It carries no `pointer-events`
declaration, so it is the hit-test target wherever it crosses a row.

A timeline row is `.pbl-card.pbl-timeline-row`, which sets no `position` at all. A
non-positioned element paints its background and its inline content in layers *below*
the positioned-descendants layer, and hit-testing follows paint order — so the line wins
every pixel of the row it crosses, except where a bar happens to cover it. A bar is
`position: absolute` and later in the DOM, so bars are above the line; the row's lead
column and its empty track are not.

The result is a 2px dead strip through every row at today's date: a click there does not
reach `wireCardActivation`, and a right-click does not open the context menu.

## How it was found

Codex raised the identical defect on `.pbl-milestone-line` in PR #56, which was fixed
with `pointer-events: none` — the milestone line is `aria-hidden` decoration whose
tooltip lives on its header label, so it wants no events at all. The today line has the
same structure and the same consequence, and Codex did not name it: it was found by
asking whether the sibling had the same shape, rather than by patching only the case that
was reported.

## Why it was not fixed with its twin

The two lines differ in one way that decides the fix. `setTooltip(line, 'Today — …')`
is attached to the today line **itself**, and the line is `aria-hidden="true"`, so that
tooltip is the only way to read which date the mark stands on. `pointer-events: none`
removes it.

So this is a trade rather than a correction, and the options are not equivalent:

1. **Accept the dead strip, keep the tooltip.** What ships today. One column of every
   row is unclickable, in exchange for a hoverable date.
2. **`pointer-events: none`, lose the tooltip.** The date is then readable only by
   counting against the month header. The mark's *position* still communicates today,
   which is most of its job.
3. **Move the tooltip to a header label**, the way the milestone line already does, then
   make the line transparent. This is the option that loses nothing — the milestone
   feature established the pattern and the CSS for it — and it costs a label in the
   header band, which is where horizontal space is already scarce
   ([[A milestone line across the plan]] extension 2a).

Option 3 is the likely answer and is why this is a note rather than a one-line commit:
it adds a rendered element to a band whose crowding is itself an open question
([[Nearby milestone labels cover each other]]), and the two should be decided together.

## What it is not

Not an accessibility failure. The line is `aria-hidden="true"` and every fact it carries
is decoration; a row's own accessible name is unaffected, and keyboard navigation never
routes through the line. What is lost is pointer access to a 2px column of each row, in
a projection where the same row is reachable by keyboard and by every pixel either side
of the mark.

## Where it lives

`renderTimeline` in `src/view/render/timeline.ts` creates the element and attaches the
tooltip; the rule is `.pbl-today` in `styles.css`, directly above the
`.pbl-milestone-line` rule that now carries the fix this note declines to copy blindly.
