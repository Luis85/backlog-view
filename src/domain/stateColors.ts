/**
 * What a state's chosen colour IS, and the option key it is stored under.
 *
 * A hex, not a name. The eight theme names this held first never reached a release —
 * `0.6.0` shipped before they merged — so there is no migration here and none is owed;
 * a `.base` holding `orange` reads as no pick and the state falls back to its positional
 * slot, which is the same thing any unreadable value does.
 *
 * What is NOT here is what a colour means on screen: `stateColoring` (`domain/board.ts`)
 * decides when a pick outranks a positional slot, because that is a question about the
 * palette, and `styles/timeline.css` still owns what a SLOT paints.
 *
 * The trade this shape makes, stated where the value is defined: a hex does not track the
 * theme. The four positional slots resolve through `--color-*-rgb` and follow light, dark
 * and whatever theme is installed; a picked colour is the same colour in all of them. That
 * is why the picker seeds each swatch from what the bar currently draws
 * (`stateColorSeeds`, `view/interactions/stateColors.ts`) rather than from a fixed list —
 * a pick starts where the theme already was, and stops moving from there.
 */

/**
 * A colour as read from a hand-editable `.base`, normalised, or null for no pick.
 *
 * Shorthand is expanded and case is dropped so the stored form is unique: the resolver
 * keeps exactly what this returns, which is what lets `settingsInconsistency` recognise a
 * value it would have discarded by asking this function rather than by restating the rule.
 */
export function stateColorValue(raw: string): string | null {
	const hex = raw.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
	// `#abc` is what a person types; the picker never produces it.
	if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map((c) => c + c).join('')}`;
	return null;
}

/**
 * The persisted option key for one state's colour, by `wipLimitKey`'s rule: shared by
 * every writer and the resolver that reads it back, because a key spelled twice is a key
 * that can differ.
 *
 * It is no longer a view-option key — Bases has no colour control, so nothing declares
 * this in the options schema and the picker writes it through `config.set` instead. The
 * key is still user data in a `.base` file, which is the whole of why it is stated once.
 */
export function stateColorKey(state: string): string {
	return `stateColor.${state.toLowerCase()}`;
}
