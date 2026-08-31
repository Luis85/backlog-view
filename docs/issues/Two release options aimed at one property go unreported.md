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
iteration: ""
---

# Two release options aimed at one property go unreported

## The limitation

Every property option this view declares is an independent picker — `getReleaseViewOptions`
(`src/domain/releaseOptions.ts`) is the list, and no number is written here because three
notes in this repository once stated three different ones — and **nothing stops two of them
naming one key.** The worst pairing is the membership property and the
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
keys aimed at one property make three figures report one value, and the membership key
aimed at the order or parent key reports every ranked or parented item as unresolved. Two
more joined the list on 2026-08-25 with the band and are not milder than the rest. The
released-date key aimed at the target-date key makes every release report as shipped the
day it is created, with a zero-day slip. And the STATE property — declared here since the
band, and resolved onto `BacklogSettings.stateKey` rather than onto `ReleaseSettings` —
aimed at the membership key is the worst pairing above by another route, since the state is
read of every work item too.

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
these keys together. `declaredPropertyKeys` beside it now COLLECTS them — that is what
`runReleaseInit` seeds its "already taken" set from, so the ✨ path can no longer CREATE
this collision — but it collects keys and not roles, so it can say a key is spoken for and
not which two options speak for it. Reporting is still the missing half.

## What would lift it

**The mechanism already exists and should not be re-derived.** `configProblems`
(`src/domain/settingsConsistency.ts`) detects exactly this class for the backlog view's
options: it walks `ownedProperties(settings)` collecting every `{ role, key }` pair into a
`Map<key, OwnedRole[]>`, skips the workflow-state roles that may legitimately share a key,
and reports any key carrying more than one role — as message FRAGMENTS, never a joined
sentence, so `t` puts them in one in the catalog's own grammar.

What is missing for this view is not that algorithm but the two surfaces around it: a role
vocabulary for this view's own options to be collected under, and somewhere to SAY the
result. The backlog view says it in a toolbar chip and in the refusal that gates a write;
this view has neither, so the answer is most likely an empty state naming which two options
collide, drawn instead of the index. Designing that is the work, and it is why this is
deferred rather than patched: a guard with nowhere to speak is a silent refusal, which is
the failure this note is about wearing different clothes.

## Narrowed, 2026-08-30 — the worst pairing is reported; the rest is reported only at a write

Two of the three things this note said were missing now exist, and the note is narrowed
rather than closed because the third does not.

**The role vocabulary exists.** `ReleaseNoteRole` and `releaseOwnedProperties`
(`src/domain/settingsConsistency.ts`) are this view's options collected as `{ role, key }`
pairs, and `releaseNoteProblems` reports any key carrying more than one role — the same
algorithm `configProblems` runs for the backlog view, not re-derived.

**The worst pairing has somewhere to speak.** The membership key aimed at the type key —
the one that reports essentially every typed item as unresolved, every member count `0` and
every scope empty — is `membershipCollision`, which as of today scans the plan's properties
AND this view's own, and is drawn beside the unresolved count in `drawUnresolved`
(`src/view/release/renderIndex.ts`). That is a report and not the empty state this note
proposed: [[A membership key aimed at a release's own property]] ruled on the shape while
closing, and ruled the other way for a stated reason — an empty state drawn instead of the
index puts the whole screen behind one mis-binding, while the count that is already wrong
goes on being wrong with nothing explaining it. The register is followed here, not this
paragraph.

**What is still unreported is narrower, and is the reason this stays open.** A collision
between two RELEASE-NOTE keys — the version and the target date on one property, say — is
detected by `releaseNoteProblems`, but that function is this view's `writeProblems`: it
refuses a batch and says so *at the moment of an edit*. Nothing draws it on the index or on
a release's header, so a reader who only looks sees three figures reporting one value and no
line saying why. The surface is what is missing, exactly as this note said; only its worst
case has since been given one.

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
