---
type: PBI
parent: "[[View state]]"
order: 30
status: Done
priority: P2
created: 2026-08-14
files:
  - src/view/interactions/columnResize.ts
  - src/view/interactions/resizeDrag.ts
  - src/view/interactions/timelineLeadResize.ts
  - src/view/render/columns.ts
  - src/view/render/rows.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/viewStateController.ts
  - src/view/viewState.ts
  - src/storage/viewStateStore.ts
  - src/domain/viewOptions.ts
  - styles/propertyColumns.css
  - styles/timeline.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Resizable property columns

**As** someone reading a backlog whose columns hold very different things, **I want** to
drag each property column to the width it needs, **so that** a title or an assignee is not
cut off at the same number of pixels a risk chip is padded out to — which is what one
width for every column can only ever do.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The reader drags the grip at a column header's trailing edge, double clicks it, or focuses it and presses an arrow key or Home |
| **Preconditions** | Tree mode, with at least one property column drawn |
| **Guarantee** | Each width is UI state — per column, per saved view, per device, beside the collapse state — never the `.base` and never a frontmatter write. What a column is DRAWN at, what the fit ladder budgets with and what the grip announces are one number, so a resize can never leave the header and the rows disagreeing. |

**Main flow**

1. Every drawn column's header cell carries a resize grip at its trailing edge:
   `role="separator"`, a real tab stop, `aria-orientation="vertical"`, an `aria-label`
   naming that column, and `aria-valuenow`/`aria-valuemin`/`aria-valuemax` stating the
   current width and its bounds.
2. Dragging it resizes that column live — the published custom property alone, so nothing
   re-renders mid-gesture — and releasing persists the settled width once.
3. Focused, ArrowLeft/ArrowRight step the width by a fixed increment and persist each
   step immediately; Home returns that column to the default width, and so does a double
   click on the grip.
4. The width is published once per render as one custom property per column, and every
   cell of that column on every row reads it — which is what makes a drag move the whole
   column rather than only its header.
5. The fit ladder SUMS the drawn widths instead of dividing the room by one of them, so
   widening a column can drop the one after it, and narrowing it brings that one back.
6. The picks come back across a reopen, per saved view per device, exactly like the
   collapse state and the timeline's own lead width.

**Extensions**

- **2a — dragged past either bound.** Clamped to `MIN_PROP_COLUMN_WIDTH` /
  `MAX_PROP_COLUMN_WIDTH`, the same range the separator announces, so no gesture can draw
  or store a number the next read would refuse.
- **3a — a step (or a drag) lands back on the default width.** Stores nothing: the key is
  removed rather than set to the number that means the same thing, so a view where nothing
  has been resized keeps no field at all.
- **2b — the platform cancels the gesture.** Palm rejection, an orientation change or
  another gesture taking over ends the drag with `pointercancel`, and the width it had
  reached is one nobody chose: the column goes back to where the gesture found it and
  nothing is stored. Only a release commits.
- **1a — two contacts on the grip at once.** A boundary is dragged by ONE pointer: a
  second `pointerdown` while a gesture is in flight is refused outright, and every move,
  release and cancel answers only to the contact that started it.
- **2c — a gesture that changes nothing.** A tap, a drag ending where it began, or a drag
  or arrow key pushing further into a bound the column already sits at: all commit
  nothing, so none of them costs a write or a render. They still DRAW: a release carries
  its own position and needs no `pointermove` before it, so a drag that wanders out and
  comes back would otherwise leave the excursion's width on screen — and in the
  separator's `aria-valuenow` — until some later render corrected it. The release applies
  its width live first and commits after.
- **5a — a column widened past what the pane can hold.** It drops, exactly as a column
  has always dropped when the row will not fit, and the stored width is untouched — so
  widening the pane brings it back at the width the reader picked. Recovery is the pane,
  not the grip: with every column dropped there is no header and so nothing left to drag,
  which is the accepted cost of NOT clamping against the pane the way the timeline's lead
  column does. That one had to, because it covers the grid it labels rather than dropping.
