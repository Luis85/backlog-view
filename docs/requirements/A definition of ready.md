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

**Each criterion states its input and what passes it**, in the two shapes
[[Discovery readiness]] uses, because "design done" is a question two implementations answer
differently. Problem, acceptance criteria and estimate are **presence tests**: one key each,
named by this view, passing on a non-empty value — and the estimate additionally has to be a
number, since an estimate that reads `TBD` is the missing estimate wearing a value. Design
done and technical refinement done are **state tests**: a key and the values that count as
done, both declared here, passing when the item's value is one of them. A key with no value
list is unconfigured rather than empty, and an unconfigured criterion is listed as such
instead of failing every item, which is [[Rules that say what is wrong]]'s rule and applies
here because this is one of its rules.

**"Dependencies known" is the criterion that cannot be read from the dependency property**,
and saying so is the point: an empty list is removed rather than stored, and no stub is ever
backfilled, so a note with no `depends-on` is a note nobody has checked *and* a note with
nothing to depend on, indistinguishably. The criterion therefore reads an **assessment**
property of its own — somebody recording that they looked — and with none configured it is
unconfigured like any other missing input. Inventing an empty relationship to mean "checked"
would put a fake edge in the vault to answer a question about process.

**It is a state test like design and refinement, not a presence test**: the assessment key
comes with the values that mean *checked*, declared here, and the criterion passes only on
one of them. A presence test would clear the criterion on `Unchecked`, `No` or `In progress`
— every value somebody writes to record that they have **not** finished looking — which is
the opposite of what the property is for. A bound key with no value list is unconfigured, and
a value outside the list does not clear the criterion and is shown as written, so a
vocabulary somebody extended is visible rather than silently failing.

**Outcome** — "Is this ready" has one answer everybody can see.
