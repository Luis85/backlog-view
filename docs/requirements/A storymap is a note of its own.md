---
type: Feature
parent: "[[Storymaps]]"
order: 10
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A storymap is a note of its own

**Outcome** — A vault can make a storymap, and a use case can say which map it belongs to.

A map has a name, an audience and a reason to exist, so it is a note rather than a saved
query. The register answers this shape twice already — [[A release is a note of its own]]
and [[An iteration is a note of its own]] both hold facts of their own and are *pointed at*
by the work rather than holding it. A storymap is the third and the thinnest: it carries no
scope, no dates and no numbers, which is what decides its category rather than a preference.

## Landmines, before implementation

**`MARKER_TYPES`, not `EXTRA_TYPES`, and the difference is not cosmetic.** That second list
means *pinned at `EXTRA_TYPE_RANK`, children are Tasks, hangs from an Epic, a Feature or a
PBI*. All three are false of a storymap, so adding the name there would not extend the
contract but falsify it, and `isExtraType` would start meaning two things at every call site
that reads it. [[Milestones]] is the worked precedent, and it met the wrong list first.

**The type lands before the property, and the second half fails silently without the
first.** A property cannot be bound to a note kind the vocabulary does not declare, and a
`Set map` action offered against nothing writes a link to a note that will never draw. The
same argument `runInit` makes for binding and backfilling as one action applies here.

**Both halves wait on the placement decision.** [[Ten capabilities want seventeen new types]]
has to place `Storymap`, and [[The type palette has no unclaimed hue left]] has to answer
the badge, before either use case here ships. [[Storymaps]] states that ordering; this is
where it bites.
