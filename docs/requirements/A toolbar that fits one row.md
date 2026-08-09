---
type: PBI
parent: "[[Backlog and board]]"
order: 50
status: Done
priority: P2
created: 2026-08-09
files:
  - src/view/render/toolbar.ts
  - src/view/render/toolbarControls.ts
  - src/view/render/toolbarFit.ts
---

# A toolbar that fits one row

**As** someone with a narrow pane, a split view, or a saved view whose projection adds its
own controls, **I want** the toolbar to stay one row and still put every control somewhere
reachable, **so that** a workflow with a state, a horizon axis and a dated axis all
configured does not grow a toolbar that wraps, crowds the tree, or hides a control from
the keyboard with no way back to it.

The row is not a fixed set of buttons: the mode switcher leads every projection, the
roadmap draws an axis picker and — on the dated axis — a zoom, jump-to-today and a
density toggle that no other projection has, and the controls after the spacer (focus,
collapse, completed, filter, write, undo, the count) are the same everywhere. Four
projections sharing one row is what makes wrapping a real risk rather than a hypothetical
one, and it is also what makes a fixed pixel breakpoint the wrong instrument: the row's
width is not configured anywhere, it is whatever today's labels, in today's language, at
today's icon size, add up to.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening a saved view, resizing the pane, narrowing a split, switching projection, or a batch write starting or finishing |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | The row never wraps to a second line. Below the width that holds everything, controls are shed in a fixed order — always into the `⋯`, never into nothing. Past the last rung the row clips from its right end, so what survives is New, the switcher and the `⋯`: what you are looking at, what you can add, and the way back to everything shed. Extension 4b measures where each of the rest goes, and states the floor. |

**Main flow**

1. `renderToolbar` draws the row in zones: the primary New button, the switcher, then
   `renderProjectionZone` for whatever the current projection owns (nothing, on three of
   the four), a spacer, the `⋯`, the shared controls, and the status readouts last.
   New and the switcher are both `.pbl-btn-group` — one segmented box, a hairline
   between the segments — because in each of them two or more buttons are one control.
2. After the row is in the DOM, `syncToolbarFit` measures it: while `scrollWidth` exceeds
   `clientWidth` it advances a step, up to five, and writes the step as `data-pbl-fit` on
   the toolbar element.
3. `styles/toolbarFit.css` reads that attribute. Each step hides more of the row — the
   switcher's four words first, then the remaining labels together with the filter and
   the dated axis's two singles, then the backfill and bulk-collapse buttons, then the
   two advisory notes with the divider that separated them from the count, then the count
   with the divider that led its zone — and `overflow: clip` on the bar means anything a
   step has not caught simply clips rather than wrapping.

   Each divider sheds with the boundary it draws, which is why the two go at different
   rungs: the one between the advisories and the count dies with the advisories, the one
   introducing the whole status zone dies with the last thing in it. Pair either the other
   way and there is a rung where a line divides nothing from something. The advisories are
   all conditional, so the same question is asked once more at RENDER time — the count's
   divider is drawn only when one of them was actually drawn, decided from the DOM the way
   `renderProjectionZone`'s empty zone is, since on an ordinary view none of them renders
   and an unconditional divider would sit straight against the one above it.

   The switcher leads that order because its words are the most expensive and the least
   informative: 205px of the row against every other label put together, naming positions
   its icons draw, its active marker picks out and its tooltips spell, where each of the
   others names a current value — which axis, which zoom, which focus level, which type
   New creates — that no icon can carry.
4. Every control a step removes from the layout is still reachable: from step 2 onward
   the `⋯` is on screen, and its menu carries every entry a rung has shed, reading each
   one's `disabled` and pressed state off the very button it mirrors. It is drawn
   immediately after the spacer, at the head of the row's right-hand block rather than
   among the write controls, because the row clips from the RIGHT and this is the one
   control whose loss takes every shed control with it.
5. The pane widens, or the row's own content changes — a different projection, a new
   count, a narrower label. The measurement re-runs from step 0, never from the step in
   place, so the ladder can relax as freely as it can tighten.

**Extensions**

- **1a — the projection owns no toolbar controls of its own.** Three of the four —
  tree, board, Deliverables board — draw nothing in the projection zone, and
  `renderProjectionZone` removes the zone's leading separator along with it, decided
  from what was actually drawn rather than from a second reading of the settings, so
  the two questions can never disagree.
- **2a — a rung would remove the control that currently holds focus.** The row does not
  drop a keyboard user on the floor: `syncToolbarFit` sends focus to the `⋯` whenever
  the newly-written step hides the element that had it, because the `⋯` is where that
  control's command actually went. A filter that has focus is the one control this can
  never fire for — see 4a.
