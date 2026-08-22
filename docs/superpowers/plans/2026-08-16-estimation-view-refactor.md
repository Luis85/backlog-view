# Refactor Slice + Estimation View Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm `domain/` as the shared kernel (ADR 0030), make registration one-file-per-view with a plugin-wide write lock, and ship a walking skeleton of the estimation view: a results table beside a per-item rubric panel that writes score + rounded total + model stamp as one gated batch.

**Architecture:** Approach A from `docs/superpowers/specs/2026-08-16-estimation-view-refactor-design.md` — the four layers stay; new scoring logic is pure `domain/` code; the estimation view nests in `view/estimation/`; `WriteGate` splits into a per-view gate over a plugin-wide `WriteLock`; a new generic `storage/propertyWrite.ts` writes plain key/value batches capturing the same `RestoreWrite` inverses the undo machinery already replays.

**Tech Stack:** TypeScript (pinned obsidian `1.12.0` typings), vitest + jsdom harness, esbuild, the repo's own `npm run check` gate.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) MUST pass before **every** commit. CI runs the same five on Ubuntu and Windows.
- **Fallow's entries are `src/main.ts` and `test/harness/page.ts`**: a module unreachable from them is dead code and fails the gate. Every task below lands new modules together with the import chain that reaches them — do not commit a half-wired kernel.
- `src/**` files ≤ 400 lines (lint), `test/**` ≤ 450 lines. One file per concern.
- Layer rule: `main → commands → view → storage → domain`; `ui/` and `i18n/` are leaves. Never import upward.
- Never call `processFrontMatter` / `vault.create` / `load|saveLocalStorage` outside `storage/` (lint-enforced).
- Every new `src/` module must be named in a docs note (`## Where it lives` of a requirement, or an ADR's `## Decision`) **in the same commit** — docs-check verifies named paths exist and that every module is named.
- All user-visible strings go through `t()` with new keys in `src/i18n/en.ts` (data file — no imports/logic). Sentence-case UI text. Never put persisted values (property keys, rubric sentences, type names) in the catalog.
- Every write of a user-configured key goes through `setOwn`; every live read through `ownValue`.
- Unconfigured key ⇒ never written, feature absent not broken.
- Do not add dependencies. Do not touch the TypeScript or `@types/node` pins.
- Commit messages: prose sentences (see `git log`), no model identifiers, each commit green.

---

### Task 1: ADR 0030 — `domain/` is the kernel

**Files:**
- Read first: `docs/adrs/0029-reconcile-rows-by-signature.md` (mirror its frontmatter/section shape exactly), `docs/adrs/README.md` (index format)
- Create: `docs/adrs/0030-domain-is-the-kernel.md`
- Modify: `docs/adrs/README.md` (add index row), `docs/issues/The SDD's layers are not the four this repository enforces.md` (status → Closed, closing paragraph naming the ADR)

**Interfaces:**
- Produces: the written answer required before any directory is created under `src/` (the issue's acceptance criterion 1).

- [ ] **Step 1: Read ADR 0029 and one Closed issue** (e.g. `docs/issues/Board order is derived not stored.md`) to copy the exact frontmatter fields and closing conventions this register uses.

- [ ] **Step 2: Write the ADR.** Body (adapt headings to match 0029's):

```markdown
# 30. domain/ is the kernel

## Context

The SDD of 2026-08-16 proposes plugin/core/application/infrastructure/views.
This repository enforces main → commands → view → storage → domain (ADR 0003),
with ui/ and i18n/ as leaves. [[A view per capability]] needs one implementation
of each shared concept below every view; it is indifferent to directory names.
The issue "The SDD's layers are not the four this repository enforces" requires
this question answered in writing before any directory is created under src/.

## Decision

domain/ IS the shared kernel: pure, node-tested, lint-fenced. storage/ stays the
one write boundary. ADR 0003 is confirmed, not superseded.

No application layer. A use case remains a host method plus a pure planner. The
test for ever adding one: two views measurably duplicating the same use case —
counted in code, not predicted.

Each view owns its registration file; `main.ts` composes. The write path's
vault-wide half (one batch at a time, one undo slot) becomes a plugin-wide
`WriteLock`; validation, refusal and busy publication stay per view.

A second view nests under `view/` (`view/estimation/`). The per-view split of
`view/` (`view/backlog/` + a lint edge between view directories) is deferred to
the extraction feature, where a third directory earns it. Until then, "views
import nothing of each other" is convention here and checked nowhere.

## Consequences

The SDD's directory tree is not adopted. Modules this refactor adds are named
here as they land, so docs-check rule 7 holds per commit.
```

- [ ] **Step 3: Close the issue.** Set `status: Closed` in its frontmatter (keep `finished` conventions matching other Closed notes), and append under `## What a decision would look like` a short closing section: question 1 answered by ADR 0030 (`domain/` is the kernel, no rename), question 2 answered (no application layer, with the counted-duplication test), ADR 0003 confirmed.

- [ ] **Step 4: Run `npm run check`** — expect all five green (docs-only change).

- [ ] **Step 5: Commit**

```bash
git add docs/adrs/0030-domain-is-the-kernel.md docs/adrs/README.md "docs/issues/The SDD's layers are not the four this repository enforces.md"
git commit -m "Answer the layers question: domain/ is the kernel (ADR 0030)"
```

---

### Task 2: Harness mock of the table + panel, and the stylesheet partial

**Files:**
- Create: `styles/estimation.css` (committed), `test/harness/mock.ts` (**uncommitted** — `npm run analyze` is right to call it dead)
- Modify: `styles/index.css` (add `@import "./estimation.css";` at the END of the projection block, after `@import "./legend.css";` — order is behaviour; last position means it overrides nothing)

**Interfaces:**
- Produces: the `.pbl-est-*` class vocabulary Tasks 6–8 render into: `pbl-est-table`, `pbl-est-head`, `pbl-est-row`, `pbl-est-cell`, `pbl-est-title`, `pbl-est-total`, `pbl-est-coverage`, `pbl-est-currency`, `pbl-est-panel`, `pbl-est-dim`, `pbl-est-dim-label`, `pbl-est-points`, `pbl-est-point`, `pbl-est-rubric`, `pbl-est-decomp`, `pbl-est-derived`.

- [ ] **Step 1: Write `styles/estimation.css`.** Keep under 400 lines; use Obsidian variables only (`--background-modifier-border`, `--text-muted`, `--interactive-accent`, `--size-4-*`, `--font-ui-smaller`); `setCssProps`-compatible (no inline styles expected). Layout: `.pbl-est-view` is a two-column grid (`grid-template-columns: minmax(0, 1fr) minmax(280px, 360px)`), table left, panel right; panel stacks below at narrow width (`@container` not available — use a simple `flex-wrap` fallback or media-free `grid-template-columns: repeat(auto-fit, ...)`). `.pbl-est-row` is a flex row: title grows, fixed-width value cells (`width: 72px`, `text-align: end`, `font-variant-numeric: tabular-nums`). `.pbl-est-point` is a real `<button>` restyled flat (the 2026-08-08 lesson: never lean on a bare button's default look); selected point takes `--interactive-accent`. `.pbl-est-currency` is a muted chip; `.pbl-est-currency.pbl-est-stale` uses `--text-warning`.

- [ ] **Step 2: Write `test/harness/mock.ts`** calling `mountHarness`-style setup the way `test/harness/page.ts` does (copy its two-statement shape), then replace the pane's content with hand-written markup: a `.pbl-est-view` holding a table of ~6 rows (mixed: full profile, partial 3/8, stale, foreign stamp, hand-written, no total) and a panel for one item with 8 dimension selector rows (5 points each, one selected, rubric sentence under it), the confidence row, effort + complexity, and the decomposition block with total `3.55`, coverage `6/8`, confidence-adjusted `2.13`, value/effort `0.71`.

- [ ] **Step 3: Build and look**: `npm run harness -- test/harness/mock.ts`, open the printed `file://` URL (or screenshot headlessly with the Chromium at `/opt/pw-browsers/chromium 
 --headless --screenshot=... 'file://...'`). Check both themes (`?theme=light`). Send the screenshots to the user for layout sign-off before Task 6 builds the real render.

- [ ] **Step 4: Run `npm run check`** — the new partial is imported (build gate), nothing else changed.

- [ ] **Step 5: Commit** (partial + index only — NOT mock.ts):

```bash
git add styles/estimation.css styles/index.css
git commit -m "Draft the estimation view's stylesheet partial"
```

---

### Task 3: `WriteLock` — the plugin-wide half of the write path

**Files:**
- Create: `src/view/writeLock.ts`
- Modify: `src/view/writeGate.ts`, `src/view/backlogView.ts` (adapter + optional constructor param + `gate.dispose()` in `onunload`), `docs/adrs/0030-domain-is-the-kernel.md` (name both paths in `## Decision`), `src/view/CLAUDE.md` (the write-gate bullet: gate reads a narrow `GateHost`, lock is plugin-wide)
- Test: `test/view/writeLock.test.ts`; Modify `test/helpers/view.ts` (add `lock` option to `makeView`)

**Interfaces:**
- Produces: `class WriteLock { applying: boolean; lastUndo: RestoreWrite[] | null; readonly recovery: UndoRecovery; subscribe(l: () => void): () => void; notify(): void }`
- Produces: `interface GateHost { app(): App; writeProblems(): string[]; outsideFilter(path: string): boolean }`
- Produces: `class WriteGate<W extends { file: TFile }>` with `constructor(host: GateHost, hooks: WriteGateHooks, lock: WriteLock, apply: ApplyRun<W>)`, `applySafely(writes: W[])`, `canUndo()`, `undoLast()`, `deferUpdate()`, `dispose()`, `busy` — behaviour identical to today for a single view.
- Produces: `ProductBacklogView` constructor `(controller, containerEl, lock: WriteLock = new WriteLock())`.
- Consumes: `RestoreWrite`, `WriteOutcome` from `storage/frontmatter.ts`; `UndoRecovery`, `ReplayTracker`, `replayRun` from `view/interactions/undo.ts` (unchanged).

- [ ] **Step 1: Write the failing test** `test/view/writeLock.test.ts` (use `useViewHarness()`, `fixture()`, `makeView`, `flush` from the helpers):

```ts
import { describe, expect, it } from 'vitest';
import { useViewHarness, makeView, fixture, flush, rowByTitle } from '../helpers/view';
import { WriteLock } from '../../src/view/writeLock';

useViewHarness();

describe('the plugin-wide write lock', () => {
	it('serializes two views: the second batch is refused while the first is in flight', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		let release: () => void = () => {};
		// Stall the first write inside processFrontMatter so the second arrives mid-batch.
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		const fileOf = (path: string) => vault.entries().find((e) => e.file.path === path)!.file;
		const first = a.view.applySafely([{ file: fileOf('Epic A.md'), order: 99 }]);
		const second = await b.view.applySafely([{ file: fileOf('Epic B.md'), order: 42 }]);
		expect(second).toBeNull(); // refused: "Still applying the previous change"
		release();
		await first;
		expect(vault.fm('Epic A.md').order).toBe(99);
		expect(vault.fm('Epic B.md').order).toBeUndefined();
	});

	it('shares one undo slot: view B takes back what view A wrote', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		await a.view.applySafely([{ file: vault.file('Epic A.md'), order: 99 }]);
		expect(b.view.canUndo()).toBe(true);
		await b.view.undoLast();
		expect(vault.fm('Epic A.md').order).toBe(10);
		expect(a.view.canUndo()).toBe(false);
	});
});
```

If `FakeVault` has no `beforeWrite` hook, add one beside `afterWrite` in `test/helpers/vault.ts` (awaited at the top of its `processFrontMatter`); keep it optional so nothing else changes.

- [ ] **Step 2: Run it — expect FAIL** (`WriteLock` not found): `npx vitest run test/view/writeLock.test.ts`

- [ ] **Step 3: Write `src/view/writeLock.ts`:**

```ts
import { RestoreWrite } from '../storage/frontmatter';
import { UndoRecovery } from './interactions/undo';

/**
 * The vault-wide half of the write path: one batch at a time and one undo slot,
 * whichever view wrote. Created once in `main.ts` and handed to every view's
 * gate — a gate per view would be two views racing on one vault with two ideas
 * of what "the last batch" was (ADR 0030). The per-view halves — validation,
 * the outside-filter refusal, busy publication — stay in `WriteGate`.
 */
export class WriteLock {
	/** A batch is in flight somewhere in the plugin. */
	applying = false;
	/** Inverses of the vault's most recent effective batch, in write order. */
	lastUndo: RestoreWrite[] | null = null;
	/** Keeps undo and redo coherent when a replay fails partway. */
	readonly recovery = new UndoRecovery();
	private readonly listeners = new Set<() => void>();

	/** A view's busy-sync follows the lock while the view lives; returns the unsubscribe. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Tell every live view the lock changed — the OTHER view's undo button follows the slot. */
	notify(): void {
		for (const listener of this.listeners) listener();
	}
}
```

- [ ] **Step 4: Refactor `src/view/writeGate.ts`.** Mechanical moves, no behaviour change:
  - Delete fields `applying`, `lastUndo`, `recovery`; read/write `this.lock.applying`, `this.lock.lastUndo`, `this.lock.recovery` instead.
  - New constructor `(private readonly host: GateHost, private readonly hooks: WriteGateHooks, private readonly lock: WriteLock, private readonly apply: ApplyRun<W>)`; in the body `this.unsubscribe = lock.subscribe(() => this.hooks.syncBusy());` and add `dispose(): void { this.unsubscribe(); }`.
  - Declare at top of the file:

```ts
/** How the gate reaches the view it guards — narrow on purpose, so a second view can supply its own. */
export interface GateHost {
	/** The app, read at call time — a Bases view is handed its `app` after construction. */
	app(): App;
	/** Problems that block every write; each view validates its own settings. */
	writeProblems(): string[];
	/** True when this path is context this view's Base excluded — forward batches refuse whole. */
	outsideFilter(path: string): boolean;
}

/** The writer a forward batch runs — `applyWrites` for the backlog, `applyPropertyWrites` for estimation. */
export type ApplyRun<W> = (
	writes: W[],
	onProgress: (done: number, total: number) => void,
	onInverse: (inverse: RestoreWrite) => void,
) => Promise<WriteOutcome>;

export class WriteGate<W extends { file: TFile }> {
```

  - `applySafely(writes: W[])`: the outside-filter check becomes `writes.some((w) => this.host.outsideFilter(w.file.path))` (keep the exact console message and Notice text); the run becomes `this.runExclusively(writes.length, (onProgress, onInverse) => this.apply(writes, onProgress, onInverse))`.
  - `undoLast()`: `replayRun(this.host.app(), batch, tracker)`; slot bookkeeping via `this.lock.lastUndo = this.lock.recovery.settle(...)`; the final `this.hooks.syncBusy()` becomes `this.lock.notify()`.
  - `runExclusively`: `const problems = this.host.writeProblems();` (same Notice text `Fix the view options first: ${problems[0]}`); `if (this.lock.applying)` for the busy refusal; set/clear `this.lock.applying`; the spent-replay check compares `this.lock.lastUndo === replaying`.
  - `setBusy`: `this.busy = state; this.lock.notify();` (the view's own `syncBusy` arrives through its subscription — do not also call `this.hooks.syncBusy()` or it runs twice).
  - Remove the direct imports of `configProblems` and `applyWrites` (now the host's and the runner's business); remove the `BacklogViewHost` import — `BusyState` moves its import to `./host` only.

- [ ] **Step 5: Adapt `src/view/backlogView.ts`:**

```ts
constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock = new WriteLock()) {
	...
	this.gate = new WriteGate<ItemWrite>(
		{
			app: () => this.app,
			writeProblems: () => configProblems(this.settings),
			outsideFilter: (path) => this.model?.byPath.get(path)?.outsideFilter === true,
		},
		{ syncBusy: () => this.syncBusyUi(), flushDataUpdate: () => this.refreshFromData() },
		lock,
		(writes, onProgress, onInverse) => applyWrites(this.app, this.settings, writes, onProgress, onInverse),
	);
```

Add `import { configProblems } from '../domain/settingsConsistency';` and `import { applyWrites } from '../storage/frontmatter';` (adjust the existing `WriteOutcome` import), `import { WriteLock } from './writeLock';`. In `onunload()`, add `this.gate.dispose();` before `this.viewEl.detach();`.

- [ ] **Step 6: Add the `lock` option to `makeView`** in `test/helpers/view.ts`: option `lock?: WriteLock`, pass `new ProductBacklogView({} as never, containerEl, lock)` when provided (default parameter covers the rest — every existing call site is untouched).

- [ ] **Step 7: Run the new test — expect PASS**, then the whole suite: `npm run check`. The extraction proof is the existing suites passing with no edits beyond `makeView`'s additive option.

- [ ] **Step 8: Update docs in the same commit:** ADR 0030 `## Decision` gains one sentence: "The lock is `src/view/writeLock.ts`; the gate stays `src/view/writeGate.ts`." Update the `src/view/CLAUDE.md` write-gate bullet: the gate reads a narrow `GateHost` (not `BacklogViewHost`), and `applying` + the undo slot + recovery live on the plugin-wide `WriteLock`.

- [ ] **Step 9: Commit**

```bash
git add src/view/writeLock.ts src/view/writeGate.ts src/view/backlogView.ts test/view/writeLock.test.ts test/helpers/view.ts test/helpers/vault.ts docs/adrs/0030-domain-is-the-kernel.md src/view/CLAUDE.md
git commit -m "Split the write gate over a plugin-wide lock"
```

---

### Task 4: Registration — one file per view, main composes

**Files:**
- Create: `src/view/registerBacklogView.ts`
- Modify: `src/main.ts`, `docs/adrs/0030-domain-is-the-kernel.md` (name the path)

**Interfaces:**
- Produces: `registerBacklogView(plugin: Plugin, lock: WriteLock): void`
- Consumes: `WriteLock` (Task 3), `PRODUCT_BACKLOG_VIEW_TYPE`, `ProductBacklogView`, `getViewOptions`.

- [ ] **Step 1: Write `src/view/registerBacklogView.ts`:**

```ts
import { Plugin } from 'obsidian';
import { getViewOptions } from '../domain/viewOptions';
import { PRODUCT_BACKLOG_VIEW_TYPE, ProductBacklogView } from './backlogView';
import { WriteLock } from './writeLock';

/**
 * The backlog view's own registration — one file per view, so adding a
 * capability adds a file rather than a branch in main (ADR 0030,
 * [[A view type per capability]]). The lock arrives from main because the
 * write path is the one piece of plugin-wide runtime state.
 */
export function registerBacklogView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(PRODUCT_BACKLOG_VIEW_TYPE, {
		name: 'Product Backlog',
		icon: 'lucide-list-tree',
		factory: (controller, containerEl) => new ProductBacklogView(controller, containerEl, lock),
		options: getViewOptions,
	});
}
```

- [ ] **Step 2: Rewrite `src/main.ts`'s `onload`** — replace the inline `registerBasesView` block with:

```ts
initLocale();
// ONE lock for the whole plugin: every view's writes serialize against it and
// the undo slot is the vault's last batch, whichever view wrote it (ADR 0030).
const lock = new WriteLock();
registerBacklogView(this, lock);
```

Keep the rename listener and both commands exactly as they are. Drop the now-unused imports (`getViewOptions`, `PRODUCT_BACKLOG_VIEW_TYPE`, `ProductBacklogView`); add `WriteLock` and `registerBacklogView` imports.

- [ ] **Step 3: `npm run check`** — expect green (fallow: `registerBacklogView.ts` is on the main path).

- [ ] **Step 4: ADR 0030 `## Decision`** gains: "Registration files are `src/view/registerBacklogView.ts` and `src/view/estimation/register.ts`" — add only the first path now; the second lands with Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/view/registerBacklogView.ts src/main.ts docs/adrs/0030-domain-is-the-kernel.md
git commit -m "Give each view its own registration file"
```

---

### Task 5: The estimation view exists — model config, empty state, config warnings

One commit, because fallow requires the chain `main → register → view → settings → scoringModel` live at once. Files stay small.

**Files:**
- Create: `src/domain/scoringModel.ts`, `src/domain/defaultModel.ts`, `src/domain/estimationSettings.ts`, `src/domain/estimationOptions.ts`, `src/view/estimation/estimationView.ts`, `src/view/estimation/register.ts`
- Modify: `src/main.ts` (`registerEstimationView(this, lock);`), `src/domain/settingsResolve.ts` (export a `configReaders` factory), `src/i18n/en.ts` (new keys), `docs/requirements/The scoring model is configuration.md` (+`## Where it lives`), `docs/requirements/The prioritized list.md` (+`## Where it lives` naming the view files), ADR 0030 (`register.ts` path)
- Test: `test/domain/scoringModel.test.ts`, `test/view/estimation/states.test.ts`, `test/helpers/estimation.ts`

**Interfaces:**
- Produces (`scoringModel.ts`):

```ts
export interface ScoringDimension {
	id: string; label: string; key: string; // key '' = no property bound
	min: number; max: number; weight: number; lessIsBetter: boolean;
	rubric: string[]; // one sentence per point, index 0 = min
}
export interface ScaleConfig { key: string; min: number; max: number; rubric: string[] }
export interface ScoringModel {
	dimensions: ScoringDimension[];
	outputMin: number; outputMax: number;
	valueKey: string; stampKey: string;
	confidence: ScaleConfig; effort: ScaleConfig; complexity: ScaleConfig;
}
export function pointCount(min: number, max: number): number; // max - min + 1
export function modelProblems(model: ScoringModel): string[];
export function estimationUnconfigured(model: ScoringModel): boolean;
```

- Produces (`defaultModel.ts`): `export const DEFAULT_DIMENSIONS: ...` (data below), `export function defaultDimension(id: string): { label: string; weight: number; rubric: string[] } | null`, `export const DEFAULT_SCALE_RUBRICS: Record<'confidence' | 'effort' | 'complexity', string[]>`, `export const SUGGESTED_KEYS: { option: string; suggested: string; label: string }[]` (13 rows).
- Produces (`estimationSettings.ts`): `export interface EstimationSettings { model: ScoringModel }`, `export function resolveEstimationSettings(config: BasesViewConfig): EstimationSettings`, option-key helpers `dimOption(id, field)` where field ∈ `property|weight|range|lessIsBetter|label` → `` `dim${Field}.${id}` ``, `dimRubricOption(id, point)` → `` `dimRubric.${id}.${point}` ``, `scaleRubricOption(scale, point)`.
- Produces (`estimationOptions.ts`): `export function getEstimationViewOptions(config: BasesViewConfig): BasesAllOptions[]`.
- Produces (`estimationView.ts`): `export const ESTIMATION_VIEW_TYPE = 'product-estimation';`, `export class EstimationView extends BasesView` with `type`, `viewEl`, `settings: EstimationSettings`, `onDataUpdated()`, and a render dispatch (this task: loading → unconfigured empty state → config warning → placeholder "configured" frame; the table arrives in Task 6).
- Produces (`register.ts`): `registerEstimationView(plugin: Plugin, lock: WriteLock): void` — name `Estimation`, icon `lucide-calculator`, options `getEstimationViewOptions`.
- Produces (`settingsResolve.ts`): `export function configReaders(config: BasesViewConfig)` returning the existing internal closures `{ propKey, clearablePropKey, clearable, str, bool, list, dedupe }` — extract them verbatim into the factory and have `resolveSettings` call it; zero behaviour change, existing tests prove it.
- Produces (`test/helpers/estimation.ts`): `makeEstimationView(vault, configValues = {}, { lock, base, viewName } = {})` mirroring `makeView`'s assignment pattern (`anyView.app/config/data`, then `onDataUpdated()`), returning `{ view, config, containerEl }`.

- [ ] **Step 1: Failing node tests** `test/domain/scoringModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { modelProblems, estimationUnconfigured } from '../../src/domain/scoringModel';
import { resolveEstimationSettings } from '../../src/domain/estimationSettings';
import { FakeViewConfig } from '../helpers/vault';

// Put this builder in test/helpers/estimationModel.ts from the start — the
// weightedScore and view suites import the same one.
const configured = () =>
	resolveEstimationSettings(
		new FakeViewConfig({
			valueProperty: 'note.business-value',
			stampProperty: 'note.business-value-model',
			'dimProperty.strategic-alignment': 'note.strategic-alignment',
			'dimProperty.customer-value': 'note.customer-value',
			'dimProperty.business-impact': 'note.business-impact',
			'dimProperty.reach': 'note.reach',
			'dimProperty.risk-reduction': 'note.risk-reduction',
			'dimProperty.compliance': 'note.compliance',
			'dimProperty.time-criticality': 'note.time-criticality',
			'dimProperty.enablement': 'note.enablement',
		}),
	).model;

describe('the scoring model configuration', () => {
	it('resolves the shipped default model: eight dimensions, weights totalling 100, five rubric sentences each', () => {
		const model = configured();
		expect(model.dimensions.map((d) => d.id)).toEqual([
			'strategic-alignment', 'customer-value', 'business-impact', 'reach',
			'risk-reduction', 'compliance', 'time-criticality', 'enablement',
		]);
		expect(model.dimensions.reduce((sum, d) => sum + d.weight, 0)).toBe(100);
		for (const d of model.dimensions) expect(d.rubric).toHaveLength(5);
		expect(modelProblems(model)).toEqual([]);
	});
	it('a fresh view is unconfigured, not broken', () => {
		const model = resolveEstimationSettings(new FakeViewConfig({})).model;
		expect(estimationUnconfigured(model)).toBe(true);
	});
	it('refuses a zero or negative weight, naming the dimension', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimWeight.reach': '0', 'dimWeight.compliance': '20' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/reach/i);
	});
	it('refuses weights that do not total 100', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimWeight.enablement': '10' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/100/);
	});
	it('refuses a range that is not increasing whole integers, naming the dimension', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRange.reach': '5-1' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/reach/i);
	});
	it('a widened range reports the points with no rubric sentence rather than inventing one', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRange.reach': '1-7' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/reach/i);
	});
	it('the total and its stamp are one pair: exactly one bound names the missing other', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ valueProperty: 'note.business-value' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/stamp/i);
	});
});
```

- [ ] **Step 2: Run — expect FAIL** (modules missing): `npx vitest run test/domain/scoringModel.test.ts`

- [ ] **Step 3: Write `src/domain/defaultModel.ts`** — pure data, every sentence from the PRD (`docs/prds/2026-08-16 Business value estimation and prioritization.md` §8–10). Persisted-and-fingerprinted, so NOT in the i18n catalog:

```ts
/** The shipped default model — data only. Rubric sentences are persisted into the
 * `.base` fingerprint, so they are DATA, not catalog text (two locales must not
 * write two models). Source: the PRD of 2026-08-16, kept verbatim in docs/prds/. */
export const DEFAULT_DIMENSIONS: { id: string; label: string; weight: number; rubric: string[] }[] = [
	{ id: 'strategic-alignment', label: 'Strategic alignment', weight: 20, rubric: [
		'Marginal or no strategic relevance', 'Weak contribution', 'Supports an established objective',
		'Strong contribution to an important objective', 'Directly enables a top strategic priority'] },
	{ id: 'customer-value', label: 'Customer value', weight: 20, rubric: [
		'Cosmetic or minor convenience', 'Small improvement', 'Meaningful improvement',
		'Solves a significant user problem', 'Enables or fundamentally improves a critical job'] },
	{ id: 'business-impact', label: 'Business impact', weight: 15, rubric: [
		'Negligible', 'Small', 'Measurable', 'Significant', 'Transformational or major impact'] },
	{ id: 'reach', label: 'Reach', weight: 10, rubric: [
		'Very small group', 'Limited segment', 'Significant segment', 'Majority',
		'Nearly all relevant users or processes'] },
	{ id: 'risk-reduction', label: 'Risk reduction', weight: 10, rubric: [
		'Negligible', 'Small', 'Meaningful', 'Significant', 'Removes or materially mitigates critical risk'] },
	{ id: 'compliance', label: 'Compliance', weight: 10, rubric: [
		'Completely optional', 'Internal preference', 'Important commitment',
		'Strong contractual or policy requirement', 'Mandatory or legal requirement'] },
	{ id: 'time-criticality', label: 'Time criticality', weight: 10, rubric: [
		'No meaningful time pressure', 'Can reasonably wait', 'Delay has measurable consequences',
		'Strong timing dependency', 'Hard deadline or rapidly decaying value'] },
	{ id: 'enablement', label: 'Enablement', weight: 5, rubric: [
		'Standalone', 'Minor dependencies', 'Enables several items',
		'Important platform capability', 'Foundational prerequisite for major capabilities'] },
];

export function defaultDimension(id: string): { label: string; weight: number; rubric: string[] } | null {
	return DEFAULT_DIMENSIONS.find((d) => d.id === id) ?? null;
}

export const DEFAULT_SCALE_RUBRICS: Record<'confidence' | 'effort' | 'complexity', string[]> = {
	confidence: ['Assumption', 'Anecdotal evidence', 'Qualitative evidence', 'Quantitative evidence', 'Validated or observed evidence'],
	effort: ['Very small', 'Small', 'Medium', 'Large', 'Very large'],
	complexity: ['Well understood', 'Low complexity', 'Moderate complexity', 'Significant unknowns', 'Highly complex or uncertain'],
};

/** The 13 suggested bindings the guided empty state adopts — option id, suggested key, spoken label. */
export const SUGGESTED_KEYS: { option: string; suggested: string; label: string }[] = [
	...DEFAULT_DIMENSIONS.map((d) => ({ option: `dimProperty.${d.id}`, suggested: d.id, label: d.label.toLowerCase() })),
	{ option: 'confidenceProperty', suggested: 'confidence', label: 'confidence' },
	{ option: 'effortProperty', suggested: 'effort', label: 'effort' },
	{ option: 'complexityProperty', suggested: 'complexity', label: 'complexity' },
	{ option: 'valueProperty', suggested: 'business-value', label: 'business value' },
	{ option: 'stampProperty', suggested: 'business-value-model', label: 'business value model stamp' },
];
```

- [ ] **Step 4: Write `src/domain/scoringModel.ts`** — types above plus:

```ts
export function pointCount(min: number, max: number): number {
	return max - min + 1;
}

/** Nothing bound at all: the guided empty state's case, distinct from a broken model. */
export function estimationUnconfigured(model: ScoringModel): boolean {
	return model.valueKey === '' && model.stampKey === '' && model.dimensions.every((d) => d.key === '');
}

/**
 * Why this model computes nothing — each problem names its dimension, the
 * config-warning shape. Empty means the model is fit to score with.
 */
export function modelProblems(model: ScoringModel): string[] {
	const problems: string[] = [];
	if (model.dimensions.length === 0) problems.push('no dimensions are declared');
	// The pair rule: a total with no stamp is an unattributed number, a stamp with
	// no total describes a model that wrote nothing — refuse until both are named.
	if (model.valueKey !== '' && model.stampKey === '') problems.push('the model stamp property is not named (the total and its stamp are one pair)');
	if (model.stampKey !== '' && model.valueKey === '') problems.push('the business value property is not named (the total and its stamp are one pair)');
	let weightSum = 0;
	for (const d of model.dimensions) {
		if (!Number.isInteger(d.min) || !Number.isInteger(d.max) || d.min >= d.max)
			problems.push(`${d.id}: the range must be two whole numbers, low to high`);
		else if (d.rubric.length !== pointCount(d.min, d.max))
			problems.push(`${d.id}: ${pointCount(d.min, d.max)} points need ${pointCount(d.min, d.max)} rubric sentences, found ${d.rubric.length}`);
		if (d.key === '') problems.push(`${d.id}: no property is bound — bind one or remove the dimension`);
		if (!(d.weight > 0)) problems.push(`${d.id}: the weight must be a positive number`);
		else weightSum += d.weight;
	}
	if (problems.length === 0 && Math.abs(weightSum - 100) > 1e-9)
		problems.push(`the weights total ${weightSum}, not 100`);
	if (!Number.isInteger(model.outputMin) || !Number.isInteger(model.outputMax) || model.outputMin >= model.outputMax)
		problems.push('the output range must be two whole numbers, low to high');
	return problems;
}
```

Note the ordering trap the tests pin: `estimationUnconfigured` is asked FIRST by the view; `modelProblems` on a fresh config would report every dimension unbound. The dimension-key problem is therefore only meaningful once something is bound — that is the view's dispatch order, not a validator special case.

- [ ] **Step 5: Write `src/domain/estimationSettings.ts`** — resolve using `configReaders(config)` (extract in the same commit):

```ts
const parseRange = (text: string, fallback: [number, number]): [number, number] => {
	const match = /^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/.exec(text);
	return match ? [Number(match[1]), Number(match[2])] : fallback;
};
// Unparseable text keeps the fallback; a WRONG range (5-1) resolves as stated and
// is refused by modelProblems, which is where refusals speak — never silently here.
```

`resolveEstimationSettings(config)`:
1. `read = configReaders(config)`.
2. Dimension ids: `read.dedupe(read.list('dimensions'))`, falling back (via `clearable`) to `DEFAULT_DIMENSIONS.map(d => d.id)`.
3. Per id: `key = read.propKey(dimOption(id, 'property'), '')`; defaults from `defaultDimension(id)` (label/weight/rubric), overridable: weight from `dimWeight.${id}` text parsed as number (unset → default → for an unknown id `NaN` → 0, which `modelProblems` refuses), range from `dimRange.${id}` default `[1, 5]`, `lessIsBetter` from toggle default false, label from `dimLabel.${id}` default shipped label or the id itself, rubric per point from `dimRubric.${id}.${point}` (point = min..max), each falling back to the shipped sentence at that index when the id and index are known, `''` otherwise (missing → `modelProblems` names it).
4. `valueKey/stampKey/confidence.key/effort.key/complexity.key` via `propKey(..., '')`; scales are fixed `1–5` this round with rubric overrides via `scaleRubricOption`.
5. Output range from `outputRange` text, default `[1, 5]`.

- [ ] **Step 6: Write `src/domain/estimationOptions.ts`** — `getEstimationViewOptions(config)` resolves the settings (the WIP-boxes precedent: config-aware options) and returns groups: **Model** (`dimensions` text default the eight ids comma-joined, `outputRange` text default `1-5`, `valueProperty` + `stampProperty` property pickers with placeholders `business-value` / `business-value-model`, `filter: notePropsOnly` — copy the little helper, it is two lines), one **group per dimension** (`displayName: d.label`, items: property picker, weight text with the shipped default as `default`, range text default `1-5`, less-is-better toggle, label text), and **Scales** (three property pickers). Rubric sentences get no options UI this round — stored keys only, hand-editable in the `.base`; say so in the group `displayName`s? No — keep UI quiet; the honest note lives in the docs edit below.

- [ ] **Step 7: Write the view + registration.** `src/view/estimation/estimationView.ts`:

```ts
import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationSettings, resolveEstimationSettings } from '../../domain/estimationSettings';
import { estimationUnconfigured, modelProblems } from '../../domain/scoringModel';
import { WriteLock } from '../writeLock';

export const ESTIMATION_VIEW_TYPE = 'product-estimation';

/** The estimation view: the plugin's second Bases view (ADR 0030). */
export class EstimationView extends BasesView {
	type = ESTIMATION_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	private readonly contentEl2: HTMLElement; // BasesView may own contentEl; use a distinct name
	settings: EstimationSettings;
	readonly lock: WriteLock;

	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock = new WriteLock()) {
		super(controller);
		this.lock = lock;
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-est-view' });
		this.contentEl2 = this.viewEl.createDiv({ cls: 'pbl-est-content' });
		this.contentEl2.setText(t('estimation.loading'));
		this.settings = resolveEstimationSettings({ get: () => undefined, getAsPropertyId: () => null } as never);
	}

	onunload(): void {
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		this.refresh();
	}

	/** Re-resolve settings and redraw — the stable name later tasks call after a write. */
	refresh(): void {
		this.settings = resolveEstimationSettings(this.config);
		this.render();
	}

	render(): void {
		this.contentEl2.empty();
		const model = this.settings.model;
		if (estimationUnconfigured(model)) return this.renderUnconfigured();
		const problems = modelProblems(model);
		if (problems.length > 0) return this.renderProblems(problems);
		// Task 6 replaces this placeholder with the table.
		this.contentEl2.createDiv({ cls: 'pbl-est-table', text: t('estimation.empty.noResults') });
	}

	private renderUnconfigured(): void {
		const box = this.contentEl2.createDiv({ cls: 'pbl-empty pbl-est-empty' });
		box.createDiv({ text: t('estimation.empty.unconfigured') });
		// The init button lands in Task 8; until then the guidance names the options menu.
		box.createDiv({ cls: 'pbl-empty-hint', text: t('estimation.empty.hint') });
	}

	private renderProblems(problems: string[]): void {
		const box = this.contentEl2.createDiv({ cls: 'pbl-config-warning' });
		box.createDiv({ text: t('estimation.problems.lead') });
		const list = box.createEl('ul');
		for (const p of problems) list.createEl('li', { text: p });
	}
}
```

Check what the mock's `BasesView` (`test/helpers/obsidian-mock.ts:155`) provides (`config`, `data`, `app` are assigned by the harness; confirm real Obsidian's `BasesView` supplies them — the backlog view already relies on exactly this). If `contentEl` is free, use it and drop `contentEl2`. `src/view/estimation/register.ts`:

```ts
import { Plugin } from 'obsidian';
import { getEstimationViewOptions } from '../../domain/estimationOptions';
import { ESTIMATION_VIEW_TYPE, EstimationView } from './estimationView';
import { WriteLock } from '../writeLock';

export function registerEstimationView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(ESTIMATION_VIEW_TYPE, {
		name: 'Estimation',
		icon: 'lucide-calculator',
		factory: (controller, containerEl) => new EstimationView(controller, containerEl, lock),
		options: getEstimationViewOptions,
	});
}
```

`main.ts` adds `registerEstimationView(this, lock);` after the backlog's.

- [ ] **Step 8: i18n keys** in `en.ts` (sentence case): `'estimation.loading': 'Loading estimation view…'`, `'estimation.empty.unconfigured': 'No estimation model is configured for this view.'`, `'estimation.empty.hint': 'Name the score properties in the view options, or use the setup action once it is available.'` (Task 8 rewrites the hint), `'estimation.problems.lead': 'Fix the estimation model first:'`, `'estimation.empty.noResults': 'No results to estimate.'`.

- [ ] **Step 9: `test/helpers/estimation.ts` + failing view test** `test/view/estimation/states.test.ts`: unconfigured config renders `.pbl-est-empty`; a half-configured one (`valueProperty` only) renders `.pbl-config-warning` naming the stamp; the fully-configured `configured()` shape from Step 1 renders `.pbl-est-table`. Run, implement until green.

- [ ] **Step 10: Docs in-commit:** `The scoring model is configuration.md` gains `## Where it lives` naming `src/domain/scoringModel.ts`, `src/domain/defaultModel.ts`, `src/domain/estimationSettings.ts`, `src/domain/estimationOptions.ts` (mirror an existing note's section prose style — one sentence per module, what it is FOR), plus one honest sentence: rubric sentences are stored per point in the `.base` and edited there this round; the editing surface is [[A rubric for every point]]'s open half. `The prioritized list.md` gains `## Where it lives` naming `src/view/estimation/estimationView.ts` and `src/view/estimation/register.ts`. ADR 0030 names `src/view/estimation/register.ts`.

- [ ] **Step 11: `npm run check`** — green, then **Commit**

```bash
git add src/domain/scoringModel.ts src/domain/defaultModel.ts src/domain/estimationSettings.ts src/domain/estimationOptions.ts src/domain/settingsResolve.ts src/view/estimation/ src/main.ts src/i18n/en.ts test/domain/scoringModel.test.ts test/view/estimation/ test/helpers/estimation.ts docs/
git commit -m "Register the estimation view with its model configuration and guided refusals"
```

---

### Task 6: The weighted score, the stamp, and the table

**Files:**
- Create: `src/domain/weightedScore.ts`, `src/domain/estimationItems.ts`, `src/view/estimation/renderTable.ts`
- Modify: `src/view/estimation/estimationView.ts` (build model, render table, selection field), `src/i18n/en.ts`, `docs/requirements/The weighted score.md` (+`## Where it lives`: `weightedScore.ts`), `docs/requirements/The prioritized list.md` (add `estimationItems.ts`, `renderTable.ts`)
- Test: `test/domain/weightedScore.test.ts`, `test/view/estimation/table.test.ts`

**Interfaces:**
- Produces (`weightedScore.ts`):

```ts
export interface Coverage { answered: number; enabled: number }
export interface TotalResult { total: number /* rounded 2dp */; coverage: Coverage; clamped: string[] }
export function round2(value: number): number; // Math.round(value * 100) / 100
export function computeTotal(model: ScoringModel, answers: ReadonlyMap<string, number | null>): TotalResult | null;
export function modelFingerprint(model: ScoringModel): string; // 8-hex fnv1a over canonical arithmetic inputs
export function stampValue(model: ScoringModel, coverage: Coverage): string; // `${answered}/${enabled} ${fingerprint}`
export interface ParsedStamp { answered: number; enabled: number; fingerprint: string }
export function parseStamp(raw: string): ParsedStamp | null; // /^(\d+)\/(\d+)\s+([0-9a-f]{8})$/
export type Currency = 'current' | 'stale' | 'foreign' | 'handwritten' | 'orphan' | 'none';
export function currencyOf(model: ScoringModel, item: { storedTotal: number | null; storedStamp: string | null; result: TotalResult | null }): Currency;
```

- Produces: `EstimationView.selectedPath: string | null` (set by the table's delegated click and the arrow keys; the panel reads it in Task 7). A table with zero result rows renders `t('estimation.empty.noResults')` in place of rows — the ordinary results empty state.
- Produces (`estimationItems.ts`):

```ts
export interface EstimationItem {
	file: TFile; entry: BasesEntry; title: string;
	answers: Map<string, number | null>; // by dimension id; null = unanswered (absent OR non-number)
	confidence: number | null; effort: number | null; complexity: number | null;
	storedTotal: number | null; storedStamp: string | null;
	result: TotalResult | null; currency: Currency;
	ownKeys: Set<string>; // frontmatter keys the note actually carries, of this model's keys
}
export interface EstimationModel { items: EstimationItem[]; byPath: Map<string, EstimationItem> }
export function buildEstimationModel(app: App, entries: BasesEntry[], model: ScoringModel): EstimationModel;
```

- Consumes: `readNumber`, `readString`, `ownValue` from `domain/noteFields.ts`; `getFileCache` once per note (the model-cost rule — one cache read per note, in one place).

- [ ] **Step 1: Failing node tests** `test/domain/weightedScore.test.ts` — the arithmetic is the register's, verbatim:

```ts
// helper: model = configured() from scoringModel.test — extract that builder into
// test/helpers/estimationModel.ts (a plain function, both suites import it).
it('computes the PRD worked example to 3.55', () => {
	const answers = new Map(Object.entries({
		'strategic-alignment': 5, 'customer-value': 4, 'business-impact': 4, 'reach': 3,
		'risk-reduction': 2, 'compliance': 1, 'time-criticality': 4, 'enablement': 3 }));
	expect(computeTotal(model, answers)?.total).toBe(3.55);
	expect(computeTotal(model, answers)?.coverage).toEqual({ answered: 8, enabled: 8 });
});
it('renormalizes a partial profile over the answered weights', () => {
	const answers = new Map<string, number | null>([['strategic-alignment', 5], ['customer-value', 3]]);
	// proportions 1.0 and 0.5, weights 20/20 → 0.75 → 1 + 0.75*4 = 4
	expect(computeTotal(model, answers)?.total).toBe(4);
	expect(computeTotal(model, answers)?.coverage).toEqual({ answered: 2, enabled: 8 });
});
it('no answered dimension means no total at all', () => {
	expect(computeTotal(model, new Map())).toBeNull();
});
it('clamps an out-of-range value to the scale and reports the dimension', () => {
	const r = computeTotal(model, new Map([['reach', 9]]));
	expect(r?.total).toBe(5);
	expect(r?.clamped).toEqual(['reach']);
});
it('inverts a less-is-better dimension on its declared range', () => {
	const flipped = structuredClone(model);
	flipped.dimensions.find((d) => d.id === 'reach')!.lessIsBetter = true;
	// reach 5 → proportion 1 → inverted 0 → output floor
	expect(computeTotal(flipped, new Map([['reach', 5]]))?.total).toBe(1);
	expect(computeTotal(flipped, new Map([['reach', 1]]))?.total).toBe(5);
});
it('rounds once at two decimals', () => {
	// strategic-alignment 4 (p=0.75, w=20) + business-impact 3 (p=0.5, w=15):
	// (15 + 7.5) / 35 = 0.642857… → 1 + 0.642857…*4 = 3.571428… → 3.57
	const r = computeTotal(model, new Map([['strategic-alignment', 4], ['business-impact', 3]]));
	expect(r?.total).toBe(3.57);
});
it('the fingerprint is stable for the same model and moves for every arithmetic input', () => {
	const base = modelFingerprint(model);
	expect(modelFingerprint(model)).toBe(base);
	for (const mutate of [
		(m) => { m.dimensions[0].weight += 5; m.dimensions[1].weight -= 5; },
		(m) => { m.dimensions[0].key = 'other-property'; },
		(m) => { m.dimensions[0].rubric = [...m.dimensions[0].rubric]; m.dimensions[0].rubric[4] = 'Redefined'; },
		(m) => { m.outputMax = 10; },
		(m) => { m.dimensions[0].lessIsBetter = true; },
		(m) => { m.dimensions = m.dimensions.slice(1); },
	]) {
		const copy = structuredClone(model); mutate(copy);
		expect(modelFingerprint(copy)).not.toBe(base);
	}
});
it('currency: current / stale-by-total / stale-by-coverage / foreign / handwritten / orphan / none', () => {
	// current: storedStamp = stampValue(model, result.coverage), storedTotal = result.total
	// stale-by-total: storedTotal + 0.5; stale-by-coverage: stamp says 8/8, result.coverage 7/8
	// foreign: valid shape, wrong fingerprint; handwritten: total set, stamp null
	// orphan: total set, result null; none: nothing stored, nothing computed
});
```

- [ ] **Step 2: Run — FAIL.** Then implement `weightedScore.ts`:

```ts
export function computeTotal(model: ScoringModel, answers: ReadonlyMap<string, number | null>): TotalResult | null {
	let weighted = 0, weightSum = 0, answered = 0;
	const clamped: string[] = [];
	for (const d of model.dimensions) {
		const raw = answers.get(d.id);
		if (raw === null || raw === undefined) continue;
		answered++;
		const value = Math.min(d.max, Math.max(d.min, raw));
		if (value !== raw) clamped.push(d.id);
		const proportion = (value - d.min) / (d.max - d.min);
		weighted += (d.lessIsBetter ? 1 - proportion : proportion) * d.weight;
		weightSum += d.weight;
	}
	if (answered === 0) return null;
	const proportion = weighted / weightSum; // renormalized: full profile divides by 100 identically
	return {
		total: round2(model.outputMin + proportion * (model.outputMax - model.outputMin)),
		coverage: { answered, enabled: model.dimensions.length },
		clamped,
	};
}

export function modelFingerprint(model: ScoringModel): string {
	return fnv1a(JSON.stringify({
		formula: 'weighted-mean-v1',
		output: [model.outputMin, model.outputMax],
		dimensions: model.dimensions.map((d) => [d.id, d.key, d.min, d.max, d.weight, d.lessIsBetter, d.rubric]),
	}));
}

function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

export function currencyOf(model, item): Currency {
	// Currency describes the STORED total; with nothing stored there is nothing to judge.
	if (item.storedTotal === null) return 'none';
	// A stored total whose inputs are gone is an orphan — reported, removed only by action.
	if (item.result === null) return 'orphan';
	if (item.storedStamp === null) return 'handwritten';
	const parsed = parseStamp(item.storedStamp);
	if (!parsed || parsed.fingerprint !== modelFingerprint(model)) return 'foreign';
	if (parsed.answered !== item.result.coverage.answered || parsed.enabled !== item.result.coverage.enabled) return 'stale';
	if (item.result.total !== round2(item.storedTotal)) return 'stale';
	return 'current';
}
```

(Confidence, effort and complexity are deliberately OUTSIDE the fingerprint: they never enter the written total's arithmetic; the derived indicators are recomputed on read and stamped nowhere.)

- [ ] **Step 3: Implement `estimationItems.ts`** — one `getFileCache` per entry (md files only, dedupe by path), read each bound dimension key with `readNumber(ownValue(fm, d.key))`, scales likewise, `storedTotal = readNumber(ownValue(fm, model.valueKey))`, `storedStamp = readString(ownValue(fm, model.stampKey))`, `ownKeys` from `Object.prototype.hasOwnProperty`-style presence via `ownValue(fm, key) !== undefined` over the model's bound keys, then `result = computeTotal(...)`, `currency = currencyOf(...)`. Node tests fold into `weightedScore.test.ts` or a small `estimationItems.test.ts` using `FakeVault.entries()`.

- [ ] **Step 4: Failing view test** `test/view/estimation/table.test.ts`: a vault of three notes — one full profile, one partial (2 of 8), one with nothing — configured with `configured()`'s options; assert `.pbl-est-row` per RESULT, the full row shows the rounded total and `8/8`, the partial shows its renormalized total and `2/8`, the empty one shows the `none` currency word and no total, and clicking a row sets `aria-selected`/`pbl-selected` (selection field on the view; the panel consumes it in Task 7).

- [ ] **Step 5: Implement `renderTable.ts`** (a free function over the view, `renderPass.ts`'s shape): header row (`.pbl-est-head`) with `<button>` per column (Item, Value, Coverage, Confidence, Effort, Currency — labels via `t()`), one `.pbl-est-row[data-path]` per item with `role="option"`; pane `role="listbox"` + `tabindex="0"` + `aria-activedescendant` for the selected row; delegated click listener on the table element (never per-row closures over items — resolve by `data-path` against the current model, the view/'s standing rule). Currency words via `t()`: `'estimation.currency.current': 'Current'`, `'…stale': 'Needs re-estimation'`, `'…foreign': 'Another model'`, `'…handwritten': 'Hand-written'`, `'…orphan': 'Inputs gone'`, `'…none': '—'`. ArrowUp/ArrowDown move the selection, Enter opens the note (`this.app.workspace.getLeaf(false).openFile(item.file)` — asserted via `vault.opened`). Sort clicks are Task 9; render them inert-but-labelled or plain text for now — pick plain `<div>` labels this task, upgraded to buttons in Task 9 (avoids shipping a dead control).

- [ ] **Step 6: `npm run check`; docs edits; Commit**

```bash
git add src/domain/weightedScore.ts src/domain/estimationItems.ts src/view/estimation/ src/i18n/en.ts test/ docs/
git commit -m "Derive the weighted total, its stamp and the estimation table"
```

---

### Task 7: The panel, the gated write-back, and the orphan action

**Files:**
- Create: `src/storage/propertyWrite.ts`, `src/view/estimation/panel.ts`, `src/view/estimation/scoring.ts`
- Modify: `src/storage/frontmatter.ts` (export `rawValueOf` and `sameRaw` — two `export` keywords, nothing else), `src/view/estimation/estimationView.ts` (gate wiring, panel mount, refresh-after-write), `src/i18n/en.ts`, `src/storage/CLAUDE.md` + root `CLAUDE.md` (the write-boundary sentence now names three files: `frontmatter.ts`, `createNote.ts`, `propertyWrite.ts`), `docs/requirements/A rubric for every point.md` (+`## Where it lives`: `panel.ts`), `docs/requirements/The weighted score.md` (add `scoring.ts`, `propertyWrite.ts`)
- Test: `test/storage/propertyWrite.test.ts`, `test/view/estimation/scoring.test.ts`

**Interfaces:**
- Produces (`propertyWrite.ts`):

```ts
export interface PropertySet { key: string; value: unknown | null; ifMissing?: boolean } // null REMOVES; ifMissing writes only when the live note lacks the key
export interface PropertyWrite { file: TFile; sets: PropertySet[] }
export async function applyPropertyWrites(app: App, writes: PropertyWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void): Promise<WriteOutcome>;
```

- Produces (`scoring.ts`):

```ts
/** The one place an estimation write is planned — every input calls this, none plans beside it. */
export function planScoreWrite(model: ScoringModel, item: EstimationItem, dimensionId: string, value: number | null): PropertyWrite | null; // null when picking writes nothing (the checkmark question, asked of the plan)
export function planScaleWrite(model: ScoringModel, item: EstimationItem, scale: 'confidence' | 'effort' | 'complexity', value: number | null): PropertyWrite | null;
export function planOrphanCleanup(model: ScoringModel, item: EstimationItem): PropertyWrite | null; // removes total+stamp; only when currency is 'orphan'
```

- Consumes: `WriteGate<PropertyWrite>` (Task 3), `applyPropertyWrites`, `computeTotal`/`stampValue` (Task 6).

- [ ] **Step 1: Failing storage tests** `test/storage/propertyWrite.test.ts` (node, `FakeVault`): sets a value via `setOwn` semantics (`__proto__` key round-trips as data), null removes the key, `ifMissing` leaves an existing value alone and fills an absent one, an effective change emits a `RestoreWrite` whose replay through the real `applyRestores` puts the prior value back (absence included), a no-op write emits no inverse.

- [ ] **Step 2: Implement `propertyWrite.ts`:**

```ts
import { App, TFile } from 'obsidian';
import { KeyRestore, RestoreWrite, WriteOutcome, rawValueOf, sameRaw } from './frontmatter';
import { setOwn } from './ownProperty';

/**
 * Plain key/value frontmatter batches — the estimation view's writer, and the
 * third file inside the write boundary (root CLAUDE.md names all three). It
 * captures the same RestoreWrite inverses `applyWrites` does, so `applyRestores`
 * replays either's batches without knowing which writer produced them.
 */
export async function applyPropertyWrites(app, writes, onProgress?, onInverse?): Promise<WriteOutcome> {
	const outcome: WriteOutcome = { changed: false, dates: null };
	let done = 0;
	for (const write of writes) {
		let inverse: RestoreWrite | null = null;
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			const prior = write.sets.map((s) => rawValueOf(fm, s.key));
			for (const s of write.sets) {
				if (s.ifMissing) {
					if (!rawValueOf(fm, s.key).present) setOwn(fm, s.key, s.value);
				} else if (s.value === null) delete fm[s.key];
				else setOwn(fm, s.key, s.value);
			}
			const changed: KeyRestore[] = [];
			write.sets.forEach((s, i) => {
				const written = rawValueOf(fm, s.key);
				if (!sameRaw(prior[i], written)) changed.push({ key: s.key, prior: prior[i], written });
			});
			if (changed.length > 0) inverse = { file: write.file, keys: changed };
		});
		if (inverse) {
			outcome.changed = true;
			onInverse?.(inverse);
		}
		onProgress?.(++done, writes.length);
	}
	return outcome;
}
```

(A duplicate key in one `sets` list captures per-entry priors in order; callers here never produce one.)

- [ ] **Step 3: Failing view tests** `test/view/estimation/scoring.test.ts`:
  - Picking point 4 on `customer-value` for a note with an existing profile writes EXACTLY three keys in one batch: the score, the recomputed rounded total, the stamp `answered/enabled fingerprint` — assert via `vault.fm(path)` and `vault.writeLog` (one file, one write).
  - Picking the point already held plans nothing (`writeLog` unchanged, undo slot untouched).
  - Picking a score on the LAST unanswered dimension → coverage in the stamp says full.
  - Clearing the only answered dimension removes score, total AND stamp (the no-answers rule: nothing computed, nothing left claiming otherwise).
  - Undo (drive `view.undoLast()`) restores all three keys.
  - A weight edit in the config (`config` values changed + `refresh`) flips the row's currency to `Needs re-estimation` without any write.
  - The orphan case: hand-delete the score keys in the vault, refresh → currency `Inputs gone`; the panel's cleanup button removes total+stamp through the gate; nothing removes them on render (assert `writeLog` empty after refresh alone).

- [ ] **Step 4: Implement.** `scoring.ts` plans (pure): new answers map = item.answers with the picked value; `result = computeTotal(model, next)`; sets = `[{ key: dimension.key, value }, ...]` where value null when clearing (only offered while `item.ownKeys` has the key — presence, the register's removal rule); plus `result ? [{ key: model.valueKey, value: result.total }, { key: model.stampKey, value: stampValue(model, result.coverage) }] : [{ key: model.valueKey, value: null }, { key: model.stampKey, value: null }]` — the null pair only when the keys are present on the note. Return null when the batch would change nothing (same picked value; the checkmark/selected state is derived from exactly this null). `panel.ts` renders for the selected item: one `.pbl-est-dim` row per dimension — label, the points as real `<button class="pbl-est-point">` (`aria-pressed` on the held one, `aria-label` = `${value} — ${rubric[value - min]}`; `title` likewise), the held point's rubric sentence in `.pbl-est-rubric`; then confidence / effort / complexity rows from their `ScaleConfig`s (buttons only when the scale's key is bound; a bare label row otherwise); then the decomposition list (per answered dimension `score × weight`), coverage, total, and the two labelled derived lines: confidence-adjusted value `round2(total × confidence / 5)` and value-to-effort `round2(adjusted / effort)` — each rendered ONLY beside its inputs and only when its inputs exist; then the orphan/cleanup button when `currency === 'orphan'`. The panel is ordinary UI: real buttons, Tab reaches them (chrome beside the composite — the toolbar rule, not the tree's). On a pick: `void view.performScore(item, dimensionId, value)` on the view → plan → `gate.applySafely([write])` → `refresh()` → **refocus the same point button** (retrieve by `data-dim`/`data-value` after the rebuild — the shelf controls' focus rule: the pressed button is gone with the frame). The view wires its gate in this task:

```ts
this.gate = new WriteGate<PropertyWrite>(
	{
		app: () => this.app,
		writeProblems: () => modelProblems(this.settings.model),
		// Every row is a result; a path not in the model is not this base's to write.
		outsideFilter: (path) => !this.model || !this.model.byPath.has(path),
	},
	{ syncBusy: () => this.syncBusy(), flushDataUpdate: () => this.refresh() },
	this.lock,
	(writes, onProgress, onInverse) => applyPropertyWrites(this.app, writes, onProgress, onInverse),
);
```

`onDataUpdated()` gains the backlog's defer shape: `if (this.gate.deferUpdate()) return; this.refresh();`. The view also exposes the gate as its write path — `applySafely(writes: PropertyWrite[]) { return this.gate.applySafely(writes); }`, `canUndo()`, `undoLast()` — one-line delegates, the backlog's shape; Task 8 consumes `applySafely`. `onunload` gains `this.gate.dispose();`. `syncBusy()` this round: set/remove `aria-busy` on the pane (no toolbar yet). A dimension whose stored value was clamped (`result.clamped` names it) shows a short muted note in its panel row — `t('estimation.clamped'): 'Out of range — read as {value}'` — the clamp reported on the estimation surface, never silently.

- [ ] **Step 5: `npm run check`** (the boundary docs edits included: root `CLAUDE.md`'s "never write frontmatter outside" sentence and `src/storage/CLAUDE.md`'s opening rule now name `propertyWrite.ts` — keep the directory-ban sentence untouched, it already covers the new file).

- [ ] **Step 6: Commit**

```bash
git add src/storage/propertyWrite.ts src/storage/frontmatter.ts src/view/estimation/ src/i18n/en.ts test/ CLAUDE.md src/storage/CLAUDE.md docs/
git commit -m "Score against the rubric and write back the total with its stamp"
```

---

### Task 8: Bind-and-backfill from the guided empty state

**Files:**
- Create: `src/view/estimation/init.ts`
- Modify: `src/domain/defaultModel.ts` (nothing — `SUGGESTED_KEYS` already exists), `src/view/estimation/estimationView.ts` (empty state gains the button; hint key text), `src/i18n/en.ts`, `docs/requirements/The prioritized list.md` (name `init.ts`)
- Test: `test/view/estimation/init.test.ts`

**Interfaces:**
- Produces: `runEstimationInit(view: EstimationView): Promise<void>` — binds every untouched suggested option whose key no other estimation option owns, then stubs the bound keys (`ifMissing`, `''`) onto every RESULT note through the gate.
- Consumes: `SUGGESTED_KEYS`, `applyPropertyWrites` via the gate, `config.set(option, 'note.' + suggested)`.

- [ ] **Step 1: Failing tests:** on an unconfigured view with two result notes, the empty state renders a `Use recommended defaults` button; clicking it (a) writes all 13 options into the config (`config.set` recorded by `FakeViewConfig`), (b) stubs the 13 keys as `''` on both notes (`vault.fm`), (c) leaves an existing value alone (pre-set `business-value: 4` on one note survives), (d) re-renders into the table state. A view where the user CLEARED `valueProperty` (`''` in config) adopts everything except that option (cleared is a decision — the same `config.get(option) !== undefined` test `adoptableProperties` uses). Pressing it twice binds nothing the second time.

- [ ] **Step 2: Implement `init.ts`:**

```ts
/** The estimation view's ✨: bind untouched suggestions, then backfill the keys —
 * two halves of one action, gated on the model's own problems first (runInit's rule). */
/** Every frontmatter key the resolved model binds — '' (unbound) filtered out. */
export function boundKeys(model: ScoringModel): string[] {
	return [
		...model.dimensions.map((d) => d.key),
		model.confidence.key, model.effort.key, model.complexity.key,
		model.valueKey, model.stampKey,
	].filter((key) => key !== '');
}

export async function runEstimationInit(view: EstimationView): Promise<void> {
	// Keys already spoken for come from the RESOLVED settings (which keys are taken);
	// which options were ever touched is asked of the config — adoptableProperties'
	// own split, over this view's key list.
	const taken = new Set(boundKeys(view.settings.model));
	for (const { option, suggested } of SUGGESTED_KEYS) {
		if (view.config.get(option) !== undefined || taken.has(suggested)) continue;
		taken.add(suggested);
		view.config.set(option, notePropertyId(suggested));
	}
	view.refresh(); // resolve the just-bound model before planning the stubs
	if (modelProblems(view.settings.model).length > 0) return; // the warning surface is on screen
	const keys = boundKeys(view.settings.model);
	const writes = (view.data?.data ?? [])
		.filter((e) => e.file?.extension === 'md')
		.map((e) => ({ file: e.file, sets: keys.map((key) => ({ key, value: '', ifMissing: true })) }));
	await view.applySafely(writes);
}
```

(`notePropertyId` from `domain/optionalProperties.ts` — the one generic helper reused directly; the adoption loop mirrors `adoptableProperties`' never-set/taken rules over the estimation's own table, which is the "reused rather than copied, over its own key list" the epic asks for.)

- [ ] **Step 3: Wire the button** in `renderUnconfigured` (`t('estimation.empty.useDefaults'): 'Use recommended defaults'`; hint becomes `'Bind the suggested properties and stub them onto the results, or name your own in the view options.'`). Run tests → green.

- [ ] **Step 4: `npm run check`; Commit**

```bash
git add src/view/estimation/ src/i18n/en.ts test/view/estimation/init.test.ts docs/
git commit -m "Bind and backfill the estimation properties from the empty state"
```

---

### Task 9: Sort — clickable headers, persisted per saved view

**Files:**
- Modify: `src/storage/viewStateStore.ts` (`ViewPrefs.estimationSort?: string` + one `PREF_READERS` row), `src/view/estimation/estimationView.ts` + `renderTable.ts` (header buttons, sort state, identity + load/save), `src/i18n/en.ts` (column labels if not already), `docs/requirements/The prioritized list.md` (sort paragraph in `## Where it lives`)
- Test: `test/view/estimation/sort.test.ts`, extend `test/storage/viewStateStore` suite with the reader row (find the existing PREF_READERS test file via `grep -rl PREF_READERS test/`)

**Interfaces:**
- Produces: sort value string `` `${column}:${direction}` `` with column ∈ `title|total|coverage|confidence|effort|currency`, direction ∈ `asc|desc`; reader validates with the store's `oneOf` pattern over the 12 combinations (spelled as strings — stored state is not trusted as a type). Default (absent) = Base order, unsorted.
- Consumes: `resolveViewIdentity(app, viewEl, config.name)`, `loadViewState`, `saveViewState` (`storage/viewStateStore.ts`), the store's read-defensively rules.

- [ ] **Step 1: Failing tests:** clicking the `Value` header sorts descending first (numbers: desc is the useful first ask; title: asc first), clicking again flips, unanswered totals sort LAST in both directions (absence is not a low value); with `base` + `viewName` set in the harness, the pick survives a second `makeEstimationView` against the same vault (persistence); an invalid stored value is ignored (defensive read).

- [ ] **Step 2: Implement.** Header cells become real `<button>`s with `aria-sort` on the active column. Sorting happens at render over `model.items` (never mutating the model's own order); `null` totals/values partition after the sorted block. On pick: resolve identity (session-only when null — the store's own rule), `const snapshot = loadViewState(app, id); saveViewState(app, id, { ...snapshot, prefs: { ...snapshot.prefs, estimationSort: pick } })`; on `refresh()`, read it back the same way. Match the store's existing reader style exactly for the `PREF_READERS` row (copy an adjacent `oneOf` row).

- [ ] **Step 3: `npm run check`; Commit**

```bash
git add src/storage/viewStateStore.ts src/view/estimation/ test/ docs/
git commit -m "Sort the estimation table and keep the pick per saved view"
```

---

### Task 10: Register sweep, changelog, handover

**Files:**
- Modify: `docs/requirements/Business value estimation.md` (nothing structural — verify its claims against what shipped; the epic stays Open), `CHANGELOG.md` (`[Unreleased]` entries), `docs/README.md` only if its folder table claims need it (unlikely), root `CLAUDE.md` (one sentence under Architecture: the second view and where registration lives — keep it a rule, not an inventory)
- Verify: every task's `## Where it lives` sections landed; the harness mock file is still uncommitted (`git status`)

- [ ] **Step 1: Sweep.** `npm run check` from clean; `grep -rn "estimation" docs/requirements/*.md` and read the three edited notes end to end — no note may promise more than the code delivers (write the guarantee to the check): the rubric editing surface is `.base`-only this round, the estimation status property is not written, scenarios/presets/matrix are untouched features.

- [ ] **Step 2: CHANGELOG** under `[Unreleased]`:

```markdown
### Added
- A second Bases view, Estimation (`product-estimation`): score items against a
  configurable weighted model with per-point rubrics; the consolidated business
  value is written back with a model stamp and coverage, and every total's
  currency (current, needs re-estimation, another model, hand-written) is
  derived on read.

### Changed
- The write path's serialization and single undo slot are now plugin-wide: a
  write in one view briefly blocks the other's, and undo takes back the vault's
  last batch whichever view wrote it (ADR 0030).
```

- [ ] **Step 3: Final `npm run check`, then `npm run test-build`** and hand over: ask the user to open the repository as a vault and verify the live-vault items jsdom cannot — the second entry in Obsidian's view picker (name + icon), the options menu's groups on a real `.base`, scoring a real note and watching the total + stamp land, undo across the two views, and both themes' look against the Task 2 screenshots.

- [ ] **Step 4: Commit and push**

```bash
git add -A && git status   # confirm mock.ts is NOT staged; unstage if it is
git commit -m "Record the estimation view in the register and the changelog"
git push -u origin claude/plugin-refactor-brainstorm-av0s6j
```

---

## Deliberately out of this plan

The matrix plot, scenarios, presets, estimation-status writes, estimation history, inheritance, rubric editing UI, cross-view navigation, the `view/` per-view lint split, every projection extraction — each already has a register note; none is started here. If `BasesView`'s real runtime surface differs from the mock's (e.g. `contentEl` ownership), fix the mock the documented way (extend minimally) rather than working around it in `src/`.
