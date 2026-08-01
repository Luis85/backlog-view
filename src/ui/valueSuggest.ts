import { AbstractInputSuggest, App } from 'obsidian';

/**
 * The half of an input suggest that is the same whichever list it offers: keep the
 * input element, and on a selection write the value, tell the field it changed —
 * the prompts read their value from `input` events — and close. Subclasses supply
 * the list, how a row looks, and what a choice is worth as text.
 */
export abstract class ValueSuggest<T> extends AbstractInputSuggest<T> {
	private readonly textInputEl: HTMLInputElement;

	constructor(app: App, textInputEl: HTMLInputElement) {
		super(app, textInputEl);
		this.textInputEl = textInputEl;
	}

	protected abstract valueOf(item: T): string;

	selectSuggestion(item: T): void {
		this.setValue(this.valueOf(item));
		this.textInputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}
