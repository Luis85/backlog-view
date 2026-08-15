import { sameValue } from './noteFields';
import { BacklogSettings } from './settings';

/**
 * What a state's colour may BE, which states may have one, and the key it is stored under.
 *
 * Two shapes, on purpose. A **name** — one of Obsidian's eight chromatic families — becomes
 * a class, so it tracks the user's theme through `--color-*-rgb` exactly as the positional
 * slots and the level badges do; it is what a `.base` can be hand-edited to, and what every
 * file written before the picker existed holds. A **hex** is what the picker writes, and it
 * is fixed: a colour chosen in light mode is that same colour in dark. Both are legal, and
 * `stateColorPaint` (`domain/board.ts`) is where the difference stops mattering.
 *
 * `colorableStates` takes the four fields it reads as a `Pick` rather than a whole
 * `BacklogSettings`: `settingsResolve.ts` needs it while it is still building that object,
 * so it passes a literal of the four, and every other caller passes its settings whole.
 */

/**
 * Obsidian's own eight chromatic families, painted by `styles/stateColors.css`. All eight,
 * unlike the four a slot may take: the reservations `STATE_COLOR_SLOTS` explains are about
 * the colours this plugin assigns BY ITSELF, and a chosen colour is the user saying which
 * collision they want — the legend keys whatever was chosen off the same class the bar
 * carries, so the strip still explains the grid either way.
 */
export const STATE_COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];

/**
 * A colour as read from a hand-editable `.base`, or null for no pick: one of the names
 * above, or a six-digit hex.
 *
 * Deliberately strict about the hex. `#fff` is refused rather than expanded, and so is
 * every other CSS colour syntax — `rgb()`, `hsl()`, a bare `red`, a theme variable. The
 * picker emits `#rrggbb` and nothing else, so anything else is a hand-edit, and this value
 * reaches a style attribute: a grammar with one shape is one a reader can check at a
 * glance, and expanding shorthand would mean the stored form is not what was written.
 */
export function stateColor(raw: string): string | null {
	const value = raw.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(value)) return value;
	return STATE_COLOR_NAMES.includes(value) ? value : null;
}

/** Whether a stored colour is one of the names, which is the half that becomes a class. */
export function isColorName(color: string): boolean {
	return STATE_COLOR_NAMES.includes(color);
}

/**
 * The persisted option key for one state's colour, by `wipLimitKey`'s rule: shared by the
 * dialog that writes it and the resolver that reads it back, because a key spelled twice
 * is a key that can differ.
 */
export function stateColorKey(state: string): string {
	return `stateColor.${state.toLowerCase()}`;
}

/** The four fields a colourable vocabulary is made of — the two workflows that can key one. */
export type ColorableVocabularies = Pick<
	BacklogSettings,
	'states' | 'doneValues' | 'deliverableStates' | 'deliverableDoneValues'
>;

/**
 * The states a colour can be chosen for: both workflows' DECLARED vocabularies, minus the
 * ones that workflow calls DONE, deduped by `sameValue` — one state, one control, the rule
 * the Deliverables option group used to restate for its own boxes.
 *
 * **A done state is not colourable**, because a choice on one could never be drawn: a
 * finished bar takes green from `.pbl-timeline-row.pbl-done .pbl-bar` and its legend swatch
 * is keyed `pbl-legend-done`, both of which ignore what `stateColorPaint` answers. The row
 * was offered until 2026-08-15 with the dialog's intro saying it did nothing — an inert
 * control explained rather than removed, which is what this now removes (the note's
 * extension 2a is written the other way round for that reason).
 *
 * Per WORKFLOW, not over the union: done is what a workflow declares, so a value one
 * workflow finishes on and the other does not is still colourable — the bar the second
 * workflow draws for it is an ordinary bar.
 *
 * **Declared, never observed**, and that is a correctness rule rather than a simplification.
 * `resolveSettings` builds `settings.stateColors` from these same two lists and cannot do
 * otherwise — it has no model, so an observed vocabulary is invisible to it. A dialog that
 * offered an observed state would write a key the very next refresh discards, and the
 * colour would appear to be accepted and then silently do nothing. So with a state property
 * named and no states declared, there is nothing here to colour, and the caller says so.
 */
export function colorableStates(vocabularies: ColorableVocabularies): string[] {
	const open = (declared: string[], done: string[]): string[] =>
		declared.filter((state) => !done.some((finished) => sameValue(finished, state)));
	const states = open(vocabularies.states, vocabularies.doneValues);
	for (const state of open(vocabularies.deliverableStates, vocabularies.deliverableDoneValues)) {
		if (!states.some((own) => sameValue(own, state))) states.push(state);
	}
	return states;
}
