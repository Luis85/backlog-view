# Finish the Iterations Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build [[An iteration draws as a bar or a line]], verify and close [[An iteration's timeframe schedules its items]], and close the [[An Iterations board]] feature.

**Architecture:** A new `drawsAsPoint` predicate splits "drawn at one date" off the structural `isMarkerType`; a new `iterationBars` view option (default off) feeds it; the roadmap's grid axes admit `Iteration` items through an axis-aware `projectionMember`; three marker surfaces (lane caption, legend swatch, `spanText`) become content-aware. Spec: `docs/superpowers/specs/2026-08-16-finish-iterations-board-design.md` — read it first; it records the user's decisions and their reasons.

**Tech Stack:** TypeScript, Obsidian Bases view API, vitest (node + jsdom), the repo's own harness helpers (`test/helpers/`).

## Global Constraints

- `npm run check` (build, lint, coverage-thresholded tests, fallow, docs register) must pass before EVERY commit — CI runs the same five on Ubuntu and Windows.
- Never write frontmatter outside `storage/frontmatter.ts` / `storage/createNote.ts`; layer rule: `main → commands → view → storage → domain` (lint-enforced).
- 400-line max per `src/` file; 450 per `test/` file. Split before you exceed.
- Sentence-case UI text; `setCssProps` over inline styles; English literals are acceptable (the Multilang sweep is separate work).
- `isMarkerType` keeps its structural meaning — its callers listed in Task 1 Step 4 as "unchanged" must NOT be edited.
- An unconfigured key is never written to; absence is a value; `null` in an `AxisWrite` means delete.
- A context row (`outsideFilter`) is never a write target, ranking peer, or vocabulary source.
- The mock file `test/harness/mock.ts` from the brainstorm stays uncommitted (a copy is in the session scratchpad); never `git add` it.

---

### Task 1: The predicate and the option

