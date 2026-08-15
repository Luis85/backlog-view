import { BacklogItem } from '../domain/model';
import { ShelfSort } from '../domain/shelf';
import {
	BOARD_MODE,
	CATALOG_MODE,
	DELIVERABLES_MODE,
	ProjectionMode,
	ROADMAP_MODE,
	dropViewState,
	loadViewState,
	saveViewState,
	ViewPrefs,
} from '../storage/viewStateStore';
import { movedPath, resolveViewIdentity, ViewIdentity } from '../storage/viewIdentity';
import { BacklogViewHost, ColumnScope, Projection } from './host';

/**
 * The stored `mode` value for each projection, null for the tree — a `Record` rather
 * than a chain of ternaries, so the compiler refuses to build once a further `Projection`
 * joins the union without a case here. The chain this replaced (`mode === 'tree' ? null
 * : mode === 'board' ? BOARD_MODE : ...`) had an unguarded final `else`, which stayed
 * green after a new projection was added and silently persisted its bare name instead
 * of the constant `PREF_READERS`' allowlist expects.
 *
 * It is now the ONLY statement of the mapping. The reverse direction was still that same
 * chain, a few lines below the map that replaced it, with the same unguarded
 * `return 'tree'` — so a projection could be written correctly and never activate, since
 * `setProjection` stores the constant and then renders and the render asks the getter.
 * {@link projectionFor} inverts this instead, and `PROJECTION_MODES` in `storage/` closes
 * the third leg. One mapping, three directions, no drift.
 */
const PROJECTION_MODE: Record<Projection, ProjectionMode | null> = {
	tree: null,
	board: BOARD_MODE,
	roadmap: ROADMAP_MODE,
	deliverables: DELIVERABLES_MODE,
	catalog: CATALOG_MODE,
};

/** The projection a stored `mode` names — {@link PROJECTION_MODE} read backwards. */
function projectionFor(mode: string | null): Projection {
	const found = (Object.keys(PROJECTION_MODE) as Projection[]).find((p) => PROJECTION_MODE[p] === mode);
	// The tree is the default and stores nothing, so it is also the answer for a value
	// this version does not recognise — `PREF_READERS` drops those on the way in, and
	// agreeing with it here costs one `??`.
	return found ?? 'tree';
}

/**
 * Prefix marking a key as the DATED AXIS's own fold state, kept apart from the tree's.
 * The grid's chevron folds rows off the plan and the tree's opens a node in the backlog:
 * two questions about one item, so one bit could only answer both by making the reader
 * lose their place in the other projection every time they used it.
 *
 * A NUL, because a vault path may legitimately contain any printable prefix — `notePath`
 * has to strip this back off to prune and to rename, so a key that could be a real path
 * would prune the wrong entry.
 */
export const TIMELINE_SCOPE = '\u0000timeline:';

/**
 * Prefix marking a key as a CARD's own disclosure state, kept apart from both the tree's
 * bare-path bit and `TIMELINE_SCOPE`: a card's face and the tree row for the same note are
 * two questions again, the same reason `TIMELINE_SCOPE` exists — "is this node open in the
 * backlog" and "is this card's children list open" used to be one bit, so expanding either
 * moved the reader's place in the other, including through the toolbar's bulk controls,
 * which the tree row's bit alone can never avoid since a bulk action legitimately means
 * the tree by it. One scope regardless of WHICH card projection draws the card (board,
 * either roadmap axis, Deliverables): the question "is this item's card open" is one
 * question about the note, not one per screen that happens to draw it as a card — unlike
 * the dated axis's own rows, whose fold is a genuine fact about that PLAN and nothing else.
 */
export const CARD_SCOPE = '\u0000card:';

/** The note path a key belongs to, whichever scope settled it. */
function notePath(key: string): string {
	if (key.startsWith(TIMELINE_SCOPE)) return key.slice(TIMELINE_SCOPE.length);
	if (key.startsWith(CARD_SCOPE)) return key.slice(CARD_SCOPE.length);
	return key;
}

/**
 * One resource's fold key. Lower-cased for `sameValue`'s reason and `deriveLanes`'
 * spelling of it — a band is one band whatever case names it, so its fold has to be one
 * bit. The stored value is this key rather than the display name, which nothing reads
 * back onto a screen.
 */
function laneKey(name: string): string {
	return name.toLowerCase();
}

