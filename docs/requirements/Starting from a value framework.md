---
type: PBI
parent: "[[Presets for the known frameworks]]"
order: 20
status: Open
created: 2026-08-22
source: interview, 2026-08-22 — the epic's presets split into an indicator half and this one
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

# Starting from a value framework

**As** a team that already scores against a value framework, **I want** to pick its name
and get the value model configured, **so that** starting with this view costs a minute
rather than an afternoon of transcribing dimensions and weights.

This is the value half of the presets feature. [[Starting from a known framework]] ships
the indicator half — RICE, ICE, WSJF, value over effort, each a shape over named operands
— and leaves this half open. A **value** preset configures the weighted value model
itself: which dimensions exist, each one's weight, its range. WSJF's own cost-of-delay
dimensions — business value, time criticality and risk reduction, summed — arrive as part
of this PBI, so the WSJF indicator preset the sibling PBI ships can read a real
cost-of-delay figure through the value model's own output rather than standing in for one
with the plain weighted value.

Picking a value preset changes the model that produces the stored total, which is not true
of an indicator preset: applying one can turn every stored total on the base foreign, so
the reader has to be told the count before committing to it —
[[Knowing what a model change invalidated]].

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a value preset from the estimation view's preset picker |
| **Preconditions** | The view is on a saved base whose config can be written |
| **Guarantee** | The preview names every dimension the change adds and drops and every weight it changes, before anything is written, and states how many stored totals the change would turn foreign before the apply control is offered. |

**Main flow**

1. The user opens the preset list; a value preset is marked apart from an indicator one.
2. The user picks one. Nothing is written yet.
3. The preview draws: the dimensions added and dropped, and each surviving dimension's
   weight before and after.
4. The preview reports the count of stored totals the change would turn foreign
   ([[Knowing what a model change invalidated]]).
5. The user applies. The view config is written as one act, and the table redraws.

**Extensions**

- **3a — a dimension's suggested key is already bound to something else in the vault.**
  The preview says so rather than silently overwriting the binding; applying is still the
  user's decision, the same rule the indicator half already states for a hand-edited model.
- **4a — no stored total matches the model's current fingerprint.** The count is zero and
  is still shown, for the same reason a zero indicator-invalidation count is shown.
- **5a — the user cancels at the preview.** Nothing is written, and the count computed for
  the preview is discarded with it.

## Acceptance criteria

- Every preset declares its kind, and a value preset's own apply writes only the value
  model's keys — never the indicator keys [[Starting from a known framework]] owns.
- The preview names every dimension added and dropped, and every surviving dimension's
  weight before and after, before anything is written.
- The preview states the count of stored totals the change would turn foreign, through the
  one function [[Knowing what a model change invalidated]] specifies — no second count
  computed here.
- Cancelling at the preview writes nothing.
- WSJF's cost-of-delay dimensions ship as part of this PBI, so the WSJF indicator preset
  can read a real cost-of-delay sum rather than the plain weighted value standing in for
  one.

## Where it lives

The value presets are entries in `src/domain/estimationPresets.ts` beside the indicator
ones, each carrying its own dimension list and weights rather than an indicator's operands
and divisor. The picker in `src/ui/estimationPresetDialog.ts` and the rows assembled in
`src/view/estimation/presets.ts` grow the per-kind preview this PBI needs — the dimension
diff beside the operand/formula preview the indicator half already draws. The invalidation
count is read from [[Knowing what a model change invalidated]]'s own function in
`src/domain/weightedScore.ts` rather than computed again here.

Depends on [[Knowing what a model change invalidated]], which this PBI is the first
surface to actually need: the indicator half's own count is always zero by construction.