**Files:**
- Modify: `src/domain/itemTypes.ts` (beside `isMarkerType`, ~line 194, and `placementEnds`, ~line 327)
- Modify: `src/domain/settings.ts` (interface ~line 180, defaults ~line 335)
- Modify: `src/domain/settingsResolve.ts` (beside `bool('hierarchyOnly', …)`, ~line 268)
- Modify: `src/domain/viewOptions.ts` (the `Iterations` group, ~line 277)
- Modify: `src/domain/bars.ts` (`placeItem` ~97, `deriveBars` ~119, `barHolds` ~271)
- Modify (threading `placementEnds`' new argument — every call site): `src/storage/frontmatter.ts:126`, `src/view/cardMoves.ts:161,188,211`, `src/view/render/chips.ts:311`, `src/view/render/shelf.ts:132`, `src/view/interactions/cardDrag.ts:367`, `src/view/interactions/timelineDrag.ts:262`, `src/view/interactions/plan.ts:43,48,201,257,287`, plus `carriesDates`' caller `src/view/interactions/menu.ts:752`
- Test: `test/domain/bars.test.ts` (extend), `test/domain/settings.test.ts` or wherever `resolveSettings` is tested (`grep -rln "resolveSettings" test/domain/` and pick the file that tests option resolution)

**Interfaces:**
- Consumes: `isMarkerType(typeName)`, `isIterationType(typeName)` (existing, unchanged).
- Produces (later tasks rely on these exact signatures):
  - `drawsAsPoint(typeName: string | null, iterationBars: boolean): boolean` in `src/domain/itemTypes.ts`
  - `placementEnds(typeName: string | null, iterationBars: boolean): PlacementEnd[]` (second parameter now REQUIRED)
  - `BacklogSettings.iterationBars: boolean` (default `false`; view-option key `iterationBars`)
  - `placeItem(item, stated, iterationBars: boolean)` and `deriveBars(rows, iterationBars: boolean)` in `src/domain/bars.ts`

- [ ] **Step 1: Write the failing tests** — in `test/domain/bars.test.ts` (its `itemFor` helper builds a `BacklogItem` from a `FakeVault`; `DATE_AXIS` maps `note.start`/`note.target`). Add:

```ts
import { drawsAsPoint, placementEnds } from '../../src/domain/itemTypes';

describe('drawsAsPoint', () => {
	it('splits the drawing question off the structural one', () => {
		// A milestone IS a point; an iteration is one exactly while the option is off.
		expect(drawsAsPoint('Milestone', false)).toBe(true);
		expect(drawsAsPoint('Milestone', true)).toBe(true);
		expect(drawsAsPoint('Iteration', false)).toBe(true);
		expect(drawsAsPoint('Iteration', true)).toBe(false);
		expect(drawsAsPoint('PBI', false)).toBe(false);
		expect(drawsAsPoint(null, false)).toBe(false);
	});

	it('narrows placementEnds: a point admits its target alone', () => {
		expect(placementEnds('Iteration', false)).toEqual(['target']);
		expect(placementEnds('Iteration', true)).toEqual(['start', 'target']);
		expect(placementEnds('Milestone', true)).toEqual(['target']);
	});
});

describe('an iteration on the dated axis', () => {
	function sprintVault(fm: Record<string, unknown>): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10, ...fm } });
		return vault;
	}

	it('is a point at its target while the option is off, its start ignored', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-07', target: '2026-09-20' }));
		const placed = placeItem(item, statedEnds(item), false);
		if (placed.kind !== 'bar') throw new Error('expected a bar');
		expect(placed.bar.span).toEqual({ start: placed.bar.span.target, target: placed.bar.span.target });
	});

	it('is a start→target span while the option is on', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-07', target: '2026-09-20' }));
		const placed = placeItem(item, statedEnds(item), true);
		if (placed.kind !== 'bar') throw new Error('expected a bar');
		expect(placed.bar.span.start).toEqual({ year: 2026, month: 9, day: 7 });
		expect(placed.bar.span.target).toEqual({ year: 2026, month: 9, day: 20 });
	});

	it('shelves with no target in line mode, places open-ended on a start in bar mode', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-07' }));
		expect(placeItem(item, statedEnds(item), false).kind).toBe('shelf');
		const barMode = placeItem(item, statedEnds(item), true);
		expect(barMode.kind).toBe('bar');
	});

	it('shelves a reversed span in bar mode with the ordinary reason', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-20', target: '2026-09-07' }));
		const placed = placeItem(item, statedEnds(item), true);
		if (placed.kind !== 'shelf') throw new Error('expected the shelf');
		expect(placed.reason).toBe('Target date precedes the start date');
	});

	it('holds: body-only as a point, grips per configured key as a bar', () => {
		const { item, settings } = itemFor(sprintVault({ start: '2026-09-07', target: '2026-09-20' }));
		const point = placeItem(item, statedEnds(item), false);
		if (point.kind !== 'bar') throw new Error('unreachable');
		expect(barHolds(item, settings, point.bar)).toEqual(['body']);
		const span = placeItem(item, { ...statedEnds(item) }, true);
		if (span.kind !== 'bar') throw new Error('unreachable');
		const on = { ...settings, iterationBars: true };
		expect(barHolds(item, on, span.bar)).toEqual(['start', 'end', 'body']);
		// The configuration still decides writable: no start property, no start grip.
		const noStart = { ...on, startDateKey: '' };
		expect(barHolds(item, noStart, span.bar)).not.toContain('start');
	});
});
```

Check the exact settings field name for the start key first (`grep -n "startDateKey\|startKey" src/domain/settings.ts`) and use what `optionalKeyFor(settings, 'start')` reads — adjust `noStart` accordingly.

Note: `itemFor` in that file takes `(vault, path, values)`; the snippets above call it as `itemFor(sprintVault(...))` — write a tiny local wrapper `const itemFor = (vault: FakeVault) => itemForAt(vault, 'Sprint 12.md')` or call the existing helper with the path; match the file's own idiom.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/domain/bars.test.ts`
Expected: FAIL — `drawsAsPoint` is not exported; `placeItem` called with 3 arguments.

- [ ] **Step 3: Implement the domain half**

In `src/domain/itemTypes.ts`, after `isMarkerType` (keep `isIterationType` above it in place):

```ts
/**
 * True when this type is DRAWN at one date rather than across two, and holdable at
 * neither end. A milestone is a point because a milestone IS a point; an iteration has
 * two ends and the reader decides which reading they want (`iterationBars`). Its own
 * predicate rather than a widened `isMarkerType`, for the reason recorded at
 * `isExtraType`: widening a predicate makes it mean two things at every call site.
 * `isMarkerType` keeps the structural question — no rung, no children, no prerequisites.
 */
export function drawsAsPoint(typeName: string | null, iterationBars: boolean): boolean {
	if (!isMarkerType(typeName)) return false;
	return isIterationType(typeName) ? !iterationBars : true;
}
```

Change `placementEnds` to ask it (second parameter REQUIRED, no default — a defaulted flag is the silent-old-meaning defect the PBI names):

```ts
export function placementEnds(typeName: string | null, iterationBars: boolean): PlacementEnd[] {
	return drawsAsPoint(typeName, iterationBars) ? ['target'] : [...BOTH_ENDS];
}
```

In `src/domain/settings.ts`: add `iterationBars: boolean;` to `BacklogSettings` beside `iterationKey` and `iterationBars: false,` to the defaults object.

In `src/domain/settingsResolve.ts`, beside the other `bool(...)` lines: `iterationBars: bool('iterationBars', fallback.iterationBars),`.

In `src/domain/viewOptions.ts`, append to the `Iterations` group's `items` (after `iterationLengthDays`):

```ts
{
	type: 'toggle',
	key: 'iterationBars',
	displayName: 'Draw iterations as bars',
	default: false,
},
```

In `src/domain/bars.ts`:
- `placeItem(item, stated, iterationBars: boolean)`; its marker branch becomes `if (drawsAsPoint(item.typeName, iterationBars)) return placeMarker(item, stated.target);` (import `drawsAsPoint`; keep the comment about the reduction, updated to name the predicate).
- `deriveBars(rows, iterationBars: boolean)` passes it through to `placeItem`.
- `barHolds` line ~272: `const ends = placementEnds(item.typeName, settings.iterationBars);` and line ~274: `if (drawsAsPoint(item.typeName, settings.iterationBars)) return writable('target') ? ['body'] : [];` — this is the PBI's "easy to miss" call site: without it the bar draws and nothing can resize it.

- [ ] **Step 4: Thread the new argument through every caller (compiler-driven)**

Run `npm run build` and fix each error. The full list, with what to pass:

| Site | Pass |
| --- | --- |
| `src/storage/frontmatter.ts:126` | `settings.iterationBars` (the writer asks the same predicate — PBI extension 5a) |
| `src/view/cardMoves.ts:161,188,211` | `this.host.settings.iterationBars` (or the local `settings`) |
| `src/view/render/chips.ts:311` | thread from the render context's `host.settings` (add a parameter to the small helper if `settings` is not in scope) |
| `src/view/render/shelf.ts:132` (`removalOutcome`) | add a `settings: BacklogSettings` parameter; its caller in the same file has the host |
| `src/view/interactions/cardDrag.ts:367` | `this.host.settings.iterationBars` |
| `src/view/interactions/timelineDrag.ts:262` | `settings.iterationBars` (already in scope) |
| `src/view/interactions/plan.ts:43,48,201,257,287` | `settings.iterationBars`; `carriesDates(item)` gains a `settings` parameter — update its one caller `src/view/interactions/menu.ts:752` |
| `src/domain/roadmap.ts` (`buildRoadmap` → `deriveBars`, and `placeBar` → `placeItem`) | `settings.iterationBars` (both have `settings`) |
| existing tests calling `placeItem`/`deriveBars`/`placementEnds` | `false`, or `settings.iterationBars` where a settings object is in scope |

Do NOT touch the structural `isMarkerType` call sites: `itemTypes.ts:247` (`childTypeChoices`), `readItems.ts:280`, `model.ts:350,605`, `dependencies.ts:393`, `roadmap.ts:514,589` (lane grouping), `render/lanes.ts:127-128` (marker-lane split — an iteration bar still draws in the marker lane), `render/roadmap.ts:320` (a positional gesture on a marker never writes an assignee), `interactions/dependencies.ts`, `interactions/labels.ts:382`, `projection.ts:273`.

- [ ] **Step 5: Add the option-resolution test** — in the file that tests `resolveSettings` option resolution:

```ts
it('iterationBars defaults off and resolves the toggle', () => {
	expect(resolveSettings(new FakeViewConfig({})).iterationBars).toBe(false);
	expect(resolveSettings(new FakeViewConfig({ iterationBars: true })).iterationBars).toBe(true);
});
```

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: PASS (behaviour is unchanged with the option off — iterations still draw nowhere; only the domain answers moved).

- [ ] **Step 7: Commit**

```bash
git add -A ':!test/harness/mock.ts'
git commit -m "Split drawsAsPoint from isMarkerType behind an iterationBars option"
```

---

### Task 2: Admit iterations to the grid axes

**Files:**
- Modify: `src/view/projection.ts` (`projectionMember`, ~line 156)
- Modify: `src/view/rowVisibility.ts` (`visibilityRule`, ~line 59)
- Modify: `src/view/backlogView.ts` (~lines 314, 318 — the two `visibilityRule` calls)
- Modify: `src/view/filterState.ts` (~line 143 — the filter index's `projectionMember` call; thread the axis so a quick filter can find an iteration the grid draws)
- Test: `test/view/iterationHidden.test.ts` (reshape), `test/view/roadmap.test.ts` (shelf case)

**Interfaces:**
- Consumes: `drawsGrid(axis)` and `activeAxis(settings, pick)` from `src/domain/roadmap.ts` (existing); `isIterationType` from `src/domain/itemTypes.ts`.
- Produces: `projectionMember(projection: Projection, scope: string | null = null, axis: RoadmapAxis | null = null)` — later tasks and every existing caller rely on the two-argument form still meaning "the plan's answer".

- [ ] **Step 1: Reshape the sweep test first.** `test/view/iterationHidden.test.ts` is the instrument from commit `b08097e` — read its header comment before editing. The claim changes from "no projection draws an iteration" to "the grid axes' marker row (and their shelf, unplaced) and nothing else". Rework the assertion:

```ts
// Was: expect(drew, …).toEqual([])
// The grid axes draw it in the shared marker row — the one admission
// ([[An iteration draws as a bar or a line]]). Everything else still refuses,
// the horizons axis with its buckets AND its shelf.
expect(drew.sort()).toEqual(['roadmap — dates', 'roadmap — resources']);
```

Add a second sweep case in the same describe: an iteration with NO dates (`start`/`due` absent from the Sprint 12 frontmatter — build a second vault fixture) must appear on the grid axes' SHELF (extension 3b: a point without a target is nothing to draw) and still nowhere on `tree`, `board`, `deliverables`, `catalog`, `iteration board`, or `roadmap — horizons`. The existing `shown()` helper reads shelf cards (`.pbl-card`) once `setShelfCollapsed(false)` has run, so the same instrument answers both.

Keep the `is in no count` test unchanged — the toolbar's figures still exclude iterations.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/view/iterationHidden.test.ts`
Expected: FAIL — `drew` is `[]`, the grid axes do not draw it yet.

- [ ] **Step 3: Implement the admission.** In `src/view/projection.ts`:

```ts
import { RoadmapAxis, drawsGrid } from '../domain/roadmap';

export function projectionMember(
	projection: Projection,
	scope: string | null = null,
	axis: RoadmapAxis | null = null,
): (item: BacklogItem) => boolean {
	if (projection === 'catalog') return inCatalog;
	if (projection === 'iteration' && scope !== null) {
		return (item) => (item.outsideFilter ? inPlan(item) : inIteration(item, scope));
	}
	// The grid axes draw an `Iteration` in the shared marker row — the one admission,
	// axis-aware because the horizons axis (buckets and its shelf alike) still refuses
	// one. Everything downstream inherits this through `rowHidden`, which is the point:
	// the filter index, the counts and the shelf all read the same predicate.
	if (projection === 'roadmap' && axis !== null && drawsGrid(axis)) {
		return (item) => inPlan(item) || isIterationType(item.typeName);
	}
	return inPlan;
}
```

In `src/view/rowVisibility.ts`: `visibilityRule` gains `axis: RoadmapAxis | null = null` as its last parameter and passes it to `projectionMember(projection, scope, axis)`.

In `src/view/backlogView.ts` (~314, 318): pass the resolved axis — `this.projection === 'roadmap' ? activeAxis(this.settings, this.axisPick) : null` (both `activeAxis` and `drawsGrid` are already imported at line 26; mirror the line-400 idiom).

In `src/view/filterState.ts` (~143): thread the same axis argument through to its `projectionMember` call — find how `projection`/`scope` reach that line and add `axis` the same way, passing it from the view's call site.

Leave `dragDrop.ts` and `cardChildren.ts` callers on the two-argument form: the tree's drop targets and a card's child list never meet an iteration (it has no parent and no children), and the two-argument form still means the plan's answer.

- [ ] **Step 4: Run the reshaped sweep and the full view suite**

Run: `npx vitest run test/view/iterationHidden.test.ts test/view/roadmap.test.ts`
Expected: PASS. If `roadmap.test.ts` breaks, read the failure — a count assertion that now includes a drawn iteration means a fixture in that file has an `Iteration` note; fix the assertion only if the new number is correct per "an admitted iteration counts as a placed marker, the milestone precedent" (spec: Baseline correction).

- [ ] **Step 5: Full gate, then commit**

Run: `npm run check`

```bash
git add -A ':!test/harness/mock.ts'
git commit -m "Admit iterations to the roadmap's grid axes and their shelf"
```

---

### Task 3: Content-aware marker labels

**Files:**
- Modify: `src/domain/roadmap.ts` (beside `markerLane`, ~line 143)
- Modify: `src/view/render/lanes.ts` (`renderLaneHeader` ~line 294 — caption; `spanText`; `drawMarkerDiamonds` — the `drawn` report at its tail)
- Modify: `src/view/host.ts` (`DrawnColors`, ~line 107)
- Modify: `src/view/render/legend.ts` (~line 68)
- Modify: `src/view/render/timeline.ts` (~line 309 — the `DrawnColors` literal; `renderBarRow`'s `BarColors` literal ~line 690)
- Test: `test/view/roadmap.test.ts`

**Interfaces:**
- Consumes: `isIterationType` (domain), `displayType(item)` from `src/domain/itemTypes.ts` (existing: `{ levelIndex, ladder, typeName } → string`).
- Produces: `markerLaneCaption(bars: TimelineBar[]): string` in `src/domain/roadmap.ts`; `DrawnColors.iteration: boolean` (which also lands in `BarColors` via the existing `Omit`).

- [ ] **Step 1: Write the failing tests** in `test/view/roadmap.test.ts` (use its existing `makeView`/axis helpers; fixtures need `type: 'Iteration'` notes with dates and the `iterationProperty`/date-axis options — copy the OPTIONS shape from `test/view/iterationHidden.test.ts`):

```ts
const MARKER_OPTIONS = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	iterationProperty: 'note.iteration',
};

function markerVault(kinds: ('milestone' | 'iteration')[]): FakeVault {
	const vault = new FakeVault();
	vault.addFile('An epic.md', { frontmatter: { type: 'Epic', order: 1, start: '2026-09-01', due: '2026-10-15' } });
	if (kinds.includes('milestone')) {
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-09-30' } });
	}
	if (kinds.includes('iteration')) {
		vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', order: 20, start: '2026-09-07', due: '2026-09-20' },
		});
	}
	return vault;
}

function datedAxis(vault: FakeVault, extra: Record<string, unknown> = {}) {
	const harness = makeView(vault, { ...MARKER_OPTIONS, ...extra }, { base: 'Plan.base' });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('dates');
	return harness;
}

describe('the marker surfaces name what is drawn', () => {
	const caption = (el: HTMLElement) => el.querySelector('.pbl-lane-head .pbl-lane-name')?.textContent;
	const swatchLabel = (el: HTMLElement) =>
		el.querySelector('.pbl-legend-swatch.pbl-legend-milestone')?.parentElement?.querySelector('.pbl-legend-label')
			?.textContent;

	it('captions the marker lane by its contents', () => {
		// Milestone-only vaults see no change — the user accepted truncation, not renaming.
		expect(caption(datedAxis(markerVault(['milestone'])).containerEl)).toBe('Milestones');
		expect(caption(datedAxis(markerVault(['iteration'])).containerEl)).toBe('Iterations');
		expect(caption(datedAxis(markerVault(['milestone', 'iteration'])).containerEl)).toBe('Milestones · Iterations');
	});

	it('captions the cyan legend swatch the same three ways', () => {
		expect(swatchLabel(datedAxis(markerVault(['milestone'])).containerEl)).toBe('Milestone');
		expect(swatchLabel(datedAxis(markerVault(['iteration'])).containerEl)).toBe('Iteration');
		expect(swatchLabel(datedAxis(markerVault(['milestone', 'iteration'])).containerEl)).toBe('Milestone · Iteration');
	});

	it('announces a point by its own type, never the literal Milestone', () => {
		// Asserted on the string a screen reader receives, per the PBI's criterion.
		const both = datedAxis(markerVault(['milestone', 'iteration'])).containerEl;
		const sentences = Array.from(both.querySelectorAll('.pbl-lane-head .pbl-bar .pbl-sr-only')).map(
			(el) => el.textContent ?? '',
		);
		expect(sentences.some((s) => s.startsWith('Sprint 12 — Iteration 2026-09-20'))).toBe(true);
		expect(sentences.some((s) => s.startsWith('Ship 1.0 — Milestone 2026-09-30'))).toBe(true);
		expect(sentences.some((s) => s.includes('Sprint 12 — Milestone'))).toBe(false);
	});
});
```

Before running, check the exact date wording `spanText` produces (`formatCivil` may render `2026-09-20` differently — read `formatCivil` in `src/domain/` and adjust the expected strings to its format). If `makeView` needs the collapsed-tree opt-out or `clickExpandAll` for the marker lane to draw, copy the idiom from `test/view/iterationHidden.test.ts`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/view/roadmap.test.ts -t 'marker surfaces'`
Expected: FAIL — caption reads `Milestones` in vaults B and C; sentence says `Milestone`.

- [ ] **Step 3: Implement.**

`src/domain/roadmap.ts`, beside `markerLane` (import `isIterationType` from `./itemTypes`):

```ts
/**
 * What the marker row's header SAYS — presentation derived from what the row holds,
 * never the lane's identity: `name` stays the constant the fold key and the roster
 * refusal read, and a caption that named a type the row is not drawing would be the
 * legend's own lie one element over. Decided by the user 2026-08-16 (content-aware over
 * a fixed word), spec `2026-08-16-finish-iterations-board-design.md`.
 */
export function markerLaneCaption(bars: TimelineBar[]): string {
	const iterations = bars.some((bar) => isIterationType(bar.item.typeName));
	const milestones = bars.some((bar) => !isIterationType(bar.item.typeName));
	if (milestones && iterations) return 'Milestones · Iterations';
	return iterations ? 'Iterations' : 'Milestones';
}
```

`src/view/render/lanes.ts` `renderLaneHeader` (~294): the caption span becomes `text: lane.markers ? markerLaneCaption(lane.bars) : lane.name`.

`src/view/host.ts` `DrawnColors`: add after `milestone`:

```ts
/** An `Iteration` drawing the cyan point diamond — same hue, its own name in the key. */
iteration: boolean;
```

`src/view/render/timeline.ts`: the literal at ~309 gains `iteration: false`; `renderBarRow`'s `colors` literal gains `iteration: false` (a bar ROW is never an iteration — they have no rows; the compiler forces this edit via `BarColors`). Grep for any other `DrawnColors`/`BarColors` literal: `grep -rn "milestone:" src/view/render/ | grep -v '//'`.

`src/view/render/lanes.ts` `drawMarkerDiamonds` tail — the report follows what was painted (the comment there already states that rule; extend it):

```ts
if (done) drawn.done = true;
else if (geometry.outside || !geometry.milestone) drawn.accent = true;
else if (isIterationType(bar.item.typeName)) drawn.iteration = true;
else drawn.milestone = true;
```

(`!geometry.milestone` is dead until Task 4 draws span marks in this lane; it is written now so the report can never claim cyan for a mark `barClasses` did not give the diamond class.)

`src/view/render/legend.ts` (~68):

```ts
if (drawn.milestone || drawn.iteration) {
	const caption =
		drawn.milestone && drawn.iteration ? 'Milestone · Iteration' : drawn.iteration ? 'Iteration' : 'Milestone';
	addSwatch(legendEl, 'pbl-legend-milestone', caption);
}
```

`src/view/render/lanes.ts` `spanText` — the point branch names the item's own type (import `displayType` from `../../domain/itemTypes`):

```ts
if (formatCivil(span.start) === formatCivil(span.target)) {
	return `${displayType(bar.item)} ${formatCivil(span.start)}${inferred}`;
}
```

Note this also changes the sentence for an ordinary item whose stated start equals its target (e.g. `timelineFurniture.test.ts`'s "Ship it" PBI): it now announces `PBI 2026-…` instead of `Milestone 2026-…`. That is the honest sentence — the criterion is "no surface calls an item something it is not" — but it WILL fail existing assertions; update them to the new wording, don't work around it.

- [ ] **Step 4: Run the suite; fix the `Milestone <date>` assertions it flushes out**

Run: `npx vitest run test/view/ test/domain/`
Expected: the three new tests PASS; any failure elsewhere is an assertion on the old `Milestone` sentence — update the expected strings.

- [ ] **Step 5: Full gate, then commit**

Run: `npm run check`

```bash
git add -A ':!test/harness/mock.ts'
git commit -m "Name the marker surfaces by what they draw"
```

---

### Task 4: Bar mode — drawing and writing

**Files:**
- Modify: `src/view/render/milestoneLines.ts` (~line 44 and the signature)
- Modify: `src/view/render/timeline.ts` (~line 273, the `renderMilestoneLines` call)
- Modify: `src/view/render/lanes.ts` (`drawMarkerDiamonds` — grip loop)
- Test: `test/view/roadmap.test.ts` (drawing per mode), `test/view/timelineDrag.test.ts` (write narrowing — check the exact filename with `ls test/view/ | grep -i drag`)

**Interfaces:**
- Consumes: `drawsAsPoint(typeName, iterationBars)` and `barHolds` from Task 1; `DrawnColors.iteration` from Task 3.
- Produces: nothing new — this task makes the option's ON state draw and write correctly.

- [ ] **Step 1: Write the failing tests** in `test/view/roadmap.test.ts` (same fixtures as Task 3, plus `iterationBars: true` in the view options where the mode is on):

Reuse Task 3's `markerVault`/`datedAxis` helpers (same file):

```ts
describe('an iteration draws as a bar while the option is on', () => {
	const sprintMark = (el: HTMLElement) =>
		el.querySelector<HTMLElement>('.pbl-lane-head .pbl-bar[data-pbl-path="Sprint 12.md"]');
	const labelTexts = (el: HTMLElement) =>
		Array.from(el.querySelectorAll('.pbl-milestone-label')).map((label) => label.textContent ?? '');

	it('draws a start→target bar in the marker row and no boundary line', () => {
		const el = datedAxis(markerVault(['milestone', 'iteration']), { iterationBars: true }).containerEl;
		const mark = sprintMark(el);
		expect(mark).not.toBeNull();
		expect(mark?.classList.contains('pbl-bar-milestone')).toBe(false);
		// The milestone's own line still draws; the sprint gets none and no header label.
		expect(el.querySelectorAll('.pbl-milestone-line').length).toBe(1);
		expect(labelTexts(el).some((label) => label.includes('Sprint 12'))).toBe(false);
	});

	it('draws a line and a diamond while the option is off — the default', () => {
		const el = datedAxis(markerVault(['milestone', 'iteration'])).containerEl;
		expect(sprintMark(el)?.classList.contains('pbl-bar-milestone')).toBe(true);
		expect(el.querySelectorAll('.pbl-milestone-line').length).toBe(2);
		expect(labelTexts(el).some((label) => label.includes('Sprint 12'))).toBe(true);
	});

	it('gives the bar a grip per configured end, and none for an unconfigured key', () => {
		const both = datedAxis(markerVault(['iteration']), { iterationBars: true }).containerEl;
		expect(sprintMark(both)?.querySelector('.pbl-bar-grip-start')).not.toBeNull();
		expect(sprintMark(both)?.querySelector('.pbl-bar-grip-end')).not.toBeNull();
		// The type decides drawable, the configuration writable: no start property, no
		// start grip, and the end grip survives.
		const noStart = datedAxis(markerVault(['iteration']), { iterationBars: true, startProperty: '' }).containerEl;
		expect(sprintMark(noStart)?.querySelector('.pbl-bar-grip-start')).toBeNull();
		expect(sprintMark(noStart)?.querySelector('.pbl-bar-grip-end')).not.toBeNull();
	});

	it('changing the option rewrites nothing on any note', () => {
		const harness = datedAxis(markerVault(['milestone', 'iteration']));
		harness.vault.writeLog.length = 0;
		// The option is a `.base` setting; flipping it re-renders and touches no note.
		harness.view.config.set('iterationBars', true);
		refresh(harness.view, harness.vault);
		expect(harness.vault.writeLog).toEqual([]);
	});
});
```

Check the option-flip idiom first (`grep -n "config.set\|FakeViewConfig" test/view/roadmap.test.ts test/helpers/view.ts | head`) — if the harness exposes settings differently (e.g. rebuilding the view with new options), rewrite that fourth test in the file's own idiom; the assertion stays "writeLog is empty".

For the write path, extend the timeline-drag test file with one case driven through the real drag helpers already used there (read the file's existing drag idiom first — `drag`/`stubRect`/`flush` from `test/helpers/view.ts`, and copy an existing body-slide case as the template, changing only the fixture and the assertions):

```ts
it('a body slide with the option off writes the target alone and deletes nothing', async () => {
	// Fixture: type Iteration, due 2026-09-20, start 2026-09-07, option OFF.
	// Drive the existing body-slide gesture on the sprint's mark by +2 days, await flush().
	const fm = vault.fm('Sprint 12.md');
	expect(fm.due).toBe('2026-09-22');
	// Extension 5a: placementEnds answers target alone, resolved by the WRITER from
	// settings — the stale start is ignored, never written, never deleted.
	expect(fm.start).toBe('2026-09-07');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/view/roadmap.test.ts`
Expected: FAIL — bar mode still draws a boundary line (its `isMarkerType` keeps the old meaning) and the mark has no grips.

- [ ] **Step 3: Implement.**

`src/view/render/milestoneLines.ts`: the loop's guard becomes the new predicate — a bar-mode iteration gets no line and no header label (import `drawsAsPoint`; drop the `isMarkerType` import if now unused). Signature gains the flag; keep the parameter count within the five-param budget by adding it to the existing `ruler` group or as one boolean:

```ts
export function renderMilestoneLines(
	mounts: { grid: HTMLElement; headerTrack: HTMLElement },
	window: TimelineWindow,
	bars: TimelineBar[],
	today: CivilDate,
	ruler: { scale: TimelineScale; leadWidth: number; iterationBars: boolean },
): boolean {
	…
	for (const bar of bars) {
		if (!drawsAsPoint(bar.item.typeName, ruler.iterationBars)) continue;
		…
```

Caller in `src/view/render/timeline.ts` (~273): add `iterationBars: ctx.host.settings.iterationBars` to the ruler object.

`src/view/render/lanes.ts` `drawMarkerDiamonds`: mirror `renderBarRow`'s grip loop on the mark (the body wiring is already there — `holdable`/`wireCard` — so only the edge grips are missing). After the `el` is created and before the body wiring:

```ts
const holds = barHolds(bar.item, ctx.host.settings, bar);
for (const hold of holds.filter((one) => one !== 'body')) {
	const grip = el.createDiv({ cls: `pbl-bar-grip pbl-bar-grip-${hold}` });
	grip.dataset.pblHold = hold;
	mounts.dnd.wireCard(grip, bar.item, hold, () => mounts.scroller.scrollLeft);
}
```

The function already computes `holdable = barHolds(...).includes('body')` — compute `holds` ONCE and derive `holdable` from it, the "asked once" rule `renderBarRow`'s comment states. The existing gesture routing needs no edit: `render/roadmap.ts:320` already sends every marker release and every grip hold to `submitGesture` (dates only, never an assignee) — that `isMarkerType` is structural and stays.

- [ ] **Step 4: Run the new tests and the drag suites**

Run: `npx vitest run test/view/roadmap.test.ts test/view/timelineDrag.test.ts test/view/contextCardWrites.test.ts`
Expected: PASS. `contextCardWrites` is in the run because it drives every card projection's write paths against context fixtures — if it fails, a new write path missed the context-row rule; fix the path, not the test.

- [ ] **Step 5: Full gate, then commit**

Run: `npm run check`

```bash
git add -A ':!test/harness/mock.ts'
git commit -m "Draw and write an iteration as a bar where the option says so"
```

---

### Task 5: Verify and close the timeframe PBI

**Files:**
- Read: `docs/requirements/An iteration's timeframe schedules its items.md` (the acceptance criteria), `test/domain/iterationDates.test.ts`, `test/view/contextRowWrites.test.ts`, `test/view/contextCardWrites.test.ts`, `src/storage/writeKeys.ts` (`touchedKeys`)
- Modify: `docs/requirements/An iteration's timeframe schedules its items.md` (frontmatter `status`)

**Interfaces:** none — this task is verification, not construction.

- [ ] **Step 1: Walk the PBI's acceptance criteria against the suite.** For each of its eight bullets, name the test that holds it (its `## Where it lives` names the files). Verify at minimum:
  - one batch + one undo restoring all three keys: `test/domain/iterationDates.test.ts` — confirm an assertion undoes a join and checks link AND both dates return (the criterion says "checked by undoing a join and asserting all three keys are back, never by reading the list");
  - the state-key invariant asserted of the PLANNER (`computeIterationWrites` never names a state key) across join, move, `None`;
  - the create path carrying link + dates in ONE create (`src/view/interactions/create.ts` `iterationOf` — find its test with `grep -rln "iterationOf\|iteration" test/view/create*.test.ts test/view/*.test.ts | head -5`);
  - context rows refused on every iteration path (`contextRowWrites` / `contextCardWrites` drive `Set iteration`).
- [ ] **Step 2: Close the gap only if one exists.** If a criterion has no test that fails without its behaviour, add the missing assertion in the file its `## Where it lives` names (watch it fail by reverting the behaviour, then restore — the repo's "watched failing" rule). If all eight hold, add nothing.
- [ ] **Step 3: Flip the PBI's frontmatter** `status: Active` → `status: Done` and, if the note has an outcome-style closing line convention (check a recently closed sibling under the same feature, e.g. `docs/requirements/A board scoped to one iteration.md`, for the idiom), add one sentence naming what verification found.
- [ ] **Step 4: Gate and commit**

Run: `npm run check` (docs register included)

```bash
git add docs/ && git commit -m "Verify the iteration timeframe PBI against its criteria and close it"
```

---

### Task 6: Close the feature and the register

**Files:**
- Modify: `docs/requirements/An iteration draws as a bar or a line.md` (stale-section correction + `status: Done`)
- Modify: `docs/requirements/An Iterations board.md` (`status: Done`; the `**Nothing yet.**` build-status paragraph)
- Modify: `docs/README.md` (the Product Kanban paragraph's iterations sentence)
- Modify: `CHANGELOG.md` (`[Unreleased]`)
- Test: `npm run docs` (the register gate), then the whole of `npm run check`

**Interfaces:** none.

- [ ] **Step 1: Correct the PBI note.** In `An iteration draws as a bar or a line.md`, the section "The type is declared before this lands, and three labels are wrong meanwhile" predates commit `b08097e` (which excluded iterations from every projection). Add a dated correction paragraph in the note's own idiom (it already carries one: see its "*This paragraph said the opposite for twenty minutes…*" form) stating: nothing drew an iteration between `b08097e` and this increment, so the three labels were wrong only from the moment the grid admitted iterations — and they were fixed in the same change. Do not delete the original text; the register keeps what was believed and when.
- [ ] **Step 2: Update `## Where it lives`** in the same note if implementation placed anything outside the modules it names (it names `itemTypes.ts`, `bars.ts`, `timeline.ts`, `milestoneLines.ts`, `viewOptions.ts`, `settings.ts`, `timelineDrag.ts`, `plan.ts`, `bars.test.ts`, `roadmap.test.ts` — the admission seam `projection.ts`/`rowVisibility.ts` and the caption's `roadmap.ts`/`lanes.ts`/`legend.ts` likely need adding). Rule 7 requires every touched `src/` module to stay specified; `npm run docs` will tell you which paths it cannot find.
- [ ] **Step 3: Flip both statuses.** PBI → `Done`. Feature `An Iterations board` → `Done`, and rewrite its `**Nothing yet.**` paragraph to a past-tense build note naming what shipped (scope picker + iteration notes in the earlier increments, timeframe + bar-or-line in this one).
- [ ] **Step 4: Update `docs/README.md`.** The Product Kanban paragraph ends "…and **iterations** is still design" (or near wording — find it with `grep -n "iterations" docs/README.md`). Rewrite that clause: the iterations board shipped (scope picker, membership, timeframe scheduling, bar-or-line on the roadmap). Keep the paragraph's own style; do not renumber anything else.
- [ ] **Step 5: Changelog.** Under `## [Unreleased]` add entries in the file's existing bullet idiom:

```markdown
- An Iterations board: `Set iteration` copies the sprint's own start and target onto the item in one undoable batch, and a card created on an iteration board carries the link and both dates in its first write.
- Iterations draw on the roadmap's grid axes: as a line and diamond by default, or as a start→target bar with the new "Draw iterations as bars" view option; the marker row's caption, the legend and the announced sentence now name what is actually drawn.
```

- [ ] **Step 6: The whole gate, then commit and push**

Run: `npm run check`
Expected: all five green, including the docs register (rule 7 over the new `## Where it lives` paths, the wikilink sweep over the edited notes).

```bash
git add -A ':!test/harness/mock.ts'
git commit -m "Close the Iterations board feature in the register"
git push -u origin claude/next-increment-brainstorm-a2ebvd
```

- [ ] **Step 7: Say what is still owed.** The harness mock covered Obsidian default colours only; appearance of the marker row with sprint bars, the caption truncation at real pane widths, and drag feel need a live vault — name `npm run test-build` in the PR conversation as the handover, per the repo's convention. Do not claim the look is verified.

---

## Self-review notes (already applied)

- Spec coverage: labels → Task 3; predicate/option/wiring → Tasks 1 and 4; admission + sweep reshape + shelf → Task 2; PBI 1 close → Task 5; register/changelog → Task 6. The spec's "flagged for veto" resources-axis reading is implemented by `drawsGrid(axis)` in Task 2 (both grid axes, one code path) — the user approved the spec carrying that reading.
- Type consistency: `drawsAsPoint(typeName, iterationBars)` and `placementEnds(typeName, iterationBars)` are spelled identically in Tasks 1, 3, 4; `BarHold` end grip is `'end'` (not `'target'`) — Task 4's grip selectors use `pbl-bar-grip-end`.
- Known cascade: adding `iteration` to `DrawnColors` flows into `BarColors` by the existing `Omit` — Task 3 names both literals that must gain the field.
- `renderInputs` already fingerprints `host.settings` whole, so the new option needs no `rowSignature` term — checked against `src/view/rowSignature.ts`'s header rule.
