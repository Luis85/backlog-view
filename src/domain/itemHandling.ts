import { BasesViewConfig } from 'obsidian';
import { t } from '../i18n/t';

/**
 * What using an item means: where the note it opens goes. One concern of its own rather
 * than another field on `BacklogSettings`, because the vocabulary is also what the view
 * options OFFER — the labels below are the dropdown's — and a value read back from a
 * `.base` has to be one of the very strings that were offered. Spelling that list twice
 * is how a stored value comes to be one nothing accepts.
 *
 * **What a plain click DOES was the second question here until 2026-08-11**, and it is
 * no longer configuration at all: folding on click is working position, held in the
 * view-state store and reached through `host.clickFolds`, under ADR 0011's rule. It is
 * flipped while working rather than while setting a view up, and a `.base` is shared.
 */
export interface ItemHandling {
	/** Where an opened note lands. `split` also pins the base, so it stays beside the note. */
	openIn: OpenTarget;
}

/**
 * Where an opened note goes. `active` is Obsidian's own default: the current tab.
 *
 * A LIST of keys rather than a key→label object, because those two things had different
 * fates: the keys are what a `.base` stores and what `resolveItemHandling` matches, so they
 * are data and never translated, while the labels are read by a person and belong in the
 * catalog. Holding both in one object made the labels look like part of the vocabulary and
 * left them English while the heading above them was keyed.
 */
const OPEN_TARGET_KEYS = ['active', 'tab', 'split'] as const;
export type OpenTarget = (typeof OPEN_TARGET_KEYS)[number];

/**
 * The dropdown's labels, as a FUNCTION and never a module-level constant: `initLocale()`
 * runs in `onload`, and a `const` holding `t()` evaluates at import, which is earlier — it
 * would freeze English before Obsidian's language has been read. Nothing else catches that,
 * since every assertion in the suite runs under the English catalog where a frozen value
 * and a live one are the same string.
 */
export function openTargetOptions(): Record<OpenTarget, string> {
	return { active: t('option.openInActive'), tab: t('option.openInTab'), split: t('option.openInSplit') };
}

export function defaultItemHandling(): ItemHandling {
	return { openIn: 'active' };
}

/**
 * Read it back. A dropdown stores the value it was declared with, but a hand-edited
 * `.base` can hold any string at all — so the offered vocabulary is what decides, not
 * the presence of one. Anything else falls back rather than reaching a branch that has
 * no arm for it.
 *
 * Membership is asked of a LIST, which is what makes the prototype hazard unreachable
 * rather than guarded against. While the vocabulary was an object this read
 * `hasOwnProperty` — never `in` and never `OPEN_TARGETS[raw]`, since every object inherits
 * `constructor` and `toString` and both spellings would accept `constructor` as an offered
 * value and hand back a string this type says cannot exist. That is `byName`'s rule in
 * `settings.ts` and the bug it was written for
 * (`docs/bugs/A user-named type read off Object.prototype.md`). An array cannot be indexed
 * by `constructor` at all, so the same guarantee now costs no guard.
 */
export function resolveItemHandling(config: BasesViewConfig): ItemHandling {
	const raw = config.get('openIn');
	const offered = typeof raw === 'string' && (OPEN_TARGET_KEYS as readonly string[]).includes(raw);
	return { openIn: offered ? (raw as OpenTarget) : defaultItemHandling().openIn };
}
