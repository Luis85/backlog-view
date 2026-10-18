# The horizon board for stakeholders — design

Date: 2026-10-18. Source: user request ("the same improvement and polishing pass from all
product perspectives for the horizons view. This view should be used for stakeholder
communication: it shall show, on the high level, where the team sets the priority
currently and what to expect"). Research from a product, a UX, an accessibility and an
engineering perspective was done before this spec; the iteration board pass of the same
day (`2026-10-18-iteration-daily-board-design.md`) is the pattern.

## What changes, and what does not

The horizon board keeps its buckets, its shelf, its moves and its keyboard walk. It gains a
**header** that says where the work sits, **progress per bucket**, a **Present / Plan**
switch that takes the editing chrome away for a meeting, **signals** on cards that a
stakeholder asks about, and four accessibility fixes found by the audit.

Kept on purpose: **buckets are placements, never computations** (no date is read as a
horizon, no bucket is derived), **no lanes** ([[Lanes on the roadmap]]), **no computed
health signal** ([[Product Roadmap]]), and **overdue stays off this board** — a
Now-Next-Later roadmap organises by confidence, not calendar.

## 1. The horizons header

Drawn first in the horizons frame, above the shelf, only on the horizon axis.

- **Kicker + heading.** A small uppercase `Roadmap` kicker, then the `h2` `Horizons`.
- **Summary line.** One count per bucket in render order (`Now 5`, `Next 4`, `Later 3`),
  each its own span with a separator span between, then `20 not yet placed` for the shelf
  when the shelf holds any result. Counts are RESULT counts (`bucket.count`, shelf results
  only): the context-row rule.
- **Present / Plan switch.** Two real `<button>`s with `aria-pressed` in a labelled
  `role="group"`, at the header's end; focus moves to the pressed button's replacement after
  the re-render (`renderModeSwitch`'s rule). Chrome, so ordinary tab stops.

## 2. Progress per bucket

Each bucket header gains a thin stacked bar (resolved, in progress) and the text
`2 of 5 done`. Counted with `iterationProgress` over the bucket's RESULT population with
the completed toggle IGNORED — progress is about the plan, not the screen, so hiding
finished work must not read as nothing finished. Membership and focus level still apply.
The bar is `aria-hidden`; the text carries the number. The bar markup is shared with the
iteration header through one helper rather than copied (fallow duplication).

The first bucket (the nearest horizon) carries an accent top border: it is where the
priority is now.

## 3. Present / Plan

`Present` hides the shelf, every bucket's New button and the dashed invitation chips (an
unset assignee) on cards. `Plan` is today's behaviour. Stored per device in the view-state
store as a boolean pref (`horizonPresent`), absent = Plan, so an existing reader sees no
change. UI state, never a `.base` setting (ADR 0011). It HIDES; it does not make the view
read-only — Alt+arrow and the menu still move a card, and the header's summary still
counts what is not yet placed, so the shelf's count is never secret.

## 4. Card signals on the horizon board

`renderCardSignals` draws on the horizon axis too, with **blocked**, **risk** and
**priority** only — no overdue. ADR 0027 gets a second dated amendment.

## 5. Accessibility fixes

- An undeclared bucket's tooltip no longer overwrites the bucket group's `aria-label`: the
  tooltip moves to the stray mark, and the "not declared" fact joins the group label.
- The roadmap pane gets hidden keyboard instructions like the board's
  (`aria-describedby`).
- A card in a bucket carries the bucket's name as `aria-description`, so arrowing from Now
  into Next is announced.
- `.pbl-bucket-stray` uses `--text-muted`; `.pbl-bucket-add` joins the reduced-motion list.

## Testing

Domain (if a pure helper is added), view tests for header, summary, switch persistence,
present hiding, bucket progress with completed hidden, signals on horizons and not overdue,
each a11y fix watched failing first; i18n projections stays green.

Live-vault check owed: header in a real theme, the summary with many buckets, the switch in
a narrow pane, and what a screen reader says for the header inside the `listbox` pane.
