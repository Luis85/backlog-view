import { App, Modal } from 'obsidian';
import { t } from '../i18n/t';

/** One row the reader may open before answering. */
export interface ConfirmLink {
	label: string;
	open: () => void;
}

export interface ConfirmOptions {
	title: string;
	message: string;
	/** Rows the reader may open — rendered as buttons, never as text, so a keyboard
	 *  reader reaches each one. Empty draws no list at all. */
	links?: ConfirmLink[];
	cta: string;
	onConfirm: () => void;
	onCancel?: () => void;
	/**
	 * Say when the dialog went away, BEFORE the decision runs — `ui/prompts.ts`'s own
	 * `Closable` contract, and the same order the hand-written dialogs in this directory
	 * use, so a caller needs one rule and not two.
	 *
	 * It exists for focus. Obsidian removes the modal and focus falls to `document.body`;
	 * the release view's focus-handle list cannot help, because the redraw a confirmation
	 * triggers runs AFTER the modal is gone and would capture the body (found by review,
	 * Codex, PR #219). Refocusing here, before the write, puts the opener back under
	 * `document.activeElement` in time for that redraw to find it.
	 */
	onClosed?: () => void;
}

/**
 * A yes/no with something to read first — the one dialog shape `ui/prompts.ts` does not
 * cover, because every modal there collects a VALUE and this one collects a decision.
 *
 * `links` are buttons rather than text: each is a real tab stop, and a reader who cannot
 * use a pointer still reaches every row. Opening one is navigation and never a decision —
 * the dialog stays open, which is what lets somebody check three members and then answer.
 */
export function openConfirm(app: App, options: ConfirmOptions): void {
	const modal = new Modal(app);
	modal.titleEl.setText(options.title);
	modal.contentEl.createEl('p', { cls: 'pbl-confirm-message', text: options.message });
	for (const link of options.links ?? []) {
		const row = modal.contentEl.createEl('button', {
			cls: 'pbl-confirm-link',
			text: link.label,
			attr: { type: 'button' },
		});
		row.addEventListener('click', () => link.open());
	}
	let confirmed = false;
	// `modal-button-container` with plain buttons, the shape `newReleaseDialog` already
	// uses — `mod-cta` is Obsidian's own primary styling, so the affirmative button needs
	// no rule of this plugin's to look like one.
	const actions = modal.contentEl.createDiv({ cls: 'modal-button-container' });
	const confirm = actions.createEl('button', { cls: 'mod-cta', text: options.cta });
	confirm.addEventListener('click', () => {
		confirmed = true;
		modal.close();
	});
	const cancel = actions.createEl('button', { cls: 'pbl-confirm-cancel', text: t('confirm.cancel') });
	cancel.addEventListener('click', () => modal.close());
	// `onClose` rather than a handler beside each button, so the escape key and the close
	// box are the same answer as pressing Cancel — three ways out, one meaning.
	modal.onClose = (): void => {
		// BEFORE the decision, which is the whole of the ordering: the confirm path writes
		// and redraws, and focus has to be back on the opener before that redraw reads it.
		options.onClosed?.();
		if (confirmed) options.onConfirm();
		else options.onCancel?.();
	};
	modal.open();
}
