import { Notice, TFile, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { bindAndReport } from './newRelease';

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
