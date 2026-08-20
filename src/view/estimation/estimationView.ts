import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationSettings, ScaleName, resolveEstimationSettings } from '../../domain/estimationSettings';
import { estimationUnconfigured, modelProblems } from '../../domain/scoringModel';
import { buildEstimationModel, EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { planOrphanCleanup, planScaleWrite, planScoreWrite, PropertyWrite } from '../../domain/estimationWritePlan';
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

	/** Where a projection draws. The grid once one exists (`gridEl`); the shell otherwise
	 *  (`viewEl`), so the guided empty state and the config warning still land somewhere —
	 *  neither ever reaches the line below that creates a grid at all. */
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
		// the guided empty state and the config-warning block draw into `contentEl`, which
		// falls back to `viewEl` (the shell) for exactly as long as this is null. Only the
		// configured path (bottom of this method) ever creates a grid again.
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
	 * `syncEstimationToolbar` (a no-op query while no toolbar is drawn, the guided empty
	 * state and the config warning). Asks the LOCK rather than this gate's own progress — a
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
	 * picks go through `performScore`/`performScale`/`performOrphanCleanup` below instead,
	 * since each of those also needs its own refresh-skip on `flushedLastBatch`).
	 * `canUndo`/`undoLast` are read and called straight off `view.gate` by the toolbar
	 * (`toolbar.ts`) rather than forwarded through a method here — `writeGate.ts`'s own
	 * shape, and the reason both are public.
	 */
	applySafely(writes: PropertyWrite[]): Promise<WriteOutcome | null> {
		return this.gate.applySafely(writes);
	}

	/** A dimension pick: plan, write, redraw. `panel.ts` refocuses the rebuilt point
	 *  button once this settles — `null` from the planner means nothing to do at all.
	 *  The refresh is skipped when the write's own deferred-update flush already drew
	 *  this state (`WriteGate.flushedLastBatch`) — otherwise every pick redrew twice. */
	async performScore(item: EstimationItem, dimensionId: string, value: number | null): Promise<void> {
		const plan = planScoreWrite(this.settings.model, item, dimensionId, value);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		if (!this.gate.flushedLastBatch) this.refresh();
	}

	/** A confidence/effort/complexity pick — the same shape as a score pick, over the
	 *  scale's own planner (which never touches the total or its stamp). */
	async performScale(item: EstimationItem, scale: ScaleName, value: number | null): Promise<void> {
		const plan = planScaleWrite(this.settings.model, item, scale, value);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		if (!this.gate.flushedLastBatch) this.refresh();
	}

	/** Removes an orphaned total and stamp — offered only while `item.currency` reads
	 *  'orphan', and only ever a write in response to this action, never on render. */
	async performOrphanCleanup(item: EstimationItem): Promise<void> {
		const plan = planOrphanCleanup(this.settings.model, item);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		if (!this.gate.flushedLastBatch) this.refresh();
	}

	private renderUnconfigured(): void {
		const empty = guidanceShell(this.viewEl, 'calculator', t('estimation.empty.unconfigured'), t('estimation.empty.hint'));
		empty.addClass('pbl-est-empty');
		const btn = empty.createEl('button', { cls: 'mod-cta', text: t('estimation.empty.useDefaults') });
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
