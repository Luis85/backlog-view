# A toolbar of zones, and a ladder that keeps it one row

2026-08-08 — design, approved before implementation.

## The problem

The toolbar is one flat strip built in source order by `renderToolbar`
(`src/view/render/toolbar.ts`). On the roadmap's dated axis it renders thirteen icon
buttons, a text button, a chevron, a 130px input and a count, and `flex-wrap: wrap`
takes it to a second row from about 820px — measured in the browser harness, not
estimated.

Three complaints, all confirmed by mocking the current row against the real stylesheet:

1. **Nothing says which controls belong to what.** Global actions (New, undo, the
   filter, the count) and roadmap-only ones (axis, zoom, density, jump-to-today) sit in
   one undifferentiated run, so nothing signals which part of the row changes when the
   projection does.
2. **It will not survive a fifth projection.** Each new projection adds a switcher
   position *and* its own controls into the same flat strip, guarded by its own
   `if (host.projection !== 'x') return` early return in a function of its own.
3. **It looks unpolished, for two specific reasons the mock found and reading the code
   had not.** There is no `.pbl-mode-btn.is-active` rule anywhere in `styles/` — the
   only thing marking the current projection is Obsidian's faint
   `.clickable-icon.is-active` tint. And two controls six positions apart call
   `setIcon` with the same glyph: the axis picker's "Show timeline" and the zoom
   picker's "Zoom to quarters" are both `calendar-range`.

Fitting was the *fourth* complaint and the least pressing, but it follows from the other
three: any structure that gives the projection its own zone has to say what happens when
the zone does not fit.

## Not in scope

No popover, no per-projection saved settings, no new user-facing capability. Every
projection keeps every action it has today. The mode, the axis pick, the zoom, the
density and the focus level stay exactly what they are — UI state in the collapse store,
per saved view, per device, never the `.base`.

## The design

### One row, five zones

```
[ ≡ ▤ ◱ ▣ ] │ ‹projection› ····spacer···· ‹view› │ ‹write› │ ‹status› [+ New Epic ▾]
```

| Zone | Holds | Present when |
| --- | --- | --- |
| switcher | one position per projection, segmented | always |
| projection | only the current projection's own controls | only when this projection owns any — the zone **and** its leading separator are absent otherwise |
| view | focus ▾, expand all, collapse all, the completed-items eye, the filter | always |
| write | ✨ assign missing properties, undo | always |
| status | the grouping note, the ignored note, the config warning, the busy indicator, the item count | as today, each on its own condition |
| New | the primary create button and its type chevron | always |

Position carries the meaning: everything between the switcher and the spacer belongs to
the current projection and swaps with it; everything after the spacer is the same in
every projection. The roadmap's zone is `Timeline ▾`, `Months ▾`, the density toggle and
jump-to-today. The tree, the board and the Deliverables board own nothing today, so their
zone is empty and the row reads as ends that hold still around a middle that changes.

The projection zone speaks in **words**, not icon positions: the axis and the zoom become
labelled menu buttons naming their current value, rather than two and three segmented
positions. Two controls where the current row has five, no icon carrying a meaning on its
own, and the `calendar-range` collision cannot recur because neither value is stated by an
icon alone. What it gives up is seeing all three zoom levels at once and changing zoom in
one click.

`New` is the trailing control and keeps ordinary Obsidian button styling. A filled accent
CTA was mocked and rejected: a theme replaces the accent, and nothing else in a Bases
toolbar is a filled button.

### The seam a fifth projection lands in

One dispatch — `renderProjectionZone(host, barEl)` — switching on `host.projection`, in
place of today's `renderAxisPicker` and `renderTimelineControls` each opening with its own
`if (host.projection !== 'roadmap') return`. Adding a projection is adding a case.

Deliberately **not** a `ToolbarSpec` interface or a registration registry: that is an
abstraction with one implementation, and a case statement is the same edit with less to
read. The thing being bought is that the question "which projection is this?" is asked in
one place instead of once per contributing function, which is what makes the *next*
addition a single edit.

### The fit ladder

