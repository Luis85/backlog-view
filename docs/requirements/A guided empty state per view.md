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

**Outcome** — An unconfigured view explains itself and can configure itself, instead of
drawing nothing and blaming the vault.
