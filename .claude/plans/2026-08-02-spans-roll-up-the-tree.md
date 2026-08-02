# Spans Roll Up The Tree — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent with no dates of its own renders on the dated roadmap as the span its dated descendants imply, styled as the inference it is, written nowhere.

**Architecture:** The rollup walk in `src/domain/model.ts` (`assignAll`) already returns a per-subtree `Rollup {count, done}` and already carries the context-row exclusion as `const self = child.outsideFilter ? 0 : 1`. Date evidence rides that same walk and that same gate — two more fields on `Rollup`, two more on `BacklogItem`. The *merge* of evidence with stated dates lives in `deriveBars` (`src/domain/roadmap.ts`), not in the model, because every rule in the spec (stated wins endpoint by endpoint, an inference never crosses a stated end, a reversed own pair shelves) is a bar-placement rule and `deriveBars` already owns shelving-with-reason. `src/view/render/timeline.ts` gains one CSS class.

**Tech Stack:** TypeScript (held at `~6.0.3`), Vitest + jsdom, ESLint with per-directory `no-restricted-imports`, fallow (dead code / duplication / CRAP), `docs-check.mjs`.

**Spec:** `docs/requirements/Spans roll up the tree.md`. Read it before starting — every extension (1a, 1b, 2a–2d, 3a) maps to a test below.

## Global Constraints

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests + fallow + docs register. All five pass before any commit. CI runs the same on Ubuntu **and Windows**.
- Coverage thresholds in `vitest.config.mts` only ever go up. Never lower one to make a commit pass.
- **Layer rule:** `main → commands → view → storage → domain`, each may reach anything below it and nothing above. `domain/` never touches the DOM and never writes the vault. Enforced by `no-restricted-imports`; a violation fails `npm run lint`.
- **400-line max per file in `src/`**, 450 in `test/`, enforced by lint — counted with `skipBlankLines` and `skipComments`, so the number is not what `wc -l` reports. `src/domain/model.ts` is 612 raw lines but **~360 counted**: roughly 40 lines of headroom and no exemption. Task 1 adds about ten. Do not add a second concern to that file, and if lint reports the cap, split rather than raise it.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore. This is not optional — Step "run it to verify it fails" appears in every task for that reason.
- **Nothing here writes.** This whole increment is read-only derivation. No call to `applyWrites`, `processFrontMatter`, `createBacklogItem`, or anything in `storage/`. If a step seems to need one, the step is wrong.
- **The context-row rule:** an `outsideFilter` row is never a write target, never a ranking peer, and never a source of anything derived from the Base's results. Date evidence is derived from the results, so a context row's own dates contribute nothing — while the walk still traverses *through* it to the results below.
- Marketplace rules: sentence-case UI text, `setCssProps` over inline styles, no global `app`.
- Obsidian cannot run here. jsdom is the substitute (`test/CLAUDE.md`). Say so honestly if something still needs a live-vault look; `npm run test-build` is the handover.

---

### Task 1: Gather date evidence in the rollup walk

**Files:**
- Modify: `src/domain/timeline.ts` (add `earliest` / `latest`, after `daysBetween` at line 45)
- Modify: `src/domain/model.ts:79-81` (BacklogItem fields), `src/domain/model.ts:513-545` (`assignAll` and `Rollup`)
- Test: `test/domain/timeline.test.ts`, `test/domain/model.test.ts`

**Interfaces:**
- Consumes: `CivilDate { year, month, day }` and `FieldReading<T> { value, invalid }` from `src/domain/noteFields.ts`; `daysBetween(a, b): number` from `src/domain/timeline.ts`. `item.plannedStart` / `item.plannedTarget` are `FieldReading<CivilDate>` — an unreadable date already reads as `value: null`, so nothing extra is needed to keep a typo out of the evidence.
- Produces:
  - `earliest(a: CivilDate | null, b: CivilDate | null): CivilDate | null`
  - `latest(a: CivilDate | null, b: CivilDate | null): CivilDate | null`
  - `BacklogItem.descendantStart: CivilDate | null`
  - `BacklogItem.descendantTarget: CivilDate | null`

- [ ] **Step 1: Write the failing test for the date pickers**

Append to `test/domain/timeline.test.ts`:

```ts
describe('earliest and latest', () => {
	const march = { year: 2026, month: 3, day: 1 };
	const june = { year: 2026, month: 6, day: 1 };

	it('takes whichever end exists when the other is absent', () => {
		expect(earliest(null, june)).toEqual(june);
		expect(earliest(march, null)).toEqual(march);
		expect(latest(null, june)).toEqual(june);
		expect(latest(march, null)).toEqual(march);
		expect(earliest(null, null)).toBeNull();
		expect(latest(null, null)).toBeNull();
	});

	it('orders by civil date, not by argument position', () => {
		expect(earliest(june, march)).toEqual(march);
		expect(earliest(march, june)).toEqual(march);
		expect(latest(june, march)).toEqual(june);
		expect(latest(march, june)).toEqual(june);
	});

	it('keeps the first argument when the two are the same day', () => {
		expect(earliest(march, { ...march })).toBe(march);
		expect(latest(march, { ...march })).toBe(march);
	});
});
```

Add `earliest, latest` to the existing import from `../../src/domain/timeline` at the top of the file.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/timeline.test.ts -t "earliest and latest"`
Expected: FAIL — `earliest is not a function` (or a TS resolution error on the import).

- [ ] **Step 3: Implement the pickers**

In `src/domain/timeline.ts`, directly after `daysBetween` and its `utc` helper:

```ts
/**
 * The earlier of two optional dates — absence is not a bound, so a null end
 * yields the other. Ties keep `a`, which is the accumulator at every call site
 * and makes the fold stable.
 */
export function earliest(a: CivilDate | null, b: CivilDate | null): CivilDate | null {
	if (a === null || b === null) return a ?? b;
	return daysBetween(a, b) < 0 ? b : a;
}

/** The later of two optional dates, by the same rule as `earliest`. */
export function latest(a: CivilDate | null, b: CivilDate | null): CivilDate | null {
	if (a === null || b === null) return a ?? b;
	return daysBetween(a, b) > 0 ? b : a;
}
```

> If `npm run analyze` flags these two as duplication, collapse to one function taking a comparator sign rather than deleting either call site. Do not reach for a fallow suppression.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run test/domain/timeline.test.ts -t "earliest and latest"`
Expected: PASS.

- [ ] **Step 5: Write the failing test for evidence gathering**

Append to `test/domain/model.test.ts`. Note `unscoped` and `settings` already exist at the top of that file; the date keys must be configured or `plannedStart`/`plannedTarget` read as absent.

```ts
describe('date evidence rolls up the tree', () => {
	const dated = { ...settings, startKey: 'start', targetKey: 'due' };

	it('gathers the earliest start and the latest target from below, never from self', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-01-01', due: '2026-12-31' } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-04-01' }, parentLink: 'Epic' });
		vault.addFile('B.md', { frontmatter: { type: 'Feature', order: 20, start: '2026-02-01', due: '2026-06-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), dated);
		const epic = model.roots[0];

		// The epic's OWN dates are not evidence for itself — they are what evidence fills in for.
		expect(epic.descendantStart).toEqual({ year: 2026, month: 2, day: 1 });
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 6, day: 1 });
		expect(epic.children[0].descendantStart).toBeNull();
		expect(epic.children[0].descendantTarget).toBeNull();
	});

	it('gathers through every level, not just immediate children', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Story.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-05-01', due: '2026-05-20' }, parentLink: 'Feature' });

		const model = buildModel(vault.app, vault.entries(), dated);

		expect(model.roots[0].descendantStart).toEqual({ year: 2026, month: 5, day: 1 });
		expect(model.roots[0].descendantTarget).toEqual({ year: 2026, month: 5, day: 20 });
	});

	it('keeps the kinds apart — a start is never evidence of a target', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-03-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), dated);

		expect(model.roots[0].descendantStart).toEqual({ year: 2026, month: 3, day: 1 });
		expect(model.roots[0].descendantTarget).toBeNull();
	});

	it('is not evidence when the reader refuses the value — a typo stays a typo', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: 'next tuesday', due: '2026-04-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), dated);

		expect(model.roots[0].descendantStart).toBeNull();
		expect(model.roots[0].descendantTarget).toEqual({ year: 2026, month: 4, day: 1 });
	});

	it('reads nothing when no date property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-03-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.roots[0].descendantStart).toBeNull();
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run test/domain/model.test.ts -t "date evidence rolls up the tree"`
Expected: FAIL — `descendantStart` is `undefined`, not `null` (the first assertion to blow up is `toBeNull()` on an absent property, or a TS error that `descendantStart` does not exist on `BacklogItem`).

- [ ] **Step 7: Add the fields and gather them in the walk**

In `src/domain/model.ts`, add to `interface BacklogItem` (after `subtreeDone`, around line 132):

