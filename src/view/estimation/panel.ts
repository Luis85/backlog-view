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

/**
 * Rebuilds the panel for whatever `view.selectedPath` names, or clears it. Safe to call
 * from a full view render or from the table's own fast-path row selection.
 *
 * ponytail: torn down and rebuilt WHOLE on every pick, never patched in place — a
 * targeted update (just the picked button's class, the rubric note, the decomposition
 * and the two derived numbers) would cost less per pick. Accepted because the panel's
 * row count is bounded by the model's own dimensions plus three fixed scales — the
 * shipped default is eight rows, and a saved model configured with dozens would still
 * be a few hundred DOM nodes to rebuild, nowhere near the tree's hundred-row render-cost
 * concern (`src/view/CLAUDE.md`'s "Cost" section). Upgrade path if a model ever grows
 * past that: patch each `RowSpec`'s button state and note in place instead of clearing
 * `view.panelEl` and calling this whole function again.
 *
 * The teardown is survivable now rather than free of consequence: `refocusPick` (below)
 * already put keyboard focus back on the picked address, and this rebuild carries the
 * OLD panel's `scrollTop` onto the new one too — read off `view.panelEl` before it is
 * removed, clamped to the fresh `scrollHeight` so a rebuild that comes out SHORTER (a
 * clear removing its own row's clamp note, say) cannot park the pane below its last row
 * — but only while the two panels are the SAME item's, compared by the `dataset.path`
 * stamped on the panel itself rather than by a second field to keep in step. A different
 * `view.selectedPath` still starts its panel at the top, on purpose: nothing else about
 * the old nodes survives either, because every one of them really is new.
 */
export function renderPanel(view: EstimationView, model: EstimationModel): void {
	const previousPanel = view.panelEl;
	const previousPath = previousPanel?.dataset.path;
	const previousScrollTop = previousPanel?.scrollTop ?? 0;
	view.panelEl?.remove();
	view.panelEl = null;
	const item = view.selectedPath ? model.byPath.get(view.selectedPath) : undefined;
	// The grid's second track is reserved whether or not a panel occupies it
	// (`styles/estimation.css`); this is the one place that knows whether one is about
	// to render, so it is the one place that can say so.
	view.viewEl.toggleClass('pbl-est-no-panel', !item);
	if (!item) return;
	const scoringModel = view.settings.model;
	const panelEl = view.viewEl.createDiv({ cls: 'pbl-est-panel' });
	panelEl.dataset.path = item.file.path;
	view.panelEl = panelEl;
	panelEl.createDiv({ cls: 'pbl-est-title', text: item.title });

	for (const dimension of scoringModel.dimensions) renderScoreRow(panelEl, dimSpec(item, dimension));

	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'confidence', t('estimation.panel.confidence')));
	panelEl.createEl('h4', { text: t('estimation.panel.effortComplexity') });
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'effort', t('estimation.panel.effort')));
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'complexity', t('estimation.panel.complexity')));

	renderDecomposition(panelEl, item, scoringModel);
	renderDerived(panelEl, item);
	if (item.currency === 'orphan') renderCleanupButton(panelEl);

	if (previousPath === item.file.path) panelEl.scrollTop = Math.min(previousScrollTop, panelEl.scrollHeight);

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
	const held = item[scale];
	return {
		kind: 'scale',
		id: scale,
		label,
		key: config.key,
		min: config.min,
		max: config.max,
		rubric: config.rubric,
		held,
		// Nothing computes a total off a scale, so no arithmetic reports a clamp for one —
		// which is a different statement from "a note never holds 9 on a five-point scale",
		// and reading the first as the second drew that row in total silence: no active
		// point, no rubric, no note. A dimension's own answer comes from `computeTotal`,
		// which is the authority where there is one.
		clamped: held !== null && (held < config.min || held > config.max),
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
	const note = rubricNote(spec);
	if (note !== null) row.createDiv({ cls: 'pbl-est-rubric', text: note });
}

/**
 * What the held answer MEANS, or why it means nothing nameable — one slot, so a row is
 * never silent about a value it is holding and never draws a box with nothing in it.
 * Three answers: the rubric sentence at a point on the scale, the clamp note for a value
 * outside it, and the between-points note for a fractional one, which names no point and
 * so indexed `rubric[1.5]` — `undefined`, drawn as an empty box beside a row where no
 * point looks held either.
 */
