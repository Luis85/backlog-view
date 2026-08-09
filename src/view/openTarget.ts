import { App, Keymap, WorkspaceLeaf } from 'obsidian';
import { BacklogItem } from '../domain/model';
import { OpenTarget } from '../domain/itemHandling';

/** What opening a note needs of the view: the workspace, and where the view is drawn. */
export interface OpenContext {
	readonly app: App;
	readonly viewEl: HTMLElement;
	readonly openIn: OpenTarget;
}

/**
 * Where a note opens, and the pane it opens into. A controller rather than three
 * functions because one thing outlives a call: the pane opened to the side, which is
 * reused rather than re-split.
 */
export class OpenController {
	/** The pane this view last opened to the side — see `leafToSide`. */
	private sideLeaf: WorkspaceLeaf | null = null;

	/**
	 * The ordinary way in: where the view is configured to put the note, unless the
	 * click carried the platform's own modifier — Obsidian's gesture outranks this
	 * view's preference, so `Ctrl`/`Cmd` still means a new tab wherever the setting
	 * points.
	 */
	open(ctx: OpenContext, item: BacklogItem, evt: MouseEvent | KeyboardEvent): void {
		const modifier = Keymap.isModEvent(evt);
		if (modifier) void ctx.app.workspace.getLeaf(modifier).openFile(item.file);
		else if (ctx.openIn === 'tab') this.inNewTab(ctx, item);
		else if (ctx.openIn === 'split') this.toSide(ctx, item);
		else void ctx.app.workspace.getLeaf(false).openFile(item.file);
	}

	inNewTab(ctx: OpenContext, item: BacklogItem): void {
		void ctx.app.workspace.getLeaf('tab').openFile(item.file);
	}

	/**
	 * Open beside the backlog, and keep the backlog there: the base's own leaf is
	 * pinned first, since opening in the current tab replaces it and a view whose whole
	 * point is to stay put while notes come and go must not be what a note lands on.
	 */
	toSide(ctx: OpenContext, item: BacklogItem): void {
		this.pinOwnLeaf(ctx);
		void this.leafToSide(ctx).openFile(item.file);
	}

	/**
	 * Pin the leaf this view is drawn in. Best effort, hence no report: a base embedded
	 * in a note is drawn in that note's leaf, and pinning it is still "keep what is on
	 * screen on screen" — while a view not yet in a workspace has nothing to pin.
	 */
	private pinOwnLeaf(ctx: OpenContext): void {
		ctx.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.containerEl.contains(ctx.viewEl)) leaf.setPinned(true);
		});
	}

	/**
	 * The pane opened to the side, made once and reused while it is still open.
	 * `getLeaf('split')` splits whatever is ACTIVE, and the backlog is active on every
	 * click — so a split per click would fill the window with panes by the fourth item.
	 * Liveness is asked of the workspace rather than remembered: a closed leaf is still
	 * a perfectly good object, and opening a note into one would put it nowhere.
	 */
	private leafToSide(ctx: OpenContext): WorkspaceLeaf {
		let alive = false;
		ctx.app.workspace.iterateAllLeaves((leaf) => {
			alive ||= leaf === this.sideLeaf;
		});
		if (alive && this.sideLeaf) return this.sideLeaf;
		const leaf = ctx.app.workspace.getLeaf('split');
		this.sideLeaf = leaf;
		return leaf;
	}
}
