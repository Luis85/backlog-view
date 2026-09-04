import { Notice, TFile, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { bindAndReport } from './newRelease';
import { focusControl } from './releaseEdits';
import { ValuePromptModal } from '../../ui/prompts';
import { openTwoFieldPrompt } from '../../ui/twoFieldPrompt';
import { riskValuesOf } from '../../domain/releaseReadiness';
import { sameValue } from '../../domain/noteFields';
import { parseListValue } from '../../domain/settingsResolve';

/**
 * A red state and the press that clears it.
 *
 * The scope screen states every figure it cannot read, and until now stated them and
 * stopped: an unbound key named a property nobody could bind from this screen, and an
 * unreadable value named a note nobody could open from it. This module is the one place
 * that pairing is decided — the SENTENCE stays `renderReadiness.ts`'s, because it is the
 * figure's own; what this owns is what pressing it does.
 *
 * Nothing here plans a write. A `bind` remedy touches the `.base` alone (`init.ts`, through
 * {@link bindAndReport}), an `open` remedy opens a note, and a `run` remedy is a dialog its
 * caller owns — so this module reaches no writer and states no rule about one.
 */
export type Remedy = { kind: 'bind'; option: string } | { kind: 'open'; file: TFile } | { kind: 'run'; run: () => void };

/**
 * The red note, with its action where one exists. A state with no remedy keeps the plain
 * span it always drew — a button that does nothing is worse than a sentence that says so.
 *
 * `dataset.fix` carries the option a bind remedy names, so a test and a reader's own
 * inspector can tell two fix buttons apart; the visible text is the figure's sentence and
 * is never rewritten here.
 *
 * `extraCls` is the call site's own selector, not a class this module invents — the
 * capacity figure's `run` remedy opens a dialog whose focus restore has to find the exact
 * button that opened it, and `pbl-rel-fix` alone is shared by every fix button on the
 * strip. Optional because the other two remedies are found again by class alone.
 */
export function drawFixNote(view: ReleaseView, parentEl: HTMLElement, text: string, remedy: Remedy | null, extraCls?: string): void {
	if (remedy === null) {
		parentEl.createSpan({ cls: 'pbl-rel-unreadable', text });
		return;
	}
	const cls = extraCls === undefined ? 'pbl-rel-unreadable pbl-rel-fix' : `pbl-rel-unreadable pbl-rel-fix ${extraCls}`;
	const btn = parentEl.createEl('button', { cls, attr: { type: 'button' }, text });
	if (remedy.kind === 'bind') btn.dataset.fix = remedy.option;
	setTooltip(btn, tooltipFor(remedy));
	btn.addEventListener('click', (evt) => runRemedy(view, remedy, evt));
}

function tooltipFor(remedy: Remedy): string {
	if (remedy.kind === 'bind') return t('release.fix.bind');
	if (remedy.kind === 'open') return t('release.fix.open');
	return t('release.fix.edit');
}

/**
 * `evt` is the button's own click, threaded through for the one remedy that needs it: an
 * `open` follows `view.opener.open`'s own contract (`openTarget.ts`), which reads the
 * platform's modifier off the event that triggered it — the same call a scope row's click
 * makes (`renderScope.ts`'s `drawOpenNote`), so a fix button opens exactly where an
 * ordinary click on that note would.
 */
function runRemedy(view: ReleaseView, remedy: Remedy, evt: MouseEvent): void {
	if (remedy.kind === 'run') {
		remedy.run();
		return;
	}
	if (remedy.kind === 'open') {
		view.opener.open(view.openContext(), { file: remedy.file }, evt);
		return;
	}
	void bindAndReport(view, [remedy.option]).then((bound) => {
		new Notice(bound ? t('release.new.bound') : t('release.init.nothing'));
		// A press that bound nothing changed no configuration, so there is nothing for a
		// redraw to show — and skipping it keeps focus on THIS button rather than on a
		// detached copy of it. `initControl.ts` makes the identical call.
		if (bound) view.render();
	});
}

/**
 * The two `.base`-writing dialogs: a capacity unit with nowhere else to be typed, and the
 * two risk vocabularies a bound `riskProperty` still cannot answer with on its own. Both
 * are `run` remedies — nothing here is a note write, so neither reaches the gate or the
 * undo slot `releaseEdits.ts`'s three edits share.
 *
 * `view.config.set` is `runReleaseInit`'s own call (`init.ts`'s `RELEASE_SUGGESTED_VALUES`
 * sweep), copied rather than invented, and it is not awaited — a `.base` write raises no
 * data update of its own, so each dialog calls `view.render()` itself rather than waiting
 * on one that never comes.
 *
 * Both dialogs close before they submit (`refusableBody`'s and `ValuePromptModal`'s own
 * `this.close()`, ahead of `onSubmit`), which is `releaseEdits.ts`'s own reason for its
 * `focusControl`/`save` split: the redraw inside a modal's `onSubmit` replaces the button
 * that opened it, so the destination is looked up FRESH after the write, and `onClosed`
 * covers the exit that never reaches `onSubmit` at all (Escape, the close control).
 */

/** Each dialog's own selector — `drawFixNote`'s `extraCls`, the capacity fix's own
 *  reason: a dialog's focus restore needs the exact button that opened it, and
 *  `pbl-rel-fix` alone is shared by every fix button on the strip. */
const UNIT_FIX = '.pbl-rel-unit-fix';
const RISKVALUES_FIX = '.pbl-rel-riskvalues-fix';
/** The header's own Open release note control, drawn on every scope screen
 *  (`renderScope.ts`'s `drawOpenNote`) — `releaseEdits.ts`'s identical constant, spelled
 *  again rather than imported: a successful write here removes its own opening button
 *  exactly as the capacity fix's does, and a stable neighbour beats the body. */
const OPEN_BUTTON = '.pbl-rel-open';

/**
 * The capacity unit: typed once, read by both the effort figure and the capacity
 * comparison (`renderReadiness.ts`). Reachable only from `release.scope.capacityNoUnit`,
 * which draws exactly when the capacity key IS bound and the unit is not — so there is
 * never a value on the note for a prefill to lose, the reason `editReleaseCapacity`
 * states for its own blank open (`releaseEdits.ts`).
 */
export function editCapacityUnit(view: ReleaseView): void {
	new ValuePromptModal(view.app, {
		title: t('release.scope.unitTitle'),
		fieldName: t('release.scope.unitTitle'),
		placeholder: t('release.scope.unitPlaceholder'),
		ctaLabel: t('release.scope.unitSave'),
		known: [],
		onClosed: () => focusControl(view, UNIT_FIX, OPEN_BUTTON),
		onSubmit: (value) => {
			view.config.set('capacityUnit', value);
			view.render();
			focusControl(view, UNIT_FIX, OPEN_BUTTON);
		},
	}).open();
}

/**
 * The risk vocabularies, one dialog and one write for both — a criterion with only one of
 * them bound is unconfigured exactly as if neither were
 * (`docs/requirements/Answering the readiness checklist.md`), so two sequential prompts
 * could leave it in that state on a cancel between them. Both keys are written before the
 * single `view.render()`, never one write per field.
 *
 * Prefilled with the vault's own lists (`view.settings`, already resolved into arrays);
 * the placeholder on both fields is what the base's own members already carry in the
 * property, so a reader typing the vocabulary for the first time sees what is actually
 * there rather than guessing a spelling — {@link observedRiskValues}.
 */
export function editRiskValues(view: ReleaseView): void {
	const observed = observedRiskValues(view);
	openTwoFieldPrompt(view.app, {
		heading: t('release.scope.riskValuesTitle'),
		description: t('release.scope.riskValuesHint'),
		fields: [
			{
				field: 'critical',
				name: t('release.scope.riskValuesCritical'),
				value: view.settings.criticalRiskValues.join(', '),
				placeholder: observed,
			},
			{
				field: 'addressed',
				name: t('release.scope.riskValuesAddressed'),
				value: view.settings.addressedRiskValues.join(', '),
				placeholder: observed,
			},
		],
		cta: t('release.scope.riskValuesSave'),
		// **Both lists, or neither.** A criterion with one of them empty is unconfigured
		// exactly as if neither were, so a submit that leaves one blank writes `''` twice and
		// puts the reader back on the identical red note with nothing said — the dead end
		// every fix button on this strip exists to remove, reached through the press meant to
		// clear it. Refused in the dialog, where the typing is still there to correct.
		//
		// Checked against what `list()` (`settingsResolve.ts`) will actually PARSE the typed
		// string into, not against the raw string: `list()` trims each entry and drops the
		// empty ones, so `"  "` or `","` is `''` in every way that matters here and a bare
		// `=== ''` check let both through — writing a value that reads back as unconfigured
		// and returning the reader to the identical red note. `parseListValue` is that same
		// split, reused rather than re-implemented, so the two can never disagree about what
		// counts as empty.
		validate: (values) =>
			parseListValue(values.critical).length === 0 || parseListValue(values.addressed).length === 0
				? t('release.scope.riskValuesRequired')
				: null,
		onClosed: () => focusControl(view, RISKVALUES_FIX, OPEN_BUTTON),
		onSubmit: (values) => {
			view.config.set('criticalRiskValues', values.critical);
			view.config.set('addressedRiskValues', values.addressed);
			view.render();
			focusControl(view, RISKVALUES_FIX, OPEN_BUTTON);
		},
	});
}

/**
 * The distinct risk values the loaded model's members already carry, read off `view.model`
 * rather than a second vault walk — `riskValuesOf` is `releaseReadiness.ts`'s own reader,
 * reused so a raw value is parsed exactly once. This dialog is what decides which of them
 * count as critical or addressed, so the same list is offered as a hint on BOTH fields
 * rather than sorted into either.
 *
 * **`model.results`, never `model.items`.** Vocabulary is the context-row rule's own named
 * case: an excluded note is never a source of anything derived from the Base's results, the
 * reason `observedStates` skips one and the reason `computeRiskChoices` (`scopeTree.ts`)
 * does. This walked `items` until 2026-09-04, which left two readers of "what risk values
 * does this vault carry" disagreeing about exactly those rows.
 */
function observedRiskValues(view: ReleaseView): string {
	if (view.model === null || view.settings.riskKey === '') return '';
	const seen: string[] = [];
	for (const item of view.model.results) {
		for (const value of riskValuesOf(view.app, item, view.settings).values) {
			if (!seen.some((known) => sameValue(known, value))) seen.push(value);
		}
	}
	return seen.join(', ');
}
