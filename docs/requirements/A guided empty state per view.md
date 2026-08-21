---
type: Feature
parent: "[[A view per capability]]"
order: 30
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

# A guided empty state per view

A view added to a base and not yet configured says what it needs and offers to bind
recommended defaults for it, in the shape the backlog view's own initialize action already
uses: suggest a key for every property nobody has named, then backfill those keys so
Obsidian's picker can offer them.

Recommended defaults initialize only the properties that view needs, and an existing value
is never overwritten silently.

**Every key a view reads is bound; only a key that view *writes* is backfilled.** The
question is asked per property, not per view, because most views are partly writable and
classifying a whole one gets both halves wrong: [[Product Dependencies]] writes the edge and
nothing else, yet reads a prerequisite state key it must never stamp across the base, and
Release Management writes membership while reading an estimate, a risk and a testing state that
belong to other capabilities. A setup action that backfilled a key its own view does not
write would put empty workflow data on every note in the base to configure a feature that
only reads it.

[[Product Analytics]] and [[Product Portfolio]] are the limit of that rule rather than an
exception to it: they write nothing, so they backfill nothing, and their guided empty state
stops at binding — which is also the largest possible version of the mistake, a write across
every note at the one moment a reader asked only to be told what to configure. A key nothing
has written stays unbound and its figure stays undrawn, which is what those views already say
happens.

**A relationship key is bound but never backfilled.** An empty `depends-on` or `evidence` on
every note asserts a relationship nobody stated and puts a stub on notes the feature has
nothing to do with — which this register already refused twice, for the dependency edge and
for what a test covers. Backfill is for a property where an empty slot is a thing the reader
fills in: a score, a state, a date. For the rest, binding the key is the whole job, and
Obsidian's picker learns the name from the first note that actually uses it.

**Outcome** — An unconfigured view explains itself and can configure itself, instead of
drawing nothing and blaming the vault.
