import { setIcon } from 'obsidian';
import type { EstimationView } from './estimationView';
import { t } from '../../i18n/t';
import { EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { ScaleName } from '../../domain/estimationSettings';
import { ScoringModel } from '../../domain/scoringModel';
import { round2 } from '../../domain/weightedScore';

/**
 * The per-item panel beside the table (`docs/requirements/A rubric for every point.md`,
 * `docs/requirements/The weighted score.md`): one row per dimension and per bound scale,
 * the decomposition, the two derived numbers, and the orphan cleanup action — all read
 * straight off the already-scored `EstimationItem`, nothing recomputed here. A pick's
 * whole write path lives on the view (`performScore`/`performScale`/
 * `performOrphanCleanup`); this module only plans nothing and writes nothing itself.
 *
 * A free function over `EstimationView`, `renderTable.ts`'s own shape — `import type`
 * only, so `estimationView.ts` calling this stays a one-directional edge.
 */

/** One row's shape, whether it came from a `ScoringDimension` or a fixed `ScaleConfig` —
 *  both are `{key, min, max, rubric}` plus a label and an id, which is what lets one
 *  renderer draw a scored dimension and a scale the same way. */
interface RowSpec {
	kind: 'dim' | 'scale';
	id: string;
	label: string;
	key: string;
	min: number;
	max: number;
	rubric: string[];
	held: number | null;
	clamped: boolean;
	present: boolean;
}

/** Rebuilds the panel for whatever `view.selectedPath` names, or clears it. Safe to call
 *  from a full view render or from the table's own fast-path row selection. */
export function renderPanel(view: EstimationView, model: EstimationModel): void {
	view.viewEl.querySelector('.pbl-est-panel')?.remove();
	const item = view.selectedPath ? model.byPath.get(view.selectedPath) : undefined;
	if (!item) return;
	const scoringModel = view.settings.model;
	const panelEl = view.viewEl.createDiv({ cls: 'pbl-est-panel' });
	panelEl.createDiv({ cls: 'pbl-est-title', text: item.title });

	for (const dimension of scoringModel.dimensions) renderScoreRow(panelEl, dimSpec(item, dimension));

	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'confidence', t('estimation.panel.confidence')));
	panelEl.createEl('h4', { text: t('estimation.panel.effortComplexity') });
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'effort', t('estimation.panel.effort')));
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'complexity', t('estimation.panel.complexity')));

	renderDecomposition(panelEl, item, scoringModel);
	renderDerived(panelEl, item);
	if (item.currency === 'orphan') renderCleanupButton(panelEl);

	wirePanelEvents(view, panelEl, item);
}

function dimSpec(item: EstimationItem, dimension: ScoringModel['dimensions'][number]): RowSpec {
	return {
		kind: 'dim',
		id: dimension.id,
		label: dimension.label,
		key: dimension.key,
		min: dimension.min,
		max: dimension.max,
		rubric: dimension.rubric,
		held: item.answers.get(dimension.id) ?? null,
		clamped: item.result?.clamped.includes(dimension.id) ?? false,
		present: item.ownKeys.has(dimension.key),
	};
}

function scaleSpec(item: EstimationItem, model: ScoringModel, scale: ScaleName, label: string): RowSpec {
	const config = model[scale];
	return {
		kind: 'scale',
		id: scale,
		label,
		key: config.key,
		min: config.min,
		max: config.max,
		rubric: config.rubric,
		held: item[scale],
		clamped: false, // nothing computes a total off a scale, so nothing ever clamps one
		present: item.ownKeys.has(config.key),
	};
}

/** One `.pbl-est-dim` row: the label always, then — only while the key is bound — the
 *  point buttons, an optional clear control, and the held point's rubric or clamp note. */
function renderScoreRow(panelEl: HTMLElement, spec: RowSpec): void {
	const row = panelEl.createDiv({ cls: 'pbl-est-dim' });
	row.createDiv({ cls: 'pbl-est-dim-label', text: spec.label });
	if (spec.key === '') return; // bare label row: nothing bound, nothing to click or show
	const points = row.createDiv({ cls: 'pbl-est-points' });
	for (let value = spec.min; value <= spec.max; value++) {
		const active = spec.held === value;
		const sentence = `${value} — ${spec.rubric[value - spec.min]}`;
		const btn = points.createEl('button', {
			cls: 'pbl-est-point' + (active ? ' is-active' : ''),
			text: String(value),
			attr: {
				type: 'button',
				'data-dim': spec.id,
				'data-kind': spec.kind,
				'data-value': String(value),
				'aria-label': sentence,
				title: sentence,
			},
		});
		if (active) btn.setAttribute('aria-pressed', 'true');
	}
	if (spec.present) renderClearButton(points, spec);
	if (spec.clamped && spec.held !== null) {
		const shown = Math.min(spec.max, Math.max(spec.min, spec.held));
		row.createDiv({ cls: 'pbl-est-rubric', text: t('estimation.clamped', { value: shown }) });
	} else if (spec.held !== null && spec.held >= spec.min && spec.held <= spec.max) {
		row.createDiv({ cls: 'pbl-est-rubric', text: spec.rubric[spec.held - spec.min] });
	}
}

