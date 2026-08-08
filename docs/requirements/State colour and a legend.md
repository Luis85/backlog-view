---
type: PBI
parent: "[[The timeline]]"
order: 50
status: Done
priority: P2
created: 2026-08-07
files:
  - src/domain/settings.ts
  - src/view/render/timeline.ts
  - src/view/render/legend.ts
  - src/view/backlogView.ts
  - styles/timeline.css
  - styles/timelineFurniture.css
  - styles/legend.css
---

# State colour and a legend

**As** someone reading the dated axis, **I want** a bar's colour to say which workflow
state its item is in, and a legend that names what every colour on the grid means,
**so that** I can tell states apart at a glance instead of reading every bar's tooltip —
and the Today pill this feature replaces stops being the only thing on the grid that
explains its own colour.

Every state colour is positional, the same convention the type badge already uses
(`pbl-lvl-N` in `styles/badges.css`): TS names a slot by the state's own index in the
menu vocabulary, CSS alone decides what that slot paints. Nothing here writes anything —
the legend is decoration, exactly like the milestone line it now stands beside, and the
colour it draws is read off the same classes the bars themselves carry, so the two
cannot name a state differently.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The dated axis renders with a workflow property configured |
| **Preconditions** | Roadmap mode is on, the dated axis is drawn |
| **Guarantee** | A bar's colour and the legend's swatches are both derived from `stateMenuValues` at render — never stored, never a write target — so they can never disagree with each other or with the board's columns and the Set state menu. |

**Main flow**

1. Each bar's row takes a `pbl-state-N` class, `N` being its state's index in
   `stateMenuValues` wrapped modulo four palette slots. An item with no state, or a
   value the vocabulary does not carry, takes no slot and keeps the bar's plain accent.
2. A done state still gets a slot, but the existing done rule wins: green is a meaning
   the user already relies on everywhere else in the plugin, a slot colour is only
   positional.
3. A legend strip renders under the toolbar, above the timeline scroller — so it is
   always in view, never scrolled away with the grid — with one swatch per vocabulary
   state (the same slot classes the bars carry, in the same order), then the today
   line's colour, then the milestone line's colour.
4. The legend is presentational: `aria-hidden`, no tab stop, no pointer handler. Every
   fact a swatch stands for is already reachable without it — a state, and its
   done-ness, from hidden words in the timeline row itself (NOT from the row's chip:
   this projection renders no state chip, so until those words existed a bar's state
   lived in its colour alone and withholding the legend was a gap rather than a
   restatement), a milestone from its own row's accessible name, and today from being
   today — not from the line's own tooltip, which hangs on an `aria-hidden` div and so
   carries nothing to the audience that clause is about.
5. The Today pill this PBI's own header band existed for ([[Reading the grid]]) is
   gone: the legend now names the today line's colour, so the header carries only the
   line itself and its tooltip, unlabeled.

**Extensions**

- **1a — a vocabulary longer than four states.** Slots repeat rather than run out; two
  states can share a colour once the vocabulary passes the palette's length, the same
  tradeoff a rotating scheme always makes.
- **3a — no workflow property configured.** `stateMenuValues` does NOT reliably return
  no states here — with `settings.stateKey === ''` it still falls back to
  `[settings.doneValues[0]]`, a "Done" entry with nothing behind it — while
  `domain/model.ts` sets every `stateValue` to null in that same configuration, so no bar
  can carry a state colour at all. The legend therefore gates the state swatches on
  `settings.stateKey` directly, the same property that decides whether a bar has one to
  draw, rather than on what `stateMenuValues` happens to return: only today and the
  milestone key, never an empty strip pretending to be full, and never a swatch for a
  colour nothing on the grid draws. This was the third instance of one bug on this
  branch — the general rule it protects is that a swatch exists only where a bar can
  draw the thing it keys, stated in the code where the gate is decided
  (`src/view/render/legend.ts`).

## How this one is checked

Eight defects now, all one rule at a different point in the same two-dimensional space —
vocabulary by configuration. The done swatch keying its slot instead of the green its
bars draw; the milestone swatch keying cyan while the diamond drew a state slot; state
swatches rendered with no workflow configured; a state outside the configured list
drawing an accent nothing keyed; a DONE value outside that list drawing green nothing
keyed; a MARKER outside the capped timeline window drawing the plain accent under
`.pbl-bar-outside` while the legend's own predicate excluded every marker
unconditionally; a done swatch keyed from `model.results`, which counts an item as done
whether or not anything on the grid actually draws it green (shelved with no date,
excluded by a filter, or hidden by "Show completed items"); and, eighth, the milestone
swatch rendered unconditionally, keying cyan for a base with no milestone anywhere in
the window. Every one passed the tests that existed, because those name cases.

