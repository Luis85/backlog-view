import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationSettings, ScaleName, resolveEstimationSettings } from '../../domain/estimationSettings';
import { estimationUnconfigured, modelProblems } from '../../domain/scoringModel';
import { buildEstimationModel, EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { planOrphanCleanup, planRestamp, planScaleWrite, planScoreWrite, PropertyWrite } from '../../domain/estimationWritePlan';
import { WriteOutcome } from '../../storage/frontmatter';
import { applyPropertyWrites } from '../../storage/propertyWrite';
import { WriteGate } from '../writeGate';
import { WriteLock } from '../writeLock';
import { guidanceShell } from '../render/emptyStates';
import { renderTable } from './renderTable';
import { renderPanel } from './panel';
import { runEstimationInit } from './init';
import { renderEstimationToolbar, syncEstimationToolbar } from './toolbar';

export const ESTIMATION_VIEW_TYPE = 'product-estimation';

/**
 * The estimation view: the plugin's second Bases view (ADR 0030). Draws its own states —
 * loading, the guided-unconfigured empty state, a config warning naming every problem —
 * and, once a model is fit to score with, the toolbar (`toolbar.ts`) above the table
 * (`renderTable.ts`) beside the per-item panel (`panel.ts`) that is this task's own
 * write-back surface.
 *
 * `viewEl` is a flex COLUMN (`.pbl-est-shell`) holding the toolbar and, once there is a
 * model to draw, `contentEl` — a second element (`gridEl`) rather than `viewEl` itself:
 * `.pbl-est-view` (`styles/estimation.css`) is a two-column CSS Grid whose track sizing
 * applies to DIRECT children, so putting the toolbar inside it would spend a track on the
 * toolbar, and nesting the table and the panel one div deeper than `viewEl` would put both
 * of them, one nested div later, into the grid's single first cell.
 */
export class EstimationView extends BasesView {
	type = ESTIMATION_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: EstimationSettings;
	readonly lock: WriteLock;
	readonly gate: WriteGate<PropertyWrite>;
	/** The row whose panel is on screen — set by the table's click and its arrow keys. */
	selectedPath: string | null = null;
	/** The mounted `.pbl-est-panel`, or null while nothing is selected — `panel.ts`'s own
	 *  field so `renderPanel` removes it by reference rather than by `querySelector`. */
	panelEl: HTMLElement | null = null;
	/** The mounted `.pbl-est-table` — `renderTable.ts`'s own field, read for its
	 *  `scrollTop` by `render()` below BEFORE it empties the pane, so a pick made in the
	 *  panel beside it does not throw a scrolled reader back to row one. Mirrors
	 *  `panelEl`, one track over. */
	tableEl: HTMLElement | null = null;
	/**
	 * The table's active sort, as `${column}:${direction}` — null for Base order,
	 * unsorted. Read and written by `renderTable.ts` alone (`restoreSort`/`setSort`),
	 * the same "a free function mutates a plain field on the view" shape
	 * `selectedPath` above already uses; persisted per saved view where this view can
	 * be identified, session-only otherwise (`resolveViewIdentity`'s own rule).
	 */
	sortPick: string | null = null;
	/** The last built model, read by the gate's `outsideFilter` — null before the first
	 *  successful render (loading, unconfigured, or a broken model scores nothing). */
	model: EstimationModel | null = null;
	/** The two-track grid inside the shell — `renderTable` and `renderPanel` create into
	 *  THIS (via `contentEl`), never into `viewEl`, which now holds the toolbar above it.
	 *  Null before the first successful render, exactly like `model`, and through both
	 *  early-return states below — neither one ever draws a grid at all. */
	gridEl: HTMLElement | null = null;

	// No default: `registerEstimationView` always threads the plugin-wide lock through,
	// and a silent per-view fallback here is exactly the bug that call exists to avoid —
	// a view sharing undo and serialization with nobody. `makeEstimationView` is where a
	// test that does not care gets a fresh one instead (`view/CLAUDE.md`'s own note).
	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock) {
		super(controller);
		this.lock = lock;
		// `.pbl-est-shell` is a flex COLUMN — the toolbar, then the grid. The grid is its own
		// element and not this one: `.pbl-est-view`'s track sizing applies to DIRECT children,
		// so putting the toolbar inside the grid would spend a track on it, and nesting the
		// table one div deeper would put the table and the panel into the grid's single first
		// cell. One element per job.
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-est-shell' });
		// Nothing to render until Bases delivers the first result set — say what is
		// happening instead of showing an empty pane (the backlog view's own rule).
		this.viewEl.setText(t('estimation.loading'));
		// `config`/`data`/`app` are not assigned until after construction (Obsidian's
		// contract, `src/view/CLAUDE.md`'s Lifecycle section), so the initial model is
		// resolved from a config that answers "nothing is set" rather than from `this.config`.
		this.settings = resolveEstimationSettings({ get: () => undefined, getAsPropertyId: () => null } as never);
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
	}

	onunload(): void {
		this.gate.dispose();
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		// A batch write touches one file at a time; deferring the rebuild until the
		// whole batch settles is what keeps a multi-key write from redrawing the panel
		// mid-flight (`WriteGate`'s own contract, the backlog view's shape).
		if (this.gate.deferUpdate()) return;
		this.refresh();
	}

	/** Re-resolve settings and redraw — the stable name later tasks call after a write. */
	refresh(): void {
		this.settings = resolveEstimationSettings(this.config);
		this.render();
	}

	/** Where a projection draws: the grid once one exists (`gridEl`), the shell otherwise
	 *  (`viewEl`). The `?? this.viewEl` fallback is defensive rather than exercised —
	 *  `renderUnconfigured` and `renderProblems` create their own elements straight off
	 *  `viewEl` and never call this getter, so its only real callers (`renderTable`,
	 *  `renderPanel`) run after `gridEl` is already assigned. If a caller of this getter
	 *  is ever added to either early-return branch, `renderPanel`'s
	 *  `contentEl.toggleClass('pbl-est-no-panel', …)` would then be able to stamp that
	 *  class on the shell, where no rule reads it. */
	get contentEl(): HTMLElement {
		return this.gridEl ?? this.viewEl;
	}

	/**
	 * `estimationUnconfigured` is asked FIRST: `modelProblems` on a fresh config would
	 * name every dimension unbound, which is correct for a model that is broken but wrong
	 * for one nobody has touched yet — the dimension-key problem only means something
	 * once something else is bound.
	 */
	render(): void {
		// BEFORE the teardown, and that order is the whole of why these are read here
		// rather than where they are used: `empty()` detaches the table and the panel, a
		// detached element has no layout box, and `scrollTop` on one answers 0 in a browser
		// however far the reader had scrolled. Read after it, the restore was a no-op that
		// jsdom could not see — it answers with whatever was last assigned, connected or not.
		const tableScrollTop = this.tableEl?.scrollTop ?? 0;
		const panelScrollTop = this.panelEl?.scrollTop ?? 0;
		this.viewEl.empty();
		// Cleared with the teardown above and stays null through both early returns below —
		// the guided empty state and the config-warning block draw straight into `viewEl`
		// (the shell), not through `contentEl`, so this null is never actually read by
		// either. Only the configured path (bottom of this method) ever creates a grid
		// again and starts reading `contentEl` for real.
		this.gridEl = null;
		const model = this.settings.model;
		if (estimationUnconfigured(model)) {
			this.model = null;
			return this.renderUnconfigured();
		}
		const problems = modelProblems(model);
		if (problems.length > 0) {
			this.model = null;
			return this.renderProblems(problems);
		}
		this.model = buildEstimationModel(this.app, this.data?.data ?? [], model);
		// The toolbar renders BEFORE the grid and is `viewEl`'s own child, never the grid's:
		// unconfigured and config-warning states carry no toolbar (the guided empty state
		// already has its own ✨, and a second one above it would duplicate it).
		renderEstimationToolbar(this, this.viewEl, this.model);
		const gridEl = this.viewEl.createDiv({ cls: 'pbl-est-view' });
		// Defaults every frame to the single-column grid; `renderPanel` is the only place
		// that ever clears it, and only that call ever draws a second column's worth of
		// content — found in Chromium, where the grid's `minmax(320px, 420px)` track sat
		// reserved and empty whenever nothing was selected, a defect no jsdom assertion
		// could see because nothing there lays out a track.
		gridEl.toggleClass('pbl-est-no-panel', true);
		this.gridEl = gridEl;
		renderTable(this, this.model, tableScrollTop);
		renderPanel(this, this.model, panelScrollTop);
	}

	/**
	 * Publish the gate's progress two ways: `aria-busy` on the whole pane, and — the
	 * toolbar's own reason to exist — the init and undo buttons' disabled state, via
	 * `syncEstimationToolbar`. That query reaches TWO buttons across two states, not one:
	 * the toolbar's ✨ and the guided empty state's setup button both carry
	 * `pbl-est-init` on purpose, so the same action goes quiet on the same fact wherever it
	 * is drawn (`renderUnconfigured` below says why). Only the config warning, which draws
	 * neither, leaves it finding nothing. Asks the LOCK rather than this gate's own progress — a
	 * batch the backlog view is writing changes the very notes this table shows, and this
	 * view's own data update is deferred on it, so its content is mid-change whoever is
	 * doing the writing.
	 */
	syncBusy(): void {
		if (this.gate.writing) this.viewEl.setAttribute('aria-busy', 'true');
		else this.viewEl.removeAttribute('aria-busy');
		syncEstimationToolbar(this);
	}

	/**
	 * The view's write path, delegated straight to the gate — `writeGate.ts`'s own
	 * shape. `applySafely` has its production callers (`init.ts`'s `runEstimationInit`,
	 * the guided empty state's setup action and now the toolbar's own ✨; the panel's own
	 * picks and actions go through `applyPlan` below instead, which adds the refresh-skip
	 * on `flushedLastBatch` that every one of them needs).
	 * `canUndo`/`undoLast` are read and called straight off `view.gate` by the toolbar
	 * (`toolbar.ts`) rather than forwarded through a method here — `writeGate.ts`'s own
	 * shape, and the reason both are public.
	 */
	applySafely(writes: PropertyWrite[]): Promise<WriteOutcome | null> {
		return this.gate.applySafely(writes);
	}

	/**
	 * What every panel action DOES with what it planned: nothing at all for a `null` plan,
	 * or one batch through the gate and a redraw — skipped when the write's own
	 * deferred-update flush already drew this state (`WriteGate.flushedLastBatch`),
	 * otherwise every pick redrew twice.
	 *
	 * Extracted at the FOURTH copy, which is `CLAUDE.md`'s `applyRisk`/`applyLabels`
	 * precedent applied here rather than a preference: three restatements of one rule are
	 * three chances for it to drift, a fifth costs one line now instead of four, and
	 * fallow's clone detector reported nothing while all four copies stood, so no gate would
	 * have caught the fifth either. Each method below keeps its own comment for what it
	 * PLANS; the gate and the refresh are said once, here.
	 */
	private async applyPlan(plan: PropertyWrite | null): Promise<void> {
		if (!plan) return;
		await this.gate.applySafely([plan]);
		if (!this.gate.flushedLastBatch) this.refresh();
	}

	/** A dimension pick: the score, the recomputed total and its stamp in one batch.
	 *  `panel.ts` refocuses the rebuilt point button once this settles. */
	performScore(item: EstimationItem, dimensionId: string, value: number | null): Promise<void> {
		return this.applyPlan(planScoreWrite(this.settings.model, item, dimensionId, value));
	}

	/** A confidence/effort/complexity pick — the same shape as a score pick, over the
	 *  scale's own planner (which never touches the total or its stamp). */
	performScale(item: EstimationItem, scale: ScaleName, value: number | null): Promise<void> {
		return this.applyPlan(planScaleWrite(this.settings.model, item, scale, value));
	}

	/** Removes an orphaned total and stamp — offered only while `item.currency` reads
	 *  'orphan', and only ever a write in response to this action, never on render. */
	performOrphanCleanup(item: EstimationItem): Promise<void> {
		return this.applyPlan(planOrphanCleanup(this.settings.model, item));
	}

	/** Rewrites a stored total and stamp from the answers on the note — offered only while
	 *  `item.currency` reads 'stale' or 'foreign', and only ever a write in response to
	 *  this action. */
	performRestamp(item: EstimationItem): Promise<void> {
		return this.applyPlan(planRestamp(this.settings.model, item));
	}

	private renderUnconfigured(): void {
		const empty = guidanceShell(this.viewEl, 'calculator', t('estimation.empty.unconfigured'), t('estimation.empty.hint'));
		empty.addClass('pbl-est-empty');
		// `pbl-est-init` is not decoration — it is how `syncEstimationToolbar` FINDS this
		// button to disable it. It runs the same action as the toolbar's ✨, so it has to
		// go quiet on the same fact; without the class nothing ever disabled it, which is
		// what made the bind-then-refuse hole reachable by a click.
		const btn = empty.createEl('button', { cls: 'mod-cta pbl-est-init', text: t('estimation.empty.useDefaults') });
		btn.addEventListener('click', () => void runEstimationInit(this));
	}

	/** A block, not `.pbl-config-warning`: that class is an inline-flex pill sized for
	 *  one line beside the toolbar's other controls, and this reads as prose plus a
	 *  list — `styles/estimation.css`'s own `.pbl-est-problems` states why. */
	private renderProblems(problems: string[]): void {
		const box = this.viewEl.createDiv({ cls: 'pbl-est-problems' });
		box.createDiv({ text: t('estimation.problems.lead') });
		const list = box.createEl('ul');
		for (const p of problems) list.createEl('li', { text: p });
	}
}
