---
type: Feature
parent: "[[Product Roadmap]]"
order: 80
status: Open
created: 2026-08-13
source: user request
---

# The resource timeline

A third row for the roadmap's dated axis: one per resource, drawn from the same assignee
property [[Assignment]] already reads and writes, with each assigned item positioned in
its row by the same start and target dates [[The timeline]] already draws — so seeing who
is doing what, and when, costs no second data model. A resource with nothing assigned yet
can still get a row, from a declared roster the view options name, the same "declared or
it cannot show up empty" reasoning the horizon buckets already rest on. Alongside it, an
absence — a resource's own unavailable stretch — draws in that resource's row and nowhere
else, since it answers a question only this axis asks.

**Outcome** — Opening the roadmap on the resources axis answers "who has what, and are
they even around" in one screen: every declared or assigned resource shows a row, every
assigned item sits where its own dates put it, and a logged absence blocks out the
stretch nobody should be scheduled across.

## Landmines, before implementation

**The axis is derivative, not new ground — it exists only where the dated axis already
does.** A resource's row positions its bars by the SAME start and target properties
[[The timeline]] reads, so this axis is unavailable wherever that one is: no separate
"resource dates" setting, and no vault sees a resources axis with no dated one under it.
Getting this backwards — inventing a parallel pair of date keys, or gating the axis on
the assignee property alone — is the mistake to not make on the first pass: [[Assignment]]
is deliberately "optional in one half, with nothing else to configure," and this is the
first feature that asks it to co-declare with another property rather than stand alone.

**A resource's row draws from two sources, and the first PBI has to leave room for the
second.** [[Showing a resources axis on the roadmap]] positions the Base's own results;
[[Resource absences]] adds a second kind of bar the same row must also draw, from notes
that carry their own declared type and are excluded before they ever become a
`BacklogItem` — unconditionally, regardless of `hierarchyOnly`, never in the tree, the
board or any other axis — the same spirit an ADR opts out in, though the mechanism
differs: a type check here, a folder there. Building the row's rendering as one more
consumer of the roadmap model without that seam in mind means rebuilding the row once
the second source exists, rather than adding to it.