/**
 * One board column's or horizon bucket's fold key: the scope it is drawn in, and its own
 * value. `''` is the no-state column, which is a safe sentinel because a state that reads
 * back empty is no state at all.
 *
 * SCOPED, because the same word can name a column on more than one screen — a requirements
 * `Done`, a Deliverables `Done` and a horizon called `Done` are three columns and three
 * folds. Lower-cased for {@link laneKey}'s reason, twice over: `boardColumns` indexes its
 * columns on `state.toLowerCase()` and `buildRoadmap` does the same for buckets, so a value
 * whose spelling changes is still one column and has to stay one fold.
 *
 * A NUL joins the two halves rather than a printable separator, the reason
 * {@link TIMELINE_SCOPE} uses one: a state value is user data and may contain anything a
 * user can type.
 */
function columnKey(scope: ColumnScope, value: string | null): string {
	return `${scope}\u0000${(value ?? '').toLowerCase()}`;
}

/** The scope prefix a settled key carries, or '' for the tree's own bare path. */
function scopeOf(key: string): string {
	if (key.startsWith(TIMELINE_SCOPE)) return TIMELINE_SCOPE;
	if (key.startsWith(CARD_SCOPE)) return CARD_SCOPE;
	return '';
}

/**
 * An entry stored before the dated axis had a scope of its own holds ONE bit per note —
 * and it is the bit both projections were reading, so the split copies it across rather
 * than starting the grid from nothing. Without this, the first open after the upgrade
 * shuts every row a reader had left open on their plan: `collapseNewParents` finds the
 * scope unsettled and applies the default to all of it.
 *
 * Fires only where the entry names no scoped key at all, which is what keeps it from
 * touching a state this version wrote — and makes it idempotent, since the copy it
 * makes is exactly what stops it running again.
 */
function seedTimelineScope(collapsed: Set<string>, settled: Set<string>): void {
	const keys = [...settled];
	if (keys.some((key) => key.startsWith(TIMELINE_SCOPE))) return;
	for (const key of keys) {
		settled.add(TIMELINE_SCOPE + key);
		if (collapsed.has(key)) collapsed.add(TIMELINE_SCOPE + key);
	}
}

/**
 * The same upgrade, for a card's own bit — but with two possible sources rather than
 * one, because a card's disclosure did not read one bit before it had a scope of its
 * own: on the dated axis it read `TIMELINE_SCOPE`, sharing the row's own fold bit
 * (`collapseKey` routed every card there too, before {@link CARD_SCOPE} split them
 * apart), and everywhere else it read the bare path alongside the tree.
 *
 * Neither source can be trusted to say which one actually answered for THIS note:
 * `collapseNewParents` settles every parent collapsed in every scope on every data
 * update, whether or not the dated roadmap was ever opened, so a stored `TIMELINE_SCOPE`
 * key proves nothing by existing — most installations have one for most parents
 * regardless. What it CANNOT be is a false EXPANSION: `collapseNewParents` only ever
 * adds to `collapsed`, never removes from it, so the sole way either scope shows a path
 * as expanded is a user's own explicit action there at some point. A card's exact prior
 * state is not recoverable — a card and its row shared one bit under BOTH scopes before
 * this split — so an expansion on EITHER side is taken as the card's too: the same call
 * {@link seedTimelineScope} already makes for its own single source, and losing a
 * genuine expand silently is the worse failure than opening a card the user never
 * touched.
 */
function seedCardScope(collapsed: Set<string>, settled: Set<string>): void {
	const keys = [...settled];
	if (keys.some((key) => key.startsWith(CARD_SCOPE))) return;
	const expanded = (key: string): boolean => settled.has(key) && !collapsed.has(key);
	for (const path of new Set(keys.map(notePath))) {
		settled.add(CARD_SCOPE + path);
		if (!expanded(path) && !expanded(TIMELINE_SCOPE + path)) collapsed.add(CARD_SCOPE + path);
	}
}

/**
 * The view's working position, remembered across sessions — which rows are shut,
 * which projection — tree, board or roadmap — the view is showing, which roadmap
 * axis it shows when both are configured, which type the tree is focused on — and
 * this device's own preferences beside it. All of it is UI state, so it goes to the
 * view-state store's vault-scoped localStorage and never to the `.base`: base
 * settings are saved on the view, working position and per-device preferences on
 * the device. That is what makes it a view state rather than a collapse state: the
 * folds are only part of what it holds.
 *
 * Two sets, not one: `collapsed` is what is shut right now, and `settled` is every
 * key the user has ruled on either way. A parent that is in neither has never been
 * touched, and opens collapsed. Without the second set a restored session would be
 * re-collapsed by the very pass meant to honour it.
 *
 * KEYS, not paths: a key is a note path, optionally under {@link TIMELINE_SCOPE} or
 * {@link CARD_SCOPE}. The view owns the *policy* on top of this — which scope a caller
 * asks in, and the quick filter's override while it is active — and delegates the
 * bookkeeping here.
 */
