---
type: PBI
parent: "[[Presets for the known frameworks]]"
order: 10
status: Open
created: 2026-08-17
source: interview, 2026-08-17
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Starting from a known framework

**As** a team that already prioritizes with RICE, **I want** to pick that name and get a
configured model, **so that** starting with this view costs a minute rather than an
afternoon of transcribing weights.

Two kinds of preset, and conflating them would break the epic's central rule. A **value**
preset configures the weighted value model. An **indicator** preset — RICE, ICE, WSJF,
value over effort — divides by effort or job size or multiplies by confidence, so it
configures one of the labelled indicators that sit *beside* the business value and never
the value itself. An indicator is a shape with named operands, never an expression somebody
types: a product of named operands, divided by one named operand, the divisor optional.

Picking one shows what it would change before it changes anything.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a preset from the estimation view |
| **Preconditions** | The view is on a saved base whose config can be written |
| **Guarantee** | A preset changes nothing outside this view's own configuration, and the number written to a note stays the value-only total. No preset makes the stored figure absorb effort, confidence or job size. |

**Main flow**

1. The user opens the preset list. Each entry says which kind it is.
2. The user picks one. Nothing is written yet.
3. The preview draws: for a value preset, the dimensions added and dropped and each weight
   before and after; for an indicator preset, the operands and the divisor.
4. The preview says how many stored totals the change would turn foreign
   ([[Knowing what a model change invalidated]]).
5. The user applies. The view config is written as one act, and the table redraws.

**Extensions**

- **2a — the preset is an indicator.** The value model is left alone and the preview says
  so. Only the value model's formula is stamped, so an indicator preset invalidates
  nothing and its count is zero by construction — reported as unchanged rather than as a
  bare zero.
- **3a — the model has been edited by hand.** The preview is the whole answer: it shows
  what would be overwritten, and applying is the user's decision. A preset that refused a
  tuned model would be useless exactly where somebody wants to try one.
- **5a — an operand's dimension is unanswered on an item.** That item gets no figure for
  the indicator — reported as not computable, with the operand named — and keeps its place
  in any list, sorted with the unmeasured rather than at one end.
- **5b — the divisor is zero or below on an item.** No figure, for the same reason. Zero is
  not a large indicator, and a negative one inverts the ranking silently; both are the same
  failure as scoring an unanswered dimension at its lowest point.
- **5c — the user later edits an operand.** Swapping an operand or dropping the divisor is
  what "editable afterwards" means. There is no arithmetic to type, so there is no operator
  precedence to define and no way for two implementations to disagree about a preset.
- **5d — the user cancels at the preview.** Nothing is written. The preview is computed
  from a candidate model, so no option has been set to produce it.

## Acceptance criteria

- Every preset declares its kind, and an indicator preset leaves the value model
  untouched — asserted, not documented.
- The preview names dimensions added and dropped, and each weight before and after, before
  anything is written.
- An indicator is stored as named operands and an optional divisor — never as an
  expression string, and nothing parses one.
- RICE, ICE, WSJF and value over effort are each expressible by choosing operands. A form
  that this shape cannot express is a reason to reconsider the shape, not to grow a parser.
- An operand with no answer, and a divisor of zero or below, each produce no figure for
  that item, name the operand, and leave the item sorted with the unmeasured.
- An indicator persists nothing: no note is written by configuring or computing one, and no
  stamp records its formula.
- Cancelling at the preview writes nothing.
- The number written back to a note after applying any preset is still the value-only
  total.

## Where it lives

The preset data is a sibling of `src/domain/defaultModel.ts` — shipped configurations as
data rather than catalog text, for the same reason the rubric sentences are: two locales
must not configure two models.

The indicator's own shape — named operands and an optional divisor, and the two ways it can
have no figure — belongs in `src/domain/scoringModel.ts` beside the model it sits next to,
and is computed on read like every other derivation in
`src/domain/weightedScore.ts`; nothing about it reaches
`src/domain/estimationWritePlan.ts`, which is the mechanical statement that an indicator
persists nothing. The indicator draws beside the existing derived lines in
`src/view/estimation/panel.ts` and takes a column in
`src/view/estimation/renderTable.ts`, sorting with the unmeasured last exactly as an
unanswered value already does.

The picker and its preview are a dialog under `src/ui/`, sharing the invalidation count
with [[Editing a dimension's scale]] rather than computing one of its own.

Tests: `test/domain/scoringModel.test.ts` for the operand shape and its two no-figure
cases, `test/view/estimation/sort.test.ts` for where an uncomputable indicator sorts, and a
view test for the preview and for cancel writing nothing.
