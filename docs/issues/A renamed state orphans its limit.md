---
type: Issue
parent: "[[WIP limits]]"
order: 10
status: Open
priority: P3
area: design
created: 2026-08-02
source: implementation of the per-column agreements increment
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A renamed state orphans its limit

## The limitation

A WIP limit and a column policy are persisted under keys built from the state's own
name — `wipLimit.<state>` and `columnPolicy.<state>`, lowercased. Rename a state in
"Workflow states (in order)" and both values stay in the `.base` under the old name,
while the renamed state comes back unlimited and with nothing written on it. Nothing
reports it: the old keys are simply never read again.

## Why it is deliberate

Bases options are declarative. The schema hands Bases a list of keys and Bases reads
and writes them; there is no rename hook, and no point at which this plugin is told
that `stateValues` went from `In review` to `Reviewing` rather than from two states to
two different ones. A resolver that tried to infer it would be guessing, and guessing
wrong means silently attaching one column's agreement to another.

Keying by **position** instead — `wipLimit.2` — survives a rename and breaks on the
commoner edit: reordering the workflow, or inserting a state, would shuffle every
limit onto the wrong column, and quietly, which is worse than losing one visibly.

## What would lift it

An option-rename hook in the Bases API — something that reports the old and new value
of a text option — would make the migration a few lines. Failing that, an explicit
"rename a state" action in the view that rewrites both keys as it rewrites the list.
That is a different feature and would need its own use case.

## Impact

One re-typed number and one re-typed sentence per renamed state. Losing a policy is
the more annoying half; losing a limit at least announces itself the next time the
column fills up.
