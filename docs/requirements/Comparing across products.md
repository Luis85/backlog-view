---
type: Feature
parent: "[[Product Portfolio]]"
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
priority: ""
iteration: ""
---

# Comparing across products

Portfolio items are compared on the **stored** value score — the property an estimation view
wrote, read here under a key this view names, beside the effort, confidence and **model
stamp** properties it names for itself. Four keys, all its own; that is the whole handoff,
and it is deliberately the only one: the model that produced a score lives in an estimation
view's own settings, which this view may not read and must not require to exist.

So a portfolio comparison is honest about what it is showing. **The stamp has two parts and
only one of them is compared**: the model fingerprint answers "same model?", and the coverage
beside it answers "how much of it?", so comparing the whole stamp would report two models for
two ordinary partial profiles scored by one. The fingerprints are compared with each other —
this view never asks what any of them means, only whether they agree — and the coverage is
reported per item beside its number. Where two products carry two different fingerprints the
comparison says so rather than averaging across it.

**An absent stamp is its own answer**, not a match: a score written by hand or by something
else is shown and counted as unattributed, because treating it as agreeing with whatever it
sits beside is the silent version of the problem this note exists to avoid. With
no stamp key configured at all, the comparison drops the claim rather than making it — it
compares the numbers and says it cannot tell which models produced them.

**Rescoring the selection under one model is declined here, deliberately, and the source
document asked for it.** Sending a population from this view into a prioritization engine
would be one view driving another — a command channel between views, which is the coupling
[[A view per capability]] exists to prevent, and a second implementation of the model besides.
The vault already does it in one move: an estimation view whose base returns that population
*is* the cross-product rescoring, with its own model, its own settings and the same stamped
totals this view then reads. What is lost is a button; what is kept is that no view can
change what another view means.

**Outcome** — Investment choices between products use the same recorded numbers everyone
else sees, and a comparison across two different models says so instead of pretending to
be one.
