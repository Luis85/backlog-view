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

**The two structural rules need a population nobody can infer.** A note that lost both its
type and its parent is not a work item by this plugin's own scope rule, so "missing type" and
"missing parent" can never see the item they exist for — and evaluating every result instead
would report a meeting note in a folder base as unhealthy work. Only the vault can say which
it is, so this view carries one switch: **whether its base returns work items only**. Off,
the two rules do not run and are listed as unconfigured, like any rule missing an input; on,
every result is treated as intended work and a note that has fallen out of the model is
exactly what they report. It is one deliberate answer per base rather than a discriminator
the plugin invents.

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