function rubricNote(spec: RowSpec): string | null {
	if (spec.held === null) return null;
	if (spec.clamped) return t('estimation.clamped', { value: Math.min(spec.max, Math.max(spec.min, spec.held)) });
	// In range and counted as it stands (`computeTotal` takes the raw proportion), so this
	// is not a clamp — it is a value the rubric has no sentence for.
	if (!Number.isInteger(spec.held)) return t('estimation.betweenPoints', { value: spec.held });
	return spec.rubric[spec.held - spec.min] ?? null;
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
 *  when nothing is answered, since there is no decomposition of a total that is not there.
 *  Coverage and the total are wrapped in their own `.pbl-est-summary` line rather than left
 *  as two more flow siblings after the terms: a flat list cannot put its last two members
 *  beside each other while every other member keeps its own line through CSS alone (a grid
 *  item spanning both of the summary's columns pulls those columns wide enough to fit a
 *  whole term sentence), so the total — the whole point of the block — stopped reading as
 *  though it belonged to whichever dimension happened to render last (2026-08-17). */
function renderDecomposition(panelEl: HTMLElement, item: EstimationItem, model: ScoringModel): void {
	if (!item.result) return;
	const decomp = panelEl.createDiv({ cls: 'pbl-est-decomp' });
	for (const dimension of model.dimensions) {
		const score = item.answers.get(dimension.id);
		if (score === null || score === undefined) continue;
		decomp.createSpan({ text: t('estimation.panel.term', { label: dimension.label, score, weight: dimension.weight }) });
	}
	const summary = decomp.createDiv({ cls: 'pbl-est-summary' });
	summary.createDiv({ cls: 'pbl-est-coverage', text: `${item.result.coverage.answered}/${item.result.coverage.enabled}` });
	summary.createDiv({ cls: 'pbl-est-total', text: String(item.result.total) });
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
	// One catalog key per line, {value} substituted rather than glued on beside a
	// separately-translated label — the i18n rule this file's rubric notes already
	// follow (`estimation.clamped`, `estimation.betweenPoints`): the sentence is the
	// unit, so nothing here builds one out of two pieces at the call site.
	derived.createSpan({ text: t('estimation.panel.adjustedValue', { value: adjusted }) });
	// A POSITIVE effort, asked explicitly: the ratio divides by it, so a stored 0 gives
	// `Infinity` and a negative gives a negative ratio beside a table showing the number
	// the user typed. Neither is a value to show, so the line is omitted — the row for
	// effort itself says the value is out of its range, which is where that belongs.
	if (item.effort !== null && item.effort > 0) {
		derived.createSpan({ text: t('estimation.panel.valueToEffort', { value: round2(adjusted / item.effort) }) });
	}
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
 *  once that settles, refocus the rebuilt panel — the shelf controls' own rule, because
 *  the pressed button is gone with the frame it was drawn in. */
async function handlePick(view: EstimationView, item: EstimationItem, kind: string, dim: string, value: number | null): Promise<void> {
	if (kind === 'scale') await view.performScale(item, dim as ScaleName, value);
	else await view.performScore(item, dim, value);
	refocusPick(view, kind, dim, value);
}

/**
 * Focus back onto the button the pick was made on, or — where the pick REMOVED it — onto
 * the row it was made in. Three things this address has to get right, and it was written
 * as one interpolated selector that got none of them:
 *
 * the ROW, which `data-kind` is part of, because a dimension a user called `confidence`
 * draws its points beside the fixed confidence scale's and one `data-dim` cannot tell them
 * apart; the SPELLING, because a dimension id is option text a user typed and a quote in it
 * makes an interpolated selector a `SyntaxError` rather than a miss — so the address is
 * read off `dataset` and compared, where no spelling can be a syntax error; and the
 * FALLBACK, because a clear takes its own control off the panel along with the value it
 * removed, leaving nothing at that address and focus on `<body>`, which is the pane's
 * arrow keys silently gone.
 */
function refocusPick(view: EstimationView, kind: string, dim: string, value: number | null): void {
	const row = Array.from(view.viewEl.querySelectorAll<HTMLElement>('.pbl-est-panel button')).filter(
		(el) => el.dataset.kind === kind && el.dataset.dim === dim,
	);
	const next = row.find((el) => el.dataset.value === String(value ?? '')) ?? row[0];
	next?.focus();
}