- **6a — a stored width this plugin never wrote, or one outside the bounds.** Read
  defensively and dropped — but per column: one unusable number is one column back at the
  default, never every column reset. A `colWidths` that is not an object at all is no
  widths.
- **3b — a pointer with no way back to the default.** `pointerdown` prevents default, so
  a mouse never focuses the strip and Home is a key the reader would first have to Tab
  onto the grip to press. A double click on the boundary resets it — what every column of
  every table has meant by that for thirty years — and the two taps under it commit
  nothing on their own, so it arrives on a boundary still exactly where it was. Shared
  with the timeline's lead grip, which had the same gap.
- **1c — a right-to-left layout.** The grip is pinned with `inset-inline-end`, so it
  moves to the column's LEFT edge while `clientX` stays physical — the mismatch
  [[Nothing pins a physical side]] names as its third group, in miniature. One sign, read
  off the header STRIP's own computed direction once per render and shared by every grip
  in it (`direction` is inherited, and `getComputedStyle` is a forced style flush that has
  no business running per column — let alone inside the gesture), mirrors the pointer delta
  and both arrow keys: dragging the boundary outward widens the
  column whichever way outward is, and Arrow Right always moves the boundary physically
  right, as the separator pattern says it should.
- **1d — a device with no hover.** The grip paints only on hover or focus, which on a
  touch device is never — and a boundary has no menu entry to be found by instead, which
  is what the tree's other hidden controls have. Under `hover: none` it draws the column
  boundary itself and widens to a finger-sized target. The timeline's lead grip takes the
  same widening and needs no line: its own column already draws one.
  **On a PHONE-width pane this is moot, and that is worth saying rather than implying
  otherwise**: the fit ladder drops every property column well before a phone's width, so
  there is no column to resize and no grip to find — measured in the browser harness at
  480px, where the strip draws no cells at all. What this extension buys is a tablet, a
  landscape phone and a wide split, which is where a touch reader has columns in the first
  place.
- **1b — a keyboard reader stepping a column by repeated presses.** Each step re-renders
  the header and destroys the grip pressed, so focus is put back on its replacement —
  asked of the GRIP's own document, since a view in an Obsidian pop-out window draws into
  that window's rather than the global one ([[The view reads the main window's document]],
  which is also where the five places in `view/` that still ask the global are listed). A
  POINTER resize takes no focus at all: `pointerdown` prevents default, so the strip is
  never focused by a mouse, and refocusing regardless would leave the reader's next arrow
  key resizing a column instead of moving the row selection.

## Acceptance criteria

- Each grip carries `role="separator"`, `aria-orientation="vertical"`, a real
  `tabindex="0"`, an `aria-label` naming its own column, and the three `aria-value*`
  matching the width drawn and the storable bounds.
- Dragging updates only the published custom property until release: `config.setCalls` and
  the vault's write log stay empty through the whole gesture, and exactly one width is
  persisted, at its end.
- A drag on one column's grip moves that column and no other.
- A drag released at a width already stored still leaves that width drawn and announced,
  rather than the last width the pointer passed through.
- ArrowLeft/ArrowRight on the focused grip step the width and persist each step
  immediately; Home returns that column to the default and clears its stored pick;
  neither touches a note or the `.base`.
- A double click on either grip clears its stored pick, so a pointer has a reset without
  first having to Tab onto a strip a mouse cannot focus.
- A stored width outside `MIN_PROP_COLUMN_WIDTH..MAX_PROP_COLUMN_WIDTH`, or one that is
  not a finite number, reads back as absent for THAT column while the others survive.
- Widening one column past what the pane can hold drops the column after it, and clearing
  the width brings it back.
- The header strip is not `aria-hidden` any more — it carries the grips — while every
  label inside it still is, so no reader hears a property name twice.
- In a right-to-left layout the pointer drag and both arrow keys mirror, so no gesture
  shrinks the column it is being pulled outward from.
