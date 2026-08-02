import { App, ButtonComponent, Modal, Setting, TFolder } from 'obsidian';
import { ValueSuggest } from './valueSuggest';

/**
 * Enter submits the prompt, and the field can claim focus once the modal is on
 * screen — the shape every text field in these prompts wants. The Enter that
 * confirms an IME composition is not a submit: taking it would close the prompt
 * on the half-finished reading instead of the word being composed.
 */
function submitOnEnter(inputEl: HTMLInputElement, submit: () => void, autofocus = false): void {
	inputEl.addEventListener('keydown', (evt) => {
		if (evt.key === 'Enter' && !evt.isComposing) {
			evt.preventDefault();
			submit();
		}
	});
	if (autofocus) window.setTimeout(() => inputEl.focus(), 0);
}

export interface NewItemPromptResult {
	title: string;
	/** Only present when the prompt asked for a folder. */
	folder?: string;
	/** The chosen type; the only offered one when there was no choice to make. */
	typeName: string;
}

export interface NewItemPromptOptions {
	heading: string;
	/**
	 * Context line under the heading: where the new item will land. A function of the
	 * chosen type, because the folder can depend on it — a Bug and a PBI created from
	 * the same row may be filed in different places, and a line that said otherwise
	 * would be telling the user something untrue at the moment they confirm.
	 */
	detail?: (typeName: string) => string;
	/**
	 * Types this row may hold, most expected first. One entry asks nothing and creates
	 * that type; more than one adds a picker, because which of them is wanted is a
	 * question only the user can answer.
	 */
	types: string[];
	/** Ask where to create the item because no folder is configured or inferable. */
	askFolder?: boolean;
	onSubmit: (result: NewItemPromptResult) => void;
}

/** Folder autocomplete for the folder field of the prompt. Exported for tests. */
export class FolderSuggest extends ValueSuggest<TFolder> {
	protected getSuggestions(query: string): TFolder[] {
		const needle = query.toLowerCase();
		const folders: TFolder[] = [];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder && file.path !== '/' && file.path.toLowerCase().includes(needle)) {
				folders.push(file);
			}
		}
		folders.sort((a, b) => a.path.localeCompare(b.path));
		return folders.slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	protected valueOf(folder: TFolder): string {
		return folder.path;
	}
}

/** Autocomplete over the tags already in use, so spellings do not drift. Exported for tests. */
export class TagSuggest extends ValueSuggest<string> {
	private readonly known: string[];

	constructor(app: App, textInputEl: HTMLInputElement, known: string[]) {
		super(app, textInputEl);
		this.known = known;
	}

	protected getSuggestions(query: string): string[] {
		const needle = query.trim().replace(/^#+/, '').toLowerCase();
		return this.known.filter((tag) => tag.toLowerCase().includes(needle)).slice(0, 50);
	}

	renderSuggestion(tag: string, el: HTMLElement): void {
		el.setText(`#${tag}`);
	}

	protected valueOf(tag: string): string {
		return tag;
	}
}

export interface TagPromptOptions {
	/** Tags offered as suggestions — the ones this item does not already carry. */
	known: string[];
	onSubmit: (tag: string) => void;
}

/** Prompt asking for a single tag to add to an item. */
export class TagPromptModal extends Modal {
	private readonly options: TagPromptOptions;

