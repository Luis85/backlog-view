---
type: PBI
parent: "[[A release is a note of its own]]"
order: 20
status: Done
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
files:
  - src/domain/viewOptions.ts
  - src/domain/settings.ts
  - src/domain/settingsResolve.ts
  - src/domain/readItems.ts
  - src/domain/bars.ts
  - src/domain/roadmap.ts
  - src/view/host.ts
  - src/view/render/timeline.ts
  - src/view/render/milestoneLines.ts
  - src/view/render/roadmap.ts
  - src/view/render/legend.ts
  - styles/milestoneLines.css
  - styles/legend.css
started: 2026-08-29
finished: 2026-08-29
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# A release on the dated axis

**As** someone reading the roadmap, **I want** a release to draw as a marker at its target
date, **so that** the dates I promised and the scope I committed to are one picture instead of
two screens.

The epic says the two meet on the roadmap "and nowhere else", and no note owned that until
now. The work extends the marker overlay
[[Milestones in one row on the dated axis]] built, which already draws a dated thing that owns
no row — so a release is a LINE across the grid and never a row of its own: it is not ranked,
not counted in `placedCount`, not a drop target and not holdable, and every refusal
[[Releases as their own type]] states is untouched.

**Both grid axes draw it, and that is one mechanism rather than two.** The overlay is drawn
across the rows, so the plain dated axis and the resources axis get the marker from the same
call — a release on the resource roadmap is the same line, in the same place, without an
axis-specific rule of its own.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the roadmap |
| **Trigger** | The roadmap drawing its dated axis |
| **Preconditions** | The roadmap's axis is a dated one (the plain grid or the resources bands), and the roadmap's own release-date key is not cleared |
| **Guarantee** | A marker is a release note the results hold, positioned by that note's own target date. Drawing writes nothing, and no release note is edited to draw it. |

**Main flow**

1. The roadmap collects the release notes in the results.
2. It reads each one's target date from the key **the roadmap** names for it.
3. It positions each at that date on the grid, in the same overlay the milestones use.
4. It labels each marker with the release note's name, and distinguishes it from a milestone.

**Extensions**

- **1a — no note in the results is typed `Release`.** No markers are drawn at all — absent,
  not empty — and the roadmap says nothing about releases. The type name is a fixed constant,
  not an option (ADR 0013), so there is nothing to bind here and nothing that could disagree
  with the release view about what a release is.
- **2a — a release has no target date.** No marker is drawn for it. It is not placed at today
  and not shelved: a release without a date has no position on a dated axis, and
  [[Every release at once]] is where it is still visible.
- **2b — the target date cannot be read as a date.** Treated exactly as 2a, and reported in the
  same place, so a typo is not silently a position.
- **2c — the roadmap's release-date key is CLEARED.** No marker is drawn at all. It never falls
  back to the release view's key: a view reading another view's configuration is the hidden
  channel [[A view per capability]] refuses, and the two may legitimately be pointed at
  different properties.

  **Amended 2026-08-29, in two ways, and both are narrowings of what was written here.**
  First, the option ships a real default (`note.target-date`, the key the release view
  suggests for the same date), so "unconfigured" is now reachable only by clearing it —
  sharing a suggestion is not sharing a setting, and a marker overlay nobody configured is a
  feature nobody finds. Second, the original sentence promised the fact would be "reported as
  unconfigured", and nothing reports it: this grid has no surface that names a configuration
  state, the release view already names an unreadable date per release, and inventing one here
  for a state the reader reached by clearing the box would be a guard with nowhere to speak —
  the same trade [[Two release options aimed at one property go unreported]] records. What is
  written to the check is the sentence above: cleared means no markers.
- **3a — two releases fall on the same date.** Both draw, in a stable order that does not
  change between renders, the same tie rule the milestone overlay already keeps.
- **3b — a release is dated beyond every bar on the grid.** The window is widened to hold it,
  exactly as it is for an absence stretch a row never reaches. A mark the window was never
  widened for is clamped to the edge and painted on a day it does not cover, which is the
  defect `docs/bugs/An absence drew at the edge of a window it never widened.md` records for
  the other source — a release is not a bar, so nothing else would have widened it.
