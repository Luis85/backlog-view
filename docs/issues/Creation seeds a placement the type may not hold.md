---
type: Issue
order: 100
parent: "[[Creating items]]"
status: Open
priority: P3
area: limitation
created: 2026-08-22
source: review of the release-management first increment, task 1 — narrowed rather than widened, by ruling
files:
  - src/storage/createNote.ts
  - src/view/interactions/create.ts
  - src/domain/itemTypes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Creation seeds a placement the type may not hold

## The limitation

Two surfaces seed a placement onto a note they are creating, so that the note is never
momentarily one whose frontmatter contradicts the thing that made it: a bucket header's
`+` seeds that bucket's horizon, and an iteration board's `+` seeds that sprint's `start`
and `target` through `iterationOf`. Both arrive at one loop in `createBacklogItem`, over
`axisEntries`.

That loop asks nothing about the TYPE except one question: is this a `Release`. So a
`Milestone` created on an iteration board is written the sprint's **`start`** — a key
`placementEnds` answers `['target']` for, which is to say a key this plugin will never
write to a milestone again, never offer a control over, and which the generated README
describes to the reader as *"ignored — never rewritten, and never removed"*.

The note is not corrupt and nothing downstream misreads it: `placeMarker` ignores the
start exactly as it ignores a hand-written one, the timeline draws the milestone at its
target, and the date chip for the start end is withheld. What is wrong is narrower and
still real — the plugin wrote, unasked, a value it documents itself as never writing, and
left no affordance to take it away.

The same shape holds for the horizon in reverse: a marker CAN hold one (the bucket axis
places a milestone like any other row), so that half is correct as it stands.

## Why it is deliberate

The obvious fix is to make the guard rule-shaped rather than name-shaped — ask
`placementEnds(spec.typeName, settings.iterationBars)` which ends this type speaks and
drop the ones it does not, so `Milestone` is covered by the same sentence as `Release` and
the next type is covered by arriving. That was proposed in review and **refused for this
increment**: it changes the creation behaviour of a **shipped** type inside a task whose
subject is a type that does not exist yet.

It is the same reason the marker parent edge was left alone rather than corrected in
`linkAll` on this branch. A release is new, so refusing it anything costs no user a
behaviour they have. A milestone is not, and somebody's vault may have milestones created
on a sprint board carrying a start today; changing what the next one gets is a decision
that deserves its own change, its own note and its own line in the changelog, rather than
riding in on a branch nobody would think to look in for it.

What was done instead is the narrower half of the same rule: the comment at
`createBacklogItem` now claims exactly what the check performs — a `Release` is seeded
nothing — rather than the wider "a placement the type may not hold", which the code did
not deliver. *Write the guarantee to the check, never ahead of it.*

## What would lift it

There is now one place to make that decision. `mayHoldField` (`src/domain/itemTypes.ts`)
answers "may a note of this type hold this optional property", and every door a planning
key reaches a note through asks it: the writer's TOCTOU refusal, the ✨ backfill's stubs at
both the planner and the writer. It is name-shaped for the same ruling recorded above —
only a `Release` is asked — and the settings are a parameter so that the rule-shaped body
needs no call site to change. Creation is the one door that does NOT ask it yet: it still
spells `isReleaseType` in `createBacklogItem`, which is exactly the narrowing this note is
about, so option 1 below is that body plus routing the creation seed through it.

**The widened body is not "delete the `isReleaseType` line".** An `Iteration`'s own two
dates are that note's DEFINITION rather than a placement in somebody's plan, and
`placementEnds` answers `['target']` for an iteration whose bars are off — so a body that
asked the placement rule of every type would make an iteration's `start` unholdable and
refuse the iteration dialog's own save (`axisFrom` in `view/interactions/create.ts` states
no `ends`, which is precisely the shape the writer's live-type refusal sees). The
iteration has to be excluded before the placement rule is asked:

```ts
export function mayHoldField(typeName: string | null, field: OptionalField, settings: BacklogSettings): boolean {
	// An iteration's own dates and goal are what the note IS, not where it sits.
	if (isIterationType(typeName)) return true;
	if (field === 'start' || field === 'target') return placementEnds(typeName, settings.iterationBars).includes(field);
	// The two link-shaped fields, from the rule `canSetIteration` already applies in the UI.
	if (field === 'iteration' || field === 'iterationGoal') return !isMarkerType(typeName);
	// A marker CAN hold a horizon — the bucket axis places a milestone like any other row.
	return true;
}
```

Still one site and no call site moves, which is what the parameter list was shaped for —
but four lines and one exclusion, not one line. Whoever takes this up should run
`test/view/iterationDialog.test.ts` first and watch it, because that suite is what the
naive version breaks.

Two ways out, and they are not equivalent:

1. **Derive the seed from `placementEnds`.** One filter in `createBacklogItem`, covering
   every type at once, and the `isReleaseType` special case disappears into it. The whole
   cost is deciding — and stating — that a milestone created on a sprint board no longer
   records that sprint's start. It also raises a question this note does not answer: the
   horizon is not a `PlacementEnd`, so a single predicate has to span two vocabularies or
   stay two clauses.
2. **Withhold the offer instead**, the way `renderBucketNew` withholds the bucket `+` for a
   type that cannot occupy a bucket. That is the conservative reading — the note is never
   created from a surface whose placement it cannot take — but it removes a creation path
   people use, so it is the larger behaviour change of the two despite touching less.

Either way the pair belongs together: the offer and the write are separate guards today
([[Releases as their own type]] task 1), and nothing forces them to agree.

## Impact

Reaching it needs an iteration board, a sprint in scope, and a deliberate choice to create
a `Milestone` there rather than a card. The result is one extra frontmatter key on one
note, invisible on every screen and harmless to every reader — so this is a
tidiness-and-honesty defect, not a data one. It is recorded because the comment beside the
code used to claim it did not happen.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly. If it is taken up, decide (1) or
(2) explicitly rather than reaching for whichever is nearer, and say in the changelog that
the key is no longer written.
