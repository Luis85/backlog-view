---
type: Feature
parent: "[[Release Planning]]"
order: 60
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Release readiness

A configurable checklist over the release's own scope — everything estimated, dependencies
resolved, critical risks addressed, testing complete — each answer derived from properties
the items already carry, each shown as satisfied, partly satisfied or not, and none of them
blocking anything.

Each criterion reads a property this view names for itself — the estimate, the dependency
edge **and the prerequisite state and values that clear it**, the risk, the testing state,
the release membership — never one borrowed from the view that writes it, and a criterion
whose key is unconfigured is listed as unconfigured rather than as failed or passed. The
dependency criterion needs all three: an edge says what a thing waits for and nothing about
whether the wait is over, so with no state key bound it is exactly as unconfigured as a
criterion with no property at all. [[Settings scoped to their view]] is where that rule lives.

**Outcome** — A release decision is made against stated criteria instead of a feeling, and
a criterion nobody configured never reads as a verdict.