- **4a — a release note is outside the Base's filter.** No marker is drawn for it. A member's
  link gives a name and a name positions nothing: the date lives on the excluded note, and a
  release parents nothing, so it never arrives as a context row to carry one
  ([[Releases as their own type]]). Guessing a position would be worse than the gap. A base
  that hides its releases hides their markers, which is the stated limit rather than a wider
  vault read invented here.
- **4b — the roadmap's axis is the horizon one.** No markers are drawn: a horizon bucket is not
  a date, and a release placed in one would be a position the view invented.

## Acceptance criteria

- A release with a target date draws one marker at that date, at every zoom, and a release
  without one draws none. An unreadable date draws none either — it is neither a position nor
  a shelf, and `releaseMarks` drops all three cases at one place.
- A release the Base excludes draws no marker, even where a member on screen links to it.
  Free, and asserted anyway: `BacklogModel.releases` already excludes an `outsideFilter` row.
- A marker is visually distinct from a milestone marker and is named in the roadmap's legend.
  Distinct in TWO channels, not one: purple against cyan, and dashed against solid — a colour
  alone separates them only for a reader who can see both. The label and its tooltip name the
  type in words (`timeline.releaseLine`), which is the channel a colour cannot reach at all.
- The legend keys a release only where a line actually DREW (`DrawnColors.release`), never
  from a predicate over `model.releases`: a release with no readable date, or one outside a
  clamped window, is in that list and on no grid.
- Drawing a release marker plans no write. Nothing in the path can: the key is read in
  `readItems.ts` and is not a row of `PROPERTY_TABLE`, so no planner names it and the backfill
  cannot stub it.
- Two releases on one date render in the same order across repeated renders — one line naming
  both, in `model.releases` order, the same day-grouping the milestone overlay already keeps.
- With the horizon axis selected, no release marker is drawn: `buildRoadmap` fills
  `releaseMarks` only for an axis `drawsGrid` answers for.
- **The resources axis draws exactly what the dated axis draws.** Both pass the same list to
  the same overlay, so a release cannot come to mean two things on one roadmap.
- The window holds every release mark (3b above), so a release dated past the last bar is
  drawn at its date rather than clamped to the edge.
- **`placedCount`, `eligibleResults` and the shelf are untouched by any of it.** A release is
  a mark and not a result of this projection, so the axis's own invariant — placed plus
  shelved equals the visible result rows — still holds with markers on screen.

## Where it lives

`renderReleaseLines` in `src/view/render/milestoneLines.ts` is the overlay — beside
`renderMilestoneLines` rather than inside it, because the milestones' lines are computed from
the BARS the grid drew and a release has neither a bar nor a row. The two share `drawDayLines`
in the same module, which is what keeps one mark from drifting a pixel from the other, and
share their positioning rules in `styles/milestoneLines.css`; only the colour, the dash and
the label's wording are the release's own.

It is positioned by `barGeometry` in `src/domain/timeline.ts` against the grid in
`src/view/render/timeline.ts`, which also widens the window for the marks (3b) and reports
`DrawnColors.release` (`src/view/host.ts`) so `src/view/render/legend.ts` keys what actually
drew. `src/view/render/roadmap.ts` hands the same list to both grid axes.

The marks themselves are `releaseMarks` in `src/domain/bars.ts` — the module that already
states why a release is not placed on this axis at all — carried on `RoadmapModel.releaseMarks`
by `src/domain/roadmap.ts`, which fills it only for a grid axis and reads it from
`model.releases` rather than from the row list every axis drops a release out of.

The roadmap declares its **own** release-date key, `releaseDateProperty`, in
`src/domain/viewOptions.ts`, beside the axis keys it already names — defaulting to
`note.target-date`, the same suggestion the release view offers, which is sharing a suggestion
and not a setting. It resolves onto `BacklogSettings.releaseDateKey` (`src/domain/settings.ts`,
`src/domain/settingsResolve.ts`) and is deliberately NOT a row of `PROPERTY_TABLE`: that table
is the vocabulary of this view's WRITE targets, and this key is read and never written.
`src/domain/readItems.ts` reads it, for a `Release` note and for nothing else. The type it
matches is the constant in `src/domain/itemTypes.ts`, so no option names it.
