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

Two things re-run the ladder besides a pane resize: a **projection switch**, because the
zone that just changed is part of what is being measured, and any render that changes a
label — the primary New button names the focused type, so a focus change alone can move
the row across a step. The attribute lives on the toolbar element itself, which
`renderToolbar`'s `barEl.empty()` does not destroy, so the step survives a toolbar rebuild
and is re-decided after it rather than flickering through step 0.

**Nothing shed becomes unreachable.** A `⋯` button holds density, jump-to-today, ✨,
expand all and collapse all — *always those five, whatever the step*. The button itself is
rendered from step 2. Fixing the menu's contents rather than deriving them from the step
is the point: a menu whose entries tracked the ladder would be a second opinion about the
verdict, and the two would drift. A duplicated entry for a control still visible is
harmless and already the pattern here — the card menu carries the state chip's values
while the chip is on screen.

This follows the rule the register already states about the column ladder: the responsive
`pbl-hide-*` classes are a space decision, and no command is withheld for them.

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

- Labels shed **visually only**. Every control keeps its `aria-label`, so no control loses
  its accessible name at a narrow step.
- Every new control carries a `data-pbl-key`. `test/view/toolbarFocus.test.ts` already
  asserts that every focusable element the toolbar renders carries one and that no two
  share it, so the new controls are covered by the existing invariant rather than by a new
  assertion.
- The `⋯` opens through `showMenuForClick`, like every other button-anchored menu — the
  lint rule banning `showAtMouseEvent` outside `interactions/menu.ts` still holds.
- The switcher keeps `role="group"` with `aria-pressed` per position, and every position
  stays a real `<button>`: the toolbar is the ordinary tab-stop zone.

## Testing

- `test/view/toolbarFit.test.ts` — the step chosen from stubbed widths, and that a control
  shed at each step still has its command in the `⋯` menu.
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
