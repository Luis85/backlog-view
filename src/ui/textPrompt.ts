import { App, Setting } from 'obsidian';
import { Closable, PromptModal } from './prompts';

/**
 * The one prompt in this directory that collects PROSE, in its own file because
 * `prompts.ts` is at its 400-line budget — the same split `newReleaseDialog.ts` and
 * `estimationPresetDialog.ts` already make from it. It extends that module's own
 * `PromptModal` rather than `Modal` directly, so the heading, the CTA row and the teardown
 * are the ones every other prompt uses; only the field and the submit rule are its own.
 */

export interface TextPromptOptions extends Closable {
	/** The modal's own heading, and the field label under it. */
	title: string;
	fieldName: string;
	placeholder: string;
	ctaLabel: string;
	/** What the field opens holding — the value being EDITED, so the reader changes a
	 *  sentence rather than retyping one. `''` for a field with nothing in it yet. */
	initial: string;
	/** Called with the raw text, EMPTY INCLUDED: what an emptied box means belongs to the
	 *  caller, and for the one caller this ships with it means "take the key off". That is
	 *  the whole difference from {@link ValuePromptModal}, which refuses a blank submit
	 *  because a tag or a person with no name is nothing at all. */
	onSubmit: (value: string) => void;
}

/**
 * Prompt for a paragraph — a `textarea` rather than a line, prefilled, and accepting an
 * empty entry.
 *
 * Its own modal rather than two more flags on {@link ValuePromptModal}: that one is for a
 * value out of a vocabulary this plugin does not own (it suggests the known ones as you
 * type, and refuses a blank), and prose is neither of those things. The three differences
 * — the element, the prefill, the empty submit — are exactly what would have had to become
 * options, and each would have been read by one caller and skipped by the other two.
 *
 * Enter is NOT the submit here, unlike every line-field prompt in this file: a newline is
 * a legitimate character in a paragraph, so the CTA is the way out and `submitOnEnter`
 * stays off. That is the one thing a reader coming from the other prompts has to notice.
 */
class TextPromptModal extends PromptModal<TextPromptOptions> {
	onOpen(): void {
		this.titleEl.setText(this.options.title);
		let value = this.options.initial;
		const submit = () => {
			this.close();
			this.options.onSubmit(value);
		};
		new Setting(this.contentEl).setName(this.options.fieldName).addTextArea((area) => {
			area.setPlaceholder(this.options.placeholder);
			area.setValue(this.options.initial);
			area.onChange((v) => (value = v));
		});
		this.cta(this.options.ctaLabel, submit);
	}
}


/** Open one — the shape every dialog in `ui/` is reached through, so a caller never
 *  constructs a modal itself. */
export function openTextPrompt(app: App, options: TextPromptOptions): void {
	new TextPromptModal(app, options).open();
}
