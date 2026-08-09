---
type: Issue
order: 80
parent: "[[Product Backlog]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-07-31
source: PR #14; reopened 2026-08-02 for the roadmap
files:
  - styles/toolbar.css
  - styles/tree.css
  - styles/emptyStates.css
  - src/view/render/toolbar.ts
  - src/view/render/rows.ts
  - src/view/render/roadmap.ts
  - src/view/render/timeline.ts
  - src/view/render/emptyStates.ts
---

# Smoke-test the visual changes in a real vault

## Why this exists

The jsdom harness drives real DOM events against the real view, so it covers structure
and behaviour well. It renders nothing. **No test in this repository has ever checked
what the plugin looks like**, and PR #14 changed a good deal of appearance.

## Getting a vault to look in

`npm run test-build` bundles the plugin into `.obsidian/plugins/product-backlog-view/`
in this repository and adds it to the enabled list, so the repository root opens as a
vault with the plugin installed. On a first open, turn off Restricted Mode under
*Settings → Community plugins* — until then no community plugin loads at all.
`docs/issues/` is a ready-made backlog to point a Base at — these very notes — so the
checks below have real data to run against.

## How to check

**Toolbar** — every icon control became a `<button>`. Obsidian's `.clickable-icon`
should strip the default button chrome, but `styles.css` also resets `border`,
`box-shadow`, `background-color` and `cursor` explicitly because that could not be
verified here. Check the toolbar row still reads as one strip of icons, with no boxed
buttons, correct hover, and correct alignment in both light and dark themes.

**Disabled state** — type into the quick filter. Expand all / Collapse all should dim
(`opacity: 0.4`) and stop responding to both mouse and keyboard.

**Focus ring** — `Tab` into the tree with nothing selected. There should be a visible
outline on the tree container; it should disappear as soon as a row is selected, with
the selection taking over as the indicator.

**Busy indicator** — the one most likely to need tuning. Run **Assign missing type and
order properties** over a backlog large enough to take a moment: the toolbar should show
`Updating N of M…` with a spinning icon. Then do a single drag: the indicator should
**not** flash at all, because it sits behind a 250 ms `animation-delay`.

**Row add button** — hover a row; `+` appears. It is now a `<button>` with
`tabindex="-1"`, so it must not appear in the `Tab` order.

**Extra-type badges** (added after this note was first closed) — `Issue` renders a
`circle-alert` icon in pink and `Bug` a `bug` icon in red. Check both read as peers of the
level badges rather than as error states, that pink and red are distinguishable from each
other and from the four level colours in both themes, and that the two icons render at
11px without looking muddy. A type outside the six keeps its own name with no icon and the
neutral `pbl-lvl-unknown` treatment.

**Done rows** — the strike-through is gone; muting is the whole signal now. Check a
finished row still reads as finished at a glance, and that a done *parent* with an open
child is still tellable from an open one.

**Reduced motion** — with the OS setting on, spinners should step rather than spin and
the busy chip should appear without a fade.

## The roadmap (added 2026-08-02, unverified)

Nothing below has ever been looked at. The first roadmap increment shipped its layout on
jsdom structure tests alone, and the horizon writes added a second set of things only a
pointer can exercise. Point a Base at `docs/` and switch to the roadmap.

**The four-position toggle** — tree, board, roadmap, Deliverables board as one segmented
group. Check the active position reads as active without the group looking like four
separate buttons, and that the labelled axis-picker menu button beside it (not a
segmented picker — a single button naming the current axis, opening a menu of the other)
appears only with both a horizon property and a date property configured.

**Bucket layout at different widths** — buckets share the row's width equally down to a
280px floor (`flex: 1 1 280px; min-width: 280px`), reflowing cards into multiple grid
columns as a bucket's own width allows. Check an ordinary 3-4 horizon vault shows no
horizontal scrollbar and a wide bucket's cards form more than one column; check a pane
narrow enough to hit the 280px floor falls back to the pane's existing horizontal
scroll, same as before.

**The shelf pinned to the scrollport, with a real gutter** — `position: sticky` with a
width reduced to leave a visible gutter from the pane's edges (matching the shelf's own
internal padding), inside a `max-content` frame. Pan the timeline sideways: the shelf,
the context strip and the advisory must stay put, stay off the pane's edges, and force
no scrollbar of their own.

