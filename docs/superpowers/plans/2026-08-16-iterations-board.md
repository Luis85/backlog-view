# Iterations board implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give board mode a scope picker that shows one iteration's work in three columns over the product workflow, and let iterations be created and edited from that picker.

**Architecture:** The iteration board is **its own `Projection` value** with the chosen iteration's path stored beside it, so "am I an iteration board" is a question `src/view/projection.ts` answers rather than a comparison repeated at call sites. Its columns are not a `Workflow` instance: it reads `settings.stateKey` directly and buckets that one vocabulary into Open / In Progress / Resolved. A move reuses the product board's planner, behind one host method that asks the bucket question first.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (floor 1.12.0), esbuild, vitest + jsdom, ESLint with per-directory `no-restricted-imports`.

## Prerequisite

**`docs/superpowers/plans/2026-08-16-iterations-foundation.md` must be complete.** This plan consumes `ITERATION_TYPE`, `isIterationType`, `settings.iterationKey`, `settings.iterationGoalKey`, `BacklogItem.iterationEntry`, `BacklogItem.iterationGoalValue`, `ItemWrite.iterationGoal` and `computeIterationWrites` from it. Nothing here is buildable without them.

## Scope

From `docs/superpowers/specs/2026-08-15-iterations-design.md`: §3 (the scope), §4 (population and columns), §5 (the three buckets), §6 (moves), §7 (empty states and the goal line), §10 (creating and editing). It closes `A board scoped to one iteration.md` (order 20) and `Creating an iteration from the board.md` (order 25).

Not here: §8, `An iteration draws as a bar or a line` — independent, touches the roadmap's placement path, its own plan.

## Read this before Task 4

An earlier revision of the design made the iteration board a **scope field** consulted at call sites, keeping `host.projection === 'board'`. Seven review rounds then found seven separate functions that answer for the product board while an iteration is chosen — `filterScopeFor`, `countedPopulation`, `hideCompleted`, the columns dispatch, the `Set state` gate, its checkmark planner, `byProjectionType` — each found one at a time, each fix correct and one case short of the next.

`src/view/projection.ts` predicted it in the file itself: *"A projection added beside `'tree'` rather than **as** a tree fails each of those gates silently and differently."* As a projection, `Record<Projection, …>` fails to compile until every question has an answer — an instrument that can see the whole set, rather than a review round per member of it.

**This does not change the control.** The toolbar still shows one `Board` position and a scope picker. What it changes is where the question is asked.

## Global Constraints

Identical to the foundation plan's — reproduced so this file stands alone.

- **Definition of done is `npm run check`** — build, lint, coverage-thresholded tests, fallow, docs register. Coverage thresholds only ever go up.
- **Layers:** `main → commands → view → storage → domain`, each may reach anything below and nothing above. `ui/` is a leaf; `i18n/` is a leaf one level lower.
- **400-line max per `src/` file**, function 100, complexity 16, depth 4, params 5 — all skipping blanks and comments. `test/**` budget is 450.
- **Never write frontmatter outside `src/storage/frontmatter.ts`.** `processFrontMatter`, `vault.create` and `load/saveLocalStorage` are banned outside `storage/`.
- **Every write path goes through the `configProblems` gate**; forward batches are refused whole if any write targets an `outsideFilter` item.
- **Every view-option key must be named in `docs/requirements/`** in a code span. `iterationOpenStates`, `iterationResolvedStates` and `iterationLengthDays` already are.
- **`docs-check.mjs` checks both directions, and they close on each other.** A module in `src/` that no note names fails rule 7; a path named in a current note that does not exist fails the reference check. So the exact path goes into a note's `## Where it lives` **in the same commit as the file it names** — never before, never after. This plan adds two modules, `src/ui/iterationDialog.ts` (Task 8) and `src/domain/iterations.ts` (Task 8), and `Creating an iteration from the board.md` describes both **without spelling either**, precisely so the register is green today. Task 8 writes the two paths in.
- **Sentence-case UI text**, `setCssProps` over inline styles, `normalizePath` on user paths, no global `app`.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.**
- The stylesheet is one partial per concern under `styles/`; `styles.css` is generated.

