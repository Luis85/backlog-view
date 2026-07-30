import { App, Modal, Setting } from 'obsidian';

/** Small prompt asking for the title of a new backlog item. */
export class TitlePromptModal extends Modal {
	private readonly heading: string;
	private readonly onSubmit: (title: string) => void;

	constructor(app: App, heading: string, onSubmit: (title: string) => void) {
		super(app);
		this.heading = heading;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.titleEl.setText(this.heading);
		let value = '';
		const submit = () => {
			const title = value.trim();
			if (!title) return;
			this.close();
			this.onSubmit(title);
		};

		new Setting(this.contentEl).setName('Title').addText((text) => {
			text.setPlaceholder('Item title');
			text.onChange((v) => (value = v));
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') {
					evt.preventDefault();
					submit();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl).addButton((btn) => {
			btn.setButtonText('Create').setCta().onClick(submit);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
