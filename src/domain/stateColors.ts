/**
 * The colours a state may be GIVEN by name, and the option key one is stored under.
 *
 * Its own module rather than more of `settings.ts` because it is one vocabulary with one
 * validator over it, and because `settings.ts` is at the line cap that exists to ask this
 * question. What is NOT here is what a colour means on screen: `stateColorClass`
 * (`domain/board.ts`) decides when a pick outranks a positional slot, because that is a
 * question about the palette, and `styles/stateColors.css` decides what each name paints.
 */

/**
 * Obsidian's own eight chromatic families, so a picked colour tracks the user's theme
 * exactly as the positional slots and the level badges do (`styles/badges.css`'s Borrowed
 * Palette Rule). A NAME, never a colour value — it becomes a CSS class, and a `.base` is
 * hand-editable, so {@link stateColorName} is what stands between the two.
 *
 * All eight, unlike the four a slot may take. The reservations `STATE_COLOR_SLOTS`
 * explains are about the colours this plugin assigns BY ITSELF; a pick is the user saying
 * which collision they want, and the legend keys whatever was picked off the same class
 * the bar carries, so the strip still explains the grid.
 */
export const STATE_COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];

/** {@link STATE_COLOR_NAMES} as the dropdown offers them, led by the no-pick default. */
export const STATE_COLOR_CHOICES: Record<string, string> = {
	'': 'By position',
	...Object.fromEntries(STATE_COLOR_NAMES.map((name) => [name, name[0].toUpperCase() + name.slice(1)])),
};

/**
 * The persisted option key for one state's colour, by `wipLimitKey`'s rule: shared by the
 * schema that declares the option and the resolver that reads it back, because a key
 * spelled twice is a key that can differ.
 */
export function stateColorKey(state: string): string {
	return `stateColor.${state.toLowerCase()}`;
}

/**
 * A colour name as read from a hand-editable `.base`: one of the offered names, or null
 * for no pick. Anything else — a colour value, a theme's own token, a typo — is null
 * rather than passed through, since this string goes on to be a class name.
 */
export function stateColorName(raw: string): string | null {
	const name = raw.trim().toLowerCase();
	return STATE_COLOR_NAMES.includes(name) ? name : null;
}
