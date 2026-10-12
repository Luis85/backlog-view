# Release Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second tab, `List | Map`, on the release view's index screen. The map draws every release on one month ruler in date order, with its facts and headline scope, and the undated releases on a shelf. A click opens the release; Back returns to the map.

**Architecture:** A pure `src/domain/releaseMap.ts` turns the `ReleaseIndex` the view already builds into rows, a shelf and a window. `src/view/release/renderMap.ts` draws it, and reuses the list's own band parts (`renderIndex.ts`) and the roadmap's grid lines (`render/timeline.ts`). `ReleaseView.draw()` picks the tab. The tab is one view-state pref, `releaseTab`, that stores only `'map'`.

**Tech Stack:** TypeScript, Obsidian Bases view API, vitest (node + jsdom), the static browser harness.

**Spec:** `docs/superpowers/specs/2026-10-12-release-map-design.md`

## Global Constraints

- Lint caps: 400 code lines per `src/` file, 450 per `test/` file (`skipBlankLines`, `skipComments`); 100 per function, complexity 16, 5 params.
- Layers: `main → commands → view → storage → domain`; `i18n/` is a leaf below all of them. `domain/` touches no DOM and writes nothing.
- Every UI sentence goes through `t()`. Keys go in `src/i18n/en.ts`; parity with the other catalogs is automatic (`test/i18n/parity.ts`). Names, versions, dates and status values are data and stay untranslated.
- No inline styles: geometry goes through `setCssProps` as `--pbl-*` custom properties.
- Colours are Obsidian CSS variables only.
- `localStorage` is read and written in `storage/` only (`updateViewPrefs`, `loadViewState`).
- UI text is sentence case.
- docs-check rule 7: each new `src/` module is named in a PBI's `## Where it lives`, in the same commit that adds the module.
- `CHANGELOG.md` gets one `[Unreleased]` entry (Task 7).
- Inner loop: `npm test` (or `npx vitest run <file>`). Before every commit: `npm run check`, exit 0.
- The map writes nothing: no frontmatter, no note, no `.base` setting.
- The tab pref stores only `'map'`; absence is the list.
- Stage explicit paths only. Never `git add docs/`, `git add -A` or `git add .`. Never stage `test/harness/mockReleaseMap.ts` or the spec file.

## Review Focus

- **No dated release** (target unbound, or every in-flight release undated): no rows, all on the shelf, the ruler still drawn from today. Pinned in Task 2 (`draws from today alone…`) and Task 3 (`with no dated release at all…`).
- **Every release shipped**: no shelf is drawn, not an empty "Not scheduled (0)". Pinned in Task 3 (`with every release shipped…`).
- **Unreadable target** (`target-date: soon`): shelf card, saying "Target unreadable", never a row at the epoch. Pinned in Task 2 (shelf test) and Task 3 (`shelves a release whose target…`).
- **A release past `MAX_TIMELINE_DAYS`**: the window clamps around today; the marker is pinned to the edge with `pbl-relmap-clipped`; the card still states the date. Pinned in Task 2 (`clamps a release far past…`) and Task 3 (`pins a release past…`).
- **A stale or garbage stored tab** (`'Map'`, `'list'`, `42`, `null`): read as the list, never thrown on. Pinned in Task 1 (`reads a stored tab of %j as the list`) and Task 3 (`draws the list for a stored tab…`).

A single release is the first-row case (Task 2). A narrow pane cannot be asked of jsdom; Task 6 says how to look at it.

---

## Task 1: The tab pref in the view-state store

**Files:**

- Modify: `src/storage/viewStateStore.ts`
- Test: `test/storage/viewStateStore.test.ts`

**Interfaces:**

- Consumes: `oneOf(allowed: readonly string[]): Reader<string>` (module-private), `PREF_READERS`.
- Produces:
  - `export const RELEASE_MAP_TAB = 'map';`
  - `ViewPrefs.releaseTab?: string;`
  - `PREF_READERS.releaseTab: Reader<string>` = `oneOf([RELEASE_MAP_TAB])`

- [ ] **Step 1: Write the failing test**

In `test/storage/viewStateStore.test.ts`, add `RELEASE_MAP_TAB` to the import list from `'../../src/storage/viewStateStore'`. In `FULL_PREFS`, after the `releaseHideDone: true,` line, add:

```ts
	// The release view's tab — the one stored word, `'map'`; the list is absence.
	releaseTab: RELEASE_MAP_TAB,
```

After the `describe('the release scope’s hide-done toggle', …)` block, add:

```ts
describe('the release view’s tab', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips the Map tab, and stores nothing for the list', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { releaseTab: RELEASE_MAP_TAB } });
		expect(loadViewState(vault.app, id).prefs.releaseTab).toBe('map');

		// The list is the default, so it is ABSENCE: a word for it is refused on the way out.
		saveViewState(vault.app, id, { ...none, prefs: { releaseTab: 'list' } });
		expect(Object.keys(stored(vault))).toHaveLength(0);
	});

	// Planted RAW, past `saveViewState`'s own reader: the IN direction is what a value
	// another version wrote reaches.
	it.each(['Map', 'list', 'tree', 42, null])('reads a stored tab of %j as the list', (planted) => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { releaseTab: RELEASE_MAP_TAB } });
		const [key, entry] = Object.entries(stored(vault))[0];
		vault.localStorage.set(STORE_KEY, { [key]: { ...entry, prefs: { releaseTab: planted } } });
		expect(loadViewState(vault.app, id).prefs.releaseTab).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run test/storage/viewStateStore.test.ts`
Expected: FAIL — the import of `RELEASE_MAP_TAB` is undefined, the round trip reads `undefined`, and `has a fixture value for every stored preference` fails on `releaseTab`.

- [ ] **Step 3: Implement**

In `src/storage/viewStateStore.ts`, after `export const DELIVERABLES_MODE = 'deliverables';`:

```ts
/** The release view's Map tab — the one value {@link ViewPrefs.releaseTab} stores. */
export const RELEASE_MAP_TAB = 'map';
```

In `interface ViewPrefs`, after the `releaseHideDone?: boolean;` field:

```ts
	/**
	 * Which tab the release view's index draws. Only {@link RELEASE_MAP_TAB} is stored and
	 * absence is the list — `bucketList`'s rule, so a default writes nothing. A WORD, never
	 * a path: neither the prune nor the rename walk touches it. Not a member of
	 * `PROJECTION_MODES`, which are the backlog view's.
	 */
	releaseTab?: string;
```

In `PREF_READERS`, after `releaseHideDone: onlyTrue,`:

```ts
	releaseTab: oneOf([RELEASE_MAP_TAB]),
```

- [ ] **Step 4: Run it, see it pass**

Run: `npx vitest run test/storage/viewStateStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add src/storage/viewStateStore.ts test/storage/viewStateStore.test.ts
git commit -m "feat(storage): remember the release view's Map tab" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: The map's derivation, and its PBI

The PBI note lands here and not at the end: docs-check rule 7 fails `npm run check` on the first commit that adds `src/domain/releaseMap.ts` without a `## Where it lives` naming it. The note names only paths that exist after this commit; Task 3 adds the view's paragraph.

**Files:**

- Create: `src/domain/releaseMap.ts`
- Create: `docs/requirements/Every release on a map.md`
- Test: `test/domain/releaseMap.test.ts`

**Interfaces:**

- Consumes: `ReleaseIndex`, `ReleaseRow` (`src/domain/releases.ts`); `ScopeRow` (`src/domain/scopeRows.ts`); `CivilDate` (`src/domain/noteFields.ts`); `daysBetween(a: CivilDate, b: CivilDate): number` (b − a), `timelineWindow(spans: DateSpan[], today: CivilDate): TimelineWindow`, `DateSpan`, `TimelineWindow` (`src/domain/timeline.ts`).
- Produces:

```ts
export interface MapCard {
	release: ReleaseRow;
	headline: string[];
	more: number;
}
export interface MapRow extends MapCard {
	end: CivilDate;
	start: CivilDate | null;
	slipTarget: CivilDate | null;
}
export interface ReleaseMap {
	rows: MapRow[];
	shelf: MapCard[];
	window: TimelineWindow;
	today: CivilDate;
}
export function releaseMap(index: ReleaseIndex, scopeOf: (path: string) => ScopeRow[], today: CivilDate): ReleaseMap;
```

- [ ] **Step 1: Write the failing test**

