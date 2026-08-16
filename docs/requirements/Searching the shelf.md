---
type: PBI
parent: "[[A third projection]]"
order: 70
status: Done
priority: P2
created: 2026-08-16
files:
  - src/domain/shelf.ts
  - src/view/host.ts
  - src/view/viewStateController.ts
  - src/view/viewStateSurface.ts
  - src/view/render/shelf.ts
  - src/view/render/shelfControls.ts
  - src/view/interactions/shelfMenu.ts
  - src/view/interactions/menu.ts
  - styles/shelf.css
started: "2026-08-16"
finished: "2026-08-16"
horizon: ""
start: 2026-08-16
due: 2026-08-16
risk: ""
assignee: ""
---

# Searching the shelf

**As** someone whose shelf holds dozens of untriaged items, **I want** to search it by
title and to narrow its types without the picker shutting after every pick, **so that**
finding the two notes I came for is one gesture rather than a scroll, and choosing the
types I want is one menu rather than five.

[[The shelf, organized]] gave the shelf a sort and a type filter; [[Folding a shelf type
group]] gave each group a fold. What neither gave is a way to find one card by NAME. The
view's own quick filter does that — for the whole view: it narrows the plan beside the
shelf, which is the wrong trade for someone digging through untriaged work and wanting
the placed half left alone. That is what makes this a second, shelf-scoped narrowing
rather than a duplicate of the toolbar's.

The type picker's other half is a shape complaint the register can state plainly: an
Obsidian `Menu` closes on a pick, so hiding three of four types was open-pick-open-pick-
open-pick, and "show me only Epics" had no entry at all.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user types in the shelf's search box, or picks in its type filter |
| **Preconditions** | Roadmap mode is on, the shelf is expanded and holds at least one item |
| **Guarantee** | The search and the type filter are display-only — nothing is written to a note because of either, and the shelf's own count keeps reporting the true total whatever they leave showing. A card the search hides is drawn nowhere and is in no keyboard walk, so nothing selectable is off screen. |

**Main flow**

1. The expanded shelf's header carries a search box beside its two pickers.
2. Typing narrows the shelf to the cards whose title holds what was typed, case
   insensitively; a group with nothing left goes with its cards.
3. The count on the disclosure does not move: it is the shelf's statement about the
   results, not about what is currently on screen.
4. Escape in the box clears it and every card comes back.
5. The type filter offers **Show all types** and **Hide all types** above its per-type
   entries, and stays open across a pick — so "only the type I want" is hide-all then
   one, in one open menu.

**Extensions**

- **2a — the search matches nothing.** The shelf renders its header alone. The pane draws
  no card, so it drops to a labelled `region` and every header control returns to the tab
  order — the state hiding the last visible type already produces
  ([[The shelf, organized]]), reached by a second control and answered by the same rule.
- **2b — the search runs while a type is hidden, or a group is folded.** They compose in
  one direction each and never disagree: the search decides which cards exist, the type
  filter which groups are drawn at all, the fold whether a drawn group shows its cards.
