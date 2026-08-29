---
type: PBI
parent: "[[A third projection]]"
order: 20
status: Done
priority: P1
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/roadmap.ts
  - src/storage/viewStateStore.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-09
risk: ""
assignee: ""
iteration: ""
---

# Horizons or dates

**As** someone configuring a roadmap, **I want** the view to draw the axis my options
declare — horizons, dates, or my pick when both exist — **so that** the roadmap states
what my notes state instead of guessing at what they mean.

Configuration is declaration, exactly as it is for the board: defining the workflow is
configuring the columns, and declaring an axis is configuring the roadmap. The closest
Obsidian prior art auto-detects date properties by keyword — start, begin, from; end,
due, deadline — and detection is a guess: the first drag writes the guess back into
frontmatter the user never chose. Here nothing is detected. A horizon property with
ordered values makes the bucket axis, a start and a target property make the timeline,
and the placeholders suggest the ecosystem's own names (the Tasks plugin's `start` and
`due`) without ever assuming them.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening roadmap mode, or changing the axis properties in the view options |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | The axis is read from configuration alone: no property is picked by name-matching, no date is ever read as a horizon, and reconfiguring the axis rewrites nothing on any note. |

**Main flow**

1. The user names a horizon property with ordered values, or a start and a target
   property, in the view options — the same declarative schema every other option uses.
2. The roadmap renders the axis the configuration declares: buckets for a horizon,
   a timeline for dates.
3. With both declared, a toolbar control picks which axis this saved view shows,
   persisted per saved view the way the mode itself is; until the user picks, the
   horizons render — the axis that cannot over-promise is the default the format's own
   literature argues for.
4. Results place onto the axis by what their own frontmatter says; what does not place
   goes to the shelf ([[The unplaced shelf]]).

**Extensions**

- **1a — neither axis is configured.** Roadmap mode is guidance naming both ways to get
  one ([[Roadmap empty states]]); there is no axis to draw, so drawing nothing and saying
  why is the honest render.
- **1b — an axis property names a key the plugin already owns, or another configured
  write target.** Refused by the same key-collision checks that gate every write — an
  axis key must never overwrite the parent, order, type, state or tags key; never a
  transition stamp ([[Stamp when work starts and finishes]]), or a plan that could
  reach the record would falsify it; and never another axis key, since start and
  target sharing one key cannot store a span, and a horizon sharing either is two
  semantics on one field. One rule over the whole set of configured write targets.
- **2a — the horizon property is set but its values list is cleared.** The bucket axis is
  unconfigured — a board without stages — and the guidance names the half that is
  missing rather than inventing a vocabulary.
- **2b — only one of the two date properties is named.** The timeline still renders:
  one date is enough to place an item at a point, and spans simply need both. An axis
  requiring both names would refuse a milestone-only roadmap that is perfectly coherent.
- **3a — the picked axis loses its configuration.** The roadmap renders the axis that
  remains — a configured axis always beats guidance, and guidance appears only when
  none is left — while the stored pick is retained, not rewritten: a persisted key is
  user data, and restoring the cleared property restores the saved choice with it.
- **4a — an item is outside the Base's filter.** It never places as a result on either
  axis: context rows render only in the context forms the epic names — a
  breadcrumb, an inert context row — never counted, never written.

## Acceptance criteria

- The axis is exactly what the options declare: horizon property and values make
  buckets; date properties make the timeline; with both, a persisted toolbar control
  picks, and the horizons render until it is first set; with neither, guidance renders.
  A pick whose axis is no longer configured yields to the axis that remains and is
  retained rather than rewritten, so restoring the configuration restores the choice.
- No property is ever chosen by name-matching, and no date is ever read as a horizon —
  the two guesses the prior art makes are the two this view refuses.
- Reconfiguring the axis rewrites nothing on any note.
- An axis property colliding with a key the plugin owns, with a transition stamp, or
  with another configured axis key is a configuration problem that gates writes, like
  every other collision.
- Context rows never place as results on either axis.

## Where it lives

The axis options are `horizonProperty`, `horizonValues`, `startProperty` and
`targetProperty` — a group in `src/domain/viewOptions.ts`, resolved in
`src/domain/settings.ts` beside the state property they mirror, where `configProblems`
refuses the collisions. Axis resolution is `configuredAxes` / `activeAxis` in
`src/domain/roadmap.ts`; the pick persists beside the mode in
`src/storage/viewStateStore.ts`, and the toolbar control is `renderAxisPicker` in
`src/view/render/toolbar.ts`. Driven in `test/domain/roadmap.test.ts`,
`test/domain/settings.test.ts` and `test/view/roadmap.test.ts`.
