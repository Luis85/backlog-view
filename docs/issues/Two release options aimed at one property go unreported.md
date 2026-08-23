---
type: Issue
order: 120
parent: "[[A view per capability]]"
status: Open
priority: P2
area: design
created: 2026-08-23
source: Codex review of the release-management increment PR, verified at source 2026-08-23
files:
  - src/domain/releases.ts
  - src/domain/releaseOptions.ts
  - src/domain/settingsConsistency.ts
  - src/view/release/releaseView.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Two release options aimed at one property go unreported

## The limitation

The release view's seven options are seven independent property pickers, and **nothing
stops two of them naming one key.** The worst pairing is the membership property and the
type property, because both are read of every row rather than of one:
`membershipTarget` (`src/domain/releases.ts`) reads the membership key off each scannable
row, so with the two aimed at one property it reads every work item's own TYPE — `PBI`,
`Feature`, `Task` — as that item's release reference.

The consequence is exact and it is silent. `readString` returns the type name, so the
value is neither absent nor unreadable; the row is plan work, so the eligibility guard
passes; `getFirstLinkpathDest` then resolves `PBI` to no note, so every one of them comes
back `UNRESOLVED`. The index therefore reports **essentially every typed item in the base
as an unresolved membership**, and every release's member count is `0` with every scope
screen empty — while the two options that collide are named nowhere on screen. A reader
sees a plugin that has lost their data, not a configuration they can fix.

The other pairings are milder and are the same defect: the version, target-date and status
keys aimed at one property make three columns report one value, and the membership key
aimed at the order or parent key reports every ranked or parented item as unresolved.

## Why it is silent

There is no `configProblems`-equivalent for this view **because this view writes nothing**.
That gate is a WRITE gate — `applySafely` (`src/view/writeGate.ts`) refuses a batch while
its `writeProblems` callback answers anything, and the backlog view binds that callback to
`configProblems` (`src/view/backlogView.ts`) while its toolbar chip renders the same list.
A read-only view has no batch to refuse, so it never needed one and never grew one:
the absence is a consequence of the increment being read-only rather than a check somebody
forgot to call.

`resolveReleaseSettings` (`src/domain/releaseOptions.ts`) resolves each key on its own and
compares none of them, which is correct for what it does. Nothing downstream of it looks at
the seven keys together.

## What would lift it

**The mechanism already exists and should not be re-derived.** `configProblems`
(`src/domain/settingsConsistency.ts`) detects exactly this class for the backlog view's
options: it walks `ownedProperties(settings)` collecting every `{ role, key }` pair into a
`Map<key, OwnedRole[]>`, skips the workflow-state roles that may legitimately share a key,
and reports any key carrying more than one role — as message FRAGMENTS, never a joined
sentence, so `t` puts them in one in the catalog's own grammar.

What is missing for this view is not that algorithm but the two surfaces around it: a role
vocabulary for the seven release options to be collected under, and somewhere to SAY the
result. The backlog view says it in a toolbar chip and in the refusal that gates a write;
this view has neither, so the answer is most likely an empty state naming which two options
collide, drawn instead of the index. Designing that is the work, and it is why this is
deferred rather than patched: a guard with nowhere to speak is a silent refusal, which is
the failure this note is about wearing different clothes.

## Impact

Reaching the worst state needs one deliberate act — picking the same property for the
membership option that the type option already holds — so it is not on an ordinary path.
The cost when it happens is the whole view reading as broken with no explanation on screen,
which is severe, and the exit is one property picker away with nothing pointing at it.

It writes nothing, so no note is damaged and no undo is spent: the damage is entirely to
what the reader is told.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. If it is
taken up, it comes with the question of where a read-only view reports a configuration
problem at all — which the estimation view answers with `modelProblems` and its own
`renderProblems` screen, and which is the closer precedent than the toolbar chip.
