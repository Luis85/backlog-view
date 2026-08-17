import { BasesView, QueryController } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationSettings, resolveEstimationSettings } from '../../domain/estimationSettings';
import { estimationUnconfigured, modelProblems } from '../../domain/scoringModel';
import { WriteLock } from '../writeLock';

export const ESTIMATION_VIEW_TYPE = 'product-estimation';

/**
 * The estimation view: the plugin's second Bases view (ADR 0030). This task builds only
 * its states — loading, the guided-unconfigured empty state, a config warning naming
 * every problem, and a placeholder frame for a configured model — never the table itself,
 * which is Task 6.
 *
 * Renders straight into `viewEl`, with no intermediate content wrapper: `.pbl-est-view`
 * (`styles/estimation.css`) is a two-column CSS Grid whose track sizing applies to DIRECT
 * children, so the table and the panel Task 6 adds have to land there directly — a
 * wrapper here would put both of them, one nested div later, into the grid's single first
 * cell.
 */
export class EstimationView extends BasesView {
	type = ESTIMATION_VIEW_TYPE;
	readonly viewEl: HTMLElement;
	settings: EstimationSettings;
	readonly lock: WriteLock;

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

	/**
	 * `estimationUnconfigured` is asked FIRST: `modelProblems` on a fresh config would
	 * name every dimension unbound, which is correct for a model that is broken but wrong
	 * for one nobody has touched yet — the dimension-key problem only means something
	 * once something else is bound.
	 */
	render(): void {
		this.viewEl.empty();
		const model = this.settings.model;
		if (estimationUnconfigured(model)) return this.renderUnconfigured();
		const problems = modelProblems(model);
		if (problems.length > 0) return this.renderProblems(problems);
		// Task 6 replaces this placeholder with the table.
		this.viewEl.createDiv({ cls: 'pbl-est-table', text: t('estimation.empty.noResults') });
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
