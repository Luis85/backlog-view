import { setIcon } from 'obsidian';
import { t } from '../../i18n/t';
import { EstimationModel } from '../../domain/estimationItems';
import type { EstimationView } from './estimationView';
import { runEstimationInit } from './init';

/**
 * The estimation view's toolbar — three things the view already had and could not reach.
 *
 * `runEstimationInit` was reachable only from the guided empty state, so a view that gained
 * a dimension after setup had no way to bind and backfill it. This bar is half of that fix:
 * a gained dimension is UNBOUND, which is a model problem, so the state that most needs the
 * action is the one state this bar does not draw in — the config warning draws its own
 * setup button (`estimationView.ts`'s `renderProblems`) for that reason. `WriteGate.canUndo()` and
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
export function renderEstimationToolbar(view: EstimationView, host: HTMLElement, model: EstimationModel): void {
	const bar = host.createDiv({ cls: 'pbl-toolbar' });

	const init = iconButton(bar, 'sparkles', t('estimation.toolbar.init'), 'pbl-est-init');
	init.addEventListener('click', () => void runEstimationInit(view));

	// The SHARED key, not one of this view's own: the undo slot is vault-wide (ADR 0030),
	// so a label naming this view would promise a scope the slot does not have.
	const undo = iconButton(bar, 'undo-2', t('toolbar.undo'), 'pbl-est-undo');
	undo.addEventListener('click', () => void view.gate.undoLast());

	bar.createDiv({ cls: 'pbl-toolbar-spacer' });

	// `renderEstimationToolbar`'s one call site (`estimationView.ts`) always renders it right
	// after `buildEstimationModel`, which never returns null — the guided-empty and
	// config-warning states return before either draws a toolbar at all. A nullable
	// parameter here was a branch nothing could take.
	const items = model.items;
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
 * `render()` pass, so a held reference would go stale the moment one did.
 *
 * **`.pbl-est-init` is not only the toolbar's.** The guided empty state and the config
 * warning draw no toolbar and still carry that class on their own setup buttons,
 * deliberately, because both run the same action and must go quiet on the same fact — so
 * this query DOES find something in either, and disabling it is the whole mechanism that
 * closed the bind-then-refuse hole. `undo` is the one this can find nothing for: only the
 * toolbar draws it, which is what the `if (undo)` guard below is for.
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
