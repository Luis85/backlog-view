---
type: Test case
order: 50
parent: "[[Smoke test the message catalog]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-22
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The estimation view's refusals end as sentences

A verification to run.

## Why this exists

`estimation.problems.blocked` lost its terminal period to a merge and was given it back on
2026-08-22. That is a one-character defect no gate here can see: the problems it names are
fragments, and whether the sentence closes is a fact about the frame around them.

The diagnosis behind the fix is worth keeping, because it is the reason this is a check
rather than a glance: four of the five `modelProblems` outputs were already lowercase
fragments before the merge, so the merge made the set consistent — the frame's own comment,
transplanted from the readme command, had claimed each problem was a whole sentence and was
never true here.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with the estimation view (`product-estimation`) open on a
base.

## How to check

In the estimation view's options, point **one** slot at another slot's property, so the model
has a problem — confidence at `note.effort` is the shortest. **Write down the slot's own
binding before you change it** (`confidenceProperty: note.confidence`), because that exact
value is what the teardown has to put back.

- **The view itself draws a problem block, and that block REPLACES the table** — `render()`
  returns through `renderProblems` before it creates the grid or the table at all
  (`src/view/estimation/estimationView.ts`). An absent table here is the intended layout,
  not a failure. The block is one lead line, then each problem as its own list item, then
  the setup button.
- **The notice** — press the guided setup and read the refusal
  (`estimation.problems.blocked`). It should **end in a full stop**, with the problems it
  names reading as fragments inside one sentence rather than as sentences run together.

**Then put the slot bindings back, before running anything else.** The collision is saved in
the `.base`, and the very early return this case is built on is what makes leaving it
expensive: while it stands the estimation view draws no table, toolbar or panel at all — so
`Smoke test the estimation view's UX polish in a live vault`, in the appearance suite at
order 40, has nothing to look at.

**Restore the exact binding written down at the start, not merely a distinct one.** Any
unowned property clears the collision and brings the table back, so "it works again" is not
evidence the fixture is intact: that case reads real rows in every currency treatment off
this `.base`, and a slot pointed at some other property scores them differently while the
tracked file stays modified. Then confirm the table comes back.

## Acceptance criteria

- The block's lead, list and button seen with the table deliberately absent.
- The notice's terminal period confirmed on screen rather than in the catalog.
- The slot restored to its own recorded binding — not just to something that clears the
  collision — and the table back, so the appearance suite reads the scores it expects.
- Nothing yet checked.
