---
type: PBI
parent: "[[A third projection]]"
order: 80
status: Done
priority: P2
created: 2026-08-21
files:
  - src/domain/shelf.ts
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/viewStateController.ts
  - src/view/viewStateSurface.ts
  - src/view/host.ts
  - src/view/render/shelf.ts
  - src/view/render/contextStrip.ts
  - src/view/render/shelfControls.ts
  - src/view/interactions/shelfMenu.ts
  - src/view/interactions/menu.ts
  - styles/shelf.css
  - styles/shelfControls.css
  - styles/index.css
started: 2026-08-21
finished: 2026-08-21
horizon: ""
start: 2026-08-21
due: 2026-08-21
risk: ""
assignee: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Cards or a list on the shelf

**As** someone working through a shelf of untriaged items, **I want** to switch it
between cards and a compact list, **so that** nineteen unplaced notes are nineteen lines
I can read down rather than a grid of nineteen boxes I have to read across.

[[The shelf, organized]] gave the band a sort and a type filter, [[Searching the shelf]]
gave it a search. All three answer *which* cards. This one answers how much room each
takes, which is the question a long shelf actually raises: measured in the browser
harness at a 1200x800 pane, a shelf card is 110.1px tall and 277.8px wide, so the demo
backlog's nineteen unplaced items are 1301px of content in a band that gets a share of
the pane. As rows they are 28.4px each.

It is the same argument [[Turning the bucket grid off]] made for a horizon bucket, and it
is working position rather than a view option for that note's reason (ADR 0011): which
one a reader wants changes by the day and by the task, not by the base.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The reader presses the layout picker in the shelf's own header, or picks Shelf layout in a card's context menu |
| **Preconditions** | A shelf drawn, open and non-empty — the roadmap's, on either axis, or the iteration board's; either one carries the picker and either one is where the pick is made. Extension 1a is the only shelf that carries none, and says why. |
| **Guarantee** | Every card in the band draws in the picked layout, the pick is remembered for this saved view on this device, and nothing is written to the `.base` or to a note. The layout narrows nothing: the same cards are drawn either way, so the shelf's own count stays the true total in both. |

**Main flow**

1. The shelf's header carries a third picker beside the sort and the type filter,
   wearing the icon of the layout currently in force.
2. Pressing it opens a menu of the two layouts, the current one checked.
3. Picking `List` redraws every card in the band as one compact row — the type badge,
   the title, and then everything the card already carried on one line.
4. A row also carries its workflow STATE, which a card does not.
5. The pick goes to the view-state store. Reopening the view draws the band the same way.
6. Picking `Cards` restores the grid, and stores nothing — a default is an absent value.

**Extensions**

- **1a — the shelf is collapsed, or holds nothing.** No picker, exactly as the sort and
  the type filter are withheld: there is nothing to lay out, and a control that visibly
  does nothing is worse than one that is not there.
- **1b — the shelf is the iteration board's.** It draws the picker, and the three beside
  it, as of 2026-08-21. It did not until then, and the reason was never about this band: the
  keyboard path for a `tabindex="-1"` control here is the card menu's shelf section, which
  was built for the roadmap alone, so offering the controls would have made them
  pointer-only. `addShelfSection` serves both surfaces now, and `activeShelf`
  (`src/view/shelfSurface.ts`) is what tells them which band they are acting on. The pick
  itself always applied here — that was the SORT's half of `renderShelf`'s narrowing rule
  rather than the search's, since a layout draws every card either way. Now that the
  controls are on screen the search and the hidden types apply here too, which is the same
  rule reaching its other branch rather than an exception to it: a narrowing may hide work
  exactly where something on screen says it is doing so.
- **2a — the reader has no pointer.** `Shelf layout` is a submenu of any shelf card's
  context menu, built from the same list, so the two surfaces cannot offer different
  layouts or disagree about which is checked.
- **4a — the Base draws no state column at all.** No chip and no gap: `renderShelfState`
  returns before drawing anything, so the row carries no box for one to be missing from — a
  band-wide absence reserves nothing, because no row on the band has the column either.