- **2b — the rung changes while the `⋯` menu is open.** A pane widened or a theme
  swapped under an open menu can hide the `⋯` itself, and focus is in the menu rather
  than in the row, so 2a's handoff does not fire. The pick that follows still lands
  somewhere visible: the keyed focus restore asks the same question about its
  destination that 2a does, so a named control the ladder has hidden falls back rather
  than silently focusing nothing.
- **3a — a shed control's command is still needed.** It stays reachable through the
  `⋯`: each menu entry appears only when the button it mirrors was rendered at all, so
  a projection missing the density toggle offers no density entry, and each entry's
  disabled and checked state is read off that button's own attributes rather than
  re-derived — the write gate refuses a stray write on its own, but a mis-checked
  Compact-rows entry would say the opposite of what pressing it does.
- **4a — the filter has focus when a narrower rung would collapse it.** It is never
  collapsed while focused. The flag that keeps it open is set at the one place focus
  *arrives* — not at each of the four places that could otherwise take it away, which
  is how this shipped broken four times before the rule moved there.
- **4b — the pane keeps narrowing past the last rung.** The row clips rather than
  wrapping, so one row still holds, and what it clips is its RIGHT end. Moving the
  primary action to the head of the row is what settled this: New used to be last and
  was therefore the first thing cut, which no arrangement of rungs could fix — a rung
  buys one control's width and the overflow resumes eating from the right. Now the
  order of loss runs the other way, from the least to the most consequential.

  Measured in the harness, one row (47px) at every width down to 320px, on both
  projections: at 500px nothing is clipped at all; at 420px nothing; at 380px the clip
  reaches **undo**; at 320px the completed toggle and the filter's button go with it.
  New, the switcher and the `⋯` survive every one of them, which is the property this
  extension exists to state — the two controls that say what you are looking at and
  what you can add, plus the way back to everything shed.

  What is lost is lost honestly rather than silently: undo keeps its Ctrl/Cmd+Z chord,
  so the 380px case costs a button and no capability. The 320px case does cost one —
  the completed toggle has no `⋯` entry, because no rung sheds it and the menu mirrors
  only what a rung took. That is the floor, and it is a floor rather than a defect to
  be rung away: below it the row is narrower than the controls that must always be on
  it. The pixel figures are the harness's own and move with the theme's icon size and
  the projection.

- **5a — the app's theme or font changes, or a pane resizes.** Both re-run the ladder:
  a `css-change` event and the tree's `ResizeObserver` are the only two triggers besides
  the render passes below, because a measured ladder is only as good as its last
  measurement and a theme swap invalidates it exactly as a resize does.
- **5b — a batch write starts or finishes.** The indicator reads `Updating 12 of 340`
  and counts up per file, and its appearance is still the only thing about it that can
  change the row's width, so the ladder re-runs on that visibility transition and
  deliberately not on the per-file ticks between it and the next one. What makes the
  ticks free is a reservation rather than a fixed string: the done number is the only
  part that varies, and it is held to the digit count of the TOTAL — fixed for the whole
  batch — with tabular figures, so every digit is exactly the `ch` the reservation is
  written in and `1 of 340` and `340 of 340` occupy one box. The number is published from
  TS as `--pbl-busy-digits` and the stylesheet decides what it means, the way every other
  computed width in this plugin reaches CSS.

  The counter is `aria-hidden`. `.pbl-busy` is `role="status"`, so a per-file number
  inside it is a 340-note backfill announced 340 times; hiding the counter from the
  accessibility tree leaves the announced content the static `Updating`, said once. The
  count stays reachable without sight through the label's `title`, which names nothing
  above it. **Whether a screen reader is actually silent through a mutation inside an
  `aria-hidden` descendant is a spec claim, not a measured one** — no screen reader runs
  in this repository, and it is on the vault list with the tabular-figure width.

## Acceptance criteria

- The toolbar never occupies more than one row, at any pane width, on any projection,
  with any set of optional properties configured.
- The ladder is measured, never summed: nothing in `toolbarFit.ts` hard-codes a
  control's width, because a control's width is its rendered, translated label and no
  module owns that number.
- Every control a rung removes from the row remains operable through the `⋯`, with the
  same enabled and pressed state as the button it stands in for.
- Nothing costs the primary action its place, and that is now true by ARRANGEMENT rather
  than by rung order: New leads the row, the row clips from the right, so no readout and
  no control can push it off. The readout half is still kept by construction underneath —
  every readout is either shed by the advisory and count rungs or shrinkable at the last,
  and each divider sheds with the boundary it draws — which is what keeps the shedding
  order legible rather than merely harmless.
- The `⋯` is never what the clip takes. It is the only route to every shed control, so it
  is drawn at the head of the row's right-hand block rather than among the controls it
  stands in for.
- A rung never fires while the removed control holds focus without handing focus
  somewhere still usable: the `⋯` when the control was reachable through it, and never
  the filter, which the ladder treats as unshedable while focused.
