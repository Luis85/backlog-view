---
type: PBI
parent: "[[The scoring model is configuration]]"
order: 30
status: Open
created: 2026-08-17
source: interview, 2026-08-17 — the epic's open question 3, answered rather than delegated onward
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Knowing what a model change invalidated

**As** the person about to change a weight, a range or a rubric sentence, **I want** to be
told how many stored totals that change turns foreign, **so that** I find out before I do
it rather than by scrolling a currency column afterwards.

The stamp already makes this answerable: every stored total records the fingerprint of the
model that produced it, and the view already reads all of them to draw the table. What is
missing is one count, and the three places that change the model saying it.

**This counts and reports. It writes nothing, and it re-estimates nothing.** A
re-estimation is a write per note, so it is a separate decision the epic has not made yet;
what this delivers is the sentence a reader needs to make it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Changing anything the model fingerprint covers — a weight, a range, a direction, a rubric sentence, the dimension list, the output range, or the property a dimension reads |
| **Guarantee** | A model change never invalidates a stored total silently. The reader is told the count before the change where a dialog can ask, and immediately after it where the view options cannot. |
| **Preconditions** | The model resolves without problems, and both the value and stamp properties are bound |

**Main flow**

1. The user opens a dialog that changes the model — the scale editor
   ([[Editing a dimension's scale]]) or a preset ([[Starting from a known framework]]).
2. The dialog computes the fingerprint the change *would* produce, without setting
   anything.
3. It counts the results whose stored stamp matches the current fingerprint and would not
   match the new one — the totals about to read `Another model`.
4. It reports that count beside the change, before the apply control.
5. The user applies, and the table's currency column agrees with the count that was
   reported.

**Extensions**

- **1a — the change is made in the view options instead.** A Bases options box cannot host
  a confirm, so the report comes after: the view draws a banner naming how many stored
  totals now read `Another model`. It is a report, not a prompt, and it says that undo does
  not reach it — a view option is a `.base` setting, not a vault write, so there is nothing
  in the undo slot to take back.
- **3a — no stored total matches the current fingerprint.** The count is zero and is still
  shown. Zero is the answer somebody wanted, and hiding it makes its absence ambiguous.
- **3b — the change touches nothing the fingerprint covers.** An indicator formula, a
  column sort, a label the fingerprint does not read. The count is zero by construction and
  the surface says the value model is unchanged rather than printing a bare `0`.
- **3c — a stored total is already stale, foreign, hand-written or orphaned.** It is not
  counted. The count is about what this change is going to do, and a total that is already
  not current is not something this change breaks.
- **4a — the user cancels.** Nothing is written and the count is discarded. The count is
  computed from a candidate fingerprint, so nothing has been changed to produce it.

## Acceptance criteria

- One function answers "how many stored totals would this candidate model turn foreign",
  and all three surfaces call it — no surface computes its own count.
- The count excludes totals that are already stale, foreign, hand-written or orphaned.
- A candidate fingerprint is computed without setting any option.
- The scale editor and the preset preview show the count before their apply control;
  cancelling writes nothing.
- A model change made in the view options draws the banner afterwards, naming the count
  and saying that undo does not reach a settings change.
- A change that touches nothing the fingerprint covers reports the value model as
  unchanged.
- The count the surface reported and the currency words the table draws after the change
  agree — one test drives a real change end to end and compares them.

## Where it lives

`src/domain/weightedScore.ts` gains the count: it already owns `modelFingerprint`,
`parseStamp` and `currencyOf`, so the question "which of these stored stamps would this
candidate model orphan" is arithmetic over a model and a set of items, with no vault and no
DOM in it. `src/domain/estimationItems.ts` (`buildEstimationModel`) already supplies the
items and their stored stamps, read one cache read per note. The banner is drawn by
`src/view/estimation/estimationView.ts` beside the table; the two dialogs read the same
count through their own callers.

The candidate model is resolved the way `src/view/estimation/init.ts` already resolves the
one its bindings would produce — a config reader answering from a pending map — rather than
by setting an option and reading it back.

Tests: `test/domain/weightedScore.test.ts` for the count, and a view test driving a real
model change and comparing the reported count against the currency words that follow it.
