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

**A view that writes nothing backfills nothing.** [[Product Analytics]] and
[[Product Portfolio]] both promise they never write, and a setup action that stamped empty
keys across every note in their base would break that promise on the largest possible
scale — at the one moment a reader is least expecting a write, having asked only to be told
what to configure. So for a reporting view the guided empty state stops at the first half:
it says which keys it needs and binds them, and the picker learns the names from the notes
that already carry them. A key nothing has written stays unbound and its figure stays
undrawn, which is what those views already say happens.

**A relationship key is bound but never backfilled.** An empty `depends-on` or `evidence` on
every note asserts a relationship nobody stated and puts a stub on notes the feature has
nothing to do with — which this register already refused twice, for the dependency edge and
for what a test covers. Backfill is for a property where an empty slot is a thing the reader
fills in: a score, a state, a date. For the rest, binding the key is the whole job, and
Obsidian's picker learns the name from the first note that actually uses it.

**Outcome** — An unconfigured view explains itself and can configure itself, instead of
drawing nothing and blaming the vault.