	constructor(app: App, options: TagPromptOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.titleEl.setText('Add tag');
		let tag = '';
		const submit = () => {
			if (tag.trim().length === 0) return;
			this.close();
			this.options.onSubmit(tag);
		};

		new Setting(this.contentEl).setName('Tag').addText((text) => {
			text.setPlaceholder('Sprint-12');
			text.onChange((v) => (tag = v));
			new TagSuggest(this.app, text.inputEl, this.options.known);
			submitOnEnter(text.inputEl, submit, true);
		});

		new Setting(this.contentEl).addButton((btn) => {
			btn.setButtonText('Add').setCta().onClick(submit);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export interface FolderPromptOptions {
	heading: string;
	description: string;
	ctaLabel: string;
	defaultFolder: string;
	onSubmit: (folder: string) => void;
}

/** Prompt asking for a single folder, prefilled and with autocomplete. */
export class FolderPromptModal extends Modal {
	private readonly options: FolderPromptOptions;

	constructor(app: App, options: FolderPromptOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		let folder = this.options.defaultFolder;
		const submit = () => {
			this.close();
			this.options.onSubmit(folder.trim().replace(/^\/+|\/+$/g, ''));
		};

		new Setting(this.contentEl)
			.setName('Folder')
			.setDesc(this.options.description)
			.addText((text) => {
				text.setValue(this.options.defaultFolder);
				text.onChange((v) => (folder = v));
				new FolderSuggest(this.app, text.inputEl);
				submitOnEnter(text.inputEl, submit, true);
			});

		new Setting(this.contentEl).addButton((btn) => {
			btn.setButtonText(this.options.ctaLabel).setCta().onClick(submit);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** One dated field of the schedule prompt: what to call it, and what the note states now. */
export interface DateFieldSpec {
	/** Identifies the field in the submitted values; the caller's own vocabulary. */
	field: string;
	name: string;
	/**
	 * Prefill — the date the note itself states as `YYYY-MM-DD`, or '' when it states
	 * none. The field is a native date input, which accepts that spelling and nothing
	 * else: anything a reader could not turn into a calendar date arrives here as ''
	 * and is simply not prefilled.
	 */
	value: string;
}

export interface SchedulePromptOptions {
	heading: string;
	description: string;
	/** Only the ends the configured axis has: a field with no property is never asked for. */
	fields: DateFieldSpec[];
	/**
	 * Refuse the entry with a reason, keeping the prompt open and the values in place.
	 * Null accepts. What a date IS belongs to the layer that reads them, so this
	 * dialog asks rather than decides — which is also what keeps `ui/` free of the
	 * domain it would otherwise have to import.
	 */
	validate: (values: Record<string, string>) => string | null;
	onSubmit: (values: Record<string, string>) => void;
}

/**
 * Prompt asking for an item's planned dates, prefilled with what the note states.
 * An emptied field means the date goes: absence is a real answer here, so clearing
 * one is how a single end is taken back without unscheduling the whole item — which
 * is why each field carries its own clear button. A native date input can be emptied
 * from the keyboard, segment by segment, and a gesture that fiddly is one nobody
 * finds; the button keeps "leave a field empty" a thing a user can actually do.
 *
 * The fields are `type="date"`, so the platform's own date picker and its locale
 * formatting apply, and the only values this dialog can hand back are a calendar
 * date or nothing at all.
 */
export class SchedulePromptModal extends Modal {
	private readonly options: SchedulePromptOptions;

	constructor(app: App, options: SchedulePromptOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		const values: Record<string, string> = {};
		for (const spec of this.options.fields) values[spec.field] = spec.value;

		this.contentEl.createDiv({ cls: 'pbl-modal-detail', text: this.options.description });
		// Rendered up front and filled on refusal: a message that appears only when the
		// dialog grows one is a dialog that resizes under the pointer as you submit.
		const errorEl = this.contentEl.createDiv({ cls: 'pbl-modal-error', attr: { role: 'alert' } });

		const submit = () => {
			const trimmed: Record<string, string> = {};
			for (const [field, value] of Object.entries(values)) trimmed[field] = value.trim();
			const problem = this.options.validate(trimmed);
			if (problem !== null) {
				errorEl.setText(problem);
				return;
			}
			this.close();
			this.options.onSubmit(trimmed);
		};

		this.options.fields.forEach((spec, i) => {
			const setting = new Setting(this.contentEl).setName(spec.name);
			setting.addText((text) => {
				// A date input round-trips `YYYY-MM-DD` and refuses everything else, so the
				// value read back is either a calendar date or ''. The picker, the segment
				// order and the display format are the platform's.
				const input = text.inputEl;
				input.type = 'date';
				text.setValue(spec.value);
				text.onChange((v) => {
					values[spec.field] = v;
					// The refusal was about what was entered, so it stops being true the
					// moment the entry changes.
					errorEl.setText('');
				});
				submitOnEnter(input, submit, i === 0);
				// Wired here, where the field it empties is in hand: carried out to a
				// later statement it would need a null check that can never fire.
				setting.addExtraButton((btn) => {
					btn.setIcon('x')
						.setTooltip(`Clear ${spec.name}`)
						.onClick(() => {
							input.value = '';
							values[spec.field] = '';
							errorEl.setText('');
						});
				});
			});
		});

		new Setting(this.contentEl).addButton((btn) => {
			btn.setButtonText('Save').setCta().onClick(submit);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Prompt asking for the title (and, when needed, target folder) of a new backlog item. */
export class TitlePromptModal extends Modal {
	private readonly options: NewItemPromptOptions;

	constructor(app: App, options: NewItemPromptOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.titleEl.setText(this.options.heading);
		let title = '';
		let folder = '';
		let createBtn: ButtonComponent | null = null;
		let typeName = this.options.types[0];

		const detailEl = this.options.detail ? this.contentEl.createDiv({ cls: 'pbl-modal-detail' }) : null;
		const syncDetail = () => detailEl?.setText(this.options.detail?.(typeName) ?? '');
		syncDetail();

		const submit = () => {
			const trimmed = title.trim();
			if (!trimmed) return;
			this.close();
			this.options.onSubmit({
				title: trimmed,
				folder: this.options.askFolder ? folder.trim().replace(/^\/+|\/+$/g, '') : undefined,
				typeName,
			});
		};

		// Asked first: the type decides what the item IS, and it is the one field with a
		// default worth reviewing. A single choice is not a question — it stays out.
		if (this.options.types.length > 1) {
			new Setting(this.contentEl).setName('Type').addDropdown((drop) => {
				for (const type of this.options.types) drop.addOption(type, type);
				drop.setValue(typeName);
				drop.onChange((v) => {
					typeName = v;
					// The landing spot follows the type, so the line saying where it lands
					// has to follow it too.
					syncDetail();
				});
			});
		}

		new Setting(this.contentEl).setName('Title').addText((text) => {
			text.setPlaceholder('Item title');
			text.onChange((v) => {
				title = v;
				createBtn?.setDisabled(title.trim().length === 0);
			});
			submitOnEnter(text.inputEl, submit, true);
		});

		if (this.options.askFolder) {
			new Setting(this.contentEl)
				.setName('Folder')
				.setDesc(
					"New items are created here, and the choice is saved to the view options. Point this base's filter at the same folder so items show up. Leave empty for the vault root.",
				)
				.addText((text) => {
					text.setPlaceholder('Backlog');
					text.onChange((v) => (folder = v));
					new FolderSuggest(this.app, text.inputEl);
					submitOnEnter(text.inputEl, submit);
				});
		}

		new Setting(this.contentEl).addButton((btn) => {
			btn.setButtonText('Create').setCta().setDisabled(true).onClick(submit);
			createBtn = btn;
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