## File structure

| File | Change |
| --- | --- |
| `src/domain/viewOptions.ts` | `iterationOpenStates`, `iterationResolvedStates`, `iterationLengthDays` in `iterationsGroup()` |
| `src/domain/settings.ts` | the three resolved fields |
| `src/domain/board.ts` | `IterationBucket`, `bucketOf`, `bucketRepresentative`, `iterationBuckets` |
| `src/domain/model.ts` | `iterationResults(path)` |
| `src/domain/iterations.ts` | **new** — the previous-iteration rule and the two date sums |
| `src/view/host.ts` | `Projection` gains `'iteration'`; `boardScope` / `setBoardScope` |
| `src/storage/viewStateStore.ts` | `scope` in `ViewPrefs` + `PREF_READERS`; the rename walk reaches it |
| `src/view/projection.ts` | every projection question answered for `'iteration'`; `toolbarPosition` |
| `src/view/viewStateController.ts` | the `PROJECTION_MODE` row, `boardScope()` / `setBoardScope()` |
| `src/view/render/toolbarControls.ts` | `renderBoardScopePicker`, and its two action entries |
| `src/view/render/toolbarStatus.ts` | `countedPopulation` gains its case |
| `src/view/render/board.ts` | the three-bucket board and the goal line |
| `src/view/render/emptyStates.ts` | the two empty states |
| `src/view/cardMoves.ts` | `performIterationBoardMove` |
| `src/view/interactions/cardDrag.ts` | `announceBoardMove` asks the bucket question |
| `src/ui/iterationDialog.ts` | **new** — the create/edit modal |
| `src/domain/writePlan.ts` | `computeIterationNoteWrites` (the edit) |
| `styles/board.css` | the goal line |

---

### Task 1: The two bucket lists and the default length

**Files:**
- Modify: `src/domain/viewOptions.ts`, `src/domain/settings.ts`
- Test: `test/domain/settings.test.ts`

**Interfaces:**
- Produces: `settings.iterationOpenStates: string[]`, `settings.iterationResolvedStates: string[]`, `settings.iterationLengthDays: number`.

**Bases has no number option.** `iterationLengthDays` is a `text` option parsed to a whole number, the way the WIP limits already are, and a value that is unset, unparseable or **not positive** falls back to **14**. That is not politeness: a zero or negative length produces a target before its start, which shelves the iteration with the reversed-span reason for a value the user never meant to type.

- [ ] **Step 1: Write the failing test**

```ts
it('parses the iteration length, falling back to 14 on anything unusable', () => {
	expect(resolveSettings(fakeConfig({ iterationLengthDays: '21' })).iterationLengthDays).toBe(21);
	for (const bad of ['', 'two weeks', '0', '-3', '7.5']) {
		expect(resolveSettings(fakeConfig({ iterationLengthDays: bad })).iterationLengthDays).toBe(14);
	}
});

it('reads the two bucket lists, defaulting both to empty', () => {
	const s = resolveSettings(fakeConfig({ iterationOpenStates: 'New, Ready', iterationResolvedStates: 'In review' }));
	expect(s.iterationOpenStates).toEqual(['New', 'Ready']);
	expect(s.iterationResolvedStates).toEqual(['In review']);
	expect(resolveSettings(fakeConfig({})).iterationOpenStates).toEqual([]);
});
```

`7.5` is in the list deliberately: a fractional length is not a number of days, and rounding it silently would be a decision the user cannot see.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/domain/settings.test.ts`
Expected: FAIL — the three fields do not exist.

- [ ] **Step 3: Add the three options**

In `iterationsGroup()` (created by the foundation plan), after the two property options:

```ts
			{
				type: 'text',
				key: 'iterationOpenStates',
				displayName: 'Product states an iteration has not started',
				default: '',
				placeholder: 'New, Ready',
			},
			{
				type: 'text',
				key: 'iterationResolvedStates',
				displayName: 'Product states an iteration is finished with',
				default: '',
				placeholder: 'In review, Done',
			},
			{
				type: 'text',
				key: 'iterationLengthDays',
				displayName: 'Default iteration length in days',
				default: String(DEFAULT_ITERATION_DAYS),
				placeholder: String(DEFAULT_ITERATION_DAYS),
			},
