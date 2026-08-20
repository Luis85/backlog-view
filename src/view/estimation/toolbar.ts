import { setIcon } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationModel } from '../../domain/estimationItems';
import type { EstimationView } from './estimationView';
import { runEstimationInit } from './init';

/**
 * The estimation view's toolbar — three things the view already had and could not reach.
 *
 * `runEstimationInit` was reachable only from the guided empty state, so a view that gained
 * a dimension after setup had no way to bind and backfill it. `WriteGate.canUndo()` and
 * `undoLast()` were public with NO production caller at all — `estimationView.ts` said so in
 * a comment, and this is what closes it. And the count is where write progress is published:
 * before it, `syncBusy` had only `aria-busy` on the whole pane to say anything with.
 *
 * A module of its own rather than a method on the view, `renderTable.ts`'s own reason: the
 * view is the lifecycle and the write gate, and a bar of controls is a different concern
 * with its own line budget. It touches no DOM the view owns except `host`.
 *
 * Every class here is `styles/toolbar.css`'s existing vocabulary — `.pbl-toolbar`,
 * `.pbl-icon-btn`, `.pbl-toolbar-spacer` — so the only new rule in the stylesheet is the
 * count's.
 */
export function renderEstimationToolbar(view: EstimationView, host: HTMLElement, model: EstimationModel | null): void {
	const bar = host.createDiv({ cls: 'pbl-toolbar' });

	const init = iconButton(bar, 'sparkles', t('estimation.toolbar.init'), 'pbl-est-init');
	init.addEventListener('click', () => void runEstimationInit(view));

	const undo = iconButton(bar, 'undo-2', t('estimation.toolbar.undo'), 'pbl-est-undo');
	undo.addEventListener('click', () => void view.gate.undoLast());

	bar.createDiv({ cls: 'pbl-toolbar-spacer' });

	const items = model?.items ?? [];
	bar.createSpan({
		cls: 'pbl-est-count',
		text: t('estimation.toolbar.scored', {
			scored: items.filter((item) => item.result !== null).length,
			total: items.length,
		}),
	});

	// Both buttons start in the state the gate is already in — a render mid-batch (the
	// deferred-update flush, or a second saved view opened while another is writing) draws
	// straight into the disabled state rather than relying on a later `syncBusy` to correct it.
	syncEstimationToolbar(view);
}

/**
 * Re-reads the gate and republishes its state onto the two write controls — `syncBusy`'s
 * own way of reaching the toolbar, alongside `aria-busy` on the pane. Queried BY CLASS under
 * `view.viewEl` rather than held as fields on the view: the toolbar is redrawn whole on every
 * `render()` pass, so a held reference would go stale the moment one did, and this is called
 * from states — the guided empty state, the config warning — that never draw a toolbar at
 * all, where the query simply finds nothing.
 *
 * The undo button re-enables to the UNDO SLOT's own state (`WriteGate.canUndo()`), never
 * merely to "a batch has finished" — the backlog toolbar's own rule, restated here because a
 * batch that changed nothing (a re-set to the same value) installs no inverse and must leave
 * undo exactly as disabled as it was before the batch ran.
 */
export function syncEstimationToolbar(view: EstimationView): void {
	const init = view.viewEl.querySelector<HTMLButtonElement>('.pbl-est-init');
	const undo = view.viewEl.querySelector<HTMLButtonElement>('.pbl-est-undo');
	if (init) init.disabled = view.gate.writing;
	if (undo) undo.disabled = view.gate.writing || !view.gate.canUndo();
}

function iconButton(bar: HTMLElement, icon: string, label: string, cls: string): HTMLButtonElement {
	const btn = bar.createEl('button', {
		cls: `pbl-icon-btn ${cls}`,
		attr: { type: 'button', 'aria-label': label, title: label },
	});
	setIcon(btn, icon);
	return btn;
}
