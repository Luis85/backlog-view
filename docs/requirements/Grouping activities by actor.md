---
type: PBI
parent: "[[The map draws]]"
order: 30
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
priority: ""
iteration: ""
---

# Grouping activities by actor

**As** someone presenting to a stakeholder, **I want** the activities grouped under the person
who does them, **so that** the map answers who this is for before it answers what it does.

The users row is the observed values of one property on the use cases — the same shape the
board uses to derive its columns from the states it actually sees, and for the same reason: a
vocabulary the vault demonstrates beats a vocabulary the plugin declares.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the map |
| **Trigger** | The map drawing its users row |
| **Preconditions** | The actor property is configured |
| **Guarantee** | Every activity on the map appears under exactly one user band, and the bands are the values the base's own results carry — never a value read from a note the base excluded. |

**Main flow**

1. The view reads the actor property of each use case on the map.
2. It collects the distinct values, in the activities' own left-to-right order of first
   appearance.
3. It draws one user band per value, spanning the columns of the activities that carry it.

**Extensions**

- **1a — the actor property is not configured.** The users row is absent, and the map draws
  activities and steps. The row is not drawn empty.
- **1b — an activity carries no actor.** It groups under an unnamed band, drawn last and
  counted, so the omission is visible rather than hidden by an invented default.
- **2a — a context row carries an actor value.** That value does not join the vocabulary: an
  excluded note's property is not this base's vocabulary and must not become assignable to
  results.
- **3a — activities with the same actor are not adjacent.** The band draws once per contiguous
  run rather than stretching across an unrelated activity, and the runs carry the same label.

## Acceptance criteria

- With the actor property unconfigured, no users row is rendered at all — absent, not empty.
- The band vocabulary is derived from result rows only; a fixture with a context row carrying
  a unique actor value does not gain a band for it.
- An activity with no actor appears under a counted unnamed band, and the count matches the
  number of such activities.
- Two non-adjacent runs of the same actor draw as two bands with one label, not as one band
  covering what sits between them.

## Where it lives

The band vocabulary is derived in this epic's projection module in `src/domain/`, following
`observedStates` in `src/domain/board.ts` — the same shape and the same exclusion, since an
excluded note's property is not this base's vocabulary. The property key joins
`src/domain/optionalProperties.ts` and `src/domain/viewOptions.ts`. Drawing the bands follows
`src/view/render/lanes.ts`, which already spans a group across columns.
