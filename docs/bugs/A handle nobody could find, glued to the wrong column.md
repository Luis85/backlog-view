---
type: Bug
parent: "[[Resizable property columns]]"
order: 20
status: Done
area: styling
priority: P2
created: 2026-08-15
closed: 2026-08-15
source: Reported by the product owner against the shipped increment, reproduced and measured in the browser harness
files:
  - styles/propertyColumns.css
  - styles/cards.css
  - styles/motion.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A handle nobody could find, glued to the wrong column

## What happened

The resize grip shipped as a 6px strip pinned at `inset-inline-end: 0` of its own header
cell, painting `--interactive-accent` on `:hover` and on `:focus-visible` and nothing at
any other time. Two complaints, and they are one shape twice.

**It read as the NEXT column's decoration.** The cells sit flush — cell N's trailing edge
IS cell N+1's leading edge — and a cell had a trailing gutter but no leading one, so the
next column's label started at that boundary with nothing between them. A strip drawn in
the last 6px of the gutter therefore had 0px of air before the next column's first
character and ~74px after its own column's (measured on `STATUS`, whose label is short and
whose column is 132px wide). Every reader would attach it to the label it touches.

**And nothing said it was there.** Painting only under the pointer that is already on it
is circular: the affordance answers a question the reader has to have asked already. The
tree's other hidden controls are all in a menu as well, so a reader who never hovers the
right 6px still finds them; a boundary is not in any menu, so this one was findable only
by accident.

## What it is now

Four changes. The second is the one that actually fixes the first complaint, and the
fourth answered a follow-up in the same round: the mark was still a tick beside the name.

1. **The hit area and the MARK are separate boxes.** The grip is the full trailing gutter
   (`--size-4-3`, 12px) and draws nothing itself; a `::before` inside it is the 2px mark,
   inset by `--size-4-1` from the boundary. A 6px target was small for a mouse to begin
   with, and moving the mark by shrinking the strip would have made it smaller still.
2. **Cells gained a LEADING gutter** (`padding-inline: var(--size-4-1) var(--size-4-2)`),
   so the boundary has air on both sides and the mark sits in a gap rather than against a
   letter. This is what the grip's own inset could not buy: with the next label flush to
   the boundary, every position that is off the boundary is nearer that label than its own.
   Cards opt out (`.pbl-card .pbl-prop`), as they already do from the fixed width — a card
   stacks its cells and has no boundary to draw.
3. **Hovering the column NAME reveals the mark**, in `--background-modifier-border-hover`;
   the grip itself confirms in `--interactive-accent`. Two strengths: one for finding the
   handle, one for being on it.
4. **The mark runs the header strip's own height** — its top edge to its bottom border —
   rather than the label's 16px line box, which read as a tick floating beside the name in
   a 37px bar. Three declarations have to agree for that, and dropping any one crops it
   back: the header's cells `align-self: stretch` (centred ones leave a slack that is not a
   constant, being whatever the strip's height minus the line box happens to be), the strip
   and the label cell stop clipping (that clip is for a ROW's values ending at their
   column; a header name clips itself), and the grip backs the strip's own padding out of
   its block insets. The hit area grew with it, from the cell's 16px to the strip's 36px.

Measured in the browser harness, which is the only thing here that can measure it: the
mark's clear space before the next column's label went from 0px to 8px, and its own
column's values no longer start flush against the previous column's boundary.

## What it cost, and what nearly went wrong

**A specificity trap, found by measuring rather than by reading.** The hint is
`.pbl-col-label:hover .pbl-col-grip::before` at (0,3,0) and the confirm was
`.pbl-col-grip:hover::before` at (0,2,0) — and a pointer on the grip is a pointer on the
label too, so the hint won and the mark under the pointer stayed faint. The confirm is now
written through the label as well, so the two tie and document order decides.
`test/view/rendering.test.ts` pins that order, in both directions.

**A layout box is not what is painted.** The full-height mark measured 36px through
`getBoundingClientRect` while `.pbl-props`' clip was still cropping it to 24px — the box
laid out at the height asked for and the paint stopped at the content edge. What settled it
was asking the browser what is HIT-TESTABLE down the boundary, pixel by pixel, which is the
same question the reader's eye asks. A rectangle read back from the element that was just
sized is a measurement of the instruction rather than of the result.

**The instrument was wrong before the rule was.** `ruleAt` in that suite escapes the
SELECTOR it is handed and did not escape the DECLARATION, so `var(--x)`'s parentheses read
as a capture group and the pattern searched for `var--x`. Every pin naming a `var()` value
matched nothing. It failed loudly here because the new pins assert a rule is PRESENT; a pin
asserting one is absent would have passed while measuring nothing — the hazard
`CLAUDE.md`'s "measure with an instrument that can see all of it, and test the instrument
first" states, met again.

## What is still owed

The colours are Obsidian's default palette, which is all the harness has. Whether a 2px
`--background-modifier-border-hover` mark is visible enough **in a themed vault** — and
whether the hint reads as a hint rather than as a divider the header always had — is a
live-vault check, and it joins the steps already in
[[Tree columns and narrowing]] rather than being claimed from a screenshot here.
