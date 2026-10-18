# The iteration board for the daily — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the iteration board usable as the daily ceremony view: a prominent header
(name, goal, timebox, progress), a person spotlight, card signals (blocked, overdue, risk,
priority) and a Daily/Planning switch that hides the backlog shelf.

**Architecture:** One pure domain module (`domain/iterationDaily.ts`) answers every
question (timebox, progress, people, signals) from items, settings and an injected
`today`. Two render modules draw it (`render/iterationHeader.ts`, `render/cardSignals.ts`),
called from the existing `render/iterationBoard.ts` and `renderCardBody`. Two new pieces of
view state: `iterationDaily` (stored per device, view-state store) and `spotlight`
(session-only field). Spec: `docs/superpowers/specs/2026-10-18-iteration-daily-board-design.md`.

**Tech Stack:** TypeScript, Obsidian Bases view API, vitest (node + jsdom), CSS partials.

## Global Constraints

- Read `CLAUDE.md`, `src/view/CLAUDE.md`, `src/domain/CLAUDE.md` and `test/CLAUDE.md`
  before editing their layers. Their rules bind.
- Layers: `domain/` imports no `view/`, no `storage/`, reads no clock (`today` is injected
  from the view with `todayCivil()`). Lint enforces layer imports.
- Every user-visible string goes through `t()` with a key in `src/i18n/en.ts`. Never a
  literal sentence at a setter, `createEl({ text })`, `setTooltip`, or `aria-label`. Plural
  keys use `{ one: '…', other: '…' }`. Numbers via `formatNumber`, dates via
  `formatDate('dayMonth', y, m, d)` from `src/i18n/t.ts`.
- Files in `src/` max 400 lines; `test/**` max 450 lines. Split by subject if near.
- UI controls in the header are real `<button>`s (normal tab stops — header is chrome).
- CSS goes in a NEW partial `styles/iterationHeader.css`, imported from `styles/index.css`;
  use Obsidian variables and DESIGN.md radius tokens (`--radius-s`, `--radius-m`,
  `--radius-l`), never `999px`; `setCssProps` over inline styles in TS.
- Context rows (`item.outsideFilter`) never count toward progress, people, or signals.
- Inner loop: `npx vitest run <files>`, `npm run lint`, `npm run typecheck:test`.
  `npm run check` runs once at the end (Task 7) — it includes the bundle budget and the
  docs register gate, which fail until Task 7.
- Commit after each task with a conventional message ending in:

  ```text
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Kx8dGbaYzwnvsH8fDQ212i
  ```

- Do not include any model identifier in code, comments or docs.

---

### Task 1: The domain answers — `domain/iterationDaily.ts`

**Files:**
- Create: `src/domain/iterationDaily.ts`
- Test: `test/domain/iterationDaily.test.ts`

**Interfaces:**
- Consumes: `CivilDate`, `FieldReading` (`domain/noteFields.ts`); `daysBetween`
  (`domain/timeline.ts`); `bucketOf`, `IterationBucket` (`domain/board.ts`);
  `assigneeName` (`domain/readItems.ts`); `BacklogItem` (`domain/model.ts`);
  `BacklogSettings` (`domain/settings.ts`).
- Produces (exact):

```ts
export type Timebox =
	| { kind: 'none' }
	| { kind: 'startOnly'; start: CivilDate }
	| { kind: 'targetOnly'; target: CivilDate }
	| { kind: 'upcoming'; start: CivilDate; target: CivilDate; startsIn: number }
	| { kind: 'running'; start: CivilDate; target: CivilDate; day: number; length: number; left: number }
	| { kind: 'ended'; start: CivilDate; target: CivilDate; endedAgo: number };
export function timebox(start: CivilDate | null, target: CivilDate | null, today: CivilDate): Timebox;

export interface IterationProgress { open: number; inProgress: number; resolved: number; total: number }
export function iterationProgress(population: BacklogItem[], settings: BacklogSettings): IterationProgress;

export interface BoardPerson { key: string; name: string | null; count: number } // name null = Unassigned, key ''
export function personKey(item: BacklogItem): string;
export function boardPeople(population: BacklogItem[]): BoardPerson[];

export interface CardSignals { blockedBy: BacklogItem | null; overdueDays: number }
export function cardSignals(item: BacklogItem, settings: BacklogSettings, today: CivilDate): CardSignals;
```

