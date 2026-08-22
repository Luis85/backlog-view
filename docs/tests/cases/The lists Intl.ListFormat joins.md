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

**The visible one.** Add a **fresh** `product-backlog` view to a `.base` — a new view, with
none of its optional bindings touched — and press the toolbar's ✨. The outcome notice names
the properties it adopted, and those fragments are joined by `list()`
(`runInit` in `src/view/interactions/structure.ts`). With three or more adopted it should
read `…, …, and …` and close as one sentence.

**Fresh, and that is the whole precondition.** `adoptCandidates` skips a property whose
view OPTION is already set (`config.get(candidate.option) !== undefined`) or whose suggested
key another binding has taken — what the *notes* carry has nothing to do with it. So this
cannot be set up by pointing a configured view at emptier notes: the register's own
`Backlog` view in `docs/Product Backlog.base` has all but four bindings set, and two of the
four suggest `status`, which `stateProperty` already owns — leaving `iteration` and `goal`
and a two-item join that never exercises the path. Found in review on PR #189.

**The one that needs a conflict.** On the dated axis, give one row three or more
prerequisites and make at least one of them **conflict** (a prerequisite that ends after
this row starts) **or break** (a link to a note that does not exist). Only then does
`renderTimelineRow` attach the joined `Waits for …` to the lead cell as a tooltip — with
three ordinary valid dependencies there is no tooltip at all, and the text lives solely in
a visually hidden span. Hover the lead cell and read the joining.

**The one that is not visible at all.** A resource's absences are joined into the lane
head's `aria-description` on the resources axis (`lane.unavailable`). **This repository holds
no absence notes**, so there is nothing to inspect until you make some: on the resources
axis, press the `Add absence for …` control in one resource's row header three times and
record three stretches for that one resource. Then read the lane head's description — there
is no pointer route to it, so use a screen reader or the browser inspector's accessibility
pane.

On each: check the joining, the spacing, and that none runs a full stop into a conjunction.

## Acceptance criteria

- All three joins read, each by the route that actually reaches it.
- Nothing yet checked.