Create `test/domain/releaseMap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { MapCard, releaseMap } from '../../src/domain/releaseMap';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { daysBetween, MAX_TIMELINE_DAYS } from '../../src/domain/timeline';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

const KEYS = releaseSettingsWith({
	parentKey: 'parent',
	orderKey: 'order',
	typeKey: 'type',
	membershipKey: 'release',
	versionKey: 'version',
	targetDateKey: 'target-date',
	statusKey: 'status',
	releasedDateKey: 'released',
});

const TODAY: CivilDate = { year: 2026, month: 9, day: 20 };

function d(iso: string): CivilDate {
	const [year, month, day] = iso.split('-').map(Number);
	return { year, month, day };
}

function release(vault: FakeVault, name: string, frontmatter: Record<string, unknown>): void {
	vault.addFile(`${name}.md`, { frontmatter: { type: 'Release', ...frontmatter } });
}

/** The map exactly as the view builds it: the real index, the real scope per release. */
function mapOf(vault: FakeVault) {
	const model = buildModel(vault.app, vault.entries(), settingsWith({ stateKey: 'status' }));
	const index = releaseIndex(vault.app, model, KEYS, { stateKey: 'status', today: TODAY });
	return releaseMap(index, (path) => releaseScope(vault.app, model, KEYS, index, path).rows, TODAY);
}

const names = (cards: MapCard[]) => cards.map((card) => card.release.name);

/** Four releases: one shipped late, two ending the same day, one later. */
function plan(): FakeVault {
	const vault = new FakeVault();
	release(vault, 'A', { 'target-date': '2026-11-01', order: 1 });
	release(vault, 'B', { 'target-date': '2026-08-25', released: '2026-09-01', order: 2 });
	release(vault, 'C', { 'target-date': '2026-10-01', order: 3 });
	release(vault, 'D', { 'target-date': '2026-10-01', order: 4 });
	return vault;
}

describe('the release map', () => {
	it('orders rows by their end — released once shipped, else target — keeping the list’s order on a tie', () => {
		const map = mapOf(plan());
		expect(names(map.rows)).toEqual(['B', 'C', 'D', 'A']);
		expect(map.rows[0].end).toEqual(d('2026-09-01'));
		expect(map.rows[3].end).toEqual(d('2026-11-01'));
	});

	it('derives each start from the row before it, and none for the first row or a same-day end', () => {
		const [b, c, dRow, a] = mapOf(plan()).rows;
		expect(b.start).toBeNull();
		expect(c.start).toEqual(d('2026-09-01'));
		// D ends the day C ends: a zero-length lead-in is no lead-in.
		expect(dRow.start).toBeNull();
		expect(a.start).toEqual(d('2026-10-01'));
	});

	it('ticks the target of a shipped release that slipped, either way, and not one on time', () => {
		const vault = plan();
		release(vault, 'OnTime', { 'target-date': '2026-09-05', released: '2026-09-05' });
		release(vault, 'Early', { 'target-date': '2026-09-15', released: '2026-09-10' });
		const rows = mapOf(vault).rows;
		const row = (name: string) => rows.find((r) => r.release.name === name);
		expect(row('B')?.slipTarget).toEqual(d('2026-08-25'));
		expect(row('Early')?.slipTarget).toEqual(d('2026-09-15'));
		expect(row('OnTime')?.slipTarget).toBeNull();
		expect(row('A')?.slipTarget).toBeNull();
	});

	it('keeps an overdue release on the map, ending at its target', () => {
		const vault = new FakeVault();
		release(vault, 'Late', { 'target-date': '2026-09-10' });
		const [row] = mapOf(vault).rows;
		expect(row.end).toEqual(d('2026-09-10'));
		expect(row.release.overdue).toBe(true);
	});

	it('shelves in-flight releases with no readable target, in the list’s order, and never a shipped one', () => {
		const vault = new FakeVault();
		release(vault, 'Unset', { order: 1 });
		release(vault, 'Unreadable', { 'target-date': 'soon', order: 2 });
		release(vault, 'Shipped', { released: '2026-09-01', order: 3 });
		const map = mapOf(vault);
		expect(names(map.shelf)).toEqual(['Unset', 'Unreadable']);
		expect(names(map.rows)).toEqual(['Shipped']);
	});

	it('heads a card with the first three top-level scope items and counts the rest', () => {
		const vault = new FakeVault();
		release(vault, 'R', { 'target-date': '2026-10-01' });
		release(vault, 'Empty', { 'target-date': '2026-11-01' });
		for (let i = 1; i <= 5; i++) vault.addFile(`P${i}.md`, { frontmatter: { type: 'PBI', order: i, release: '[[R]]' } });
		const [r, empty] = mapOf(vault).rows;
		expect(r.headline).toEqual(['P1', 'P2', 'P3']);
		expect(r.more).toBe(2);
		expect(empty.headline).toEqual([]);
		expect(empty.more).toBe(0);
		expect(empty.release.members.value).toBe(0);
	});

	it('spans the window over every row, every slipped target and today', () => {
		const { window } = mapOf(plan());
		// B's target (Aug 25) is the earliest date, padded back to July; A (Nov 1) the latest, padded to December.
		expect(window.start).toEqual(d('2026-07-01'));
		expect(daysBetween(window.start, d('2026-12-31'))).toBe(window.days - 1);
	});

	it('draws from today alone when no release has a date', () => {
		const vault = new FakeVault();
		release(vault, 'Someday', {});
		const map = mapOf(vault);
		expect(map.rows).toEqual([]);
		expect(map.window.start).toEqual(d('2026-08-01'));
		expect(map.window.days).toBe(92);
	});

	it('clamps a release far past the drawable window rather than stretching the window to it', () => {
		const vault = new FakeVault();
		release(vault, 'Far', { 'target-date': '2034-01-01' });
		const map = mapOf(vault);
		expect(names(map.rows)).toEqual(['Far']);
		expect(map.window.days).toBe(MAX_TIMELINE_DAYS);
	});
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run test/domain/releaseMap.test.ts`
Expected: FAIL — `Cannot find module '../../src/domain/releaseMap'`.

- [ ] **Step 3: Implement**

Create `src/domain/releaseMap.ts`:

```ts
import { CivilDate } from './noteFields';
import { ReleaseIndex, ReleaseRow } from './releases';
import { ScopeRow } from './scopeRows';
import { DateSpan, daysBetween, timelineWindow, TimelineWindow } from './timeline';

/**
 * The release map (`docs/requirements/Every release on a map.md`): the index's rows put on
 * a time axis. Every figure a card shows is the `ReleaseRow` the list draws, so the map and
 * the list cannot disagree about one release. The one value derived here and stored
 * nowhere is a row's START, and the view draws it labelled as derived.
 */

/** How many top-level scope items a card names before it counts the rest. */
const HEADLINE_CAP = 3;

/** One release as a card: its row, and the head of its scope. */
export interface MapCard {
	release: ReleaseRow;
	/** Titles of the scope's top-level rows, in scope order, at most {@link HEADLINE_CAP}. */
	headline: string[];
	/** How many top-level rows the headline left out. */
	more: number;
}

/** A card with a place on the axis. */
export interface MapRow extends MapCard {
	/** The released date once shipped, else the target. */
	end: CivilDate;
	/**
	 * DERIVED: the end of the row before this one. Null where no lead-in is drawn — the
	 * first row, and a row that ends on the same day as the row before it.
	 */
	start: CivilDate | null;
	/** The target of a shipped release whose slip is not zero, for its tick; else null. */
	slipTarget: CivilDate | null;
}

export interface ReleaseMap {
	rows: MapRow[];
	/** In-flight releases with no readable target, in the index's own order. */
	shelf: MapCard[];
	window: TimelineWindow;
	/** The day the map was derived against, for the today line. */
	today: CivilDate;
}

/**
 * `scopeOf` is `releaseScope(...).rows` for one release path.
 *
 * ponytail: one scope walk per release, O(items × releases). One pass over the model that
 * buckets members by release is the upgrade, if a vault with many releases feels it.
 */
export function releaseMap(index: ReleaseIndex, scopeOf: (path: string) => ScopeRow[], today: CivilDate): ReleaseMap {
	const dated: Array<{ release: ReleaseRow; end: CivilDate }> = [];
	const shelf: MapCard[] = [];
	for (const release of index.rows) {
		const end = release.released.value ?? release.target.value;
		if (end === null) shelf.push(card(release, scopeOf));
		else dated.push({ release, end });
	}
	// `sort` is stable, so two equal ends keep the index's order: rank, then path.
	dated.sort((a, b) => daysBetween(b.end, a.end));
	const rows = dated.map(({ release, end }, i): MapRow => {
		const previous = i === 0 ? null : dated[i - 1].end;
		return {
			...card(release, scopeOf),
			end,
			start: previous !== null && daysBetween(previous, end) > 0 ? previous : null,
			slipTarget: release.slip !== null && release.slip !== 0 ? release.target.value : null,
		};
	});
	const spans: DateSpan[] = rows.flatMap((row) => [
		{ start: row.start ?? row.end, target: row.end },
		...(row.slipTarget === null ? [] : [{ start: row.slipTarget, target: row.slipTarget }]),
	]);
	return { rows, shelf, window: timelineWindow(spans, today), today };
}

function card(release: ReleaseRow, scopeOf: (path: string) => ScopeRow[]): MapCard {
	const roots = scopeOf(release.path).filter((row) => row.depth === 0);
	return {
		release,
		headline: roots.slice(0, HEADLINE_CAP).map((row) => row.item.title),
		more: Math.max(0, roots.length - HEADLINE_CAP),
	};
}
```

Create `docs/requirements/Every release on a map.md`:

```markdown
---
type: PBI
parent: "[[Every release at once]]"
order: 20
status: Open
created: 2026-10-12
source: user request — release map design, 2026-10-12
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# Every release on a map

**As** someone reviewing a release plan with stakeholders, **I want** the releases drawn on
one timeline with what each one holds, **so that** a review can start from the cadence and
go into any release from there.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reviewing the release plan |
| **Trigger** | Pressing **Map** on the release view's index |
| **Preconditions** | The property that holds a note's type is mapped, and the base holds a release |
| **Guarantee** | The map writes nothing to any note or to the `.base`. The only date it draws that no note holds — a row's start — is always faded and labelled as derived. Every figure on a card is the list's own. |

**Main flow**

1. The reader presses **Map** in the index's `List | Map` control. The choice is remembered
   per device and per saved view, never in the `.base`.
2. The view orders the releases by their end — the released date once shipped, the target
   otherwise — and draws one row each under a month ruler, with today marked.
3. Each row draws a faded band from the previous row's end to its own, labelled as a derived
   start; a marker at its end; and a card: the name, version and status; the date with its
   days figure, overdue count or slip, and the progress bar; then the first three top-level
   items of its scope and a count of the rest.
4. Beneath the rows, a **Not scheduled** shelf holds the releases still in flight with no
   readable target, then the count of unresolved memberships the list also reports.
5. The reader picks a row or a shelf card, and that release's screen opens. **Back** returns
   to the map.

**Extensions**

- **1a — the type property is not mapped, or the base holds no release.** The empty state is
  the list's own, identical on both tabs, and no tab control is drawn.
- **1b — the remembered tab is a value this version did not write.** The list is drawn,
  without an error.
- **1c — the base is embedded in a note.** The tab is kept for the session only, as the
  picked release is.
- **2a — two releases end on the same day.** The second draws its marker and no band; their
  order is the list's own (rank, then path).
- **2b — the first row.** No start can be derived, so it draws its marker alone.
- **2c — a release ends past what the ruler can draw.** The ruler is bounded around today;
  the marker is pinned to its edge and drawn as running past it, and the card still states
  the date.
- **3a — a release shipped late or early.** A tick marks its target and a short stub joins
  the tick to the released date — the error colour when late, the success colour when
  early — so a slip never reads as a lead-in.
- **3b — a release is overdue.** It ends at its target and is painted overdue exactly where
  the list paints it: never while the released-date property is unbound or unreadable.
- **3c — a release has no members.** Its card says so and lists no scope.
- **4a — a release's target is unreadable.** It goes on the shelf, and its card says the
  target is unreadable.
- **4b — no release lacks a date.** No shelf is drawn.
- **4c — the target property is unbound.** Every release still in flight is on the shelf.

## Acceptance criteria

- Pressing Map draws the map and stores only `map`; pressing List removes the stored value.
- Rows are in end-date order, ties in the list's own order. Each row after the first, unless
  it ends the same day, carries a band from the previous end, named as derived in its tooltip
  and in its accessible name.
- A shipped release with a non-zero slip draws a tick at its target and a stub in the error
  (late) or success (early) colour.
- A card lists at most three top-level scope items, then `+N more`.
- In-flight releases without a readable target are on the shelf; a shipped release never is.
- A row or a shelf card opens that release, and Back returns to the map.
- Nothing on the map writes to a note or to the `.base`.

## Where it lives

`src/domain/releaseMap.ts` derives the map from the `ReleaseIndex` that
`src/domain/releases.ts` builds for the list: the order by end, the derived start, the slip
tick, the headline over `releaseScope`, and the shelf, with the window from `timelineWindow`
in `src/domain/timeline.ts`. It computes no figure the list does not, so a card and a band
cannot disagree. The tab is the `releaseTab` pref in `src/storage/viewStateStore.ts`. Tested
in `test/domain/releaseMap.test.ts`.
```

