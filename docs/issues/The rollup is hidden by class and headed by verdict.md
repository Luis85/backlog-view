---
type: Issue
parent: "[[Property columns]]"
order: 20
status: Done
priority: P3
area: design
created: 2026-08-09
closed: 2026-09-02
source: implementation of ADR 0023; noticed while making the header ask the fit rather than the configuration
files:
  - src/view/render/columns.ts
  - src/view/renderPass.ts
  - src/view/resize.ts
  - src/view/CLAUDE.md
  - styles/propertyColumns.css
  - styles/cards.css
  - test/view/columns.test.ts
  - test/view/risk.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The rollup is hidden by class and headed by verdict

A decision taken.

## The decision

[ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md) replaced the
`pbl-hide-*` ladder with a count, so a column the pane cannot hold is not rendered at
all. The rollup did not follow, and the two halves of it now answer different questions:

- **The rows** draw it from the CONFIGURATION. `renderRollup` creates `.pbl-meta-col`
  whenever `settings.stateKey` or `settings.showCounts` is set, and `syncColumnFit`
  toggles `pbl-hide-meta` on the view element to take it away again.
- **The header** asks the VERDICT. `renderColumnHeader` gates its rollup label on
  `ctx.host.columnFit?.rollupDropped`, and draws no header bar at all when there are
  neither columns nor a rollup left to name.

Both are in `src/view/render/columns.ts`. The asymmetry was left in place rather than
resolved, and this note is here so the next reader finds a decision instead of deriving
one.

## Why

Because it cannot disagree visibly, and the mechanism it keeps is not the one the ADR
argued against.

`columnFit` returns `rollupDropped` only when `shown` is 0, so a hidden rollup implies an
empty column slice, and an empty slice with no rollup is exactly the case the header
returns early on. There is no width at which the bar names a rollup the rows are hiding.
And the reason the ADR gives for not clipping does not apply here: `pbl-hide-meta` is
`display: none` (`styles/propertyColumns.css`), which takes the box out of the
accessibility tree, and the rollup contains no control in the first place — it is a
progress bar or a count.

What is left is one concept with two mechanisms behind it, which is the shape a later
change gets wrong. It is a cost, not a defect.

## What a real fix would look like

Two candidates, and choosing between them is the work this note is asking for:

- **Push the rollup into the count.** Make it the last entry of the resolved list with a
  kind of its own, so one number decides every trailing cell and `pbl-hide-meta` goes
  with the other four. It is the tidiest end state and the largest change: the rollup is
  not a Bases property, so it has no id, no display name and no place in `getOrder()` —
  the list would stop being "what the properties menu declares" and become "that, plus
  one".
- **Give the rows the verdict too.** Have `renderRollup` take the same
  `columnFit.rollupDropped` the header reads and render nothing rather than a hidden box,
  deleting the class. Small, and it makes the rule uniform.
  **It is cheaper than this note first priced it.** The cost claimed here was that a card
  projection would lose its way of turning the rollup back on — clearing a class rather
  than carrying a tree verdict onto a frame that has none. That does not hold:
  `src/view/backlogView.ts` already calls `setColumnFit(null)` on entering any non-tree
  projection, and it does so BEFORE the content renders, so a card frame reads
  `host.columnFit?.rollupDropped` as `undefined` and a verdict-reading `renderRollup`
  draws. The card side needs nothing added; what the change actually costs is the
  `pbl-hide-meta` line in `styles/propertyColumns.css` and the `removeClass` beside that
  reset. Which of the two candidates to take is still open — this corrects the price, not
  the choice.

## Chosen, 2026-09-02 — the rows got the verdict

The second candidate, at the price this note last corrected it to and no more.
`renderRollup` now returns before creating `.pbl-meta-col` when
`host.columnFit?.rollupDropped` — the same value `renderColumnHeader` has always read — so
the rollup drops the way a column does, by not being rendered, and one concept has one
mechanism.

### What it cost, measured rather than predicted

Four deletions and one substitution, which is what the corrected price said it would be:

- `.pbl-view.pbl-hide-meta .pbl-meta-col` in `styles/propertyColumns.css`.
- `els.viewEl.removeClass('pbl-hide-meta')` in `src/view/renderPass.ts`. The
  `setColumnFit(null)` beside it stays and now does both halves: it runs BEFORE the
  content renders, so a card frame reads `undefined` and draws.
- `viewEl.toggleClass(...)` in `syncColumnFit`, which took the `viewEl` PARAMETER with it —
  the function had no other use for it, so `resize.ts` and two tests lost an argument.
- The board and roadmap override in `styles/cards.css`
  (`.pbl-view.pbl-board-mode .pbl-card .pbl-meta-col { display: flex }`), which existed
  only to out-rank the deleted `display: none`. This note did not price it, because it
  named the rule to delete and not the rule that was there to defend against it — the
  second was found by grepping `meta-col` across `styles/` rather than by reading either.
- `syncColumnFit`'s CHANGE test moved from `viewEl.hasClass('pbl-hide-meta')` to
  `ctx.host.columnFit?.rollupDropped ?? false`, read before `setColumnFit` overwrites it.
  The comment beside it asserts the equivalence rather than the mechanism: the class was
  a record of what the last pass DREW, and since the rows draw from the stored verdict,
  the pre-update verdict is that same record.

The first candidate — pushing the rollup into the resolved column list — is refused
again, on this note's own reasoning: the rollup is not a Bases property, so it has no id,
no display name and no place in `getOrder()`, and the list would stop being "what the
properties menu declares".

### The checks, and which mechanism was watched failing

- **The gate.** Reverting `renderRollup`'s new condition to `if (!report) return;` turns
  two tests in `test/view/columns.test.ts` red — "drops columns from the end of the order,
  keeping the rollup to the last" and "hands a card projection the whole column list,
  whatever the tree last measured" — both with
  `expected <div class="pbl-meta-col"></div> to be null`. Watched, then restored.
- **The change test.** Dropping the `rollupDropped` term from `syncColumnFit`'s `changed`
  turns two red — the same first one, plus "draws no header bar at a width where the
  columns and the rollup have both gone" — so the reconciling pass the verdict buys is
  checked, not merely described. Watched over the whole of `test/view` (2 failed, 2473
  passed), then restored.
- The two remaining `pbl-hide-meta` assertions — one in `risk.test.ts`, one horizon-column
  case in `columns.test.ts` — assert BOTH forms now: `view.columnFit?.rollupDropped` is
  false and the row still draws a `.pbl-meta-col`. The verdict was written first, on the
  assumption that those fixtures configure no rollup and a DOM assertion would be vacuous
  there. **That assumption was wrong and was checked rather than trusted**: adding the DOM
  assertion turned neither test red, so both fixtures do draw a rollup and the stronger
  form was available all along. Kept side by side — the verdict can never be vacuous, and
  the DOM is what would catch the two drifting apart again.

### What is left

Nothing here. `.pbl-hide-meta` survives only in `docs/superpowers/` plans and specs, which
are records of what was decided in August and are correct as records.

## Acceptance criteria

- ~~One of the two above is chosen, or the asymmetry is re-affirmed.~~ The second was
  chosen.
- ~~The rows and the header keep reading ONE stored verdict (`host.columnFit`).~~ Both read
  `columnFit.rollupDropped`; nothing else decides whether a rollup is drawn.
