import { openPresetDialog, PresetRow } from '../../ui/estimationPresetDialog';
import { INDICATOR_PRESETS } from '../../domain/estimationPresets';
import { indicatorFormula } from '../../domain/weightedScore';
import { focusInBar } from '../render/toolbarFit';
import { t } from '../../i18n/t';
import type { EstimationView } from './estimationView';

/**
 * The estimation view's half of the preset picker: it assembles the rows (data from
 * `domain/`, prose from the catalog), and it is what WRITES — three configuration keys and
 * nothing else. `ui/` knows about no layer, so the dialog itself does neither.
 *
 * Keyed statically rather than by `estimation.preset.${id}.description`: `t` derives its
 * key type from the catalog, so a static key is a compile error when it is missing and an
 * interpolated one is not.
 */
export function presetText(id: string): { description: string; note: string } {
	// Built per call, never at module scope: `initLocale()` runs in `onload`, so a `const`
	// holding `t()` would freeze English at import time — `openTargetOptions`' own rule.
	const text: Record<string, { description: string; note: string }> = {
		rice: { description: t('estimation.preset.rice.description'), note: t('estimation.preset.rice.note') },
		ice: { description: t('estimation.preset.ice.description'), note: t('estimation.preset.ice.note') },
		wsjf: { description: t('estimation.preset.wsjf.description'), note: t('estimation.preset.wsjf.note') },
		'value-over-effort': {
			description: t('estimation.preset.valueOverEffort.description'),
			note: t('estimation.preset.valueOverEffort.note'),
		},
	};
	return text[id] ?? { description: '', note: '' };
}

export function openEstimationPresets(view: EstimationView): void {
	const model = view.settings.model;
	const rows: PresetRow[] = INDICATOR_PRESETS.map((preset) => ({
		id: preset.id,
		name: preset.name,
		formula: indicatorFormula(model, { label: preset.name, operands: preset.operands, divisor: preset.divisor }),
		...presetText(preset.id),
	}));
	const indicator = view.settings.indicator;
	const formula = indicatorFormula(model, indicator);
	const current =
		indicator.operands.length === 0 ? t('estimation.presets.none') : indicator.label ? `${indicator.label} — ${formula}` : formula;
	openPresetDialog(
		view.app,
		rows,
		current,
		(id) => {
			// `!`, not a guard: `id` can only be `this.picked` from `PresetDialog`, which is only
			// ever set from a `row.id` drawn out of `rows` two lines above — the same array
			// `INDICATOR_PRESETS` is. `find` cannot fail here, so a guard would be a branch
			// coverage can never exercise for real.
			const preset = INDICATOR_PRESETS.find((entry) => entry.id === id)!;
			// Three keys, and nothing else — no note is written by configuring an indicator.
			view.config.set('indicatorLabel', preset.name);
			view.config.set('indicatorOperands', preset.operands.join(', '));
			view.config.set('indicatorDivisor', preset.divisor ?? '');
			view.refresh();
		},
		() => {
			const bar = view.viewEl.querySelector<HTMLElement>('.pbl-toolbar');
			if (bar) focusInBar(bar, bar.querySelector<HTMLElement>('.pbl-est-presets'));
		},
	);
}
