---
type: PBI
parent: "[[A rubric for every point]]"
order: 20
status: Open
created: 2026-08-17
source: interview, 2026-08-17 — the feature's open half, the editing surface
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

# Editing a dimension's scale

**As** a team whose "4" means something different from the shipped sentence, **I want** to
edit the range and its meanings in one place, **so that** the scale I score against is
ours without hand-editing a `.base` file.

A dialog opened from the dimension's own row: the range, and one sentence per point of it.
**The range comes with it** — the feature already says a range is not editable in
isolation, and leaving it in the view options while the sentences moved to a dialog would
mean widening a range in one surface and finding the consequence in another. So the range
text box leaves the view options and this dialog owns the whole scale. It is still a
`.base` setting; the dialog writes the view config exactly as the options box did.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the scale editor from a dimension's row on the panel |
| **Preconditions** | The model resolves without problems, and the dimension has a bound property |
| **Guarantee** | A scale is never left half-defined. Widening the range and writing the meanings of the new points is one act, so an incomplete model never reaches the `.base`; and no sentence anybody wrote is deleted by a range change. |

**Main flow**

1. The user opens the scale editor from the dimension's row.
2. The dialog draws the range as two bounds, and one text box per point, each holding its
   current sentence.
3. The user edits a sentence.
4. The dialog reports how many stored totals this change would turn foreign
   ([[Knowing what a model change invalidated]]).
5. The user applies. The view config is written, the panel redraws with the new sentences,
   and the currency column agrees with the count that was reported.

**Extensions**

- **2a — a point has no sentence.** The box is empty and marked as needed. This is the
  state a range widened in an earlier round left behind, and the dialog is where it is
  resolved.
- **3a — the range is widened.** New boxes appear, empty and marked as needed, and apply is
  refused until they are written. Widening and writing the meanings is one act, which is
  the whole reason the range moved into this dialog.
- **3b — the range is narrowed.** The sentences for the points nobody can pick any more are
  kept, not deleted — a rubric somebody wrote is not the plugin's to remove — and the
  dialog says they are stranded so the user can see what a re-widening would restore.
- **3c — the range is not increasing whole integers.** Refused in the dialog, in the same
  words `modelProblems` uses, rather than saved and reported afterwards.
- **4a — the change touches no sentence and no bound the fingerprint reads.** The count is
  zero and the dialog says the value model is unchanged.
- **5a — the user cancels.** Nothing is written: no config key, no note, no sentence.
  Every box in the dialog is a candidate until apply.
- **5b — notes hold a score outside the narrowed range.** They are not rewritten. The
  panel already reports a clamped stored value on its own row
  ([[Scoring an item against its rubric]] 2a), and a dialog that silently rescored notes
  would be the write nobody asked for that this epic refuses everywhere else.

## Acceptance criteria

- The dialog holds the range and one box per point, with the current sentence in each.
- Widening adds boxes marked as needed and refuses apply until they hold something.
- Narrowing keeps the stranded sentences and says which they are.
- An illegal range is refused in the dialog, in the same words the config warning uses.
- Cancel writes nothing at all.
- Apply writes the view config only — no note is touched, and no score is rescaled.
- The range text box is gone from the view options: one surface owns a scale.
- The invalidation count is shown before apply, and the currency column after apply agrees
  with it.

## Where it lives

A new dialog under `src/ui/`, which is the leaf of reusable Obsidian dialogs that knows
about none of the layers — so it collects and returns, and the view is what writes. The row
that opens it is `src/view/estimation/panel.ts`'s `renderScoreRow`, which already draws the
per-row controls and already knows the dimension's id.

The rules it enforces are already written down and are reused rather than restated:
`src/domain/scoringModel.ts` (`modelProblems` for the range rules, and the rubric-coverage
report a widened range produces) and `src/domain/estimationSettings.ts`
(`dimOption`, the option-key format a rubric sentence is stored under, which is a persisted
contract). `src/domain/estimationOptions.ts` loses the dimension's range box.

Tests: `test/domain/scoringModel.test.ts` for the range and rubric rules,
`test/domain/estimationOptions.test.ts` for the box that left, and a view test for the
dialog — what it draws for a widened and a narrowed range, and that cancel writes nothing.
