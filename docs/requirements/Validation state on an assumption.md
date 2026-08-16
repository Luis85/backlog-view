---
type: Feature
parent: "[[Product Discovery]]"
order: 50
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

# Validation state on an assumption

An assumption or an opportunity is unknown, being tested, supported, rejected or
inconclusive — a property of its own, separate from the lifecycle state, because where
something sits in discovery and whether it turned out to be true are two different facts.

`Inconclusive` is a first-class answer, not a missing one.

**A state that asserts a result is a claim, and [[Product Discovery]] requires every claim to
point at its evidence or say it is an assumption.** So this view names an **evidence-link
key** — the same key [[The evidence explorer]] and [[What has no evidence]] read — and one
list: the values that **assert a result**, `supported` and `rejected` by default, with
`validated` where a lifecycle uses it. `Unknown` and `being tested` assert nothing and need
nothing. `Inconclusive` is in the list too: "we tested and nothing settled" is a claim about a
test that happened, and a bare one is indistinguishable from nobody having looked.

**The claim is not refused; it is labelled.** Nothing blocks the state change —
[[Discovery readiness]] already states that this epic reports rather than gates, and a
validation state somebody cannot record until the paperwork is done is a state they will
record somewhere else. Instead an asserting state with an empty evidence key renders
**asserted without evidence** wherever that state is shown, which is the epic's "says it is an
assumption" in the one place a reader meets the claim, and [[What has no evidence]] lists it
with the rest. With no evidence key configured the marking is absent rather than applied to
everything: a key nobody named produces nothing, per [[Settings scoped to their view]].

**Outcome** — A team can tell what it has checked from what it merely believes.
