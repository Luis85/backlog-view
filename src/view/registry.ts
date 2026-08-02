import { App } from 'obsidian';
import { BacklogModel } from '../domain/model';
import { BacklogSettings } from '../domain/settings';
import { owningBasePath } from '../storage/collapseStore';

/**
 * The live Product Backlog views, so a command run from the palette can act on the
 * one the user is looking at.
 *
 * A command has no view: Obsidian hands it the app and nothing else, and a Bases view
 * is not reachable through `getActiveViewOfType` — it is drawn *inside* the leaf's
 * file view rather than being one. So the views announce themselves while they live,
 * and the workspace decides which of them is active.
 */

/** What a command needs of a view: where it is drawn, and what it is showing. */
export interface LiveBacklogView {
	readonly viewEl: HTMLElement;
	readonly settings: BacklogSettings;
	readonly model: BacklogModel | null;
}

const live = new Set<LiveBacklogView>();

/** Announce a view for as long as it is loaded. Returns nothing; see `forgetBacklogView`. */
export function rememberBacklogView(view: LiveBacklogView): void {
	live.add(view);
}

export function forgetBacklogView(view: LiveBacklogView): void {
	live.delete(view);
}

/**
 * The view the workspace is showing, or null when the active file is not a base one of
 * them is drawing.
 *
 * Matching goes through the leaf that owns the element, not through a "most recent"
 * flag: a stale flag would point a write at a base the user closed, and the workspace
 * already knows the answer. Later registrations win, so with several views of one base
 * open the newest tab is the one acted on — an arbitrary tie-break, but a stable one.
 */
export function activeBacklogView(app: App): LiveBacklogView | null {
	const active = app.workspace.getActiveFile();
	if (!active) return null;
	let found: LiveBacklogView | null = null;
	for (const view of live) {
		if (owningBasePath(app, view.viewEl) === active.path) found = view;
	}
	return found;
}
