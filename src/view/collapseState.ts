import { BacklogItem } from '../domain/model';
import { ShelfSort } from '../domain/shelf';
import {
	BOARD_MODE,
	DELIVERABLES_MODE,
	ROADMAP_MODE,
	collapseStoreIdentity,
	dropCollapseState,
	loadCollapseState,
	movedPath,
	saveCollapseState,
	ViewIdentity,
} from '../storage/collapseStore';
import { BacklogViewHost, Projection } from './host';

/**
 * The view's working position, remembered across sessions: which rows are shut,
 * which projection — tree, board or roadmap — the view is showing, which roadmap
 * axis it shows when both are configured, and which type the tree is focused on.
 * All of it is UI state, so it goes to the collapse store's vault-scoped
 * localStorage and never to the `.base`: base settings are saved on the view,
 * working position on the device.
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
	/** The persisted projection: `BOARD_MODE` or `ROADMAP_MODE`, or null for the tree. */
	private mode: string | null = null;
	/** The retained roadmap-axis pick; null until the user first picks. */
	private axis: string | null = null;
	/** The retained timeline zoom; null until the user first picks one. */
	private zoom: string | null = null;
	/** The focused type name; null means the whole tree, the default. */
	private focus: string | null = null;
	private shelfExpanded = false;
	/** null means 'tree' (sibling order), the default. */
	private shelfSortValue: string | null = null;
	private hiddenShelfTypes = new Set<string>();
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

	projection(): Projection {
		if (this.mode === BOARD_MODE) return 'board';
		if (this.mode === ROADMAP_MODE) return 'roadmap';
		if (this.mode === DELIVERABLES_MODE) return 'deliverables';
		return 'tree';
	}

	setProjection(mode: Projection): void {
		// The tree is the default and needs no stored value; a stored entry saved
		// before a projection existed reads back as the tree the same way.
		this.mode = mode === 'tree' ? null : mode === 'board' ? BOARD_MODE : mode === 'roadmap' ? ROADMAP_MODE : DELIVERABLES_MODE;
		this.scheduleSave();
	}

	/** The retained roadmap-axis pick — kept even while its axis is unconfigured. */
	axisPick(): string | null {
		return this.axis;
	}

	setAxisPick(axis: string): void {
		this.axis = axis;
		this.scheduleSave();
	}

	/** The retained timeline zoom for this saved view — null before the user picks. */
	zoomPick(): string | null {
		return this.zoom;
	}

	setZoom(id: string): void {
		this.zoom = id;
		this.scheduleSave();
	}

	/** The type the tree is focused on, or '' for the whole tree. */
	focusLevel(): string {
		return this.focus ?? '';
	}

	setFocusLevel(level: string): void {
		// The whole tree is the default and needs no stored value — the same rule the
		// projection follows, and what makes "show all types" clear the entry rather
		// than store an empty name.
		this.focus = level || null;
		this.scheduleSave();
	}

	shelfCollapsed(): boolean {
		return !this.shelfExpanded;
	}

	setShelfCollapsed(collapsed: boolean): void {
		this.shelfExpanded = !collapsed;
		this.scheduleSave();
	}

	shelfSort(): ShelfSort {
		return (this.shelfSortValue as ShelfSort | null) ?? 'tree';
	}

	setShelfSort(sort: ShelfSort): void {
		this.shelfSortValue = sort === 'tree' ? null : sort;
		this.scheduleSave();
	}

	shelfHiddenTypes(): ReadonlySet<string> {
		return this.hiddenShelfTypes;
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.hiddenShelfTypes = new Set(types);
		this.scheduleSave();
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
	 * Carry a row's state to its new path. A rename is an edit to the same item, but
	 * the sets are keyed by path, so without this the renamed note is a parent nobody
	 * has ruled on — and `collapseNewParents` shuts it on the very next refresh, in
	 * front of the user who just renamed it.
	 */
	renamePath(oldPath: string, newPath: string): void {
		let changed = false;
		for (const path of [...this.settled]) {
			const moved = movedPath(path, oldPath, newPath);
			// A folder rename carries every row beneath it, so this cannot match on the
			// renamed path alone — the event for a moved folder names the folder, and
			// every row in it would otherwise be left behind under the old prefix.
			if (moved === null) continue;
			this.settled.delete(path);
			this.settled.add(moved);
			if (this.collapsed.delete(path)) this.collapsed.add(moved);
			changed = true;
		}
		if (changed) this.scheduleSave();
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
		this.mode = snapshot.mode ?? null;
		this.axis = snapshot.axis ?? null;
		this.zoom = snapshot.zoom ?? null;
		this.focus = snapshot.focus ?? null;
		this.shelfExpanded = snapshot.shelfExpanded ?? false;
		this.shelfSortValue = snapshot.shelfSort ?? null;
		this.hiddenShelfTypes = new Set(snapshot.shelfHiddenTypes ?? []);
	}

	/** Write any pending change immediately — closing the view is when that matters most. */
	dispose(): void {
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
			this.flush();
			return;
		}
		// Nothing pending, but the view may have been *renamed* since it was restored.
		// The name is half the key, so the state is unchanged and yet belongs somewhere
		// else; without this it stays under the old name and the renamed view reopens
		// at its defaults, having never touched a row after the rename.
		if (this.id !== null && this.currentIdentity() !== null) this.flush();
	}

	/** The identity as it stands now, or null when it no longer differs from the stored one. */
	private currentIdentity(): ViewIdentity | null {
		if (this.viewEl === null || this.id === null) return null;
		const now = collapseStoreIdentity(this.host.app, this.viewEl, this.host.config.name);
		if (now === null) return null;
		return now.base === this.id.base && now.view === this.id.view ? null : now;
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
		const moved = this.currentIdentity();
		if (moved !== null) {
			// It has moved. Write it where it belongs now and take the old entry with
			// it, so a renamed base or view migrates rather than leaving a copy behind.
			dropCollapseState(this.host.app, this.id);
			this.id = moved;
		}
		const id = this.id;
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
		saveCollapseState(this.host.app, id, {
			collapsed: this.collapsed,
			expanded,
			mode: this.mode,
			axis: this.axis,
			zoom: this.zoom,
			focus: this.focus,
			shelfExpanded: this.shelfExpanded,
			shelfSort: this.shelfSortValue,
			shelfHiddenTypes: [...this.hiddenShelfTypes],
		});
	}
}