The seventh and eighth are the same new dimension: **a colour whose carrier is not on
the grid at all**, which is a different failure from the sixth's "the wrong branch of
`barClasses` for a carrier that IS on the grid". The first six defects varied vocabulary
and configuration over items already drawn; these two varied whether the done or
milestone item was drawn in the first place. `model.results` cannot answer that — it is
the Base's rows, not the render's — so both are decided the same way the seventh's own
predecessor was fixed: reported by the render itself (`DrawnColors`, replacing the
narrower `hasUnkeyedAccent`) and read by the legend rather than reconstructed from data
the render has already filtered, shelved or hidden.

So the suite states the rule both ways round and sweeps the space: for each of a table
of vocabularies and configurations, every colour a rendered mark draws is keyed by a
swatch, and no swatch keys a colour nothing draws. Two swatches may share a colour only
where the vocabulary outruns `STATE_COLOR_SLOTS`, which is that constant's stated limit.
Two more cases sit outside that table, because they vary GRID MEMBERSHIP rather than
vocabulary or configuration: a done item taken off the grid (shelved, or hidden by "Show
completed items") with the vocabulary omitting its value, keyed neither there nor by the
vocabulary loop, and the same item once it actually lands on the grid.

Beside it, a text check on the stylesheets: each swatch names the same palette colour as
the mark it keys, the four slots are distinct, and none of them is the red, cyan, green
or the default accent's purple that already mean today, a milestone, done and `Other` —
a claim `STATE_COLOR_SLOTS` makes in a comment and nothing checked. Its reach is the variable each rule names; what those resolve
to under a theme stays the live-vault question in [[Smoke test the roadmap]].

The fifth defect was found by a reviewer AFTER the sweep existed, because the table had
no row for "the configured vocabulary omits a done value some item carries". A sweep is
only ever as good as the dimensions it spans, and the fix was a row, not a rewrite.

The sixth was the same lesson on a SECOND missing dimension: the table varied vocabulary
and configuration, but no row ever placed a marker outside the capped window, so nothing
exercised `barClasses`'s early return for `geometry.outside` — the branch that drops
`pbl-bar-milestone` before it is ever added. The legend had grown its own copy of the
colour precedence to answer "is anything unkeyed", and the copy excluded every marker
outright rather than asking what `barClasses` actually drew for THIS one. The fix does
not patch the copy: `renderBarRow` now reports whether the bar it just drew took the
plain accent, `renderTimeline` accumulates that across the bars it renders, and the
legend reads the accumulated fact off `RoadmapSnapshot` instead of reconstructing it —
so a future seventh branch in `barClasses` cannot silently create a seventh disagreement
between what the grid draws and what the copy assumed it draws. The sweep's two new rows
— a stateless marker dated outside the window, and the same marker dated inside it —
state the rule in both directions the way the others do.

The seventh and eighth were the sixth's own fix outrunning its own name: `hasUnkeyedAccent`
reported one colour's presence, decided from the geometry and slot `renderBarRow` already
holds, and the done and milestone swatches went on trusting `model.results` and an
unconditional render respectively — the exact mistake the sixth's fix had just retired for
`Other`. `DrawnColors` generalises the shape to the three override colours at once (done,
milestone, accent), still decided in `renderBarRow` from the same `geometry`, `slot` and
`bar.item.done` it already holds — a coincident start and target draws the milestone
diamond whatever the item's TYPE (`timelineFurniture.test.ts`'s "Ship it", an ordinary
PBI), so this is asked of the geometry alone, never narrowed to markers. The done and
milestone swatches now render exactly when their field of the record is true, the same
way `Other` already did; the state-slot swatches are deliberately untouched (see the
acceptance criteria below) because they come from the configured vocabulary, not from
what got drawn.

- **A filter, which redraws content without a full render.** `DrawnColors` is reported
  by the render, so the legend is only as fresh as the pass that produced it — and
  `setFilter` re-renders content ALONE. The legend is therefore rendered by the content
  pass rather than by `render()`, so a filter that hides the last bar drawing a colour
  takes its swatch with it, and clearing the filter brings it back — done and milestone
  included, exactly like `Other` already was.