```ts
	/**
	 * Earliest start and latest target stated by a RESULT below this item — the
	 * evidence a dateless parent's bar is inferred from, never a value written
	 * anywhere. Null when nothing below states a date of that kind. Gathered by
	 * the same walk and the same exclusion as the progress counts: a context
	 * row's own dates are not this base's plan, though the results beneath it are.
	 */
	descendantStart: CivilDate | null;
	descendantTarget: CivilDate | null;
```

Import `CivilDate` from `./noteFields` if the file does not already (it imports `readDate` — check the existing import list and extend it rather than adding a second import statement). Import `earliest, latest` from `./timeline`.

Extend `interface Rollup` (line 543):

```ts
/** What a subtree contributes to its parent's counts and to its span. */
interface Rollup {
	count: number;
	done: number;
	start: CivilDate | null;
	target: CivilDate | null;
}
```

Rewrite the body of `assign` inside `assignAll`:

```ts
		let count = 0;
		let done = 0;
		let start: CivilDate | null = null;
		let target: CivilDate | null = null;
		for (const child of item.children) {
			const sub = assign(child, depth + 1);
			// Traverse *through* a context row to the results below it, but never count
			// it: rollups describe what the Base returned, and an excluded note's own
			// state must not skew a progress bar or keep a finished subtree on screen.
			const self = child.outsideFilter ? 0 : 1;
			count += self + sub.count;
			done += (child.done ? self : 0) + sub.done;
			// Dates gather under the same exclusion, for the same reason: an excluded
			// note's dates are not this base's plan, so they stretch nothing — while
			// the results beneath it still reach their ancestors. `FieldReading.value`
			// is null for an absent key AND for a value the reader refuses, so a typo
			// is not evidence without a branch saying so.
			if (self === 1) {
				start = earliest(start, child.plannedStart.value);
				target = latest(target, child.plannedTarget.value);
			}
			start = earliest(start, sub.start);
			target = latest(target, sub.target);
		}
		item.descendantCount = count;
		item.doneDescendants = done;
		item.subtreeDone = item.done && done === count;
		item.descendantStart = start;
		item.descendantTarget = target;
		return { count, done, start, target };
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run test/domain/model.test.ts -t "date evidence rolls up the tree"`
Expected: PASS, 5 tests.

- [ ] **Step 9: Write the context-row invariant test**

The comment added in Step 7 states a rule; this is the test that fails without it. Append to `test/domain/modelContextRows.test.ts`, which already has the `only(vault, ...paths)` helper that stands in for a filtered Base.

```ts
describe('date evidence and context rows', () => {
	const dated = { ...settings, startKey: 'start', targetKey: 'due' };

	it('a context row’s own dates stretch nothing, and the results below it still reach up', () => {
		const vault = new FakeVault();
		// The feature is context — decades wide, and none of it this base's plan.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2020-01-01', due: '2030-01-01' },
			parentLink: 'Epic',
		});
		vault.addFile('Story.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-05-01', due: '2026-05-20' },
			parentLink: 'Feature',
		});

		// Only the story comes back from the Base; the epic and feature are context.
		const model = buildModel(vault.app, only(vault, 'Story.md'), dated);
		const epic = model.roots[0];
		expect(epic.outsideFilter).toBe(true);

		// Traversed *through* the context feature to the result below it.
		expect(epic.descendantStart).toEqual({ year: 2026, month: 5, day: 1 });
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 5, day: 20 });
	});
});
```

`only` is currently declared inside the `describe('buildModel with parents outside the filter')` block. Hoist it to module scope alongside `names` so both blocks share one definition — do not copy it.

If the exclusion is missing, the epic infers 2020→2030 and the assertion fails by four orders of magnitude: a failure nobody can misread.

- [ ] **Step 10: Watch it fail, then restore**

Temporarily change `if (self === 1)` to `if (true)` in `assignAll`.
Run: `npx vitest run test/domain/modelContextRows.test.ts -t "date evidence and context rows"`
Expected: FAIL, showing 2020-01-01 where 2026-05-01 was expected.
Restore `if (self === 1)`, re-run, expect PASS.

- [ ] **Step 11: Full check and commit**

```bash
npm run check
git add src/domain/timeline.ts src/domain/model.ts test/domain/timeline.test.ts test/domain/model.test.ts test/domain/modelContextRows.test.ts
git commit -m "Gather each subtree's date evidence in the rollup walk"
```

> `npm run docs` will pass — `src/domain/timeline.ts` and `src/domain/model.ts` are already named by notes. If it fails on an unnamed file, that is a real gap: fix the note, not the check.

---

### Task 2: Infer the bar from the evidence