export class ViewState {
	private readonly host: BacklogViewHost;
	private collapsed = new Set<string>();
	/** Paths already ruled on, so the initial state is applied to each exactly once. */
	private settled = new Set<string>();
	/**
	 * Every pick, in the shape the store takes. One object rather than a field each:
	 * `restore` and `flush` stop enumerating, so a pick added to one and forgotten in the
	 * other cannot happen.
	 */
	private prefs: ViewPrefs = {};

	/**
	 * The collections kept beside {@link prefs} rather than read out of it. `isCollapsed`
	 * and `isLaneCollapsed` are asked once per row, so rebuilding a set from an array per
	 * call is a render cost this view refuses; they are flattened once per flush instead.
	 * `hiddenShelfTypes` mirrors `prefs.shelfHiddenTypes` and is written by the same setter,
	 * so the two cannot drift; {@link colWidths} is not a mirror at all but the very object
	 * `prefs.colWidths` holds, for the reason stated on it.
	 */
	private hiddenShelfTypes = new Set<string>();
	/**
	 * The tree's resized property columns by Bases property id; a property with no entry
	 * draws at `DEFAULT_PROP_COLUMN_WIDTH`. A live map rather than a value replaced
	 * wholesale, because its ENTRIES are set one at a time — so this holds the SAME object
	 * `prefs.colWidths` does rather than a copy of it, and the two cannot describe
	 * different widths. `Object.create(null)` for the reason the store's own reader uses
	 * it — a column named `constructor` is a plain key here, and one named `__proto__` is
	 * a width rather than a new prototype.
	 */
	private colWidths: Record<string, number> = Object.create(null) as Record<string, number>;
	/** Resource bands folded shut, by name — see {@link isLaneCollapsed}. */
	private foldedLanes = new Set<string>();
	/** Board columns and horizon buckets folded shut, by {@link columnKey}. */
	private foldedColumns = new Set<string>();
	/** Columns opened AGAINST a default that would have folded them — see {@link columnCollapsed}. */
	private openedColumns = new Set<string>();
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

	isCollapsed(key: string): boolean {
		return this.collapsed.has(key);
	}