Rules (from the spec):
- `timebox`: both ends: `length = daysBetween(start, target) + 1` (inclusive). Today before
  start → `upcoming`, `startsIn = daysBetween(today, start)`. Today after target → `ended`,
  `endedAgo = daysBetween(target, today)`. Otherwise `running`, `day =
  daysBetween(start, today) + 1`, `left = daysBetween(today, target)` (0 on the last day).
  A target before its start is treated as `targetOnly` (an invalid span says no day count).
- `iterationProgress`: skip `outsideFilter`; bucket with
  `bucketOf(settings.stateKey ? item.stateValue : null, settings)` — the same reading
  `iterationBuckets` uses. Visibility toggles are NOT applied (progress is about the sprint,
  not the screen).
- `personKey`: `item.assigneeEntry?.file?.path ?? item.assigneeEntry?.raw ?? ''`.
- `boardPeople`: skip `outsideFilter`; group by `personKey`; name via `assigneeName(item)`;
  sort named people by name with `localeCompare` (base sensitivity), Unassigned (`key ''`)
  last; Unassigned only present when count > 0.
- `cardSignals`: for `outsideFilter` items, or items in the resolved bucket, return
  `{ blockedBy: null, overdueDays: 0 }`. `blockedBy` = first `item.prerequisites` entry whose
  bucket (same reading) is not `resolved`. `overdueDays` = `daysBetween(target, today)` when
  `item.plannedTarget.value` is set and that is > 0, else 0.

- [ ] **Step 1: Write the failing tests** in `test/domain/iterationDaily.test.ts`. Build
  items the way neighbouring domain tests do (read `test/domain/board.test.ts` or
  `test/domain/iterations.test.ts` and reuse their item/settings builders — do not invent a
  second builder). Cover: every `timebox` kind incl. last day (`left: 0`), first day
  (`day: 1`), inverted span; progress skipping a context row and counting a no-state item as
  open and a done-value item as resolved; people sorted with Unassigned last and absent when
  zero, an unresolved assignee keyed by raw text; signals: blocked by an unresolved
  prerequisite, not blocked when the prerequisite is resolved, overdue days, none on a
  resolved item, none on a context row.
- [ ] **Step 2:** `npx vitest run test/domain/iterationDaily.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/domain/iterationDaily.ts` with a header comment stating it
  is pure and why `today` is injected. Keep comments short and factual.
- [ ] **Step 4:** Re-run → PASS. `npm run lint` clean.
- [ ] **Step 5:** Commit `feat(domain): what the daily asks of an iteration`.

---

### Task 2: View state — `iterationDaily` (stored) and `spotlight` (session)

**Files:**
- Modify: `src/storage/viewStateStore.ts` (`ViewPrefs` gets `iterationDaily?: boolean`;
  `PREF_READERS` gets `iterationDaily: onlyTrue`)
- Modify: `src/view/viewState.ts` (`iterationDaily()` / `setIterationDaily(value)`, same
  shape as `clickFolds`: stored as `true` or absent)
- Modify: `src/view/viewStateController.ts` (`get iterationDaily`, `setIterationDaily`
  → `this.hooks.render()` when changed; `spotlight: string | null = null` plain field
  beside `shelfSearch`, with `get spotlight` / `setSpotlight(key: string | null)` that does
  NOT render)
- Modify: `src/view/viewStateSurface.ts` (forwards for all four members)
- Modify: `src/view/host.ts` (declare `readonly iterationDaily: boolean;
  setIterationDaily(value: boolean): void; readonly spotlight: string | null;
  setSpotlight(key: string | null): void;` with one-line doc comments in the style there)
- Test: extend the existing store reader test (find it: `grep -rln PREF_READERS test`) and
  add `test/view/iterationDaily.test.ts` (round trip: set Daily, re-make the view on the
  same vault/store, still Daily; spotlight NOT restored on a new view).

**Interfaces:**
- Produces: `host.iterationDaily`, `host.setIterationDaily(v)`, `host.spotlight`,
  `host.setSpotlight(key)`.

