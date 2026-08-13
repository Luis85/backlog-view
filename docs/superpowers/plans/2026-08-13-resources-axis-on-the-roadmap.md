# A resources axis on the roadmap — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw a third roadmap axis — one row per resource, each assigned item positioned by the same dates the dated axis already reads — implementing `docs/requirements/Showing a resources axis on the roadmap.md` and nothing beyond it.

**Architecture:** The axis is derivative. `domain/roadmap.ts` gains a `deriveLanes` sibling to `deriveBuckets` that groups results by `assigneeValue` and positions each one through `bars.ts`'s existing `placeItem`/`inferSpan`, unchanged. The view reuses the whole dated grid — window, header, gridlines, today line, dependency arrows — by widening `renderTimeline`'s row list into an *entry* list that can also carry a lane header, so lanes cost no second grid. Reaching the axis widens the selection machinery `Horizons or dates` built (`RoadmapAxis`, `configuredAxes`, the toolbar picker, the stored pick) rather than adding a second one.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (floor 1.12.0), vitest + jsdom (`test/CLAUDE.md`), CSS partials assembled by `scripts/styles-assemble.mjs`.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) must pass before every commit. CI runs it on Ubuntu **and** Windows.
- Four layers, outermost first: `main → commands → view → storage → domain`. Each may reach anything below it and nothing above; `eslint.config.mjs` fails lint on a violation.
- `max-lines: 400` per `src/` file, `max-lines-per-function: 100`, `complexity: 16`, `max-params: 5` — all `skipBlankLines: true, skipComments: true`. `test/**` has `max-lines: 450`.
- Every module in `src/` must be *specified* by at least one `docs/` note — in a use case's `## Where it lives` or an ADR's `## Decision`. `docs-check.mjs` rule 7 fails otherwise, so **a new module and the note naming it land in the same commit**.
- Never write frontmatter outside `storage/frontmatter.ts`; every write path including creation goes through the `configProblems` gate. `processFrontMatter`, `vault.create` and `load/saveLocalStorage` are banned by `no-restricted-syntax` outside `storage/`.
- An `outsideFilter` row is never a write target, never a ranking peer, and never a source of anything derived from the Base's results.
- Marketplace rules enforced by lint and review: sentence-case UI text, `setCssProps` over inline styles, no global `app`.
- The stylesheet is one partial per concern under `styles/`; the root `styles.css` is generated. `styles/index.css` import ORDER is behaviour.
- An invariant asserted in a comment gets a test that fails without it, **and the test is watched failing** (revert the fix, run it, see red, restore).
- Address code by name, never by line number.

## Scope, and what is deliberately not in it

This plan implements **PBI `Showing a resources axis on the roadmap` (order 10) only**. Its two siblings under `The resource timeline` stay unbuilt and unplanned here:

- `Assigning items to a resource` (order 20) owns every *move* on this axis — the drop, Alt+arrow, the menu pick, `performResourceMove`. So this axis ships **read-only**: no grips on its bars, no drag target on its grid, and a shelf that accepts nothing. That is a deliberate narrowing, not an omission — a bar wired with grips over a grid with no drop target registered is the exact failure `src/view/CLAUDE.md` records ("bars picked up and had nowhere to land"), so the grips are withheld at the source rather than left dangling.
- `Resource absences` (order 30) owns the second bar source. Task 5 leaves the seam the Feature note asks for — `ResourceLane.bars` is a plain list the renderer walks, so a second source appends to it — and builds nothing of it.

**One acceptance-criteria bullet cannot be implemented and is deferred, with the reason:** the AC says a lane's name "wins over anything a picked template declares for the assignee property (`Creating an item from a template` extension 5d)". Templates do not exist in `src/` — nothing outside `render/icons.ts` mentions one — so there is no template write for a lane name to win over. Task 6 writes the lane's name in the single creation write, which is the half that *is* buildable; the precedence rule becomes `Creating an item from a template`'s own work when that PBI is built. Do not invent a template path to satisfy the bullet.

**Two assumptions, stated because the spec is silent and both are defensible from its own wording:**

1. **A result mints a lane only where a bar actually lands.** An assigned result with no date to place shelves (extension 3c) *and* mints nothing, because 3c's own sentence — "a row with no date to position a bar at has nothing to draw" — says a lane with no bar is not a row. It also matches `placeResult`, which shelves before it mints. A declared lane still renders empty; that is declaration, not observation.
2. **Lanes are flat.** No chevrons, no ancestry collapse on this axis, decided with the user on 2026-08-13. Membership is the note's own assignee, so a parent and its child routinely land in different lanes, and the collapse bit is keyed by path — ancestry collapse would let one person's fold hide another person's bar. Consequences: `clickActionApplies` and `collapseKey`'s `TIMELINE_SCOPE` stay `'dates'`-only, and `collapseCtlsDisabled` correctly reports disabled here (no drawn row disclosure).

**Still owed after this plan, and not closeable here:** a live-vault check of the lane header's appearance and of how a screen reader reads a header row inside the pane's `listbox` — Obsidian cannot run in this harness, and no harness mock was made (the user declined the offer). `npm run test-build` bundles into `.obsidian/plugins/<id>/` for that check.

## File structure

| File | Responsibility |
| --- | --- |
| `src/domain/settings.ts` | + `resourceNames: string[]`, the optional roster, default `[]` |
| `src/domain/settingsResolve.ts` | resolves `resourceNames` off the config |
| `src/domain/settingsConsistency.ts` | `resourceNames` joins the trimmed/deduped vocabularies checked at `buildModel` |
| `src/domain/viewOptions.ts` | one text row in the Roadmap group; amends the assignee option's comment |
| `src/domain/roadmap.ts` | + `'resources'` in `RoadmapAxis`, `hasResourceAxis`, `drawsGrid`, `ResourceLane`, `deriveLanes`, `RoadmapModel.lanes` |
| `src/storage/collapseStore.ts` | `AXIS_VALUES` gains `'resources'` so a saved pick survives a reload |
| `src/view/render/toolbarControls.ts` | `AXIS_LABEL` entry, the picker's third choice, `drawsGrid` at three gates |
| `src/view/render/legend.ts`, `src/view/resize.ts`, `src/view/backlogView.ts`, `src/view/render/shelf.ts`, `src/view/render/projections.ts` | the remaining axis gates, asked through `drawsGrid` |
| `src/view/render/timeline.ts` | `TimelineEntry`; the grid draws an entry list; grips gated by `TimelineDrawing.grips` |
| `src/view/render/lanes.ts` | **new** — the lane header, the lane's bar-less context row, `laneEntries` |
| `src/view/render/roadmap.ts` | dispatches the three axes; wires the grid drag on `'dates'` alone |
| `src/view/interactions/create.ts` | `CreatePlacement.assignee`, the lane's New flow and its announcement |
| `src/storage/frontmatter.ts` | `NewItemSpec.assignee`, written in the one creation write |
| `styles/lanes.css` | **new** — the lane header, imported after `timeline.css` |
| `docs/requirements/Showing a resources axis on the roadmap.md` | `## Where it lives` names the new modules (Task 5); closed in Task 7 |

---

### Task 1: The roster setting