- [ ] **Step 4: Run it, see it pass**

Run: `npx vitest run test/domain/releaseMap.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add src/domain/releaseMap.ts test/domain/releaseMap.test.ts "docs/requirements/Every release on a map.md"
git commit -m "feat(domain): derive the release map from the release index" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: The map screen

The tab is driven here through `view.setTab()`; the button that calls it is Task 4.

**Files:**

- Create: `src/view/release/renderMap.ts`
- Modify: `src/view/release/releaseView.ts` (field `tab`, `setTab`, restore, dispatch, scroller)
- Modify: `src/view/release/renderIndex.ts` (export the band parts; extract `drawIndexActions`; `bandLabel` takes extra figures)
- Modify: `src/view/render/timeline.ts` (export `renderGridLines`; no other change)
- Modify: `src/i18n/en.ts` (three `release.map.*` keys)
- Modify: `docs/requirements/Every release on a map.md` (`## Where it lives`)
- Test: `test/view/release/releaseMap.test.ts`

**Interfaces:**

- Consumes: `releaseMap`, `ReleaseMap`, `MapRow`, `MapCard` (Task 2); `RELEASE_MAP_TAB`, `loadViewState`, `updateViewPrefs` (Task 1); `barGeometry(window, span): BarGeometry`, `scaleFor('month'): TimelineScale`, `superCells`, `timelineCells` (`src/domain/timeline.ts`); `renderGridLines(content: HTMLElement, window: TimelineWindow, scale: TimelineScale, leadWidth: number): void` (now exported); `drawUnresolved(listEl, index, collision)`; `setTooltip(el, text)` (`obsidian`).
- Produces:
  - `export type ReleaseTab = 'list' | 'map';` and `ReleaseView.tab: ReleaseTab`, `ReleaseView.setTab(tab: ReleaseTab): void` (`releaseView.ts`)
  - `export function renderMap(view: ReleaseView, map: ReleaseMap, index: ReleaseIndex, plan: BacklogSettings): void` (`renderMap.ts`)
  - From `renderIndex.ts`, newly exported: `drawIndexActions(view: ReleaseView): HTMLElement`, `drawVersion(line: HTMLElement, row: ReleaseRow): void`, `drawStatus(line: HTMLElement, row: ReleaseRow): void`, `drawWhen(line: HTMLElement, row: ReleaseRow): void`, `drawNote(line: HTMLElement, row: ReleaseRow): void`, `drawProgressLine(line: HTMLElement, row: ReleaseRow): void`, `overdueVisible(row: ReleaseRow): boolean`, `bandLabel(row: ReleaseRow, extra?: string[]): string`
  - Keys: `release.map.shelf`, `release.map.more` (`{count}`), `release.map.derivedStart`
  - Classes: `.pbl-relmap-scroll`, `.pbl-relmap`, `.pbl-relmap-ruler`, `.pbl-relmap-tier`, `.pbl-relmap-cell`, `.pbl-relmap-cell-year`, `.pbl-relmap-today-label`, `.pbl-relmap-rows`, `button.pbl-relmap-row`, `.pbl-relmap-shipped`, `.pbl-relmap-clipped`, `.pbl-relmap-lead`, `.pbl-relmap-tick`, `.pbl-relmap-slip`, `.pbl-relmap-late`, `.pbl-relmap-early`, `.pbl-relmap-marker`, `.pbl-relmap-slot`, `.pbl-relmap-card`, `.pbl-relmap-line`, `.pbl-relmap-facts`, `.pbl-relmap-name`, `.pbl-relmap-scope`, `.pbl-relmap-scope-item`, `.pbl-relmap-more`, `.pbl-relmap-shelf`, `.pbl-relmap-shelf-cards`, `.pbl-relmap-shelf-row`; reused: `.pbl-today`, `.pbl-grid-line`, `.pbl-rel-overdue`, `.pbl-rel-group`.

- [ ] **Step 1: Write the failing test**

