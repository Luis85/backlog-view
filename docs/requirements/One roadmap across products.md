---
type: Feature
parent: "[[Product Portfolio]]"
order: 40
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

# One roadmap across products

The roadmap's own drawing, grouped by product or domain rather than by parent, so several
products' plans sit on one time axis.

**It reuses the roadmap's axis *rules* and none of its settings**, which are two different
things and were one sentence until this was written down. The rules — horizon buckets, or a
timeline from two date properties, with everything unplaceable on a counted shelf — are
behaviour, shared as code the way every view shares the kernel.

**Here both axes are read-only**, which is the one rule this drawing does not inherit: a card
sits in the bucket its horizon property names and cannot be dragged out of it, because
[[Product Portfolio]] writes nothing at all and an exception for one gesture would make that
promise a thing a reader has to check per feature. What is lost is a drag; what is kept is
that opening a portfolio can never change a plan. Moving work between horizons is the
roadmap view's job, over the base whose plan is being changed. The
**axis pick and the property keys behind it are this view's own**: which axis it draws, the
horizon key, the start and end keys, named in the portfolio view's options and defaulting to
the same suggestions every view starts from. A portfolio installed without a roadmap view has
nothing to borrow, and a portfolio installed beside one must not change when somebody
reconfigures it.

With the axis unpicked or its keys unbound, this drawing is not shown and the guided empty
state offers to bind them — the same answer the roadmap gives, for the same reason.

**Outcome** — A portfolio has a plan on one page.
