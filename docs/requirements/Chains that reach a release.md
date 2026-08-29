---
type: Feature
parent: "[[Product Dependencies]]"
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
priority: ""
iteration: ""
---

# Chains that reach a release

Dependency chains ending in something with a date or a commitment — a release, high-priority
work, an objective, a dated item — are highlighted, because those are the ones whose delay
costs something specific.

**Milestones are deliberately not in that list**, although the source document names them.
A milestone holds no work and nothing points at it ([[A release is a note of its own]]) —
there is no item-side milestone property anywhere in this register, on purpose — so no chain
can be shown to reach one, and an endpoint the view cannot recognise is a promise it cannot
keep. A vault that wants a milestone to be reachable gives it a release's shape, which is the
existing answer rather than a new relationship invented for a highlight.

**Each of those endpoints is a key this view names for itself**: the release membership, the
alignment link, the priority, the dates. **The priority endpoint needs a value list as well
as a key**, declared here: a key says where the priority lives and nothing about which of its
values is high, and a vocabulary is the vault's own — so without the list this view would
highlight `Won't` as readily as `Must`. It is the same two-part shape
[[Release readiness]] uses for every criterion reading a vocabulary, and the same rule holds
for a bound key with no list: unconfigured, not empty. The other three endpoints need no
vocabulary — a release, an objective and a date are present or absent.

It reads no other view's settings, and an endpoint
whose key is unconfigured simply does not make a chain critical — the chain still draws, it
is just not highlighted. Highlighting everything because a property could not be found would
be the same false alarm the health rules refuse.

**Outcome** — The dependencies that matter this quarter stand out from the ones that do not,
by criteria this view was told about rather than ones it guessed.
