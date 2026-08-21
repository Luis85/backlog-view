# Estimation view — polish pass (2026-08-21)

No new capability. Nine defects in what the estimation view already ships: one reported
from a vault, five from the code review of `claude/plugin-refactor-brainstorm-av0s6j`,
three found while auditing that view against
`docs/requirements/Reading the estimation table at a glance.md`.

Grouped by what has to happen first, not by severity: the two layout items are looked at
in the harness before their CSS is written, because neither can be seen from jsdom.

## A — The clear control overlaps the last point

**Reported from a vault, 2026-08-21.** The `x` at the end of a dimension's point buttons
draws over the button beside it.

**Root cause, two faults in one rule.** `.pbl-est-clear` is
`position: absolute; inset-inline-end: 0` and the `position: relative` box it resolves
against is `.pbl-est-dim-head` (`styles/estimationPanel.css`). An absolute inset resolves
to the containing block's **padding** box, so the `padding-inline-end: var(--size-4-5)`
that head reserves — whose own comment says it "holds the clear control's gutter open" —
sits empty *outside* the button, and the button lands inside the content area over the
last point. Second: 20px was never the button's width anyway. `.clickable-icon` in
app.css is `padding: var(--size-2-2) var(--size-2-3)` (4px 6px) around a `--icon-s` 16px
glyph, so the control is about 28px.

**Fix.** Move `position: relative` from `.pbl-est-dim-head` to `.pbl-est-dim`. That row
carries `padding-block` only, so its padding box's inline-end edge is the head's
border-box edge and `inset-inline-end: 0` lands in the gutter the head reserves. Widen
that gutter from `var(--size-4-5)` to the control's real width. `top: 0` still resolves to
the row's padding box, which begins where the head begins, so the control keeps its
corner.

**Scope of the root cause.** Every other `inset-inline-end: 0` / `right: 0` in `styles/`
was read: the two in `timeline.css` / `timelineFurniture.css` are full-bleed overlays with
no reserved gutter, so nothing else in the stylesheet holds this mistake.

**Check.** `test/view/estimation/styleRules.test.ts` asserts which selector carries
`position: relative` — `.pbl-est-dim`, and not `.pbl-est-dim-head` — and that the head's
reserved gutter is not narrower than the control it reserves for. jsdom lays nothing out,
so that is the whole of what a test can reach here; the appearance itself is answered in
`npm run harness` and owed a live-vault look.

## B — The five review findings

### B1 — `currencyOf` calls a hand-typed total an orphan and offers to delete it

`src/domain/weightedScore.ts` checks `item.result === null` (→ `orphan`) before
`item.storedStamp === null` (→ `handwritten`). `computeTotal` returns `null` at
`answered === 0`, so a note carrying a hand-typed value property and no dimension answers
reads *Inputs gone* and is offered the orphan cleanup, which removes what a person typed.
`docs/requirements/Business value estimation.md` is explicit: "an absent one means it was
written by hand or by something else."

**Fix.** The `storedStamp === null` test moves above the `result === null` test. `orphan`
then means what its own comment claims — a **stamped** total whose inputs are gone.

**Check.** `test/domain/weightedScore.test.ts` gains the combination that is absent today:
a stored total, no stamp, no answers → `handwritten`. Watched failing before the move.

### B2 — `runEstimationInit` can bind 13 properties and stub none

`src/view/estimation/init.ts` writes every pending binding to the `.base` and *then* calls
`applySafely`, whose lock refusal can reject the whole backfill: the configuration changed
and no note gained a key. `docs/requirements/Binding the estimation properties.md` states
the all-or-nothing guarantee, and the module's own ordering comment states the rule it
breaks. Reachable now that the guided empty state's button carries no `pbl-est-init`
class, so `syncEstimationToolbar` never disables it while a sibling view writes.

**Fix, two parts.** A `view.gate.writing` check before the `config.set` loop, with the
same Notice shape the `modelProblems` refusal already uses. There is no `await` between
that check and `applySafely`, and the lock is taken synchronously on entry, so a
synchronous pre-check is airtight rather than a narrowed race. Second, the empty-state
button gains `pbl-est-init`, so the existing sync disables it like the toolbar's own.

**Check.** `test/view/estimation/states.test.ts`: with the lock held, the button writes
nothing and the configuration is untouched. `test/view/estimation/toolbar.test.ts`: the
empty state's button is disabled while `gate.writing`.

### B3 — A sort click drops keyboard focus to `<body>`

`wireSortClick` calls `view.refresh()`, which destroys the header button that was just
activated. Nothing refocuses, so a second `Enter` cannot flip the direction. Every other
rebuild-causing control in this view refocuses (`refocusPick`, `pickAndRefocus`).

**Fix.** After the refresh, focus the rebuilt header by its `data-col` — `refocusPick`'s
shape, read off `dataset` rather than interpolated into a selector, for the same reason
that function states: a column id is a fixed vocabulary here, but the lookup shape stays
the one the codebase already trusts.

**Check.** `test/view/estimation/keyboard.test.ts`: two consecutive `Enter` presses on one
header flip the direction twice. Watched failing.

### B4 — Both undo buttons name a scope the undo slot does not have

`estimation.toolbar.undo` says "Undo last estimation change" and `toolbar.undo` says
"Undo last backlog change". ADR 0030 makes one **vault-wide** undo slot deliberate — a
gate per view would be two views racing with two ideas of what the last batch was — so
the behaviour is right and both labels are wrong.

