import { App, Modal, Setting } from 'obsidian';
import { t } from '../i18n/t';

/**
 * Which of a release's own fields to ask for, beyond the title. `ui/` is a leaf that
 * knows about no layer, so this is an opaque id — the dialog does not know it names a
 * property, let alone which one. The caller (Task 7's `view/release/`) is what reads
 * `ReleaseSettings` and decides which ids to pass, in which order; the dialog renders
 * exactly the fields it is given, in the order given, and nothing more.
 */
export type ReleaseFieldId = 'version' | 'targetDate' | 'status';

/** What comes back on confirm. `title` is always present; an optional field is present
 *  exactly when it was asked for — never a key for a field the dialog was not given. */
export interface NewReleaseResult {
	title: string;
	version?: string;
	targetDate?: string;
	status?: string;
}

const FIELD_LABEL: Record<ReleaseFieldId, () => string> = {
	version: () => t('newRelease.field.version'),
	targetDate: () => t('newRelease.field.targetDate'),
	status: () => t('newRelease.field.status'),
};

/** `targetDate` alone is a calendar date; the other two are free text, same reasoning
 *  as `SchedulePromptModal`'s own date fields in `ui/prompts.ts`. */
const FIELD_TYPE: Record<ReleaseFieldId, 'text' | 'date'> = {
	version: 'text',
	targetDate: 'date',
	status: 'text',
};

/**
 * The new-release dialog: a title, plus whichever of `version`/`targetDate`/`status`
 * the caller asked for. Plain data in (`ReleaseFieldId[]`), plain data out
 * (`NewReleaseResult`) — the same shape `estimationPresetDialog.ts` states in its own
 * docstring: `ui/` assembles nothing about what a field MEANS, and writes nothing
 * itself. The caller maps each id to a property key and calls `createRelease`.
 *
 * Only the title is required — it is the note's own name, and there is nothing to
 * create without it; every optional field may be left blank.
 */
class NewReleaseDialog extends Modal {
	private title = '';
	private readonly values: Partial<Record<ReleaseFieldId, string>> = {};
	private createBtn: HTMLButtonElement | null = null;

	constructor(
		app: App,
		private readonly fields: ReleaseFieldId[],
		private readonly onSubmit: (result: NewReleaseResult) => void,
		private readonly onClosed: (() => void) | undefined,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t('newRelease.title'));
		contentEl.empty();

		const submit = (): void => {
			const trimmedTitle = this.title.trim();
			if (!trimmedTitle) return;
			const result: NewReleaseResult = { title: trimmedTitle };
			for (const field of this.fields) result[field] = (this.values[field] ?? '').trim();
			this.close();
			this.onSubmit(result);
		};

		new Setting(contentEl).setName(t('newRelease.field.title')).addText((text) => {
			text.setPlaceholder(t('newRelease.titlePlaceholder'));
			text.onChange((v) => {
				this.title = v;
				this.createBtn?.toggleAttribute('disabled', this.title.trim().length === 0);
			});
		});

		for (const field of this.fields) this.renderField(contentEl, field);

		const actions = contentEl.createDiv({ cls: 'modal-button-container' });
		this.createBtn = actions.createEl('button', { cls: 'mod-cta', text: t('newRelease.create') });
		this.createBtn.disabled = true;
		this.createBtn.addEventListener('click', submit);
		const cancel = actions.createEl('button', { text: t('newRelease.cancel') });
		cancel.addEventListener('click', () => this.close());
	}

	private renderField(contentEl: HTMLElement, field: ReleaseFieldId): void {
		new Setting(contentEl).setName(FIELD_LABEL[field]()).addText((text) => {
			text.onChange((v) => (this.values[field] = v));
			if (FIELD_TYPE[field] === 'date') text.inputEl.type = 'date';
		});
	}

	onClose(): void {
		this.contentEl.empty();
		// The caller's way to put focus back — the same reason `stateColorsDialog.ts` and
		// `estimationPresetDialog.ts` both take one: the control that opened this dialog may
		// have been detached by a re-render before this fires.
		this.onClosed?.();
	}
}

export function openNewReleaseDialog(
	app: App,
	fields: ReleaseFieldId[],
	onSubmit: (result: NewReleaseResult) => void,
	onClosed?: () => void,
): void {
	new NewReleaseDialog(app, fields, onSubmit, onClosed).open();
}