- **A milestone whose own bar is done.** The full-height milestone LINE is cyan for
  every in-window marker and never asks whether the item is done — only the diamond is
  repainted green by the done override. So a grid whose only marker is done still draws
  cyan, and asking the BARS alone reported no milestone and left that line unkeyed. The
  line is reported from `renderMilestoneLines`, where it is drawn, rather than inferred
  from the marks beside it — the same move that took the accent question out of the
  legend, applied to the one cyan mark the bars do not account for.

## Acceptance criteria

- A bar's `pbl-state-N` class agrees with `stateColorSlot`'s answer for that state,
  case-insensitively, for every item the axis draws — no state and an unlisted value
  both carry no slot class.
- A done state's bar renders green regardless of which slot its own state occupies,
  decided by CSS specificity rather than source order.
- The legend renders only where `renderTimelineControls` also renders (roadmap mode,
  dated axis) — never on the horizon axis, the board, or the tree.
- With no workflow property configured (`settings.stateKey === ''`), the legend shows
  Today and no state swatch — never a "Done" swatch keying a colour no bar on that grid
  can draw.
- Every configured state's swatch renders regardless of whether anything currently
  carries it — the vocabulary is assignable, not a report of what is drawn — but the
  done and milestone swatches render only when `DrawnColors` says the grid actually drew
  that colour THIS pass: a done item that is shelved, filtered out, or hidden by "Show
  completed items" must not key green, and a base with no milestone anywhere in the
  window must not key cyan.
- The legend sits outside `.pbl-timeline` (the scroller) and under the toolbar, so
  scrolling the grid never scrolls the legend with it.
- A timeline row states its workflow state in WORDS as well as in colour — a hidden
  span in the row itself, carrying the state's value, and its done-ness with it
  (`<value> — done`, or `Done` where a done item carries no value). This is what the
  legend's `aria-hidden` rests on, since the dated axis renders no state chip. A row
  with no state, and every row where no workflow property is configured, renders no
  such span; a MARKER's explicit `aria-label` replaces its content, so the same words
  are folded into that label rather than lost.
- The legend carries `aria-hidden` and nothing inside it is a `button` or otherwise
  reachable by Tab.
- `.pbl-today-label` and `.pbl-timeline-band` no longer exist anywhere: the today
  line renders unlabeled, keeping only its tooltip.

## Where it lives

`stateColorSlot` and its four-slot constant are `src/domain/settings.ts`, beside
`stateMenuValues` — the vocabulary both index into. `renderBarRow` in
`src/view/render/timeline.ts` adds the slot class to a bar's row; the same file's
`renderCellHeader` lost the empty header band the Today pill used to mount in, now
returning the cell track alone. The legend strip is its own module,
`src/view/render/legend.ts`, mounted between the toolbar and the tree in
`src/view/backlogView.ts` (`legendEl`) and re-rendered every `render()` pass so the
projection and axis-pick gates it shares with `renderTimelineControls` stay in sync.
`renderLegend` gates the state swatches specifically on `host.settings.stateKey`, right
beside where it builds them — never on `stateMenuValues(...)`'s own return, which still
answers `[doneValues[0]]` with no workflow configured (see extension 3a).
The colour rules — the four slots, the accent fallback via `--pbl-state-color`, and
the done rule's specificity over a slot — are `styles/timeline.css`; the legend's own
swatches and layout are `styles/legend.css`; the Today pill's rule is deleted from
`styles/timelineFurniture.css`.

Which of the three override colours (done, milestone, accent) ANY bar draws is decided
once, in `renderBarRow` (`src/view/render/timeline.ts`), from the same `geometry`,
`slot` and `bar.item.done` it already holds — never recomputed from `results` anywhere
downstream. The `DrawnColors` record (declared in `src/view/host.ts`, beside
`RoadmapSnapshot`, so `renderBarRow`'s own module can import it without the reverse
direction cycling through `RowContext`) is what replaced the narrower
`hasUnkeyedAccent`. `renderTimeline` OR's each bar's colours into one `TimelineRender.drawn`;
`renderRoadmap` (`src/view/render/roadmap.ts`) carries it unchanged into
`RoadmapSnapshot.drawn`; `render()` in `src/view/backlogView.ts` reads
`this.roadmap?.drawn` after the tree has rendered (so the roadmap snapshot for THIS pass
already exists) and passes it to `renderLegend`, which keys `Other`, `Done` (the
vocabulary-omits-it fallback only) and `Milestone` on it directly rather than asking
`results` or an unconditional render a question only the render can answer.
