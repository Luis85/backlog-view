---
type: Test case
order: 20
parent: "[[Smoke test the estimation indicator]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-22
source: the indicator presets and open-note increment, 2026-08-22
files:
  - src/ui/estimationPresetDialog.ts
  - src/view/estimation/presets.ts
  - src/view/estimation/toolbar.ts
  - src/domain/estimationPresets.ts
  - styles/estimationPresets.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the preset picker in a live vault

**Covers** [[Starting from a known framework]].

## Why this exists

This is a **whole dialog no human has seen**. It was built against jsdom and the harness,
and the harness's modal is Obsidian's own element *minus the container, title and content
rules the vendored sheet never kept* — which is precisely the set of rules that decide
whether a dialog fits. Two of its behaviours are Obsidian's rather than ours: where the
modal caps its own height, and whether it calls `onClose` on every dismissal path. Both
are assumed by code that ships.

**Preconditions** — as [[Smoke test the indicator column in a live vault]], plus: the
estimation view's toolbar is visible (it does not draw in the guided-empty or
config-warning states, so the Base must be configured enough to score).

## How to check

- **Does the list scroll, and do the buttons stay put?** `.pbl-est-preset-list` is meant
  to be the only scroller, so Apply and Cancel stay above the fold. That was reasoned
  against the harness stub, not against Obsidian's `.modal` height cap. Open the dialog in
  a **short window** — shrink Obsidian vertically until something has to give — and
  confirm the four rows scroll inside the list while the buttons remain reachable. If the
  whole content block scrolls instead, `min-height: 0` is not doing what the partial
  claims.
- **The preview is drawn only once something is picked.** Open the dialog and confirm
  there is no reserved empty block above the buttons; pick a preset and confirm the
  preview appears with `Indicator now` and `Indicator after`.
- **Cancel writes nothing.** Pick a preset, press Cancel, and confirm the `.base` file on
  disk is unchanged — check the file, not the screen.
- **Apply writes exactly three keys.** Pick RICE, Apply, and inspect the `.base`:
  `indicatorLabel`, `indicatorOperands`, `indicatorDivisor` and nothing else. Confirm no
  note gained frontmatter — configuring an indicator writes to no note, and the undo slot
  must be exactly as it was.
- **Focus after Apply.** This is the one to be careful with. Applying refreshes the view,
  which redraws the toolbar and **detaches the button that opened the dialog**. Open the
  dialog *from the keyboard*, pick a preset with Enter or Space, Apply, and confirm focus
  lands on the rebuilt presets button rather than on `<body>`. Then do the same for
  **Cancel** and for **Escape** — the test double calls `onClose` from `close()`, and
  whether the real modal does so on all three paths is an assumption this dialog rests on.
- **`aria-pressed` under a real screen reader.** Move through the four rows and confirm
  the selected one is announced as pressed and the previously selected one is announced as
  no longer pressed. jsdom can only see the attribute; whether it is *announced* is what
  this item asks.
- **The kind is stated once.** Confirm there is one sentence saying these configure the
  indicator beside the business value and that the value model is unchanged — and that no
  per-row chip repeats it four times.
- **Each row reads.** All four presets must show a name, a description and a formula, and
  ICE and WSJF must also show their note. An **empty description on any row** means an
  id-to-catalog-key mapping is wrong — `value-over-effort` is the one whose kebab id does
  not match its camelCase key, so check that row specifically even though a test pins it.
- **The formula against a customised model.** Rename a dimension (say `Reach` to something
  else) and reopen the dialog: RICE's formula should show the new label, because the
  formula is composed from this model's own vocabulary. If it shows a raw id, an operand
  stopped resolving.
- **The toolbar button.** Confirm the `calculator` icon renders in the shipped Obsidian's
  Lucide set, sits correctly beside sparkles and undo, and that its tooltip reads.

## What the harness answered ahead of the walk

The dialog draws, all four rows render with their descriptions and formulas, the preview
appears on pick, and Obsidian's **default** colours are correct — observed 2026-08-22 in
headless Chromium at 1200×820. What the harness cannot answer is everything above that
depends on Obsidian's own modal rules, on real focus behaviour, or on a screen reader:
the vendored sheet in `test/harness/theme.css` deliberately does not carry `.modal`'s
container, title and content rules.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| — | the indicator presets and open-note increment (2026-08-22) | **Not run.** |

## Acceptance criteria

- Every item above checked in a live vault, in both light and dark themes.
- The three dismissal paths (Apply, Cancel, Escape) each checked for focus separately —
  they are three code paths, not one.
- Anything adjusted lands in `styles/estimationPresets.css` or the dialog itself, not in
  a caller working around it.

---

## Outcome

Not yet run. **This is a checklist to re-run, not a record.** It reopens with the next
change to the dialog, its stylesheet partial, or the preset data.