- The ladder re-measures on exactly the events that can change what the row needs: a
  render, a pane resize, a theme change, and the busy indicator's on/off transitions —
  not on a busy batch's per-file progress ticks.
- `renderProjectionZone` is the one place a projection's own controls are decided; a
  fifth projection is a case added to that switch, not a second reading of
  `host.projection` somewhere else in the row.

## Where it lives

The toolbar's control vocabulary, the projection-zone dispatch and the `⋯` overflow are
`src/view/render/toolbarControls.ts`. `renderProjectionZone` is the one place the
toolbar asks which projection it is drawing, so a new projection contributes a case
rather than a guard of its own; the zone and its leading separator are created and
removed together, from what was drawn rather than from a second reading of the
settings. The shared control primitives live here too — `iconButton` and `menuButton`,
the two shapes every toolbar control is built from — and the keyed focus-restore
mechanism used by any control whose activation rebuilds the row while focus is inside
it (`KEY_ATTR`, `capturedFocusKey`, `refocusByKey`, `pickAndRefocus`): a control created
without a key is simply not restored, which is what keeps a menu pick or a
self-removing control from dropping focus to the document. `renderOverflow` is the `⋯`
itself, always rendered and hidden by CSS below the step that needs it; its entries
(`overflowEntries`) are fixed in row order rather than derived from the current step, so
a duplicated entry for a control still on screen is harmless, and each one appears only
when the button it mirrors was actually rendered and is disabled or checked exactly as
that button is, read off its own attributes rather than a second opinion beside
`syncCollapseCtls` and `syncBusy`, which remain the sole writers of those flags.

The ladder itself is `src/view/render/toolbarFit.ts` — `syncToolbarFit` measures the
rendered row's `scrollWidth` against its `clientWidth` and writes the step as
`data-pbl-fit`, which `styles/toolbarFit.css` reads to decide what each step drops. It
MEASURES rather than summing its terms, unlike the column ladder beside it
(`columnFit`/`syncColumnFit` in `render/columns.ts`), because a column's width is
configured while a toolbar control's is its translated label and nothing owns that
number. `scrollWidth` is floored at `clientWidth` by every browser, which is why the
comparison is `>` rather than a padding-corrected subtraction — the correction was
tried, pinned the ladder at its last rung unconditionally, and was reverted (see the
comment above `syncToolbarFit`). `focusInBar`, in the same file, is where "focus something this row still shows" is
decided — the target when the ladder leaves it focusable, the `⋯` when it does not, the
first visible control when the `⋯` is hidden too — asked once, of each element's own
computed `display` and `disabled`, rather than encoded per control or per rung.
`refocusShedControl` beside it is the rung's caller, and `refocusByKey`
(`toolbarControls.ts`) is the other: a keyed restore can name a control a rung has
hidden just as readily, which is what happens when the row relaxes while the `⋯` menu is
open and the pick then restores focus to the trigger that relaxation just hid.

Nothing in `toolbarFit.ts` calls the ladder. It is driven from six places outside it,
and they divide by whether a render follows the width change. One does: the call at the
end of `renderTreeContent` (`backlogView.ts`), placed after the content because the
count is one of the things being measured, and covering a full render and a content-only
one alike. The other five have no render behind them — `revealFilter` and the filter
input's blur handler (`render/toolbar.ts`), which open and collapse an input worth about
130px; `syncBusy`, on the busy indicator's visibility transition and deliberately not on
the per-file ticks between; `ResizePolicy.shouldRebuildOnResize` (`view/resize.ts`),
which re-measures the row on every resize notification before deciding whether the tree
itself needs rebuilding; and `backlogView.ts`'s `css-change` listener, because a theme or
font swap changes the rendered text this ladder measures without moving any box the
`ResizeObserver` watches.

`src/view/render/toolbar.ts` keeps the render order — the zones in the sequence the
main flow states — the four `sync*` functions that keep the toolbar in step with a
content-only render (`syncFilterUi`, `syncCountLabel`, `syncCollapseCtls`, `syncBusy`),
and the busy indicator's own fixed-label design: the visible text never changes while a
batch runs, and the count lives in the label's `title` rather than in the announced
content, so a `role="status"` region is not re-announced once per file. Two
projection-specific notes own their own slice of this row rather than being restated
here: [[Collapsing a bar's subtree]] for the bulk collapse controls'
`expandAll`/`collapseAll`/`collapseButton`/`collapseCtlsDisabled`, and [[Quick filter]]
for `revealFilter` and why the filter is the one control this ladder cannot simply hide.

Driven in `test/view/toolbar.test.ts` (the render order and the four sync functions),
`test/view/toolbarZone.test.ts` (the projection zone's emptiness and its contents),
`test/view/toolbarOverflow.test.ts` (the `⋯`'s membership and mirrored state) and
`test/view/toolbarFit.test.ts` (the ladder itself: the measurement, the floor, the
refocus rule, the filter exception, and the four re-run triggers).