**Files:**
- Modify: `src/domain/roadmap.ts:80-84` (`TimelineBar`), `src/domain/roadmap.ts:277-303` (`deriveBars`)
- Test: `test/domain/roadmap.test.ts`

**Interfaces:**
- Consumes: `BacklogItem.descendantStart` / `.descendantTarget` from Task 1; `daysBetween` from `src/domain/timeline.ts` (already imported in `roadmap.ts`).
- Produces: `TimelineBar { item: BacklogItem; span: DateSpan; inferredStart: boolean; inferredEnd: boolean }` — consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `test/domain/roadmap.test.ts`. `axisSettings()` and `roadmapOf()` already exist at the top of that file.

```ts
describe('a dateless parent spans its children', () => {
	const march = { year: 2026, month: 3, day: 1 };
	const june = { year: 2026, month: 6, day: 1 };

	function bars(model: BacklogModel) {
		return roadmapOf(model, axisSettings(), 'dates').bars;
	}

	function tree(files: [string, Record<string, unknown>, string?][]): BacklogModel {
		const vault = new FakeVault();
		for (const [name, fm, parent] of files) {
			vault.addFile(`${name}.md`, { frontmatter: fm, ...(parent ? { parentLink: parent } : {}) });
		}
		return buildModel(vault.app, vault.entries(), axisSettings());
	}

	it('infers both ends from the subtree and marks both inferred', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-04-01' }, 'Epic'],
			['B', { type: 'Feature', order: 20, start: '2026-04-01', due: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: march, target: june });
		expect(epic?.inferredStart).toBe(true);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('a stated end always wins, and the disagreement renders rather than resolves', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10, start: '2026-04-01' }],
			['A', { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		// The stated start stands even though the child begins a month earlier.
		expect(epic?.span.start).toEqual({ year: 2026, month: 4, day: 1 });
		expect(epic?.inferredStart).toBe(false);
		// The empty end fills from below and carries the inferred styling alone.
		expect(epic?.span.target).toEqual(june);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('an inference may extend a statement and never contradict it', () => {
		// Child's target precedes the parent's stated start: filling the parent's
		// empty target from it would draw a reversed bar. The end stays open instead.
		const model = tree([
			['Epic', { type: 'Epic', order: 10, start: '2026-06-01' }],
			['A', { type: 'Feature', order: 10, due: '2026-03-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: june, target: null });
		expect(epic?.inferredEnd).toBe(false);
	});

	it('an end with no evidence of its own kind stays open', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, due: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: null, target: june });
		expect(epic?.inferredStart).toBe(false);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('crossed evidence brackets the activity without bounding it — both ends open', () => {
		// One child states only a start, a later one only an earlier target.
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, start: '2026-06-01' }, 'Epic'],
			['B', { type: 'Feature', order: 20, due: '2026-03-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		// The bar covers what is known, never reversed, and claims neither end.
		expect(epic?.span).toEqual({ start: march, target: june });
		expect(epic?.inferredStart).toBe(true);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('a parent whose own pair is reversed shelves — no inference stands in for a typo', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10, start: '2026-06-01', due: '2026-03-01' }],
			['A', { type: 'Feature', order: 10, start: '2026-04-01', due: '2026-05-01' }, 'Epic'],
		]);

		const roadmap = roadmapOf(model, axisSettings(), 'dates');
		expect(roadmap.shelf.map((s) => [s.item.title, s.reason])).toContainEqual([
			'Epic',
			'Target date precedes the start date',
		]);
	});

	it('a subtree with no dates at all still shelves', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10 }, 'Epic'],
		]);

		const roadmap = roadmapOf(model, axisSettings(), 'dates');
		expect(roadmap.bars).toEqual([]);
		expect(titles(roadmap.shelf.map((s) => s.item))).toEqual(['Epic', 'A']);
	});

	it('a stated bar is never marked inferred', () => {
		const model = tree([['Solo', { type: 'PBI', order: 10, start: '2026-03-01', due: '2026-06-01' }]]);

		const solo = bars(model)[0];
		expect(solo.inferredStart).toBe(false);
		expect(solo.inferredEnd).toBe(false);
	});
});
```

