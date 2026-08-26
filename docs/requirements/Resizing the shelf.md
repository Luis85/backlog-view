---
type: PBI
parent: "[[A third projection]]"
order: 90
status: Done
priority: P2
created: 2026-08-21
files:
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/viewStateController.ts
  - src/view/viewStateSurface.ts
  - src/view/host.ts
  - src/view/interactions/resizeDrag.ts
  - src/view/interactions/shelfResize.ts
  - src/view/render/shelf.ts
  - styles/shelfControls.css
  - styles/shelf.css
  - styles/roadmap.css
  - styles/board.css
started: "2026-08-21"
finished: "2026-08-21"
horizon: ""
start: 2026-08-21
due: 2026-08-21
risk: ""
assignee: ""
---

# Resizing the shelf

**As** someone whose shelf holds more than the band will show, **I want** to drag the edge
it shares with the axis and say how much of the pane it may take, **so that** I can give
the untriaged work room while I triage it and hand that room back to the axis afterwards.

The band rule holds the shelf to 30% of the pane so a full one cannot squeeze the buckets
or the timeline down to their floor. That is the right default and the wrong fixed answer:
triaging is exactly the task where the shelf should be most of the screen, and reading a
plan is exactly the task where it should be a strip. No single share serves both, which is
the argument [[A resizable lead column]] and [[Resizable property columns]] already made
about a width.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The reader drags the grip along the edge the open shelf shares with the axis, or focuses it and presses an arrow key or Home |
| **Preconditions** | A shelf is drawn, open and holding at least one card — the roadmap's on either axis, or the iteration board's |
| **Guarantee** | The height is UI state — per saved view, per device, beside the shelf's other picks — never the `.base` and never a frontmatter write. A picked band is exactly that tall: it scrolls when the cards need more and shows space when they need less. Until one is picked nothing is stored and the stylesheet's own share of the pane is in force. |

**Main flow**

1. The open band carries a resize grip along the edge it shares with the axis:
   `role="separator"`, a real tab stop, `aria-orientation="horizontal"`, and
   `aria-valuenow`/`aria-valuemin`/`aria-valuemax` stating the current height and its
   bounds. Which edge that is, is 1f.
2. Dragging it **away from the axis** makes the band taller and toward it shorter, live —
   one custom property, so nothing re-renders mid-gesture — and releasing persists the
   settled height once. Both directions move the edge.
3. Focused, ArrowUp/ArrowDown step the height by a fixed increment and persist each step
   immediately; Home hands the band back to the stylesheet's own share of the pane.
4. The pick comes back across a reopen, per saved view per device, exactly like the sort
   and the layout beside it.

**Extensions**