Create `test/view/release/releaseMap.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_TIMELINE_DAYS } from '../../../src/domain/timeline';
import { loadViewState } from '../../../src/storage/viewStateStore';
import { button, makeReleaseView, noReleaseVault, RELEASE_CONFIG, releaseVault, scopeVault } from '../../helpers/release';
import { FakeVault } from '../../helpers/vault';
import { useViewHarness } from '../../helpers/view';
import { beyondPlan } from '../../helpers/window';

useViewHarness();

/** `makeReleaseView` with a `.base` leaf names the view `Backlog` under `Releases.base`. */
const ID = { base: 'Releases.base', view: 'Backlog' };
const STORE_KEY = 'product-backlog:view-state';

function onMap(vault: FakeVault, config: Record<string, unknown> = RELEASE_CONFIG) {
	const harness = makeReleaseView(vault, config, { base: 'Releases.base' });
	harness.view.setTab('map');
	return harness;
}

function release(vault: FakeVault, path: string, frontmatter: Record<string, unknown>): void {
	vault.addFile(path, { frontmatter: { type: 'Release', ...frontmatter } });
}

const paths = (el: HTMLElement, selector: string) =>
	Array.from(el.querySelectorAll<HTMLElement>(selector), (node) => node.dataset.path);
const texts = (el: Element, selector: string) => Array.from(el.querySelectorAll(selector), (node) => node.textContent);
const cssPx = (el: Element | null | undefined, name: string) =>
	parseFloat((el as HTMLElement | null | undefined)?.style.getPropertyValue(name) ?? 'NaN');
const rowOf = (el: HTMLElement, path: string) => el.querySelector<HTMLElement>(`.pbl-relmap-row[data-path="${path}"]`);

describe('the release map', () => {
	it('draws one row per dated release in date order, and the undated one on the shelf', () => {
		const { view } = onMap(releaseVault());
		expect(paths(view.viewEl, '.pbl-relmap-rows .pbl-relmap-row')).toEqual(['0.8.md', '0.9.md']);
		expect(paths(view.viewEl, '.pbl-relmap-shelf .pbl-relmap-row')).toEqual(['Someday.md']);
		expect(view.viewEl.querySelector('.pbl-relmap-shelf h2')?.textContent).toBe('Not scheduled (1)');
		expect(view.viewEl.querySelector('.pbl-rel-bands')).toBeNull();
	});

	it('draws a band only where a start was derived, and names it as derived', () => {
		const { view } = onMap(releaseVault());
		const first = rowOf(view.viewEl, '0.8.md');
		const second = rowOf(view.viewEl, '0.9.md');
		expect(first?.querySelector('.pbl-relmap-lead')).toBeNull();
		expect(first?.getAttribute('aria-label')).not.toContain('derived');
		const lead = second?.querySelector('.pbl-relmap-lead');
		expect(lead?.getAttribute('data-tooltip')).toBe('Start derived from the previous release');
		expect(second?.getAttribute('aria-label')).toContain('Start derived from the previous release');
		// The band runs from the first row's marker to the second row's.
		expect(cssPx(lead, '--pbl-relmap-x')).toBe(cssPx(first?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x'));
		expect(cssPx(lead, '--pbl-relmap-x') + cssPx(lead, '--pbl-relmap-w')).toBe(
			cssPx(second?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x'),
		);
	});

	it('draws no band for a release ending the same day as the one before it', () => {
		const vault = new FakeVault();
		release(vault, 'A.md', { 'target-date': '2026-10-01', order: 1 });
		release(vault, 'B.md', { 'target-date': '2026-10-01', order: 2 });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-lead')).toBeNull();
		expect(rowOf(view.viewEl, 'B.md')?.getAttribute('aria-label')).not.toContain('derived');
	});

	it('draws a slip as a tick at the target and a stub in the colour of its direction', () => {
		const vault = new FakeVault();
		release(vault, 'Late.md', { 'target-date': '2026-08-01', released: '2026-08-08' });
		release(vault, 'Early.md', { 'target-date': '2026-08-20', released: '2026-08-15' });
		release(vault, 'OnTime.md', { 'target-date': '2026-08-25', released: '2026-08-25' });
		const { view } = onMap(vault);

		const late = rowOf(view.viewEl, 'Late.md');
		expect(late?.classList.contains('pbl-relmap-shipped')).toBe(true);
		const lateTick = cssPx(late?.querySelector('.pbl-relmap-tick'), '--pbl-relmap-x');
		// Late: the stub starts at the tick and runs forward to the marker.
		expect(cssPx(late?.querySelector('.pbl-relmap-slip.pbl-relmap-late'), '--pbl-relmap-x')).toBe(lateTick);
		expect(lateTick).toBeLessThan(cssPx(late?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x'));

		// Early: the stub starts at the marker and runs forward to the tick.
		const early = rowOf(view.viewEl, 'Early.md');
		const earlyMarker = cssPx(early?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x');
		expect(cssPx(early?.querySelector('.pbl-relmap-slip.pbl-relmap-early'), '--pbl-relmap-x')).toBe(earlyMarker);
		expect(cssPx(early?.querySelector('.pbl-relmap-tick'), '--pbl-relmap-x')).toBeGreaterThan(earlyMarker);

		const onTime = rowOf(view.viewEl, 'OnTime.md');
		expect(onTime?.querySelector('.pbl-relmap-tick')).toBeNull();
		expect(onTime?.querySelector('.pbl-relmap-slip')).toBeNull();
	});

	it("draws the card's facts and headline scope from the list's own figures", () => {
		const { view } = onMap(scopeVault());
		const card = rowOf(view.viewEl, 'R.md')?.querySelector('.pbl-relmap-card');
		if (!card) throw new Error('no card for R.md');
		expect(card.querySelector('.pbl-relmap-name')?.textContent).toBe('R');
		expect(card.querySelector('.pbl-rel-version')?.textContent).toBe('1.0.0');
		expect(card.querySelector('.pbl-state-text')?.textContent).toBe('In progress');
		expect(card.querySelector('.pbl-rel-date')?.textContent).toBe('2026-09-12');
		expect(card.querySelector('.pbl-rel-days')?.textContent).toBe('12 days left');
		expect(card.querySelector('.pbl-rel-progress')?.textContent).toBe('0 of 2 items done');
		// The scope's one root is the context Epic holding both members in place.
		expect(texts(card, '.pbl-relmap-scope-item')).toEqual(['E']);
		expect(card.querySelector('.pbl-relmap-more')).toBeNull();
	});

	it('lists three headline items and counts the rest', () => {
		const vault = new FakeVault();
		release(vault, 'R.md', { 'target-date': '2026-09-12' });
		for (let i = 1; i <= 5; i++) vault.addFile(`P${i}.md`, { frontmatter: { type: 'PBI', order: i, release: '[[R]]' } });
		const { view } = onMap(vault);
		expect(texts(view.viewEl, '.pbl-relmap-scope-item')).toEqual(['P1', 'P2', 'P3']);
		expect(view.viewEl.querySelector('.pbl-relmap-more')?.textContent).toBe('+2 more');
	});

	it('paints a row overdue exactly where the list would', () => {
		const vault = new FakeVault();
		release(vault, 'Late.md', { 'target-date': '2026-08-20' });
		const bound = onMap(vault);
		expect(rowOf(bound.view.viewEl, 'Late.md')?.classList.contains('pbl-rel-overdue')).toBe(true);
		expect(rowOf(bound.view.viewEl, 'Late.md')?.querySelector('.pbl-rel-band-note')?.textContent).toBe('11 days overdue');

		const unbound = onMap(vault, { ...RELEASE_CONFIG, releasedDateProperty: '' });
		expect(rowOf(unbound.view.viewEl, 'Late.md')?.classList.contains('pbl-rel-overdue')).toBe(false);
	});

	it('opens a release on a click, and Back returns to the map', () => {
		const { view } = onMap(scopeVault());
		button(view, '.pbl-relmap-row[data-path="R.md"]').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).toBeNull();
		button(view, '.pbl-rel-back').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
		expect(loadViewState(view.app, ID).prefs.release).toBeUndefined();
	});

	it('reports the unresolved memberships beneath the map', () => {
		const vault = releaseVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 1, release: '[[Gone]]' } });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-scroll .pbl-rel-unresolved')).not.toBeNull();
	});

	it('writes nothing to a note or to the .base', () => {
		const { view, vault, config } = onMap(scopeVault());
		const files = vault.files.size;
		button(view, '.pbl-relmap-row[data-path="R.md"]').click();
		button(view, '.pbl-rel-back').click();
		view.setTab('list');
		expect(vault.writeLog).toEqual([]);
		expect(vault.files.size).toBe(files);
		expect(config.setCalls).toEqual([]);
	});
});

describe('the inputs most likely to surprise the map', () => {
	it('with no dated release at all, draws the ruler and puts every release on the shelf', () => {
		const vault = new FakeVault();
		release(vault, 'A.md', { order: 1 });
		release(vault, 'B.md', { order: 2 });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-rows .pbl-relmap-row')).toBeNull();
		expect(paths(view.viewEl, '.pbl-relmap-shelf .pbl-relmap-row')).toEqual(['A.md', 'B.md']);
		expect(view.viewEl.querySelectorAll('.pbl-relmap-cell').length).toBeGreaterThan(0);
	});

	it('with every release shipped, draws no shelf', () => {
		const vault = new FakeVault();
		release(vault, 'A.md', { 'target-date': '2026-07-01', released: '2026-07-02' });
		release(vault, 'B.md', { 'target-date': '2026-08-01', released: '2026-08-01' });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-shelf')).toBeNull();
	});

	it('shelves a release whose target nobody can read, and says so on its card', () => {
		const vault = new FakeVault();
		release(vault, 'Bad.md', { 'target-date': 'soon' });
		const { view } = onMap(vault);
		const card = view.viewEl.querySelector('.pbl-relmap-shelf .pbl-relmap-row[data-path="Bad.md"]');
		expect(card?.querySelector('.pbl-rel-unreadable')?.textContent).toBe('Target unreadable');
	});

	it('pins a release past the drawable window to its edge, marks it clipped, and still states its date', () => {
		const vault = new FakeVault();
		release(vault, 'Far.md', { 'target-date': beyondPlan() });
		const { view } = onMap(vault);
		const row = rowOf(view.viewEl, 'Far.md');
		expect(row?.classList.contains('pbl-relmap-clipped')).toBe(true);
		expect(cssPx(row?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x')).toBe((MAX_TIMELINE_DAYS - 1) * 4);
		expect(row?.querySelector('.pbl-rel-date')?.textContent).toBe(beyondPlan());
	});
});

describe('the tab is view state', () => {
	it('restores the map from the store on the next data update', () => {
		const { view } = onMap(releaseVault());
		expect(loadViewState(view.app, ID).prefs.releaseTab).toBe('map');
		view.tab = 'list';
		view.onDataUpdated();
		expect(view.tab).toBe('map');
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
	});

	it('draws the list for a stored tab it does not recognise', () => {
		const { view, vault } = onMap(releaseVault());
		const [key, entry] = Object.entries(vault.localStorage.get(STORE_KEY) as Record<string, Record<string, unknown>>)[0];
		vault.localStorage.set(STORE_KEY, { [key]: { ...entry, prefs: { releaseTab: 'Map' } } });
		view.onDataUpdated();
		expect(view.viewEl.querySelector('.pbl-relmap')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-bands')).not.toBeNull();
	});

	it('keeps the tab for the session on an embedded base', () => {
		const { view } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		view.setTab('map');
		view.onDataUpdated();
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
	});

	it.each([
		['no type property', releaseVault, { ...RELEASE_CONFIG, typeProperty: '' }],
		['no release', noReleaseVault, RELEASE_CONFIG],
	] as const)('draws the same empty state on both tabs with %s', (_, vaultOf, config) => {
		const { view } = makeReleaseView(vaultOf(), config, { base: 'Releases.base' });
		const list = view.viewEl.innerHTML;
		view.setTab('map');
		expect(view.viewEl.innerHTML).toBe(list);
	});
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run test/view/release/releaseMap.test.ts`
Expected: FAIL — `view.setTab is not a function`.

- [ ] **Step 3: Implement**

**3a. `src/view/render/timeline.ts`** — change `function renderGridLines(` to `export function renderGridLines(`. Nothing else.

**3b. `src/i18n/en.ts`** — insert before the doc comment of `'release.scope.back'`:

```ts
	/** The release map's shelf (`release/renderMap.ts`), counted through
	 *  `release.index.group.count` like the list's two group headings. */
	'release.map.shelf': 'Not scheduled',
	/** A map card's headline scope, after its first three items. */
	'release.map.more': { one: '+{count} more', other: '+{count} more' },
	/** The faded band before a release's end marker — its tooltip and its spoken half. The
	 *  one date on the map no note holds, so it always says where it came from. */
	'release.map.derivedStart': 'Start derived from the previous release',

```

**3c. `src/view/release/renderIndex.ts`:**

Replace the four lines that open `renderIndex` (the comment block stays, above the new function):

```ts
	const actionsEl = view.viewEl.createDiv({ cls: 'pbl-rel-actions' });
	renderReleaseInit(view, actionsEl, 'bar');
	renderNewRelease(view, actionsEl);
	const listEl = view.viewEl.createDiv({ cls: 'pbl-rel-list' });
```

with:

```ts
	drawIndexActions(view);
	const listEl = view.viewEl.createDiv({ cls: 'pbl-rel-list' });
```

and add, directly after `renderIndex`, moving the "Above the scroller rather than in it…" comment onto it:

```ts
/**
 * The head of the index on either tab — the list's and the map's alike. Above the scroller
 * rather than in it: the controls are chrome for the screen, and one inside the scroller
 * would scroll away with the rows. The ✨ goes first so the primary action (`New release`)
 * stays last — the position a reader's eye and tab order both land on.
 */
export function drawIndexActions(view: ReleaseView): HTMLElement {
	const actionsEl = view.viewEl.createDiv({ cls: 'pbl-rel-actions' });
	renderReleaseInit(view, actionsEl, 'bar');
	renderNewRelease(view, actionsEl);
	return actionsEl;
}
```

Add `export` to `drawVersion`, `drawStatus`, `drawWhen`, `drawProgressLine`, `overdueVisible`, `drawNote` and `bandLabel`. Change `bandLabel` to take the map's extra figures:

```ts
export function bandLabel(row: ReleaseRow, extra: string[] = []): string {
	const figures: string[] = [];
	const version = speakLabelled(row.version, t('release.index.column.version'));
	if (version !== null) figures.push(version);
	figures.push(...speakWhen(row));
	const status = speakLabelled(row.status, t('release.index.column.status'));
	if (status !== null) figures.push(status);
	const progress = speakProgress(row);
	if (progress !== null) figures.push(progress);
	const note = noteText(row);
	if (note !== null) figures.push(note);
	figures.push(...extra);
	return t('release.index.rowLabel', { name: row.name, figures });
}
```

