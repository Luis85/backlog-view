import { App, FuzzySuggestModal, FuzzyMatch } from 'obsidian';

/**
 * Picking one row out of a list the caller supplies — a modal, not an input suggest,
 * because it is opened from a MENU rather than from a field. `ValueSuggest` beside it
 * answers the other case and neither can serve both: an input suggest needs an input
 * to attach to, and a menu entry has none.
 *
 * Deliberately not specific to dependencies. It knows nothing about prerequisites, only
 * that it is given labelled choices and hands one back — which is what lets the same
 * modal offer the notes an item may wait for and the entries it currently waits on,
 * two lists whose only shared property is being lists.
 */

export interface SuggestChoice<T> {
	/** What the row reads as. */
	label: string;
	/** Second line, where a label alone would be ambiguous — a path, a reason. */
	detail?: string;
	value: T;
}

export class ItemSuggestModal<T> extends FuzzySuggestModal<SuggestChoice<T>> {
	private readonly choices: SuggestChoice<T>[];
	private readonly onChoose: (value: T) => void;

	constructor(app: App, options: { placeholder: string; choices: SuggestChoice<T>[]; onChoose: (value: T) => void }) {
		super(app);
		this.choices = options.choices;
		this.onChoose = options.onChoose;
		this.setPlaceholder(options.placeholder);
	}

	getItems(): SuggestChoice<T>[] {
		return this.choices;
	}

	getItemText(choice: SuggestChoice<T>): string {
		// The detail is searchable too: a title is not always the word someone remembers.
		return choice.detail ? `${choice.label} ${choice.detail}` : choice.label;
	}

	renderSuggestion(match: FuzzyMatch<SuggestChoice<T>>, el: HTMLElement): void {
		el.createDiv({ text: match.item.label });
		if (match.item.detail) el.createDiv({ text: match.item.detail, cls: 'pbl-suggest-detail' });
	}

	onChooseItem(choice: SuggestChoice<T>): void {
		this.onChoose(choice.value);
	}
}
