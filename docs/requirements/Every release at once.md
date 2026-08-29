---
type: Feature
parent: "[[Release Management]]"
order: 15
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Every release at once

Every release in the results as one row each — version, target date, status, progress, what
is committed against whatever capacity was declared, and how far the actual date fell from
the target. It is the view's own entry point: with no release picked this is what is on
screen, and picking a row opens that release.

**It is the index, not a peer projection.** The other five features describe one release; this
describes the list they are the detail of. That is why it is not a scope picker beside a
toggle, the way [[A board scoped to one iteration]] offers its scopes: those are two ways of
cutting the same cards, and these are the same data at two zoom levels. It is also the answer
to a question none of the other features asked — how a release gets picked at all.

**Which release is open is view state, never a `.base` setting.** Per device and per saved
view, like the mode, the focus level and the roadmap's axis, and for the stated reason: base
settings are saved on the view, working position on the device
([[Settings scoped to their view]]).

**Every figure on the list is one another feature already defines, computed the same way.**
Progress and commitment are [[The release summary]]'s and [[Capacity against commitment]]'s,
over the membership [[What is in a release]] defines — one denominator, one predicate, one answer. A
row that computed its own would report a release differently depending on whether it was
being listed or being read, which is the defect [[Trying a scope change]] already names about
recomputing a figure a second way.

**Slip is stated, never inferred.** A release with an actual date says how far it landed from
its target; a release without one says nothing about slip rather than measuring today against
a plan. Nothing here is persisted — slip, like progress, is recomputed on read.

**Outcome** — The shape of the whole release plan is one screen, and one click gets to any of
it.