- **4b — a row's own workflow writes a different state key than the one drawn.** Held open
  rather than dropped, as of Task 4 of this same follow-up: the cell stays, empty, so the
  property cells after it (and the aligned-column criterion below) do not shift on this row
  alone. A per-row absence is not the band-wide case 4a covers — a column that skips one row
  is not a column, the same rule the aligned-column criterion states for the plain property
  cells.
- **3b — a shelved parent with children.** Its LIST stays beneath the line and its
  DISCLOSURE joins it. `.pbl-card-kids` is a direct child of the card, so a card laid out as
  a row put the whole block beside the title: measured at 35px against 28px with the list
  still shut, and taller with it open, the whole summary then centred against it. That is
  what the summary box fixed. What it left was three more: the disclosure was a line of its
  own even while shut, so a parent row was 48px where every other row was 28px; it sat flush
  with the card's left edge, further left than the badge column of the row it belongs to,
  which is what made it read as a sibling; and its top margin separated it from its own row
  while nothing connected the children back up. So the chevron and its count take a leading
  fold slot on the line — the tree's own idiom, and the reason a tree row is one line whether
  or not it has children — the slot is reserved on every row so the badges keep one x, and
  the list is indented to the title with the tree's own indent guide. The count is a number
  in the slot and the sentence is the toggle's `aria-label`, which is what the list is named
  by. Measured in the harness (1400px pane, the demo backlog): a shut `Monthly statement`
  and a childless `Voice control` both report 28px; expanded, `Reconcile the ledger`'s badge
  and `Monthly statement`'s own title report the same `left`, to the pixel; the indent guide
  renders a solid 1px line in both `?theme=light` and the default dark scheme. (2026-08-21.)
- **3c — a pane too narrow to keep the floor.** The floor yields itself. A reservation is a
  promise about a container with the room to keep it, and below some width 16ch plus the
  badge, the gaps and the cells is more than the row has — at which point a fixed floor
  stops protecting the title and starts overrunning the line. Measured across the range
  rather than argued: at 1200, 640, 480, 430, 420, 400, 390 and 380px the summary's scroll
  width equals its client width exactly, and at 320px the row overruns by 16px even with the
  floor yielding. Re-taken at the end of PR #187 — the fold slot's 38px of rigid lead moved
  the onset, so the older reading (clean at 380, 7px at 320) describes the pre-fold-slot row
  and not this one. It is capped at a share
  of the SUMMARY's own box rather than of the viewport, since a shelf in a split pane is
  narrower than the window around it. (Codex, PR #183 — the 1200px measurement the floor
  first rested on did not exercise this at all.)
- **3d — a column no card in the band draws.** Not reserved. The per-ROW rule (4b and the
  criterion below) holds a cell open for a column this note has no value for, because a
  dropped cell moves every cell after it; the per-BAND question is a different one, and only
  the band can answer it. A compact row has no column header, so a column that is empty
  everywhere is a stretch of nothing between the title and the metadata rather than an empty
  column a reader can see. Measured at a 1280px pane over the demo backlog's twenty unplaced
  items: three of five columns drew on zero rows, 384px of the row, and the title sat at its
  floor; narrowed, the title takes 377px. Each kind is asked the question its own cell asks —
  `renderValue`'s own three tests for a value or a date end, the last of which needs a render
  and gets one, and A PILL for the tags, whose add button is
  hover-revealed and so shows a tagless reader nothing (Codex, PR #208, on a first draft that
  read the tags cell as a chip). The chip kinds are never asked, because an unset note still
  gets a dashed `Assignee` or a `State` and the one case that draws nothing — a context card
  with no value — is one this band cannot hold. See
  [[Reserve only the columns the shelf has values in]].

