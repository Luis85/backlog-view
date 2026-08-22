import { App, Modal } from 'obsidian';
import { t } from '../i18n/t';

/**
 * The preset picker and its preview. `ui/` is a leaf that knows about no layer, so this
 * takes plain ROWS and hands back the id that was picked — the view assembles the rows
 * from `domain/estimationPresets.ts` and the catalog, and the view is what writes.
 *
 * `stateColorsDialog.ts`'s shape, with one difference that is load-bearing: that dialog
 * reports each change as it happens, and this one writes only on Apply, because a preset
 * is one act over three configuration keys rather than a live preview.
 */
export interface PresetRow {
	id: string;
	/** The framework's own name — data, written into the `.base` by the caller. */
	name: string;
	formula: string;
	description: string;
	/** How this model reads a form the shape cannot express verbatim; '' where there is none. */
	note: string;
}

class PresetDialog extends Modal {
	private picked: string | null = null;

	constructor(
		app: App,
		private readonly rows: PresetRow[],
		private readonly current: string,
		private readonly onApply: (id: string) => void,
		private readonly onClosed: (() => void) | undefined,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t('estimation.presets.title'));
		contentEl.empty();
		contentEl.addClass('pbl-est-presets-dialog');
		// The kind, stated ONCE. Four rows each carrying an `Indicator` chip said the same
		// word four times; the chip comes back the day a second kind is on screen.
		contentEl.createEl('p', { cls: 'pbl-est-preset-kinds', text: t('estimation.presets.kinds') });
		const list = contentEl.createDiv({ cls: 'pbl-est-preset-list' });
		const preview = contentEl.createDiv({ cls: 'pbl-est-preview' });
		const actions = contentEl.createDiv({ cls: 'modal-button-container' });
		const apply = actions.createEl('button', { cls: 'mod-cta pbl-est-preset-apply', text: t('estimation.presets.apply') });
		apply.disabled = true;
		const cancel = actions.createEl('button', { cls: 'pbl-est-preset-cancel', text: t('estimation.presets.cancel') });
		cancel.addEventListener('click', () => this.close());
		apply.addEventListener('click', () => {
			if (!this.picked) return;
			this.onApply(this.picked);
			this.close();
		});
		for (const row of this.rows) this.renderRow(list, row, preview, apply);
	}

	private renderRow(list: HTMLElement, row: PresetRow, preview: HTMLElement, apply: HTMLButtonElement): void {
		const el = list.createDiv({
			cls: 'pbl-est-preset',
			attr: { role: 'button', tabindex: '0', 'aria-pressed': 'false', 'data-preset': row.id },
		});
		el.createDiv({ cls: 'pbl-est-preset-name', text: row.name });
		el.createDiv({ cls: 'pbl-est-preset-desc', text: row.description });
		el.createDiv({ cls: 'pbl-est-preset-formula', text: row.formula });
		if (row.note) el.createDiv({ cls: 'pbl-est-preset-note', text: row.note });
		const pick = (): void => {
			for (const other of Array.from(list.children)) {
				other.removeClass('pbl-selected');
				// The state and the class move TOGETHER, in one loop. Two loops, or a class set
				// here and an aria attribute set elsewhere, is how the visible selection and the
				// announced one drift apart — and the drift is silent, because only one of them
				// is on screen.
				other.setAttribute('aria-pressed', 'false');
			}
			el.addClass('pbl-selected');
			el.setAttribute('aria-pressed', 'true');
			this.picked = row.id;
			apply.disabled = false;
			this.drawPreview(preview, row);
		};
		el.addEventListener('click', pick);
		el.addEventListener('keydown', (evt) => {
			if (evt.key !== 'Enter' && evt.key !== ' ') return;
			evt.preventDefault();
			pick();
		});
	}

	/** Drawn only once something is picked: reserving its height leaves a hole above the
	 *  buttons in the state the dialog opens in. Both lines are drawn the same way. */
	private drawPreview(preview: HTMLElement, row: PresetRow): void {
		preview.empty();
		preview.createEl('h4', { text: t('estimation.presets.whatChanges') });
		const line = (label: string, value: string): void => {
			const el = preview.createDiv({ cls: 'pbl-est-preview-row' });
			el.createSpan({ cls: 'pbl-est-preview-label', text: label });
			el.createSpan({ text: value });
		};
		line(t('estimation.presets.now'), this.current);
		line(t('estimation.presets.after'), `${row.name} — ${row.formula}`);
		// The invalidation count, true by construction rather than computed: an indicator
		// persists nothing, so no stored total can be affected by any of these.
		preview.createEl('p', { cls: 'pbl-est-preview-note', text: t('estimation.presets.unchanged') });
	}

	onClose(): void {
		this.contentEl.empty();
		// The caller's way to put focus back. Applying a preset refreshes the view, which
		// redraws the toolbar whole — so the control that opened this dialog is detached by
		// the time it closes, and a modal returning focus to its opener would hand it to an
		// element no longer in the document, landing on `body`. The caller looks the
		// replacement up at close time for exactly that reason
		// (`ui/stateColorsDialog.ts`'s own note).
		this.onClosed?.();
	}
}

export function openPresetDialog(
	app: App,
	rows: PresetRow[],
	current: string,
	onApply: (id: string) => void,
	onClosed?: () => void,
): void {
	new PresetDialog(app, rows, current, onApply, onClosed).open();
}