**Files:**
- Modify: `src/domain/settings.ts` (the `BacklogSettings` interface, `defaultSettings`)
- Modify: `src/domain/settingsResolve.ts` (`resolveSettings`'s returned object)
- Modify: `src/domain/settingsConsistency.ts` (`listProblem`)
- Modify: `src/domain/viewOptions.ts` (`roadmapGroup`, and the comment above `optionalPropertyOption('assignee', …)`)
- Test: `test/domain/settings.test.ts`, `test/domain/viewOptions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BacklogSettings.resourceNames: string[]` — declared resource names in row order, `[]` when nothing is declared. Read in Task 2 by `deriveLanes`.

- [ ] **Step 1: Write the failing tests**

In `test/domain/settings.test.ts`, beside the existing `horizonValues` resolution tests:

```ts
it('reads a declared resource roster, trimmed and deduped, and ships with none', () => {
	expect(defaultSettings().resourceNames).toEqual([]);
	const config = new FakeViewConfig({ resourceNames: ' Alice , Bob ,, alice ' });
	expect(resolveSettings(config).resourceNames).toEqual(['Alice', 'Bob']);
});

it('an untouched roster is empty rather than a default nobody chose', () => {
	// Unlike horizonValues, there is no default to be clearable AGAINST: nobody
	// declares who exists, so absence is the shipped state and not a cleared one.
	expect(resolveSettings(new FakeViewConfig({})).resourceNames).toEqual([]);
});
```

In `test/domain/settings.test.ts`, beside the existing `settingsInconsistency` list checks:

```ts
it('rejects a roster list() and dedupe() would have changed', () => {
	expect(settingsInconsistency(settingsWith({ resourceNames: [' Alice'] }))).toMatch(/resourceNames/);
	expect(settingsInconsistency(settingsWith({ resourceNames: ['Alice', 'alice'] }))).toMatch(/resourceNames/);
});
```

In `test/domain/viewOptions.test.ts`:

```ts
it('offers the resource roster in the Roadmap group, with no prefilled default', () => {
	const roadmap = groupNamed(backlogViewOptions(), 'Roadmap');
	const roster = roadmap.items.find((item) => 'key' in item && item.key === 'resourceNames');
	expect(roster).toBeDefined();
	expect(roster).not.toHaveProperty('default');
});
```

> Match the existing file's own helpers for reaching a group and its items — `groupNamed` above stands for whatever that file already uses. Read it first; do not add a second way to find a group.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/domain/settings.test.ts test/domain/viewOptions.test.ts`
Expected: FAIL — `resourceNames` is not a property of `BacklogSettings` (a TS error in the test), and the option is not found.

- [ ] **Step 3: Add the field and its default**

In `src/domain/settings.ts`, directly after `horizonValues`:

```ts
	/**
	 * Declared resource names, in roadmap row order. Ships EMPTY, unlike
	 * `horizonValues`: [[Assignment]]'s premise is that nobody declares who exists, so
	 * the resources axis is configured by its assignee property and a date property
	 * alone, and this list only ever adds rows nothing has landed in yet. Nothing here
	 * is a vocabulary — it never narrows what Set assignee offers, which is why it is
	 * not `clearable`: absence is the shipped state rather than a cleared default.
	 */
	resourceNames: string[];
```

In `defaultSettings()`, beside `horizonValues`:

```ts
		resourceNames: [],
```

- [ ] **Step 4: Resolve it**

In `src/domain/settingsResolve.ts`, directly after the `horizonValues` line:

```ts
		// No `clearable`: that exists to tell "never set" from "cleared" for a REAL
		// default, and this one has none — see `BacklogSettings.resourceNames`.
		resourceNames: dedupe(list('resourceNames')),
```

- [ ] **Step 5: Put it under the category check**

In `src/domain/settingsConsistency.ts`, in `listProblem`, add it to the `vocabularies` tuple:

```ts
	const vocabularies = ['states', 'deliverableStates', 'testStates', 'startedStates', 'horizonValues', 'resourceNames'] as const;
```

- [ ] **Step 6: Offer it in the view options**

In `src/domain/viewOptions.ts`, in `roadmapGroup()`, after `optionalPropertyOption('target', 'Target date property')`:

```ts
			// The resources axis's ROW list, not a vocabulary: it adds rows nothing has
			// landed in yet and never narrows what Set assignee offers. No default,
			// unlike the horizons above — nobody declares who exists.
			{
				type: 'text',
				key: 'resourceNames',
				displayName: 'Resources (in order)',
				placeholder: 'Optional, comma separated',
			},
```

And amend the comment above `optionalPropertyOption('assignee', …)`, which currently says there is no vocabulary to declare anywhere — true of the menu, no longer true of the file:

```ts
			// A property and no list beside it, unlike the state above and the risk
			// levels below: the names Set assignee offers are the ones the results
			// already carry, plus whatever the user types. The Roadmap group's
			// "Resources (in order)" is not that missing list — it declares the resources
			// AXIS's rows and never narrows what this menu offers.
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/domain/settings.test.ts test/domain/viewOptions.test.ts`
Expected: PASS. Fix any other suite the new field breaks by widening its fixture, never by loosening an assertion — `test/domain/settingsShape.test.ts` checks the shape and may need the field named.

- [ ] **Step 8: Commit**

```bash
npm run check
git add src/domain/settings.ts src/domain/settingsResolve.ts src/domain/settingsConsistency.ts src/domain/viewOptions.ts test/domain/settings.test.ts test/domain/viewOptions.test.ts
git commit -m "Declare an optional resource roster in the view options"
```

---

### Task 2: The axis — declared, picked, persisted, derived

**Files:**
- Modify: `src/domain/roadmap.ts` (`RoadmapAxis`, `configuredAxes`, `hasResourceAxis`, `RoadmapModel`, `buildRoadmap`, `deriveLanes`)
- Modify: `src/storage/collapseStore.ts` (`AXIS_VALUES`)
- Modify: `src/view/render/toolbarControls.ts` (`AXIS_LABEL`, `renderAxisPicker`)
- Test: `test/domain/resources.test.ts` (new), `test/domain/roadmap.test.ts`, `test/storage/collapseStore.test.ts`

**Interfaces:**
- Consumes: `BacklogSettings.resourceNames` (Task 1); `placeItem`/`statedEnds` from `src/domain/bars.ts`, unchanged.
- Produces:
  - `RoadmapAxis = 'horizons' | 'dates' | 'resources'`
  - `hasResourceAxis(settings: BacklogSettings): boolean`
  - `interface ResourceLane { name: string; declared: boolean; bars: TimelineBar[]; context: BacklogItem[] }`
  - `RoadmapModel.lanes: ResourceLane[]` — the resources axis in row order; empty on the other two.
  - `RoadmapModel.bars` is now **every bar the drawn axis has**, in row order, so it is filled on the resources axis too (flattened in lane order).

> **Why `bars` is also filled:** two readers ask it as "is this path drawn as a bar rather than a card" — `addChildrenSection` in `src/view/interactions/menu.ts` and `collapseCtlsDisabled` in `src/view/render/toolbarControls.ts`. Leaving it empty here would make a lane's bar answer "card" to both. Neither behaves wrongly once it is filled: `addChildrenSection` returns at its first line for any path that drew no disclosure, and flat lanes draw none, so it offers nothing; `collapseCtlsDisabled` intersects `cardChildrenShown` with the bar paths and finds nothing, which is the correct "disabled" for an axis with no row disclosure.

- [ ] **Step 1: Write the failing axis-selection tests**

In `test/domain/roadmap.test.ts`, in the existing `describe('the configured axes', …)`:

```ts
it('takes the last position — a further grouping on top of dates never leads', () => {
	const both = axisSettings({ assigneeKey: 'assignee' });
	expect(configuredAxes(both)).toEqual(['horizons', 'dates', 'resources']);
	// A vault that newly names an assignee property does not have its roadmap change
	// under it: the axis has to be picked, exactly as dates already has to be.
	expect(activeAxis(both, null)).toBe('horizons');
	expect(activeAxis(axisSettings({ assigneeKey: 'assignee', horizonKey: '' }), null)).toBe('dates');
});

it('cannot be configured alone — it needs the date property the dated axis needs', () => {
	expect(hasResourceAxis(axisSettings({ assigneeKey: 'assignee' }))).toBe(true);
	expect(hasResourceAxis(axisSettings({ assigneeKey: 'assignee', startKey: '', targetKey: '' }))).toBe(false);
	expect(hasResourceAxis(axisSettings({ assigneeKey: '' }))).toBe(false);
	// Whatever configures this axis configures the dated one too, by construction.
	const configured = axisSettings({ assigneeKey: 'assignee' });
	expect(hasResourceAxis(configured) && hasDateAxis(configured)).toBe(true);
});

it('falls back the same generic way when its configuration is lost', () => {
	expect(activeAxis(axisSettings({ assigneeKey: '' }), 'resources')).toBe('horizons');
	expect(activeAxis(axisSettings({ assigneeKey: 'assignee', horizonKey: '' }), 'resources')).toBe('resources');
});
```

Add `hasDateAxis` and `hasResourceAxis` to that file's import from `../../src/domain/roadmap`.

- [ ] **Step 2: Write the failing derivation tests**

Create `test/domain/resources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { FakeVault } from '../helpers/vault';

/** The resources axis needs an assignee property AND a date property — never one alone. */
function resourceSettings(overrides: Partial<BacklogSettings> = {}): BacklogSettings {
	return settingsWith({ assigneeKey: 'assignee', startKey: 'start', targetKey: 'due', ...overrides });
}

function laneOf(vault: FakeVault, settings: BacklogSettings) {
	return buildRoadmap(buildModel(vault.app, vault.entries(), settings), settings, () => true, 'resources');
}

function titles(bars: { item: { title: string } }[]): string[] {
	return bars.map((bar) => bar.item.title);
}

function teamVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alice dated.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Cased.md', {
		frontmatter: { type: 'Epic', order: 20, assignee: 'alice', start: '2026-08-05', due: '2026-08-06' },
	});
	vault.addFile('Stray.md', {
		frontmatter: { type: 'Epic', order: 30, assignee: 'Zoe', start: '2026-08-02', due: '2026-08-03' },
	});
	vault.addFile('Nobody.md', { frontmatter: { type: 'Epic', order: 40, start: '2026-08-01', due: '2026-08-02' } });
	vault.addFile('Undated.md', { frontmatter: { type: 'Epic', order: 50, assignee: 'Alice' } });
	return vault;
}

describe('the resources axis', () => {
	it('renders every declared resource in declared order, empty or not', () => {
		const settings = resourceSettings({ resourceNames: ['Alice', 'Bob'] });
		const roadmap = laneOf(teamVault(), settings);

		// Bob is empty and still there; the undeclared assignee appends after both.
		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Alice', 'Bob', 'Zoe']);
		expect(roadmap.lanes.map((lane) => lane.declared)).toEqual([true, true, false]);
	});

	it('groups by the note’s own assignee, case-insensitively, in tree order', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(teamVault(), settings);

		expect(titles(roadmap.lanes[0].bars)).toEqual(['Alice dated', 'Cased']);
	});

	it('positions a bar exactly as the dated axis does — no second date reading', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const vault = teamVault();
		const lanes = laneOf(vault, settings);
		const dated = buildRoadmap(buildModel(vault.app, vault.entries(), settings), settings, () => true, 'dates');

		const onLane = lanes.lanes[0].bars.find((bar) => bar.item.title === 'Alice dated');
		const onGrid = dated.bars.find((bar) => bar.item.title === 'Alice dated');
		expect(onLane?.span).toEqual(onGrid?.span);
	});

	it('shelves a result with no assignee whatever its dates say — a row is who, not when', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(teamVault(), settings);

		const nobody = roadmap.shelf.find((card) => card.item.title === 'Nobody');
		expect(nobody).toBeDefined();
		expect(nobody?.reason).toBeNull();
	});

	it('shelves an assigned result with no date to place, and mints no row for it', () => {
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Named only.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Bob' } });
		const roadmap = laneOf(vault, settings);

		// Naming a resource is not scheduling against them: a row with no date to
		// position a bar at has nothing to draw, so nothing is drawn.
		expect(roadmap.lanes).toEqual([]);
		expect(roadmap.shelf.map((card) => card.item.title)).toEqual(['Named only']);
	});

	it('keeps the dated axis’s own refusals and their reasons', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const vault = new FakeVault();
		vault.addFile('Bad.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: 'not a date' } });
		const roadmap = laneOf(vault, settings);

		expect(roadmap.shelf[0].reason).toBe('Unreadable start date');
		expect(roadmap.lanes[0].bars).toEqual([]);
	});

	it('draws a dateless parent’s inferred bar in its own resource’s row', () => {
		const settings = resourceSettings({ resourceNames: ['Alice', 'Bob'] });
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
		vault.addFile('Child.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Bob', start: '2026-08-01', due: '2026-08-10' },
			parentLink: 'Epic',
		});
		const roadmap = laneOf(vault, settings);

		const alice = roadmap.lanes[0];
		expect(titles(alice.bars)).toEqual(['Epic']);
		expect(alice.bars[0].inferredStart).toBe(true);
		expect(titles(roadmap.lanes[1].bars)).toEqual(['Child']);
	});

	it('placed plus shelved equals the visible result rows', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(teamVault(), settings);

		const placed = roadmap.lanes.reduce((sum, lane) => sum + lane.bars.length, 0);
		expect(roadmap.placedCount).toBe(placed);
		expect(placed + roadmap.shelf.length).toBe(5);
	});

	it('reports every drawn bar on `bars` too, in row order', () => {
		// Two readers ask `bars` "is this path a drawn bar rather than a card" — the card
		// menu's children section and the toolbar's collapse gate — so an axis that draws
		// bars must report them.
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(teamVault(), settings);

		expect(titles(roadmap.bars)).toEqual(['Alice dated', 'Cased', 'Stray']);
	});
});

describe('a context row on the resources axis', () => {
	it('groups into a row that already exists, uncounted and never shelved', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const vault = new FakeVault();
		// The Epic is outside the filter (never handed over as an entry) and carries an
		// assignee of its own; the Feature below it is the result that keeps it on screen.
		vault.addFile('Outside epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-02' },
			parentLink: 'Outside epic',
		});
		const entries = vault.entries().filter((entry) => entry.file.path !== 'Outside epic.md');
		const roadmap = buildRoadmap(buildModel(vault.app, entries, settings), settings, () => true, 'resources');

		const alice = roadmap.lanes[0];
		expect(titles(alice.bars)).toEqual(['Result']);
		expect(alice.context.map((item) => item.title)).toEqual(['Outside epic']);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.placedCount).toBe(1);
	});

	it('never mints a row of its own, and falls to the undifferentiated context', () => {
		// No roster, and the only result names Bob — so Alice's row does not exist and
		// the excluded Epic that names her has none to join.
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Outside epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Bob', start: '2026-08-01', due: '2026-08-02' },
			parentLink: 'Outside epic',
		});
		const entries = vault.entries().filter((entry) => entry.file.path !== 'Outside epic.md');
		const roadmap = buildRoadmap(buildModel(vault.app, entries, settings), settings, () => true, 'resources');

		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Bob']);
		expect(roadmap.context.map((item) => item.title)).toEqual(['Outside epic']);
	});
});
```

> Check how `test/domain/modelContextRows.test.ts` builds an excluded ancestor before writing the last two tests, and use its mechanism if it differs from the `entries()` filter above — do not add a second way to make a note load as context.

- [ ] **Step 3: Write the failing persistence test**

In `test/storage/collapseStore.test.ts`, beside the existing stored-axis tests:

```ts
it('reads back a saved resources-axis pick', () => {
	// Checked separately from `RoadmapAxis` on purpose: stored state is read
	// defensively against its own string list, so a value missing from that list is
	// silently dropped and reads back as a pick never made.
	expect(readEntry({ base: 'b.base', axis: 'resources' })?.axis).toBe('resources');
});
```

Match the file's own way of reaching `readEntry` — it may be exercised through the store's public surface rather than directly.

- [ ] **Step 4: Run all three suites to verify they fail**

Run: `npx vitest run test/domain/roadmap.test.ts test/domain/resources.test.ts test/storage/collapseStore.test.ts`
Expected: FAIL — `hasResourceAxis` is not exported, `'resources'` is not assignable to `RoadmapAxis`, `RoadmapModel.lanes` does not exist, the stored pick reads back `undefined`.

- [ ] **Step 5: Widen the axis type and its selection**

In `src/domain/roadmap.ts`:

```ts
export type RoadmapAxis = 'horizons' | 'dates' | 'resources';
```

In `configuredAxes`, after the `hasDateAxis` push:

```ts
	// LAST, and the order is priority: horizons lead because the axis that cannot
	// over-promise is the one the format's literature argues for, and this axis is a
	// further grouping ON TOP of dates — one step more specific still — so it takes the
	// end rather than displacing either. A vault that newly names an assignee property
	// does not have its roadmap change under it.
	if (hasResourceAxis(settings)) axes.push('resources');
```

Beside `hasDateAxis`:

```ts
/**
 * The resources axis is DERIVATIVE: a row groups items, and the same start-or-target
 * property the dated axis reads is what positions them inside it. So it needs both, and
 * it can never be configured where the dated axis is not — there is no parallel pair of
 * "resource dates", and gating it on the assignee property alone is the mistake the
 * Feature note names as the one to not make on the first pass.
 */
export function hasResourceAxis(settings: BacklogSettings): boolean {
	return settings.assigneeKey !== '' && hasDateAxis(settings);
}
```

`activeAxis` needs no change — it already resolves generically over however many axes `configuredAxes` returns.

- [ ] **Step 6: Add the lane type and the derivation**

In `src/domain/roadmap.ts`, beside `HorizonBucket`:

```ts
/**
 * A row of the resources axis: one resource, and everything drawn against it. Declared
 * rows render in declared order, empty or not; a result whose assignee is undeclared
 * mints a trailing row named by itself, the same rule an undeclared horizon mints a
 * bucket by. Context rows never mint one.
 *
 * `bars` is a plain list the renderer walks, which is the seam [[Resource absences]]
 * needs: a second source of bars for this row appends to it rather than replacing how
 * the row is drawn.
 */
export interface ResourceLane {
	/** The assignee value this row stands for, in its first-seen casing. */
	name: string;
	/** False for a row minted by a result's undeclared assignee. */
	declared: boolean;
	/** Result bars, in tree order, positioned exactly as the dated axis positions one. */
	bars: TimelineBar[];
	/**
	 * Context rows whose assignee names this row. Drawn here so the row says whose work
	 * they place — never as a positioned bar, never counted, never shelved.
	 */
	context: BacklogItem[];
}
```

In `RoadmapModel`, add the field and correct `bars`' own comment:

```ts
	/** The dated axis and the resources axis, in row order; empty on the horizon axis. */
	bars: TimelineBar[];
	/** The resources axis, in row order; empty on the other two. */
	lanes: ResourceLane[];
```

In `buildRoadmap`, initialise it and dispatch:

```ts
	const roadmap: RoadmapModel = { axis, buckets: [], bars: [], lanes: [], shelf: [], context: [], placedCount: 0 };
	if (axis === 'horizons') deriveBuckets(rows, settings, roadmap, visible);
	else if (axis === 'resources') deriveLanes(rows, settings, roadmap);
	else {
		const dated = deriveBars(rows);
		roadmap.bars = dated.bars;
		roadmap.shelf = dated.shelf;
		roadmap.context = dated.context;
	}
```

`placedCount` below it is already generic (`results - shelf.length`) and needs no change.

At the end of the file:

```ts
/**
 * The resources axis. Two passes for `deriveBuckets`' own reason — only a result may
 * mint a row, so context rows join rows that already exist — with one difference that
 * follows from the axis being derivative: a result mints its row only where a BAR
 * lands. An assignee with no date to position has nothing to draw
 * ([[Showing a resources axis on the roadmap]] extension 3c) and would otherwise mint a
 * row whose only member is on the shelf.
 *
 * Every placement question is `placeItem`'s, asked unchanged: the marker reduction, the
 * unreadable and reversed refusals and the rollup inference are the dated axis's rules,
 * and this axis groups their answers rather than restating any of them.
 */
function deriveLanes(rows: BacklogItem[], settings: BacklogSettings, roadmap: RoadmapModel): void {
	const lanes = settings.resourceNames.map(
		(name): ResourceLane => ({ name, declared: true, bars: [], context: [] }),
	);
	const byName = new Map<string, ResourceLane>(lanes.map((lane) => [lane.name.toLowerCase(), lane]));
	for (const item of rows) {
		if (!item.outsideFilter) placeAssigned(item, lanes, byName, roadmap);
	}
	for (const item of rows) {
		if (item.outsideFilter) placeContextLane(item, byName, roadmap);
	}
	roadmap.lanes = lanes;
	// Flattened in row order, because two readers ask `bars` whether a path is drawn as
	// a bar rather than as a card — see `RoadmapModel.bars`.
	roadmap.bars = lanes.flatMap((lane) => lane.bars);
}

/**
 * A result joins its resource's row, or shelves. The assignee is asked FIRST and the
 * dates second, in that order because a row is who and not when: an unassigned result
 * shelves whatever its dates say, since there is no row to place it into.
 */
function placeAssigned(
	item: BacklogItem,
	lanes: ResourceLane[],
	byName: Map<string, ResourceLane>,
	roadmap: RoadmapModel,
): void {
	if (item.assigneeValue === null) {
		roadmap.shelf.push({ item, reason: null });
		return;
	}
	const placement = placeItem(item, statedEnds(item));
	if (placement.kind === 'shelf') {
		roadmap.shelf.push({ item, reason: placement.reason });
		return;
	}
	// Matching is case-insensitive, exactly as the buckets match horizons.
	let lane = byName.get(item.assigneeValue.toLowerCase());
	if (!lane) {
		lane = { name: item.assigneeValue, declared: false, bars: [], context: [] };
		byName.set(item.assigneeValue.toLowerCase(), lane);
		lanes.push(lane);
	}
	lane.bars.push(placement.bar);
}

/** A context row joins a row that already exists, or the axis's undifferentiated context. */
function placeContextLane(item: BacklogItem, byName: Map<string, ResourceLane>, roadmap: RoadmapModel): void {
	const lane = item.assigneeValue === null ? undefined : byName.get(item.assigneeValue.toLowerCase());
	if (lane) lane.context.push(item);
	else roadmap.context.push(item);
}
```

Add `placeItem` and `statedEnds` to the existing import from `./bars`.

> If `roadmap.ts` crosses the 400-line budget with this, split the resources axis into `src/domain/resources.ts` exporting `ResourceLane`, `hasResourceAxis` and `deriveLanes`, import it back into `roadmap.ts`, and name the new module in the PBI note's `## Where it lives` **in the same commit** — `docs-check.mjs` rule 7 fails otherwise. Check with `npx eslint src/domain/roadmap.ts` before committing.

- [ ] **Step 7: Let the stored pick round-trip**

In `src/storage/collapseStore.ts`:

```ts
const AXIS_VALUES = ['horizons', 'dates', 'resources'];
```

- [ ] **Step 8: Make the picker offer it**

In `src/view/render/toolbarControls.ts`, in `AXIS_LABEL`:

```ts
	// `users`, not `user`: the axis is every resource at once, and no other control in
	// the row wears it.
	resources: { icon: 'users', text: 'Resources' },
```

and in `renderAxisPicker`, after `choice('dates')`:

```ts
		choice('resources');
```

The picker's own two refusals (no axis to name, fewer than two to choose between) are unchanged and already generic.

- [ ] **Step 9: Run the suites to verify they pass**

Run: `npx vitest run test/domain/roadmap.test.ts test/domain/resources.test.ts test/storage/collapseStore.test.ts`
Expected: PASS.

- [ ] **Step 10: Watch one invariant fail**

Remove the `if (item.assigneeValue === null)` early return in `placeAssigned` so an unassigned result falls through to `placeItem`. Run `npx vitest run test/domain/resources.test.ts` and see "shelves a result with no assignee whatever its dates say" go red — `Nobody` has dates, so without that return it lands in a minted row. Restore it.

- [ ] **Step 11: Commit**

```bash
npm run check
git add src/domain/roadmap.ts src/storage/collapseStore.ts src/view/render/toolbarControls.ts test/domain/roadmap.test.ts test/domain/resources.test.ts test/storage/collapseStore.test.ts
git commit -m "Derive a resources axis, picked and persisted like the other two"
```

> After this commit the axis can be picked and derives correctly, and the view draws its bars on the plain dated grid with no lane headers — `renderRoadmap` still has two branches. Tasks 3 to 5 close that.

---

### Task 3: One predicate for "this axis draws the grid"

**Files:**
- Modify: `src/domain/roadmap.ts` (`drawsGrid`)
- Modify: `src/view/render/toolbarControls.ts`, `src/view/render/legend.ts`, `src/view/resize.ts`, `src/view/backlogView.ts`, `src/view/render/shelf.ts`, `src/view/render/projections.ts`
- Test: `test/view/toolbarControls.test.ts`, `test/domain/roadmap.test.ts`, `test/helpers/roadmap.ts`

**Interfaces:**
- Consumes: `RoadmapAxis` (Task 2).
- Produces: `drawsGrid(axis: RoadmapAxis): boolean` — true for `'dates'` and `'resources'`.

> Six sites currently compare `activeAxis(…) === 'dates'` to mean "the dated grid is on screen", which is no longer the same question as "the plain dated axis is on screen". `src/view/CLAUDE.md` states the rule this follows: what a projection IS is asked, never compared. Four sites keep their comparison on purpose — they mean the plain dated axis and nothing else.

| Site | Asks | After |
| --- | --- | --- |
| `renderTimelineControls` (zoom, jump-to-today, density) | is a grid on screen | `drawsGrid` |
| `renderStateColorsButton` | are bars on screen to colour | `drawsGrid` |
| `renderLegend`'s `onDatedAxis` | are bars on screen to key | `drawsGrid` |
| the roadmap gate in `resize.ts` | does the render measure the pane | `drawsGrid` |
| `pbl-roadmap-dates` in `renderTreeContent` | does the frame need the grid layout | `drawsGrid` |
| `renderShelfCard`'s `wiring.axis === 'dates'` (`dependencyNote`) | do bars exist for a conflict to be about | `drawsGrid` |
| `collapseKey`'s `TIMELINE_SCOPE` | is this the axis whose rows fold | unchanged — flat lanes fold nothing |
| `clickActionApplies` | is a row-shaped fold on screen | unchanged, same reason |
| `handleRoadmapMoveKey`'s `axis !== 'horizons'` | is the horizon ladder on screen | unchanged |
| `chooseHorizon`'s `axis === 'horizons'` | is there a horizon frame to announce into | unchanged |

- [ ] **Step 1: Lift the fixture into the shared helper**

Move `teamVault()` from `test/domain/resources.test.ts` into `test/helpers/roadmap.ts` as `resourceVault()`, exported, and import it back in both that file and the view tests below — one fixture, so the domain and the view cannot disagree about what they are describing.

- [ ] **Step 2: Write the failing tests**

In `test/domain/roadmap.test.ts`:

```ts
it('names the axes that draw the dated grid', () => {
	expect(drawsGrid('dates')).toBe(true);
	expect(drawsGrid('resources')).toBe(true);
	expect(drawsGrid('horizons')).toBe(false);
});
```

In `test/view/toolbarControls.test.ts`, following that file's existing pattern for opening a roadmap on a given axis:

```ts
it('offers the grid’s own controls on the resources axis too', () => {
	const harness = roadmapView(resourceVault(), {
		startProperty: 'note.start',
		targetProperty: 'note.due',
		assigneeProperty: 'note.assignee',
	});
	harness.view.setAxisPick('resources');
	refresh(harness);

	// The resources axis IS a dated grid: it has a density to choose, a today to
	// return to and bars whose states a colour can be stored against.
	expect(harness.toolbarEl.querySelector('[data-pbl-key="zoom"]')).not.toBeNull();
	expect(harness.toolbarEl.querySelector('.pbl-today-btn')).not.toBeNull();
	expect(harness.toolbarEl.querySelector('.pbl-density-toggle')).not.toBeNull();
});

it('withholds the row-fold toggle there, because a lane folds nothing', () => {
	const harness = roadmapView(resourceVault(), {
		startProperty: 'note.start',
		targetProperty: 'note.due',
		assigneeProperty: 'note.assignee',
	});
	harness.view.setAxisPick('resources');
	refresh(harness);

	expect(harness.toolbarEl.querySelector('.pbl-click-action-toggle')).toBeNull();
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run test/domain/roadmap.test.ts test/view/toolbarControls.test.ts`
Expected: FAIL — `drawsGrid` is not exported; the zoom, today and density controls are absent on the resources axis.

- [ ] **Step 4: Add the predicate**

In `src/domain/roadmap.ts`, beside `hasResourceAxis`:

```ts
/**
 * Whether this axis draws the dated GRID — the window, the day header, the gridlines,
 * the today line and bars — as opposed to a bucket board. Asked rather than compared,
 * because "the dated grid is on screen" and "the plain dated axis is on screen" stopped
 * being the same question when the resources axis arrived: the controls that belong to
 * the grid (the zoom, the density, jump-to-today, the state-colour legend) belong to
 * both, while the ones that belong to a FOLD (the click-action toggle, the timeline
 * collapse scope) belong to the plain one alone, since lanes are flat.
 */
export function drawsGrid(axis: RoadmapAxis): boolean {
	return axis === 'dates' || axis === 'resources';
}
```

- [ ] **Step 5: Route the six sites through it**

Replace each comparison in the table above with `drawsGrid(...)`, keeping the negation shape each site already has. For example, in `renderTimelineControls`:

```ts
	const axis = activeAxis(host.settings, host.axisPick);
	if (axis === null || !drawsGrid(axis)) return;
```

and in `renderTreeContent`:

```ts
		const axis = activeAxis(this.settings, this.axisPick);
		// The class NAME stays: it is the grid-layout class in effect, every rule in
		// `styles/` and every test already names it, and the resources axis needs exactly
		// the layout it turns on. Renaming it would be a diff across the stylesheet for
		// no behaviour.
		this.viewEl.toggleClass('pbl-roadmap-dates', projection === 'roadmap' && axis !== null && drawsGrid(axis));
```

In `src/view/render/shelf.ts`, `renderShelfCard`'s `wiring.axis === 'dates'` becomes `drawsGrid(wiring.axis)`.

- [ ] **Step 6: Distinguish the axes for the scroll anchor**

In `src/view/render/projections.ts`, `drawnContent` reads `'dates'` off a non-null `todayLeft`, which the resources axis also has — so switching between the two axes would read as the same content and the frame would not re-anchor. Ask the snapshot instead:

```ts
/** What the render just drew, named finer than the projection: the roadmap's axes are different content on one frame. */
function drawnContent(roadmap: RoadmapSnapshot | null, projection: Projection): string {
	// The axis itself, not a shape guessed from `todayLeft`: two axes draw a today line
	// now, and a switch between them is a content change the anchor has to see.
	return roadmap ? roadmap.roadmap.axis : projection;
}
```

Drop the now-unused `todayLeft` argument at its call site. `todayTrackLeft` keeps its own use of that value and is untouched.

- [ ] **Step 7: Run to verify they pass**

Run: `npx vitest run test/domain/roadmap.test.ts test/view/`
Expected: PASS. A failure in `test/view/timelineZoom.test.ts` or `test/view/roadmapFrame.test.ts` means the `drawnContent` change altered the anchor for an existing axis — it must not; re-read the call site before touching the test.

- [ ] **Step 8: Commit**

```bash
npm run check
git add src/domain/roadmap.ts src/view/render/toolbarControls.ts src/view/render/legend.ts src/view/resize.ts src/view/backlogView.ts src/view/render/shelf.ts src/view/render/projections.ts test/domain/roadmap.test.ts test/domain/resources.test.ts test/view/toolbarControls.test.ts test/helpers/roadmap.ts
git commit -m "Ask one predicate whether a roadmap axis draws the dated grid"
```

---

### Task 4: The grid draws an entry list

**Files:**
- Modify: `src/view/render/timeline.ts` (`TimelineEntry`, `renderTimeline`, `TimelineDrawing.grips`, `renderBarRow`, `BarRowMounts`)
- Modify: `src/view/render/roadmap.ts` (wraps its rows)
- Test: the existing `test/view/timeline*.test.ts` must stay green — this task is a refactor with no behaviour change

**Interfaces:**
- Consumes: `TimelineRow` from `src/domain/bars.ts`, `ResourceLane` from Task 2.
- Produces:
  - `type TimelineEntry = { kind: 'lane'; lane: ResourceLane } | { kind: 'row'; row: TimelineRow } | { kind: 'context'; item: BacklogItem }`
  - `renderTimeline(ctx, containerEl, entries: TimelineEntry[], drawing: TimelineDrawing): TimelineRender`
  - `TimelineDrawing.grips: boolean` — whether a bar on this grid may be taken hold of.
  - `barEntries(rows: TimelineRow[]): TimelineEntry[]` — the dated axis's own wrapping.

> **Land this with Task 5, or write Task 5's `renderLaneHead` / `renderLaneContextRow` first.** The loop below calls both. Do not stub them.

- [ ] **Step 1: Add the type and the wrapping**

In `src/view/render/timeline.ts`, above `renderTimeline`:

```ts
/**
 * One thing the grid draws, in draw order. The dated axis produces nothing but `row`
 * entries; the resources axis interleaves a `lane` header before each row's group and a
 * `context` entry for an excluded note the row places but cannot position.
 *
 * An ENTRY list rather than a row list, because lanes cost no second grid: the window,
 * the day header, the gridlines, the today line, the drop overlay and the dependency
 * layer are all derived from the bars in this list and are the same for both axes. A
 * second renderer over the same geometry is what would drift.
 */
export type TimelineEntry =
	| { kind: 'lane'; lane: ResourceLane }
	| { kind: 'row'; row: TimelineRow }
	| { kind: 'context'; item: BacklogItem };

/** The dated axis's own entries: every row, in order, and nothing else. */
export function barEntries(rows: TimelineRow[]): TimelineEntry[] {
	return rows.map((row): TimelineEntry => ({ kind: 'row', row }));
}
```

- [ ] **Step 2: Take entries in `renderTimeline`**

Change the third parameter to `entries: TimelineEntry[]`, and derive the bars from it:

```ts
	// Every bar the grid will draw, in draw order — the window, the milestone lines and
	// the dependency arrows are all computed from this and are axis-independent.
	const bars = entries.flatMap((entry) => (entry.kind === 'row' ? [entry.row.bar] : []));
```

Replace the `rows.forEach(...)` loop with:

```ts
	// The stripe counts drawn ROWS only: a lane header is chrome, and counting it would
	// flip the parity of every row beneath it.
	let drawnRows = 0;
	let lane: ResourceLane | null = null;
	for (const entry of entries) {
		if (entry.kind === 'lane') {
			lane = entry.lane;
			renderLaneHead(ctx, content, entry.lane);
			continue;
		}
		const row =
			entry.kind === 'context'
				? renderLaneContextRow(ctx, content, entry.item)
				: reportColors(renderBarRow(ctx, mounts, window, entry.row, scale), drawn);
		// Whose row this is, on the row itself: the header is a sibling div and cannot
		// label what follows it. See `renderLaneRowDescription`.
		if (lane) renderLaneRowDescription(row, lane.name);
		// Assigned at render because CSS has no nth-of-class, and nth-child would count
		// the header, the lines and the layers interleaved in this container.
		if (drawnRows % 2 === 1) row.addClass('pbl-row-even');
		drawnRows++;
	}
```

with one local beside `renderBarRow` so the colour reporting stays a single statement:

```ts
/** A bar row's element, with the colours it drew folded into the pass's report. */
function reportColors(rendered: { row: HTMLElement; colors: DrawnColors }, drawn: DrawnColors): HTMLElement {
	if (rendered.colors.done) drawn.done = true;
	if (rendered.colors.milestone) drawn.milestone = true;
	if (rendered.colors.accent) drawn.accent = true;
	return rendered.row;
}
```

Import `renderLaneHead`, `renderLaneContextRow` and `renderLaneRowDescription` from `./lanes`, and `ResourceLane` from `../../domain/roadmap`.

- [ ] **Step 3: Gate the grips**

Add to `TimelineDrawing`:

```ts
	/**
	 * Whether a bar here may be taken hold of. False on the resources axis, which wires
	 * no drop target for a gesture to land on — moves there are
	 * [[Assigning items to a resource]]'s. Withheld at the source rather than left
	 * dangling: a grip advertised over a grid with no target registered is exactly the
	 * "bars picked up and had nowhere to land" failure `src/view/CLAUDE.md` records.
	 */
	grips: boolean;
```

Thread it onto `BarRowMounts` as `grips: boolean`, set it where `mounts` is built (`grips: drawing.grips`), and in `renderBarRow`:

```ts
	const holds = mounts.grips ? barHolds(bar.item, ctx.host.settings, bar) : [];
```

`barClasses(bar, geometry, holds.includes('body'))` and the grip loop below both already do the right thing with an empty list.

- [ ] **Step 4: Update the one existing call site**

In `src/view/render/roadmap.ts`, the dated branch passes `barEntries(rows)` and `grips: true`.

- [ ] **Step 5: Run the whole view suite**

Run: `npx vitest run test/view/`
Expected: PASS, unchanged — this task draws exactly what it drew before. Any diff on the dated axis is a bug in the refactor, not a test to update.

- [ ] **Step 6: Commit**

```bash
npm run check
git add src/view/render/timeline.ts src/view/render/roadmap.ts src/view/render/lanes.ts
git commit -m "Draw the timeline from an entry list, so a lane header costs no second grid"
```

---

### Task 5: Lanes on screen

**Files:**
- Create: `src/view/render/lanes.ts`
- Create: `styles/lanes.css`
- Modify: `styles/index.css` (one `@import`)
- Modify: `src/view/render/roadmap.ts` (the resources branch)
- Modify: `src/view/render/shelf.ts` (`shelfRemoval`'s third branch)
- Modify: `docs/requirements/Showing a resources axis on the roadmap.md` (`## Where it lives`)
- Test: `test/view/resourceLanes.test.ts` (new), `test/helpers/roadmap.ts` (lane query helpers)

**Interfaces:**
- Consumes: `ResourceLane`, `RoadmapModel.lanes` (Task 2); `TimelineEntry`, `barEntries`, `TimelineDrawing.grips` (Task 4).
- Produces:
  - `laneEntries(lanes: ResourceLane[]): TimelineEntry[]`
  - `renderLaneHead(ctx: RowContext, content: HTMLElement, lane: ResourceLane): void`
  - `renderLaneContextRow(ctx: RowContext, content: HTMLElement, item: BacklogItem): HTMLElement`
  - `renderLaneRowDescription(row: HTMLElement, name: string): void`
  - DOM contract the tests and the stylesheet share: `.pbl-lane-head` > `.pbl-timeline-lead` > `.pbl-lane-name`, `.pbl-lane-count`, optional `.pbl-lane-stray`, and `.pbl-lane-add` (Task 6); `.pbl-lane-head.pbl-lane-undeclared` for a minted row; `.pbl-timeline-row.pbl-lane-context` for a bar-less context row.

- [ ] **Step 1: Add the lane query helpers**

In `test/helpers/roadmap.ts`:

```ts
export function lanesOf(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head'));
}

export function laneNames(containerEl: HTMLElement): string[] {
	return lanesOf(containerEl).map((el) => el.querySelector('.pbl-lane-name')?.textContent ?? '');
}

/** Every drawn row in order, lane headers included — what the reader's eye walks down. */
export function laneOrder(containerEl: HTMLElement): string[] {
	const rows = containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row');
	return Array.from(rows).map((el) =>
		el.classList.contains('pbl-lane-head')
			? `lane:${el.querySelector('.pbl-lane-name')?.textContent ?? ''}`
			: (el.querySelector('.pbl-card-title')?.textContent ?? ''),
	);
}
```

- [ ] **Step 2: Write the failing view tests**

Create `test/view/resourceLanes.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { refresh, useViewHarness } from '../helpers/view';
import { laneNames, laneOrder, lanesOf, resourceVault, roadmapView, shelfTitles } from '../helpers/roadmap';

useViewHarness();

const RESOURCES = { startProperty: 'note.start', targetProperty: 'note.due', assigneeProperty: 'note.assignee' };

function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}) {
	const harness = roadmapView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra });
	harness.view.setAxisPick('resources');
	refresh(harness);
	return harness;
}

describe('the resources axis on screen', () => {
	it('draws a row per declared resource, empty or not, then the minted ones', () => {
		const harness = laneRoadmap(resourceVault());
		expect(laneNames(harness.treeEl)).toEqual(['Alice', 'Bob', 'Zoe']);
	});

	it('draws each resource’s bars under that resource’s own header', () => {
		const harness = laneRoadmap(resourceVault());
		expect(laneOrder(harness.treeEl)).toEqual([
			'lane:Alice',
			'Alice dated',
			'Cased',
			'lane:Bob',
			'lane:Zoe',
			'Stray',
		]);
	});

	it('marks a minted row as outside the declared roster', () => {
		const harness = laneRoadmap(resourceVault());
		const [alice, bob, zoe] = lanesOf(harness.treeEl);
		expect(alice.classList.contains('pbl-lane-undeclared')).toBe(false);
		expect(bob.classList.contains('pbl-lane-undeclared')).toBe(false);
		expect(zoe.classList.contains('pbl-lane-undeclared')).toBe(true);
	});

	it('counts result bars on the header and shelves what has no row', () => {
		const harness = laneRoadmap(resourceVault());
		const alice = lanesOf(harness.treeEl)[0];
		expect(alice.querySelector('.pbl-lane-count')?.textContent).toBe('2');
		expect(shelfTitles(harness.treeEl)).toEqual(['Nobody', 'Undated']);
	});

	it('names the resource on each of its rows, since the header cannot label them', () => {
		// The header is a sibling div, not a container, so it cannot label the rows
		// beneath it — and no chip on a bar row says who it belongs to. Without this the
		// axis is unreadable without sight.
		const harness = laneRoadmap(resourceVault());
		const row = harness.treeEl.querySelector<HTMLElement>('.pbl-timeline-row');
		expect(row?.getAttribute('aria-description')).toBe('Assigned to Alice');
	});

	it('offers no grip on a bar, because nothing on this axis accepts a drop yet', () => {
		const harness = laneRoadmap(resourceVault());
		expect(harness.treeEl.querySelectorAll('.pbl-bar-grip')).toHaveLength(0);
	});

	it('draws an excluded note in the row that places it, with no bar', () => {
		const vault = new FakeVault();
		vault.addFile('Outside epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-02' },
			parentLink: 'Outside epic',
		});
		// The Epic is context: outside the filter, kept on screen to place its child.
		const harness = laneRoadmap(vault, { filterOut: 'Outside epic.md' });

		expect(laneOrder(harness.treeEl)).toEqual(['lane:Alice', 'Result', 'Outside epic', 'lane:Bob']);
		const context = harness.treeEl.querySelector<HTMLElement>('.pbl-lane-context');
		expect(context?.querySelector('.pbl-bar')).toBeNull();
		expect(lanesOf(harness.treeEl)[0].querySelector('.pbl-lane-count')?.textContent).toBe('1');
	});
});
```

> `filterOut` above stands for whatever mechanism this repository's view harness already uses to make a note load as context rather than as a result — `test/view/contextRowWrites.test.ts` builds such a fixture and is the pattern to copy. Read it first and use its mechanism; do not add a second one. The same goes for `.pbl-bar` — confirm the bar's real class in `barClasses` before asserting on it.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run test/view/resourceLanes.test.ts`
Expected: FAIL — no `.pbl-lane-head` renders; the axis draws a flat grid.

- [ ] **Step 4: Write the lane renderer**

Create `src/view/render/lanes.ts`:

```ts
import { setTooltip } from 'obsidian';
import { drawIcon } from './icons';
import { createCard } from './board';
import { RowContext } from './columns';
import { renderBadge, renderTitleText } from './rows';
import { TimelineEntry } from './timeline';
import { BacklogItem } from '../../domain/model';
import { ResourceLane } from '../../domain/roadmap';

/**
 * The resources axis's own rows: a header per resource, that resource's bars beneath it,
 * and — last in the group — any note the Base excluded that the row nonetheless places.
 *
 * Everything ELSE about the grid is the dated axis's, and is reached by producing
 * `TimelineEntry`s for it rather than drawing a second one: the window, the day header,
 * the gridlines, the today line, the milestone lines, the dependency layer and the drop
 * overlay are all derived from the bars in the list this module hands over.
 *
 * A row is FLAT — no chevron, no ancestry collapse. Membership is the note's own
 * assignee, so a parent and its child routinely sit in different rows, and the collapse
 * bit is keyed by path: an ancestry fold here would let one person's chevron hide another
 * person's bar. Which is why the rows carry `hasChildren: false` rather than asking
 * `timelineRows` — there is no disclosure to compute.
 */
export function laneEntries(lanes: ResourceLane[]): TimelineEntry[] {
	const entries: TimelineEntry[] = [];
	for (const lane of lanes) {
		entries.push({ kind: 'lane', lane });
		for (const bar of lane.bars) {
			entries.push({ kind: 'row', row: { bar, hasChildren: false, collapsed: false } });
		}
		// After the bars: a context row has no position, so it cannot be interleaved by
		// one, and it is not part of what this row is measured by.
		for (const item of lane.context) entries.push({ kind: 'context', item });
	}
	return entries;
}

/**
 * One resource's header row. The lead is `.pbl-timeline-lead` like every row's, so it
 * sticks and sizes off the one `--pbl-tl-lead` the grid publishes, and the empty track
 * carries the header's band across the day area.
 *
 * The count is RESULT bars, exactly as a bucket's is: a context row placed here is
 * placement, not population.
 *
 * **The accessibility cost, stated rather than smoothed over.** This is a div among
 * `option` rows inside a pane that is a `listbox` while cards render, and it labels the
 * rows below it by nothing but proximity — a header cannot be their container, because
 * every row is positioned against one shared day grid. So the resource's name goes on
 * each of its rows as well (`renderLaneRowDescription`) and this header claims no role of
 * its own. Same accepted deviation as the lead-resize grip's; how a screen reader
 * actually reads it is a live-vault check this harness cannot make.
 */
export function renderLaneHead(ctx: RowContext, content: HTMLElement, lane: ResourceLane): void {
	const head = content.createDiv({
		cls: 'pbl-lane-head' + (lane.declared ? '' : ' pbl-lane-undeclared'),
	});
	const lead = head.createDiv({ cls: 'pbl-timeline-lead' });
	lead.createSpan({ cls: 'pbl-lane-name', text: lane.name });
	lead.createSpan({ cls: 'pbl-lane-count', text: String(lane.bars.length) });
	if (!lane.declared) {
		const mark = lead.createSpan({ cls: 'pbl-lane-stray' });
		drawIcon(mark, 'circle-help');
		setTooltip(
			head,
			`"${lane.name}" is not one of the declared resources. Add it to "Resources (in order)" in the view options, or re-assign its items.`,
		);
	}
	head.createDiv({ cls: 'pbl-timeline-track' });
}

/**
 * A note the Base excluded, drawn in the row that places it. It renders, it says whose
 * row it is in, and that is all: no bar, own dates or inferred, because the dated axis
 * this one derives from never draws a context row's dates either — `deriveBars` routes
 * one to the context collection before `placeItem` is asked about it. So there is no
 * "what if it has no date" case to answer separately here.
 */
export function renderLaneContextRow(ctx: RowContext, content: HTMLElement, item: BacklogItem): HTMLElement {
	const row = createCard(ctx, content, item);
	row.addClass('pbl-timeline-row');
	row.addClass('pbl-lane-context');
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderBadge(ctx.host, lead, item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	renderTitleText(ctx.host, title, item.title);
	setTooltip(lead, item.title);
	row.createDiv({ cls: 'pbl-timeline-track' });
	return row;
}

/**
 * Whose row this is, on the row itself. A description rather than a label: a label would
 * REPLACE the content-derived accessible name and cost a reader the badge, the title and
 * the dates — `renderCardBody`'s outside-filter marker makes the same choice for the same
 * reason.
 */
export function renderLaneRowDescription(row: HTMLElement, name: string): void {
	row.setAttribute('aria-description', `Assigned to ${name}`);
}
```

- [ ] **Step 5: Dispatch the third axis in `renderRoadmap`**

In `src/view/render/roadmap.ts` the axis branch becomes three. Extract the grid half into its own function so `renderRoadmap` stays inside `max-lines-per-function`:

```ts
	if (axis === 'horizons') {
		const bucketsEl = frameEl.createDiv({ cls: 'pbl-roadmap-buckets' });
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket, dnd));
		dnd.wireScroller(treeEl);
	} else {
		// Both grid axes through one call: what differs is the ENTRY list and whether a
		// gesture may take hold of a bar — never a second grid.
		…renderGridAxis(ctx, frameEl, treeEl, roadmap, { axis, today, dnd }) and assign
		  cards, todayLeft, scroller, window, scale, leadWidth, drawn,
		  dependencyConflicts and palettes from what it returns…
	}
```

and inside `renderGridAxis`:

```ts
	const entries =
		axis === 'resources'
			? laneEntries(roadmap.lanes)
			// The dated axis's rows are the bars minus whatever a collapsed bar above them
			// is holding shut — asked here rather than in `buildRoadmap`, because collapse
			// is the view's own state. Lanes are flat and ask nothing.
			: barEntries(timelineRows(roadmap.bars, (path) => host.isCollapsed(path)));
	const timeline = renderTimeline(ctx, frameEl, entries, { …, grips: axis === 'dates' });
	// The grid is ONE positional drop target and it writes DATES. The resources axis
	// wires none: a move there writes an assignee, which is
	// [[Assigning items to a resource]]'s, and a grid accepting a date drag while its
	// rows mean something else would be writing the axis the user is not looking at.
	if (axis === 'dates') wireTimelineDrag(ctx, dnd, { … });
```

- [ ] **Step 6: Make the shelf inert on this axis**

In `src/view/render/shelf.ts`, `shelfRemoval` has a `'horizons'` branch and falls through to the dated one — so the resources axis would silently offer "drop a bar here to remove its dates". Give it its own branch ahead of that fallthrough:

```ts
	if (axis === 'resources') {
		// Nothing on this axis is a drag source or a drop target yet: a move here writes
		// an assignee, and that is [[Assigning items to a resource]]'s. So the strip
		// reports what could not be placed and accepts nothing — refused rather than
		// ignored, so it never highlights for a drag it would not honour.
		return {
			plan: () => undefined,
			tooltip: 'Results this axis cannot place — assign a resource, and give it dates to place it',
			accepts: () => false,
			outcome: null,
			canDrag: () => false,
		};
	}
```

Match `ShelfRemoval`'s real field types when writing `plan` — if it is declared as returning `void`, write `() => undefined` as `() => {}` or whatever satisfies it without a cast.

- [ ] **Step 7: Style the header**

Create `styles/lanes.css`:

```css
/*
 * The resources axis's row headers. The grid's geometry is `timeline.css`'s and is not
 * repeated here: the lead sticks and sizes off `--pbl-tl-lead` like every row's, and the
 * empty track is what carries the header band across the day area.
 */

.pbl-lane-head {
	display: flex;
	align-items: center;
	min-height: var(--pbl-lane-head-height, 28px);
	background-color: var(--background-secondary);
	border-bottom: 1px solid var(--background-modifier-border);
	font-weight: var(--font-semibold);
}

.pbl-lane-head .pbl-timeline-lead {
	display: flex;
	align-items: center;
	gap: var(--size-4-1);
	overflow: hidden;
}

.pbl-lane-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pbl-lane-count {
	color: var(--text-muted);
	font-weight: var(--font-normal);
}

.pbl-lane-undeclared .pbl-lane-name {
	font-style: italic;
}

/* A context row in a row draws no bar, so its track is deliberately empty. */
.pbl-lane-context .pbl-timeline-track {
	opacity: var(--pbl-context-opacity, 0.65);
}
```

In `styles/index.css`, import it **after** `timeline.css` — the header borrows `.pbl-timeline-lead` and must win at equal specificity:

```css
@import "./lanes.css";
```

Put that line directly after `@import "./timeline.css";` and annotate why, the way that file already annotates its load-bearing positions.

- [ ] **Step 8: Name the new modules in the register**

In `docs/requirements/Showing a resources axis on the roadmap.md`, rewrite `## Where it lives` from "Unbuilt." to what now exists, naming every new module — `docs-check.mjs` rule 7 requires each `src/` module to be specified by a note, and this commit adds one:

- `src/view/render/lanes.ts` — the row header, the row's bar-less context row, and the entry list the grid draws from.

Keep the paragraph's existing sentences about `deriveBuckets`' sibling, `configuredAxes`, `AXIS_LABEL` and `collapseStore`'s `AXIS_VALUES`, changing "would" to what was done. Leave the closing paragraph about the absence seam as it stands — still true, still `Resource absences`' work.

- [ ] **Step 9: Run to verify they pass**

Run: `npx vitest run test/view/`
Expected: PASS.

- [ ] **Step 10: Watch one invariant fail**

Change `laneEntries` to push each `lane.context` item as a `{ kind: 'row', … }` with a bar built from the item's own dates. Run `npx vitest run test/view/resourceLanes.test.ts` and see "draws an excluded note in the row that places it, with no bar" go red. Restore it.

- [ ] **Step 11: Commit**

```bash
npm run check
git add src/view/render/lanes.ts src/view/render/roadmap.ts src/view/render/timeline.ts src/view/render/shelf.ts styles/lanes.css styles/index.css test/view/resourceLanes.test.ts test/helpers/roadmap.ts "docs/requirements/Showing a resources axis on the roadmap.md"
git commit -m "Draw a row per resource on the roadmap, over the dated grid it derives from"
```

---

### Task 6: Creating into a resource's row

**Files:**
- Modify: `src/view/interactions/create.ts` (`CreatePlacement.assignee`, the request, the announcement)
- Modify: `src/storage/frontmatter.ts` (`NewItemSpec.assignee`, the creation write)
- Modify: `src/view/render/lanes.ts` (the header's New button)
- Modify: `styles/lanes.css` (the button's reveal)
- Test: `test/view/resourceLanes.test.ts`, `test/storage/frontmatter.test.ts`

**Interfaces:**
- Consumes: `promptCreateItem(host, choices, parentItem, placement)`, `newItemType(settings, model)`.
- Produces: `CreatePlacement.assignee?: string`; `NewItemSpec.assignee?: string`.

- [ ] **Step 1: Write the failing tests**

In `test/storage/frontmatter.test.ts`, beside the existing `createBacklogItem` horizon test and in that file's own async shape:

```ts
it('writes a created note’s resource in the same single write as its type and rank', async () => {
	const vault = new FakeVault();
	const settings = settingsWith({ assigneeKey: 'assignee' });
	await createBacklogItem(vault.app, settings, {
		folder: '', title: 'New thing', typeName: 'Epic', parent: null, order: 10, assignee: 'Alice',
	});
	expect(vault.contents.get('New thing.md')).toContain('assignee: Alice');
});

it('never writes a resource to an unconfigured key', async () => {
	const vault = new FakeVault();
	const settings = settingsWith({ assigneeKey: '' });
	await createBacklogItem(vault.app, settings, {
		folder: '', title: 'New thing', typeName: 'Epic', parent: null, order: 10, assignee: 'Alice',
	});
	expect(vault.contents.get('New thing.md')).not.toContain('Alice');
});
```

Use that file's own way of reading a created note's content if `vault.contents` is not it.

In `test/view/resourceLanes.test.ts`:

```ts
it('offers a New button per row, naming the resource it creates into', () => {
	const harness = laneRoadmap(resourceVault());
	const add = lanesOf(harness.treeEl)[0].querySelector<HTMLButtonElement>('.pbl-lane-add');
	expect(add).not.toBeNull();
	expect(add?.getAttribute('tabindex')).toBe('-1');
	expect(add?.getAttribute('aria-label')).toBe('New Epic for Alice');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/storage/frontmatter.test.ts test/view/resourceLanes.test.ts`
Expected: FAIL — `assignee` is not a property of `NewItemSpec`; no `.pbl-lane-add` renders.

- [ ] **Step 3: Carry the resource into the creation write**

In `src/storage/frontmatter.ts`, in `NewItemSpec`:

```ts
	/** The resource's row it was created in, when it was created from one. */
	assignee?: string;
```

and in `createBacklogItem`, after the `axisEntries` loop:

```ts
	// A note created in a resource's row claims that resource in the SAME write, for the
	// bucket's own reason: it is never momentarily a note in a row its frontmatter does
	// not name. Both rules the write boundary keeps everywhere are here — never to an
	// unconfigured key, and a value the user picked written plainly. This is the LABEL
	// shape rather than the axis's: no civil-date equality and no datetime merge, exactly
	// as `applyLabels` treats the assignee on the edit path.
	const assigneeKey = optionalKeyFor(settings, 'assignee');
	if (spec.assignee && assigneeKey) setOwn(fm, assigneeKey, spec.assignee);
```

- [ ] **Step 4: Carry it through the prompt**

In `src/view/interactions/create.ts`, in `CreatePlacement`:

```ts
	/** The resource's row it was created in — written as the note's assignee. */
	assignee?: string;
```

Thread it exactly as `horizon` is threaded: onto the internal request interface, and into the `createBacklogItem` call. Then announce it, because unlike a bucket this write does not draw the card where it was created:

```ts
		// A bucket's write PLACES the note; a row's does not. Creation supplies no date,
		// so the new note is exactly the "assigned, nothing to position it at" case the
		// moment it is read back, and it shelves on the same refresh that created it.
		// Said out loud rather than left to look like a bug: a click on a specific row
		// must not silently produce a card that renders somewhere else entirely.
		new Notice(
			request.assignee
				? `Created "${file.basename}" for ${request.assignee}. Add a start or target date to place it in the row.`
				: `Created "${file.basename}".`,
		);
```

- [ ] **Step 5: Add the button**

In `src/view/render/lanes.ts`, called from `renderLaneHead` after the count and the stray mark:

```ts
/**
 * Create straight into this row. The New flow runs exactly as the toolbar's — the same
 * config gate, the same type folders, the same type — with this row's resource written in
 * the creation write, so a note never sits in a row its frontmatter does not claim.
 *
 * `tabindex="-1"` like the bucket's and the tree's: the pane is one tab stop and a row is
 * not a keyboard stop of its own. The capability is not lost, only the shortcut — the
 * toolbar's New button is an ordinary tab stop and Set assignee names any resource from
 * the row menu. Closing the gap properly means row stops, which is
 * `docs/requirements/Keyboard and menu on the roadmap.md`'s work.
 */
function renderLaneNew(ctx: RowContext, lead: HTMLElement, lane: ResourceLane): void {
	const host = ctx.host;
	const model = host.model;
	if (!model) return;
	const type = newItemType(host.settings, model);
	const btn = lead.createEl('button', {
		cls: 'clickable-icon pbl-lane-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': `New ${type} for ${lane.name}` },
	});
	drawIcon(btn, 'plus');
	setTooltip(btn, `New ${type} for "${lane.name}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { assignee: lane.name }));
}
```

Import `newItemType` and `promptCreateItem` from `../interactions/create`. Add the button's reveal rules to `styles/lanes.css`, copying `.pbl-bucket-add`'s own pair in `styles/roadmap.css` **including its `hover: none` rule** — without that a touch user gets neither the hover nor a tab stop and the control is unreachable rather than merely hidden.

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run test/storage/frontmatter.test.ts test/view/resourceLanes.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run check
git add src/storage/frontmatter.ts src/view/interactions/create.ts src/view/render/lanes.ts styles/lanes.css test/storage/frontmatter.test.ts test/view/resourceLanes.test.ts
git commit -m "Create into a resource's row, and say that a date is what would place it"
```

---

### Task 7: The claims, and the checks under them

**Files:**
- Modify: `test/view/contextCardWrites.test.ts` (a resources block)
- Modify: `test/view/resourceLanes.test.ts` (the chip claim)
- Modify: `docs/requirements/Showing a resources axis on the roadmap.md` (close it)
- Modify: `CHANGELOG.md`

**Interfaces:** none — this task adds no production code. If a check here fails, the fix belongs in the task that owns it.

- [ ] **Step 1: Check the chip claim**

The AC says a card's assignee chip must not also draw while the card renders inside its resource's row. It is currently true by construction — a bar row uses the card SHELL and never goes through `renderCardBody`, which is what draws the chips — so the check is what keeps it true, and the sentence must claim only that:

```ts
it('draws no assignee chip on a bar row — the row already says whose it is', () => {
	// True by construction today: a bar row uses the card shell and never goes through
	// `renderCardBody`, which is what draws the chips. This is the check under that,
	// not a second mechanism — and the SHELF's cards keep their chip, because no row
	// there says who they belong to.
	const harness = laneRoadmap(resourceVault());
	const row = harness.treeEl.querySelector<HTMLElement>('.pbl-timeline-row');
	expect(row?.querySelector('.pbl-assignee-chip')).toBeNull();
	const shelfCard = harness.treeEl.querySelector<HTMLElement>('.pbl-shelf .pbl-card');
	expect(shelfCard?.querySelector('.pbl-assignee-chip')).not.toBeNull();
});
```

Confirm the assignee chip's actual class in `renderLabelChip`'s `LABEL_CHIPS` table (`src/view/render/columns.ts`) and use whichever class it really carries; confirm the shelf's own container class too. If the second half does not hold — the shelved fixture may draw the dashed *Assignee* invitation rather than a value — assert that instead. Do not weaken the first half to make the second pass.

- [ ] **Step 2: Ask the context-row questions of this projection**

`test/view/contextCardWrites.test.ts` asks the same three questions of each card projection. Add a resources block mirroring the roadmap block beside it: a context row in a lane is never wired as a draggable; the keyboard cannot move it (nothing on this axis moves anything yet); `applySafely`'s outside-filter refusal is the structural backstop behind both. Assert too that it is never counted — `.pbl-lane-count` reports result bars only — which the derivation test covers in the domain and this covers on screen.

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: all five steps pass. Coverage thresholds only ever go up — if the new modules move one, raise it in `vitest.config.mts` rather than lowering anything.

- [ ] **Step 4: Close the note in the register**

In `docs/requirements/Showing a resources axis on the roadmap.md`:

- frontmatter `status: Open` → `status: Done`, and add a `files:` list of every `src/` path this plan touched, in the shape `docs/requirements/Setting the assignee on an item.md` already uses.
- Add a short paragraph under `## Where it lives` stating the three things this plan deliberately did not deliver, so the next reader does not go looking for them: the axis is read-only (moves are `Assigning items to a resource`'s), the absence source is unbuilt (`Resource absences`'), and the template-precedence AC bullet is unimplementable until templates exist. Write them as what is owed, not as what is done.
- Leave the sibling PBIs' `status` alone.

- [ ] **Step 5: Add the changelog entry**

Under `## [Unreleased]` in `CHANGELOG.md`, one line naming the feature from the user's side — "A resources axis on the roadmap: one row per resource, with each assigned item positioned by its own dates" — not the modules.

- [ ] **Step 6: Commit**

```bash
npm run check
git add test/view/contextCardWrites.test.ts test/view/resourceLanes.test.ts "docs/requirements/Showing a resources axis on the roadmap.md" CHANGELOG.md
git commit -m "Put checks under the resources axis's claims, and close its PBI"
```

- [ ] **Step 7: Hand it over for the check this harness cannot make**

Run `npm run test-build` and say plainly what is still owed: the lane header's appearance in a themed vault, the New button's reveal on a hoverless device, and how a screen reader reads a header div among `option` rows. Obsidian cannot run here, and no harness mock was made.

---

## Self-review

**Spec coverage** — every acceptance criterion, and where it lands:

| Acceptance criterion | Task |
| --- | --- |
| Third choice through the existing picker, never reachable alone, never the default, last in priority order | 2 (steps 1, 5, 8) |
| A saved pick survives a reload — the storage layer's own string vocabulary | 2 (steps 3, 7) |
| Losing its configuration falls back the same generic way | 2 (step 1, third test) |
| Declared resources render in declared order, empty or not; roster optional, nothing prefilled | 1; 2 (step 1); 5 (step 2) |
| Membership is the note's own assignee; position is the dated axis's own computation | 2 (step 2) |
| Undeclared-but-observed assignee gets a trailing row; nothing is lost | 2 (step 2); 5 (step 2) |
| No assignee shelves; assignee with no date to place shelves | 2 (step 2) |
| Context row groups into an existing row only, never mints, never counted, never shelved, never a positioned bar | 2 (step 2); 5 (steps 2, 10); 7 (step 2) |
| Creating from a row writes the resource in the single creation write, shelves, and says so | 6 |
| Creating from a row wins over a picked template's assignee | **Deferred** — templates are unbuilt; stated in Scope and in the note (Task 7) |
| No assignee chip on a card rendering inside its resource's row | 7 (step 1) |
| Extension 1a's toolbar control, and the grid's own controls following the axis | 2 (step 8); 3 |

**Placeholder scan:** no TBDs. Five places name a mechanism to be *read* rather than invented — the context-row fixture (`filterOut`), the view-options group helper (`groupNamed`), `readEntry`'s reach in the collapse-store suite, the assignee chip's class, and `ShelfRemoval.plan`'s exact return type — each with the existing file to copy from and an explicit instruction not to add a second mechanism. Deliberate: guessing any of them would add a second way to do something already done, which this repository has a rule against.

**Type consistency:** `RoadmapAxis` gains `'resources'` in Task 2, and the one `Record<RoadmapAxis, …>` (`AXIS_LABEL`) is completed in the same task, so the build never breaks between commits. `ResourceLane` is spelled identically in `roadmap.ts`, `lanes.ts` and both test files. `TimelineEntry`'s three variants are produced only by `barEntries` (Task 4) and `laneEntries` (Task 5) and consumed only by `renderTimeline`'s loop. `TimelineDrawing.grips` is added and passed at both call sites in Task 4. `CreatePlacement.assignee` and `NewItemSpec.assignee` are both `assignee?: string`.

**One ordering constraint:** Tasks 4 and 5 may be squashed into one commit, but Task 4 cannot be committed before `renderLaneHead`, `renderLaneContextRow` and `renderLaneRowDescription` exist — `renderTimeline`'s loop calls all three. Write them once, in Task 5's form.
