---
type: Epic
order: 2.5
status: Open
area: product
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

# Release Management

**A release is a decision about scope, and the decision needs numbers — but the decision is
not the end of it.** This view composes the numbers: what is in a release, how big it is, how
much of it is done, what is blocking it, and what has not been estimated at all — with a way
to try a change before committing to it. Then it carries the release through the rest of its
life: work joins it, it ships, it says what shipped, and the next one is already on screen
beside it.

**Outcome** — Someone deciding what ships can see the scope, its size against whatever
capacity was declared, and every unresolved thing in it, without assembling that by hand —
and can then put work in it, ship it, and hand out what it contained.

## Why it is its own view

A release is not a rung on the backlog ladder and not a milestone: it holds work of every
level, its membership is a property on the item, and it has facts of its own — a version, a
target date, a capacity. The backlog view has no business carrying capacity units, and the
roadmap draws time rather than scope.

The scenario is the part that decides the design: trying a scope change must not write
anything until it is committed, which means the view holds a proposed membership beside the
real one and says clearly which is on screen.

**The view's own entry point is the list of releases, not one release.** With none picked it
draws every release the results hold, and picking one opens that release's screen — the five
features that describe a single release are the detail half of an index, not a screen the
user arrives at by magic. Which release is open is view state, per device and per saved view,
the same as the mode and the focus level ([[Settings scoped to their view]]) and for the same
reason: it is a working position, never a `.base` setting.

## Why it was called planning, and is not

The epic transcribed a source document that stopped at the plan: compose a release, size it,
judge it ready. Everything a team does *at* the release — putting work in it, shipping it,
writing up what shipped, and looking at the one after it — had no home, and a plan nothing
ever closes is a plan that quietly accumulates. The survey behind that judgement is on
2026-08-21: Jira's version has a release action, an unresolved-work prompt and generated
notes; YouTrack, Azure DevOps and GitHub all draft notes from the items; every one of them
opens on a hub of releases rather than on one. This epic is the whole of that, and the name
is the promise.

## A release is not a milestone, and both stay

The register already has a `Milestone`: a date owned by nobody, holding nothing, counting for
nothing, hanging from nothing ([[Milestones]]). A release is the other half of that question —
it **holds** scope, work points at it, and it has numbers of its own. Keeping both is
deliberate: "the date we promised" and "the set of things going out" are different facts, and
a vault that only wants the first still gets it without configuring a release.

They meet on the roadmap, where a release may draw as a marker the same way a milestone does,
and nowhere else. Neither is a rung: work names its release in a property, exactly as it
names an objective or a dependency.

## Definition of done, for anything under this epic

- Membership is one property naming a release note. **Membership is never duplicated** —
  nothing is copied into the release note to say what is in it, and a generated artifact is
  an export the view writes and never reads back.
- Every number states its unit and where it came from; unestimated work is reported, never
  treated as zero. Nothing derived is persisted: progress, utilization and slip are
  recomputed on every read.
- A scenario writes nothing until it is applied, and applying it is one gated, undoable
  batch.
- Readiness is a checklist a vault configures, and it refuses nothing.
- **A record is never written over a plan.** The date a release actually shipped is a
  different key from the date it was aimed at, exactly as [[Product Roadmap]] keeps planned
  dates apart from transition stamps — so a release that slipped can still say by how much.

## What this epic will not do

- **Schedule.** No critical path, no resource leveling, no calendar arithmetic beyond the
  dates the notes already carry.
- **Estimate.** It reports the estimates the items hold and names the ones that hold none.
- **Chart history.** No release burndown, no scope-change-over-time. Both need a record of
  what the scope was on a past day, and nothing in this plugin keeps one — a chart drawn from
  the present state would be a shape the view invented. [[Throughput over time]] is where the
  question of measuring across time is owned, and it answers it from the stamps items already
  carry rather than from a scope this view would have to remember.
