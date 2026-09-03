import { App, FileView } from 'obsidian';
import { BacklogModel } from '../domain/model';
import { BacklogSettings } from '../domain/settings';
import { ItemWrite } from '../domain/writePlan';
import { WriteOutcome } from '../storage/frontmatter';

/**
 * The live Product Backlog views, so a command run from the palette can act on the
 * one the user is looking at.
 *
 * A command has no view: Obsidian hands it the app and nothing else, and a Bases view
 * is not reachable through `getActiveViewOfType` — it is drawn *inside* the leaf's
 * file view rather than being one. So the views announce themselves while they live,
 * and the workspace decides which of them is active.
 */

/** What a command needs of a view: where it is drawn, what it is called, what it shows. */
export interface LiveBacklogView {
	readonly viewEl: HTMLElement;
	/** The saved view's own name — half of the identity a generated file carries. */
	readonly config: { name: string };
	readonly settings: BacklogSettings;
	readonly model: BacklogModel | null;
	/**
	 * The gated write path, so a palette command passes the same three refusals every
	 * drop does — serialized against the plugin-wide lock, blocked while the
	 * configuration contradicts itself, and refused whole if any write names a note the
	 * base excluded — rather than reaching the vault beside them.
	 */
	readonly applySafely: (writes: ItemWrite[]) => Promise<WriteOutcome | null>;
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
 * **Ambiguity is answered with null, not with a guess.** A note holding two embedded
 * backlog bases puts both inside one leaf, and picking either would generate one base's
 * contract over the other's file — a wrong answer that looks like a right one. The
 * command withholds itself instead, which is the same thing it does when no view is
 * active at all.
 */
export function activeBacklogView(app: App): LiveBacklogView | null {
	const leafView = app.workspace.getActiveViewOfType(FileView);
	if (!leafView) return null;
	const found = [...live].filter((view) => leafView.containerEl.contains(view.viewEl));
	return found.length === 1 ? found[0] : null;
}
