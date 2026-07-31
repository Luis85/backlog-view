import { BacklogItem } from '../domain/model';
import {
	collapseStoreIdentity,
	loadCollapseState,
	saveCollapseState,
	ViewIdentity,
} from '../storage/collapseStore';
import { BacklogViewHost } from './host';

/**
 * Which rows are shut, and remembering that across sessions.
 *
 * Two sets, not one: `collapsed` is what is shut right now, and `settled` is every
 * path the user has ruled on either way. A parent that is in neither has never been
 * touched, and opens collapsed. Without the second set a restored session would be
 * re-collapsed by the very pass meant to honour it.
 *
 * The view owns the *policy* on top of this — the quick filter overrides collapse
 * state while it is active — and delegates the bookkeeping here.
 */
export class CollapseState {
	private readonly host: BacklogViewHost;
	private collapsed = new Set<string>();
	/** Paths already ruled on, so the initial state is applied to each exactly once. */
	private settled = new Set<string>();
	private id: ViewIdentity | null = null;
	private restored = false;
	/** Kept so the identity can be re-resolved when the base is renamed under us. */
	private viewEl: HTMLElement | null = null;
	/** Pending debounced write; non-null means there are changes to flush. */
	private saveTimer: number | null = null;

	// Takes the host rather than the App: a Bases view is handed its `app` after
	// construction, so anything captured here would be undefined.
	constructor(host: BacklogViewHost) {
		this.host = host;
	}

	isCollapsed(path: string): boolean {
		return this.collapsed.has(path);
	}

	/** Returns true when the state actually changed. */
	set(path: string, collapsed: boolean): boolean {
		const changed = collapsed ? !this.collapsed.has(path) : this.collapsed.delete(path);
		if (collapsed) this.collapsed.add(path);
		// An explicit expand or collapse settles this row, so the initial state is not
		// applied to it later. That matters most for a row with no children yet: a drop
		// or a create expands it before the write, and the refresh that follows would
		// otherwise collapse it as a newly seen parent and hide what just landed there.
		this.settled.add(path);
		this.scheduleSave();
		return changed;
	}

	/**
	 * A parent nobody has ruled on opens collapsed — "nobody" being per parent, not
	 * per pass, so a data update does not undo what was expanded and a restored
	 * session does not re-collapse what was left open.
	 */
	collapseNewParents(items: BacklogItem[]): void {
		for (const item of items) {
			const path = item.file.path;
			if (item.children.length === 0 || this.settled.has(path)) continue;
			this.settled.add(path);
			this.collapsed.add(path);
		}
	}

	/**
	 * Restore where this view was left, once, on the first data update — by which
	 * point the view is mounted and the leaf that owns it can be found.
	 */
	restore(viewEl: HTMLElement): void {
		if (this.restored) return;
		this.restored = true;
		this.viewEl = viewEl;
		this.id = collapseStoreIdentity(this.host.app, viewEl, this.host.config.name);
		// No identifiable base: session-only, exactly as before this was persisted.
		if (this.id === null) return;
		const snapshot = loadCollapseState(this.host.app, this.id);
		this.collapsed = snapshot.collapsed;
		// Both sets settle a path; only the collapsed ones are shut.
		this.settled = new Set([...snapshot.collapsed, ...snapshot.expanded]);
	}

	/** Write any pending change immediately — closing the view is when that matters most. */
	dispose(): void {
		if (this.saveTimer === null) return;
		window.clearTimeout(this.saveTimer);
		this.saveTimer = null;
		this.flush();
	}

	/**
	 * Coalesce the writes. "Collapse all" settles every parent in one loop, and
	 * serializing the whole path list per row would be quadratic on a large backlog.
	 */
	private scheduleSave(): void {
		if (this.id === null || this.saveTimer !== null) return;
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			this.flush();
		}, 400);
	}

	private flush(): void {
		if (this.id === null) return;
		// Re-resolved rather than trusted: the base may have been renamed, or the view
		// itself renamed, since this view was mounted, and writing to the identity it
		// started with would leave the state under a key nothing will look up again.
		// A null answer means the leaf has gone (the view is closing) — keep the last
		// known identity rather than dropping the write.
		const id = this.viewEl
			? collapseStoreIdentity(this.host.app, this.viewEl, this.host.config.name) ?? this.id
			: this.id;
		this.id = id;
		// Paths whose note is gone are not coming back under the same identity. This
		// is the one place that drops them, which is why it is keyed on the vault
		// rather than on the model: a query that has not warmed up yet, or a filter
		// the user narrowed, must not be read as "these notes no longer exist" and
		// throw away a session the user still wants.
		for (const path of this.settled) {
			if (this.host.app.vault.getAbstractFileByPath(path) !== null) continue;
			this.settled.delete(path);
			this.collapsed.delete(path);
		}
		const expanded = new Set([...this.settled].filter((path) => !this.collapsed.has(path)));
		saveCollapseState(this.host.app, id, { collapsed: this.collapsed, expanded });
	}
}
