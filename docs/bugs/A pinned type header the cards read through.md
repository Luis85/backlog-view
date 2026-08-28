---
type: Bug
parent: "[[The shelf, organized]]"
order: 70
status: Done
area: styling
priority: P2
created: 2026-08-28
closed: 2026-08-28
source: Reported from a vault — the type headers were named as differing between the two
  shelf layouts, and as letting the item underneath show through while the band scrolls
files:
  - styles/shelfControls.css
  - styles/shelfList.css
---

# A pinned type header the cards read through

## What happens

Two complaints about one strip, and they turned out to be one rule in the wrong file.

**It shows the cards through itself.** In the compact-row layout the type header is sticky
inside the band, so it holds its place while the rows go past it — and it was painted in
`--background-modifier-hover`, which is a `color-mix` with `transparent`. So the row under
the strip went on being drawn: the type name and a card's own title in the same 20px, both
legible and neither readable. Reproduced in the browser harness (`npm run harness`, driven
headlessly at 1000x420) by scrolling the band 46px: `FEATURE` sat over `Legacy importer`
with the type badge showing through the letters.

**And it is two headers, not one.** The card grid drew a muted uppercase line with a faint
count beside the name; the compact list drew a banded, letter-spaced strip with the count
as a pill at its end — and only the list's pinned. A type therefore read as two different
things depending on how much room its cards were taking.

## Why

The whole appearance lived in `styles/shelfList.css`, scoped `.pbl-shelf-list …`, because
that is where the compact row was built. Nothing about a type group header is about the
compact ROW: it says which type a reader is inside, which is the same fact in a grid of
cards, and the band is a scrollport in both layouts, so the reason to pin it holds in both
as well.

The transparency is the same class of defect as the search box's height on
[[The shelf title jumps when the band opens]] — a declaration that was never wrong to
read and never did what it says. A `background-color` on a sticky element is a promise to
occlude, and a token carrying alpha cannot keep it. The band's other two pinned strips —
the controls row and the resize grip — had both already been given
`var(--background-secondary)` for exactly this reason, and this one was not.

## The fix

One rule, in `styles/shelfControls.css` with the band's other chrome:

- `.pbl-shelf-group-header` is sticky, offset by the head's own two variables
  (`--pbl-shelf-head-top` + `--pbl-shelf-head`, so it docks under the controls row on
  either arrangement), at `z-index: 2` — under the controls' 3, over the cards.
- It paints `var(--background-secondary-alt)`, which is opaque and in the band's own
  family, so the strip hides what passes under it.
- `.pbl-shelf-group-count` carries the pill in both layouts.
- `styles/shelfList.css` names neither selector any more.

Checked in both directions: `test/view/shelfLayout.test.ts` fails if any
`.pbl-shelf-list`-scoped rule names the header or its count again — the category asked at
the forbidden thing rather than by comparing two rules — and `test/view/shelfResize.test.ts`
fails if the strip is not sticky and opaque, beside the same assertion the grip already
carries. Both were watched failing against the old stylesheet.

## What was learned

**A pinned strip is a category, not a place.** This band now holds three of them, and the
third repeated a hole the first two had already been fixed for. The check that stops a
fourth is the one on the whole class — "everything sticky in this band states an opaque
colour" — rather than a third assertion naming a third selector.

**And a restyle scoped to one layout is a second look for one thing.** The layout pick is
meant to change how much room a card takes and nothing else
([[Cards or a list on the shelf]] says exactly that), so anything drawn differently by it
has to earn the difference. The state chip earns it; a type header does not.