- [ ] **Step 1:** Write failing tests (reader accepts `true`, drops other values; round trip
  as above). Follow how `clickFolds` is tested (`grep -rn "clickFolds" test | head`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement, mirroring `clickFolds` line for line for the stored pref and
  `shelfSearch` for the session field.
- [ ] **Step 4:** Run the new tests + `npx vitest run test/storage test/view/viewState*`
  → PASS; `npm run lint`; `npm run typecheck:test`.
- [ ] **Step 5:** Commit `feat(view): remember the daily pick, hold the spotlight for the session`.

---

### Task 3: The header — name, goal, timebox, progress, Daily/Planning

**Files:**
- Create: `src/view/render/iterationHeader.ts`
- Create: `styles/iterationHeader.css`; Modify: `styles/index.css` (import it next to
  `board.css`; read `index.css`'s own notes on load-bearing order first); Modify:
  `styles/board.css` (delete the `.pbl-iteration-goal` rule — the class moves to the new
  partial)
- Modify: `src/view/render/iterationBoard.ts` (delete `renderIterationGoal`; call
  `renderIterationHeader` first; skip `renderIterationShelf` when `host.iterationDaily`;
  keep `BoardSnapshot` valid without a shelf — return no `shelfEl`/`shelf`, and check the
  callers of `shelfEl`/`shelf` handle absence: `grep -rn "shelfEl\|\.shelf\b" src/view`)
- Modify: `src/i18n/en.ts` (new `iteration.*` keys, below)
- Test: `test/view/iterationHeader.test.ts`; update
  `test/view/iterationBoardCards.test.ts` goal assertions only if the goal element's
  class or text changes (keep class `pbl-iteration-goal` on the goal line so they hold).

**Interfaces:**
- Consumes: `timebox`, `iterationProgress` (Task 1); `host.iterationDaily`,
  `host.setIterationDaily` (Task 2); `iterationResults(model, scope)`
  (`domain/model.ts`); `statedEnds` (`domain/bars.ts`); `todayCivil`
  (`domain/noteFields.ts`).
- Produces: `export function renderIterationHeader(ctx: RowContext, boardEl: HTMLElement,
  iteration: BacklogItem, population: BacklogItem[]): HTMLElement` returning the header
  element (Task 4 appends the people row into it via
  `renderPeopleRow(ctx, headerEl, population)`).

Markup (classes are the contract tests and CSS use):

```text
div.pbl-iteration-header
  div.pbl-iteration-titlebar
    div
      div.pbl-iteration-kicker            t('iteration.kicker')            "Iteration"
      h2.pbl-iteration-name               iteration.title
    div.pbl-iteration-mode (role=group, aria-label t('iteration.modeLabel'))
      button[aria-pressed]                t('iteration.modeDaily')         "Daily"
      button[aria-pressed]                t('iteration.modePlanning')      "Planning"
  div.pbl-iteration-goal                  goal text (only when non-blank and goal key set)
  div.pbl-iteration-meta
    span.pbl-iteration-when               icon 'calendar' + timebox text (absent for kind none)
    span.pbl-iteration-progress
      span.pbl-iteration-bar > span.pbl-iteration-bar-resolved / -inprogress  (widths via setCssProps '--pbl-w')
      span                                t('iteration.resolvedOf', { resolved, total })
    span.pbl-iteration-buckets            three: dot + "<bucketLabel> <n>"  (use bucketLabel from domain/board.ts)
```

Catalog keys to add (English values):

```ts
'iteration.kicker': 'Iteration',
'iteration.modeLabel': 'Board mode',
'iteration.modeDaily': 'Daily',
'iteration.modePlanning': 'Planning',
'iteration.modeDailyTip': 'For the stand-up: hide the backlog shelf',
'iteration.modePlanningTip': 'For planning: show the backlog shelf to pull work in',
'iteration.span': '{start} – {target}',
'iteration.starts': 'Starts {date}',
'iteration.ends': 'Ends {date}',
'iteration.dayOf': 'Day {day} of {length}',
'iteration.daysLeft': { one: '{count} day left', other: '{count} days left' },
'iteration.lastDay': 'Last day',
'iteration.startsIn': { one: 'Starts in {count} day', other: 'Starts in {count} days' },
'iteration.endedAgo': { one: 'Ended {count} day ago', other: 'Ended {count} days ago' },
'iteration.resolvedOf': '{resolved} of {total} resolved',
'iteration.bucketCount': '{bucket} {count}',
```

Check how plural keys take `count` and whether a parameter must be a formatted string
(read `t.ts` `fill`/`selectForm` and an existing plural call site) — pass numbers the way
existing callers do. The timebox parts are joined with a `·` separator span
(`span.pbl-iteration-sep`, `aria-hidden`), not by string concatenation — the sentence is
the unit of translation, so each part is its own key.

Daily/Planning buttons: click → `host.setIterationDaily(daily)`; that re-renders, so after
it, focus the replacement pressed button (query the new header from `boardEl.ownerDocument`
by `.pbl-iteration-mode button[aria-pressed="true"]`). Each button gets `setTooltip` with
its `…Tip` key.

CSS: take the reviewed mock's look (header box on `--background-secondary` with
`--radius-l` and a border; kicker small uppercase `--text-accent`; name ~1.6em bold; goal
~1.15em `--text-normal` with a 3px `--interactive-accent` start border, `max-width: 70ch`,
`overflow-wrap: anywhere`; meta row `--font-ui-small` muted, wraps; bar 160px × 6px,
resolved `--color-green`, in progress `--color-blue`, track
`--background-modifier-border`; segmented mode control with pressed =
`--interactive-accent` / `--text-on-accent`). Header is `flex: 0 0 auto` so the columns keep
the room (the board is a flex column — see `styles/board.css` top).

Tests (`test/view/iterationHeader.test.ts`, jsdom; copy the `OPTIONS`/`onSprint` pattern
from `test/view/iterationShelf.test.ts`, adding `startProperty: 'note.start'`,
`targetProperty: 'note.due'`, `iterationGoalProperty: 'note.goal'`; freeze today with
`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` as `test/CLAUDE.md` says):
- name renders in `h2.pbl-iteration-name`; kicker present;
- goal line present with the goal text; absent when goal blank;
- running sprint shows `Day 6 of 14` and `8 days left`; ended shows `Ended 2 days ago`;
  no dates → no `.pbl-iteration-when`;
- progress text `1 of 3 resolved` for a sprint with one Done, one Doing, one New, plus a
  context row that must not count;
- Daily click hides `.pbl-shelf` and sets `aria-pressed`; Planning shows it again; the
  product board draws no `.pbl-iteration-header`.

- [ ] **Step 1:** Write the failing tests. **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement module, CSS, keys, wiring. **Step 4:** run new tests +
  `npx vitest run test/view/iteration* test/i18n` → PASS; `npm run lint`;
  `npm run typecheck:test`.
- [ ] **Step 5:** Commit `feat(iteration): a header that says which sprint and how it is going`.

---

### Task 4: The person spotlight

**Files:**
- Modify: `src/view/render/iterationHeader.ts` (add `renderPeopleRow`, `applySpotlight`)
  — if the file would pass ~350 lines, put these two in
  `src/view/render/iterationPeople.ts` instead.
- Modify: `src/view/render/iterationBoard.ts` (call `applySpotlight(ctx, population)` after
  `renderBoard`)
- Modify: `styles/iterationHeader.css` (chip + `.pbl-spot-dim`)
- Modify: `src/i18n/en.ts`
- Test: `test/view/iterationSpotlight.test.ts`

**Interfaces:**
- Consumes: `boardPeople`, `personKey` (Task 1); `host.spotlight`, `host.setSpotlight`
  (Task 2); `ctx.rows` (path → card element map the render fills).
- Produces: `renderPeopleRow(ctx, headerEl, population): void`,
  `applySpotlight(ctx: RowContext, population: BacklogItem[]): void`.

Markup: `div.pbl-iteration-people` > `span.pbl-iteration-people-label`
(`t('iteration.walkLabel')` "Walk the board") + one
`button.pbl-iteration-person[aria-pressed]` per person: `span.pbl-iteration-avatar`
(first letter of name, or `?`, `aria-hidden`), `span` name (or `t('iteration.unassigned')`),
`span.pbl-iteration-count` (formatNumber). Tooltip
`t('iteration.spotlightTip', { name })` "Show {name}'s cards; dim the rest". No row when
there are no people (empty sprint).

Behaviour:
- click: `host.setSpotlight(active ? null : key)` then `applySpotlight` + update every
  chip's `aria-pressed` in place — **no re-render** (focus stays on the chip).
- `Escape` on a pressed chip clears the spotlight the same way.
- `applySpotlight`: if `host.spotlight` is not null and no population item has that key,
  call `host.setSpotlight(null)`. Then for each result item in `population` with a card in
  `ctx.rows`: toggle `pbl-spot-dim` on when spotlight is set and `personKey(item) !==
  spotlight`, off otherwise. Context cards are never dimmed.
- Keys: `'iteration.walkLabel': 'Walk the board'`, `'iteration.unassigned': 'Unassigned'`,
  `'iteration.spotlightTip': "Show {name}'s cards; dim the rest"`,
  `'iteration.spotlightClear': 'Show everyone'` (tooltip of the pressed chip).
- CSS: chips use `--radius-m` (not a pill radius), border
  `--background-modifier-border`, pressed = accent border + inset ring; avatar 20px circle
  is fine as `border-radius: 50%`. `.pbl-spot-dim { opacity: 0.3; }` with a short
  `transition: opacity` guarded by `@media (prefers-reduced-motion: no-preference)`.

Tests: chips list people sorted with Unassigned last and counts; click dims other cards and
not the person's, `aria-pressed` true; second click clears; Escape clears; spotlight
survives `refresh(view, vault)`; spotlight clears when the person's last card leaves the
sprint (rewrite its iteration in the vault, refresh); a new `makeView` does not restore it;
the dim never changes column counts.

- [ ] Steps: failing tests → FAIL → implement → PASS (+ `test/view/iteration*`, lint,
  typecheck) → commit `feat(iteration): walk the board one person at a time`.

---

### Task 5: Card signals

**Files:**
- Create: `src/view/render/cardSignals.ts`
- Modify: `src/view/render/board.ts` — in `renderCardBody`, after the parent line, call
  `renderCardSignals(ctx, card, item)` **only when `ctx.host.projection === 'iteration'`**
  (dispatch on one projection is allowed; see `src/view/CLAUDE.md` "What a projection IS").
  `board.ts` is near its 400-line cap: the call is two lines; everything else lives in the
  new module.
- Create: `styles/cardSignals.css` + import in `styles/index.css` after `cards.css`
- Modify: `src/i18n/en.ts`
- Modify: `docs/adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md`
  (append a dated `**Amended 2026-10-18.**` paragraph at the end of `## Decision`: risk and
  priority now draw on the ITERATION board's cards as read-only signals, by user request,
  because the daily is where a risk is talked about; other projections unchanged)
- Test: `test/view/iterationSignals.test.ts`

**Interfaces:**
- Consumes: `cardSignals` (Task 1), `todayCivil`, `item.riskValue`, `item.priorityValue`,
  `host.settings.riskKey` / `priorityKey`.
- Produces: `renderCardSignals(ctx: RowContext, card: HTMLElement, item: BacklogItem): void`.

Markup: `div.pbl-card-signals` (only when ≥1 signal) holding `span.pbl-signal` items, each
an icon (`drawIcon`) + text:
- `.pbl-signal-blocked` icon `lock`, text `t('signal.blocked')` "Blocked", tooltip
  `t('signal.blockedBy', { title })` "Waiting for {title}";
- `.pbl-signal-overdue` icon `clock`, text `t('signal.overdue', { count })`
  `{ one: 'Overdue {count} day', other: 'Overdue {count} days' }`;
- `.pbl-signal-risk` icon `triangle-alert`, text = `item.riskValue` (data, not a key),
  tooltip `t('signal.risk', { value })` "Risk: {value}" — only when `riskKey` set and value
  non-empty;
- `.pbl-signal-priority` icon `arrow-up`, text = `item.priorityValue`, tooltip
  `t('signal.priority', { value })` "Priority: {value}" — same gating.
Signals are text, not controls (no buttons, nothing focusable). Order: blocked, overdue,
risk, priority. Colours: blocked `--text-error` on `rgba(var(--color-red-rgb), 0.12)`,
overdue `--color-orange`, risk `--color-yellow`, priority `--text-muted` on
`--background-modifier-hover`; `--radius-s`; `--font-ui-smaller`.

Check before finishing: `src/view/rowSignature.ts` — if card bodies are ever reused across
passes, today's date and prerequisites' states are per-item rendering terms; read its
header and add terms if card reuse applies (it is documented for tree ROWS; confirm cards
are rebuilt each pass and say so in the commit message).

Tests: blocked by an unresolved prerequisite (tooltip names it); not blocked once resolved;
overdue with a frozen today; resolved card has no signals; risk and priority chips show on
the iteration board; the PRODUCT board card for the same item has no `.pbl-card-signals`;
a context card has none.

- [ ] Steps: failing tests → FAIL → implement → PASS (+ `test/view/board*`,
  `test/view/iteration*`, `test/i18n`) → lint → typecheck → commit
  `feat(iteration): cards say what needs talking about`.

---

### Task 6: The harness can show it

**Files:**
- Modify: `test/helpers/fixtures.ts` — `demoOptions()` gains
  `iterationProperty: 'note.iteration'`, `iterationGoalProperty: 'note.goal'`,
  `iterationOpenStates: 'New, Ready'`, `iterationResolvedStates: 'Done'`.
  `demoVault()` gains one `Iteration` note `12 - Iteration` with `goal: 'New teams sign up
  and finish onboarding without talking to us.'`, `start`/`due` computed with `fromToday`
  (`test/helpers/window.ts`) as today−5 … today+8, and `iteration: '[[12 - Iteration]]'` on
  about six existing items spanning the three buckets and at least two assignees
  (`Single sign-on`, `Welcome tour`, `Offline-first sync` — which is blocked by
  `Single sign-on` — `Highlight the sidebar`, `Sync conflict UX`, `Provider handshake`).
  Give one of them a past `due` so Overdue draws.
- Modify: `test/harness/page.ts` — `?scope=<path>` calls `view.setBoardScope(path)` after
  `?view=` (and `?view=iteration` must then work); document it in the knob comment style.
- Modify: `test/harness/harness.test.ts` — assert the demo iteration board renders
  `.pbl-iteration-header`, a `.pbl-iteration-person`, and a `.pbl-signal-blocked`.
- Fix fallout: run `npx vitest run test/harness test/view` and the whole `npm test`. A
  failure whose cause is the new Iteration note or the new links (a count, a row list, a
  roadmap marker) is updated to the new truth with a one-line comment why; anything else is
  a real regression — stop and report it.
- `test/CLAUDE.md`: one sentence under the `?view=` paragraph naming `?scope=`.

- [ ] Steps: implement → `npm run harness` → screenshot
  `.harness/index.html?view=iteration&scope=12%20-%20Iteration.md` headless (Chromium at
  `/opt/pw-browsers`) and look at it → `npm test` green → lint → commit
  `test(harness): the demo backlog has a sprint`.

---

### Task 7: Register, changelog, budget, gate

**Files:**
- Create `docs/requirements/The iteration board for the daily.md` (`type: Feature`,
  `parent: "[[Product Kanban]]"`, a free `order` among its siblings — check with
  `grep -l 'parent: "\[\[Product Kanban\]\]"' docs/requirements/*.md` and their orders,
  `status: Done`, `created: 2026-10-18`, `source: user request`, the other frontmatter keys
  as blank strings exactly like `docs/requirements/An Iterations board.md`). Prose + `##
  Outcome`; mention the 2026-08-15 decisions kept (no swimlanes, goal is text) and the one
  narrowed (progress is not burndown).
- Create four PBIs under it (`parent: "[[The iteration board for the daily]]"`, orders
  10–40, `status: Done`), in the enforced use-case shape (copy the section headings from
  `docs/requirements/A board scoped to one iteration.md`): `The iteration header`,
  `Walking the board one person at a time`, `Signals on an iteration card`,
  `Daily or planning`. Each `## Where it lives` names its `src/` modules and tests —
  `docs-check.mjs` rule 7 requires every new `src/` module to be named there.
- `CHANGELOG.md` `[Unreleased]`: `### Added` one line per user-visible capability (header,
  spotlight, signals, Daily/Planning); `### Changed` one line: "The release bundle's size
  budget rises from 512 kB to 544 kB to make room for the iteration board's daily view."
- `scripts/esbuild.config.mjs`: `"main.js": 544 * 1024`.
- Run `npm run check`. Fix everything it reports (coverage floors only go up — add tests
  rather than lowering; fallow duplication/complexity — refactor). Then commit
  `docs: register the iteration board for the daily`.