**The timeline's sticky lead column and the today scroll** — entering the dated axis
should land centred on today; the row labels should stay put as the grid pans.

**Done bars keep their open-end fade** — a bar with no target date fades out at its open
end, and it must still do so when the item is done (bars paint through
`--pbl-bar-color`).

**The empty shelf appearing mid-drag** — with every card placed, the shelf is
`display: none`. Pick a card up: the strip should appear, dashed, at the scrollport
width, and be a real drop target. This is the one item on this whole list that is a
*behaviour* nobody can see in jsdom, because the class is asserted and the layout is not.

**The drop-over highlight** — one class (`pbl-drop-over`) now serves board columns,
buckets and the shelf. Check all three highlight identically, and that the board's
highlight is unchanged from 0.3.0.

**The shelf, collapsed by default** — a fresh view opens with the shelf's cards hidden
and only its toolbar chrome (collapse button, sort picker, type filter) visible. Check
the collapsed strip reads as compact chrome, not an empty box taking noticeable space,
and that expanding it reveals cards grouped under type sub-headers in a uniform-width
grid.

**The shelf's toolbar controls** — the collapse button, sort picker and type-filter
chips live in the toolbar, not inside the roadmap pane. Check they are legible and
usable at the toolbar's normal size, and that toggling any one of them never visibly
rebuilds the rest of the toolbar.

**The bucket's New button** — a `+` in the bucket header, appearing on hover like the
row's. Check it does not crowd the count badge and does not appear in the `Tab` order.

## The one-press setup (added 2026-08-02, unverified)

This one is not about pixels, and it is the reason it is on this list: **nothing here
can check that a `.base` option actually takes.** `runInit` now writes view options —
`config.set('stateProperty', 'note.status')` and five more — and the harness's config
double records the call and hands the value straight back. Whether Bases stores a
property id set that way, persists it to the `.base`, and shows it selected in its own
picker is an observation only a real vault can make. If it does not, the backfill still
writes nothing wrong: the keys it creates are the ones the settings resolve to, so a
rejected `set` means the properties simply stay unconfigured.

In a scratch vault with a few plain notes and no properties configured:

**The toolbar's ✨** — press it once. The view options should come back with State,
Started date, Finished date, Horizon, Start date and Target date all naming the
suggested property, each **selected in the picker rather than greyed out**, and every
note should have gained `status`, `started`, `finished`, `horizon`, `start` and `due`
as empty properties. Nothing should have moved: no item done, no card placed.

**The empty frames** — before pressing anything, switch to the board and to the
roadmap. Each should offer **Add the default properties** below its guidance, and
pressing it should leave the board drawing its columns and the roadmap drawing Now,
Next, Later with everything on the shelf.