Add `BacklogModel` to the existing `../../src/domain/model` import if it is not already there (it is — line 2 of the file).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/domain/roadmap.test.ts -t "a dateless parent spans its children"`
Expected: FAIL — the first test finds no `Epic` bar at all (it is on the shelf), so `epic?.span` is `undefined`.

- [ ] **Step 3: Widen `TimelineBar`**

In `src/domain/roadmap.ts`:

```ts
export interface TimelineBar {
	item: BacklogItem;
	span: DateSpan;
	/**
	 * True when that end came from the subtree rather than from the note. Display
	 * only — an inferred date is never written anywhere, and recomputes each pass.
	 */
	inferredStart: boolean;
	inferredEnd: boolean;
}
```

- [ ] **Step 4: Rewrite `deriveBars` and add `inferSpan`**

Replace the body of `deriveBars`:

```ts
function deriveBars(rows: BacklogItem[], roadmap: RoadmapModel): void {
	for (const item of rows) {
		if (item.outsideFilter) {
			roadmap.context.push(item);
			continue;
		}
		const start = item.plannedStart;
		const target = item.plannedTarget;
		if (start.invalid) roadmap.shelf.push({ item, reason: 'Unreadable start date' });
		else if (target.invalid) roadmap.shelf.push({ item, reason: 'Unreadable target date' });
		else if (start.value !== null && target.value !== null && daysBetween(start.value, target.value) < 0) {
			// A reversed pair of the item's own is a typo to fix, never a span to
			// infer around: unreadable shelves, and no inference stands in for a
			// value that needs correcting.
			roadmap.shelf.push({ item, reason: 'Target date precedes the start date' });
		} else {
			const bar = inferSpan(item, start.value, target.value);
			if (bar === null) roadmap.shelf.push({ item, reason: null });
			else roadmap.bars.push(bar);
		}
	}
}

/** True when `a` does not fall after `b`. A missing end bounds nothing. */
function keepsOrder(a: CivilDate | null, b: CivilDate | null): boolean {
	return a === null || b === null || daysBetween(a, b) >= 0;
}

/**
 * Stated dates win endpoint by endpoint; an empty end fills from the subtree's
 * evidence of its OWN kind — starts only ever stand for starts. An inference may
 * extend a statement and never contradict it, so evidence falling on the wrong
 * side of a stated end is dropped and that end stays open. Null when neither the
 * note nor its results supply anything: the shelf's case, unchanged.
 */
function inferSpan(
	item: BacklogItem,
	statedStart: CivilDate | null,
	statedTarget: CivilDate | null,
): TimelineBar | null {
	const evidenceStart = statedStart === null ? item.descendantStart : null;
	const evidenceTarget = statedTarget === null ? item.descendantTarget : null;
	// Both ends inferred and crossing, from single-ended children: neither bounds
	// the other. Cover what is known with both ends open rather than draw a
	// reversed span — evidence bracketing activity without claiming to bound it.
	if (evidenceStart !== null && evidenceTarget !== null && daysBetween(evidenceStart, evidenceTarget) < 0) {
		return { item, span: { start: evidenceTarget, target: evidenceStart }, inferredStart: true, inferredEnd: true };
	}
	const start = statedStart ?? (keepsOrder(evidenceStart, statedTarget) ? evidenceStart : null);
	const target = statedTarget ?? (keepsOrder(statedStart, evidenceTarget) ? evidenceTarget : null);
	if (start === null && target === null) return null;
	return {
		item,
		span: { start, target },
		inferredStart: statedStart === null && start !== null,
		inferredEnd: statedTarget === null && target !== null,
	};
}
```

Import `CivilDate` from `./noteFields` in `roadmap.ts` if it is not already imported.

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run test/domain/roadmap.test.ts -t "a dateless parent spans its children"`
Expected: PASS, 8 tests.

- [ ] **Step 6: Run the whole suite and fix the tests this moves**

Run: `npm test`
Expected: FAILURES in `test/domain/roadmap.test.ts` and `test/view/roadmapFrame.test.ts` at every place that asserts a dateless parent shelves or that `placedCount` has a particular value. **These are correct failures — the feature is exactly this change.** For each one: if the fixture's parent now infers a bar, move it out of the shelf assertion and into the bar assertion; if the test's *subject* was something else (the shelf's ordering, a context row's placement), give its parent explicit dates or leave its subtree dateless so the test keeps testing what it was written to test.

Do not delete a failing assertion. Every one names a behaviour someone wanted; re-point it or rewrite the fixture.

- [ ] **Step 7: Add the invariant test for the crossed case, and watch it fail**

The crossed-evidence branch has a comment stating a rule. Temporarily delete the whole `if (evidenceStart !== null && evidenceTarget !== null && ...)` block.
Run: `npx vitest run test/domain/roadmap.test.ts -t "crossed evidence brackets"`
Expected: FAIL — without the branch, `keepsOrder` drops the target and the bar comes back `{ start: june, target: null }`.
Restore the block, re-run, expect PASS.