- **2c — the title is being composed through an IME.** Every keystroke of a live
  composition belongs to the IME rather than to this box: the narrowing waits for the
  composition to end, since a rebuild mid-composition destroys the field being typed into
  and commits a CJK word half-finished, and an Escape dismissing the IME's candidates
  neither clears the search nor is prevented from reaching the IME. (Found by review,
  Codex on PR #161.)
- **4a — a keyboard user has no pointer to click the box with.** The card menu carries
  **Search unplaced...**, which opens a prompt, and **Clear unplaced search** while one
  runs — the same obligation every `tabindex="-1"` control here carries, and the same
  builder behind both surfaces.
- **5a — a bulk entry would change nothing.** It is disabled rather than offered, and each
  asks what its OWN handler would change: Show all with the stored set empty, Hide all with
  every group on screen already hidden.
- **5b — a type is hidden while nothing of it is shelved.** Hide all ADDS to the stored
  set rather than replacing it, so that remembered hiding survives — 4a in
  [[The shelf, organized]]. Show all is the deliberate opposite: it clears the set whole,
  because that is what the entry says — and it stays LIVE for a hidden type this shelf has
  no card of, since clearing is the only way to take that remembered hiding back. (All
  found by review, Codex on PR #161.)

## Acceptance criteria

- Typing in the box narrows the shelf's cards by title, case-insensitively; a blank or
  whitespace-only box narrows nothing, and an IME's intermediate keystrokes narrow
  nothing until the composition ends.
- The shelf's count is unchanged by the search, by the type filter and by both together.
- The box keeps focus AND the caret across the rebuild each keystroke causes — every
  other shelf control hands focus to the pane, and doing that here would end the search
  at its first keystroke.
- Escape clears the search — except while an IME composition is live, where it is the
  IME's own cancel and passes through untouched. The card menu offers the same clear while
  a search runs.
- The search box is `tabindex="-1"` wherever the pane is a composite and returns to the
  tab order wherever the pane draws no card, exactly as the two pickers do.
- The type picker reopens after each pick, carrying the checkmarks that pick produced,
  and offers Show all / Hide all — on the header's surface and in the card menu alike.
  Hide all leaves a type hidden that has no cards to hide; Show all clears it, and is
  offered whenever the stored set holds anything at all.
- Nothing is written to a note by any of it, and nothing reaches the `.base`.

## Where it lives

The search itself is `searchShelf` in `src/domain/shelf.ts` — pure, over titles, and
applied BEFORE `organizeShelf` rather than inside it. That order is the rule and not an
implementation detail: the type picker is built from the unsearched grouping, so a search
can never take a type's own way back off the list that restores it, which is the same
guarantee hiding already keeps.

Its state is the one shelf pick the view-state store does not hold. `shelfSearch` /
`setShelfSearch` are on `BacklogViewHost` (`src/view/host.ts`) and forwarded through
`src/view/viewStateSurface.ts` like every other view-state member, but
`src/view/viewStateController.ts` keeps it as a plain field: a search is something someone
is doing right now, which is `FilterState`'s own reasoning for the toolbar's quick filter,
and persisting it would open a saved view onto a shelf narrowed by a search nobody
remembers typing.

The box renders in `src/view/render/shelfControls.ts`, beside the two pickers, and is the
one FORM control the shelf's header may hold — a menu cannot be typed into. It therefore
keeps the half of that header's rule that is about Tab (`tabindex="-1"`, lifted with the
pickers by `syncShelfTabStops` wherever the pane draws no card) and pays the ARIA cost the
disclosure and the two resize grips already pay: a focusable non-`option` inside a
`listbox`. What a screen reader makes of a text field there is a live-vault question, not
one this suite can answer (ADR 0020). `runSearch` beside it is the third answer to the
focus question `refocus` asks: the replacement box takes focus even where cards remain,
and the caret travels with it. It is also why both listeners on the box ask
whether a composition is live first: rebuilding the pane replaces the field, which is
harmless between keystrokes and destructive in the middle of a composed word, so the
narrowing waits for `compositionend` (wired beside `input` because Chromium and WebKit
order the two oppositely, the second arrival finding the value unchanged) and Escape stays
the IME's while it is cancelling a candidate.

`src/view/render/shelf.ts` reads the two in order (`searchShelf`, then `organizeShelf`),
so a searched-away card is simply not drawn — and therefore not in `RoadmapSnapshot.cards`,
not in `RowContext.placed`, and named by `nameMatches` exactly the way a hidden type's card
already is.

The MENU items moved to their own module, `src/view/interactions/shelfMenu.ts`: the sort,
the type filter and the search's two entries, each one builder feeding both the header's
controls and the card menu's shelf section (`addShelfSection` stays in
`src/view/interactions/menu.ts`, which is what needs the submenus). The extraction is what
kept that file inside its line budget, and the split is by subject rather than by size —
these three build the shelf's own picks and nothing else does.

Staying open is a fresh menu at the same button (`showTypeMenu` in `shelfControls.ts`):
Obsidian's `Menu` closes itself on a pick and offers no way not to, and the pick has
rebuilt the pane anyway, which is what puts the new checkmarks and counts in it. The card
menu's submenu passes no `after` and so keeps a menu's ordinary behaviour — the one line
the two surfaces are allowed to differ on.

"At the same button" is why the FIRST open goes through that one function too, rather than
through `showMenuForClick` like the sort picker beside it. That helper anchors a real
pointer click at the CURSOR, which is right for a menu opened once and wrong for one that
comes back: the menu appeared under the mouse and then jumped to the button's own edge on
every pick after it (2026-08-16). A picker that reopens has to reopen in one place, so the
button is the anchor in both — asserted on the POSITION rather than on which call was made,
in `test/view/shelfSearch.test.ts`.

Driven in `test/view/shelfSearch.test.ts` (the box, the caret, the tab-order lift, the
keyboard path, the reopen and the two bulk entries) and `test/domain/shelf.test.ts`
(`searchShelf` itself). `styles/shelf.css` sizes the field and draws nothing around it: the
input IS the box, and it yields its width rather than claiming one — the header is one row
that also holds the disclosure, both pickers and the dated axis's outcome line. It sat in a
wrapper div with a border and a background of its own until 2026-08-16, which put a
bordered field inside a bordered field in a real vault. What the wrapper undid to hide
that could not work: Obsidian styles `input[type='search']` itself, and an attribute
selector outranks the single class that was blanking it. Nothing here can see that — the
harness's stub theme gives a bare input no chrome at all — so the two boxes were a vault
report and the fix is a vault check. The magnifier the wrapper drew goes with it; the
platform draws one, along with the clear button, and only while there is something to
clear.