```

- [ ] **Step 4: Resolve them**

In `src/domain/settings.ts`, the two lists parse the way `deliverableStateValues` does. The length:

```ts
export const DEFAULT_ITERATION_DAYS = 14;

/**
 * A whole, positive number of days, or the shipped default. Bases has no number option,
 * so this parses text a user can put anything in — and the fallback is load-bearing
 * rather than polite: zero or a negative length yields a target before its start, which
 * shelves the iteration with the reversed-span reason for a value nobody meant to enter.
 * A fraction is refused too: half a day is not a number of days, and rounding it would be
 * a decision the reader cannot see.
 */
function resolveIterationDays(raw: string): number {
	const n = Number(raw.trim());
	return Number.isInteger(n) && n > 0 ? n : DEFAULT_ITERATION_DAYS;
}
```

- [ ] **Step 5: Run and watch it pass; commit**

```bash
npx vitest run test/domain/settings.test.ts
git add src/domain test/domain && git commit -m "Configure the two bucket lists and the default iteration length"
```

---

### Task 2: The three buckets

**Files:**
- Modify: `src/domain/board.ts`
- Test: `test/domain/iterationBuckets.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's three settings fields.
- Produces:
  ```ts
  export type IterationBucket = 'open' | 'inProgress' | 'resolved';
  export function bucketOf(state: string | null, settings: BacklogSettings): IterationBucket;
  export function bucketRepresentative(bucket: IterationBucket, settings: BacklogSettings): string | null | undefined;
  export function iterationBuckets(population: BacklogItem[], settings: BacklogSettings): BoardModel;
  ```
  `bucketRepresentative` returns the state string to write, `null` for Open's key removal, and **`undefined` when the bucket takes no drop**. Tasks 5 and 6 depend on all three spellings.

**Four rules, and each needs its own case:**

1. **Precedence.** Resolved wins. `doneValues` are folded into Resolved whether or not `iterationResolvedStates` names them — an item the product calls finished can never be drawn as still in progress.
2. **The representative is asked of the reading, never of the list.** *A bucket's representative is the first state the bucket rule itself places in that bucket.* Only Open can break this today, and it takes a state named in `iterationOpenStates` that is also a done value or a resolved state; written naively, a drop on Open would write it and redraw the card in Resolved.
3. **No stray columns.** With a fixed three, every value has a home. `outsideWorkflow` is never set here.
4. **Counts come from the population, not the model.**

**The key is read directly.** `settings.stateKey`, not `stateKeyFor` — that function dispatches on the item and would hand a `Deliverable` the Deliverables key, giving one board two vocabularies.

- [ ] **Step 1: Write the failing tests**

Create `test/domain/iterationBuckets.test.ts`:

