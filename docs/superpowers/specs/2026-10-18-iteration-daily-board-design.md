# The iteration board for the daily — design

Date: 2026-10-18. Source: user request ("the iteration meta data such as name and goal must
be more prominent; the iteration board must be usable as the daily ceremony view").
Decisions below were picked by the user from options in the session; the harness mock
(`test/harness/mock.ts`, uncommitted) was reviewed before this spec.

## What changes, and what does not

The iteration board keeps its population, its three buckets, its moves and its shelf. It
gains a **header** that says which sprint this is and how it is going, a **person
spotlight** for walking the board at stand-up, **signals** on cards that need talking about,
and a **Daily / Planning** switch that takes the backlog shelf away during the daily.

Two decisions of the 2026-08-15 iterations design are kept on purpose: **no swimlanes**
(the spotlight walks the people without changing the columns) and **the goal is text, not
a control** (it becomes larger, never editable in place). One is narrowed: that design said
"no burndown, velocity or capacity" — a progress bar of resolved items is none of those,
because it reads the current states only and stores no history.

## 1. The iteration header

Replaces `.pbl-iteration-goal`. Drawn above the shelf and the columns, only on the
iteration board, only for a resolved scope (`host.effectiveScope`).

- **Kicker + name.** A small uppercase `Iteration` label, then the iteration note's title as
  a heading (`h2`). Text only.
- **Goal.** The goal value, large, with an accent rule at its start. No goal (blank value or
  unconfigured goal property) draws no goal line — never a placeholder.
- **Timebox line.** From the iteration's own `start`/`target` (`statedEnds`), against
  `todayCivil()` injected from the view (nothing in `domain/` reads a clock):
  - both ends, today inside: `13 Oct – 26 Oct · Day 6 of 14 · 8 days left`
    (inclusive day count; the last day reads `Last day`);
  - before start: `13 Oct – 26 Oct · Starts in 3 days`;
  - after target: `13 Oct – 26 Oct · Ended 2 days ago`;
  - one end only: that end alone (`Ends 26 Oct` / `Starts 13 Oct`), no day count;
  - no dates: no timebox line.
  Dates are formatted by `formatDate` (`i18n/t.ts`), counts by plural keys.
- **Progress.** A stacked bar (Resolved, In progress, Open) and `4 of 18 resolved`, then the
  three bucket counts. Counted over the board's own **result** cards — the same population
  and the same `bucketOf` the columns use, context rows excluded (the context-row rule). An
  empty iteration draws `0 of 0 resolved` with an empty bar rather than hiding the line,
  because the empty state below already explains the board.
- **Daily / Planning switch.** A two-button segmented control at the header's end, real
  `<button>`s with `aria-pressed`. It is chrome, like the shelf disclosure, so it is a
  normal tab stop.

## 2. Person spotlight ("walk the board")

A row of chips in the header, one per assignee found on the board's result cards, plus
`Unassigned` when any card has none. Each chip: initial avatar, name, card count. Order:
by name, `Unassigned` last.

- Clicking a chip spotlights that person: every column card not theirs gets
  `pbl-spot-dim` (reduced opacity), theirs stay as they are. Clicking the active chip, or
  pressing `Escape` while it has focus, clears it.
- The spotlight is **session state** on the view (a plain field, like `shelfSearch`), never
  stored: a saved view must not reopen onto a dimmed board nobody remembers asking for.
- It **hides nothing**: counts, columns, the keyboard walk and every write are unchanged.
  The dim is visual only, and each chip carries `aria-pressed`, so the state is announced.
- Applied by toggling a class on the already-drawn cards (`ctx.rows`), not by a re-render.
  A data update re-applies it after the render.
- A spotlighted person who no longer has cards on the board clears the spotlight.

## 3. Card signals (iteration board only)

A signal row under the card title, drawn only when at least one signal applies:

- **Blocked** — the item has a prerequisite (`item.prerequisites`) whose state is not in
  the Resolved bucket. Tooltip names the first blocker; label `Blocked`.
- **Overdue** — the item is not Resolved and its own target (`plannedTarget`) is before
  today. Label `Overdue {n}d` (plural key). Because joining an iteration stamps the sprint's
  end onto the item, this mostly fires after the sprint ends — that is correct, not a bug.
- **Risk** and **priority** — the item's own values, drawn as quiet chips (read-only here;
  the tree's chips stay the editing surface). This extends ADR 0027's amendment to these two
  kinds on **this board only**; ADR 0027 gets a dated amendment paragraph.

Resolved cards draw no Blocked or Overdue signal. Context cards draw no signals (they are
placement, not population).

## 4. Daily / Planning

`Daily` hides the backlog shelf; `Planning` shows it (today's behaviour). Stored per device
in the view-state store as a new boolean pref (`iterationDaily`), absent = Planning, so an
existing reader sees no change until they pick Daily. It is UI state, never a `.base`
setting (ADR 0011). In Daily the header is unchanged; the shelf is simply not rendered, and
the tab-stop rule for the shelf controls is moot because there is no shelf.

## Where it lives

- `src/domain/iterationDaily.ts` — pure: `timebox(start, target, today)`,
  `iterationProgress(columns)`, `boardPeople(cards, settings)`, `cardSignals(item, settings,
  today)`. Node tests in `test/domain/iterationDaily.test.ts`.
- `src/view/render/iterationHeader.ts` — draws the header, the switch and the chips, and
  applies the spotlight. Called from `render/iterationBoard.ts`, which drops
  `renderIterationGoal`.
- `src/view/render/cardSignals.ts` — draws the signal row; called from `renderCardBody`
  when the projection is `iteration`.
- Spotlight + daily pref: `viewState.ts` / `viewStateController.ts` /
  `viewStateSurface.ts` / `host.ts` / `storage/viewStateStore.ts` (pref reader).
- `styles/iterationHeader.css` (new partial, imported from `styles/index.css`); the
  `.pbl-iteration-goal` rule in `styles/board.css` is removed.
- `src/i18n/en.ts` — new `iteration.*` keys.
- Register: a Feature under [[Product Kanban]] with four PBIs, one per section above, each
  with `## Where it lives`; ADR 0027 amendment.
- Harness: the demo vault gains one dated Iteration with a goal and several linked items
  (assignees, a blocker, a past target), and a `?scope=<path>` knob opens the board on it.
- `scripts/esbuild.config.mjs`: `main.js` budget 512 → 544 kB, as a decision recorded in the
  changelog — the bundle was at 509.7 kB before this feature.

## Testing

- Domain: every timebox branch (before, inside, last day, after, one end, none), progress
  over context rows, people ordering and Unassigned, each signal and its suppression on
  Resolved and on context cards.
- View (jsdom): header renders name/goal/timebox/progress; no goal → no goal line; chip
  click dims other cards and toggles `aria-pressed`; spotlight survives a data update and
  clears when its person leaves; Daily hides the shelf and persists through the store;
  signals draw on the iteration board and not on the product board.
- i18n: projections test stays green (no unmarked text).
- Live-vault check owed: header against a real theme, chip row with many people, the switch
  in a narrow pane.
