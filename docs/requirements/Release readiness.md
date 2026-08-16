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

**A key is half of a criterion; the other half is which values clear it**, and every
criterion that reads a vocabulary declares its own list beside its key, the way the
dependency criterion already does. Critical risks names **which risk values are critical**
and **which values count as addressed**; testing names **which testing states are complete**.
Neither can be inferred from a property key, both differ between vaults, and the backlog
view's risk vocabulary belongs to that view. A key bound with no value list is unconfigured,
not empty — the same answer as no key at all, and for the same reason.

**An estimate clears its criterion by being a number**, the same predicate
[[A definition of ready]] states and for the same reason: `TBD`, an empty string and anything
non-finite are the missing estimate wearing a value, and a criterion that accepted them would
report a release as fully estimated on the strength of somebody's placeholder. Every other
criterion here reads a vocabulary and clears on a declared value; this one reads a quantity
and clears on being one.

**Satisfied, partly and not are a count, not a judgement.** Each criterion is evaluated per
item over one denominator — the items whose own property names this release, which is the
membership [[What is in a release]] defines and the same population every other release
figure uses. All of them clear it and it is satisfied; none do and it is not; anything
between is partly, and it says how many, which is the number somebody actually acts on. Items
the criterion cannot read — no value where it looks — are counted as not clearing it and
reported separately, because an unanswered item is not a passing one. An empty release
satisfies nothing: with no items in scope every criterion reads as having nothing to check.

**Outcome** — A release decision is made against stated criteria instead of a feeling, and
a criterion nobody configured never reads as a verdict.
