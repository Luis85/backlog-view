---
type: Bug
parent: "[[Reading the estimation table at a glance]]"
order: 10
status: Done
area: styling
priority: P2
created: 2026-08-21
closed: 2026-08-21
source: Reported from a vault, 2026-08-21 — the estimation panel's clear control drawing over the point button beside it
files:
  - styles/estimationPanel.css
  - test/view/estimation/styleRules.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The clear control overlaps the last point

## What happened

In a vault, the `x` that clears a dimension's own stored value drew **over** the last
point button of that dimension's row, while the space the row reserved for it sat empty
outside the buttons. The control is revealed on hover or focus
([[Reading the estimation table at a glance]]'s own criterion), so what a reader met was a
point button that stopped being clickable the moment they pointed at the row.

**Two faults in one rule, and the first one is the mechanism.** `.pbl-est-clear` is
`position: absolute; inset-inline-end: 0`, and the `position: relative` box it resolved
against was `.pbl-est-dim-head` — the same element carrying
`padding-inline-end: var(--size-4-5)`, whose own comment said it "holds the clear control's
gutter open". **An absolute inset resolves against its containing block's PADDING box**, so
`0` was measured from the inside edge of that padding: the control landed in the content
area, over the last point, and the gutter it was reserved by stayed empty beside it. The
element that reserves a gutter cannot also be the box the gutter's occupant is positioned
against, because the reservation is invisible to the inset.

**Second, the gutter was narrower than the control anyway.** `var(--size-4-5)` is 20px.
`.clickable-icon` in `app.css` is `padding: var(--size-2-2) var(--size-2-3)` — 4px 6px —
around an icon sized by the inherited `--icon-size`, which for this control resolves to
`--icon-m`: **18px on the desktop root and 20px at the touch breakpoint**. So the control is
30px, and 32px on touch. That number is a correction to what the pass predicted:
`docs/superpowers/specs/2026-08-21-estimation-polish-pass-design.md` read `.clickable-icon`
as wrapping an `--icon-s` 16px glyph and estimated "about 28px", and the inheritance chain
says otherwise.

jsdom lays nothing out, so the whole suite could see the markup was right and never that it
drew wrong — the same blindness [[An absence drew on the line below its own name]] records.

## Fix

`position: relative` moved from `.pbl-est-dim-head` to `.pbl-est-dim`. That row carries
`padding-block` only, so **its** padding box's inline-end edge is the head's border-box
edge, and `inset-inline-end: 0` now lands in the gutter the head reserves. `top: 0` still
resolves to where the head begins, so the control keeps its corner. The gutter itself
widened from `var(--size-4-5)` to `var(--size-4-8)` — 32px, the one token that covers both
the 30px desktop control and the 32px touch one, rather than a round number chosen for
looking about right. `.pbl-est-dim-head` now states in a comment that it declares no
`position` **on purpose**.

Two assertions, each watched failing before the CSS moved:

**Checked by** `test/view/estimation/styleRules.test.ts` — "positions the control against the row, not against the head that reserves the gutter"

**Checked by** `test/view/estimation/styleRules.test.ts` — "reserves the control’s real width rather than the 20px it used to"

**Scope of the root cause, and the test that establishes it.** What makes a neighbour safe
is not its shape but **whether its containing block declares padding** — that is the only
way an inset and a reservation can disagree, and it is the question this defect is entirely
made of. Every other `inset-inline-end: 0` / `right: 0` in `styles/` was read against that
test, and there are two rules and one comment:

- `.pbl-timeline-drop` (`styles/timeline.css`) is a full-bleed drop overlay — `top: 0`,
  `bottom: 0`, `left: var(--pbl-tl-lead)`, `right: 0` — covering everything past the lead
  column and reserving nothing. No gutter, so no gutter to miss.
- `.pbl-bar-clipped-end .pbl-bar-connector` (`styles/timelineFurniture.css`) is **the
  closest structural analogue to `.pbl-est-clear` in the whole sheet**: a 9px absolutely
  positioned button pinned to the inline-end edge of its bar, exactly as this control pins
  one to the edge of its row. It is safe for the reason the test asks about —
  **`.pbl-bar` (`styles/timeline.css`) declares no padding at all**, so its padding box and
  its border box are the same box and `right: 0` lands on the visible edge. Nothing is
  reserved there and nothing can be hidden.
- The third grep hit is inside the comment above the grid banding in
  `styles/timelineFurniture.css`, explaining why `right: 0` was *not* used for that band.
  Prose, not a rule — worth saying, since a count of matches is not a count of rules.

So nothing else in the stylesheet holds this mistake, and the reason survives a fourth
edge-pinned control being added tomorrow provided the same question is asked of it.

**What no check here reaches.** jsdom computes no layout, so the tests pin the selector that
carries `position: relative` and the width of the reserved gutter — never that the control
comes out inside it. And 32px is sized to Obsidian's own `--icon-m`: a theme that sets its
own `--icon-size` moves the control without moving the gutter. **A live-vault look is owed
and has not been made.**

## Lesson

**A gutter is reserved on one box and the inset that fills it resolves against another.**
`position: relative` on the element carrying `padding-inline-end` makes the padding
invisible to the very control it was opened for — the absolute inset starts inside it. When
an out-of-flow control has to sit in reserved space, the containing block has to be the box
*outside* the reservation, and the two declarations are one rule split across two selectors:
either one alone reads as complete and is not.

The second half generalises further: **a gutter width is computed from the control's own
tokens or it is a guess.** 20px was never the control's width, and the number that replaced
it did not come from the obvious reading of `.clickable-icon` either — `--icon-size`
inherits `--icon-m`, not the `--icon-s` a glance at that rule suggests, and it changes at
the touch breakpoint. A reserved width that names no token chain cannot be checked against
anything.