- Both resize grips carry a `hover: none` presentation, written AFTER the rule it
  overrides — `test/view/rendering.test.ts` pins that ordering, which is the hazard
  `styles/touch.css` records.
- Never written to the `.base`: UI state per saved view per device. The
  `propertyColumnWidth` view option is GONE rather than kept as a shared default beside
  it ([ADR 0011](../adrs/0011-keep-collapse-state-out-of-the-base-file.md) — a value is
  configuration or working position, never both).

## Where it lives

The grip's markup, its keyboard wiring and what a commit means are
`src/view/interactions/columnResize.ts`, mounted from `renderColumnHeader` in
`src/view/render/columns.ts`. That module also owns `columnWidth` — one column's stored
pick or `DEFAULT_PROP_COLUMN_WIDTH`, asked by the header, the cells and the fit ladder
alike — and `columnWidthVar`, the per-column custom property the width is published on.
Both live with the gesture rather than with the render for the reason `effectiveLeadWidth`
lives in `src/view/interactions/timelineLeadResize.ts`: the gesture decides a width, and a
render module owning it would have to import the interaction back, which is a cycle
`npm run analyze` fails on.

The GESTURE — pointer and keyboard both — is `src/view/interactions/resizeDrag.ts`: press,
drag, release, cancel, one contact only, riding `setPointerCapture`, with the arrow keys,
Home and a double click over the same `widthAt` and the same reset. Two rules that were a
copy in each grip live there now as well: `aria-valuenow` is written wherever a width is
drawn, so what is announced cannot fall behind what is on screen; and a width equal to the
one the gesture found is never committed at all, measured against the `startWidth` each
grip already passes for the cancel restore. It is shared with the timeline's lead-column grip, which
this one arrived as a copy of. What each grip keeps is only what its boundary MEANS:
`widthAt` clamps against the pane for the lead column, and against the storable bounds —
mirrored by `widenSign`, which `renderColumnHeader` asks ONCE of the header strip rather
than per grip, since `direction` is inherited and `getComputedStyle` is a forced style
flush — here. The keys going through that one
function is what stops the right-to-left sign being applied in two places, one of which is
the one somebody forgets.

`renderTree` in `src/view/render/rows.ts` publishes one width per drawn column onto the
tree element, and `sizeCell` (`render/columns.ts`) points each cell at its own column's
property — which is what lets a drag move every row's cell by rewriting one declaration
rather than walking the rows, the scan `src/view/CLAUDE.md` bans. `columnFit` in the same
file sums those widths instead of dividing the pane by one of them.

The picks are stored as a `colWidths` map in `src/storage/viewStateStore.ts` — a `prefs`
value rather than a fold, because a key is a Bases property id and never a note path, so
neither the prune nor the rename reaches it. Each value is validated against
`MIN_PROP_COLUMN_WIDTH`/`MAX_PROP_COLUMN_WIDTH` and dropped alone if it fails — held in
`src/view/viewState.ts`, exposed through `src/view/viewStateController.ts` and
`BacklogViewHost.colWidths`/`setColWidth` in `src/view/host.ts` and
`src/view/backlogView.ts`. The `propertyColumnWidth` slider is gone from
`src/domain/viewOptions.ts` and its resolver from `src/domain/settingsResolve.ts`. The
grip's styling, beside the columns', is `styles/propertyColumns.css` — including its
hoverless presentation, which `styles/timeline.css` gained beside the lead grip in the same
change for the same reason.

Driven in `test/view/columnResize.test.ts` and `test/storage/viewStateColumns.test.ts`;
`test/view/columns.test.ts` drives the fit ladder against per-column widths, seeded
through `makeView`'s own `widths` option — working position set through the view, never a
view option.

Not answerable here: how the grip reads in a themed vault, and how a screen reader in
Obsidian's own Chromium announces a separator inside a `tree`. Both are live-vault checks,
and they are the same open question the lead column's grip already records.