- [ ] **Step 8: Test the guarantee — derived, never stored**

The use case's guarantee is that *"an inferred span is display only — nothing is ever written back to the parent"*, and main flow 4 says it recomputes rather than persists. Both are one test. Append to the same `describe` block in `test/domain/roadmap.test.ts`:

```ts
	it('is derived every pass and written nowhere — a changed child moves the parent', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-04-01' },
			parentLink: 'Epic',
		});

		const first = buildModel(vault.app, vault.entries(), axisSettings());
		expect(roadmapOf(first, axisSettings(), 'dates').bars[0].span.target).toEqual({
			year: 2026,
			month: 4,
			day: 1,
		});

		// The child's plan slips. Nothing re-plans the epic — it is recomputed.
		vault.setFrontmatter('A.md', { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-09-01' });
		const second = buildModel(vault.app, vault.entries(), axisSettings());
		expect(roadmapOf(second, axisSettings(), 'dates').bars[0].span.target).toEqual({
			year: 2026,
			month: 9,
			day: 1,
		});

		// The epic's own frontmatter was never touched: an inference is not a value.
		expect(vault.writeLog).toEqual([]);
	});
```

Check `test/helpers/vault.ts` for the actual name of the method that replaces a file's frontmatter — if `FakeVault` has no such setter, call `vault.addFile('A.md', { frontmatter: … })` a second time if that overwrites, or add the smallest setter that does and name it in the helper's doc comment. `writeLog` already exists on `FakeVault` and records every `processFrontMatter` call, which is what makes the last assertion real rather than decorative.

- [ ] **Step 9: Full check and commit**

```bash
npm run check
git add src/domain/roadmap.ts test/domain/roadmap.test.ts test/view/roadmapFrame.test.ts test/helpers/vault.ts
git commit -m "Fill a dateless parent's bar from its subtree, endpoint by endpoint"
```

---

### Task 3: Draw an inference as an inference

**Files:**
- Modify: `src/view/render/timeline.ts:88-105` (`barClasses`, `spanText`, and the two call sites in `renderBarRow`)
- Modify: `styles.css` (after the `.pbl-bar-open-start.pbl-bar-open-end` rule at line 1752)
- Test: `test/view/roadmapFrame.test.ts`

**Interfaces:**
- Consumes: `TimelineBar { item, span, inferredStart, inferredEnd }` from Task 2.
- Produces: the `pbl-bar-inferred` class on the bar element, and an aria-label / tooltip naming the inference. Nothing downstream consumes these — they are the deliverable.

**Design note — one visual state, not two.** The spec's acceptance criteria read *"styled as inferred, faded where partly unknown"*, and extension 2a wants a fade when some children are dated and some are not. Distinguishing "inferred" from "inferred and partly unknown" needs a second boolean threaded through the whole walk for a difference nobody can point at on screen: an inferred end is uncertain by construction. **One class, `pbl-bar-inferred`, covering both.** Leave a `ponytail:` comment naming the ceiling. Add the second state when someone can describe the two pixels apart.

- [ ] **Step 1: Write the failing test**

Append to `test/view/roadmapFrame.test.ts`, inside the existing `describe('the dated frame')` block. It already has `roadmapView`, the `DATES` config, and the `timelineRows` / `barOf` helpers from `test/helpers/roadmap.ts` — use them rather than building a second harness or reaching for a `data-path` selector.

```ts
	it('draws an inferred bar as an outline and says so in its label', () => {
		const vault = new FakeVault();
		// The epic states nothing; its two children bracket it.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', due: '2026-08-20' },
			parentLink: 'Epic',
		});
		vault.addFile('B.md', {
			frontmatter: { type: 'Feature', order: 20, start: '2026-09-01', due: '2026-09-30' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const rows = timelineRows(containerEl);
		// The epic is on the grid now, not the shelf, and it leads its children.
		expect(rows).toHaveLength(3);
		expect(shelfTitles(containerEl)).toEqual([]);

		const epic = barOf(rows[0]);
		expect(epic.hasClass('pbl-bar-inferred')).toBe(true);
		expect(epic.getAttribute('aria-label')).toBe('2026-08-01 → 2026-09-30 — inferred from children');

		// A stated bar is never marked: the two must not read alike.
		const stated = barOf(rows[1]);
		expect(stated.hasClass('pbl-bar-inferred')).toBe(false);
		expect(stated.getAttribute('aria-label')).toBe('2026-08-01 → 2026-08-20');
	});

	it('marks a half-inferred bar too — one stated end does not make it a statement', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01' } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, due: '2026-09-30' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const epic = barOf(timelineRows(containerEl)[0]);
		expect(epic.hasClass('pbl-bar-inferred')).toBe(true);
		expect(epic.getAttribute('aria-label')).toBe('2026-08-01 → 2026-09-30 — inferred from children');
	});
```

