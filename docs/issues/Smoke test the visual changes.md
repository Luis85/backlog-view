---
type: Issue
order: 80
parent: "[[Product Backlog]]"
status: Open
priority: P2
area: verification
created: 2026-07-31
source: PR #14; reopened 2026-08-02 for the roadmap
files:
  - styles.css
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

## What to look at

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

**The three-position toggle** — tree, board, roadmap as one segmented group. Check the
active position reads as active without the group looking like three separate buttons,
and that the axis picker beside it appears only with both a horizon property and a date
property configured.

**Bucket layout in a narrow pane** — buckets are `flex: 0 0 260px` and the frame is
`min-width: max-content`, so a narrow pane should scroll sideways rather than squeeze
them. Check the buckets keep their width and the pane scrolls.

**The shelf pinned to the scrollport** — `position: sticky` with `width: 100cqw` inside a
`max-content` frame. Pan the timeline sideways: the shelf, the context strip and the
advisory must stay put and stay full-width, not slide off or collapse.

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

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| 2026-08-01 | the PR #14 changes | Everything as intended; `styles.css` needed no adjustment. |
| 2026-08-01 | **0.3.0** — extra-type badges, done rows without the strike-through | Confirmed by the maintainer: looks and feels fine. No change needed. |
| — | the roadmap, both axes and the horizon writes | **Not run.** Reopened for it. |
| — | the one-press setup: the options it writes, and the button in both empty frames | **Not run.** |

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
- Anything adjusted is adjusted in `styles.css` only — none of this should require a
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

**Reopened 2026-08-02**, exactly that way: the roadmap section above is new and nothing
in it has been looked at. Two increments of layout — the buckets, the timeline, the
shelf's sticky trick — plus the horizon writes' own affordances shipped on tests that
cannot see a pixel, which is a larger unverified surface than this note has ever carried
at once. It closes again when someone has run it.
