---
type: Feature
parent: "[[Backlog Health]]"
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

# A definition of ready

A vault states what makes an item ready to be worked — problem defined, acceptance criteria
present, estimate present, dependencies known, design done, technical refinement done — and
the view says which items satisfy it. It is a health rule like the others, singled out
because it is the one teams already argue about by name.

**"Dependencies known" is the criterion that cannot be read from the dependency property**,
and saying so is the point: an empty list is removed rather than stored, and no stub is ever
backfilled, so a note with no `depends-on` is a note nobody has checked *and* a note with
nothing to depend on, indistinguishably. The criterion therefore reads an **assessment**
property of its own — somebody recording that they looked — and with none configured it is
unconfigured like any other missing input. Inventing an empty relationship to mean "checked"
would put a fake edge in the vault to answer a question about process.

**Outcome** — "Is this ready" has one answer everybody can see.
