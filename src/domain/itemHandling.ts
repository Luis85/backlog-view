import { BasesViewConfig } from 'obsidian';

/**
 * What using an item means: what a plain click on it does, and where the note it opens
 * goes. One concern of its own rather than two more fields on `BacklogSettings`,
 * because the vocabulary is also what the view options OFFER — the labels below are the
 * dropdowns' — and a value read back from a `.base` has to be one of the very strings
 * that were offered. Spelling that list twice is how a stored value comes to be one
 * nothing accepts.
 */
export interface ItemHandling {
	/** What a click on a row's body does: open the note, or fold the row. */
	clickAction: ClickAction;
	/** Where an opened note lands. `split` also pins the base, so it stays beside the note. */
	openIn: OpenTarget;
}

/**
 * The two ways a row's body can read a plain click. `fold` makes the whole row the
 * chevron; the note is then reached from the row menu, from `Enter`, or with the
 * platform's own modifier — which no option here takes away.
 */
export const CLICK_ACTIONS = { open: 'Opens the note', fold: 'Expands or collapses it' };
export type ClickAction = keyof typeof CLICK_ACTIONS;

/** Where an opened note goes. `active` is Obsidian's own default: the current tab. */
export const OPEN_TARGETS = { active: 'Current tab', tab: 'New tab', split: 'Split to the right' };
export type OpenTarget = keyof typeof OPEN_TARGETS;

export function defaultItemHandling(): ItemHandling {
	return { clickAction: 'open', openIn: 'active' };
}

/**
 * Read both back. A dropdown stores the value it was declared with, but a hand-edited
 * `.base` can hold any string at all — so the offered vocabulary is what decides, not
 * the presence of one. Anything else falls back rather than reaching a branch that has
 * no arm for it.
 */
export function resolveItemHandling(config: BasesViewConfig): ItemHandling {
	const fallback = defaultItemHandling();
	const pick = <T extends string>(key: string, offered: Record<T, string>, def: T): T => {
		const raw = config.get(key);
		return typeof raw === 'string' && raw in offered ? (raw as T) : def;
	};
	return {
		clickAction: pick('clickAction', CLICK_ACTIONS, fallback.clickAction),
		openIn: pick('openIn', OPEN_TARGETS, fallback.openIn),
	};
}