- **1a — the shelf is collapsed, or holds nothing.** No grip AND no published height. A
  collapsed band has no open height to size, and an empty one is a drop strip the stylesheet
  keeps out of the layout until a drag is live — a control on it could do nothing, and would
  be the first focusable thing on an element `styles/shelf.css` reorders mid-drag, which that
  rule says explicitly must not happen. The height is the same question, and it became one
  the moment the stored number stopped being a maximum: published to a collapsed band it drew
  the header and blank space to the picked height — 400px against the 34px a collapsed band
  is, measured — and it would make the revealed drop strip that tall over a shelf holding
  nothing. So it is set beside the grip, past the same early return, and the two cannot come
  apart. (Codex, PR #183 — a regression from the height model itself.)
- **4c — the picked height meets a flex line that would shrink it.** It does not yield. The
  horizon axis and both boards already draw their shelf `flex: 0 0 auto`; the dated axis
  un-pins these bands and leaves them shrinkable, which cost nothing under a maximum and
  overrules the pick under a height — a stored 400 drew 222px in a 500px window and 102px in
  a 380px one, measured, with the grip still starting its gesture from 400. A band carrying a
  height carries a class saying so, from the one place that sets either. A pane too short for
  both then scrolls, which is 4a's fallback rather than a new one.
- **2a — dragged past either bound.** Clamped to `MIN_SHELF_HEIGHT_PX` /
  `MAX_SHELF_HEIGHT_PX` rather than accepting whatever the pointer names — the same
  bounds the store refuses on the way back in, so no gesture can persist a height the
  next open would silently drop.
- **3a — Home on a band already at the default.** Clears the pick whatever is on screen.
  A reset is an explicit statement, unlike a gesture that changes nothing, which commits
  nothing at all.
- **2b — the platform cancels the gesture.** Palm rejection, an orientation change, or
  another gesture taking over ends the drag with `pointercancel`, and the height it had
  reached is one nobody chose: the band goes back to where the gesture found it and
  nothing is stored.
- **2d — a gesture that commits nothing, on a band nobody has sized.** It leaves the
  declaration OFF, never the height it measured. With a height already picked the origin is
  that height and redrawing it writes the same number back, so this matters for the unpicked
  band alone — where the origin is a measurement, and publishing it would pin a band the
  stylesheet was sizing at whatever height it happened to have. Absence is a value here as
  it is in the store. (Codex, PR #183.)
- **4a — the pane is shorter than the stored pick.** The pick is honoured and NOT
  narrowed to a share of the pane, which is where this differs from [[A resizable lead
  column]] deliberately. The axis or the columns are squeezed to their own floor and the
  frame scrolls, which is the band rule's stated fallback — so the grip that undoes it is
  still on screen and nothing is unrecoverable. What it buys is that a height picked in a
  tall split is never written down to a narrow one, with no measurement, no second
  effective height and no `ResizeObserver` branch. A reader CAN push the axis off screen
  at the ceiling in a short pane, which 30% alone could not do; `MAX_SHELF_HEIGHT_PX` is
  what bounds that.
- **4b — a stored height this plugin never wrote, or one outside the bounds.** Read
  defensively and dropped, like every stored pick: the band opens at the stylesheet's
  share rather than trusting a corrupt-but-plausible number into the layout.
- **2e — an UNPICKED band's content changes without a render.** The gesture reads the edge
  when it starts rather than once when the grip was drawn. It applies only to a band nobody
  has sized, which is the one that is content-shaped: expanding a shelved parent's children
  is `renderCardChildren`'s own `draw`, which replaces that list in place and rebuilds no
  grip, so such a band can be at 400px by the time a reader grabs it. A picked band cannot
  drift — it is its stored height whatever its cards do, and the origin is then a lookup,
  which is what the two column grips have always had. Reading it per GESTURE rather than per
  move is also what keeps it out of `pointermove`, where a layout read is banned outright.
  **What this does not fix**: on an unpicked band `aria-valuenow` is the value as of the
  last render until a gesture takes hold, at which point it is corrected. A reader who only
  listens hears the render's number. Recorded rather than closed — shutting it needs the
  in-place redraw to announce itself, which belongs to `render/cardChildren.ts` and not to
  this grip. (Codex, PR #183.)
- **1e — an unpicked band is being measured when the grip is drawn.** The height is measured
  with the strip already in the band, never before it. The grip is itself a flex item and
  its negative start margin cancels the GAP above it rather than its own height, so it adds
  8px to a content-sized band — measured in the harness at 236px against 228px with the
  strip taken out and put back. Read a moment earlier, `aria-valuenow` announces a height
  the finished band is not drawing and the first upward drag moves the edge further than the
  pointer went. (Codex, PR #183.)
- **1b — nobody has dragged it yet.** Nothing is published, so the stylesheet's `var()`
  falls through to the 30% the band has always taken. A grip that published its measured
  height on every render would pin that share to whatever the pane happened to be on the
  first draw.
- **2c — the band holds less than the height it was given.** It stays at that height and
  shows the space. That is the model rather than an extension of it: what is stored is a
  HEIGHT, not a maximum, so the edge, the stored number and `aria-valuenow` are one value.
  It replaced a `max-height` on 2026-08-21 after five findings in this one module (Codex,
  PR #183), and the replacement is a deletion rather than an addition — under a cap the band
  drew `min(content, cap)`, and every one of those findings was that expression: an origin
  that disagreed with the edge a reader could touch, a downward drag with no visible effect
  at all, an uncommitted gesture publishing a measurement as a cap, and a growth committed
  invisibly over a larger stored number. None can be posed against a height. Measured in the
  harness at a 1200x800 pane with one card on the shelf: a picked 400px draws 400px where a
  cap drew the content's ~64px, a picked 120px draws 120px and scrolls at 234px of content,
  and clearing the pick returns the band to the 30% share (219px). What it costs is the
  space itself — a band dragged to 400px holding two cards is 400px of band — which is what
  the reader asked for by dragging the edge there, and what every resizable panel does.
- **1f — the shelf is drawn BELOW the axis.** The grip goes to its TOP, and a drag upward
  is what makes it taller. The rule is the edge the band and the axis SHARE, not "the foot",
  which is only where that edge happens to be when the shelf LEADS the frame — as it does on
  the horizon axis (since 2026-08-17) and on both boards. The grid axes draw the shelf after
  the timeline, so there the shared edge is the band's top and a grip at its foot sat against
  the context strip below it, moving an edge nothing on screen was on. One flag decides the
  strip's place in the band and the sign a movement carries, so the pointer and the keys
  cannot end up disagreeing about which way is bigger. Moved in the DOM rather than by
  `order`: the tab stop has to be where the strip is drawn, which is what `styles/shelf.css`
  already says outright about this band. Reported from a vault, 2026-08-26.
- **1g — nothing is pinned to the band's foot any more.** It takes a real bottom gutter
  there, matching its inline one, on the axes where 1f moves the grip away — 12px rather
  than the 4px the grip's own negative offsets were measured against. Scoped to that band
  for exactly that reason: everywhere else the strip still sits on that edge and the 4px is
  what its offsets cancel. Reported with 1f.
- **2f — the band is taller than its cards, and the grip is not at its foot.** It is now.
  `position: sticky` holds an element inside its scrollport when scrolling would carry it
  away and does nothing otherwise, so a band with a picked height and less content than that
  left the grip in flow, under the last group: measured with every type group folded and a
  400px pick, its bottom sat 139px above the band's foot. An auto start margin puts it on
  the edge the gesture actually moves — −5px, the same offset it has when the band
  overflows. Scoped to the band that HAS a pick, because an unpicked band is content-sized
  and has no spare room to push into, and because the negative pull it would replace is what
  1e measures. Reported from a vault, 2026-08-21.

## Acceptance criteria

- The grip carries `role="separator"`, `aria-orientation="horizontal"`, a real
  `tabindex="0"`, and `aria-value*` matching the current height and the storable bounds.
- A picked band draws at exactly its stored height — taller than its cards it shows space,
  shorter it scrolls — and `aria-valuenow`, the gesture's origin and the edge are one number.
- An UNPICKED band is measured instead, with the grip's own strip already in it (8px of it),
  per gesture rather than once per render, and the announcement is corrected when a gesture
  takes hold.
- ArrowDown makes the band taller wherever the grip is at the band's FOOT, which a maximum
  could not do on one drawn shorter than its cap; where the shelf sits below the axis the
  grip leads the band and ArrowUp is what makes it taller instead. The pointer and the keys
  read the same sign, from one flag.
- Dragging updates only the custom property until release: `config.setCalls` and the
  vault's write log stay empty through the whole gesture, and exactly one height is
  persisted, at its end.
- The gesture reads the BLOCK axis alone: a drag straight across the band moves it not at
  all, and the grip claims ArrowUp/ArrowDown while leaving ArrowLeft/ArrowRight — and
  every other key — to the pane beneath it.
- ArrowUp/ArrowDown step the height and persist each step; Home clears the pick and
  returns focus to the grip's own replacement, so a keyboard reader is never dropped to
  the document body after the first press.
- A pointer gesture leaves focus where it was: the grip is never handed a focus the
  reader did not give it.
- A gesture that commits nothing leaves the band drawn at its STORED cap, or at no
  declaration at all where there is no pick — never at the height the gesture measured.
- No grip is drawn on a collapsed or an empty shelf, and no height is published to one:
  a band with nothing to show is never as tall as the height the reader picked for it open.
- A picked height survives the flex line it sits on, on every axis.
- The grip is the band's FIRST element where the shelf is drawn below the axis and its LAST
  where the shelf leads, so the tab stop is where the strip is — never reordered into a
  different reading order by the stylesheet.
- The band that sits below the axis keeps its bottom gutter level with its inline one.
- The iteration board's shelf takes the same stored height — one band, one value.
- Never written to the `.base`: UI state per saved view per device.

## Where it lives

The gesture is the column grips', and literally so: `wireResizeGrip`
(`src/view/interactions/resizeDrag.ts`) gained one option, `vertical`, which picks the
client coordinate the delta is measured on and the arrow pair the grip claims — and
nothing else. The sign, the bounds and the meaning of "more" stay the caller's `sizeAt`,
which is what the two width options were renamed to: a height flowing through a parameter
called `widthAt` is the kind of thing that bites at 3am. So the single-contact rule, the
platform cancel, the refusal to commit a size equal to the one the gesture found and the
size drawn at release rather than at the last move are all the same code
`test/view/columnResize.test.ts` already drives, and are deliberately not re-driven for
this grip.

What is this grip's own is `src/view/interactions/shelfResize.ts`: the markup, the bounds,
where the height goes, and one layout read that is now needed in one case only.
`gestureOrigin` answers from the STORE when a height has been picked — the band is that tall,
so the number is exact and nothing is measured — and measures `offsetHeight` when none has,
which is the only state in which the band is content-shaped. An unmeasured pane reports 0
and clamps to the floor. It is one read on one element, at the render and once per gesture;
what `src/view/CLAUDE.md` bans is a read per ROW and a read inside a `pointermove` stream,
and this is neither.

`styles/roadmap.css` and `styles/board.css` read the same custom property TWICE with
different fallbacks — `height: var(--pbl-shelf-h, auto)` beside
`max-height: var(--pbl-shelf-h, 30%)` — which is what makes a picked number a real height
and its absence the share of the pane the band has always taken, in two declarations and no
branch.

`publishShelfHeight` beside it is the ONE way a height reaches an element — set it, or take
the declaration away when there is none — and it is what both the render and the gesture's
own `restore` call, so "a picked height" and "no pick" cannot come to be spelled two ways.
`restore` is the one thing `wireResizeGrip` gained for this grip beyond its axis: a gesture
that commits nothing has to leave the boundary as it FOUND it, which is only the same as
redrawing its origin when that origin came from the store. The column grips pass none and
are unchanged.

`MIN_SHELF_HEIGHT_PX` / `MAX_SHELF_HEIGHT_PX` and the `shelfHeight` field are in
`src/storage/viewStateStore.ts`, read back through the same `inRange` `leadWidth` uses;
`shelfHeightPick()` / `setShelfHeight()` in `src/view/viewState.ts` hold it, and it reaches
the modules through `BacklogViewHost` and `src/view/viewStateSurface.ts` with
`src/view/viewStateController.ts` rendering the content pane on a commit. ONE height for
the one band, not one per projection: the roadmap's shelf and the iteration board's are the
same component drawn by the same call, and only ever one is on screen.

`renderShelf` (`src/view/render/shelf.ts`) mounts the grip last, after the groups and after
the early return a collapsed or empty band takes, and publishes `--pbl-shelf-h` only once a
height has been picked. `styles/roadmap.css` and `styles/board.css` read that property with
30% as the `var()` fallback, so the stylesheet and the store cannot name different
defaults; the grip's own strip is in `styles/shelfControls.css`, sticky to the edge it sits on so a
shelf scrolled halfway still shows the edge that resizes it.

**Which edge that is, is one boolean.** `renderShelf` asks `drawsGrid` of the axis it was
handed — the grid axes are the ones that render the shelf after the timeline — and puts
`pbl-shelf-below` on the band. `renderShelfResize` takes the same answer and reads it twice
and nowhere else: it prepends the strip instead of appending it, and it flips the sign in
`sizeAt`, which is the one place either gesture — pointer or key — decides what a movement
means. `styles/shelfControls.css` mirrors every term of the foot rule against the class
(sticky `top` rather than `bottom`, the negative pull moved to the end so it cancels the
flex gap below it, and the sized band's auto start margin taken back, since a first flex
item is already at the top and has nothing above it to consume); `styles/shelf.css` gives
that band the bottom gutter 1g asks for. Measured in the browser harness at 1200x800 on the
dated axis: the strip sits at the band's own top edge, stays there with the band scrolled to
its end, and the last row of cards clears the foot by 12px.

**Its reveal is not the property grip's rule copied**, and that is the one place the two
differ by design. That grip is revealed by hovering the column NAME, a label a few pixels
away. This one sits at the foot of a band that can be most of the pane, so the BAND is what
reveals it: hovering anywhere on the shelf draws the line faintly, hovering the strip firms
it, and holding or focusing it confirms in the accent. The first screenshot of it in the
browser harness showed nothing at all, which is what that paragraph is written from.

The ARIA cost is the one `src/view/CLAUDE.md` already states and this pays a fourth time: a
focusable non-`option` inside the roadmap's `listbox`. It is accepted for the reason the
other three are — chrome fixed to the frame, never among the cards, and both pane key
handlers return on any event whose target is not the pane itself, so the grip's arrows stay
its own. What a screen reader makes of a horizontal separator there is a live-vault
question (ADR 0020), not one this suite can answer.

Driven in `test/view/shelfResize.test.ts` and `test/storage/viewStateStore.test.ts`.
