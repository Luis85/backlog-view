import { AbstractInputSuggest, App, ButtonComponent, Modal, Setting, TFolder } from 'obsidian';

export interface NewItemPromptResult {
	title: string;
	/** Only present when the prompt asked for a folder. */
	folder?: string;
}

export interface NewItemPromptOptions {
	heading: string;
	/** Context line under the heading: where the new item will land. */
	detail?: string;
	/** Ask where to create the item because no folder is configured or inferable. */
	askFolder?: boolean;
	onSubmit: (result: NewItemPromptResult) => void;
}

/** Folder autocomplete for the folder field of the prompt. Exported for tests. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private readonly textInputEl: HTMLInputElement;

	constructor(app: App, textInputEl: HTMLInputElement) {
		super(app, textInputEl);
		this.textInputEl = textInputEl;
	}

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

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.textInputEl.dispatchEvent(new Event('input'));
		this.close();
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
				text.inputEl.addEventListener('keydown', (evt) => {
					if (evt.key === 'Enter') {
						evt.preventDefault();
						submit();
					}
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
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
		if (this.options.detail) {
			this.contentEl.createDiv({ cls: 'pbl-modal-detail', text: this.options.detail });
		}
		let title = '';
		let folder = '';
		let createBtn: ButtonComponent | null = null;

		const submit = () => {
			const trimmed = title.trim();
			if (!trimmed) return;
			this.close();
			this.options.onSubmit({
				title: trimmed,
				folder: this.options.askFolder ? folder.trim().replace(/^\/+|\/+$/g, '') : undefined,
			});
		};
		const submitOnEnter = (inputEl: HTMLInputElement) => {
			inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') {
					evt.preventDefault();
					submit();
				}
			});
		};

		new Setting(this.contentEl).setName('Title').addText((text) => {
			text.setPlaceholder('Item title');
			text.onChange((v) => {
				title = v;
				createBtn?.setDisabled(title.trim().length === 0);
			});
			submitOnEnter(text.inputEl);
			window.setTimeout(() => text.inputEl.focus(), 0);
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
					submitOnEnter(text.inputEl);
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