A new module, `src/view/render/toolbarFit.ts`, exporting `syncToolbarFit(barEl)`. Shaped
like `columnFit` / `syncColumnFit` in `render/columns.ts` — the verdict and its
application in one file, because a threshold computed in one place and applied in another
is one edit from disagreeing — and driven from `ResizePolicy` (`src/view/resize.ts`),
which already owns the policy of *when* to re-measure.

It **measures** rather than sums, which is where it parts company with `columnFit`.
`columnFit` can sum its terms because a column's width is configured; a toolbar control's
width is its rendered label, which nothing here owns — type names are vault data
(`docs/requirements/Type names are data.md`) and the strings are due to be translated
(`docs/requirements/Layout survives translated text.md`). So the instrument is
`barEl.scrollWidth > barEl.clientWidth`, stepped until it fits or the last step is
reached. jsdom reports 0 for both, so tests stub the widths and call the path, exactly as
the column-fit tests already do.

The verdict is one attribute on the toolbar, `data-pbl-fit="1" | "2" | "3"` (absent at
step 0), and the stylesheet states what each step drops:

| Step | Drops |
| --- | --- |
| 1 | the text labels on New, on Focus and on the projection zone's pickers — icon and chevron remain |
| 2 | the filter input collapses to a search icon; the density toggle and jump-to-today go |
| 3 | ✨, expand all and collapse all go |

The toolbar becomes `flex-wrap: nowrap; overflow: hidden`, so a step that still does not
fit clips rather than wrapping — and step 3 is reached first.

The collapsed filter at step 2 is a button that swaps itself back for the input in place
and focuses it; the input reverts on blur while it is empty, so a filter someone is
actually using is never taken away by a resize. Widening the pane relaxes the step and
restores it anyway.

**Where the revealed state lives is load-bearing.** It goes on the toolbar element, beside
`data-pbl-fit` and for the same reason: `renderToolbar` calls `barEl.empty()`, so a flag on
the `.pbl-filter` box inside it does not survive a full render. An empty filter opened by
`/` would come back from the next data refresh with the rung hiding it again, and
`refocusByKey` would then focus a `display: none` input — which does nothing, reports
nothing, and drops focus to the body. A filter with TEXT in it is safe without this,
because `renderFilterBox` re-derives its class from the input's value on every render;
empty-and-revealed is the one state nothing else recomputes.

**A filter with text in it is never collapsed at all**, whichever direction the pane moved.
Revealing sets `pbl-filter-open`, but that class only describes the case where the *reveal
button* was pressed — someone who typed a filter at step 0 and then narrowed the pane
arrives at step 2 with a non-empty, possibly focused input and no such class, and the rung
would hide it. The row would then be filtering, saying so nowhere, with the text gone from
under a cursor still in it. The rung's exception is therefore `pbl-filter-open` **or**
`pbl-filter-active` — the class the box already carries whenever its value is non-empty —
so what the step collapses is only ever an empty filter.

**Anything that changes a control's own width re-runs the ladder, not only a pane
resize.** Revealing that input adds about 130px to a row already measured as full, and no
resize, render or data update follows a click on the reveal — so it clips trailing
controls under `overflow: hidden` until something unrelated happens to re-render. The
reveal and the empty-blur that collapses it both re-run `syncToolbarFit`.

`.pbl-filter-input:focus`'s width growth — 130px to 170px, "a little room to breathe while
actually typing" — is **deleted** with this change. It is the same hazard in miniature and
it fires on every focus at every step, including step 0: with `nowrap; overflow: hidden`
the row can no longer absorb a control that grows under the user. Two lines of nicety are
not worth a refit on every focus event, and the input's fixed width is the one the ladder
measures.

Two more things re-run it: a **projection switch**, because the zone that just changed is
part of what is being measured, and any render that changes a label — the primary New
button names the focused type, so a focus change alone can move the row across a step. The
attribute lives on the toolbar element itself, which `renderToolbar`'s `barEl.empty()` does
not destroy, so the step survives a toolbar rebuild and is re-decided after it rather than
flickering through step 0.