```ts
const settings = settingsWith({
	stateKey: 'status',
	stateValues: ['New', 'Ready', 'Doing', 'In review', 'Done'],
	doneValues: ['Done'],
	iterationOpenStates: ['New', 'Ready'],
	iterationResolvedStates: ['In review'],
});

describe('bucketOf', () => {
	it('puts every declared state and the no-state case in exactly one bucket', () => {
		const seen = ['New', 'Ready', 'Doing', 'In review', 'Done', null].map((s) => bucketOf(s, settings));
		expect(seen).toEqual(['open', 'open', 'inProgress', 'resolved', 'resolved', 'open']);
	});

	it('folds the product done values into Resolved without the list naming them', () => {
		expect(bucketOf('Done', settingsWith({ ...settings, iterationResolvedStates: [] }))).toBe('resolved');
	});

	it('gives Resolved precedence over Open for a state in both lists', () => {
		const both = settingsWith({ ...settings, iterationOpenStates: ['New'], iterationResolvedStates: ['New'] });
		expect(bucketOf('New', both)).toBe('resolved');
	});

	it('reads a state neither list names as In Progress, minting no column for it', () => {
		expect(bucketOf('Blocked', settings)).toBe('inProgress');
	});
});

describe('bucketRepresentative', () => {
	it('answers the first state that reads back into its own bucket', () => {
		expect(bucketRepresentative('open', settings)).toBe('New');
		expect(bucketRepresentative('inProgress', settings)).toBe('Doing');
		expect(bucketRepresentative('resolved', settings)).toBe('In review');
	});

	it('skips an open state that the precedence rule routes to Resolved', () => {
		const trap = settingsWith({ ...settings, iterationOpenStates: ['Done', 'Ready'] });
		expect(bucketRepresentative('open', trap)).toBe('Ready');
	});

	it('falls Open back to a key removal when no entry survives', () => {
		const trap = settingsWith({ ...settings, iterationOpenStates: ['Done'] });
		expect(bucketRepresentative('open', trap)).toBeNull();
	});

	it('answers undefined — no drop — for the other two when they have nothing to write', () => {
		const all = settingsWith({ ...settings, iterationOpenStates: ['New', 'Ready', 'Doing'], iterationResolvedStates: [], doneValues: [] });
		expect(bucketRepresentative('inProgress', all)).toBeUndefined();
		expect(bucketRepresentative('resolved', all)).toBeUndefined();
	});

	it('falls Resolved back to the first done value with no list set', () => {
		expect(bucketRepresentative('resolved', settingsWith({ ...settings, iterationResolvedStates: [] }))).toBe('Done');
	});
});

describe('iterationBuckets', () => {
	it('draws exactly three columns, marks Resolved done, and mints no stray', () => {
		const board = iterationBuckets(cards(['New', 'Blocked', 'Done']), settings);
		expect(board.columns.map((c) => c.label)).toEqual(['Open', 'In Progress', 'Resolved']);
		expect(board.columns.map((c) => c.done)).toEqual([false, false, true]);
		expect(board.columns.some((c) => c.outsideWorkflow)).toBe(false);
	});

	it('counts only the population it was handed', () => {
		const board = iterationBuckets(cards(['New']), settings);
		expect(board.cardCount).toBe(1);
	});

	it('never counts a context card', () => {
		const board = iterationBuckets([...cards(['New']), contextCard('Ready')], settings);
		expect(board.columns[0].count).toBe(1);
	});
});
```

- [ ] **Step 2: Run and watch every one fail**

Run: `npx vitest run test/domain/iterationBuckets.test.ts`
Expected: FAIL — nothing is exported.

- [ ] **Step 3: Implement the reading and the representative**

```ts
/**
 * Which of the three columns a product state reads into. The precedence is stated once,
 * here, because a value read by two membership tests is a value two call sites will
 * eventually disagree about: RESOLVED wins, and the product's own done values are folded
 * into it whether or not `iterationResolvedStates` names them — an item the product calls
 * finished can never be drawn as still in progress.
 */
export function bucketOf(state: string | null, settings: BacklogSettings): IterationBucket {
	if (state === null) return 'open';
	if (settings.iterationResolvedStates.some((v) => sameValue(v, state))) return 'resolved';
	if (settings.doneValues.some((v) => sameValue(v, state))) return 'resolved';
	if (settings.iterationOpenStates.some((v) => sameValue(v, state))) return 'open';
	return 'inProgress';
}

/**
 * What a drop on a bucket writes: the first state THE BUCKET RULE ITSELF places there.
 *
 * Asked of the reading and never of the list, which is the whole rule. `iterationOpenStates`
 * can legitimately name a state the precedence above routes to Resolved, and writing it
 * would land the card in a column it was not dropped on — the board appearing to disobey
 * the gesture, which is worse than a refusal. Only Open can break it today; the rule is
 * general because the next configuration to expose it is the one nobody thought of.
 *
 * Three answers, and the third is not an error: a state to write, `null` for Open's key
 * removal, and `undefined` for a bucket that takes NO DROP.
 */
export function bucketRepresentative(bucket: IterationBucket, settings: BacklogSettings): string | null | undefined {
	const from = (list: string[]) => list.find((v) => bucketOf(v, settings) === bucket);
	if (bucket === 'open') return from(settings.iterationOpenStates) ?? null;
	if (bucket === 'resolved') return from(settings.iterationResolvedStates) ?? from(settings.doneValues);
	return from(settings.stateValues);
}
```

