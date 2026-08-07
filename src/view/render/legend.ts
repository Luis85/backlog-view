import { BacklogViewHost } from '../host';
import { activeAxis } from '../../domain/roadmap';
import { isDoneValue, stateMenuValues, STATE_COLOR_SLOTS } from '../../domain/settings';

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
	// A swatch exists only where a bar can draw the thing it keys — the general rule
	// behind all three state-colour bugs this branch has had (the done swatch keying
	// its slot instead of green, the milestone swatch keying cyan while the diamond
	// drew its state slot, and this one): without a workflow property `stateKey` is
	// `''`, `domain/model.ts` sets every `stateValue` to null, and no bar can carry a
	// state colour at all — so the state swatches are gated on the same property that
	// gates whether a bar has one to draw, never rendered for a vocabulary nothing on
	// the grid can key.
	if (host.settings.stateKey) {
		// The same list, the same index, the same modulo `stateColorSlot` applies to a
		// bar. Except for done, which is the one state whose bar does NOT draw its slot:
		// a done row's bar is overridden to green in `timeline.css`, deliberately,
		// because green for finished is a meaning the user already reads. A swatch
		// wearing the slot class would key pink for a bar that draws green — a legend
		// disagreeing with the only thing it exists to explain. So the swatch asks the
		// same question the override does, `isDoneValue`, rather than trusting the
		// index alone.
		const states = stateMenuValues(host.settings, observedStates);
		states.forEach((state, i) => {
			const slot = isDoneValue(host.settings, state) ? 'pbl-legend-done' : `pbl-state-${i % STATE_COLOR_SLOTS}`;
			addSwatch(legendEl, slot, state);
		});
	}
	addSwatch(legendEl, 'pbl-legend-today', 'Today');
	addSwatch(legendEl, 'pbl-legend-milestone', 'Milestone');
}

function addSwatch(legendEl: HTMLElement, swatchCls: string, label: string): void {
	const item = legendEl.createDiv({ cls: 'pbl-legend-item' });
	item.createSpan({ cls: `pbl-legend-swatch ${swatchCls}` });
	item.createSpan({ cls: 'pbl-legend-label', text: label });
}