**Fix.** One key. `toolbar.undo` becomes "Undo last change" and
`estimation.toolbar.undo` is deleted; both toolbars call it. The catalog loses a key
rather than gaining a caveat.

**Check.** `test/i18n/estimation.test.ts` asserts the shared key is what the estimation
toolbar draws.

### B5 — The sort buttons are pruned by assistive technology

`role="listbox"` sits on `.pbl-est-table`, the scroller that holds both the sticky header
and the rows. The six header buttons are therefore non-`option` children of a listbox,
which AT prunes — along with the `aria-sort` beside them, as the code's own comment says.

**Fix.** `.pbl-est-table` keeps the scroll box and drops the role. An inner
`.pbl-est-rows` wrapper takes `role="listbox"`, `tabindex="0"` and
`aria-activedescendant`; the header stays a sticky sibling inside the scroller, so no
column alignment moves and no scrollbar-width mismatch appears. `wireEvents`' own
`evt.target !== tableEl` guard follows the tab stop to the wrapper — the guard exists so
a header button's `Enter` stays its own, and after this change the header is not in the
listbox at all, so the guard is narrower and still correct. `aria-sort` stays: it is the
stylesheet's state hook and what a later move to real `columnheader` roles needs.

**Check.** `test/view/estimation/table.test.ts`: the listbox's children are all
`role="option"`. `test/view/estimation/keyboard.test.ts` re-drives arrow stepping and
`Enter` against the wrapper as the focus holder.

## C — What the audit added

### C1 — A sticky header hides the row the keyboard stepped to

`selectRow` calls `row.scrollIntoView({ block: 'nearest' })` inside a scroller whose
`.pbl-est-head` is `position: sticky`. `nearest` scrolls the row to the container's edge,
which is *under* the header, so an upward step parks the selected row behind it. The panel
has the same shape: `refocusPick`'s `.focus()` scrolls a point button under the sticky
`.pbl-est-header`.

**Fix.** `scroll-margin-block-start` on `.pbl-est-row` and on `.pbl-est-dim`, each equal
to the header that covers it. Two declarations; the same class of layout fault as A, which
is why both are looked at in the harness in one sitting.

**Check.** `test/view/estimation/styleRules.test.ts` asserts each declaration exists and
names the header it answers. Whether the offset is *enough* is a measurement jsdom cannot
make — harness, then a vault.

### C2 — `stale` and `foreign` name a problem and offer no action

The currency vocabulary has four failure words and one button. `orphan` gets the cleanup;
*Needs re-estimation* and *Another model* get nothing, and `writesNothing`
(`domain/estimationWritePlan.ts`) returns `held === value`, so re-picking the held score
writes nothing and does not restamp. The only route out of a stale total is to change a
score and change it back — two writes, and the first one is a value the reader did not
mean.

**Fix.** One planner beside the two that exist: `planRestamp(model, item)` returning
`totalStampSets(model, item, item.result)`, refused unless `item.currency` is `stale` or
`foreign` and `item.result` is non-null — the same guard shape `planOrphanCleanup` states
for its own single currency. The panel offers it where it already offers the orphan
cleanup, through a `view.performRestamp` on `performOrphanCleanup`'s shape (plan, gate,
refresh-unless-flushed). Both controls are mutually exclusive by currency, so the panel
gains a branch, not a second region.

**Check.** `test/view/estimation/scoring.test.ts` (the planners' own suite): refused on `current`,
`handwritten`, `orphan` and `none`; on `stale` it writes the computed total and a fresh
stamp and nothing else. `test/view/estimation/panel.test.ts`: the control is offered on
`stale` and `foreign` only, and picking it goes through the gate.

### C3 — The blocked-init Notice drops every problem after the first

`runEstimationInit` reports `problems[0]` and discards the rest, so a configuration with
two faults is fixed one round trip at a time. `renderProblems` already lists all of them,
so the view holds two ideas of how much to say.

**Fix.** The Notice states the whole list, joined the way the catalog's locale joins a
list — never by string concatenation in the module (root `CLAUDE.md`: the sentence is the
unit of translation, and list joining follows the catalog's locale).

**Check.** `test/view/estimation/states.test.ts`: with two problems, both appear.

## Order of work

1. Harness pass on A and C1 — `npm run harness`, look, then write the CSS.
2. A, then C1 (same partial, same class of fault).
3. B1 (domain, node test), B4 (catalog), B2, B3, B5.
4. C2, then C3.
5. `npm run check`, then `npm run test-build` for the live-vault look A and C1 still owe.

## What this pass does not do

- **No split of `renderTable.ts`.** 490 raw lines, and B3 and B5 add to it, but
  `max-lines` skips comments and it passes. A split is proposed when lint asks for one.
- **No route back from the panel to the table.** `ArrowRight` enters the panel and
  `Shift+Tab` returns to the table's tab stop. A dedicated key would be a new
  interaction, not a refinement.
- **No change to arrow-key writing inside a radiogroup.** Each arrow is a vault write and
  spends the single undo slot. That follows the ARIA radiogroup pattern, and changing it
  (arrow moves, Space commits) is a different design question, not polish.
- **No action on the config-warning state.** It lists problems and offers no button
  because the fix is a decision in the view's own options.

## Register notes this pass owes

- `docs/bugs/` — the clear control's overlap (A), stating the padding-box cause, since it
  shipped and a vault saw it.
- `docs/issues/` — B1 and B2, both being a stated guarantee the code did not keep.
- `docs/requirements/Reading the estimation table at a glance.md` — extended for C1, C2
  and B5, since all three change what that PBI's acceptance criteria promise.
