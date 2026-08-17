---
type: Bug
parent: "[[Resizable property columns]]"
order: 30
status: Done
area: styling
priority: P2
created: 2026-08-17
closed: 2026-08-17
source: Reported by the product owner against the shipped increment — resizing "feels wonky", the handle sits to the right, and the column title gives no hover feedback
files:
  - styles/propertyColumns.css
  - src/view/interactions/columnResize.ts
  - test/view/columnResize.test.ts
  - test/view/rendering.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A grip on the edge that never moves

## What happened

The grip shipped pinned inside each column's TRAILING gutter, and the gesture mapped a
rightward drag to a wider column — both copied from the timeline's lead grip, where both
are correct. They are correct there because the lead column is anchored at the pane's
START: its trailing edge is the edge that moves, so a grip on it tracks the pointer.

The property columns are anchored the other way around. The strip sits at the row's END
with the spacer taking the slack, so a column's trailing edge is held in place by the
columns after it and never moves when the column resizes — the moving edge is the LEADING
one. The result was a gesture in which the mark under the pointer stood still for the
whole drag while the column's far edge travelled the opposite way: drag right for
"wider", and the left edge slides left, away from the hand. Every part of it worked —
clamps, keys, RTL, persistence — and it still read as broken, because the thing being
dragged was not the thing moving. The separator pattern's own claim, that Arrow Right
moves the boundary physically right, was false on screen: the boundary the grip sat on
could not move at all.

A copied gesture carried an assumption its new strip inverted, and no test could notice:
the suite asserts widths, and every width was right.

## Fix

The grip now rides the column's LEADING boundary — the edge that moves — and `widenSign`
is inverted with it, so left to right a drag toward the spacer (left) is what widens and
the boundary follows the pointer exactly; right to left both flip together. The hit area
straddles the boundary and is exactly the inter-column gutter, which the header can
afford because its cells stopped clipping in the previous fix here; the 2px mark is
centred ON the boundary, so it tracks the drag, and the asymmetric gutter (8px from the
previous label, 4px to this column's own) leaves it nearer the label of the column it
resizes — the association [[A handle nobody could find, glued to the wrong column]]
introduced the leading gutter for, kept without the inset. The keys go through the same
sign, so Arrow Right now really does move the boundary physically right in both
directions.

The second half of the report, feedback that the header is interactive at all: hovering
a property header cell washes it in `--background-modifier-hover` (property cells only —
the rollup label has no grip and gets no wash), beside the existing mark reveal. The wash
is a **full-height square band**, on the reporter's own follow-up the same day: it shipped
as a rounded chip on the 24px cell inside a 37px strip, which read as something floating
in the header rather than as the column lighting up, and left unlit strip above and below
the boundary about to be dragged.

Making the PAINT full height was the wrong half to reach for. The cell's BOX was short —
`align-self: stretch` fills the strip's content box, and the strip's own padding sits
outside that — so the cell now backs that padding out as negative margin and puts it back
as padding: the box is the whole strip, top edge to bottom border, and the content sits
where it did (measured: the name's offset from the strip's top is unchanged at 12px). Two
things follow rather than being arranged: the wash fills the strip because the box does,
and the grip's own negative inset — the third of the three agreeing declarations
[[A handle nobody could find, glued to the wrong column]] recorded, which is the sentence
in that note this supersedes — collapses to `inset-block: 0`. One box escaping its parent
is a trick; two doing it separately is the same arithmetic written twice.

The direction tests in `test/view/columnResize.test.ts` were flipped and watched failing
against the old sign — eight of them — and `test/view/rendering.test.ts` pins the grip to
`inset-inline-start` beside the sign that assumes it, plus the wash, its rollup scoping,
the cell's margin/padding pair as ONE pin (the margin alone moves the content, the padding
alone grows the box the wrong way) and the wash's squareness. Both new pins were watched
failing against the reverted stylesheet.

## Lesson

Which edge a resize grip belongs on is a property of the STRIP's anchoring, not of the
gesture: the handle goes on the edge that moves, and in an end-anchored strip that is the
leading one. A gesture module shared between a start-anchored and an end-anchored strip
flips correctness silently when copied, and a suite that asserts widths cannot see it —
the number is right while the motion is backwards. When a shared gesture grows a second
caller, ask which physical edge each caller's boundary is before reusing the sign.

And the second half is the same lesson in the layout: **when two children of a box each
have to escape it, the box is the wrong size.** `align-self: stretch` reaching only the
content box is easy to patch per child and easy to keep patching — the grip did it, and
the wash would have been the second — where fixing the cell once makes both correct and
deletes an arithmetic. A child escaping its parent is a signal to measure the parent.
