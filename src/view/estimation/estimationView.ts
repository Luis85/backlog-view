import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationSettings, ScaleName, resolveEstimationSettings } from '../../domain/estimationSettings';
import { estimationUnconfigured, modelProblems } from '../../domain/scoringModel';
import { buildEstimationModel, EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { WriteOutcome } from '../../storage/frontmatter';
import { applyPropertyWrites, PropertyWrite } from '../../storage/propertyWrite';
import { WriteGate } from '../writeGate';
import { WriteLock } from '../writeLock';
import { renderTable } from './renderTable';
import { renderPanel } from './panel';
import { planOrphanCleanup, planScaleWrite, planScoreWrite } from './scoring';

export const ESTIMATION_VIEW_TYPE = 'product-estimation';

/**
 * The estimation view: the plugin's second Bases view (ADR 0030). Draws its own states —
 * loading, the guided-unconfigured empty state, a config warning naming every problem —
 * and, once a model is fit to score with, the table (`renderTable.ts`) beside the
 * per-item panel (`panel.ts`) that is this task's own write-back surface.
 *
 * Renders straight into `viewEl`, with no intermediate content wrapper: `.pbl-est-view`
 * (`styles/estimation.css`) is a two-column CSS Grid whose track sizing applies to DIRECT
 * children, so the table and the panel land there directly — a wrapper here would put
 * both of them, one nested div later, into the grid's single first cell.
 */
export class EstimationView extends BasesView {
	type = ESTIMATION_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: EstimationSettings;
	readonly lock: WriteLock;
	readonly gate: WriteGate<PropertyWrite>;
	/** The row whose panel is on screen — set by the table's click and its arrow keys. */
	selectedPath: string | null = null;
	/** The last built model, read by the gate's `outsideFilter` — null before the first
	 *  successful render (loading, unconfigured, or a broken model scores nothing). */
	model: EstimationModel | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement, lock: WriteLock = new WriteLock()) {
		super(controller);
		this.lock = lock;
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view pbl-est-view' });
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

	/**
	 * `estimationUnconfigured` is asked FIRST: `modelProblems` on a fresh config would
	 * name every dimension unbound, which is correct for a model that is broken but wrong
	 * for one nobody has touched yet — the dimension-key problem only means something
	 * once something else is bound.
	 */
	render(): void {
		this.viewEl.empty();
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
		renderTable(this, this.model);
		renderPanel(this, this.model);
	}

	/** Publish the gate's progress the one way this view has so far: no toolbar yet. */
	syncBusy(): void {
		if (this.gate.busy) this.viewEl.setAttribute('aria-busy', 'true');
		else this.viewEl.removeAttribute('aria-busy');
	}

	/**
	 * The view's write path, delegated straight to the gate — `writeGate.ts`'s own
	 * shape, so a later consumer (the toolbar, Task 8) needs nothing from the gate
	 * itself. Nothing in this task calls these three from outside the class yet — the
	 * panel's own picks go through `performScore`/`performScale`/`performOrphanCleanup`
	 * below — so fallow reads them as unused class members until Task 8 wires a caller;
	 * suppressed rather than hidden behind `usedClassMembers`, which is for members a
	 * FRAMEWORK invokes, not ones a later task in this same epic will.
	 */
	// fallow-ignore-next-line unused-class-member
	applySafely(writes: PropertyWrite[]): Promise<WriteOutcome | null> {
		return this.gate.applySafely(writes);
	}

	// fallow-ignore-next-line unused-class-member
	canUndo(): boolean {
		return this.gate.canUndo();
	}

	// fallow-ignore-next-line unused-class-member
	undoLast(): Promise<boolean> {
		return this.gate.undoLast();
	}

	/** A dimension pick: plan, write, redraw. `panel.ts` refocuses the rebuilt point
	 *  button once this settles — `null` from the planner means nothing to do at all. */
	async performScore(item: EstimationItem, dimensionId: string, value: number | null): Promise<void> {
		const plan = planScoreWrite(this.settings.model, item, dimensionId, value);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		this.refresh();
	}

	/** A confidence/effort/complexity pick — the same shape as a score pick, over the
	 *  scale's own planner (which never touches the total or its stamp). */
	async performScale(item: EstimationItem, scale: ScaleName, value: number | null): Promise<void> {
		const plan = planScaleWrite(this.settings.model, item, scale, value);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		this.refresh();
	}

	/** Removes an orphaned total and stamp — offered only while `item.currency` reads
	 *  'orphan', and only ever a write in response to this action, never on render. */
	async performOrphanCleanup(item: EstimationItem): Promise<void> {
		const plan = planOrphanCleanup(this.settings.model, item);
		if (!plan) return;
		await this.gate.applySafely([plan]);
		this.refresh();
	}

	private renderUnconfigured(): void {
		const box = this.viewEl.createDiv({ cls: 'pbl-empty pbl-est-empty' });
		box.createDiv({ text: t('estimation.empty.unconfigured') });
		// The init button lands in a later task; until then the guidance names the options menu.
		box.createDiv({ cls: 'pbl-empty-hint', text: t('estimation.empty.hint') });
	}

	private renderProblems(problems: string[]): void {
		const box = this.viewEl.createDiv({ cls: 'pbl-config-warning' });
		box.createDiv({ text: t('estimation.problems.lead') });
		const list = box.createEl('ul');
		for (const p of problems) list.createEl('li', { text: p });
	}
}
