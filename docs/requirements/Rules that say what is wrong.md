---
type: Feature
parent: "[[Backlog Health]]"
order: 10
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

# Rules that say what is wrong

A configurable set of rules over the backlog: missing parent, type, estimate, state, owner,
objective, evidence, acceptance criteria or release; invalid hierarchy; circular
dependency; stale, orphaned or oversized items; an epic with nothing under it. Each is
enabled, severity-assigned and threshold-set by the vault, and each is a question about the
data rather than about the work.

**Every rule names the properties it inspects, and this view names them for itself** — the
estimate, the state, the owner, the objective, the evidence link, the release, the dependency
edge, whatever a rule reads. A rule cannot report a missing field without being told where
that field lives, and it may not borrow the answer from the view that writes it.

**A rule whose inputs are not configured does not run, and says so.** It is not silently
skipped and it never reports every item as missing something: the dashboard lists it as
unconfigured, which is a fact about the setup rather than a finding about the backlog. That
distinction is the whole difference between a health view somebody trusts and one whose first
run produces four hundred false findings.

**Outcome** — What "unhealthy" means here is written down, can be argued with, and never
fires because a property was named somewhere else.