**The write-in-flight indicator is the third width that moves without a render**, and it is
the one place a refit must NOT be the answer. `syncBusy` runs at the start of a batch, once
per file, and at the end, and `syncBusyUi` deliberately re-renders nothing — re-rendering
per tick is the jank the deferred update exists to remove, and `scrollWidth` is a forced
layout read, so measuring per file would put back a cost of the same shape. So the
indicator **reserves its width instead of changing it**: `.pbl-busy-label` gets a
`min-width` so "Updating…" and "Updating 12 of 340…" occupy the same box and no tick moves
anything. That is the rule the row already keeps for its end-anchored strip —
`renderAddSpacer` withholds the control and reserves its width, because an element skipped
from such a strip does not leave a gap where it was. What is left is the visibility
transition, idle → busy → idle, which happens twice per batch rather than once per file:
the ladder re-runs on those two, and on nothing between them.

**The reservation is computed per batch, not written as a constant.** A fixed figure cannot
be right: `BusyState.total` is `writes.length`, unbounded, so any number chosen in the
stylesheet is one large backlog away from being too small — and the failure mode is
precisely the one the reservation exists to prevent, a label outgrowing its box mid-batch
with nothing re-measuring. What makes an exact answer available is that `total` is FIXED
for the life of a batch while `done` only climbs toward it: the longest label the batch can
ever show is `Updating {total} of {total}…`, known at the first tick. So the reservation is
set from that string when the indicator appears and cleared when it goes — once per batch,
at the transition that already re-runs the ladder, never per file.

**The `/` shortcut has to keep working at a step that hides the input.** `focusFilter()`
is what `/` in the tree and the no-match empty state both call, and it does
`querySelector('.pbl-filter-input')?.focus()` — against a `display: none` input that call
silently does nothing, so the documented keyboard path to the filter would die at exactly
the pane widths where the filter is hardest to reach. Revealing the input is therefore one
function, `revealFilter`, and both inputs go through it: the reveal button's click, and
`focusFilter()` before it focuses. This is the codebase's own "one action, several inputs"
rule — a second input calls the first one's function rather than repeating it — applied to
a control rather than to a move.

**Nothing shed becomes unreachable.** A `⋯` button holds density, jump-to-today, ✨, expand
all and collapse all. The button itself is rendered from step 2.

Its contents never depend on the **step** — a menu whose entries tracked the ladder would
be a second opinion about the verdict, and the two would drift; a duplicated entry for a
control still visible is harmless and already the pattern here, since the card menu
carries the state chip's values while the chip is on screen. They *do* depend on the
**projection**, and by exactly one mechanism: an entry appears when the button it
duplicates was rendered. Density and jump-to-today exist only on the dated roadmap axis,
so those two are absent everywhere else — an entry for them on the tree would offer an
invisible density mutation and a no-op jump, and would have no button to read its disabled
state from either. Asking the DOM for the button is one question answering both.

This follows the rule the register already states about the column ladder: the responsive
`pbl-hide-*` classes are a space decision, and no command is withheld for them.

**A menu entry is disabled exactly when the button it duplicates is** — read off that
button's own `disabled` property when the menu is built, never re-derived from the
conditions behind it. Two of the five are genuinely conditional: expand and collapse pause
while a quick filter overrides collapse state or the projection drew no disclosure
(`syncCollapseCtls`), and ✨ pauses while a batch is in flight (`syncBusy`, via
`.pbl-write-ctl`). Re-deriving either would put a second opinion beside `syncCollapseCtls`,
which the register already names as its sole writer — and a menu that got it wrong would
write collapse state the filter is overriding, from a narrow pane, with the buttons that
refuse it sitting hidden three pixels away. Reading the control cannot disagree with the
control. The menu is built at click time, so what it reads is the live frame.

The `⋯` is UX truth rather than the safety mechanism: `runExclusively` already refuses a
second batch, so a mis-enabled ✨ would be refused rather than obeyed. Expand and collapse
have no such structural backstop, which is why they are the two that matter.

