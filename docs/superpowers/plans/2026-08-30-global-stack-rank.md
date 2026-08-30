# One Global Rank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `order` one fractional rank over the whole backlog, so a focus-level list (the PBI backlog on its own) can be ranked with the same number the tree uses.

**Architecture:** One sorted array of every loaded item (`model.ranked`) becomes the only source of ranking arithmetic. A placement decides an *anchor row and a side*; the number is always the midpoint between that anchor and its neighbour in `ranked`. The peer group says *where the user aimed*, never *what number to write*. Renumbering is deleted outright; a spent gap or an unranked neighbour refuses the drop and names a remedy.

**Tech Stack:** TypeScript 6 (`~6.0.3`), Obsidian API 1.12.0 (pinned to the floor exactly), Vitest + jsdom, ESLint with `no-restricted-imports` layering rules.

## Global Constraints

Copied from the spec and from `CLAUDE.md`. Every task's requirements implicitly include this section.

- **Layering:** `main → commands → view → storage → domain`. Each layer may reach anything below it and nothing above. `i18n/` is below every layer. Violations fail `npm run lint`.
- **400-line max per file** in `src/` (lint-enforced). **450-line max** in `test/`.
- **Never write frontmatter outside `storage/`.** `no-restricted-syntax` bans `processFrontMatter`, `vault.create`, `load/saveLocalStorage` elsewhere.
- **All user-facing text goes through `t()`** with a key in `src/i18n/en.ts`. `UI_TEXT_LITERAL`, `UI_TEXT_PROPERTY` and `TEXT_TERNARY` lint rules enforce this in swept directories. `commands/` and `view/` are swept.
- **`domain/` never touches the DOM and never writes.** It has node tests, not jsdom tests.
- **Ranking runs over `model.realRoots`, never a projection's list** — lint-enforced in `writePlan.ts` and `view/interactions/create.ts` (`VISUAL_DEPTH` and the ranking rule in `src/domain/CLAUDE.md`).
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.
- **Definition of done:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register). All five must pass before committing. Coverage thresholds in `vitest.config.mts` only ever go up.
- **New constants:** `ORDER_SPACING = 1000`, `MIN_GAP = 0.000002`, `roundOrder` to **6** decimals.
- **`CHANGELOG.md`** gains an `[Unreleased]` entry in this pull request.
- Obsidian cannot run here. The migration commands need `npm run test-build` and a live vault before they are called done.

## File Structure

**Created:**
- `src/domain/rankOrder.ts` — the global rank comparator, the ranked-array build, and the
  focus-rows filter. **It exists because `src/domain/model.ts` has 6 code lines of headroom
  under the lint `max-lines: 400` cap and Tasks 1-2 need about 14** — measured with eslint,
  not estimated. Only `src/i18n/en.ts` is exempt from that cap. Keeping the new code here
  also gives the ranking concern its own module, which is the repo's one-file-per-concern
  rule rather than a workaround.
- `src/commands/rank.ts` — the two palette commands (Seed ranks from the hierarchy, Respace ranks). One module, two commands.
- `test/domain/rankedPlacement.test.ts` — the placement rule, driven at the rule rather than at each placement.
- `test/domain/rankCommands.test.ts` — Seed vs Respace, and that they are not interchangeable.
- `test/view/focusRanking.test.ts` — one move, three inputs, at the focused level; the guards that stay.

**Modified:**
- `src/domain/model.ts` — adds `BacklogModel.ranked` and calls into `rankOrder.ts`. Keep
  the additions here to 2-3 code lines: **there are only 6**, and Task 2 spends some too.
  Verify with `npx eslint src/domain/model.ts` before committing, not after.
- `src/domain/writePlan.ts` — `anchoredOrder` replaces `computeInsertOrder`/`orderBetween`/`afterHighestKnown`/`renumberWrites`; adds `computeSeedWrites`/`computeRespaceWrites`; `computeInitWrites` gains a running counter.
- `src/domain/dropTargets.ts` — `DropTarget.siblings` → `peers`; `siblingPosition` answers for focus rows; the no-op branch reads peers; `reorderableGroup` deleted.
- `src/view/interactions/structure.ts` — `siblingContext` keys on focus-forest membership; `indent`/`outdent` gain their own `focusRoot` refusal.
- `src/view/interactions/create.ts` — `endOfSiblingsOrder` deleted; creation ranks through `orderForTarget`.
- `src/view/registry.ts` — `LiveBacklogView` gains `applySafely`.
- `src/view/backlogView.ts`, `src/view/registerBacklogView.ts` — publish `applySafely` on the live view.
- `src/main.ts` — registers the two commands.
- `src/i18n/en.ts` — six new keys.
- `test/domain/writePlan.test.ts`, `test/domain/writePlanContextRows.test.ts`, `test/domain/modelCost.test.ts`, `test/view/contextRowWrites.test.ts` — updated.
- `docs/` — one new ADR, one new PBI, four edits.

---

### Task 1: The ranked population

**Files:**
- Create: `src/domain/rankOrder.ts`
- Modify: `src/domain/model.ts`
- Test: `test/domain/modelCost.test.ts`, `test/domain/model.test.ts`

**Line budget — read before writing.** `src/domain/model.ts` passes lint with **6** code
lines to spare (blank lines and comments are skipped by the rule; comments are free).
Task 2 needs some of them. Put the comparator and the build in `rankOrder.ts` and keep
model.ts to the field declaration, the call, and the returned property. Check with
`npx eslint src/domain/model.ts` before you commit.

**Interfaces:**
- Consumes: nothing.
- Produces: `BacklogModel.ranked: BacklogItem[]` — every loaded item (results **and** `outsideFilter` context rows), sorted ascending by `order`, ties broken by `entryIndex`. Items with `order === null` sort last. This is the only array any ranking arithmetic may read.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/model.test.ts`:

```ts
it('ranks every loaded item globally, context rows included, unranked last', () => {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 3000 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 1000 } });
	vault.addFile('PBI C.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
	vault.addFile('PBI D.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic B' });
	const model = buildModel(vault.app, vault.entries(), settings);
	expect(model.ranked.map((i) => i.file.basename)).toEqual(['Epic B', 'PBI C', 'Epic A', 'PBI D']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/model.test.ts -t "ranks every loaded item globally"`
Expected: FAIL — `model.ranked` is undefined.

- [ ] **Step 3: Add the field and the sort**

In `src/domain/model.ts`, in the `BacklogModel` interface beside `items` (around line 136):

```ts
	/**
	 * Every loaded item — results and `outsideFilter` context rows alike — in global
	 * rank order. **The only array ranking arithmetic may read.** Never a projection's
	 * list: a `Test suite` and an `Epic` share a rank space, so ranking against one
	 * projection's slice takes a midpoint a hidden root may already hold. Context rows
	 * are IN it because their orders are read for placement and knowing more occupied
	 * ranks can only reduce collisions; they stay unwritable through `applySafely`.
	 *
	 * A focus level is a FILTER over this array, and filtering a sorted array preserves
	 * order — which is why `collectFocusRoots` needs no sort of its own.
	 */
	ranked: BacklogItem[];
```

Create `src/domain/rankOrder.ts`:

```ts
import { BacklogItem } from './model';

/**
 * Global rank order: the `order` property ascending, ties broken by the Bases result
 * order. Unranked items sort last — absence is not a low rank, and `compareSiblings`
 * already keeps that rule for a sibling group.
 */
function compareRank(a: BacklogItem, b: BacklogItem): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	return ao - bo || a.entryIndex - b.entryIndex;
}

