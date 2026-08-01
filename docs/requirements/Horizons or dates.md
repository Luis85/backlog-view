---
type: PBI
parent: "[[A third projection]]"
order: 20
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
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
- **1b — an axis property names a key the plugin already owns.** Refused by the same
  key-collision checks that gate every write — an axis must never overwrite the parent,
  order, type, state or tags key, the rule the transition stamps already follow
  ([[Stamp when work starts and finishes]]).
- **2a — the horizon property is set but its values list is cleared.** The bucket axis is
  unconfigured — a board without stages — and the guidance names the half that is
  missing rather than inventing a vocabulary.
- **2b — only one of the two date properties is named.** The timeline still renders:
  one date is enough to place an item at a point, and spans simply need both. An axis
  requiring both names would refuse a milestone-only roadmap that is perfectly coherent.
- **4a — an item is outside the Base's filter.** It never places as a result on either
  axis: context rows render only in the context forms the epic names — a lane header, a
  breadcrumb, an inert context row — never counted, never written.

## Acceptance criteria

- The axis is exactly what the options declare: horizon property and values make
  buckets; date properties make the timeline; with both, a persisted toolbar control
  picks, and the horizons render until it is first set; with neither, guidance renders.
- No property is ever chosen by name-matching, and no date is ever read as a horizon —
  the two guesses the prior art makes are the two this view refuses.
- Reconfiguring the axis rewrites nothing on any note.
- An axis property colliding with a key the plugin owns is a configuration problem that
  gates writes, like every other collision.
- Context rows never place as results on either axis.

## Where it lives

**Nothing yet — this note is design.** The axis properties and their resolution join
`src/domain/settings.ts` beside the state property they mirror, and the declarative
schema entries join `src/domain/viewOptions.ts`; the key-collision rule extends the
checks already gating every write.
