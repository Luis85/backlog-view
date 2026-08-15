---
type: Feature
parent: "[[Product Roadmap]]"
order: 0
status: Open
created: 2026-08-08
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Dependencies

One item must come before another, said on the note that waits and drawn on the axis that
shows when. A user-named list property holds the prerequisites, the dated timeline draws
an arrow between the two bars, a plan whose dates contradict its own ordering is marked
as the contradiction it is — and the link is made from the menu or by dragging between
bars, through the same gate and the same undo as every other write here.

**Outcome** — The ordering a plan already has in someone's head is stated on the notes
and visible on the timeline, and a date that violates it is visible too — without the
view ever moving a bar to make the picture agree with itself.

## Use cases

- [[Dependencies as a property]] — what a dependency is, how it is read, and what a
  broken one does.
- [[Arrows between bars]] — the drawing on the dated axis, and the conflict it makes
  visible.
- [[Linking two items]] — the menu path that adds and removes one.
- [[Draw a dependency between bars]] — the Gantt gesture, over the same write.

## Why this is not the data model the epic refused

[[Product Roadmap]] put dependency arrows out of scope, and [[Bars from two dates]]
extension 2b recorded the same refusal a second time, both with the same reason: *the
schema has no dependency field, and drawing one would need the new data model this epic
deliberately is not.* Both said they were written down so the question would be
**re-decided knowingly rather than rediscovered**. This feature is that re-decision, on
2026-08-08, and what changed is not the appetite for a data model — it is that a
dependency turns out not to need one.

Everything a dependency requires now exists and is used by something else:

| What it needs | What already supplies it |
| --- | --- |
| A user-named optional property | The horizon, state, date and tag keys — [[View options and config warnings]] |
| A link resolved against the item set | `parent` — [[Parent, order and type properties]] |
| Damage marked rather than repaired | [[Broken links still render]] |
| A write that can be taken back | [[Safe writes]], [[Undo and redo]] |
| One move, several inputs | [[Moving between horizons]]'s rule, applied to a third gesture |

So the shape here is *one more property*, not a second graph beside the tree. The one
thing that genuinely is new is the edge itself — `parent` is a link to exactly one note,
and a prerequisite list is a link to several — and that is a read rule in one module,
not a model.

The other half of the epic's out-of-scope paragraph is untouched and still stands: a
computed health signal is not built, for the reason it gives.

## What this feature will not do

**It never moves a bar.** A dependency here is a fact the notes state and the view draws;
auto-scheduling — dragging a predecessor and having its dependents' dates rewritten
underneath — is refused, and refused on the epic's own rule rather than on effort:
*display inference is never written back*, and *what lands in frontmatter is what a user
did, on the note they did it to*. A cascade would write dates to notes the user never
touched, on evidence that is a drawing. What it does instead is make the contradiction
visible ([[Arrows between bars]]), which is the information a reader needs and the
decision they get to make.

**It marks damage in one place.** A prerequisite can be stated from a tree row, a board
card or a bucket card ([[Linking two items]]), and a broken one is *shown* only on the
dated timeline ([[Arrows between bars]]) or by opening Remove dependency… — the fact is
reachable everywhere and visible in one projection. Badging the other three is three
display decisions inside notes that own those rows, and no one has asked for them; what is
refused here is the promise, not the feature, so this stays a named gap rather than a
guarantee nothing keeps.

**It has one kind of edge.** Finish-to-start, the only one every surveyed tracker draws
by default. Start-to-start, finish-to-finish and lags are a vocabulary on the edge, and
nothing here has asked for one.

**It rolls up nothing.** A parent does not inherit its children's prerequisites. Spans
roll up ([[Spans roll up the tree]]) because a parent's dates are genuinely evidence
about the parent; an ordering between two children is a fact about those two, and a
parent drawn as depending on something none of its own work waits for would be an arrow
nobody drew.
