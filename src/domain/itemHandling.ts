import { BasesViewConfig } from 'obsidian';

/**
 * What using an item means: where the note it opens goes. One concern of its own rather
 * than another field on `BacklogSettings`, because the vocabulary is also what the view
 * options OFFER — the labels below are the dropdown's — and a value read back from a
 * `.base` has to be one of the very strings that were offered. Spelling that list twice
 * is how a stored value comes to be one nothing accepts.
 *
 * **What a plain click DOES was the second question here until 2026-08-11**, and it is
 * no longer configuration at all: folding on click is working position, held in the
 * collapse store and reached through `host.clickFolds`, under ADR 0011's rule. It is
 * flipped while working rather than while setting a view up, and a `.base` is shared.
 */
export interface ItemHandling {
	/** Where an opened note lands. `split` also pins the base, so it stays beside the note. */
	openIn: OpenTarget;
}

/** Where an opened note goes. `active` is Obsidian's own default: the current tab. */
export const OPEN_TARGETS = { active: 'Current tab', tab: 'New tab', split: 'Split to the right' };
export type OpenTarget = keyof typeof OPEN_TARGETS;

export function defaultItemHandling(): ItemHandling {
	return { openIn: 'active' };
}

/**
 * Read it back. A dropdown stores the value it was declared with, but a hand-edited
 * `.base` can hold any string at all — so the offered vocabulary is what decides, not
 * the presence of one. Anything else falls back rather than reaching a branch that has
 * no arm for it.
 *
 * Membership is asked with `hasOwnProperty`, never `in` and never `OPEN_TARGETS[raw]`:
 * the value is user data, and every object inherits `constructor` and `toString`, so
 * both of those spellings would accept `constructor` as an offered value and hand back a
 * string this type says cannot exist. That is `byName`'s rule in `settings.ts` and the
 * bug it was written for (`docs/bugs/A user-named type read off Object.prototype.md`),
 * met again by a table keyed on something a user can type.
 */
export function resolveItemHandling(config: BasesViewConfig): ItemHandling {
	const raw = config.get('openIn');
	const offered = typeof raw === 'string' && Object.prototype.hasOwnProperty.call(OPEN_TARGETS, raw);
	return { openIn: offered ? (raw as OpenTarget) : defaultItemHandling().openIn };
}