Add one sentence to its doc comment: "`extra` is what the map adds after the list's own figures — the derived start."

**3d. Create `src/view/release/renderMap.ts`:**

```ts
import { setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { CivilDate } from '../../domain/noteFields';
import { MapCard, MapRow, ReleaseMap } from '../../domain/releaseMap';
import { ReleaseIndex } from '../../domain/releases';
import { BacklogSettings } from '../../domain/settings';
import { membershipCollision } from '../../domain/settingsConsistency';
import { barGeometry, BarGeometry, scaleFor, superCells, TimelineCell, timelineCells, TimelineWindow } from '../../domain/timeline';
import { renderGridLines } from '../render/timeline';
import {
	bandLabel,
	drawIndexActions,
	drawNote,
	drawProgressLine,
	drawStatus,
	drawUnresolved,
	drawVersion,
	drawWhen,
	overdueVisible,
} from './renderIndex';

/**
 * The index's Map tab (`docs/requirements/Every release on a map.md`): one row per dated
 * release under a month ruler, then the shelf, then the unresolved note.
 *
 * **It draws, and derives nothing.** Order, start, slip and shelf come from
 * `domain/releaseMap.ts`; every fact on a card is the list's own band part
 * (`renderIndex.ts`), so a card and a band cannot word one release differently.
 *
 * **Every element inside a row is a `<span>`**: the row is a `<button>`, whose content is
 * phrasing content only — `renderIndex.ts`'s `drawBand` states the rule.
 */

/** The map's one density: scale switching is out of scope, so `scaleFor`'s default is read once. */
const SCALE = scaleFor('month');

const px = (days: number): string => `${days * SCALE.dayPx}px`;

/** Where one date sits, clamped into the window — `barGeometry` asked of a point. */
const pointAt = (window: TimelineWindow, date: CivilDate): BarGeometry => barGeometry(window, { start: date, target: date });

export function renderMap(view: ReleaseView, map: ReleaseMap, index: ReleaseIndex, plan: BacklogSettings): void {
	drawIndexActions(view);
	const scroller = view.viewEl.createDiv({ cls: 'pbl-relmap-scroll' });
	const mapEl = scroller.createDiv({ cls: 'pbl-relmap' });
	// `--pbl-tl-line` is what the reused `.pbl-today` reads for its width (`styles/timeline.css`).
	mapEl.setCssProps({ '--pbl-relmap-track': px(map.window.days), '--pbl-tl-line': `${SCALE.lineWidth}px` });
	drawRuler(mapEl, map);
	const rowsEl = mapEl.createDiv({ cls: 'pbl-relmap-rows' });
	renderGridLines(rowsEl, map.window, SCALE, 0);
	const todayEl = rowsEl.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } });
	todayEl.setCssProps({ '--pbl-today-left': px(pointAt(map.window, map.today).startDay) });
	for (const row of map.rows) drawRow(view, rowsEl, map.window, row);
	drawShelf(view, scroller, map.shelf);
	drawUnresolved(scroller, index, membershipCollision(view.settings, plan));
}

/** Years over months, and today's label hanging BELOW the ruler so it never covers a month. */
function drawRuler(mapEl: HTMLElement, map: ReleaseMap): void {
	const ruler = mapEl.createDiv({ cls: 'pbl-relmap-ruler', attr: { 'aria-hidden': 'true' } });
	const tiers: Array<[TimelineCell[], string]> = [
		[superCells(map.window, SCALE), 'pbl-relmap-cell pbl-relmap-cell-year'],
		[timelineCells(map.window, SCALE), 'pbl-relmap-cell'],
	];
	for (const [cells, cls] of tiers) {
		const tier = ruler.createDiv({ cls: 'pbl-relmap-tier' });
		for (const cell of cells) tier.createDiv({ cls, text: cell.label }).setCssProps({ '--pbl-relmap-cell-w': px(cell.days) });
	}
	const label = ruler.createDiv({ cls: 'pbl-relmap-today-label', text: t('legend.today') });
	label.setCssProps({ '--pbl-relmap-x': px(pointAt(map.window, map.today).startDay) });
}

function drawRow(view: ReleaseView, rowsEl: HTMLElement, window: TimelineWindow, row: MapRow): void {
	const end = pointAt(window, row.end);
	const derived = row.start === null ? [] : [t('release.map.derivedStart')];
	const rowEl = rowsEl.createEl('button', {
		cls: 'pbl-relmap-row',
		attr: { type: 'button', 'data-path': row.release.path, 'aria-label': bandLabel(row.release, derived) },
	});
	rowEl.toggleClass('pbl-relmap-shipped', row.release.shipped);
	// The list's own refusal: an unbound or unreadable released date paints nothing red.
	rowEl.toggleClass('pbl-rel-overdue', overdueVisible(row.release));
	rowEl.toggleClass('pbl-relmap-clipped', end.outside);
	if (row.start !== null) drawLead(rowEl, barGeometry(window, { start: row.start, target: row.end }));
	if (row.slipTarget !== null) drawSlip(rowEl, pointAt(window, row.slipTarget).startDay, end.startDay, (row.release.slip ?? 0) > 0);
	rowEl.createSpan({ cls: 'pbl-relmap-marker' }).setCssProps({ '--pbl-relmap-x': px(end.startDay) });
	const slot = rowEl.createSpan({ cls: 'pbl-relmap-slot' });
	slot.setCssProps({ '--pbl-relmap-x': px(end.startDay) });
	drawCard(slot, row);
	rowEl.addEventListener('click', () => view.pick(row.release.path));
}

/** The derived start: faded, dashed, and named as derived — never a date a note holds. */
function drawLead(rowEl: HTMLElement, lead: BarGeometry): void {
	const el = rowEl.createSpan({ cls: 'pbl-relmap-lead' });
	el.setCssProps({ '--pbl-relmap-x': px(lead.startDay), '--pbl-relmap-w': px(lead.spanDays - 1) });
	setTooltip(el, t('release.map.derivedStart'));
}

/** A tick at the target, and a stub from it to the released date — forward when late, back when early. */
function drawSlip(rowEl: HTMLElement, tickDay: number, endDay: number, late: boolean): void {
	rowEl.createSpan({ cls: 'pbl-relmap-tick' }).setCssProps({ '--pbl-relmap-x': px(tickDay) });
	// Two toggles, not a ternary inside a template: `TEXT_TERNARY` in `eslint.config.mjs`
	// refuses that shape whatever the strings are, and says to use `addClass` instead.
	const stub = rowEl.createSpan({ cls: 'pbl-relmap-slip' });
	stub.toggleClass('pbl-relmap-late', late);
	stub.toggleClass('pbl-relmap-early', !late);
	stub.setCssProps({ '--pbl-relmap-x': px(Math.min(tickDay, endDay)), '--pbl-relmap-w': px(Math.abs(endDay - tickDay)) });
}

/** Line 1: name, version, status. Line 2: the date figure, its note, the progress. Then the headline. */
function drawCard(parent: HTMLElement, card: MapCard): void {
	const cardEl = parent.createSpan({ cls: 'pbl-relmap-card' });
	const line1 = cardEl.createSpan({ cls: 'pbl-relmap-line' });
	line1.createSpan({ cls: 'pbl-relmap-name', text: card.release.name });
	drawVersion(line1, card.release);
	drawStatus(line1, card.release);
	const line2 = cardEl.createSpan({ cls: 'pbl-relmap-line pbl-relmap-facts' });
	drawWhen(line2, card.release);
	drawNote(line2, card.release);
	drawProgressLine(line2, card.release);
	if (card.headline.length === 0) return;
	const scopeEl = cardEl.createSpan({ cls: 'pbl-relmap-scope' });
	for (const title of card.headline) scopeEl.createSpan({ cls: 'pbl-relmap-scope-item', text: title });
	if (card.more > 0) scopeEl.createSpan({ cls: 'pbl-relmap-more', text: t('release.map.more', { count: card.more }) });
}

/** Drawn only when it holds something: an empty "Not scheduled (0)" is a heading over nothing. */
function drawShelf(view: ReleaseView, scroller: HTMLElement, shelf: MapCard[]): void {
	if (shelf.length === 0) return;
	const shelfEl = scroller.createDiv({ cls: 'pbl-relmap-shelf' });
	const label = t('release.map.shelf');
	shelfEl.createEl('h2', { cls: 'pbl-rel-group', text: t('release.index.group.count', { label, count: shelf.length }) });
	const cardsEl = shelfEl.createDiv({ cls: 'pbl-relmap-shelf-cards' });
	for (const card of shelf) {
		const btn = cardsEl.createEl('button', {
			cls: 'pbl-relmap-row pbl-relmap-shelf-row',
			attr: { type: 'button', 'data-path': card.release.path, 'aria-label': bandLabel(card.release) },
		});
		drawCard(btn, card);
		btn.addEventListener('click', () => view.pick(card.release.path));
	}
}
```

**3e. `src/view/release/releaseView.ts`:**

Imports — add:

```ts
import { releaseMap } from '../../domain/releaseMap';
import { RELEASE_MAP_TAB } from '../../storage/viewStateStore';
import { renderMap } from './renderMap';
```

(merge `RELEASE_MAP_TAB` into the existing `loadViewState, updateViewPrefs` import line.)

After `export const RELEASE_VIEW_TYPE = 'product-release';`:

```ts
/** The index's two tabs. View state, never a `.base` setting (ADR 0011). */
export type ReleaseTab = 'list' | 'map';

/**
 * What `draw` answers for the map, so the scroll restore treats a tab change as a change of
 * screen. A NUL never appears in a vault path, so it never equals a release's path.
 */
const MAP_KEY = '\u0000map';
```

Field, after `pickedPath`:

```ts
	/** Which tab the index draws. Restored with the pick; session-only on an embedded base. */
	tab: ReleaseTab = 'list';
```

Method, after `pick`:

```ts
	/**
	 * Switch the index's tab. Persists `'map'` only — the list is absence — then redraws:
	 * no config was set and no Bases refresh is coming. Writes nothing to the vault.
	 */
	setTab(tab: ReleaseTab): void {
		this.tab = tab;
		const id = resolveViewIdentity(this.app, this.viewEl, this.config.name ?? '');
		if (id) updateViewPrefs(this.app, id, { releaseTab: tab === 'map' ? RELEASE_MAP_TAB : undefined });
		this.render();
	}
```