- [ ] **Step 4: Build the board model**

`iterationBuckets(population, settings)` reads each card's state off `settings.stateKey` **directly**, buckets it, and fills the same `BoardColumn` shape the product board uses — `state` from `bucketRepresentative`, `done: bucket === 'resolved'`, `outsideWorkflow: false`, `limit: null`, and `count`/`fullCount`/`held`/`openWork` measured the way `requirementsWorkflow` measures them, over the handed population.

- [ ] **Step 5: Run and watch them pass**

Run: `npx vitest run test/domain/iterationBuckets.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch the representative rule earn its test**

Replace `bucketRepresentative`'s Open branch with the naive `settings.iterationOpenStates[0] ?? null`. Run. Exactly two tests must go red — "skips an open state that the precedence rule routes to Resolved" and "falls Open back to a key removal". Restore.

- [ ] **Step 7: Commit**

```bash
git add src/domain/board.ts test/domain/iterationBuckets.test.ts
git commit -m "Narrow the product workflow into three buckets"
```

---

### Task 3: The population

**Files:**
- Modify: `src/domain/model.ts`
- Test: `test/domain/iterationModel.test.ts` (create)

**Interfaces:**
- Produces: `iterationResults(model, path): BacklogItem[]` — the carriers, plus the excluded ancestors needed to place them.

**Candidates are not population**, and the distinction is the task. An in-scope carrier hanging from an excluded ancestor needs that ancestor drawn to be placed at all, so the board is built from carriers **plus** their excluded ancestors — while the carriers **alone** are what is counted, what may be written to, and what supplies nothing else.

Four refusals: no descendant by inheritance (nothing is inherited down the tree); no catalog member (`inProjection` answers first, and *no needle makes a `Test case` a row of the plan*); no `Iteration` note, whatever its own frontmatter says; and `Deliverable` **is** included, with no type filter at all.

- [ ] **Step 1: Write the failing tests**

```ts
it('cards the carriers and nobody else', () => { /* a child without its own link is absent */ });
it('includes a Deliverable that names the iteration', () => { /* … */ });
it('excludes a catalog member that names it', () => { /* … */ });
it('refuses an Iteration note that names another iteration', () => { /* hand-written key */ });
it('draws an excluded ancestor as placement, and does not count it', () => { /* … */ });
it('draws no ancestor for a match in a DIFFERENT iteration', () => {
	// The membership question is asked INSIDE the recursion. Scoping the walk's output
	// instead would let a Sprint 13 match keep an ancestor on Sprint 12's board and
	// swallow its "nothing matches" advisory.
});
```

- [ ] **Step 2: Run, watch them fail, implement, watch them pass**

Run: `npx vitest run test/domain/iterationModel.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/domain/model.ts test/domain/iterationModel.test.ts
git commit -m "Card an iteration's carriers, and the ancestors that place them"
```

---

### Task 4: `'iteration'` becomes a projection

**Files:**
- Modify: `src/view/host.ts`, `src/view/projection.ts`, `src/view/viewStateController.ts`, `src/storage/viewStateStore.ts`, `src/view/render/toolbarStatus.ts`
- Test: `test/storage/viewStateStore.test.ts`, `test/view/iterationBoard.test.ts` (create)

**Interfaces:**
- Produces: `Projection` gains `'iteration'`; `toolbarPosition(projection): Projection`; `host.boardScope: string | null` and `host.setBoardScope(path: string | null): void`; `ViewPrefs.scope?: string`.

**The compiler is the instrument.** Adding `'iteration'` to `Projection` breaks every `Record<Projection, …>` until each question has an answer. Do **not** silence one with a default case; the point is being asked.

**The split has a price and it falls on the toolbar.** Two controls compare the projection to a *position* — `renderProjectionZone`'s switch, and the toggle's `is-active` / `aria-pressed`. Both are wrong once the internal identity and the control identity differ: the picker would delete itself on first use, and no position would render pressed. `toolbarPosition` answers `'board'` for `'iteration'`, and both controls ask it.

**The stored scope is a PATH**, which makes it the first `ViewPrefs` field the vault owns. Two consequences, and half of them is not an option: `ViewPrefs`' own comment (*"keyed by nothing the vault owns, so never pruned and never renamed"*) must be amended to name this exception, and the rename walk must reach it, matching the path **or its `oldPath/` prefix** so a folder rename counts.

- [ ] **Step 1: Write the failing tests**

```ts
it('returns the reader to the iteration they left, through Tree and back', () => {
	// Driven through the INTERACTION. A test that renders the chosen scope directly
	// passes while the round trip is broken.
});
it('renders the Board position pressed, and keeps the picker, on an iteration scope', () => { /* 1c, 1d */ });
it('reads the whole view as Product when the stored path names no Iteration', () => {
	// Cards, count, completed toggle, offered types and filter index alike — resolved
	// ONCE, upstream. Resolving it only where content is drawn leaves every other gate
	// answering as an iteration board.
});
it('retains the stale stored path rather than rewriting it', () => { /* 2a */ });
it('carries the stored scope through a rename of the note, and of a folder above it', () => { /* 2e */ });
it('rebuilds the filter index when the scope changes', () => { /* 2c */ });
```

- [ ] **Step 2: Run, watch them fail**

Run: `npx vitest run test/view/iterationBoard.test.ts test/storage/viewStateStore.test.ts`

- [ ] **Step 3: Add the projection and answer every question**

Add `'iteration'` to `Projection`, then let the compiler walk you through `projection.ts`: `treeShaped` false, `hidesCompleted` **false**, `hasRollup` false, `projectionPopulation` → Task 3's carriers, `projectionMember` → `!inCatalog`, `filterScopeFor` → `'whole'`, `offerableTypes` → `Deliverable` yes and `Iteration` no. Add `toolbarPosition`.

`filterScopeFor` is the one that takes argument: the population ignores the focus, so the match index must too, or the promise holds for the cards and breaks for the search.

- [ ] **Step 4: Store the scope**

`ViewPrefs.scope?: string` with a `PREF_READERS` row, the amended comment, and the rename walk reaching `prefs.scope`. The stored **mode** does not distinguish the two boards — the scope does, and choosing `Product` clears it. Two values that cannot contradict each other need no guard on any route in.

- [ ] **Step 5: Count this scope's carriers**

`countedPopulation` in `toolbarStatus.ts` gains its case. It is one function precisely so the count label and the completed toggle's "(N hidden)" cannot disagree.

- [ ] **Step 6: Run, watch them pass, then break `toolbarPosition` on purpose**

Make `toolbarPosition` return the projection unchanged. The "keeps the picker" and "renders pressed" tests must go red. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/view src/storage test/
git commit -m "Make the iteration board a projection, and store its scope as a path"
```