### Styling

- `.pbl-mode-btn.is-active` gets a real rule: the switcher becomes a segmented group with
  a shared border and per-position dividers, and the active position is filled with an
  accent underline rather than relying on Obsidian's faint tint.
- The zoom menu's entries take distinct glyphs, retiring the `calendar-range` collision.
- The partials keep the one-concern rule and the 400-line cap `styles-assemble.mjs`
  enforces: the segmented group belongs in `styles/toolbar.css`, and the ladder's steps go
  to a new `styles/toolbarFit.css` if `toolbar.css` would exceed the cap. `index.css`
  states which import positions are load-bearing; a new partial is appended where its
  rules are meant to lose to nothing later.

### Accessibility

- Labels shed **visually only** — but that guarantee had to be BUILT, not assumed. Two
  controls take their accessible name from the very text the ladder hides: the primary New
  button and the focus picker carry no `aria-label` at all, which
  `test/view/toolbarFocus.test.ts` asserts today ("the two buttons their own text names").
  Hiding their span would leave a screen reader with two unnamed primary controls from
  step 1 on. So both get an explicit `aria-label` first, and the ladder hides the span
  only after every control it can touch has a name independent of it.

  The sentence to hold is the narrow one: *the ladder may hide a `.pbl-btn-label` only on
  a control that is named without it.* That is checked where the toolbar's names are
  already checked, by extending the focus test's whole-toolbar sweep — asked of the
  rendered row rather than of a list, since the next control added is exactly the one a
  list would omit.
- Every new control carries a `data-pbl-key`. `test/view/toolbarFocus.test.ts` already
  asserts that every focusable element the toolbar renders carries one and that no two
  share it, so the new controls are covered by the existing invariant rather than by a new
  assertion.
- The `⋯` opens through `showMenuForClick`, like every other button-anchored menu — the
  lint rule banning `showAtMouseEvent` outside `interactions/menu.ts` still holds.
- The switcher keeps `role="group"` with `aria-pressed` per position, and every position
  stays a real `<button>`: the toolbar is the ordinary tab-stop zone.

## Testing

- `test/view/toolbarFit.test.ts` — the step chosen from stubbed widths; that revealing the
  collapsed filter re-runs the ladder; that `/` still reaches the input at a step that
  hides it; and that a progress tick moves nothing, asserted against the reserved label
  rather than against a refit that must not happen.
- `test/view/toolbarOverflow.test.ts` — that a control shed at a step still has its command
  in the `⋯`; that the roadmap-only entries are absent on the projections whose buttons do
  not exist; and that an entry is disabled whenever the button it duplicates is — driven by
  putting the view into the state that disables the button (a running quick filter, for
  expand and collapse) rather than by asserting the condition a second time.
- `test/view/toolbar.test.ts` — extended: the projection zone renders the roadmap's
  controls and nothing at all on the tree, the board and the Deliverables board; the
  zone's separator is absent with the zone.
- `test/view/toolbarFocus.test.ts` — runs unchanged; it is the check on the new keys.
- The harness mock that produced the panels this design was argued from is uncommitted by
  design (`npm run harness -- test/harness/mock.ts`); nothing imports it and
  `npm run analyze` is right to call it dead.

## What is still owed to a vault

ADR 0020 is unchanged by any of this: the harness draws and does not assert. The mock
answered layout, spacing and hierarchy at four pane widths in both schemes. It cannot
answer colour, the hover and focus rings, or how the accent underline reads under a real
theme — so the segmented switcher's active state and the `⋯` at its narrow steps are a
live-vault check, and belong on the appropriate note under `docs/issues/` alongside the
other smoke tests.

## Register

`src/view/render/toolbarFit.ts` is a new module, and `docs-check.mjs` rule 7 requires
every module in `src/` to be *specified* by a use case's `## Where it lives` or an ADR's
`## Decision`. A mention elsewhere counts for nothing, so this needs a new PBI note rather
than an edit to an existing one's file list. The zone dispatch itself stays inside
`render/toolbar.ts`, which existing notes already name.
