import { App, FileView } from 'obsidian';
import { BacklogModel } from '../domain/model';
import { BacklogSettings } from '../domain/settings';

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

/** Announce a view for as long as it is loaded; `forgetBacklogView` ends that. */
export function rememberBacklogView(view: LiveBacklogView): void {
	live.add(view);
}

export function forgetBacklogView(view: LiveBacklogView): void {
	live.delete(view);
}

/**
 * The view the workspace is showing, or null when the active leaf is not drawing one.
 *
 * Matched by the **active leaf's element**, not by its file: one `.base` open in two
 * split panes is two leaves, two views and two configurations, all answering to one
 * path — and a command that picked between them by path would write the README of
 * whichever view happened to be constructed last. Containment is the only thing that
 * distinguishes them, and it is also what the leaf already knows.
 *
 * Later registrations still win *within* one leaf, which is where the ambiguity is
 * harmless: a leaf draws one view at a time, so a second contained view is one being
 * swapped in.
 */
export function activeBacklogView(app: App): LiveBacklogView | null {
	const leafView = app.workspace.getActiveViewOfType(FileView);
	if (!leafView) return null;
	let found: LiveBacklogView | null = null;
	for (const view of live) {
		if (leafView.containerEl.contains(view.viewEl)) found = view;
	}
	return found;
}
