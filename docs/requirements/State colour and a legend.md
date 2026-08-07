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
   `stateMenuValues` wrapped modulo five palette slots. An item with no state, or a
   value the vocabulary does not carry, takes no slot and keeps the bar's plain accent.
2. A done state still gets a slot, but the existing done rule wins: green is a meaning
   the user already relies on everywhere else in the plugin, a slot colour is only
   positional.
3. A legend strip renders under the toolbar, above the timeline scroller — so it is
   always in view, never scrolled away with the grid — with one swatch per vocabulary
   state (the same slot classes the bars carry, in the same order), then the today
   line's colour, then the milestone line's colour.
4. The legend is presentational: `aria-hidden`, no tab stop, no pointer handler. Every
   fact a swatch stands for is already reachable without it — a state from the row's
   chip or the Set state menu, today and a milestone from the line's own tooltip.
5. The Today pill this PBI's own header band existed for ([[Reading the grid]]) is
   gone: the legend now names the today line's colour, so the header carries only the
   line itself and its tooltip, unlabeled.

**Extensions**

- **1a — a vocabulary longer than five states.** Slots repeat rather than run out; two
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

## Acceptance criteria

- A bar's `pbl-state-N` class agrees with `stateColorSlot`'s answer for that state,
  case-insensitively, for every item the axis draws — no state and an unlisted value
  both carry no slot class.
- A done state's bar renders green regardless of which slot its own state occupies,
  decided by CSS specificity rather than source order.
- The legend renders only where `renderTimelineControls` also renders (roadmap mode,
  dated axis) — never on the horizon axis, the board, or the tree.
- With no workflow property configured (`settings.stateKey === ''`), the legend shows
  exactly Today and Milestone and no state swatch — never a "Done" swatch keying a
  colour no bar on that grid can draw.
- The legend sits outside `.pbl-timeline` (the scroller) and under the toolbar, so
  scrolling the grid never scrolls the legend with it.
- The legend carries `aria-hidden` and nothing inside it is a `button` or otherwise
  reachable by Tab.
- `.pbl-today-label` and `.pbl-timeline-band` no longer exist anywhere: the today
  line renders unlabeled, keeping only its tooltip.

## Where it lives

`stateColorSlot` and its five-slot constant are `src/domain/settings.ts`, beside
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
The colour rules — the five slots, the accent fallback via `--pbl-state-color`, and
the done rule's specificity over a slot — are `styles/timeline.css`; the legend's own
swatches and layout are `styles/legend.css`; the Today pill's rule is deleted from
`styles/timelineFurniture.css`.
