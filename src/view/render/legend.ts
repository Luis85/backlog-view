import { BacklogViewHost } from '../host';
import { activeAxis } from '../../domain/roadmap';
import { stateMenuValues, STATE_COLOR_SLOTS } from '../../domain/settings';

/**
 * A colour key for the dated axis's bars, rendered under the toolbar and outside the
 * timeline scroller so it never scrolls away — gated exactly like `renderTimelineControls`
 * (`toolbar.ts`), because a legend for an axis that is not drawn would key nothing.
 *
 * Presentational only: `aria-hidden`, no tab stop, no pointer handler. It restates
 * colour and nothing else — every fact a swatch stands for is already reachable without
 * it (a state from the row's chip or the Set state menu, today and a milestone from the
 * line's own tooltip), which is what makes withholding it from assistive tech and the
 * tab order correct rather than a gap.
 *
 * `observedStates` is a parameter, not read off `host.model` here: the view calls this
 * only after its own `if (!this.model) return` in `render()`, so a second null check
 * on this path would guard nothing reachable — the caller already holds the model this
 * vocabulary comes from.
 */
export function renderLegend(host: BacklogViewHost, legendEl: HTMLElement, observedStates: string[]): void {
	legendEl.empty();
	const onDatedAxis = host.projection === 'roadmap' && activeAxis(host.settings, host.axisPick) === 'dates';
	// The class itself is the gate, not a hidden variant of it: a rule that hid an
	// always-present `.pbl-legend` empty box would still leave the box in the layout
	// and in `querySelector('.pbl-legend')`'s answer to "is a legend here".
	legendEl.toggleClass('pbl-legend', onDatedAxis);
	if (!onDatedAxis) {
		legendEl.removeAttribute('aria-hidden');
		return;
	}
	legendEl.setAttribute('aria-hidden', 'true');
	// The same list, the same index, the same modulo `stateColorSlot` applies to a bar —
	// so a swatch and a bar can never name a state a different colour.
	const states = stateMenuValues(host.settings, observedStates);
	states.forEach((state, i) => addSwatch(legendEl, `pbl-state-${i % STATE_COLOR_SLOTS}`, state));
	addSwatch(legendEl, 'pbl-legend-today', 'Today');
	addSwatch(legendEl, 'pbl-legend-milestone', 'Milestone');
}

function addSwatch(legendEl: HTMLElement, swatchCls: string, label: string): void {
	const item = legendEl.createDiv({ cls: 'pbl-legend-item' });
	item.createSpan({ cls: `pbl-legend-swatch ${swatchCls}` });
	item.createSpan({ cls: 'pbl-legend-label', text: label });
}