In `restorePick`, replace the last line:

```ts
		this.pickedPath = loadViewState(this.app, id).prefs.release ?? null;
```

with:

```ts
		const prefs = loadViewState(this.app, id).prefs;
		this.pickedPath = prefs.release ?? null;
		// Anything but the one stored word is the list — the store already refused the rest.
		this.tab = prefs.releaseTab === RELEASE_MAP_TAB ? 'map' : 'list';
```

In `scrollerEl`, change the selector to `'.pbl-rel-list, .pbl-tree, .pbl-relmap-scroll'`.

In `draw`, before `const index = releaseIndex(`, add `const today = todayCivil();` and change `today: todayCivil(),` to `today,`. Replace the block:

```ts
		if (scope === null || scope.release === null) {
			renderIndex(this, index, backlogSettings);
			return null;
		}
```

with:

```ts
		if (scope === null || scope.release === null) {
			if (this.tab === 'map') {
				// A local: the closure below would lose `this.model`'s narrowing.
				const model = this.model;
				const map = releaseMap(index, (path) => releaseScope(this.app, model, this.settings, index, path).rows, today);
				renderMap(this, map, index, backlogSettings);
				return MAP_KEY;
			}
			renderIndex(this, index, backlogSettings);
			return null;
		}
```

**3f. `docs/requirements/Every release on a map.md`** — append to `## Where it lives`:

```markdown

`src/view/release/renderMap.ts` draws it: the ruler from `superCells` and `timelineCells`,
the grid lines and today line `src/view/render/timeline.ts` draws for the roadmap, the band,
marker and slip stub placed by `barGeometry`, and a card built from
`src/view/release/renderIndex.ts`'s own band parts. `src/view/release/releaseView.ts` holds
the tab, restores it with the pick, and draws the map in place of the list when it is set.
Tested in `test/view/release/releaseMap.test.ts`.
```

- [ ] **Step 4: Run it, see it pass**