`shelfTitles` is already imported at the top of the file. Both dates are in 2026-08/09 so they sit near today's window without changing the month grid's shape — keep new fixtures in that range for the same reason the existing ones are.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/view/roadmapFrame.test.ts -t "an inferred bar is drawn as an inference"`
Expected: FAIL — `pbl-bar-inferred` is on no element.

- [ ] **Step 3: Pass the bar, not the span**

In `src/view/render/timeline.ts`, change both helpers to take the whole bar:

```ts
/**
 * A dateless end is styled open — the plan's gap stays visible instead of being
 * filled in — and an end past the window's edge is styled the same way: both say
 * "this continues beyond what is drawn", and the tooltip carries the exact dates.
 *
 * An inferred bar is a different claim: it HAS dates, but the view drew them from
 * below rather than reading them off the note, so it is outlined rather than
 * filled and never reads as a plan somebody stated.
 *
 * ponytail: one class covers "inferred" and "inferred, some children undated" —
 * an inferred end is uncertain by construction. Split them when someone can
 * describe the two pixels apart.
 */
function barClasses(bar: TimelineBar, geometry: BarGeometry): string {
	let cls = 'pbl-bar';
	if (geometry.milestone) cls += ' pbl-bar-milestone';
	if (bar.span.start === null || geometry.clippedStart) cls += ' pbl-bar-open-start';
	if (bar.span.target === null || geometry.clippedEnd) cls += ' pbl-bar-open-end';
	if (bar.inferredStart || bar.inferredEnd) cls += ' pbl-bar-inferred';
	return cls;
}

function spanText(bar: TimelineBar): string {
	const span = bar.span;
	const inferred = bar.inferredStart || bar.inferredEnd ? ' — inferred from children' : '';
	if (span.start !== null && span.target !== null) {
		if (formatCivil(span.start) === formatCivil(span.target)) return `Milestone ${formatCivil(span.start)}${inferred}`;
		return `${formatCivil(span.start)} → ${formatCivil(span.target)}${inferred}`;
	}
	if (span.start !== null) return `Starts ${formatCivil(span.start)}, target not set${inferred}`;
	// deriveBars admits no fully dateless span, so the remaining end exists.
	return `Target ${formatCivil(span.target as CivilDate)}, start not set${inferred}`;
}
```

Update the two call sites in `renderBarRow`: `barClasses(bar, geometry)` and `spanText(bar)`. The `DateSpan` import may now be unused — remove it if so, or `npm run analyze` will say so.

- [ ] **Step 4: Add the style**

In `styles.css`, **after** the `.pbl-bar-open-start.pbl-bar-open-end` rule (the open-end gradients must not win over this):

```css
/* An inference is a summary the view drew, not a plan somebody made. Outlined
   rather than filled, so the two never read alike at a glance — and the border
   inherits --pbl-bar-color, so a done subtree's inferred bar stays green. */