---

### Task 5: The scope picker

**Files:**
- Modify: `src/view/render/toolbarControls.ts`
- Test: `test/view/iterationBoard.test.ts`

**Two conditions, both required**: the iteration property is configured **and** at least one `Iteration` note is in the model. With no notes there is nothing to choose between — the refusal `renderAxisPicker` already makes for a single configured axis. With no property, every entry would draw an empty board.

Colliding basenames are qualified, **and only where they collide**.

- [ ] Steps follow Task 4's shape: write the tests (renders / does not render under each condition, names collisions apart, the value is the note not the label), watch them fail, build `renderBoardScopePicker` beside `renderAxisPicker`, watch them pass, commit.

---

### Task 6: Moves, and the guard that a bucket is not a state

**Files:**
- Modify: `src/view/cardMoves.ts`, `src/view/interactions/cardDrag.ts`
- Test: `test/view/contextCardWrites.test.ts`, `test/view/iterationBoard.test.ts`

**Interfaces:**
- Consumes: `bucketOf`, `bucketRepresentative` (Task 2).
- Produces: `host.performIterationBoardMove(item: BacklogItem, bucket: IterationBucket): Promise<boolean>`.

**Two sites break if the bucket question is not asked, and they break differently.**

- `computeStateWrites` compares `sameValue(item.stateValue, state)` — the **exact** state. A card in `Ready` dropped on Open whose representative is `Todo` is a change by that test and gets rewritten, restating the user's own state and spending the undo slot.
- `announceBoardMove` reaches `columnLabelFor(board, from)`, which matches a column by exact state too. Handed `Ready` against a bucket carrying only `Todo`, it finds nothing — a correct move announced from a column the board does not name.