/**
 * Every loaded item in global rank order — the build's second object sort, declared in
 * `src/domain/CLAUDE.md`'s Cost section: bounded by the item count, run once per build
 * rather than per row, so the build's bound stays O(n log n).
 */
export function rankedItems(items: BacklogItem[]): BacklogItem[] {
	return [...items].sort(compareRank);
}
```

In `buildModel`, immediately after the `resources` sort (around line 265), add **one line**:

```ts
	const ranked = rankedItems(items);
```

Add `ranked` to the returned object in the `rest` literal (beside `realRoots`, around
line 273) — **one more line** — and import `rankedItems` at the top.

`rankOrder.ts` importing a type from `model.ts` while `model.ts` imports a function from
it is a cycle in the module graph. If the build or lint objects, move `BacklogItem` to a
type-only import (`import type { BacklogItem } from './model'`), which erases at compile
time. Do not solve it by moving the code back into `model.ts` — the cap is why this module
exists.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/domain/model.test.ts -t "ranks every loaded item globally"`
Expected: PASS

- [ ] **Step 5: Update the cost check to two named sorts**

`test/domain/modelCost.test.ts` asserts every item is sorted exactly once. That claim is now false, and it is corrected honestly rather than widened. Replace the `sorted` derivation and its assertion so the two item sorts are counted apart:

```ts
	// TWO passes over items now, each once: `sortSiblingsDeep` over the sibling groups,
	// and the global rank sort. A third would still fail this.
	const itemGroups = groups.filter((g) => 'typeName' in g[0]);
	const wholeSet = itemGroups.filter((g) => g.length === model.items.length);
	const sorted = itemGroups.filter((g) => !wholeSet.includes(g)).reduce((total, g) => total + g.length, 0);
	const rankSorts = wholeSet.length;
```

Return `rankSorts` from `costOf` alongside `sorted`, and add:

```ts
it('sorts the whole item set exactly once for the global rank', () => {
	expect(costOf(200).rankSorts).toBe(1);
});
```

- [ ] **Step 6: Run the cost suite**

Run: `npx vitest run test/domain/modelCost.test.ts`
Expected: PASS, including the pre-existing sibling-sort assertion.

- [ ] **Step 7: Commit**

```bash
git add src/domain/rankOrder.ts src/domain/model.ts test/domain/model.test.ts test/domain/modelCost.test.ts
# Stage every file you CREATED as well as every file you changed. A new module left
# untracked still passes local checks — it is on disk — and fails CI on a fresh
# checkout, where the import cannot resolve. Confirm with `git show --stat HEAD`.
git commit -m "feat(domain): add the global ranked population

One sort over every loaded item, ties on entryIndex, unranked last. The
build's second object sort, declared and checked as its own pass rather than
by widening the exactly-once assertion."
```

---

### Task 2: The focused list renders in rank order

**Files:**
- Modify: `src/domain/rankOrder.ts`, `src/domain/model.ts` (`collectFocusRoots` call site,
  around line 334)
- Test: `test/domain/model.test.ts`, `test/domain/roadmap.test.ts`

**Line budget:** `src/domain/model.ts` had 6 code lines of headroom before Task 1 spent
two. The filter body goes in `rankOrder.ts`; model.ts keeps a one-line call.

**Interfaces:**
- Consumes: `BacklogModel.ranked` from Task 1.
- Produces: under an active focus, `model.roots` is in global rank order rather than DFS preorder. Nothing new is exported.

- [ ] **Step 1: Write the failing test**

```ts
it('orders focus rows by global rank, not by tree position', () => {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
	// A's child ranks AFTER B's child globally — DFS preorder would list it first.
	vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 9000 }, parentLink: 'Epic A' });
	vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 3000 }, parentLink: 'Epic B' });
	const focused = { ...settings, focusLevel: 'PBI' };
	const model = buildModel(vault.app, vault.entries(), focused);
	expect(model.roots.map((i) => i.file.basename)).toEqual(['PBI B1', 'PBI A1']);
});
```

Note: read how `test/domain/model.test.ts` already sets a focus level — reuse that spelling rather than the `focusLevel` guess above if it differs.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/model.test.ts -t "orders focus rows by global rank"`
Expected: FAIL — order is `['PBI A1', 'PBI B1']` (DFS preorder).

- [ ] **Step 3: Filter the sorted array instead of re-sorting**

In `buildModel`, replace:

```ts
	const focusRoots = focused ? collectFocusRoots(roots, focusIdx, focusExtra, settings) : roots;
```

with:

```ts
	// A focus level is a FILTER over the ranked array, never a sort of its own:
	// filtering a sorted array preserves order, so this costs one pass and no
	// comparison. `collectFocusRoots` still decides membership (which rungs and which
	// extra types); `ranked` decides sequence.
	const focusRoots = focused ? inRankOrder(collectFocusRoots(roots, focusIdx, focusExtra, settings), ranked) : roots;
```

with this in `src/domain/rankOrder.ts`:

```ts
/**
 * The given rows, in global rank order. A focus level is a FILTER over the ranked
 * array, never a sort of its own: filtering a sorted array preserves order, so this
 * costs one pass and no comparison. `collectFocusRoots` decides MEMBERSHIP — which
 * rungs and which extra types — and `ranked` decides SEQUENCE.
 */