function renderClearButton(container: HTMLElement, spec: RowSpec): void {
	const label = t('estimation.panel.clear', { label: spec.label });
	const btn = container.createEl('button', {
		cls: 'clickable-icon',
		attr: { type: 'button', 'data-dim': spec.id, 'data-kind': spec.kind, 'data-value': '', 'aria-label': label, title: label },
	});
	setIcon(btn, 'x');
}

/** Score × weight per answered dimension, the coverage, and the total — nothing here
 *  when nothing is answered, since there is no decomposition of a total that is not there. */
function renderDecomposition(panelEl: HTMLElement, item: EstimationItem, model: ScoringModel): void {
	if (!item.result) return;
	const decomp = panelEl.createDiv({ cls: 'pbl-est-decomp' });
	for (const dimension of model.dimensions) {
		const score = item.answers.get(dimension.id);
		if (score === null || score === undefined) continue;
		decomp.createSpan({ text: t('estimation.panel.term', { label: dimension.label, score, weight: dimension.weight }) });
	}
	decomp.createDiv({ cls: 'pbl-est-coverage', text: `${item.result.coverage.answered}/${item.result.coverage.enabled}` });
	decomp.createDiv({ cls: 'pbl-est-total', text: String(item.result.total) });
}

/**
 * Confidence-adjusted value and value-to-effort — each only while its OWN inputs exist,
 * per `docs/requirements/The weighted score.md`'s write-back rule: derived on read,
 * never written. Value-to-effort's own formula divides the ADJUSTED value, so it can
 * never exist without confidence either — nothing here is a second, independent guard
 * on `adjusted`, because there is no state in which one renders without the other.
 */
function renderDerived(panelEl: HTMLElement, item: EstimationItem): void {
	if (!item.result || item.confidence === null) return;
	const adjusted = round2((item.result.total * item.confidence) / 5);
	const derived = panelEl.createDiv({ cls: 'pbl-est-derived' });
	derivedLine(derived, t('estimation.panel.adjustedLabel'), adjusted);
	if (item.effort) derivedLine(derived, t('estimation.panel.valueToEffortLabel'), round2(adjusted / item.effort));
}

function derivedLine(container: HTMLElement, label: string, value: number): void {
	const line = container.createSpan();
	line.appendText(`${label} `);
	line.createEl('strong', { text: String(value) });
}

function renderCleanupButton(panelEl: HTMLElement): void {
	panelEl.createEl('button', {
		text: t('estimation.panel.removeOrphan'),
		attr: { type: 'button', 'data-action': 'cleanup' },
	});
}

/**
 * One delegated listener on the panel root — never a per-button closure, so a pick that
 * rebuilds this whole panel cannot leave a stale one behind. Resolves a pick by
 * `data-dim`/`data-kind`/`data-value` (an empty value is the clear sentinel), and the
 * cleanup action separately by `data-action`.
 */
function wirePanelEvents(view: EstimationView, panelEl: HTMLElement, item: EstimationItem): void {
	panelEl.addEventListener('click', (evt) => {
		const target = evt.target instanceof Element ? evt.target.closest('button') : null;
		if (!(target instanceof HTMLElement)) return;
		if (target.dataset.action === 'cleanup') {
			void view.performOrphanCleanup(item);
			return;
		}
		const dim = target.dataset.dim;
		const kind = target.dataset.kind;
		if (dim === undefined || kind === undefined) return;
		const value = target.dataset.value === '' ? null : Number(target.dataset.value);
		void handlePick(view, item, kind, dim, value);
	});
}

/** Plan -> gate -> refresh happens inside the view's own `performScore`/`performScale`;
 *  once that settles, refocus the rebuilt panel's same point button — the shelf
 *  controls' own rule, because the pressed button is gone with the frame it was drawn in. */
async function handlePick(view: EstimationView, item: EstimationItem, kind: string, dim: string, value: number | null): Promise<void> {
	if (kind === 'scale') await view.performScale(item, dim as ScaleName, value);
	else await view.performScore(item, dim, value);
	const next = view.viewEl.querySelector(`.pbl-est-panel button[data-dim="${dim}"][data-value="${value ?? ''}"]`);
	if (next instanceof HTMLElement) next.focus();
}