One function, asked twice. `performIterationBoardMove` asks it first, returns having written nothing when the card is already in the target bucket, and otherwise delegates to `performBoardMove`.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes nothing when the card is already in the target bucket', async () => {
	// `Ready` and `New` both read as Open; dropping Ready on Open must not write `New`.
	await host.performIterationBoardMove(cardInState('Ready'), 'open');
	expect(writes).toEqual([]);
});
it('writes the bucket representative when the bucket changes', async () => { /* … */ });
it('announces the bucket it came from, not a column matched by exact state', async () => { /* … */ });
it('refuses a drop on a bucket with nothing to write', async () => { /* … */ });
it('removes the key on a drop on Open when no open state survives', async () => { /* … */ });
```

Drive each through **all three inputs** — the drag, Alt+arrow and the card menu — as `contextCardWrites.test.ts` already does for the other boards. A PBI takes the right path under either order; the rule has to be checked with a `Deliverable` on each input rather than once.

- [ ] **Step 2–5:** run and watch them fail; implement; watch them pass; then make `performIterationBoardMove` delegate unconditionally and watch the same-bucket test go red. Commit.

---

### Task 7: The board, its empty states, and the goal line

**Files:**
- Modify: `src/view/render/board.ts`, `src/view/render/emptyStates.ts`, `styles/board.css`
- Test: `test/view/iterationBoard.test.ts`

**Two empty states.** *No state property configured at all* — the product board's own guidance, reached from a second screen. *The iteration holds no items* — **"No items in this iteration yet"**, never the product board's "All N items are done and hidden", which cannot tell an empty base from an empty scope.

**The goal line, with three refusals**: no goal, no line — never an empty one and never a placeholder inviting a value; on `Product` scope, no line at all; and it is **text, not a control**.

- [ ] Tests: both empty states; the goal line drawn, absent when empty, absent on `Product`; and that nothing in the goal line is focusable or clickable. Then implement, watch pass, commit.

---

### Task 8: Creating and editing an iteration

**Files:**
- Create: `src/ui/iterationDialog.ts`, `src/domain/iterations.ts`
- Modify: `src/view/render/toolbarControls.ts`, `src/domain/writePlan.ts`, `src/view/interactions/structure.ts`
- Test: `test/domain/iterationSchedule.test.ts` (create), `test/view/iterationBoard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/domain/iterations.ts
  export function previousIteration(items: BacklogItem[]): BacklogItem | null;
  export function nextIterationDates(previous: BacklogItem | null, today: string, lengthDays: number): { start: string; target: string };
  ```

**Previous is the `Iteration` in the MODEL with the greatest target**, ties broken by start then by path so the answer is total. Not the chosen scope — creating from Sprint 8 while Sprint 12 exists would silently make an overlapping iteration. In the model and not the vault: a base that filters an `Iteration` out leaves it out, which is the same limit the picker and `Set iteration` already have, and a base hiding iterations hides the picker this action is reached from.

Start is the previous target **+ 1 day**; target is start + length **− 1** (inclusive, so fourteen days starting Monday ends the second Sunday). With no dated iteration at all, start is **today**.

**Every computed date is a prefill.** The dialog writes what the user confirmed. The one validation is that a confirmed target before its start is refused — here rather than at the write, because the write path's honest answer for a reversed span is to shelve it, and a dialog that produced one on purpose would be a control creating the thing the roadmap has to apologise for.

**The name field is on the create path only.** Renaming an iteration is renaming a note; Obsidian does it better, and the stored scope already follows a rename.

**Editing re-stamps no member.** The write goes to the iteration note alone.

- [ ] **Step 1: Write the failing derivation tests**

```ts
it('follows the iteration that ends latest, not the one on screen', () => { /* … */ });
it('breaks a tie on target by start, then by path', () => { /* … */ });
it('follows a predecessor that has a target and no start', () => { /* … */ });
it('starts today when no iteration carries a target', () => { /* … */ });
it('makes an inclusive span: 14 days from a Monday ends the second Sunday', () => {
	expect(nextIterationDates(null, '2026-09-07', 14)).toEqual({ start: '2026-09-07', target: '2026-09-20' });
});
it('abuts rather than overlaps: start is the previous target plus one day', () => { /* … */ });
```

- [ ] **Step 2–4:** run, watch fail, implement `src/domain/iterations.ts`, watch pass.

- [ ] **Step 5: Build the dialog and its two entries**

`src/ui/iterationDialog.ts` beside `src/ui/stateColorsDialog.ts` — the leaf that knows about no layer, which is what lets the board open it without the picker reaching upward. `New iteration…` below the scopes; `Edit iteration…` above it and **only while an iteration is the chosen scope**.

Creating goes through `createBacklogItem` with the type, the folder, both dates and the goal in **one** write, then opens the note. Editing plans `computeIterationNoteWrites` and applies through `applySafely`.

- [ ] **Step 6: Test the write shapes**

```ts
it('creates with the type, both dates and the goal in one write', () => { /* never a create then a write */ });
it('writes to the iteration note alone when editing, whatever it holds', () => {
	// An iteration with several members: assert the batch names ONE file.
});
it('refuses a confirmed target before its start', () => { /* … */ });
it('omits the goal field when the goal property is unconfigured', () => { /* … */ });
it('shows no name field on the edit path', () => { /* … */ });
```

- [ ] **Step 7: Watch the no-cascade test fail on purpose**

Add a member re-stamp to the edit plan. The "names one file" test must go red. Remove it. This is the decision the register argues hardest for; a test that would pass with a cascade is not the check it needs.

- [ ] **Step 8: Run everything and commit**

```bash
npm run check
git add src/ui src/domain src/view test/ && git commit -m "Create and edit an iteration from the board's scope picker"
```

---

### Task 9: Close the register

- [ ] Set `A board scoped to one iteration` and `Creating an iteration from the board` to `Done` with today's `finished`.
- [ ] Close the **Feature** `An Iterations board` only if `An iteration draws as a bar or a line` has also landed. If it has not, the Feature stays `Open` — a Feature closed over an unbuilt use case is a defect this register has recorded before.
- [ ] Write the Feature's `## Outcome` section.
- [ ] Add the `[Unreleased]` CHANGELOG entry.
- [ ] Delete `docs/superpowers/plans/2026-08-15-iterations-board.md`, whose staleness banner has now outlived its use — this plan replaced it.
- [ ] `npm run check`, then commit.

