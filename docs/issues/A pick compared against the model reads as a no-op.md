---
type: Issue
order: 30
parent: "[[The write gate]]"
status: Open
priority: P3
area: design
created: 2026-08-23
source: automated review of PR
files:
  - src/domain/writePlan.ts
  - src/view/interactions/labels.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A pick compared against the model reads as a no-op

## The limitation

Three planners decide "this pick writes nothing" by comparing the target against the
captured `BacklogItem`, which is the model as the row was last rendered:

```ts
if (sameValue(item.horizon.value, value)) return [];                      // computeHorizonWrites
const linkChanges = item.iterationEntry?.file?.path !== target.file.path; // computeIterationWrites
const settled = !item.releaseMultiple && item.releaseEntry?.file?.path === target.file.path;
```

A submenu stays usable across a refresh. So where the note moved from A to B after the menu
opened, a pick of A is planned as an empty batch: nothing is written, nothing is announced,
and the note stays in B. The user's gesture is discarded as redundant against a state that
is no longer true.

It is not one axis's defect. The same three lines are the same decision, and the release
membership joined the pattern rather than introducing it.

## Why it is not fixed here

**The checkmark and the write are one question.** `src/CLAUDE.md` states it: a Set menu's
checkmark is asked of the PLAN — an entry is checked exactly when picking it would write
nothing — because a comparison written beside the plan drifted from it the moment a second
property existed. An empty plan is therefore not an optimization that can be removed on its
own; it is what "this entry is current" means.

**The register already ruled on the class, for the axis it came up on first.**
`src/domain/CLAUDE.md`: *"The horizon axis keeps its model-time check; moving it is not this
increment's."* The dated axis was moved to writer-time decisions in that same increment, and
the reasoning is recorded in
[[planFrom still decides a removal from the model, not the form]] — the planner stops
deciding from the model because the model can be a refresh behind. Two of the three axes
have not made that move, and the release is the third.

**The harm is bounded and visible.** A discarded pick leaves the note where it was and
spends no undo slot; the row redraws showing the membership it actually has. That is the
same shape as re-picking the value a note already holds, which is a legitimate no-op — the
two are indistinguishable from the menu, which is exactly why the fix is a change of source
rather than a guard.

## What a fix would take

One increment over all three planners, not a clause in one:

- give each planner the live reading of the key it compares — the vault, not the item — so
  the plan and the checkmark are both computed against the note as it is now; and
- accept that a checkmark drawn when the submenu OPENS can still be stale by the time it is
  read, because nothing re-renders an open Obsidian menu. Deciding what a checkmark means
  under that is the part that needs a decision rather than code.

Refusing at the write boundary is NOT the fix here, and this is what separates this note
from [[A stale release or iteration target can still be committed]]: there is no write to
refuse. The batch is empty, so `applySafely`, `refusesLiveType` and `refusesLiveMembership`
never see it.

## Acceptance criteria

None; this note records a review finding for a decision, not a scheduled fix.
