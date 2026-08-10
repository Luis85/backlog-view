import { App } from 'obsidian';
import { activeBacklogView } from '../view/registry';
import { openStateColors } from '../view/interactions/stateColors';

/**
 * The palette's way into the state-colour picker — the second of the two inputs the
 * dialog has, beside the `⋯` menu's entry. Neither plans anything of its own: both call
 * `openStateColors` with what it needs (`StateColorTarget`), which is the "one action,
 * several inputs" rule this codebase keeps for every move.
 *
 * A command rather than only a menu entry because the `⋯` is inside the view, and the
 * colours are worth reaching from a hotkey — the same argument `Write backlog readme`
 * already made for a generated file.
 */

/**
 * The command's id, beside the flow it runs — persisted in the user's hotkeys, so it is
 * a named value rather than a literal at the registration site.
 */
export const STATE_COLORS_COMMAND_ID = 'pick-state-colors';

/**
 * Withheld unless the active leaf is drawing exactly one backlog view. A view still
 * waiting for its first result set is withheld too: the picker's rows come from the
 * palettes, which are derived from the model, so with none it could only offer an empty
 * dialog — the same reason `Write backlog readme` waits.
 */
export function pickStateColorsCommand(app: App, checking: boolean): boolean {
	const view = activeBacklogView(app);
	if (view === null || view.model === null) return false;
	if (!checking) openStateColors(view);
	return true;
}
