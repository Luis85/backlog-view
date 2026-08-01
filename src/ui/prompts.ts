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
