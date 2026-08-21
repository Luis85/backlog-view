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
started: "2026-08-21"
finished: "2026-08-21"
horizon: ""
start: 2026-08-21
due: 2026-08-21
risk: ""
assignee: ""
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
| **Preconditions** | To MAKE the pick: the roadmap's shelf, on either axis, drawn and open — that band is the one carrying the picks. The pick itself applies wherever a shelf draws, the iteration board's included (extension 1b). |
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
- **1b — the shelf is the iteration board's.** No picker — the keyboard path for these
  controls is the card menu's shelf section, which is the roadmap's alone — but the pick
  IS applied there. That is the SORT's half of `renderShelf`'s narrowing rule rather than
  the search's: a shelf drawn without the controls applies neither the search nor the
  hidden types, because either could take work off the band with nothing on screen to say
  why and nothing to clear it with, while a layout draws every card either way. A reader
  who has never seen the picker has lost nothing and needs no way back to it. The band's
  HEIGHT in [[Resizing the shelf]] is one value for both shelves on that same argument, so
  gating this one would be two answers to one question. This extension claimed the
  opposite when it was written, and the code was right (Codex, PR #183) — what let the two
  disagree at all is that neither direction had a test, which they now do.
- **2a — the reader has no pointer.** `Shelf layout` is a submenu of any shelf card's
  context menu, built from the same list, so the two surfaces cannot offer different
  layouts or disagree about which is checked.
- **4a — the Base draws no state column, or draws one this item's workflow does not
  write.** No chip, and no gap where one would have been: the chip IS that property's
  cell, which is the tree's own rule, and the wrapper goes with the cell when the cell is
  dropped.
- **3a — a title too long for one line.** It truncates with an ellipsis rather than
  wrapping: a row that grew a second line would not be a row. The title yields and the
  property cells keep their content width, which is the TREE's own order — its columns are
  fixed width and the row's name is the flexible part — but it yields only down to a floor.
  Without one, a Base exposing several properties squeezed a 768px title to 103px, measured
  in the harness at a 1200px pane with seven cells on the row. The cells shrink first below
  that floor: at a 760px pane the same row held its title while the cells went from 700px to
  348px. Nothing spills either way — every cell ellipsises inside itself — and the row stays
  one line, which needs the wrapper's `flex-wrap` turned off beside the shrink, since a
  wrapper that can finally be squeezed is one whose cells wrap to a second line. (Codex,
  PR #183, which read the squeeze as a horizontal spill; the measurement says which half is
  real.)

## Acceptance criteria

- The picker draws in the roadmap's shelf header while the band is open and non-empty,
  and on no other screen; it is `tabindex="-1"` like the two pickers beside it.
- The iteration board's shelf draws no picker and still honours the pick — the sort's rule,
  not the search's.
- Picking a layout flips what the band draws and what the picker's own icon shows, under
  one fixed name.
- The same cards are drawn in both layouts, and the shelf's count is unchanged by the
  pick.
- A compact row is ONE line whatever it carries, and its title keeps a stated floor rather
  than being squeezed away by property cells.
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

**The layout costs no render branch, and that is the whole design.** `renderShelf`
(`src/view/render/shelf.ts`) puts `pbl-shelf-list` on the band and nothing else changes:
the same `renderCardBody` builds the same children either way, and `styles/shelf.css`
turns the card's own flex COLUMN into a row. So an item cannot look different per layout
in any way but the one that is drawn deliberately, and the pick cannot come to hide work
the count still claims.

That one deliberate difference is `renderShelfState`, also in `render/shelf.ts`. A card
draws no state chip because its own POSITION says the state — a board column IS a state, a
bucket IS a horizon — and the shelf is exactly where that argument stops: a shelved card is
in no column and no bucket, so a row is the only place its state appears at all. It is
drawn through the RESOLVED columns and `renderPropCells` (`src/view/render/columns.ts`),
never a second reading of the settings, so the context-row refusal, the workflow selection
and the `tabindex="-1"` all arrive with `renderStateChip` rather than being restated here.
A context row is never a shelf card in the first place — `deriveBars` routes one to
`RoadmapModel.context` before any placement is computed — so this surface cannot reach one.

The picker is `renderLayoutPicker` in `src/view/render/shelfControls.ts`, and its menu is
`addShelfLayoutItems` in `src/view/interactions/shelfMenu.ts`, which
`addShelfSection` (`src/view/interactions/menu.ts`) also builds the card menu's submenu
from. `shelfLayoutIcon` beside it is what lets the button wear the layout in force from the
same table, so the button and its menu cannot illustrate different picks.

Two files were split along the way, both because their subject had grown two.
`src/view/render/contextStrip.ts` is `renderContextStrip` alone — the strip beside the
shelf, which shares a header CLASS with the band and nothing else: it is never sorted,
filtered, searched, folded, resized or dropped on. `styles/shelfControls.css` is the
header's chrome and the resize grip from [[Resizing the shelf]], leaving `styles/shelf.css`
the band, its groups and its two layouts. `styles/index.css` states why the new partial's
position is load-bearing relative to `shelf.css` and to the two files whose band rule both
are allowed to beat.

Driven in `test/view/shelfLayout.test.ts`. jsdom lays nothing out, so what a row LOOKS
like is not a question that file can answer — it asserts the class, the state chip, the two
surfaces agreeing and the pick surviving, and the measurements above came from
`npm run harness` in a headless Chromium against Obsidian's own app.css. A themed vault's
colours and spacing are still the release sweep's (ADR 0020).
