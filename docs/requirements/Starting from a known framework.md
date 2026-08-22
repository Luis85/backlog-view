---
type: PBI
parent: "[[Presets for the known frameworks]]"
order: 10
status: Done
created: 2026-08-17
source: interview, 2026-08-17
started: ""
finished: 2026-08-22
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

This PBI ships the **indicator** half of the presets feature: RICE, ICE, WSJF and value
over effort, each a shape with named operands, divided by one named operand, the divisor
optional — never an expression somebody types. The **value** half, which configures the
weighted value model itself, is [[Starting from a value framework]].

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

The preset data is `src/domain/estimationPresets.ts`, data beside `src/domain/defaultModel.ts`
for the same reason the rubric sentences are data. The indicator's own shape is in
`src/domain/scoringModel.ts` and its arithmetic in `src/domain/weightedScore.ts`; it is
resolved from the view options by `src/domain/estimationSettings.ts` and offered by
`src/domain/estimationOptions.ts`, computed per item in `src/domain/estimationItems.ts`,
and drawn by `src/view/estimation/renderTable.ts` and `src/view/estimation/panel.ts`.
The picker is `src/ui/estimationPresetDialog.ts`, over rows assembled by
`src/view/estimation/presets.ts` — `ui/` knows about no layer, so the dialog takes plain
rows and hands back the id that was picked.

An operand can fail to produce a figure four ways, not two — unanswered, an unknown id,
a nonpositive divisor, and **unbound** (a scale with no property bound to it at all, whose
repair is binding one in the view options rather than scoring the note) — and the panel and
the column share one reason-to-message mapping (`INDICATOR_BLOCK_KEYS` in
`src/view/estimation/panel.ts`) so the two surfaces cannot drift apart on what a block says.
Six operand ids are reserved (`INDICATOR_BUILTINS` in `scoringModel.ts`) and win over a
same-named dimension, so a vault that declares one is never shadowed by a preset's own use
of the name.

Tests: `test/domain/indicator.test.ts` for the operand shape and its four no-figure cases,
`test/view/estimation/indicatorColumn.test.ts` for the column and where an uncomputable
indicator sorts, `test/view/estimation/indicatorBlockAgreement.test.ts` for the panel and
the column agreeing about a block, and `test/view/estimation/presets.test.ts` for the
dialog's preview and for cancel writing nothing.