- **3a — a title too long for one line.** It truncates with an ellipsis rather than
  wrapping: a row that grew a second line would not be a row. The title yields and the
  property cells keep their content width, which is the TREE's own order — its columns are
  fixed width and the row's name is the flexible part — but it yields only down to a floor.
  Without one, a Base exposing several properties squeezed a 768px title to 103px, measured
  in the harness at a 1200px pane with seven cells on the row. The cells shrink first below
  that floor: at a 760px pane the same row held its title while the cells went from 700px to
  348px. Nothing spills either way, and that takes TWO declarations on the wrapper rather
  than one: `flex-wrap` turned off, since a wrapper that can finally be squeezed is one whose
  cells wrap to a second line, and `overflow: hidden` restated, since `.pbl-card .pbl-props`
  turns off the clipping `.pbl-props` has by default. "Every cell ellipsises inside itself"
  is true of a cell's TEXT and not of everything a cell holds — a tag pill does not
  ellipsise, and with the card's `overflow: visible` in force the pills painted past the
  row's edge from 420px down. (Codex, PR #183, which read the squeeze as a horizontal spill;
  the measurement says which half is real. The clipping half is the final review on PR #187.)

  **What the row gives up before it gives up the line is the state cell**, and that is not
  recovered by the clipping: it is the last top-level item and the one with the least to
  hold, so it resolves to 2px at 430 and 420 and to 0 from 400 down — the chip is gone on a
  phone-width pane while the title, the badge and the notes lane are all still drawn.
  Recorded rather than fixed: the row's rigid lead is the badge and the fold slot, and buying
  the chip back means shrinking one of those, which costs the alignment Task 5 rests on.

## Acceptance criteria

- The picker draws in a shelf header while the band is open and non-empty — the roadmap's
  or the iteration board's, since 2026-08-21 — and on no other screen; it is
  `tabindex="-1"` like the two pickers beside it.
- The iteration board's shelf draws the same four controls and applies all of them, with
  the card menu's shelf section as their keyboard path.
- Picking a layout flips what the band draws and what the picker's own icon shows, under
  one fixed name.
- The same cards are drawn in both layouts, and the shelf's count is unchanged by the
  pick.
