---
type: Issue
order: 230
parent: "[[Codebase health]]"
status: Open
priority: P3
area: design
created: 2026-08-25
source: whole-branch review of claude/release-creation-and-tree-exit — recorded rather than restructured, on the reviewer's own instruction
files:
  - src/domain/model.ts
  - src/domain/roadmap.ts
  - src/view/projection.ts
  - src/view/interactions/labels.ts
  - src/domain/itemTypes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A release is refused in five places

## The accumulation

"A `Release` is not drawn on this screen" is now stated five times in `src/`, and each
statement was argued on its own merits in the increment that added it. Three of the five
cannot be reached any more, and no single one of them is wrong enough to delete on its own —
which is the shape this note exists to own, because the argument otherwise gets had again
file by file, one reviewer at a time.

The one that made the other four redundant is `inPlan` (`src/domain/model.ts`), which since
2026-08-24 refuses a release outright. Every projection of the backlog view narrows to the
plan, so that one line takes a release off all of them.

The five, and what each still buys:

1. **`inPlan`** — live, and the one every other statement now sits behind.
2. **`byProjectionType`** (`src/view/projection.ts`) — live. It withholds the TYPE from
   every creation surface, which is a different question from whether a row is drawn: a
   `New` menu, a `Set type` and the focus picker each fail differently, and none of them is
   asking `inPlan` about an item.
3. **`projectionMember`'s `onThisRoadmap` term** (`src/view/projection.ts`) — unreachable.
   Its own comment already says so and states why it is kept: it is the ROADMAP's statement
   of its own population rather than a restatement of the plan's, and
   [[A release on the dated axis]] is one increment from making the two part company.
4. **`canPlaceHorizon`'s `!isReleaseType`** (`src/domain/roadmap.ts`) — unreachable behind
   the same narrowing.
5. **`honouredFocusLevel`'s `projection` parameter** (`src/view/projection.ts`) — read by
   nothing. The answer stopped varying by projection when `inPlan` widened, and on
   2026-08-25 the branch that consumed the variation went with it (`setProjection`,
   `src/view/viewStateController.ts`, whose rebuild arm could not be taken). One caller is
   left and it passes `this.projection` into a parameter nobody reads.

A sixth statement is adjacent rather than one of the five and is recorded here so the next
reader does not count it as a fourth dead one: `mayHoldField(…, 'release', …)`
(`src/domain/itemTypes.ts`) refuses a `Release` through `!isMarkerType`, which is dead at
`canSetRelease`'s call site (behind the `inPlan` beside it) and LIVE at the writing end,
where `refusesLiveType` (`src/storage/frontmatter.ts`) asks it with a type name and no item
to put an `inPlan` question to.

## Why it is not restructured now

The branch this was found on is one round from being pushed, and a restructuring touches
the predicate every projection reads. Each of the three dead statements is individually
defensible — 3 explicitly so, with a named increment that would revive it — so the decision
is not "delete three lines" but "does the roadmap keep a population statement of its own",
which is a design question and not a review fix.

What this note buys is that the question is OWNED. The failure mode without it is the one
this repository has already met on the projection predicate: a rule stated in several places
and argued afresh at each of them, with no note saying which copy is the authority.

## What would settle it

Either of two decisions, and the second follows the first:

- **Does the roadmap state its own population?** If yes, 3 stays and its comment is already
  the record. If no, 3 and 4 both go, and `onThisRoadmap` goes with them.
- **Does `honouredFocusLevel` answer per projection?** It does not today and has one caller.
  Removing the parameter is a two-file edit; keeping it costs an argument that has now been
  had twice. Whichever is chosen, the answer belongs in that function's own docstring, which
  is where a reader with the question arrives.

Neither is blocked on anything. Both are cheap, and both are cheaper than the third review
that re-derives this list.
