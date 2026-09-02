import { setIcon } from 'obsidian';
import type { EstimationView } from './estimationView';
import { formatNumber, t } from '../../i18n/t';
import { EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { ScaleName } from '../../domain/estimationSettings';
import { Indicator, ScoringModel } from '../../domain/scoringModel';
import { IndicatorBlock, indicatorFormula, round2 } from '../../domain/weightedScore';
import { renderCurrencyChip } from './currencyChip';

/**
 * The per-item panel beside the table (`docs/requirements/A rubric for every point.md`,
 * `docs/requirements/The weighted score.md`): one row per dimension and per bound scale,
 * the decomposition, the two derived numbers, and whichever action the currency earns —
 * all read straight off the already-scored `EstimationItem`, nothing recomputed here. A
 * pick's whole write path lives on the view (`performScore`/`performScale`/
 * `performOrphanCleanup`/`performRestamp`); this module only plans nothing and writes
 * nothing itself.
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
 * OLD panel's `scrollTop` onto the new one too — clamped to the fresh `scrollHeight` so a
 * rebuild that comes out SHORTER (a clear removing its own row's clamp note, say) cannot
 * park the pane below its last row — but only while the two panels are the SAME item's,
 * compared by the `dataset.path` stamped on the panel itself rather than by a second field
 * to keep in step. A different `view.selectedPath` still starts its panel at the top, on
 * purpose: nothing else about the old nodes survives either, because every one of them
 * really is new.
 *
 * **The position is a PARAMETER, and that is the whole fix.** `scrollTop` is a layout
 * question, so a detached element answers 0 to it however far it was scrolled — and
 * `EstimationView.render()` empties `viewEl` before it calls this, so reading the old
 * panel here read a node that had already lost its box: the restore was a no-op in a
 * browser, and the jsdom suite could not see it because jsdom answers with whatever was
 * last assigned. So each caller reads its own: `render()` before its `empty()`, and the
 * table's fast-path pick straight off the panel still on screen. `dataset.path` below is
 * an attribute and survives the teardown, which is why only the number moved out.
 */
export function renderPanel(view: EstimationView, model: EstimationModel, previousScrollTop: number): void {
	const previousPath = view.panelEl?.dataset.path;
	view.panelEl?.remove();
	view.panelEl = null;
	const item = view.selectedPath ? model.byPath.get(view.selectedPath) : undefined;
	// The grid's second track is reserved whether or not a panel occupies it
	// (`styles/estimation.css`); this is the one place that knows whether one is about
	// to render, so it is the one place that can say so. On `contentEl` (the grid), which
	// is what carries `.pbl-est-view` — never `viewEl` (the shell above it).
	view.contentEl.toggleClass('pbl-est-no-panel', !item);
	if (!item) return;
	const scoringModel = view.settings.model;
	const panelEl = view.contentEl.createDiv({ cls: 'pbl-est-panel' });
	panelEl.dataset.path = item.file.path;
	view.panelEl = panelEl;

	// The answer, above the inputs and PINNED there. Its own element rather than four flow
	// siblings, because it is what `position: sticky` is applied to — and because the three
	// type rules that used to reach the title and the summary addressed them by POSITION,
	// which is what silently broke when they moved. The header now declares its own type
	// (`styles/estimationPanel.css`) and nothing depends on where its children sit.
	const header = panelEl.createDiv({ cls: 'pbl-est-header' });
	const titleRow = header.createDiv({ cls: 'pbl-est-title-row' });
	titleRow.createDiv({ cls: 'pbl-est-title', text: item.title });
	// In the STICKY header rather than at the panel's foot: the reader needs the note
	// exactly when they are eight dimensions down and cannot answer one from the rubric.
	const open = titleRow.createEl('button', {
		cls: 'pbl-icon-btn pbl-est-open',
		attr: { type: 'button', 'aria-label': t('estimation.panel.openNote'), title: t('estimation.panel.openNote'), 'data-action': 'open' },
	});
	setIcon(open, 'file-text');
	renderSummary(header, item);
	renderDerived(header, item, scoringModel, view.settings.indicator);

	panelEl.createEl('h4', { text: t('estimation.panel.valueDimensions') });
	for (const dimension of scoringModel.dimensions) renderScoreRow(panelEl, dimSpec(item, dimension));

	// The heading comes BEFORE confidence, so all three fixed scales sit under it.
	panelEl.createEl('h4', { text: t('estimation.panel.scales') });
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'confidence', t('estimation.panel.confidence')));
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'effort', t('estimation.panel.effort')));
	renderScoreRow(panelEl, scaleSpec(item, scoringModel, 'complexity', t('estimation.panel.complexity')));

	if (item.result) panelEl.createEl('h4', { text: t('estimation.panel.whyThisScored') });
	renderDecomposition(panelEl, item);
	// A BRANCH, because the currencies are disjoint: an orphan has no result to restamp
	// from and a stale total needs no cleanup, so the panel never shows both. `stale` and
	// `foreign` share this one action — its label says what it does to the note rather than
	// naming either word.
	if (item.currency === 'orphan') renderCleanupButton(panelEl);
	else if (item.currency === 'stale' || item.currency === 'foreign') renderRestampButton(panelEl);

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