- A compact row's columns are the tree's stored widths, published on the band: the badge in
  its own `--pbl-shelf-badge` slot, the cells at `--pbl-prop-w-N`, every row holding a cell
  open for every column THE BAND SHOWS SOMETHING IN, so a missing value is a gap rather than
  a shift — and a column no card in the band draws is not reserved at all, which is
  [[Reserve only the columns the shelf has values in]] rather than this criterion's original
  wording (it said "every column", and that reserved 384px of nothing on every row of the
  demo backlog's shelf). Measured at a 1400px pane over twenty unplaced items, against
  the commit before this one landed: titles at one x position where there were four, median
  row 28px where it was 22.4px (not the 34px an earlier draft of this note stated, which
  does not reproduce).
- The cells shrink together rather than forcing a horizontal scrollbar the band has never
  had, and they shrink identically row to row because the title's flex basis is 0 and no row
  drops a cell.
- A compact row is ONE line whatever it carries — property cells included — and its title
  keeps a stated floor rather than being squeezed away by them. The floor is a share of the
  row it sits in, so a pane too narrow to honour it gives it up instead of overrunning. Down
  to 380px nothing paints outside the row; below that the row overruns, and the state cell is
  already at zero width from 400px down.
- A shelved parent's children list is the card's own child rather than the summary's, so it
  draws beneath the line; the card grid draws no summary box at all.
- A compact row carries the state chip; a card does not. The chip is the tree's own — a
  `<button>` with `tabindex="-1"` for a result, whose menu is the one Set state opens.
- The card menu offers the same two layouts with the same entry checked.
- The pick survives closing and reopening the view, and nothing reaches the `.base`.
- Cards remain the default: switching back leaves no stored field behind.

## Where it lives

`ShelfLayout` in `src/domain/shelf.ts`, beside `ShelfSort` and for its reasons — display
only, never written to a note. It is a named TYPE rather than the boolean
`bucketList` is, because it is offered on two surfaces and a menu entry checked against a
negated boolean is one edit from disagreeing with the button it mirrors. The store keeps
its own rule anyway: `shelfList` in `src/storage/viewStateStore.ts` is an `onlyTrue` pick,
the OFF state for the cards, and `shelfLayout()` / `setShelfLayout()` in
`src/view/viewState.ts` is the one place that inversion is spelled. It reaches the modules
through `BacklogViewHost` (`src/view/host.ts`) and
`src/view/viewStateSurface.ts` like every other view-state member, with
`src/view/viewStateController.ts` rendering the content pane on the flip.

**The layout draws the same content either way, and nearly all of it is the stylesheet.**
`renderShelf` (`src/view/render/shelf.ts`) puts `pbl-shelf-list` on the band, the same
`renderCardBody` builds the same children, and `styles/shelf.css` lays the card's own
children out in a row instead of a column. So an item cannot look different per layout in
any way but the ones drawn deliberately, and the pick cannot come to hide work the count
still claims.

**Nearly**, and the exception is worth stating rather than rounding away, because this note
claimed "no render branch" for one commit and that was wider than the code
(Codex, PR #183). A compact row draws ONE extra element — `.pbl-card-summary`, the box the
line itself is — so that a shelved parent's children list can be the card's second child and
fall beneath the line rather than sitting at the end of it. It is a wrapper and never
different content: the same children are built, and the card grid creates no wrapper at all.
Extension 3b is why it could not be done in CSS alone.

`renderCardBody` takes `kidsEl` for that wrapper — where the children LIST falls when that
is not the card itself — and the shelf's row is its only caller: the summary takes the
body, the card takes the list. The state cell below goes to the summary too, since it is
part of the line.

**The DISCLOSURE is a second, later split (Task 5 of this same follow-up).** `kidsEl`
decided both halves until then — the toggle built inside whichever element it named, so a
compact row's disclosure sat at the end of the line beside the list it opened, a line of its
own even shut (48px where every other row was 28px) and further left than the badge column
it belongs beside. `toggleEl` is `renderCardChildren`'s own option now, naming the toggle's
home separately from the list's: the shelf's row passes a leading `.pbl-shelf-fold` slot,
reserved on every row whether or not it holds a disclosure, and passes `kidsEl` as before
for the list that falls beneath the line. A card passes neither, so its disclosure still
builds inside its own wrapper exactly as it always has. On the line, the toggle's visible
count drops to a bare number — the slot has no room for a sentence — and the sentence
itself moves to the toggle's `aria-label`, which is what `aria-labelledby` still names the
list by.

**The shelving reason, the dependency statement and the parent breadcrumb go into a fourth
wrapper, `.pbl-shelf-notes` — Task 4 of this same follow-up, and a correction rather than a
preference (Codex, PR #187).** All three are present on some rows and absent on others, and
each one that is missing takes its width off the row and shifts every fixed column after it
— exactly the failure `holdEmpty` exists to stop for the property cells one line down. The
lane is drawn unconditionally, before `renderCardBody` runs, and handed to it as `rollupEl`
so the rollup lands inside it too; `renderShelfNotes` (`render/shelf.ts`) then fills it with
whichever of the three apply and moves it to the end of the line, since it had to exist
before the body could fill it and so was created between the fold slot and the badge. The
two notes show only their ICON in list mode (`styles/shelfList.css`), with the sentence kept
in the DOM for the accessible name and a tooltip for a pointer reader who can see it.

The first deliberate difference is `renderShelfState`, also in `render/shelf.ts`. A card
draws no state chip because its own POSITION says the state — a board column IS a state, a
bucket IS a horizon — and the shelf is exactly where that argument stops: a shelved card is
in no column and no bucket, so a row is the only place its state appears at all. It is
drawn through the RESOLVED columns and `renderPropCells` (`src/view/render/columns.ts`),
never a second reading of the settings, so the context-row refusal, the workflow selection
and the `tabindex="-1"` all arrive with `renderStateChip` rather than being restated here.
A context row is never a shelf card in the first place — `deriveBars` routes one to
`RoadmapModel.context` before any placement is computed — so this surface cannot reach one.

**The row's anatomy is FIXED, and the state cell is last whatever the Bases order says.**
Every other cell keeps the configured order — `renderCardBody` walks `ctx.columns` — but a
state column is lifted out of that walk and drawn after the notes lane, so a Base ordered
`status, points` draws `points … status` here while the tree draws `status, points`. That is
the layout this projection was asked for rather than an oversight: the chip is the row's most
scannable element and a reader scanning a shelf wants it in the same place on every row, which
a position that moved with the property order could not give. It costs the row nothing in
alignment either way — every row shares one anatomy, which is the whole mechanism — and the
tree remains the surface that answers "in what order did I put my columns". (Codex, PR #187,
which read the lift as a defect; recorded here so the next reader finds the decision rather
than the code.)

The picker is `renderLayoutPicker` in `src/view/render/shelfControls.ts`, and its menu is
`addShelfLayoutItems` in `src/view/interactions/shelfMenu.ts`, which
`addShelfSection` (`src/view/interactions/menu.ts`) also builds the card menu's submenu
from. `shelfLayoutIcon` beside it is what lets the button wear the layout in force from the
same table, so the button and its menu cannot illustrate different picks.

Three files were split along the way, each because their subject had grown two.
`src/view/render/contextStrip.ts` is `renderContextStrip` alone — the strip beside the
shelf, which shares a header CLASS with the band and nothing else: it is never sorted,
filtered, searched, folded, resized or dropped on. `styles/shelfControls.css` is the
header's chrome and the resize grip from [[Resizing the shelf]]. `styles/shelfList.css` is
the third, split from `styles/shelf.css` at the 400-line cap by Task 4: every selector in it
is `.pbl-shelf-list ...`, leaving `styles/shelf.css` the band, its groups, the card grid and
the two notes' shared base classes. `styles/index.css` states why each new partial's
position is load-bearing relative to `shelf.css` and to the two files whose band rule all
three are allowed to beat.

**The widths are published on the BAND by `renderShelf`, through `publishColumnWidths`
(`src/view/render/columns.ts`), which `renderTree` now calls too — one statement of the same
loop.** It is not inherited from `.pbl-tree`, and that is a correction rather than a
preference: `renderPass.ts` runs the tree's publisher for the tree and the catalog alone,
while the scroller is built once in the constructor and only emptied per pass, so a compact
row reading those variables got the 132px fallback on a view opened into roadmap mode and a
stale number on one that had visited the tree — geometry decided by projection history.
The badge's own slot is `shelfBadgeWidth()`, from `ALL_TYPES` rather than from
`metaColWidth` (which reserves for the rollup label) or from the band's current cards (which
would resize the slot as work is placed). Found by review, Codex on PR #187.

**The rollup's own reservation is sized from what the type filter LEFT, never from the
searched list.** Two narrowings reach this band and only one of them is `searchShelf`'s:
`organizeShelf` is where `shelfHiddenTypes` is applied, so measuring the widest ratio before
it let a hidden type go on reserving a lane nothing draws into — the search moved the columns
and the type filter did not. A **folded** group still counts, which is the reason the width
is read off the groups rather than off the rendered cards: folding is not a narrowing, and a
width that moved on it would jump every column each time a reader opened a group. Found by
review, Codex on PR #187.

**Subgrid was the obvious spelling for the alignment and could not be used.** `.pbl-card`
carries `content-visibility: auto`, which forces an independent formatting context, and in
one `grid-template-columns: subgrid` computes to `none` — measured, the card reported a
single 1272px track and every row stacked. And **holding every cell open is not enough on
its own**, which was the second rejected shape: `.pbl-card-parent` used to stay on the line,
drawn only for an item with a parent and sized to its own breadcrumb text, so a row with a
long parent name absorbed more of a narrow pane's deficit and left less for the reservations
after it — their resolved widths diverging from a root card's in the same band. Moving it
into the always-drawn `.pbl-shelf-notes` lane, alongside the rollup and the two notes, is
what made every top-level item of the summary the same on every row.

Driven in `test/view/shelfLayout.test.ts`. jsdom lays nothing out, so what a row LOOKS
like is not a question that file can answer — it asserts the class, the state chip, the two
surfaces agreeing, the published custom properties and the pick surviving, and the
measurements above came from `npm run harness` in a headless Chromium against Obsidian's own
app.css. A themed vault's colours and spacing are still the release sweep's (ADR 0020).
