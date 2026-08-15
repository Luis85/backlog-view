---
type: Issue
parent: "[[Resizable property columns]]"
order: 10
status: Open
priority: P3
area: design
created: 2026-08-14
source: Codex review on PR
files:
  - src/view/render/toolbarControls.ts
  - src/view/render/toolbarFit.ts
  - src/view/render/toolbarBusy.ts
  - src/view/render/toolbarFilter.ts
  - src/view/interactions/stateColors.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The view reads the main window's document

Obsidian can draw a leaf in a **pop-out window**, and a view drawn there lives in that
window's document. The global `document` is still the main window's, so any question asked
of the global about an element in a pop-out is answered about the wrong document — and,
for a focus comparison, answered `false` every time rather than noisily.

Found on the property columns' resize grip, which asked
`document.activeElement === grip` to decide whether to hand focus to the grip's
replacement after a resize. In a pop-out that is never true, so a keyboard reader stepping
a column would be dropped to the body after the first press — the exact defect the check
exists to prevent, reappearing for one class of window.

## What was fixed, and what was not

Both resize grips now ask `grip.ownerDocument.activeElement`
(`src/view/interactions/columnResize.ts`, `src/view/interactions/timelineLeadResize.ts`).
That is the feature the finding arrived on, and its lead-column twin, which had the same
line for the same reason.

**Five other places in `view/` still ask the global**, and they were left alone
deliberately rather than swept in a pull request about column widths:

| Where | What it asks |
| --- | --- |
| `render/toolbarControls.ts` | which control had focus before a rebuild |
| `render/toolbarFit.ts` | the same, before a fit step drops a control |
| `render/toolbarBusy.ts` | whether the busy indicator's box contains the focus |
| `render/toolbarFilter.ts` | whether the filter input is the focused element |
| `interactions/stateColors.ts` | `document.body`, for a probe element it measures a theme colour on |

The first four are the identical defect: in a pop-out the answer is `false`, focus is not
restored, and the reader is dropped to the body. The fifth is a different shape — a probe
appended to the main window's body would be measured against the main window's theme,
which is the same theme, so it is a wrong question with a right answer until something
makes the two windows differ.

## Why this is a note rather than a swept fix

Two reasons, and the second is the one that decides it.

A mechanical swap is available for all five, and it is not the whole fix: the rule wanted
is *nothing in `view/` asks the global document*, which is a category, and a category is
checked at the forbidden thing rather than by converting the places somebody happened to
find. That is a `no-restricted-globals` rule plus the conversions, and it wants its own
pass — including a decision about `stateColors.ts`, whose `document.body` is not a focus
question at all.

And **none of it can be verified here**. The jsdom harness has exactly one document, so it
cannot tell `document.activeElement` from `ownerDocument.activeElement`; every one of these
conversions would land with its own behaviour unchecked and its claim resting on reading.
A live-vault check in a pop-out window is what would confirm any of it, and that check does
not exist yet.

## What to do about it

Add a live-vault case first — open a base in a pop-out window, tab to a toolbar control,
trigger the rebuild that destroys it, and see where focus lands — so the sweep has
something to be right against. Then the lint rule and the five conversions in one pass.