**A second press** — binds nothing and writes nothing ("All items already have the
properties this view writes"). Then clear one property in the view options and press
again: it must stay cleared.

## The horizon chip and the date entry (added 2026-08-02, unverified)

**The horizon chip** — with a horizon property and its values configured, every row
should carry a chip in its own column beside the state chip: the placement, or a dashed
*Unplaced*. Check the two chips read as siblings rather than as two different kinds of
control, that the column lines up down the tree, and that narrowing the pane drops the
horizon column one step BEFORE the state chip goes.

**The schedule entry** — open Schedule on a row. Both fields should be native date
inputs with the platform's picker, formatted in the OS locale, each with an × beside it
that empties it. Check the picker opens, that Enter still saves, and that the fields do
not overflow the modal at Obsidian's default width — a `type="date"` input carries the
picker icon that a text input does not.

## The toolbar overhaul (added 2026-08-09, unverified)

Five zones, a measured fit ladder (`data-pbl-fit`), and a busy indicator that reserves
its own width shipped on the jsdom harness and a static browser stub
(`npm run harness`) alone. Both are faithful about layout, spacing and hierarchy and
say nothing about colour, real fonts, a real scrollbar or Obsidian's own lucide build —
see `test/CLAUDE.md` and ADR 0020. Point a Base at `docs/` and work through this list in
a real vault, in both light and dark:

1. **The menu buttons' default chrome.** Open the axis picker or the `⋯` overflow menu
   and look at the button itself, not the menu it opens. `.pbl-menu-btn` writes no
   `background`, `border` or `padding` reset — unlike the toolbar's icon buttons, which
   do — so it depends entirely on Obsidian's own default `<button>` styling coming out
   looking like the rest of the row. This is the exact shape of the 2026-08-08 episode
   already recorded above (a card-children disclosure that looked right in the harness
   and wrong in a vault because `test/harness/theme.css` has no baseline for a bare
   `<button>`): compare it against the other toolbar buttons and flag anything boxed,
   bordered, or oddly padded. **Look hardest at this one.**
2. **The `gantt-chart` glyph.** Switch the roadmap to the dated axis and look at the
   zoom control. `gantt-chart` resolves in the test harness only through a new alias to
   `chart-no-axes-gantt` in `lucide-static` — that proves nothing about the older,
   bundled lucide inside Obsidian's own Electron. Confirm a glyph actually draws; a name
   that release doesn't carry draws nothing at all, silently.
3. **`overflow: clip` on the toolbar row.** `styles/toolbarFit.css` asserts in a comment
   that this is safe on "Chrome 90+, far below the Electron behind `manifest.json`'s
   1.10.2 floor" — nobody has checked that claim against Obsidian's actual bundled
   Electron. Narrow the pane until the row would overflow. If `clip` isn't supported, the
   row silently falls back to visible overflow and becomes horizontally scrollable again
   (the toolbar should never scroll — see the comment beside the rule).
4. **The segmented switcher's active position, under a non-default theme.** Switch to a
   theme that redefines `--interactive-accent` and `--background-modifier-active-hover`,
   then check the active tree/board/roadmap/Deliverables position still reads as active
   (filled background plus an accent underline) rather than blending into the row.
5. **The fit ladder at real pane widths, in a real split.** Drag a pane from wide to
   genuinely narrow and watch the toolbar shed controls. A browser measurement against
   the harness stylesheet (one row, 47px, from 1400px down to 420px) found the ladder
   stepping 0, 0, 1, 1, 2, 3, 4, 5, 5 — a real vault has a different font and a real
   scrollbar, either of which can shift where a step trips. Confirm the row never grows a
   second line and never clips a control the ladder hasn't dropped yet.
6. **Below ~420px.** The row should keep the projection switcher, the `⋯` overflow
   button and New, and clip whatever else remains. Confirm that's what actually happens
   rather than something worse (a button cut in half, the switcher itself clipped, New
   disappearing).
7. **Focus across a rung transition, both directions.** Focus a toolbar control, then
   narrow the pane until the ladder sheds that control — confirm focus lands somewhere
   still visible rather than vanishing. Then widen the pane back past the rung where the
   `⋯` overflow button itself disappears, with focus on something inside its menu, and
   confirm the same.
8. **`/` opens the collapsed filter at a narrow width.** Narrow the pane enough that the
   filter collapses, then press `/`. jsdom asserts the class change and the active
   element; only a real browser proves the input CSS just revealed is actually
   focusable and receives the keystroke.
9. **A filter typed at a wide width, surviving a narrowing rung.** Type into the filter
   while the pane is wide, then narrow it into the rung that would otherwise collapse an
   empty filter. Confirm the input stays open with its text and cursor position intact.
10. **The busy indicator across a real backfill.** Run **Assign missing type and order
    properties** (✨) over a few hundred notes. Confirm the visible label stays
    `Updating…` and does not move or resize the row as the count climbs from one digit to
    several; confirm the count itself only appears in the tooltip on hover; and — with a
    screen reader running — confirm the busy status is announced once, not once per file
    written.

## Structural debt this branch is leaving behind

`src/view/backlogView.ts` is at 396 of its 400 counted-line `max-lines` cap (`eslint.config.mjs`),
with its import slack already spent — this branch added nothing to it for exactly that
reason. `docs/tasks/Split the view dispatch hub.md` already exists and describes the
extraction. The next change that needs to add to `backlogView.ts` cannot: that extraction
has to land first, or lint fails outright rather than warning.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| 2026-08-01 | the PR #14 changes | Everything as intended; `styles.css` needed no adjustment. |
| 2026-08-01 | **0.3.0** — extra-type badges, done rows without the strike-through | Confirmed by the maintainer: looks and feels fine. No change needed. |
| 2026-08-05 | **0.5.0** — the shelf's collapse, grouping, sort and filter in its own header, and the full-width bucket grid | Confirmed by the maintainer against a live vault. The layout half was measured first through `npm run harness` (bucket widths and gutters, the dated-axis shelf at 1376px of 1400px, the collapsed footprint); this run is what the harness does not replace. |
| — | the roadmap, both axes and the horizon writes | **Not run.** Reopened for it. |
| — | the one-press setup: the options it writes, and the button in both empty frames | **Not run.** |
| — | the horizon chip's column, and the native date fields in the schedule entry | **Not run.** |
| — | the toolbar overhaul (five zones, the fit ladder, the busy indicator's reservation, `gantt-chart`) | **Not run.** Reopened for it. |

That second run is the one that mattered most, because the badge colours and the removed
strike-through shipped in 0.3.0 on the strength of jsdom structure tests, which cannot see
a pixel. **This note is a checklist to re-run, not a record**: it closes when it has
been run and reopens with the next change to `styles.css` or to the view's markup, and
`npm run test-build` against the `docs/` backlog makes it a ten-minute pass. Add a row
above when you run it.

## If the busy indicator flickers

The dial is the `250ms` delay on `.pbl-busy.pbl-busy-on` in `styles.css`. Raising it
trades "quick writes never flash" against "slow writes take longer to announce
themselves". Nothing else depends on the value.

## Acceptance criteria

- Checked in both light and dark themes, and on one non-default theme if convenient.
- Anything adjusted is adjusted in a `styles/` partial only — none of this should require a
  behaviour change.

---

## Outcome

**Checked by the maintainer on 2026-08-01 in a `npm run test-build` vault, and everything
on the list renders as intended.** Nothing needed adjusting — `styles.css` is unchanged,
which is the result this note was hoping for and could not assume.

Two of these were live guesses rather than checks, and both came out right: the explicit
`border` / `box-shadow` / `background-color` / `cursor` resets on the toolbar buttons do
sit correctly under Obsidian's `.clickable-icon` (the reason they were written was that
this could not be verified here), and the 250 ms `animation-delay` on the busy chip is
tuned right — it announces a real batch without flashing on a single drag.

This closes the appearance gap for everything through the undo work. It does not close it
for good: no test in this repository will ever check what the plugin looks like, so a
change to `styles.css` or to the toolbar's markup still needs eyes. `npm run test-build`
is now the one-command path to those eyes, and this note stands as the checklist to
re-run — reopen it, don't rewrite it.

**Reopened again 2026-08-08 (the `Idea` badge).** One line to check, and it is the one
kind this repository can never see: the new extra type's badge — a `lightbulb` icon and
`--color-green-rgb` — reading as distinct from `Issue` (pink) and `Bug` (red) in both
schemes, and its icon resolving at 11px rather than drawing a blank. The browser harness
shows the shape and the layout; the colour is the stub's, not a vault's.

**Reopened 2026-08-02**, exactly that way: the roadmap section above is new and nothing
in it has been looked at. Two increments of layout — the buckets, the timeline, the
shelf's sticky trick — plus the horizon writes' own affordances shipped on tests that
cannot see a pixel, which is a larger unverified surface than this note has ever carried
at once. It closes again when someone has run it.

**Reopened 2026-08-09 (the toolbar overhaul).** `npm run check` passes clean on this
branch and `test/harness/harness.test.ts` confirms every icon name the view asks for
resolves in `lucide-static`, including the new `gantt-chart` → `chart-no-axes-gantt`
alias — neither of those is the live-vault check. "The toolbar overhaul" section above
is the list, ten items, and it also fixed two claims in this note that had gone stale
before this branch touched anything: "the three-position toggle" is now four positions
(the Deliverables board), and "the axis picker beside it" is a labelled menu button, not
a segmented control. Closes again when someone has run it against a real vault.
