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
| **Preconditions** | The roadmap's axis is the dated one, and the release type and its target-date key are configured |
| **Guarantee** | A marker is a release note the results hold, positioned by that note's own target date. Drawing writes nothing, and no release note is edited to draw it. |

**Main flow**

1. The roadmap collects the release notes in the results.
2. It reads each one's target date from the key the release view names.
3. It positions each at that date on the grid, in the same overlay the milestones use.
4. It labels each marker with the release note's name, and distinguishes it from a milestone.

**Extensions**

- **1a — the release type is not configured.** No markers are drawn at all — absent, not
  empty — and the roadmap says nothing about releases.
- **2a — a release has no target date.** No marker is drawn for it. It is not placed at today
  and not shelved: a release without a date has no position on a dated axis, and
  [[Every release at once]] is where it is still visible.
- **2b — the target date cannot be read as a date.** Treated exactly as 2a, and reported in the
  same place, so a typo is not silently a position.
- **3a — two releases fall on the same date.** Both draw, in a stable order that does not
  change between renders, the same tie rule the milestone overlay already keeps.
- **4a — a release note is outside the Base's filter.** The marker still draws, labelled from
  the link, and it is never a write target — the context rule, applied to a marker.
- **4b — the roadmap's axis is the horizon one.** No markers are drawn: a horizon bucket is not
  a date, and a release placed in one would be a position the view invented.

## Acceptance criteria

- A release with a target date draws one marker at that date, at every zoom, and a release
  without one draws none.
- A marker is visually distinct from a milestone marker and is named in the roadmap's legend.
- Drawing a release marker plans no write, and a release note the Base excluded is never a
  write target.
- Two releases on one date render in the same order across repeated renders.
- With the horizon axis selected, no release marker is drawn.

## Where it lives

The overlay in `src/view/render/milestoneLines.ts`, positioned by `src/domain/timeline.ts`
against the grid in `src/view/render/timeline.ts`, named in `src/view/render/legend.ts`. The
releases themselves come from the model in `src/domain/model.ts`, and the keys are the release
view's own in `src/domain/viewOptions.ts` — read here, never redeclared.
