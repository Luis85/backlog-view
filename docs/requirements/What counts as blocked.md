---
type: Feature
parent: "[[Product Dependencies]]"
order: 40
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

# What counts as blocked

An item is blocked when something it depends on has not reached a state the vault declares
sufficient. That is **two** settings this view names for itself — the property state lives
under, and which of its values clear a dependency — because listing the values without naming
the property is a rule with nowhere to look, and borrowing a board's property would make this
view depend on a board existing.

With no state property configured, nothing is blocked and the view says so: it draws the
dependencies it has and reports that readiness is unconfigured, rather than treating every
edge as satisfied or every item as stuck. The answer is derived on read and never written to
the blocked item.

**Outcome** — Blocked means one stated thing, over a property this view was told about, and
the same items are blocked for everyone reading that configuration.
