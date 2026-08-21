---
type: Feature
parent: "[[Release Management]]"
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
---

# Capacity against commitment

A release may declare a capacity in whatever unit the vault estimates in — points, person
days, ideal days — and the view compares it with what has been committed, showing the
difference and the utilization. The unit is named on screen, and nothing is converted.

**Capacity is one key on the release note, and the unit is not a second one.** This view
names that key for itself, like every key it reads, and reads a plain number from it: a
release carrying `capacity: 40` is forty of something, and what that something is comes from
**one unit string in this view's own options**, stated once for the whole view rather than
per release. Two properties would let a release disagree with its neighbour about the unit
while the comparison added them up, and a compound value like `40 points` is a string nothing
can sum. Commitment is the same unit by construction — it is the effort estimate summed
over the release's members, so the view names that key too and never converts between them.

**Each member's own estimate is counted once, and nothing is derived from anybody's
children.** An estimate property is a number on a note, so the commitment is the sum over the
notes whose own property names this release ([[What is in a release]]) — an epic and its
feature both in the release contribute both estimates. Counting leaves only would throw away
a direct estimate on parent work, which some vaults keep and nothing here forbids. **Where a
member's estimate is meant to cover its descendants, that is double counting, and the view
says so rather than resolving it**: members carrying an estimate while a descendant in the
same release carries one are counted and named beside the figure. Only the vault knows
whether its parent estimates are aggregates, and a view that guessed would be wrong silently
in whichever direction it guessed.
With capacity unconfigured, or a release carrying no number where the key points, there is no
comparison for that release: the commitment is still shown, and the missing half is named.
**The unit is part of the mapping, not a decoration on it**: with no unit set there is no
comparison either, for the same reason the release summary states which denominator it used —
a bare "40 against 52" is two numbers whose meaning the reader supplies, and this feature's
whole claim is that an over-commitment is legible in the unit the team uses. So the view asks
for the unit where it asks for the keys, and lists it as missing exactly like an unbound key
rather than printing unlabelled arithmetic.

**A capacity of zero has no utilization, and that is not an error.** A release that
deliberately declares zero capacity is a real statement — nothing is planned for it — and
dividing by it produces the infinity or the `NaN` that would be shown as a percentage. So
utilization is reported only where capacity is positive; at zero the view shows the
commitment and the difference, which are exactly the numbers that matter there, and says the
percentage needs a capacity. A negative capacity is refused where it is entered, since no
unit this feature names can be less than none.

**Outcome** — An over-committed release says so in the unit the team actually uses.
