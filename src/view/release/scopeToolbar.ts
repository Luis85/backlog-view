import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseRow } from '../../domain/releases';
import { ScopeRow } from '../../domain/scopeRows';
import { hideDoneOn, setAllReleaseFolds, setHideDone } from './scopeTree';
import { scopeIconButton } from '../scopeToolbarButton';

/**
 * The scope screen's own toolbar — above the scroller, so it never scrolls away.
 *
 * Three controls and deliberately not four: the context-rows toggle the design started
 * with was cut by [[The scope of a release as a tree]] extension 3b, which says a context
 * ancestor is drawn regardless because hiding it would break a member's place — there is
 * nothing left for a fourth control to turn on or off.
 *
 * `release` is a parameter for the identical reason `renderScope.ts`'s own header takes
 * one: the hide-done gate has to ask exactly the question `ReleaseRow.done` answers, and
 * `release.done.unconfigured` — computed once in `domain/releases.ts`, over the workflows
 * this release's members actually span — IS that question. Re-deriving it here from a
 * state key would be the second copy of the question carried finding 2 exists to refuse;
 * see that figure's own comment for what the gate now means since carried finding 1.
 */
export function drawScopeToolbar(view: ReleaseView, parentEl: HTMLElement, release: ReleaseRow, rows: ScopeRow[]): void {
	const barEl = parentEl.createDiv({ cls: 'pbl-rel-toolbar' });
	scopeIconButton(barEl, 'chevrons-down-up', t('release.scope.collapseAll'), 'pbl-rel-collapse', () => {
		setAllReleaseFolds(view, release.path, rows, true);
		view.render();
	});
	scopeIconButton(barEl, 'chevrons-up-down', t('release.scope.expandAll'), 'pbl-rel-expand', () => {
		setAllReleaseFolds(view, release.path, rows, false);
		view.render();
	});
	barEl.createDiv({ cls: 'pbl-rel-spacer' });
	// A control that could hide rows the summary refuses to count would put two answers to
	// "what is done here" on one screen — the disagreement `release.done`'s own single-row
	// rule (`domain/releases.ts`) exists to prevent between the index and this screen; this
	// is that same rule read a third time, between the header above and this toggle.
	if (release.done.unconfigured) return;
	const on = hideDoneOn(view);
	const btn = barEl.createEl('button', {
		cls: 'pbl-rel-toggle pbl-rel-hidedone' + (on ? ' pbl-rel-toggle-on' : ''),
		attr: { type: 'button', 'aria-pressed': String(on) },
		text: t('release.scope.hideDone'),
	});
	btn.addEventListener('click', () => setHideDone(view, !on));
}

