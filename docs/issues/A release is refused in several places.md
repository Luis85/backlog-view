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
iteration: ""
---

# A release is refused in several places

## The accumulation

"A `Release` is not drawn on this screen" is now stated six times in `src/`, and each
statement was argued on its own merits in the increment that added it. Three of them
cannot be reached any more, and no single one of them is wrong enough to delete on its own —
which is the shape this note exists to own, because the argument otherwise gets had again
file by file, one reviewer at a time.

The one that made the others redundant is `inPlan` (`src/domain/model.ts`), which since
2026-08-24 refuses a release outright. Every projection of the backlog view narrows to the
plan, so that one line takes a release off all of them.

**The title says "several" on purpose.** It said "five" for one day, and the sixth arrived
the same day from a direction none of the five predicted — not a projection refusing to draw
a release, but a VOCABULARY refusing to collect one. A count in a title is a title that goes
stale, which is a rule this repository states about tables and had not yet applied to itself.

The six, and what each still buys:

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

6. **The plan's observed vocabulary** (`src/domain/model.ts`) — live, and the newest. The
   vocabulary is collected from `items.filter(!inCatalog && !isReleaseType)`, because
   `inPlan` taking a release off every projection means a status only a release carries is
   a value no plan row can show — it was being offered when setting a PBI's state and
   printed into the generated README. Reported by review on PR #203 and fixed there.
   **It spells `isReleaseType` rather than asking `inPlan`,** which is the one place in this
   list where the redundancy is deliberate rather than left over: `inPlan` also refuses an
   `Iteration`, whose status has leaked into this same list since long before releases did,
   and sweeping both would drop sprint-only values from work-item menus. Ruled
   releases-only on 2026-08-25 — see the third question below.

A further statement is adjacent rather than one of the six and is recorded here so the next
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

Three decisions. The first two are the original pair, and the second follows the first:

- **Does the roadmap state its own population?** If yes, 3 stays and its comment is already
  the record. If no, 3 and 4 both go, and `onThisRoadmap` goes with them.
- **Is the plan's vocabulary the plan's MEMBERSHIP?** 6 says yes for a release and leaves
  the answer open for an iteration, which is the older half of the same leak. If the rule is
  "a row this base does not draw is not this base's vocabulary" — and the context-row rule
  already says exactly that — then the filter should be `inPlan` and sprint statuses stop
  being offered for work items. If a vault is expected to share one status vocabulary across
  sprints and stories, then it should not, and 6 is right to name the type. This is the only
  one of the three that changes what a user sees.
- **Does `honouredFocusLevel` answer per projection?** It does not today and has one caller.
  Removing the parameter is a two-file edit; keeping it costs an argument that has now been
  had twice. Whichever is chosen, the answer belongs in that function's own docstring, which
  is where a reader with the question arrives.

Neither is blocked on anything. Both are cheap, and both are cheaper than the third review
that re-derives this list.
