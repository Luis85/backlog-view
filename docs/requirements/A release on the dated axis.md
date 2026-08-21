---
type: PBI
parent: "[[A release is a note of its own]]"
order: 20
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A release on the dated axis

**As** someone reading the roadmap, **I want** a release to draw as a marker at its target
date, **so that** the dates I promised and the scope I committed to are one picture instead of
two screens.

The epic says the two meet on the roadmap "and nowhere else", and no note owned that until
now. Nothing yet: the work extends the marker overlay
[[Milestones in one row on the dated axis]] built, which already draws a dated thing that owns
no row.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the roadmap |
| **Trigger** | The roadmap drawing its dated axis |
| **Preconditions** | The roadmap's axis is the dated one, and the roadmap's own release-type and release-date keys are configured |
| **Guarantee** | A marker is a release note the results hold, positioned by that note's own target date. Drawing writes nothing, and no release note is edited to draw it. |

**Main flow**

1. The roadmap collects the release notes in the results.
2. It reads each one's target date from the key **the roadmap** names for it.
3. It positions each at that date on the grid, in the same overlay the milestones use.
4. It labels each marker with the release note's name, and distinguishes it from a milestone.

**Extensions**

- **1a — the roadmap's release-type key is not configured.** No markers are drawn at all —
  absent, not empty — and the roadmap says nothing about releases. It never falls back to the
  release view's setting: a view that read another view's configuration would be the hidden
  channel [[A view per capability]] refuses, and the two views may legitimately be pointed at
  different properties.
- **2a — a release has no target date.** No marker is drawn for it. It is not placed at today
  and not shelved: a release without a date has no position on a dated axis, and
  [[Every release at once]] is where it is still visible.
- **2b — the target date cannot be read as a date.** Treated exactly as 2a, and reported in the
  same place, so a typo is not silently a position.
- **2c — the roadmap's release-date key is unconfigured while its release-type key is not.**
  No marker is drawn and the fact is reported as unconfigured, not as a release without a
  date. Half a mapping is no mapping, the same answer every two-part key in this register
  gives.
- **3a — two releases fall on the same date.** Both draw, in a stable order that does not
  change between renders, the same tie rule the milestone overlay already keeps.
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
  without one draws none.
- A release the Base excludes draws no marker, even where a member on screen links to it.
- A marker is visually distinct from a milestone marker and is named in the roadmap's legend.
- Drawing a release marker plans no write.
- Two releases on one date render in the same order across repeated renders.
- With the horizon axis selected, no release marker is drawn.

## Where it lives

The overlay in `src/view/render/milestoneLines.ts`, positioned by `src/domain/timeline.ts`
against the grid in `src/view/render/timeline.ts`, named in `src/view/render/legend.ts`. The
releases themselves come from the model in `src/domain/model.ts`. The roadmap declares its
**own** release-type and release-date keys in `src/domain/viewOptions.ts`, beside the axis
keys it already names — defaulting to the same suggestions the release view offers, which is
sharing a suggestion and not a setting.
