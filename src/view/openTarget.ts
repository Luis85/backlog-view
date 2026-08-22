import { App, Keymap, TFile, WorkspaceLeaf } from 'obsidian';
import { OpenTarget } from '../domain/itemHandling';

/** What either entry point needs of an item, which is only where it lives. Narrowed from
 *  `BacklogItem` when the estimation view became the second caller: this module never read
 *  anything else off one, and a controller that demands the backlog's own item type cannot
 *  be reused by a view that has a different one. */
type Openable = { file: TFile };

/**
 * What opening a note needs of the view: the workspace, where the view is drawn, and
 * the configured target. Structural, so the VIEW is one — it already carries all three
 * — which is what keeps this out of `backlogView.ts` as two delegations rather than a
 * context object it has to assemble per call.
 */
export interface OpenContext {
	readonly app: App;
	readonly viewEl: HTMLElement;
	readonly settings: { openIn: OpenTarget };
}

/**
 * Where a note opens, and the pane it opens into.
 *
 * The two entry points are not one with a default, and the difference is the whole
 * design: `open` is what the view is CONFIGURED to do, repeated on every click, so it
 * pins the backlog and reuses one side pane. `openIn` is a target the user NAMED once —
 * the menu's two entries, a middle click — so it pins nothing and splits afresh, leaving
 * two deliberately placed notes side by side. Sharing the pane between them would make
 * the second Open to the right replace the first.
 */
export class OpenController {
	/** The pane the CONFIGURED split target last opened into — see `leafToSide`. */
	private sideLeaf: WorkspaceLeaf | null = null;

	/**
	 * The ordinary way in: where the view is configured to put the note, unless the
	 * click carried the platform's own modifier — Obsidian's gesture outranks this
	 * view's preference, so `Ctrl`/`Cmd` still means a new tab wherever the setting
	 * points.
	 *
	 * The pin belongs HERE, to the setting, and not to `openIn`: this is the target that
	 * would otherwise replace the base on every click. One deliberate menu action must
	 * leave the workspace's pins as it found them — pinning there would silently change
	 * what an ordinary click does afterwards, since `getLeaf(false)` cannot replace a
	 * pinned leaf.
	 */
	open(ctx: OpenContext, item: Openable, evt: MouseEvent | KeyboardEvent): void {
		const modifier = Keymap.isModEvent(evt);
		if (modifier) {
			void ctx.app.workspace.getLeaf(modifier).openFile(item.file);
			return;
		}
		if (ctx.settings.openIn !== 'split') {
			this.openIn(ctx, item, ctx.settings.openIn);
			return;
		}
		this.pinOwnLeaf(ctx);
		void this.leafToSide(ctx).openFile(item.file);
	}

	/** Open in a target the caller NAMED: a fresh leaf every time, and no pin. */
	openIn(ctx: OpenContext, item: Openable, target: OpenTarget): void {
		void ctx.app.workspace.getLeaf(target === 'active' ? false : target).openFile(item.file);
	}

	/**
	 * Pin the leaf this view is drawn in, so the backlog stays put while notes open
	 * beside it. Best effort, hence no report: a base embedded in a note is drawn in
	 * that note's leaf, and pinning it is still "keep what is on screen on screen" —
	 * while a view not yet in a workspace has nothing to pin.
	 *
	 * Nothing ever unpins. A pin is the user's own workspace state and this cannot tell
	 * its pin from theirs, so undoing one — when the target changes back, say — would be
	 * as likely to take away a pin they set deliberately. Leaving it is the harmless
	 * direction, and the tab's own menu is one click away.
	 */
	private pinOwnLeaf(ctx: OpenContext): void {
		ctx.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.containerEl.contains(ctx.viewEl)) leaf.setPinned(true);
		});
	}

	/**
	 * The pane the configured split target opens into, made once and reused while it is
	 * still open. `getLeaf('split')` splits whatever is ACTIVE, and the backlog is active
	 * on every click — so a split per click would fill the window with panes by the
	 * fourth item. Liveness is asked of the workspace rather than remembered: a closed
	 * leaf is still a perfectly good object, and opening a note into one would put it
	 * nowhere.
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
