---
type: PBI
parent: "[[The horizon board for stakeholders]]"
order: 40
status: Done
priority: ""
created: 2026-10-18
source: user request
started: 2026-10-18
finished: 2026-10-18
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# Signals on a horizon card

**As** a stakeholder reading the horizon board, **I want** a card to say when it is
blocked, risky or important, **so that** I can see what needs a word in Now, Next and
Later without opening each note.

These are the iteration card's signals ([[Signals on an iteration card]]) without Overdue.
A horizon is a confidence bucket, not a date, so lateness is the dated axis's question. The
same change fixes four accessibility defects an audit found on this board.

## Use case

| | |
| --- | --- |
| **Actor** | A stakeholder or the backlog owner reading the roadmap |
| **Trigger** | The roadmap draws the horizon axis |
| **Preconditions** | A horizon property and its values are configured |
| **Guarantee** | A signal is text: no control, no tab stop, no write. `cardSignalSet` is the one gate; the dated and resources axes draw none. |

**Main flow**

1. For each card the horizon board draws — in a bucket or on the shelf — the view asks
   which signals apply.
2. **Blocked**, **risk** and **priority** draw as on the iteration card, in that order.
3. **Overdue** never draws on this axis, whatever the target date says.

**Extensions**

- **1a — the card is a context card, or reads as Resolved.** No signals, the iteration
  card's rule.
- **1b — the roadmap draws the dated or the resources axis.** No signals: those items are
  timeline rows, not cards.

## Accessibility fixes

- An undeclared bucket's tooltip sits on its stray mark, not on the bucket group. In
  Obsidian `setTooltip` writes `aria-label`, so on the group it replaced the group's name.
  The group label now says "not a declared horizon" itself, as a whole sentence per case.
- The pane carries hidden keyboard instructions on the horizon axis
  (`aria-describedby`), like the board's. The grid axes carry none yet.
- A card in a bucket names its bucket in `aria-description` — never `aria-label`, which
  would replace the card's content-derived name. A context card's description says both
  facts in one sentence.
- The stray mark is `--text-muted` rather than `--text-faint`, and the bucket's New button
  fade turns off under reduced motion.

## Acceptance criteria

- A bucket card draws Blocked, risk and priority, and no Overdue past its target.
- The dated axis draws no signal row on any card.
- An undeclared bucket's group label says it is not declared, folded or not; the tooltip
  is on the stray mark and not on the group.
- The pane is described by the horizon instructions on the horizon axis and by nothing on
  the dated axis.
- A bucket card's `aria-description` names its bucket; it has no `aria-label`.
- The reduced-motion block names the New button at a specificity that beats
  `styles/roadmap.css`, which loads after `styles/motion.css`.

**Checked by** `test/view/horizonSignals.test.ts` — "draws blocked, risk and priority on a bucket card, and no overdue"

**Checked by** `test/view/horizonSignals.test.ts` — "draws none on the dated axis, whose items are timeline rows"

**Checked by** `test/view/horizonA11y.test.ts` — "says it is not declared in the group label and puts the tooltip on the stray mark"

**Checked by** `test/view/horizonA11y.test.ts` — "describes the pane with its keyboard instructions, on the horizon axis only"

**Checked by** `test/view/horizonA11y.test.ts` — "names a card’s bucket as its description, not its label"

The jsdom mock's `setTooltip` writes `data-tooltip` only. Making it write `aria-label`
like Obsidian's turned 30 tests in 21 files red, so it was left as it is; what a screen
reader says on this board is still a live-vault check.

## Where it lives

`cardSignalSet` in `src/view/projection.ts` says which signals each projection draws;
`renderCardBody` in `src/view/render/board.ts` asks it and calls `renderCardSignals` in
`src/view/render/cardSignals.ts`, which skips Overdue when told to. `renderBucket` in
`src/view/render/roadmap.ts` carries the group label, the stray mark's tooltip and the
card's bucket description; `renderPaneInstructions` in `src/view/render/board.ts` draws the
instructions for both boards. The styles are in `styles/roadmap.css` and
`styles/motion.css`. ADR 0027's second 2026-10-18 amendment records the decision.