/** One `.pbl-est-dim` row: a head line carrying the label, the point buttons and — only
 *  while the key is bound and a value is stored — the clear control, then the held point's
 *  rubric or clamp note on its own line below. */
function renderScoreRow(panelEl: HTMLElement, spec: RowSpec): void {
	const row = panelEl.createDiv({ cls: 'pbl-est-dim' });
	const head = row.createDiv({ cls: 'pbl-est-dim-head' });
	head.createDiv({ cls: 'pbl-est-dim-label', text: spec.label });
	if (spec.key === '') return; // bare label row: nothing bound, nothing to click or show
	const points = head.createDiv({ cls: 'pbl-est-points', attr: { role: 'radiogroup', 'aria-label': spec.label } });
	// A stored value outside the scale leaves no button active, so the stop would land
	// nowhere and the group would be unreachable — exactly the silent row `scaleSpec`'s own
	// comment describes. The FIRST point is the fallback.
	const stopValue =
		spec.held !== null && spec.held >= spec.min && spec.held <= spec.max && Number.isInteger(spec.held) ? spec.held : spec.min;
	for (let value = spec.min; value <= spec.max; value++) {
		const active = spec.held === value;
		const sentence = `${formatNumber(value)} — ${spec.rubric[value - spec.min]}`;
		points.createEl('button', {
			cls: 'pbl-est-point' + (active ? ' is-active' : ''),
			text: formatNumber(value),
			attr: {
				type: 'button',
				role: 'radio',
				'aria-checked': String(active),
				// Roving: exactly one member is a tab stop. The held point where there is one,
				// the first point where there is not — so a group is always reachable and a
				// group is never five stops.
				tabindex: value === stopValue ? '0' : '-1',
				'data-dim': spec.id,
				'data-kind': spec.kind,
				'data-value': String(value),
				'aria-label': sentence,
				title: sentence,
			},
		});
	}
	// On the HEAD, not inside `points`: inside, it is a sixth arrow-key stop on a five-point
	// scale once the group becomes a radiogroup.
	if (spec.present) renderClearButton(head, spec);
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
/**
 * What a value out of its scale's range is READ as — the number `estimation.clamped`
 * names, and the only clamp on this panel. `renderDerived` divides by the same scale it
 * is asked of, so a second clamp beside it is exactly how a derived line came to be
 * computed from a raw 9 two rows under a note saying the row reads as 5.
 */
function readAs(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function rubricNote(spec: RowSpec): string | null {
	if (spec.held === null) return null;
	if (spec.clamped) return t('estimation.clamped', { value: readAs(spec.held, spec.min, spec.max) });
	// In range and counted as it stands (`computeTotal` takes the raw proportion), so this
	// is not a clamp — it is a value the rubric has no sentence for.
	if (!Number.isInteger(spec.held)) return t('estimation.betweenPoints', { value: spec.held });
	return spec.rubric[spec.held - spec.min] ?? null;
}

function renderClearButton(container: HTMLElement, spec: RowSpec): void {
	const label = t('estimation.panel.clear', { label: spec.label });
	const btn = container.createEl('button', {
		cls: 'clickable-icon pbl-est-clear',
		attr: { type: 'button', 'data-dim': spec.id, 'data-kind': spec.kind, 'data-value': '', 'aria-label': label, title: label },
	});
	setIcon(btn, 'x');
}

/**
 * The header's one baseline line: the total, its coverage, and the currency chip.
 *
 * The total comes FIRST. This block used to be drawn inside `renderDecomposition`, coverage
 * then total, so the header read `8/8  3.49` — the qualifier ahead of the thing it
 * qualifies. The chip sits on this line rather than after the derived sentences, because it
 * is a verdict on the total: under two sentences it read as a third one.
 *
 * The line draws whenever there is EITHER a fresh total or a currency worth naming —
 * never only the first. `currency` describes the STORED total, which an orphan still has
 * even though its own inputs are gone and `item.result` is null: gating the whole line on
 * `item.result` would silence the one currency this panel exists to surface (`orphan` is
 * exactly the case where selecting a stale row must not lose the fact its number is wrong).
 */
function renderSummary(header: HTMLElement, item: EstimationItem): void {
	if (!item.result && item.currency === 'none') return;
	const summary = header.createDiv({ cls: 'pbl-est-summary' });
	if (item.result) {
		summary.createDiv({ cls: 'pbl-est-total', text: formatNumber(item.result.total) });
		summary.createDiv({
			cls: 'pbl-est-coverage',
			text: `${formatNumber(item.result.coverage.answered)}/${formatNumber(item.result.coverage.enabled)}`,
		});
	}
	renderCurrencyChip(summary, item.currency);
}

/** Score × weight per answered dimension — nothing here when nothing is answered, since
 *  there is no decomposition of a total that is not there. The coverage and the total moved
 *  to the header (`renderSummary`): the total is the answer and belonged above the inputs,
 *  not after them. */
function renderDecomposition(panelEl: HTMLElement, item: EstimationItem): void {
	if (!item.result) return;
	const decomp = panelEl.createDiv({ cls: 'pbl-est-decomp' });
	// `computeTotal`'s own terms, never the answers map: a term is only a decomposition of
	// the total if it is the value the total was computed from, and the raw answer is not
	// that value wherever a clamp or a `lessIsBetter` dimension applied.
	for (const term of item.result.terms) decomp.createSpan({ text: t('estimation.panel.term', term) });
}

/**
 * Which catalog key names a blocked indicator's reason, on EITHER surface — the column's
 * one-parameter family (`{operand}`, `estimation.indicator.*`) and the panel's own
 * two-parameter family (`{name}` and `{operand}`, `estimation.panel.indicator*`). ONE
 * `Record<IndicatorBlock, …>` rather than two, exported for `renderTable.ts` to read
 * (which already imports `renderPanel` from here — no new edge), because two independent
 * copies is exactly the drift CONTROLLER AMENDMENT 1 named: nothing catches two maps
 * agreeing on which reasons exist while disagreeing about what either sentence says. A
 * single table states the correspondence once; each call site picks its own column.
 */
export const INDICATOR_BLOCK_KEYS: Record<
	IndicatorBlock,
	{
		column: 'estimation.indicator.unanswered' | 'estimation.indicator.unknown' | 'estimation.indicator.nonpositive' | 'estimation.indicator.unbound';
		panel: 'estimation.panel.indicatorUnanswered' | 'estimation.panel.indicatorUnknown' | 'estimation.panel.indicatorNonpositive' | 'estimation.panel.indicatorUnbound';
	}
> = {
	unanswered: { column: 'estimation.indicator.unanswered', panel: 'estimation.panel.indicatorUnanswered' },
	unknown: { column: 'estimation.indicator.unknown', panel: 'estimation.panel.indicatorUnknown' },
	nonpositive: { column: 'estimation.indicator.nonpositive', panel: 'estimation.panel.indicatorNonpositive' },
	unbound: { column: 'estimation.indicator.unbound', panel: 'estimation.panel.indicatorUnbound' },
};

/**
 * Confidence-adjusted value and the configured indicator — each derived on read and
 * written nowhere (`docs/requirements/The weighted score.md`). The indicator sits BESIDE
 * the value it is computed from, never instead of it, which is the epic's rule about a
 * merged number.
 *
 * A blocked indicator says which operand blocked it rather than dropping the line: a line
 * that vanishes reads as "this view has no opinion", and the reader is about to score.
 */
function renderDerived(panelEl: HTMLElement, item: EstimationItem, model: ScoringModel, indicator: Indicator): void {
	const scale = model.confidence;
	// TWO independent lines, and the gate on each is its OWN inputs. Sharing one early
	// return hid the indicator whenever the adjusted value had nothing to say — which is
	// exactly the item whose indicator is `effort × complexity` and perfectly computable,
	// and also the item whose default indicator is blocked and most needs to say so.
	const adjusted =
		item.result && item.confidence !== null
			? round2((item.result.total * readAs(item.confidence, scale.min, scale.max)) / scale.max)
			: null;
	if (adjusted === null && !item.indicator) return;
	const derived = panelEl.createDiv({ cls: 'pbl-est-derived' });
	// One catalog key per line, {value} substituted rather than glued on beside a
	// separately-translated label — the i18n rule this file's rubric notes already
	// follow (`estimation.clamped`, `estimation.betweenPoints`): the sentence is the
	// unit, so nothing here builds one out of two pieces at the call site.
	if (adjusted !== null) derived.createSpan({ text: t('estimation.panel.adjustedValue', { value: adjusted }) });
	if (!item.indicator) return;
	const name = indicator.label || indicatorFormula(model, indicator);
	const blocked = item.indicator.blockedBy;
	// A LOOKUP rather than a nested ternary: three reasons already strained that shape,
	// and the fourth (`unbound`) made it unreadable. `INDICATOR_BLOCK_KEYS` above is the
	// whole of the decision; this only applies its `panel` half.
	derived.createSpan({
		text:
			blocked === null
				? t('estimation.panel.indicator', { name, value: item.indicator.value as number })
				: t(INDICATOR_BLOCK_KEYS[blocked.reason].panel, { name, operand: blocked.operand }),
	});
}

function renderCleanupButton(panelEl: HTMLElement): void {
	panelEl.createEl('button', {
		text: t('estimation.panel.removeOrphan'),
		attr: { type: 'button', 'data-action': 'cleanup' },
	});
}

function renderRestampButton(panelEl: HTMLElement): void {
	panelEl.createEl('button', {
		text: t('estimation.panel.restamp'),
		attr: { type: 'button', 'data-action': 'restamp' },
	});
}

/**
 * One delegated listener on the panel root — never a per-button closure, so a pick that
 * rebuilds this whole panel cannot leave a stale one behind. Resolves a pick by
 * `data-dim`/`data-kind`/`data-value` (an empty value is the clear sentinel), and the two
 * currency actions separately by `data-action`.
 */
function wirePanelEvents(view: EstimationView, panelEl: HTMLElement, item: EstimationItem): void {
	panelEl.addEventListener('click', (evt) => {
		const target = evt.target instanceof Element ? evt.target.closest('button') : null;
		if (!(target instanceof HTMLElement)) return;
		if (target.dataset.action === 'cleanup') {
			void view.performOrphanCleanup(item);
			return;
		}
		if (target.dataset.action === 'restamp') {
			void view.performRestamp(item);
			return;
		}
		if (target.dataset.action === 'open') {
			// Resolved against the CURRENT model at click time, never the item this panel
			// closed over: a Bases pass can remove the row between the draw and the click,
			// and opening *something* would be worse than opening nothing — the reader is
			// about to score whatever they read.
			const live = view.model?.byPath.get(item.file.path);
			if (live) view.openNote(live, evt);
			return;
		}
		const dim = target.dataset.dim;
		const kind = target.dataset.kind;
		if (dim === undefined || kind === undefined) return;
		const value = target.dataset.value === '' ? null : Number(target.dataset.value);
		void handlePick(view, item, kind, dim, value);
	});
	// One delegated keydown for every radiogroup on the panel, the same "never a per-control
	// closure" rule the click above follows. A pick reuses the click path so nothing plans a
	// write beside `performScore`/`performScale`.
	panelEl.addEventListener('keydown', (evt) => {
		const delta = evt.key === 'ArrowRight' ? 1 : evt.key === 'ArrowLeft' ? -1 : 0;
		if (delta === 0) return;
		const group = evt.target instanceof Element ? evt.target.closest('.pbl-est-points') : null;
		if (!group) return;
		evt.preventDefault();
		const radios = Array.from(group.querySelectorAll<HTMLElement>('button.pbl-est-point'));
		const at = radios.findIndex((btn) => btn.tabIndex === 0);
		// Holds at either edge rather than wrapping — the table's own rule for this walk.
		const currentIndex = at === -1 ? 0 : at;
		const targetIndex = Math.min(Math.max(currentIndex + delta, 0), radios.length - 1);
		// The click path is the write path, so an arrow that moves nothing must not reach it:
		// on an unanswered row the roving stop already sits on the min button, and an edge
		// arrow's clamped target is that SAME button rather than the held one, so clicking
		// it would plan a real write where nothing visibly moved.
		if (targetIndex === currentIndex) return;
		radios[targetIndex]?.click();
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