export function inRankOrder(rows: BacklogItem[], ranked: BacklogItem[]): BacklogItem[] {
	const members = new Set(rows);
	return ranked.filter((item) => members.has(item));
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/domain/model.test.ts -t "orders focus rows by global rank"`
Expected: PASS

- [ ] **Step 5: Cover the surface this reaches beyond the tree**

`roadmapRows` (`src/domain/roadmap.ts:513`) is
`(model.focused ? model.roots : model.results).filter(visible)` — no sort of its own — so a
**focused** roadmap's shelf and timeline rows follow this change. That is intended: the two
surfaces would otherwise disagree about the same rung. It is still a behaviour change, so
it gets a check rather than a discovery:

```ts
it('orders a focused roadmap by rank, and an unfocused one as before', () => {
	// Same fixture as above: PBI B1 (3000) ranks before PBI A1 (9000).
	expect(roadmapRowTitles(focusedModel)).toEqual(['PBI B1', 'PBI A1']);
	expect(roadmapRowTitles(unfocusedModel)).toEqual(unfocusedTreeOrder);
});
```

Put it in `test/domain/roadmap.test.ts`, beside that file's existing row-order cases.

- [ ] **Step 6: Run the whole domain suite for regressions**

Run: `npx vitest run test/domain/`
Expected: PASS. If a focus test asserts DFS ordering, it is asserting the old rule — update it and say so in the commit.

- [ ] **Step 7: Commit**

```bash
git add src/domain/rankOrder.ts src/domain/model.ts test/domain/model.test.ts test/domain/roadmap.test.ts
git commit -m "feat(domain): focus rows render in global rank order

A filter over the ranked array rather than a sort of its own, so
collectFocusRoots decides membership and ranked decides sequence."
```

---

### Task 3: The placement rule

**Files:**
- Modify: `src/domain/writePlan.ts` (constants at lines 27-29; `computeInsertOrder`/`orderBetween` around lines 687-701)
- Create: `test/domain/rankedPlacement.test.ts`

**Interfaces:**
- Consumes: `BacklogModel.ranked` (the caller passes the array, not the model — `writePlan.ts` stays pure).
- Produces, exported from `src/domain/writePlan.ts` (`dropPlacement` arrives in Task 4):

```ts
export const ORDER_SPACING = 1000;
export type RankRefusal = 'gapSpent' | 'unranked';
export type RankResult = { order: number } | { refusal: RankRefusal };
export function anchoredOrder(
	ranked: BacklogItem[],
	anchor: BacklogItem | null,
	side: 'before' | 'after',
): RankResult;
export function orderForTarget(ranked: BacklogItem[], target: DropTarget): RankResult;
```

`ranked` **must not contain the item being placed** — the caller filters it out, or the item becomes its own neighbour.

- [ ] **Step 1: Write the failing tests**

Create `test/domain/rankedPlacement.test.ts`. Build items with a small helper rather than a vault — this is pure arithmetic:

```ts
import { describe, expect, it } from 'vitest';
import { anchoredOrder, ORDER_SPACING } from '../../src/domain/writePlan';
import { BacklogItem } from '../../src/domain/model';

/** The only fields `anchoredOrder` reads. */
function ranked(...orders: (number | null)[]): BacklogItem[] {
	return orders.map((order, i) => ({ order, entryIndex: i }) as BacklogItem);
}

describe('anchoredOrder', () => {
	it('takes the midpoint between the anchor and its global neighbour', () => {
		const list = ranked(1000, 3000);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ order: 2000 });
		expect(anchoredOrder(list, list[1], 'before')).toEqual({ order: 2000 });
	});

	it('places before the global first', () => {
		const list = ranked(1000, 3000);
		expect(anchoredOrder(list, list[0], 'before')).toEqual({ order: 0 });
	});

	it('places after the global last', () => {
		const list = ranked(1000, 3000);
		expect(anchoredOrder(list, list[1], 'after')).toEqual({ order: 4000 });
	});

	it('ranks the first item in an empty population', () => {
		expect(anchoredOrder([], null, 'after')).toEqual({ order: ORDER_SPACING });
	});

	it('refuses a spent gap', () => {
		const list = ranked(1000, 1000.000001);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ refusal: 'gapSpent' });
	});

	it('refuses an unranked neighbour', () => {
		const list = ranked(1000, null);
		expect(anchoredOrder(list, list[0], 'after')).toEqual({ refusal: 'unranked' });
	});

	it('refuses an anchor that is not in the population', () => {
		expect(anchoredOrder(ranked(1000), ranked(5000)[0], 'after')).toEqual({ refusal: 'unranked' });
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/rankedPlacement.test.ts`
Expected: FAIL — `anchoredOrder` is not exported.

- [ ] **Step 3: Change the constants**

In `src/domain/writePlan.ts` lines 27-29:

```ts
export const ORDER_SPACING = 1000;
/**
 * Below this gap between neighbours a drop refuses rather than subdividing. Six
 * decimals is the floor `roundOrder` can represent, and the pair gives about thirty
 * halvings of one interval — the price of frontmatter a human reads, paid knowingly.
 */
const MIN_GAP = 0.000002;
```

And `roundOrder` (around line 903):

```ts
function roundOrder(value: number): number {
	return Math.round(value * 1000000) / 1000000;
}
```

- [ ] **Step 4: Write `anchoredOrder`**

Replace `computeInsertOrder` and `orderBetween` with:

```ts
/**
 * The rank for a placement, stated ONCE for every placement there is.
 *
 * A placement decides an anchor row and a side; the number comes from the anchor's
 * neighbours in the globally rank-sorted population — never from the peer group, and
 * never from forest traversal. After one cross-parent move DFS preorder is no longer
 * global order, so "the next row in the forest" can hold a LOWER rank than the last
 * peer, and a midpoint of an inverted pair is not a near miss.
 *
 * `ranked` must not contain the item being placed, or it becomes its own neighbour.
 */
export function anchoredOrder(
	ranked: BacklogItem[],
	anchor: BacklogItem | null,
	side: 'before' | 'after',
): RankResult {
	if (ranked.length === 0) return { order: ORDER_SPACING };
	let prev: BacklogItem | null;
	let next: BacklogItem | null;
	if (anchor === null) {
		// No anchor means an edge of the whole population.
		prev = side === 'after' ? ranked[ranked.length - 1] : null;
		next = side === 'after' ? null : ranked[0];
	} else {
		const idx = ranked.indexOf(anchor);
		if (idx === -1) return { refusal: 'unranked' };
		prev = side === 'before' ? (ranked[idx - 1] ?? null) : anchor;
		next = side === 'before' ? anchor : (ranked[idx + 1] ?? null);
	}
	if (!prev) return next && next.order !== null ? { order: Math.floor(next.order) - ORDER_SPACING } : { refusal: 'unranked' };
	if (!next) return prev.order !== null ? { order: Math.floor(prev.order) + ORDER_SPACING } : { refusal: 'unranked' };
	if (prev.order === null || next.order === null) return { refusal: 'unranked' };
	if (next.order - prev.order <= MIN_GAP) return { refusal: 'gapSpent' };
	return { order: roundOrder(prev.order + (next.order - prev.order) / 2) };
}
```

Add the types above it:

```ts
/** Why a placement produced no number. Each names its own remedy at the notice. */
export type RankRefusal = 'gapSpent' | 'unranked';
export type RankResult = { order: number } | { refusal: RankRefusal };
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run test/domain/rankedPlacement.test.ts`
Expected: PASS, all seven.

- [ ] **Step 6: Watch one invariant fail without its fix**

Temporarily change the `gapSpent` line to `if (next.order - prev.order <= 0)`. Run the suite; the "refuses a spent gap" test must go red. Restore it.

- [ ] **Step 7: Commit**

```bash
git add src/domain/writePlan.ts test/domain/rankedPlacement.test.ts
git commit -m "feat(domain): one placement rule over the ranked population

anchoredOrder replaces the per-placement arithmetic: an anchor and a side,
neighbours read from the global array. Spacing 1000, six decimals, MIN_GAP
0.000002. Two refusals, told apart so each can name its own remedy."
```

---

### Task 4: `DropTarget.peers`, and the drop plan

**Files:**
- Modify: `src/domain/dropTargets.ts`, `src/domain/writePlan.ts`
- Test: `test/domain/writePlan.test.ts`, `test/domain/writePlanContextRows.test.ts`

**Interfaces:**
- Consumes: `anchoredOrder` from Task 3.
- Produces:

```ts
// src/domain/dropTargets.ts
export interface DropTarget {
	parent: BacklogItem | null;
	/** Rows the item is ranked AMONG — intent, not arithmetic. */
	peers: BacklogItem[];
	insertIndex: number;
}
// `reorderableGroup` is DELETED.

// src/domain/writePlan.ts
export function orderForTarget(ranked: BacklogItem[], target: DropTarget): RankResult;
export function dropPlacement(dragged: BacklogItem, target: DropTarget, ranked: BacklogItem[]): RankResult;
export function computeDropWrites(dragged: BacklogItem, target: DropTarget, ranked: BacklogItem[]): ItemWrite[];
```

`computeDropWrites` returns `[]` on a refusal, and **the reason is not in that return.**
The caller that needs to name a remedy calls `orderForTarget(ranked, target)` itself and
reads the `refusal` field — one extra pure call rather than a richer return type through
every existing call site. Task 9 wires the two notices to it. Do not collapse them: an
unranked neighbour sent to Respace is advice that does not work.

- [ ] **Step 1: Write the failing tests**

Add to `test/domain/writePlan.test.ts` (matching the file's existing fixture helpers):

```ts
it('writes one note, with a midpoint from the global population', () => {
	// Epic A (1000) > PBI A1 (2000); Epic B (3000) > PBI B1 (4000).
	// Dropping PBI B1 after PBI A1 must take the midpoint of 2000 and 3000.
	const writes = computeDropWrites(pbiB1, { parent: pbiB1.parent, peers: [pbiA1], insertIndex: 1 }, ranked);
	expect(writes).toEqual([{ file: pbiB1.file, parent: undefined, order: 2500 }]);
});

it('plans no writes when the gap is spent', () => {
	expect(computeDropWrites(dragged, target, tightlyPackedRanked)).toEqual([]);
});

it('plans no writes when a neighbour has no rank', () => {
	expect(computeDropWrites(dragged, target, rankedWithNulls)).toEqual([]);
});

it('reads the whole loaded population, not a projection slice', () => {
	// A catalog `Test suite` ranked 2000 sits between PBI A1 (1000) and PBI B1 (3000).
	// It is loaded and not hidden by the Base, so a PBI insertion must not take 2000.
	// This is the case `model.results` gets wrong and `src/domain/CLAUDE.md` names.
	const writes = computeDropWrites(dragged, { parent: epicA, peers: [pbiA1], insertIndex: 1 }, ranked);
	expect(writes[0].order).toBe(1500);
});

it('anchors on the destination when the peer group is empty', () => {
	// First child of Epic A (1000), whose next global row is PBI A1 (2000).
	const writes = computeDropWrites(dragged, { parent: epicA, peers: [], insertIndex: 0 }, ranked);
	expect(writes[0].order).toBe(1500);
});
```

Also add the case the spec names as retained: the existing missing-order test in this file asserts renumbering today. Rewrite it to assert refusal — do **not** delete it.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/writePlan.test.ts`
Expected: FAIL — `computeDropWrites` takes two arguments and `target.peers` does not exist.

- [ ] **Step 3: Rename the field and delete the guard**

In `src/domain/dropTargets.ts`: rename `siblings` to `peers` throughout (interface, `insidePosition`, `siblingPosition`), and delete `reorderableGroup` entirely along with the `if (!reorderableGroup(siblings)) return null;` line in `siblingPosition`. Update the `DropTarget` doc comment:

```ts
/**
 * A resolved landing place: whose child the item becomes, and among which rows it is
 * ranked. **`peers` is intent, never arithmetic** — it says the user aimed before this
 * row or after that one; the NUMBER comes from the global ranked population (see
 * `anchoredOrder`). Declared here with the functions that work it out, not with the
 * writer that consumes it.
 */
```

- [ ] **Step 4: Write `orderForTarget` and rewire `computeDropWrites`**

In `src/domain/writePlan.ts`, delete `afterHighestKnown` and `renumberWrites` entirely, then:

```ts
/**
 * The anchor a target implies: the last peer, or the destination row itself when
 * there is none. An empty peer group is the commonest placement there is — the first
 * child of a parent, a drop inside a leaf — which is why the anchor is stated over the
 * DESTINATION rather than over the peers.
 */
export function orderForTarget(ranked: BacklogItem[], target: DropTarget): RankResult {
	const { peers, insertIndex, parent } = target;
	if (peers.length === 0) return anchoredOrder(ranked, parent, 'after');
	if (insertIndex === 0) return anchoredOrder(ranked, peers[0], 'before');
	return anchoredOrder(ranked, peers[insertIndex - 1], 'after');
}

/**
 * The frontmatter writes for dropping `dragged` at the given target.
 *
 * Always ONE note: the rank is a midpoint in the global population, so no group is
 * ever renumbered. An empty result means the placement refused — a spent gap or an
 * unranked neighbour — and the caller says which.
 */
export function computeDropWrites(dragged: BacklogItem, target: DropTarget, ranked: BacklogItem[]): ItemWrite[] {
	const placed = dropPlacement(dragged, target, ranked);
	if ('refusal' in placed) return [];
	return [{ file: dragged.file, parent: computeParentField(dragged, target.parent), order: placed.order }];
}

/**
 * The placement a drop would take — the planner's own answer, exported so the caller
 * that names a remedy asks the SAME question rather than a similar one.
 *
 * The dragged row is removed from the population before its neighbours are found, or
 * it becomes its own neighbour. That filter must not be written twice: a caller that
 * diagnosed against the unfiltered array could see a number where the planner refused
 * — a drop that does nothing and shows no remedy — which is why the diagnosis goes
 * through here instead of calling `orderForTarget` beside it.
 */
export function dropPlacement(dragged: BacklogItem, target: DropTarget, ranked: BacklogItem[]): RankResult {
	return orderForTarget(
		ranked.filter((item) => item !== dragged),
		target,
	);
}
```

- [ ] **Step 5: Run the write-plan suites**

Run: `npx vitest run test/domain/writePlan.test.ts test/domain/writePlanContextRows.test.ts`
Expected: PASS. In `writePlanContextRows.test.ts` the "renumber refused, append instead" cases now describe a branch that no longer exists — **watch them fail first**, then rewrite each to the new rule: an excluded row between two visible neighbours still produces one write, and never to the excluded note.

- [ ] **Step 6: Fix every remaining call site the compiler names**

Run: `npx tsc --noEmit`
Expected: errors at each `target.siblings` / two-argument `computeDropWrites`. Fix each by passing `host.model.ranked`. Do not add a fallback for a null model — the callers already hold one.

- [ ] **Step 7: Commit**

```bash
git add src/domain/dropTargets.ts src/domain/writePlan.ts test/domain/
git commit -m "feat(domain): one write per drop, ranked globally

DropTarget.siblings becomes peers — intent, not arithmetic. renumberWrites,
afterHighestKnown and reorderableGroup are deleted; the drop refuses instead.
The missing-order case is retained as a refusal assertion rather than removed
with the branch it used to exercise."
```

---

### Task 5: Focus rows are a ranking destination

**Files:**
- Modify: `src/domain/dropTargets.ts` (`siblingPosition`, `dropTargetFor`)
- Test: `test/view/focusRanking.test.ts` (create), `test/view/contextRowWrites.test.ts`

**Interfaces:**
- Consumes: `DropTarget.peers` from Task 4, `model.roots`/`model.focused` from Task 2.
- Produces: `siblingPosition` returns a target whose `peers` are `model.roots` and whose `parent` is the dragged item's **own** parent, when both rows are active focus rows.

- [ ] **Step 1: Write the failing test**

Create `test/view/focusRanking.test.ts`:

```ts
it('ranks a focused PBI above one with a different parent, writing order only', async () => {
	// Focus level PBI. Epic A > PBI A1 (2000); Epic B > PBI B1 (4000).
	const harness = await focusedHarness('PBI');
	await harness.dropBefore('PBI B1', 'PBI A1');
	expect(harness.writes).toEqual([{ path: 'PBI B1.md', order: 1500 }]);
	expect(harness.writes[0]).not.toHaveProperty('parent');
});
```

Use the jsdom harness helpers already in `test/helpers/`; read `test/CLAUDE.md` before writing this file.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/focusRanking.test.ts`
Expected: FAIL — `siblingPosition` returns null for a focus root, so no writes.

- [ ] **Step 3: Answer for active focus rows**

In `siblingPosition`, replace the refusal:

```ts
	// An ancestor pulled in from outside the filter still has siblings the query never
	// returned, so ordering it against the loaded ones would be a guess.
	if (item.outsideFilter) return null;
	// An ACTIVE focus row is a ranking destination now: the peers are the rendered
	// focus rows, and the parent is the dragged item's OWN — a focus rank writes
	// `order` and never `parent`. Membership in the focus forest is the test, not the
	// `focusRoot` flag: `projectionForest` sets that flag on any promoted root,
	// including with `model.focused` false, so a catalog `Test suite` carries it while
	// its real siblings are off screen.
	// BOTH rows, not just the hovered one. Checking `item` alone lets a DESCENDANT
	// dragged onto a focus row take this branch: it would keep its own parent and get
	// ranked among a rung it does not belong to, silently, where today it is refused.
	if (model.focused && model.roots.includes(item) && model.roots.includes(dragged)) {
		const peers = model.roots.filter((r) => r !== dragged);
		const idx = peers.indexOf(item);
		if (idx === -1) return null;
		return { parent: dragged.parent, peers, insertIndex: zone === 'before' ? idx : idx + 1 };
	}
	if (item.focusRoot) return null;
```

- [ ] **Step 4: Fix the no-op branch**

In `dropTargetFor`, the no-op check reads the *real* sibling list. Under a focus rank `position.parent === dragged.parent` is always true, so it always runs — and two only-children both read index zero. Replace the branch body:

```ts
	// A FOCUS rank asks its no-op question of the focus list, and asks it exactly.
	// `peers` is `model.roots` minus the dragged row, so splicing the row back in at
	// its own original index reproduces `model.roots` — which means the drop is a
	// no-op precisely when the insert index equals that original index. No filtering
	// and no translation.
	if (model.focused && model.roots.includes(dragged) && position.parent === dragged.parent) {
		if (position.insertIndex === model.roots.indexOf(dragged)) return null;
	} else if (position.parent === dragged.parent && !clearsStaleLink(position.parent, dragged)) {
		// The TREE keeps today's rule unchanged: the real group filtered to this
		// projection, because a sibling group can interleave the projections and
		// crossing a row nobody can see is not a move.
		const fullList = position.parent ? position.parent.children : model.realRoots;
		const drawnIndex = fullList.filter(member).indexOf(dragged);
		const drawnInsert = position.peers.slice(0, position.insertIndex).filter(member).length;
		if (drawnInsert === drawnIndex) return null;
	}
```

**Why not one branch for both.** An earlier draft used `position.peers` as the drawn list
for focus rows and reasoned that `drawnIndex === -1` could never match, so a focus rank
would never be rejected. That is the bug, not the safety: dropping a focused row back into
the slot it already occupies would rewrite its rank and spend the undo slot with nothing on
screen changed. Add the test for exactly that — drop a focused row onto its own position,
assert no writes.

- [ ] **Step 5: Run the suites**

Run: `npx vitest run test/view/focusRanking.test.ts test/view/contextRowWrites.test.ts test/view/contextCardWrites.test.ts`
Expected: PASS. `contextRowWrites.test.ts` is the load-bearing suite — deleting `reorderableGroup` widens the write surface, so if it goes red, the widening is real and must be fixed here, not in the test.

- [ ] **Step 6: Commit**

```bash
git add src/domain/dropTargets.ts test/view/
git commit -m "feat(domain): focus rows accept a rank

siblingPosition answers for active focus rows — membership in the focus
forest, not the focusRoot flag, which projectionForest also sets on promoted
roots. The no-op branch asks the drawn list, or a focus rank on two
only-children reads as no move at all."
```

---

### Task 6: The keyboard and the menu

**Files:**
- Modify: `src/view/interactions/structure.ts`
- Test: `test/view/focusRanking.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4 and 5.
- Produces: no new exports. `canReorder` no longer consults `reorderableGroup` (deleted); `indent` and `outdent` carry their own `focusRoot` refusal.

- [ ] **Step 1: Write the failing tests**

```ts
it('lands the same rank from the drag, Alt+arrow and the menu', async () => {
	const harness = await focusedHarness('PBI');
	const byDrag = await harness.dropBefore('PBI B1', 'PBI A1');
	await harness.undo();
	const byKey = await harness.altUp('PBI B1');
	await harness.undo();
	const byMenu = await harness.menuMoveUp('PBI B1');
	expect(byKey).toEqual(byDrag);
	expect(byMenu).toEqual(byDrag);
});

it('still refuses indent and outdent across the focus row', async () => {
	const harness = await focusedHarness('PBI');
	expect(harness.menuHas('PBI B1', 'Indent')).toBe(false);
	expect(harness.menuHas('PBI B1', 'Outdent')).toBe(false);
});

it('refuses to rank a promoted root that is not an active focus row', async () => {
	// A catalog Test suite promoted past a non-member, focus OFF.
	const harness = await catalogHarness();
	expect(harness.menuHas('Suite 1', 'Move up')).toBe(false);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/focusRanking.test.ts`
Expected: FAIL on the first (Alt+arrow does nothing) and on the second if step 3 is done first.

- [ ] **Step 3: Key `siblingContext` on focus membership**

```ts
function siblingContext(host: BacklogViewHost, item: BacklogItem): { fullList: BacklogItem[]; idx: number } | null {
	const model = host.model;
	// A context row has siblings the query never returned, so ordering it against the
	// loaded ones would be a guess. Its rank is still READ for placement — that is a
	// different question, answered in `model.ranked`.
	if (!model || item.outsideFilter) return null;
	// An ACTIVE focus row ranks among the rendered focus rows. Membership, not the
	// `focusRoot` flag: `projectionForest` sets that on any promoted root including
	// with `model.focused` false, and a promoted catalog row's real siblings are not
	// on screen. Every other promoted root keeps the refusal below.
	if (model.focused && model.roots.includes(item)) {
		const idx = model.roots.indexOf(item);
		return { fullList: model.roots, idx };
	}
	if (item.focusRoot) return null;
	const fullList = item.parent ? item.parent.children : model.realRoots;
	const idx = fullList.indexOf(item);
	return idx === -1 ? null : { fullList, idx };
}
```

- [ ] **Step 4: Drop the deleted guard and re-guard indent/outdent**

`reorderableGroup` no longer exists. Remove its import and every call:

```ts
export function canReorder(host: BacklogViewHost, item: BacklogItem): boolean {
	return siblingContext(host, item) !== null;
}
```

In `moveWithinSiblings` and `moveToEdge`, delete `&& reorderableGroup(ctx.fullList)` / `|| !reorderableGroup(ctx.fullList)`, and pass `parent: item.parent` unchanged — under focus that is already the item's own parent, which is what a rank-only write needs.

In `outdentTarget`, delete the `if (!reorderableGroup(siblings)) return null;` line. Its `item.focusRoot` refusal stays and is now load-bearing on its own.

In `indent`, add the refusal that `siblingContext` used to supply:

```ts
export function indent(host: BacklogViewHost, item: BacklogItem): void {
	// Its own refusal, not one inherited from `siblingContext` — that function now
	// answers for focus rows, so `visibleNeighbor` would hand back a focus peer and
	// offer Indent across the synthetic row. Ranking there is this feature; reparenting
	// there is a question about parentage that nothing here answers.
	if (item.focusRoot) return;
	const newParent = visibleNeighbor(host, item, -1);
	if (!newParent) return;
	const siblings = newParent.children.filter((s) => s !== item);
	void host.performDrop(item, { parent: newParent, peers: siblings, insertIndex: siblings.length });
}
```

- [ ] **Step 5: Run and watch pass, then watch the guard fail**

Run: `npx vitest run test/view/focusRanking.test.ts`
Expected: PASS. Then delete the `if (item.focusRoot) return;` line from `indent`, rerun, and confirm "still refuses indent and outdent" goes red. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/view/interactions/structure.ts test/view/focusRanking.test.ts
git commit -m "feat(view): keyboard and menu rank at the focused level

siblingContext keys on focus-forest membership. indent gains its own
focusRoot refusal, because the guard that used to supply it is the one being
removed — the two edits cannot land apart."
```

---

### Task 7: Creation, and the backfill counter

**Files:**
- Modify: `src/view/interactions/create.ts`, `src/domain/writePlan.ts` (`computeInitWrites`, around line 873)
- Test: `test/domain/writePlan.test.ts`, `test/view/create.test.ts`

**Interfaces:**
- Consumes: `orderForTarget` from Task 4.
- Produces: `endOfSiblingsOrder` is deleted. `computeInitWrites` carries one running counter across the whole DFS.

- [ ] **Step 1: Write the failing tests**

```ts
it('backfills orders with one running counter across the whole tree', () => {
	// Epic A > (F1, F2), Epic B > (F3). No note carries an order.
	const writes = computeInitWrites(model, settings);
	expect(writes.map((w) => w.order)).toEqual([1000, 2000, 3000, 4000, 5000]);
});

it('creates a new child ranked between its parent and the next global row', () => {
	// Epic A (1000), PBI A1 (2000), Epic B (3000). A new child of Epic A appends after
	// A1 — between 2000 and 3000, NOT a spacing past A1, which would land past Epic B.
	expect(orderForTarget(ranked, { parent: epicA, peers: [pbiA1], insertIndex: 1 })).toEqual({ order: 2500 });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/writePlan.test.ts -t "running counter"`
Expected: FAIL — the counter resets per group, so the orders repeat.

- [ ] **Step 3: One counter down the DFS**

In `computeInitWrites`, hoist `maxOrder` out of `visit` and delete the per-group reset and rescan:

```ts
export function computeInitWrites(model: BacklogModel, settings: BacklogSettings): ItemWrite[] {
	const writes: ItemWrite[] = [];
	// ONE counter for the whole walk, not one per sibling group: `order` is a global
	// rank now, so a per-group reset would hand every first child the same number.
	// Seeded from the highest rank already in the vault so a backfill never lands on
	// top of a note that has one — it still fills blanks only, and never overwrites.
	let counter = model.ranked.reduce((max, item) => (item.order !== null && item.order > max ? item.order : max), 0);
	const visit = (siblings: BacklogItem[]) => {
		for (const item of siblings) {
			// Ancestors from outside the filter are context, not results — the backfill
			// must not write properties into notes the base excluded.
			if (item.outsideFilter) {
				visit(item.children);
				continue;
			}
			const write = initWriteFor(item, settings, () => (counter = Math.floor(counter) + ORDER_SPACING));
			if (write) writes.push(write);
			visit(item.children);
		}
	};
	visit(model.realRoots);
	return writes;
}
```

- [ ] **Step 4: Replace `endOfSiblingsOrder`**

Delete the function from `src/view/interactions/create.ts` and both call sites. At line ~194:

```ts
			order: placed.order,
```

with `placed` from the refusal guard shown below, and the same at line ~406 for the
iteration path. The helper, in the same file:

```ts
/**
 * The rank for a new note: appended among its parent's children, which under a global
 * rank means between the last of them and whatever follows in the ranked population —
 * NOT a spacing past the last child, which could land past a whole neighbouring
 * subtree.
 *
 * Returns the REFUSAL rather than a fallback. An empty vault needs no fallback —
 * `anchoredOrder([], null, …)` already answers `ORDER_SPACING` — so a refusal here
 * always means a real one: a spent gap, or a neighbour with no rank. Creating the note
 * at a default rank anyway would put it at a number that may already be taken and
 * nowhere near the slot the user asked for, which is worse than not creating it.
 */
function newItemOrder(host: BacklogViewHost, parentItem: BacklogItem | null): RankResult {
	const ranked = host.model?.ranked ?? [];
	const peers = parentItem ? parentItem.children : (host.model?.realRoots ?? []);
	return orderForTarget(ranked, { parent: parentItem, peers, insertIndex: peers.length });
}
```

Both call sites abort on a refusal and name its remedy, rather than creating the note:

```ts
	const placed = newItemOrder(host, parentItem);
	if ('refusal' in placed) {
		new Notice(placed.refusal === 'gapSpent' ? t('rank.gapSpent') : t('rank.unranked'));
		return;
	}
```

Note this reads as a ternary between two `t()` calls, which the `TEXT_TERNARY` lint rule
may refuse. If it does, lift it to a small helper returning the key — do not inline the
sentences.

- [ ] **Step 5: Check that a refused rank refuses the note**

```ts
it('does not create a note when the rank placement refuses', async () => {
	// A destination whose two neighbours have no gap left.
	await createChildOf(harness, 'Epic A');
	expect(harness.created).toEqual([]);
	expect(harness.notices).toContain(t('rank.gapSpent'));
});
```

A note created at a fallback rank is worse than no note: the rank may be taken, and it
is nowhere near the slot the user asked for.

- [ ] **Step 6: Run and watch pass**

Run: `npx vitest run test/domain/writePlan.test.ts test/view/create.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domain/writePlan.ts src/view/interactions/create.ts test/
git commit -m "feat: creation and backfill rank globally

computeInitWrites carries one counter down the DFS, seeded past the highest
rank in the vault; endOfSiblingsOrder is deleted and creation ranks through
orderForTarget like every other placement."
```

---

### Task 8: Seed and Respace, as pure plans

**Files:**
- Modify: `src/domain/writePlan.ts`
- Create: `test/domain/rankCommands.test.ts`

**Interfaces:**
- Consumes: `BacklogModel.ranked`, `BacklogModel.realRoots`.
- Produces:

```ts
export function computeSeedWrites(model: BacklogModel): ItemWrite[];
export function computeRespaceWrites(model: BacklogModel): ItemWrite[];
```

Both skip `outsideFilter` items and emit `{ file, order }` only.

- [ ] **Step 1: Write the failing tests**

Create `test/domain/rankCommands.test.ts`:

```ts
it('seeds in DFS preorder', () => {
	// Epic A > (F1, F2), Epic B. Ranks scrambled or absent.
	expect(computeSeedWrites(model).map((w) => [w.file.basename, w.order])).toEqual([
		['Epic A', 1000],
		['F1', 2000],
		['F2', 3000],
		['Epic B', 4000],
	]);
});

it('respaces in existing rank order, preserving every decision', () => {
	// F2 was ranked above F1 by hand: F2 = 1500, F1 = 2000.
	expect(computeRespaceWrites(model).map((w) => w.file.basename)).toEqual(['Epic A', 'F2', 'F1', 'Epic B']);
});

it('seed and respace are not interchangeable', () => {
	// The same model carrying a cross-parent ranking decision.
	const seeded = computeSeedWrites(model).map((w) => w.file.basename);
	const respaced = computeRespaceWrites(model).map((w) => w.file.basename);
	expect(respaced).not.toEqual(seeded);
});

it('never writes to a note the Base excluded', () => {
	const files = [...computeSeedWrites(model), ...computeRespaceWrites(model)].map((w) => w.file.path);
	expect(files).not.toContain('Excluded Epic.md');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/rankCommands.test.ts`
Expected: FAIL — neither function is exported.

- [ ] **Step 3: Write both**

```ts
/**
 * The migration, correct exactly ONCE: the hierarchy written into numbers, DFS
 * preorder. Its "nothing visible moves" promise holds only on a vault that has never
 * carried a global rank, because there the hierarchy IS the order on screen. Run after
 * anyone has ranked across parents it discards every one of those decisions, which is
 * why it is a separate command from `computeRespaceWrites` and says so in its dialog.
 */
export function computeSeedWrites(model: BacklogModel): ItemWrite[] {
	const writes: ItemWrite[] = [];
	let counter = 0;
	const visit = (items: BacklogItem[]) => {
		for (const item of items) {
			// Context rows are never written; their branch is still walked, because
			// results hang below them.
			if (!item.outsideFilter) {
				counter += ORDER_SPACING;
				writes.push({ file: item.file, order: counter });
			}
			visit(item.children);
		}
	};
	visit(model.realRoots);
	return writes;
}

/**
 * The repair, correct any number of times: the order already on screen, respaced. It
 * preserves every ranking decision, which is what makes it the answer to a spent gap
 * and to a tie — and what makes it, not the seed, the one an implementer reaches for.
 *
 * Over the WHOLE loaded population, never the focused slice: respacing one rung and
 * leaving every other rank where it was is not a repair.
 */
export function computeRespaceWrites(model: BacklogModel): ItemWrite[] {
	let counter = 0;
	return model.ranked
		.filter((item) => !item.outsideFilter)
		.map((item) => ({ file: item.file, order: (counter += ORDER_SPACING) }));
}
```

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run test/domain/rankCommands.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
git add src/domain/writePlan.ts test/domain/rankCommands.test.ts
git commit -m "feat(domain): seed and respace write plans

Two operations that cannot be derived from each other — on a legacy vault the
ranked order is ties, on a ranked vault DFS preorder is not the user's order.
Checked as not interchangeable so a later simplification cannot merge them."
```

---

### Task 9: The two commands

**Files:**
- Create: `src/commands/rank.ts`
- Modify: `src/main.ts`, `src/view/registry.ts`, `src/view/registerBacklogView.ts`, `src/i18n/en.ts`

**Interfaces:**
- Consumes: `computeSeedWrites`, `computeRespaceWrites` from Task 8; `activeBacklogView` from `src/view/registry.ts`; `confirmDialog` from `src/ui/confirmDialog.ts`.
- Produces:

```ts
// src/commands/rank.ts
export const SEED_RANKS_COMMAND_ID = 'seed-ranks';
export const RESPACE_RANKS_COMMAND_ID = 'respace-ranks';
export function seedRanksCommand(app: App, checking: boolean): boolean;
export function respaceRanksCommand(app: App, checking: boolean): boolean;

// src/view/registry.ts — LiveBacklogView gains:
readonly applySafely: (writes: ItemWrite[]) => Promise<WriteOutcome | null>;
```

- [ ] **Step 1: Add the catalog keys**

In `src/i18n/en.ts`, beside the existing `command.*` keys (line ~1270):

```ts
	'command.seedRanks': 'Seed ranks from the hierarchy',
	'command.respaceRanks': 'Respace ranks',
	'rank.seedConfirm':
		'Rank {count} notes in the order they appear in the tree. This replaces every existing rank, including any order set by hand at a focus level. On a filtered base only the notes this base returns are ranked, so they may move relative to notes it excludes.',
	'rank.respaceConfirm':
		'Rewrite the ranks of {count} notes with even spacing, keeping the order they are in now. On a filtered base only the notes this base returns are respaced, so they may move relative to notes it excludes.',
	'rank.done': 'Ranked {count} notes',
	'rank.gapSpent': 'No room left between those two items. Run "Respace ranks" from the command palette.',
	'rank.unranked': 'That item has no rank yet. Use the toolbar’s set-up button to fill in the missing ones.',
```

The last two are the two refusals from Task 4. Wire them where `performDrop` receives an
empty write list: ask **`dropPlacement(dragged, target, host.model.ranked)`** — the
planner's own function, not `orderForTarget` beside it — for the reason, and show
`t('rank.gapSpent')` or `t('rank.unranked')` accordingly. Calling `orderForTarget`
directly here would skip the dragged-row filter and could report a number where the
planner refused, leaving a drop that does nothing and says nothing. Add a check for each — a drop on
a spent gap names Respace, a drop beside an unranked note names the set-up button — because
a notice naming the wrong remedy is advice that does not work, and no type would catch it.

- [ ] **Step 2: Publish `applySafely` on the live view**

In `src/view/registry.ts`, add to `LiveBacklogView`:

```ts
	/** The gated write path, so a palette command writes through the same three
	 *  refusals every drop does rather than reaching the vault directly. */
	readonly applySafely: (writes: ItemWrite[]) => Promise<WriteOutcome | null>;
```

Satisfy it where the view is registered (`rememberBacklogView`), delegating to the view's existing gate.

- [ ] **Step 3: Write the commands**

Create `src/commands/rank.ts`:

```ts
import { App, Notice } from 'obsidian';
import { t } from '../i18n/t';
import { computeRespaceWrites, computeSeedWrites, ItemWrite } from '../domain/writePlan';
import { BacklogModel } from '../domain/model';
import { confirmDialog } from '../ui/confirmDialog';
import { activeBacklogView, LiveBacklogView } from '../view/registry';

/**
 * Ids beside the flows they run — persisted in the user's hotkeys, so renaming one
 * silently unbinds whatever they had.
 */
export const SEED_RANKS_COMMAND_ID = 'seed-ranks';
export const RESPACE_RANKS_COMMAND_ID = 'respace-ranks';

/**
 * The two look similar and must never be confused. **Seed** writes the hierarchy into
 * numbers and is correct exactly once; run a second time it discards every rank set by
 * hand at a focus level. **Respace** keeps the order already on screen. Neither can be
 * derived from the other, and a single command guessing between them by inspecting the
 * data is the kind of cleverness that gets decoded at 3am.
 */
function runRank(app: App, plan: (model: BacklogModel) => ItemWrite[], title: string, message: string): void {
	const view = activeBacklogView(app);
	if (view === null || view.model === null) return;
	// The count in the dialog is from the model NOW, because the dialog has to say a
	// number before the user answers.
	const preview = plan(view.model);
	confirmDialog(app, {
		title,
		message: message.replace('{count}', String(preview.length)),
		cta: title,
		onConfirm: () => {
			void (async () => {
				// **Re-resolved, not the captured view.** `BacklogView.onunload` calls
				// `forgetBacklogView` and disposes the gate but leaves `model` NON-NULL,
				// so a view closed while the dialog was open still answers with a
				// snapshot that stopped refreshing. Asking the registry again is the
				// only thing that can tell a live view from a disposed one.
				const live = activeBacklogView(app);
				if (live === null || live.model === null) return;
				// **Recomputed, never the previewed batch.** These commands rewrite the
				// rank of EVERY note, and the dialog can stay open across a vault sync,
				// a write from another view, or another plugin. Applying the captured
				// batch would silently overwrite every ranking change made in between —
				// `applySafely` serializes and gates, but it does not check a planned
				// value against what the note now holds. The count may differ from the
				// one the dialog showed; the notice reports what was actually written.
				const writes = plan(live.model);
				const outcome = await live.applySafely(writes);
				if (outcome) new Notice(t('rank.done', { count: writes.length }));
			})();
		},
	});
}
```

Then the two `checkCallback` bodies, in `writeBacklogReadmeCommand`'s shape: return `false` while `view === null || view.model === null`, otherwise run and return `true`.

Note the fallow gotcha: annotate the local (`const live: LiveBacklogView = view`) so `applySafely` resolves as a used interface member rather than reporting dead.

Use `t('rank.seedConfirm', { count })` properly through the catalog's parameter typing rather than the `String.replace` sketch above — read `src/i18n/t.ts` for the exact call shape and use it.

- [ ] **Step 4: Register them**

In `src/main.ts`, beside the two existing `addCommand` calls:

```ts
		this.addCommand({
			id: SEED_RANKS_COMMAND_ID,
			name: t('command.seedRanks'),
			checkCallback: (checking) => seedRanksCommand(this.app, checking),
		});
		this.addCommand({
			id: RESPACE_RANKS_COMMAND_ID,
			name: t('command.respaceRanks'),
			checkCallback: (checking) => respaceRanksCommand(this.app, checking),
		});
```

- [ ] **Step 5: Check the recompute**

```ts
it('writes nothing when the view was closed while the dialog was open', async () => {
	const dialog = openRespaceDialog(harness);
	harness.closeView();
	dialog.confirm();
	expect(harness.writes).toEqual([]);
});

it('ranks the model as it is on confirm, not as it was when the dialog opened', async () => {
	const dialog = openRespaceDialog(harness);
	await harness.addNote('Late Epic.md', { type: 'Epic', order: 500 });
	dialog.confirm();
	expect(harness.writes.map((w) => w.path)).toContain('Late Epic.md');
});
```

These commands rewrite every note's rank, so a stale batch is a data-loss shape rather
than a stale count.

- [ ] **Step 6: Add the command to the context-row suite**

`test/view/contextRowWrites.test.ts` drives every write entry point against a fixture with context rows. Add both commands as entry points and confirm neither writes to an `outsideFilter` note. The rule stays checked at the forbidden thing (the `applySafely` spy), not by listing paths.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: PASS. Lint will flag any bare string that should be a catalog key, and fallow will flag `applySafely` if the local is not annotated.

- [ ] **Step 8: Commit**

```bash
git add src/commands/rank.ts src/main.ts src/view/registry.ts src/view/registerBacklogView.ts src/i18n/en.ts test/view/contextRowWrites.test.ts
git commit -m "feat(commands): seed and respace ranks

Two palette commands, named apart because they look similar and must never be
confused. Both confirm with their count, write through applySafely, and join
the entry points the context-row suite drives."
```

---

### Task 10: The register

**Files:**
- Create: `docs/adrs/<next-number> Order is a global rank.md`, `docs/requirements/Ranking at the focused level.md`
- Modify: `docs/requirements/Sibling ranking.md`, `docs/requirements/Focus level.md`, `src/domain/CLAUDE.md`, `docs/issues/Duplicate orders in a partially filtered group.md`, `docs/issues/Board order is derived not stored.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: every task above.
- Produces: nothing in code. `docs-check.mjs` rule 7 requires `src/commands/rank.ts` to be *specified* in a use case's `## Where it lives` or an ADR's `## Decision` — without it `npm run check` fails.

- [ ] **Step 1: Read the register's own rules**

Read `docs/README.md` and the ADR frontmatter of the most recent ADR. Pick the next ADR number by listing `docs/adrs/`.

- [ ] **Step 2: Write the ADR**

`docs/adrs/<n> Order is a global rank.md` — the decision, the alternative refused (a second `rank` property, the `kanban_order` failure), and the consequence stated plainly: a focus-level rank moves the item among its own siblings too. Its `## Decision` names `src/commands/rank.ts`.

- [ ] **Step 3: Write the PBI**

`docs/requirements/Ranking at the focused level.md`, `parent: "[[Reordering and reparenting]]"`, in the use-case shape `docs-check.mjs` enforces. Its `## Where it lives` names `src/commands/rank.ts`, `src/domain/writePlan.ts` (`anchoredOrder`, `orderForTarget`, `computeSeedWrites`, `computeRespaceWrites`), `src/domain/dropTargets.ts`, `src/view/interactions/structure.ts`, and the new tests.

- [ ] **Step 4: Edit the four existing notes**

- `Sibling ranking.md` — extension 1a deleted, 2a becomes a refusal, the guarantee restated over peers rather than siblings.
- `Focus level.md` — 3a now refuses indent and outdent only.
- `src/domain/CLAUDE.md` — the sibling-scope sentence, the three-lists paragraph (a fourth list now: `ranked`), the `MIN_GAP` bullet, and the Cost section's two named sorts.
- `docs/issues/Duplicate orders in a partially filtered group.md` — the impact section's "renumbers itself on the next renumbering drop" is gone; **Respace ranks** replaces it, and *not* Seed.
- `docs/issues/Board order is derived not stored.md` — a shared rank now exists, so in-column ranking became possible and is deliberately not taken. The issue stays open with its premise corrected.

- [ ] **Step 5: Add the changelog entry**

Under `## [Unreleased]` in `CHANGELOG.md`, an `### Added` line for focus-level ranking and the two commands, and a `### Changed` line for `order` becoming global with the spacing change.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: PASS, all five steps, including `docs-check.mjs`.

- [ ] **Step 7: Commit**

```bash
git add docs/ src/domain/CLAUDE.md CHANGELOG.md
git commit -m "docs: register the global rank

New ADR and PBI; Sibling ranking, Focus level, the domain guide and both
order issues corrected. The duplicate-orders note's self-correction was the
renumber, so it names Respace instead."
```

---

## What cannot be verified here

Obsidian does not run in this repository. Before this is called done:

- `npm run test-build`, then open this repository as a vault and check both commands on `docs/Product Backlog.base` — the plugin displaying its own register.
- Confirm the confirm dialogs read correctly and that Seed's warning is unmissable.
- Confirm a focus-level drag feels right, and that the two refusal notices name remedies a user can act on.

Say so honestly in the pull request rather than claiming a live check that was not run.
