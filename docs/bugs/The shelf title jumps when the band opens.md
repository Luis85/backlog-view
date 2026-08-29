---
type: Bug
parent: "[[Searching the shelf]]"
order: 10
status: Done
area: view
priority: P3
created: 2026-08-21
closed: 2026-08-21
source: Reported from a vault while asking for the shelf's two new controls — the title was seen moving, and the search box was correctly named as the cause
files:
  - styles/shelf.css
  - styles/shelfControls.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The shelf title jumps when the band opens

## What happens

Opening or closing the shelf moves its own name down or up the pane. The disclosure the
reader just pressed is the thing that moves, so the label they were reading is somewhere
else by the time the band has drawn.

Measured in the browser harness at a 1200x800 pane, on Obsidian's own app.css, by
toggling the disclosure and reading the boxes back:

| | shut | open |
| --- | --- | --- |
| `.pbl-shelf-header` | 19px | 30px |
| `.pbl-shelf` block padding | 4px | 8px |
| `.pbl-shelf-name` top | 60.0px | 69.5px |

## Why

Two causes, and neither is visible from the markup.

**The search box is 30px, not the 20px this stylesheet asks for.** `.pbl-shelf-search-input`
set `height: var(--size-4-5)` — a single class, specificity (0,1,0) — and Obsidian's own
`input[type='search']` rule is (0,1,1). The class lost outright, and had done for as long
as the field had existed. That is the same class of defect as the doubled border the field
carried until 2026-08-16: `styles.css` loads after `app.css`, so an equal-specificity
selector wins, and a lower one never does. Nothing here could see it — jsdom lays nothing
out, and the harness needed a deliberate measurement rather than a look, since 11px is not
something a screenshot reads as wrong.

**And the band's own padding halves when it shuts.** `.pbl-shelf-collapsed` set
`padding-block: var(--size-4-1)` against the shared 8px, deliberately, so a shut band would
keep a minimal footprint. It does — and it moves everything inside it by 4px while doing so.

The two are additive and in the same direction, which is why the title moves 9.5px rather
than the 4px a reader might attribute to the padding alone.

## The fix

One row height, whether the band is open or shut, and one block padding for both states:

- `input.pbl-shelf-search-input` — an element-plus-class selector, (0,1,1), which ties with
  Obsidian's and wins on source order — sets the field to `var(--size-4-6)` with no block
  padding. The height it asks for is now the height it gets.
- `.pbl-shelf-header` reserves that same `var(--size-4-6)` as a `min-height`, so the row is
  the search box's height whether or not the search box is in it.
- `.pbl-shelf-collapsed` no longer states a padding of its own.

Both halves are needed and neither is sufficient: reserve without shrinking and the shut
band carries 30px of nothing; shrink without reserving and the row is still two heights,
only closer together.

Measured again after the fix, same pane, same three states: the name sits at 62.5px open,
shut and reopened. The shut band is 34px where it was 29px, which is the cost this trade
states out loud — five pixels, in exchange for a title that does not move.

## What was learned

**A declaration that loses the cascade fails silently and forever.** The `height` here was
not wrong, it was never applied, and every reading of this stylesheet since has taken it at
face value. What makes this stylesheet's own comment about the search box worth re-reading
is that it already knew the shape of the problem — it says Obsidian styles
`input[type='search']` itself and that an attribute selector outranks a single class — and
then set a height through a single class three lines below. Knowing the rule is not the
same as applying it at the declaration in front of you.

**And jsdom cannot see any of it.** `test/view/shelfSearch.test.ts` asserts the field's
markup, its tab index, its keyboard path and its clear button, and would have gone on
passing at any height. What found this was a reader in a vault; what confirmed and then
measured it was `npm run harness` driven headlessly — which is the honest division of
labour ADR 0020 describes rather than a gap to close with a test.
