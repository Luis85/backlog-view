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
priority: ""
iteration: ""
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

**The structural rules are answered by the plugin's own level model, not by a hierarchy this
view configures.** What may be a root, which parent holds which child, and what an epic is
are the shared model every view is built on ([[A view per capability]] extracts it as the
kernel) — reading it is not reading another view's settings, and restating it here would be a
second idea of the ladder that could disagree with the first. What this view does name is the
**type key**, because that is a property, and with it the four structural rules are exact: a
result whose type may not be a root and which has no parent is **missing a parent**; a result
whose parent is not a level the model allows above it is an **invalid hierarchy**; a result
whose parent link resolves to nothing is **orphaned**; and a result of the top type with no
result beneath it is an **empty epic**. Each needs the switch above as well, and a result
whose type is missing or unknown is reported by the missing-type rule rather than guessed
into a level.

**Every other rule names the properties it inspects, and this view names them for itself** — the
estimate, the state, the owner, the objective, the evidence link, the release, the dependency
edge, whatever a rule reads. A rule cannot report a missing field without being told where
that field lives, and it may not borrow the answer from the view that writes it.

**A threshold is a number against something, so each threshold rule names its operand, its
unit and its boundary.** A configured number with no declared operand is the arbitrary answer
this note is written against — one implementation would compare an estimate, the next a
descendant count and the next the length of the note body, and all three would call themselves
"oversized". Both threshold rules are therefore stated: **oversized** compares the **estimate
key** this view already names, read as a number in whatever unit the vault estimates in, and
reports a result whose value is **greater than** the threshold — never at it, so a threshold of
`8` passes an eight-point item; **stale** compares the days between today and the **date key**
this view names, and reports a result older than the threshold, on the same strict boundary.
Neither invents a size of its own, and neither looks at how many children an item has: a
big epic is a shape the level model already describes, not a health finding. A result whose
operand is absent or is not a number is **not** reported by either — that is the
missing-estimate rule's finding, and reporting it twice under two names is how one gap becomes
two.

**A rule whose inputs are not configured does not run, and says so.** It is not silently
skipped and it never reports every item as missing something: the dashboard lists it as
unconfigured, which is a fact about the setup rather than a finding about the backlog. That
distinction is the whole difference between a health view somebody trusts and one whose first
run produces four hundred false findings.

**Outcome** — What "unhealthy" means here is written down, can be argued with, and never
fires because a property was named somewhere else.
