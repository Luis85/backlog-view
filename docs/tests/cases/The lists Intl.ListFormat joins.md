---
type: Test case
order: 20
parent: "[[Smoke test the message catalog]]"
status: Open
priority: P2
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

# The lists Intl.ListFormat joins

A verification to run.

## Why this exists

`list()` in `src/i18n/t.ts` replaced fixed separators, so three items now read `A, B, and C`
where they read `A, B, C`. That is one of the few things in this epic that genuinely changed
in **English**, and nobody has seen any of the three surfaces it changed.

The reason this needs a written procedure rather than a glance is that only one of the three
is ordinary visible text. The other two were named in the suite as though a tester could
look at them, which they cannot — found in review on PR #189.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

**The visible one.** Point a `.base` at a folder whose notes carry none of the optional
properties, so several are unnamed, and press the toolbar's ✨. The outcome notice names
the properties it adopted, and those fragments are joined by `list()`
(`runInit` in `src/view/interactions/structure.ts`). With three or more adopted it should
read `…, … , and …` and close as one sentence.

**The one that needs a conflict.** On the dated axis, give one row three or more
prerequisites and make at least one of them **conflict** (a prerequisite that ends after
this row starts) **or break** (a link to a note that does not exist). Only then does
`renderTimelineRow` attach the joined `Waits for …` to the lead cell as a tooltip — with
three ordinary valid dependencies there is no tooltip at all, and the text lives solely in
a visually hidden span. Hover the lead cell and read the joining.

**The one that is not visible at all.** A resource's absences are joined into the lane
head's `aria-description` on the resources axis (`lane.unavailable`). There is no pointer
route to it: use a screen reader, or the browser inspector's accessibility pane, on a
resource with three or more absences.

On each: check the joining, the spacing, and that none runs a full stop into a conjunction.

## Acceptance criteria

- All three joins read, each by the route that actually reaches it.
- Nothing yet checked.
