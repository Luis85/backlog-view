---
type: Issue
parent: "[[A view per capability]]"
order: 20
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
priority: ""
iteration: ""
---

# Settings scoped to their view

A view's options describe only what that view does. The hierarchy levels belong to the
backlog, the scoring model to prioritization, the lifecycle states to discovery, the
staleness age to health — and none of them appears in the options of a view that ignores
it.

Where two views legitimately need the same fact — which property holds the state, which
holds the parent — each names it for itself and may default to the same suggestion.
Sharing the suggestion is not sharing the setting.

**Two rules follow, and they govern every view under [[A view per capability]] rather than being restated
in each one.** First: **every property a view reads is a key that view names.** Not only the
ones it writes, and not only the ones its own capability invented — a readiness check that
reads an estimate, a rollup that reads a health figure, a chain that reads a release
membership, a summary that reads an evidence kind. A view that reads a property it did not
name is reading another view's configuration, which is the coupling that rule exists to
prevent. Second: **a key nobody configured produces nothing, and says so.** The figure is not
drawn, the check is not evaluated, the highlight is not applied — and what is missing is
reported as unconfigured rather than as an answer. The failure this forbids is the loud one:
a rule that cannot find a property reporting every item as missing it.

Both were learned the same way, four times in one review pass: a feature listing the values
that clear a dependency without naming the property they live on, a health rule reporting a
missing field it had no key for, an analytics inventory that was short by two and then by
six. The rule is here so the fifth feature does not have to learn it again.

**Outcome** — A user configuring one capability never scrolls past the settings of a
capability they have not added.