---

## Live-vault check still owed

- The scope picker's fit in the toolbar row once it carries every iteration **plus two action entries** — the row has a one-line budget and this is the control most likely to break it.
- The goal line above the columns on a themed vault.
- The create/edit dialog's date inputs against Obsidian's own modal styling.
- That a three-column board reads as a board and not as a product board with columns missing.

## Self-review

**Spec coverage.** §3 → Tasks 4, 5. §4 → Task 3. §5 → Tasks 1, 2. §6 → Task 6. §7 → Task 7. §10 → Task 8. §8 is out of scope and says so. §1, §2 and §9 are the foundation plan's.

**Placeholders.** Tasks 5, 6 and 7 give their test names and their rules but compress the step scaffolding, and Task 3's test bodies are named rather than written. That is a real trade and worth naming rather than hiding: each of those drives the jsdom harness through helpers whose signatures belong to `test/view/`, and a plan that guesses at them teaches a second way to open a menu. Tasks 1, 2 and 8 — every rule with an argument behind it — carry their code in full.

**Type consistency.** `IterationBucket` is `'open' | 'inProgress' | 'resolved'` everywhere. `bucketRepresentative` returns `string | null | undefined` in Tasks 2, 6 and 7, with `undefined` meaning "no drop" in all three. `performIterationBoardMove(item, bucket)` takes the **bucket**, never a state — the whole point of Task 6. `ViewPrefs.scope` is a path in Tasks 4 and 8.