	/**
	 * Absence is a value. `null`, `false`, `''` and `[]` all mean "no entry", which is the
	 * same rule the store keeps on the way to disk — stated here so the two cannot answer
	 * differently about what a cleared pick is.
	 */
	private setPref<K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K] | null): void {
		const empty = value === null || value === false || value === '' || (Array.isArray(value) && value.length === 0);
		if (empty) delete this.prefs[key];
		else this.prefs[key] = value;
		this.scheduleSave();
	}

	projection(): Projection {
		return projectionFor(this.prefs.mode ?? null);
	}

	setProjection(mode: Projection): void {
		// The tree is the default and needs no stored value; a stored entry saved
		// before a projection existed reads back as the tree the same way.
		this.setPref('mode', PROJECTION_MODE[mode]);
	}

	/** The retained roadmap-axis pick — kept even while its axis is unconfigured. */
	axisPick(): string | null {
		return this.prefs.axis ?? null;
	}

	setAxisPick(axis: string): void {
		this.setPref('axis', axis);
	}

	/** The retained timeline zoom for this saved view — null before the user picks. */
	zoomPick(): string | null {
		return this.prefs.zoom ?? null;
	}

	setZoom(id: string): void {
		this.setPref('zoom', id);
	}

	/** The retained row density for this saved view — null means comfortable, the default. */
	densityPick(): string | null {
		return this.prefs.density ?? null;
	}

	setDensity(value: string | null): void {
		this.setPref('density', value);
	}

	/** Whether a click on a row folds it in this saved view — false, opening it, is the default. */
	clickFolds(): boolean {
		return this.prefs.clickFolds ?? false;
	}

	setClickFolds(value: boolean): void {
		this.setPref('clickFolds', value);
	}

	/** The retained lead-column width for this saved view — null means the default. */
	leadWidthPick(): number | null {
		return this.prefs.leadWidth ?? null;
	}

	setLeadWidth(value: number | null): void {
		this.setPref('leadWidth', value);
	}

	/** The retained property-column widths for this saved view; a column absent from it is at the default. */
	columnWidths(): Readonly<Record<string, number>> {
		return this.colWidths;
	}

	/** null clears the pick, which is what a column dragged back to the default stores. */
	setColumnWidth(prop: string, value: number | null): void {
		if (value === null) delete this.colWidths[prop];
		else this.colWidths[prop] = value;
		// Through {@link setPref} like every other pick, so the last column dragged back to
		// the default leaves no field behind: an emptied map is the absence a `null` means.
		this.setPref('colWidths', Object.keys(this.colWidths).length > 0 ? this.colWidths : null);
	}

	/** The type the tree is focused on, or '' for the whole tree. */
	focusLevel(): string {
		return this.prefs.focus ?? '';
	}

	setFocusLevel(level: string): void {
		// The whole tree is the default and needs no stored value — the same rule the
		// projection follows, and what makes "show all types" clear the entry rather
		// than store an empty name.
		this.setPref('focus', level || null);
	}

	shelfCollapsed(): boolean {
		return !(this.prefs.shelfExpanded ?? false);
	}

	setShelfCollapsed(collapsed: boolean): void {
		this.setPref('shelfExpanded', !collapsed);
	}

	shelfSort(): ShelfSort {
		return (this.prefs.shelfSort as ShelfSort | undefined) ?? 'tree';
	}

	setShelfSort(sort: ShelfSort): void {
		this.setPref('shelfSort', sort === 'tree' ? null : sort);
	}

	shelfHiddenTypes(): ReadonlySet<string> {
		return this.hiddenShelfTypes;
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.hiddenShelfTypes = new Set(types);
		this.setPref('shelfHiddenTypes', [...types]);
	}

	/**
	 * Whether one resource's whole band is folded shut, asked of the NAME.
	 *
	 * Its own set rather than a scope in {@link set}'s key space, and the reason is the
	 * flush: everything in there is a note PATH and is dropped when the vault has no file
	 * for it, which a resource's name never has. It also needs none of that key space's
	 * machinery — no rename migration, since nothing renames a resource, and no
	 * `collapseNewParents` pass, since a band a reader has not ruled on is open.
	 *
	 * Keyed by {@link laneKey}, never by the spelling on screen: a band is IDENTIFIED
	 * case-insensitively (`deriveLanes` maps `name.toLowerCase()` to the lane), while its
	 * displayed name is whichever source minted the row — the declared roster, else the
	 * first result, else an absence. So the display can change case with no resource
	 * changing, and a fold keyed on it would silently reopen and strand its old key.
	 */
	isLaneCollapsed(name: string): boolean {
		return this.foldedLanes.has(laneKey(name));
	}

	/** Returns true when the state actually changed — {@link set}'s own contract. */
	setLaneCollapsed(name: string, collapsed: boolean): boolean {
		const key = laneKey(name);
		if (this.foldedLanes.has(key) === collapsed) return false;
		if (collapsed) this.foldedLanes.add(key);
		else this.foldedLanes.delete(key);
		this.scheduleSave();
		return true;
	}

	/**
	 * Whether one board column or horizon bucket is folded shut — and, the first time a
	 * column's own default would fold it, the act of folding it.
	 *
	 * That is `collapseNewParents`' rule (a thing nobody has ruled on takes its default
	 * exactly once) asked lazily rather than in a pass on the data update, because unlike a
	 * parent a column does not exist in the MODEL: `boardColumns` and `buildRoadmap` derive
	 * it inside the render, so the render is the first moment there is anything to settle.
	 * A read that writes is the price of that, and it is bounded — it fires once per column
	 * whose default applies, schedules a save and renders nothing.
	 *
	 * The default is asked freshly every pass rather than remembered as "seen", which is
	 * again the tree's own shape: a row is not a parent until it has children, and a done
	 * column is not noise until its last open card is finished. So a column that finishes
	 * folds itself, and {@link openedColumns} is what makes that survivable — an explicit
	 * open is remembered against exactly this default and is never taken back.
	 */
	columnCollapsed(scope: ColumnScope, value: string | null, autoCollapse: boolean): boolean {
		const key = columnKey(scope, value);
		if (this.foldedColumns.has(key)) return true;
		// Open is the default, so an unfolded column nobody has ruled on needs no entry —
		// only an open that CONTRADICTS a fold does, which is what `openedColumns` holds.
		if (!autoCollapse || this.openedColumns.has(key)) return false;
		this.foldedColumns.add(key);
		this.scheduleSave();
		return true;
	}

	setColumnCollapsed(scope: ColumnScope, value: string | null, collapsed: boolean): void {
		const key = columnKey(scope, value);
		// Exclusive: the two sets are one tri-state (folded, opened, never ruled on), so a
		// key in both would make "did the reader open this against its default" unanswerable.
		if (collapsed) {
			this.foldedColumns.add(key);
			this.openedColumns.delete(key);
		} else {
			this.foldedColumns.delete(key);
			this.openedColumns.add(key);
		}
		this.scheduleSave();
	}

	/** Returns true when the state actually changed. */
	set(key: string, collapsed: boolean): boolean {
		const changed = collapsed ? !this.collapsed.has(key) : this.collapsed.delete(key);
		if (collapsed) this.collapsed.add(key);
		// An explicit expand or collapse settles this row, so the initial state is not
		// applied to it later. That matters most for a row with no children yet: a drop
		// or a create expands it before the write, and the refresh that follows would
		// otherwise collapse it as a newly seen parent and hide what just landed there.
		this.settled.add(key);
		this.scheduleSave();
		return changed;
	}

	/**
	 * A parent nobody has ruled on opens collapsed — "nobody" being per parent, not
	 * per pass, so a data update does not undo what was expanded and a restored
	 * session does not re-collapse what was left open.
	 *
	 * All three scopes, from one pass: the grid's default is the tree's, and this runs on
	 * a data update rather than per projection, so a scope not on screen would otherwise
	 * be settled by nobody and open every row (or every card) of a whole backlog the
	 * first time it was shown.
	 */
	collapseNewParents(items: BacklogItem[]): void {
		for (const item of items) {
			if (item.children.length === 0) continue;
			for (const key of [item.file.path, TIMELINE_SCOPE + item.file.path, CARD_SCOPE + item.file.path]) {
				if (this.settled.has(key)) continue;
				this.settled.add(key);
				this.collapsed.add(key);
			}
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
		for (const key of [...this.settled]) {
			const moved = movedPath(notePath(key), oldPath, newPath);
			// A folder rename carries every row beneath it, so this cannot match on the
			// renamed path alone — the event for a moved folder names the folder, and
			// every row in it would otherwise be left behind under the old prefix.
			if (moved === null) continue;
			// Back into the scope it came from: a rename moves the item, never the
			// question the scope is asking about it.
			const next = scopeOf(key) + moved;
			this.settled.delete(key);
			this.settled.add(next);
			if (this.collapsed.delete(key)) this.collapsed.add(next);
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
		this.id = resolveViewIdentity(this.host.app, viewEl, this.host.config.name);
		// No identifiable base: session-only, exactly as before this was persisted.
		if (this.id === null) return;
		const { folds, prefs } = loadViewState(this.host.app, this.id);
		this.collapsed = new Set(folds.collapsed);
		// Both lists settle a key; only the collapsed ones are shut.
		this.settled = new Set([...folds.collapsed, ...folds.expanded]);
		seedTimelineScope(this.collapsed, this.settled);
		seedCardScope(this.collapsed, this.settled);
		this.prefs = prefs;
		this.hiddenShelfTypes = new Set(prefs.shelfHiddenTypes ?? []);
		// The stored map itself, not a copy: `PREF_READERS`' own reader already built it on
		// a null prototype, which is the only property the live map needs of it.
		this.colWidths = prefs.colWidths ?? (Object.create(null) as Record<string, number>);
		// Normalized on the way back in as well, so an entry written before the key was
		// canonical still shuts the band it was about.
		this.foldedLanes = new Set(folds.lanes.map(laneKey));
		// Stored as minted — `columnKey` is already canonical, so unlike a lane's there is
		// nothing left to normalize here.
		this.foldedColumns = new Set(folds.collapsedColumns);
		this.openedColumns = new Set(folds.expandedColumns);
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
		const now = resolveViewIdentity(this.host.app, this.viewEl, this.host.config.name);
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
			dropViewState(this.host.app, this.id);
			this.id = moved;
		}
		const id = this.id;
		// Paths whose note is gone are not coming back under the same identity. This
		// is the one place that drops them, which is why it is keyed on the vault
		// rather than on the model: a query that has not warmed up yet, or a filter
		// the user narrowed, must not be read as "these notes no longer exist" and
		// throw away a session the user still wants.
		for (const key of this.settled) {
			if (this.host.app.vault.getAbstractFileByPath(notePath(key)) !== null) continue;
			this.settled.delete(key);
			this.collapsed.delete(key);
		}
		const expanded = [...this.settled].filter((key) => !this.collapsed.has(key));
		saveViewState(this.host.app, id, {
			folds: {
				collapsed: [...this.collapsed],
				expanded,
				lanes: [...this.foldedLanes],
				collapsedColumns: [...this.foldedColumns],
				expandedColumns: [...this.openedColumns],
			},
			prefs: this.prefs,
		});
	}
}