.pbl-bar-inferred {
	background: none;
	border: 1px dashed var(--pbl-bar-color);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run test/view/roadmapFrame.test.ts -t "an inferred bar is drawn as an inference"`
Expected: PASS, 2 tests.

- [ ] **Step 6: Full check and commit**

```bash
npm run check
git add src/view/render/timeline.ts styles.css test/view/roadmapFrame.test.ts
git commit -m "Draw an inferred span as an outline, and say so in its label"
```

---

### Task 4: Settle the register

**Files:**
- Modify: `docs/requirements/Spans roll up the tree.md` (frontmatter `status` and `files`, and the `## Where it lives` section)
- Modify: `docs/README.md` (the **Product Roadmap** paragraph)

**Interfaces:** none — this is the gate that keeps `docs/` honest, and `npm run docs` is what checks it.

- [ ] **Step 1: Update the PBI's frontmatter**

Set `status: Done`. Replace the `files:` list with every path this increment actually touched:

```yaml
files:
  - src/domain/model.ts
  - src/domain/timeline.ts
  - src/domain/roadmap.ts
  - src/view/render/timeline.ts
```

> Rule 4 of `docs-check.mjs`: every `src/` path a note in `requirements/` names must exist. A path left behind fails the gate.

- [ ] **Step 2: Rewrite `## Where it lives`**

Replace the "**Nothing yet — this note is design.**" paragraph with what shipped: the evidence gathers in `assignAll` (`src/domain/model.ts`) under the same `outsideFilter` gate as the progress counts, `earliest`/`latest` are in `src/domain/timeline.ts` beside the rest of the civil-date arithmetic, the endpoint-by-endpoint merge is `inferSpan` in `src/domain/roadmap.ts` beside the shelving it shares a decision with, and `src/view/render/timeline.ts` draws it. State plainly that the marker exclusion (extension 1b) is **not** built, because the marker category does not exist yet — it lands with [[Milestones as their own type]], in the same walk, as that note's spec already says.

- [ ] **Step 3: Update the README's Product Roadmap paragraph**

It currently says the dated axis is read-only and that "The dated axis is still read-only — scheduling by drag, the bar moves, the lanes and the milestone type are design." That stays true. Add that the dated axis now shows the tree: a parent without dates of its own spans its dated descendants, endpoint by endpoint, drawn as the inference it is and written nowhere. Keep it to a sentence or two — the README is a register, not a changelog.

- [ ] **Step 4: Run the gate**

Run: `npm run docs`
Expected: PASS. If it reports an unresolved wikilink, the note names something that does not exist — fix the link, not the check.

- [ ] **Step 5: Full check and commit**

```bash
npm run check
git add docs/requirements/"Spans roll up the tree.md" docs/README.md
git commit -m "docs: the dated axis shows the tree it always had"
```

- [ ] **Step 6: Push and open the pull request**

```bash
git push -u origin claude/next-product-increment-delxnx
```

Then open a PR, ready for review, against the repository's default branch.

---

## Still needs a live vault

Obsidian cannot run here, and three things in this increment are appearance:

1. The dashed outline against the filled bar — whether an inferred epic reads as a summary at a glance, in both light and dark themes.
2. The outline against `.pbl-timeline-row.pbl-done .pbl-bar`'s green override.
3. Whether a deep tree of inferred parents is legible or just noisy.

`npm run test-build` installs the plugin into this repository, which is already a backlog with `docs/Product Backlog.base` in it. Say so in the PR — do not claim the visual half is verified.

---

## Phase 2: Milestones — its own plan, written after this one lands

**This is a deliberate scope split, not an omission**, and it follows the writing-plans scope check: each plan should produce working, testable software on its own. This one does.

`docs/requirements/Milestones.md` carries a ten-row landmine table, and three of its rows are guards **on code Task 1 and Task 2 above create** — extension 1b's marker exclusion goes in the `assign` loop this plan writes, and `barGeometry`'s clamp-versus-diamond problem is a decision about a bar this plan just changed the provenance of. Writing that plan now means writing code against files in flight.

What the Milestones plan will have to cover, so nothing is lost between here and there:

- The **third type category** — a declared marker: no rung, no children, no parent, with `ALL_TYPES` as the union. Explicitly *not* `EXTRA_TYPES`, which means pinned at `EXTRA_TYPE_RANK` / children are Tasks / hangs from Epic, Feature or PBI — a milestone is the opposite on all three counts, and putting the name there would falsify the contract rather than extend it.
- The cascade's retype exemption widening to the declared **non-rung** types, not to "declared types" — stopping one word early exempts the ladder and undoes [[Assigning type on a move]].
- The ten sites in the table: `rankOf` (`src/domain/writePlan.ts`), `renderFocusPicker` (`src/view/render/toolbar.ts`), `addScheduleItems` (`src/view/interactions/menu.ts`), the date rollup (Task 1 above), `deriveBars` (Task 2 above), `barGeometry` (`src/domain/timeline.ts`), `scheduleFields`/`validateSchedule`/`carriesDates`/`unschedule` (`src/view/interactions/plan.ts`), `renderRowTrailing` (`src/view/render/rows.ts`), `test/docs/surfaces.test.ts`.
- The one rule those collapse to: **a placement action must answer for the type it acts on, on both the offering side and the writing side** — stated per type, not per control.
- **Vocabulary-driven tests instead of remembered lists.** `EXTRA_TYPE_STYLE` in `rows.ts` already refuses to be forgotten because a test asserts the table covers the vocabulary; `surfaces.test.ts` still asserts `typeFolder.<type>` against a hand-written six. Making those read the vocabulary is what stops an eleventh site from existing.
- Records to amend in the same change: ADR 0013 (titled for six names), ADR 0014 (defines an extra type as "a declared type that is not a rung" — the amendment is to that definition's reach, not to the decision), `docs-check.mjs`'s legal-parent table, and `docs/README.md`'s hierarchy table, which has no row for a type whose parent is nothing and whose children are nothing.