Run: `npx vitest run test/view/release/releaseMap.test.ts`
Expected: PASS. Then `npm test` — the existing release suites must stay green (the list's markup did not change).

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add src/view/release/renderMap.ts src/view/release/releaseView.ts src/view/release/renderIndex.ts src/view/render/timeline.ts src/i18n/en.ts test/view/release/releaseMap.test.ts "docs/requirements/Every release on a map.md"
git commit -m "feat(release): draw the release plan as a map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: The `List | Map` control

**Files:**

- Modify: `src/view/release/renderIndex.ts` (`drawTabs`, called first in `drawIndexActions`)
- Modify: `src/view/release/releaseView.ts` (`FOCUS_HANDLE_CLASSES`, `syncBusy` selector)
- Modify: `src/i18n/en.ts` (five `release.tab.*` keys)
- Test: `test/view/release/releaseTabs.test.ts`

**Interfaces:**

- Consumes: `iconButton(parent: HTMLElement, icon: string, label: string, key?: string): HTMLButtonElement` (`src/view/render/toolbarControls.ts`), the backlog switcher's shape (`renderModeToggle` in `src/view/render/toolbar.ts`), `ReleaseView.tab`, `ReleaseView.setTab` (Task 3), `type ReleaseTab`.
- Produces: `.pbl-btn-group.pbl-rel-tabs[role=group]` with two `button.pbl-mode-btn.pbl-rel-tab` (`.pbl-rel-tab-list`, `.pbl-rel-tab-map`), `aria-pressed` on each. Keys `release.tab.group`, `release.tab.list`, `release.tab.listWord`, `release.tab.map`, `release.tab.mapWord`.

- [ ] **Step 1: Write the failing test**

Create `test/view/release/releaseTabs.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadViewState } from '../../../src/storage/viewStateStore';
import { WriteLock } from '../../../src/view/writeLock';
import { button, makeReleaseView, RELEASE_CONFIG, releaseVault, scopeVault } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';

useViewHarness();

const ID = { base: 'Releases.base', view: 'Backlog' };

function mounted(lock = new WriteLock()) {
	return makeReleaseView(releaseVault(), RELEASE_CONFIG, { base: 'Releases.base', lock });
}

describe('the List | Map control', () => {
	it('heads the index as a named group, with List pressed', () => {
		const { view } = mounted();
		const group = view.viewEl.querySelector('.pbl-rel-actions .pbl-rel-tabs');
		expect(group?.getAttribute('role')).toBe('group');
		expect(group?.getAttribute('aria-label')).toBe('Show releases as');
		expect(button(view, '.pbl-rel-tab-list').getAttribute('aria-pressed')).toBe('true');
		expect(button(view, '.pbl-rel-tab-map').getAttribute('aria-pressed')).toBe('false');
		// First in the bar, so `New release` stays last.
		expect(view.viewEl.querySelector('.pbl-rel-actions')?.firstElementChild).toBe(group);
	});

	it('switches to the map, presses Map, and remembers only that word', () => {
		const { view } = mounted();
		button(view, '.pbl-rel-tab-map').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
		expect(button(view, '.pbl-rel-tab-map').getAttribute('aria-pressed')).toBe('true');
		expect(loadViewState(view.app, ID).prefs.releaseTab).toBe('map');

		button(view, '.pbl-rel-tab-list').click();
		expect(view.viewEl.querySelector('.pbl-rel-bands')).not.toBeNull();
		expect(loadViewState(view.app, ID).prefs.releaseTab).toBeUndefined();
	});

	it('keeps focus on the tab that was pressed, across the redraw it caused', () => {
		const { view } = mounted();
		const map = button(view, '.pbl-rel-tab-map');
		map.focus();
		map.click();
		expect(document.activeElement).not.toBe(map);
		expect(document.activeElement).toBe(button(view, '.pbl-rel-tab-map'));
	});

	it('keeps focus on the same map row across a data update', () => {
		const { view } = mounted();
		view.setTab('map');
		button(view, '.pbl-relmap-row[data-path="0.9.md"]').focus();
		view.onDataUpdated();
		expect((document.activeElement as HTMLElement | null)?.dataset.path).toBe('0.9.md');
	});

	it('stays enabled while a write holds the lock, since switching tabs writes nothing', () => {
		const lock = new WriteLock();
		const { view } = mounted(lock);
		lock.applying = true;
		lock.notify();
		expect(button(view, '.pbl-rel-new').disabled).toBe(true);
		expect(button(view, '.pbl-rel-tab-list').disabled).toBe(false);
		expect(button(view, '.pbl-rel-tab-map').disabled).toBe(false);
	});

	it('is not drawn on a release’s own screen', () => {
		const { view } = makeReleaseView(scopeVault(), RELEASE_CONFIG, { base: 'Releases.base' });
		view.pick('R.md');
		expect(view.viewEl.querySelector('.pbl-rel-tabs')).toBeNull();
	});
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run test/view/release/releaseTabs.test.ts`
Expected: FAIL — `control not found: .pbl-rel-tab-list` (and `.pbl-rel-tabs` is null). The scope-screen test passes already.

- [ ] **Step 3: Implement**

**`src/i18n/en.ts`** — insert before `'release.map.shelf'`'s doc comment:

```ts
	/** The index's two tabs (`release/renderIndex.ts`'s `drawTabs`) — the backlog
	 *  switcher's shape: each position's accessible name, and the shorter word it shows. */
	'release.tab.group': 'Show releases as',
	'release.tab.list': 'Show as list',
	'release.tab.listWord': 'List',
	'release.tab.map': 'Show as map',
	'release.tab.mapWord': 'Map',
```

**`src/view/release/renderIndex.ts`** — imports:

```ts
import type { ReleaseTab, ReleaseView } from './releaseView';
import { iconButton } from '../render/toolbarControls';
```

(replace the existing `import type { ReleaseView } from './releaseView';`.)

In `drawIndexActions`, call `drawTabs(view, actionsEl);` as the first line after `actionsEl` is created. Add below it:

```ts
/**
 * `List | Map` — `renderModeToggle`'s shape (`render/toolbar.ts`): one segmented group, the
 * word inside the accessible name, `aria-pressed` on the current position. First in the
 * bar; `.pbl-rel-tabs` pushes the rest to the end.
 */
function drawTabs(view: ReleaseView, actionsEl: HTMLElement): void {
	const group = actionsEl.createDiv({
		cls: 'pbl-btn-group pbl-rel-tabs',
		attr: { role: 'group', 'aria-label': t('release.tab.group') },
	});
	const position = (tab: ReleaseTab, icon: string, label: string, word: string) => {
		const btn = iconButton(group, icon, label);
		btn.addClass('pbl-mode-btn', 'pbl-rel-tab', `pbl-rel-tab-${tab}`);
		btn.createSpan({ cls: 'pbl-btn-label', text: word });
		const active = view.tab === tab;
		btn.toggleClass('is-active', active);
		btn.setAttribute('aria-pressed', String(active));
		btn.addEventListener('click', () => view.setTab(tab));
	};
	position('list', 'list', t('release.tab.list'), t('release.tab.listWord'));
	position('map', 'map', t('release.tab.map'), t('release.tab.mapWord'));
}
```

**`src/view/release/releaseView.ts`:**

Append to `FOCUS_HANDLE_CLASSES`, after `'pbl-rel-notes',`:

```ts
	// The index's two tabs and the map's rows (2026-10-12). A tab press redraws the screen
	// it sits on — the sharp case again. A map row is `pbl-rel-band`'s case, matched on
	// `data-path` so a refresh lands on the same release rather than the first.
	'pbl-rel-tab-list',
	'pbl-rel-tab-map',
	'pbl-relmap-row',
```

In `syncBusy`, change the selector to `'.pbl-rel-actions button:not(.pbl-rel-tab)'` and add one line to its doc comment: "The tabs are left out: switching tabs writes nothing, so a batch has no reason to block it."

- [ ] **Step 4: Run it, see it pass**

Run: `npx vitest run test/view/release/releaseTabs.test.ts`, then `npm test`.
Expected: PASS. If a release suite asserts the bar's first control or the focus fallback, it is reading `.pbl-rel-actions`'s first button, which is now the List tab — read that test's claim before changing it; none of the ones read while planning does (`initControl.test.ts` and `newRelease.test.ts` assert exact matches or the scope screen, which has no tabs).

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add src/view/release/renderIndex.ts src/view/release/releaseView.ts src/i18n/en.ts test/view/release/releaseTabs.test.ts
git commit -m "feat(release): add the List | Map control to the release index" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: The stylesheet

**Files:**

- Create: `styles/releaseMap.css`
- Modify: `styles/index.css`
- Test: `test/view/releaseStyleRules.test.ts` (append a `describe`)

**Interfaces:**

- Consumes: the classes Task 3 and Task 4 produce; `--pbl-relmap-track`, `--pbl-relmap-x`, `--pbl-relmap-w`, `--pbl-relmap-cell-w` set by `renderMap.ts`; `.pbl-today` / `.pbl-grid-line` (`timeline.css`, `timelineFurniture.css`); `.pbl-rel-bar`, `.pbl-rel-group`, `.pbl-rel-overdue` (`release.css`); `.pbl-btn-group`, `.pbl-mode-btn` (`toolbar.css`).
- Produces: the assembled sheet's map rules. Card width is `--pbl-relmap-card` (280px), declared here.

- [ ] **Step 1: Write the failing test**

Append to `test/view/releaseStyleRules.test.ts`:

```ts
describe('the release map lays itself out', () => {
	it('undoes Obsidian’s own button appearance on a row, as the band does', () => {
		for (const decl of ['background-color: transparent;', 'box-shadow: none;', 'border-radius: 0;', 'block-size: auto;']) {
			expect(ruleAt('button.pbl-relmap-row', decl), decl).toBeGreaterThan(-1);
		}
		expect(ruleAt('button.pbl-relmap-row:hover', 'box-shadow: none;')).toBeGreaterThan(-1);
		expect(ruleAt('button.pbl-relmap-row:focus-visible', 'outline: 2px solid var(--interactive-accent);')).toBeGreaterThan(-1);
	});

	it('scrolls both ways, keeps the ruler on top, and keeps the shelf in view sideways', () => {
		// A narrow pane is the case this answers: the track is wider than any pane.
		expect(ruleAt('.pbl-relmap-scroll', 'overflow: auto;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-relmap-ruler', 'position: sticky;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-relmap-shelf', 'position: sticky;')).toBeGreaterThan(-1);
	});

	it('draws the derived band faded and dashed, and a slip stub in the colour of its direction', () => {
		expect(ruleAt('.pbl-relmap-lead', 'border: 1px dashed var(--text-faint);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-relmap-late', 'border-color: var(--text-error);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-relmap-early', 'border-color: var(--text-success);')).toBeGreaterThan(-1);
	});

	it('lets a click through the today line to the row beneath it', () => {
		expect(ruleAt('.pbl-relmap .pbl-today', 'pointer-events: none;')).toBeGreaterThan(-1);
	});
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run test/view/releaseStyleRules.test.ts`
Expected: FAIL — `ruleAt(...)` is `-1` for every new selector.

- [ ] **Step 3: Implement**

Create `styles/releaseMap.css`:

```css
/* The release view's Map tab — `src/view/release/renderMap.ts`, and the `List | Map`
   control `renderIndex.ts` draws at the head of both tabs. Every position is a custom
   property the view publishes (`--pbl-relmap-x`, `--pbl-relmap-w`, `--pbl-relmap-cell-w`,
   `--pbl-relmap-track`), in px from the window's first day. Logical properties throughout,
   so a right-to-left pane mirrors the ruler, the marks and the cards together. */

/* The tab group leads the bar; the bar's own `justify-content: flex-end` keeps ✨ and
   `New release` at the end. */
.pbl-rel-tabs {
	margin-inline-end: auto;
}

.pbl-relmap-scroll {
	flex: 1 1 auto;
	overflow: auto;
	padding-block-end: var(--size-4-4);
}

/* The track, then a gutter one card wide so the last card is not clipped. */
.pbl-relmap {
	--pbl-relmap-card: 280px;
	--pbl-relmap-gap: var(--size-4-4);
	position: relative;
	inline-size: calc(var(--pbl-relmap-track) + var(--pbl-relmap-gap) + var(--pbl-relmap-card) + var(--size-4-4));
	min-inline-size: 100%;
}

.pbl-relmap-ruler {
	position: sticky;
	inset-block-start: 0;
	z-index: 3;
	inline-size: var(--pbl-relmap-track);
	background-color: var(--background-primary);
	border-block-end: 1px solid var(--background-modifier-border);
}

.pbl-relmap-tier {
	display: flex;
}

.pbl-relmap-tier + .pbl-relmap-tier {
	border-block-start: 1px solid var(--background-modifier-border);
}

.pbl-relmap-cell {
	flex: 0 0 var(--pbl-relmap-cell-w);
	box-sizing: border-box;
	overflow: hidden;
	white-space: nowrap;
	padding: var(--size-2-2) var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	border-inline-start: 1px solid var(--background-modifier-border);
}

.pbl-relmap-cell-year {
	font-weight: var(--font-semibold);
	color: var(--text-normal);
}

/* BELOW the ruler, so it never covers a month label. The ruler is sticky, which makes it
   the containing block this hangs from. */
.pbl-relmap-today-label {
	position: absolute;
	inset-block-start: 100%;
	inset-inline-start: var(--pbl-relmap-x);
	transform: translateX(-50%);
	margin-block-start: var(--size-2-2);
	padding: 0 var(--size-4-1);
	border-radius: var(--radius-s);
	font-size: var(--font-ui-smaller);
	font-weight: var(--font-medium);
	color: var(--text-on-accent);
	background-color: var(--color-red);
	z-index: 4;
}

/* Room above the first row for the today label. */
.pbl-relmap-rows {
	position: relative;
	padding-block: var(--size-4-6) var(--size-4-3);
}

/* `.pbl-today` is the roadmap's own line (`timeline.css`); here it sits over buttons. */
.pbl-relmap .pbl-today {
	pointer-events: none;
}

/* A bare `button` in a vault arrives with a fill, a shadow, a radius and a fixed height —
   `button.pbl-rel-band`'s reset, for the same reason (`release.css`). */
button.pbl-relmap-row {
	position: relative;
	display: block;
	inline-size: 100%;
	block-size: auto;
	margin: 0;
	padding: var(--size-4-2) 0;
	background-color: transparent;
	box-shadow: none;
	border: 0;
	border-radius: 0;
	text-align: start;
	font-family: inherit;
	color: var(--text-normal);
	cursor: pointer;
}

button.pbl-relmap-row:hover {
	background-color: var(--background-modifier-hover);
	box-shadow: none;
}

button.pbl-relmap-row:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

/* The marks sit on the card's first line. */
.pbl-relmap-lead,
.pbl-relmap-tick,
.pbl-relmap-slip,
.pbl-relmap-marker {
	position: absolute;
	inset-inline-start: var(--pbl-relmap-x);
}

/* The derived start: a band, faded and dashed, never a solid bar. */
.pbl-relmap-lead {
	inset-block-start: calc(var(--size-4-2) + 10px);
	inline-size: var(--pbl-relmap-w);
	block-size: 16px;
	box-sizing: border-box;
	border: 1px dashed var(--text-faint);
	border-radius: var(--radius-s);
	background-color: var(--background-modifier-hover);
	opacity: 0.7;
}

.pbl-relmap-marker {
	inset-block-start: calc(var(--size-4-2) + 11px);
	inline-size: 14px;
	block-size: 14px;
	margin-inline-start: -7px;
	box-sizing: border-box;
	transform: rotate(45deg);
	background-color: var(--interactive-accent);
	border: 2px solid var(--background-primary);
	z-index: 2;
}

.pbl-relmap-shipped .pbl-relmap-marker {
	background-color: var(--text-faint);
}

.pbl-rel-overdue .pbl-relmap-marker {
	background-color: var(--text-error);
}

/* Pinned to the window's edge: hollow, so it does not claim the date it is drawn at. */
.pbl-relmap-clipped .pbl-relmap-marker {
	background-color: var(--background-primary);
	border-color: var(--text-muted);
	border-style: dashed;
}

.pbl-relmap-tick {
	inset-block-start: calc(var(--size-4-2) + 8px);
	block-size: 20px;
	border-inline-start: 2px solid var(--text-muted);
}

.pbl-relmap-slip {
	inset-block-start: calc(var(--size-4-2) + 17px);
	inline-size: var(--pbl-relmap-w);
	block-size: 0;
	border-block-start: 3px solid;
}

.pbl-relmap-late {
	border-color: var(--text-error);
}

.pbl-relmap-early {
	border-color: var(--text-success);
}

/* The card, to the right of the end marker. */
.pbl-relmap-slot {
	display: block;
	margin-inline-start: calc(var(--pbl-relmap-x) + var(--pbl-relmap-gap));
}

.pbl-relmap-card {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: column;
	gap: var(--size-2-3);
	box-sizing: border-box;
	inline-size: var(--pbl-relmap-card);
	padding: var(--size-4-2) var(--size-4-3);
	border-radius: var(--radius-m);
	background-color: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
}

.pbl-relmap-shipped .pbl-relmap-card {
	opacity: 0.7;
}

.pbl-relmap-line {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	min-inline-size: 0;
}

.pbl-relmap-name {
	flex: 0 1 auto;
	min-inline-size: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-weight: var(--font-semibold);
}

.pbl-relmap-line .pbl-state-chip {
	margin-inline-start: auto;
}

/* Date, note and progress on one line, wrapping only when the card cannot hold them. */
.pbl-relmap-facts {
	flex-wrap: wrap;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

.pbl-relmap-facts .pbl-rel-bar {
	inline-size: 64px;
}

.pbl-relmap-scope {
	display: flex;
	flex-direction: column;
	padding-block-start: var(--size-2-3);
	border-block-start: 1px solid var(--background-modifier-border);
	font-size: var(--font-ui-smaller);
}

.pbl-relmap-scope-item {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pbl-relmap-more {
	color: var(--text-faint);
	font-style: italic;
}

/* Sticky sideways: the shelf and the notes stay in view while the track scrolls. */
.pbl-relmap-shelf {
	position: sticky;
	inset-inline-start: 0;
	padding: var(--size-4-4) var(--size-4-2) 0;
}

.pbl-relmap-scroll > .pbl-rel-note {
	position: sticky;
	inset-inline-start: 0;
}

.pbl-relmap-shelf-cards {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-3);
}

button.pbl-relmap-row.pbl-relmap-shelf-row {
	inline-size: auto;
	padding: 0;
}

.pbl-relmap-shelf .pbl-relmap-card {
	border-style: dashed;
}
```

In `styles/index.css`, after `@import "./releaseReadiness.css";`:

```css
/* Position NOT load-bearing: every selector is `.pbl-relmap-*` or `.pbl-rel-tabs`, which no
   other partial declares. The three that reach a foreign class win on SPECIFICITY —
   `.pbl-relmap .pbl-today` (0,2,0) over `timeline.css`'s `.pbl-today`, `.pbl-relmap-facts
   .pbl-rel-bar` (0,2,0) over `release.css`'s `.pbl-rel-bar`, and `.pbl-rel-overdue
   .pbl-relmap-marker` names no class `release.css` styles. */
@import "./releaseMap.css";
```

- [ ] **Step 4: Run it, see it pass**

Run: `npx vitest run test/view/releaseStyleRules.test.ts test/harness/themeStub.test.ts`
Expected: PASS — every Obsidian variable used here resolves in the vendored sheet (`--text-success` included); `--pbl-*` names are seeded by the stub test.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add styles/releaseMap.css styles/index.css test/view/releaseStyleRules.test.ts
git commit -m "style(release): lay out the release map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: The harness: an eight-release plan and `?tab=map`

**Files:**

- Modify: `test/harness/mountRelease.ts` (`'plan'` variant, `planVault()`)
- Modify: `test/harness/release.ts` (`'plan'` in `VARIANTS`, `?tab=map`)
- Modify: `test/CLAUDE.md` (the release entry's knob list)
- Test: `test/harness/releaseHarness.test.ts`

**Interfaces:**

- Consumes: `mountReleaseHarness(root, variant)`, `inDays(days)` (module-private, `mountRelease.ts`), `ReleaseView.setTab`.
- Produces: `ReleaseConfigVariant` gains `'plan'`; `?config=plan`, `?tab=map`.

- [ ] **Step 1: Write the failing test**

Inside `describe('the release harness mounts', …)` in `test/harness/releaseHarness.test.ts`, add:

```ts
	it('draws the plan variant on the map: dated rows in date order, the undated on the shelf', () => {
		const { view, containerEl } = mount('plan');
		view.setTab('map');
		const onMap = (scope: string) => Array.from(containerEl.querySelectorAll(`${scope} .pbl-relmap-name`), (el) => el.textContent);
		expect(onMap('.pbl-relmap-rows')).toEqual(['Discovery', 'Spike', 'Prototype', 'Alpha 1', 'Alpha 2', 'MVP']);
		expect(onMap('.pbl-relmap-shelf')).toEqual(['Stage 1', 'Stage 2']);
		// The cases the fixture exists to show: a late ship, an overdue release, a same-day
		// pair (the second draws no band) and a capped scope.
		expect(containerEl.querySelector('.pbl-relmap-late')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-relmap-row.pbl-rel-overdue')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-relmap-row[data-path="Plan/Alpha 2.md"] .pbl-relmap-lead')).toBeNull();
		expect(containerEl.querySelector('.pbl-relmap-more')?.textContent).toBe('+2 more');
	});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run test/harness/releaseHarness.test.ts`
Expected: FAIL — `'plan'` mounts the full fixture, so the names differ.

- [ ] **Step 3: Implement**

**`test/harness/mountRelease.ts`:**

```ts
export type ReleaseConfigVariant = 'full' | 'empty' | 'notype' | 'nomembership' | 'noreleased' | 'plan';
```

First line of `releaseHarnessVault`:

```ts
	if (variant === 'plan') return planVault();
```

And, after `inDays`:

```ts
/**
 * `?config=plan` — eight releases shaped like a real plan, dated from TODAY so the map
 * always looks current: two shipped (one late), one overdue, two ending the same day, one
 * far out with five top-level items (three named, "+2 more"), and two with no target.
 */
function planVault(): FakeVault {
	const vault = new FakeVault();
	const release = (name: string, frontmatter: Record<string, unknown>): void => {
		vault.addFile(`Plan/${name}.md`, { frontmatter: { type: 'Release', ...frontmatter } });
	};
	release('Discovery', { version: '0.0.1', 'target-date': inDays(-40), released: inDays(-35), status: 'Released', order: 1 });
	release('Spike', { version: '0.0.2', 'target-date': inDays(-12), released: inDays(-12), status: 'Released', order: 2 });
	release('Prototype', { version: '0.1.0', 'target-date': inDays(-3), status: 'In progress', order: 3 });
	release('Alpha 1', { version: '0.2.0', 'target-date': inDays(25), status: 'Planned', order: 4 });
	release('Alpha 2', { version: '0.3.0', 'target-date': inDays(25), status: 'Planned', order: 5 });
	release('MVP', { version: '1.0.0', 'target-date': inDays(140), status: 'Scoped', order: 6 });
	release('Stage 1', { version: '2.0.0', status: 'Draft', order: 7 });
	release('Stage 2', { version: '3.0.0', status: 'Draft', order: 8 });
	const epics = ['Onboarding', 'Case management', 'Field visits', 'Reporting', 'Integration'];
	epics.forEach((title, i) => {
		vault.addFile(`${title}.md`, { frontmatter: { type: 'Epic', order: 10 + i, release: '[[MVP]]', status: i === 0 ? 'Done' : 'Ready' } });
	});
	vault.addFile('Clickable prototype.md', { frontmatter: { type: 'Feature', order: 20, release: '[[Prototype]]', status: 'Doing' } });
	return vault;
}
```

**`test/harness/release.ts`:** add `|plan` to the `?config=` doc comment ("`?config=plan` mounts an eight-release plan for the Map tab"), set `const VARIANTS: ReleaseConfigVariant[] = ['empty', 'notype', 'nomembership', 'noreleased', 'plan'];`, and before `const pick = params.get('pick');`:

```ts
/** `?tab=map` opens the index on its Map tab, through `setTab` — the control's own call —
 *  so it persists as a press would. Before `?pick=`, so Back from a picked release lands on the map. */
if (params.get('tab') === 'map') view.setTab('map');
```

**`test/CLAUDE.md`:** in the "Each of the other two views has its own committed pair" bullet, change `` `release.ts` (`?config=empty|notype|nomembership|noreleased`, `?pick=<path>`) `` to `` `release.ts` (`?config=empty|notype|nomembership|noreleased|plan`, `?pick=<path>`, `?tab=map`) ``.

- [ ] **Step 4: Run it, see it pass, and look at it**

Run: `npx vitest run test/harness/releaseHarness.test.ts`
Expected: PASS.

Then `npm run harness -- test/harness/release.ts` and open the printed URL with `?config=plan&tab=map`, then with `&phone` and with the window narrowed to ~400px. Check: the tab group wraps above ✨ and `New release` rather than overflowing; the track scrolls sideways under a sticky ruler; the shelf stays in view; the today label sits below the month row. This answers layout only — a themed vault's colours stay owed (Task 7).

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add test/harness/mountRelease.ts test/harness/release.ts test/harness/releaseHarness.test.ts test/CLAUDE.md
git commit -m "test(harness): an eight-release plan for the release map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Translation sweep, changelog, and the full gate

**Files:**

- Modify: `test/i18n/projections.test.ts` (one `it` in the release view's `describe`)
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: `remainder(el)` and `MARK` machinery in `test/i18n/projections.test.ts`; `makeReleaseView`, `releaseVault`, `RELEASE_CONFIG` (already imported there).
- Produces: nothing new in `src/`.

- [ ] **Step 1: Write the test**

In `describe('the release view reads every word it draws from the catalog', …)`, add:

```ts
	it("leaves nothing but the releases' own facts and the ruler's calendar unmarked on the map", () => {
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		view.setTab('map');

		// Month and year labels are FORMATTED (`formatDate`), never translated — data
		// presentation in the reader's locale — so they are read off the cells and set aside.
		const calendar = new Set(Array.from(containerEl.querySelectorAll('.pbl-relmap-cell'), (el) => el.textContent ?? ''));
		expect(calendar.size).toBeGreaterThan(0);
		// The same ten facts the list's own test names: the map says nothing the list does not.
		expect(remainder(containerEl).filter((text) => !calendar.has(text))).toEqual([
			'0.8',
			'0.8.0',
			'0.9',
			'0.9.0',
			'2026-09-12',
			'2026-10-24',
			'Idea',
			'In progress',
			'Planned',
			'Someday',
		]);
	});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/i18n/projections.test.ts`
Expected: PASS, because Tasks 3–4 put every sentence through `t()`. To see it able to fail, change `t('release.map.shelf')` in `renderMap.ts` to the literal `'Not scheduled'` (lint will refuse it on commit; the test should go red first), run again, see the test fail on `Not scheduled (1)`, then restore.

- [ ] **Step 3: Changelog**

In `CHANGELOG.md`, under `## [Unreleased]`:

```markdown
### Added

- The release view has a **Map** tab beside the list: every release on one timeline in
  date order, each with its facts and its first scope items, and the undated ones on a
  shelf below; a click opens the release, and Back returns to the map.
```

- [ ] **Step 4: The full gate, both locales**

```bash
npm run check
PBL_TEST_LOCALE=de-DE npx vitest run
```

Expected: exit 0 for both.

- [ ] **Step 5: Commit, and hand over the live-vault look**

```bash
git add test/i18n/projections.test.ts CHANGELOG.md
git commit -m "docs: the release map in the changelog, and its translation sweep" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then `npm run test-build` and ask for a look in a vault: open `docs/Product Backlog.base` (or a release base), press **Map**, and check a themed vault's colours for the band, the slip stub, the overdue marker and the today label, and what a screen reader says for a row. jsdom and the harness cannot answer those.
