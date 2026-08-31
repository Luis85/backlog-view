import { BacklogItem } from '../domain/model';
import { ShelfLayout, ShelfSort } from '../domain/shelf';
import {
	BOARD_MODE,
	CATALOG_MODE,
	DELIVERABLES_MODE,
	ITERATION_MODE,
	ProjectionMode,
	ROADMAP_MODE,
	dropViewState,
	loadViewState,
	saveViewState,
	ViewPrefs,
} from '../storage/viewStateStore';
import { movedPath, resolveViewIdentity, ViewIdentity } from '../storage/viewIdentity';
import { CARD_SCOPE, foldKeyPaths, movedFoldKey, notePath, TIMELINE_SCOPE } from '../storage/foldKeys';
import { BacklogViewHost, ColumnScope, Projection } from './host';

// Re-exported rather than moved at every call site: eight modules and three suites name
// these prefixes from here, and the constants did not change — only which layer defines
// them. See `storage/foldKeys.ts` for why that layer is the right one.
export { CARD_SCOPE, MYWORK_FOLD, RELEASE_FOLD, TIMELINE_SCOPE } from '../storage/foldKeys';

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
	iteration: ITERATION_MODE,
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
 * One resource's fold key — the identity `laneIdentity` (`domain/roadmap.ts`) hands over:
 * a `Resource` note's own PATH, or the milestones' shared constant for the one row with no
 * note behind it. Not lower-cased, and not any other fold of it: a vault path is
 * case-SENSITIVE (`columnKey`'s own rule below), so there is no middle answer between two
 * paths for a comparison to keep, the way there was between two spellings of one name.
 * The stored value is this identity rather than the display name, which nothing reads
 * back onto a screen.
 *
 * **A ONE-TIME cost, stated rather than hidden.** Before this (2026-08-28), a band was
 * identified by its lower-cased NAME — two resources sharing a basename shared one fold
 * bit, and a rename opened a band silently. Every row is a note now, so the identity is
 * its path; an entry a reader had already folded under the old name-keyed shape matches
 * no path today and opens once, on the first render after upgrading. No fallback is kept
 * for it: this repository carries no compatibility with an older stored shape, only with
 * `minAppVersion`, and keeping the old key alive here would mean carrying two key shapes
 * in the store forever to save one re-fold.
 */
function laneKey(identity: string): string {
	return identity;
}

/**
 * One board column's or horizon bucket's fold key: the scope it is drawn in, and its own
 * value. `''` is the no-state column, which is a safe sentinel because a state that reads
 * back empty is no state at all.
 *
 * SCOPED, because the same word can name a column on more than one screen — a requirements
 * `Done`, a Deliverables `Done` and a horizon called `Done` are three columns and three
 * folds. Lower-cased because `boardColumns` indexes its columns on `state.toLowerCase()`
 * and `buildRoadmap` does the same for buckets, so a value whose spelling changes is still
 * one column and has to stay one fold — unlike a lane's own key above, which is a path
 * and has no such casing to fold.
 *
 * A NUL joins the two halves rather than a printable separator, the reason
 * {@link TIMELINE_SCOPE} uses one: a state value is user data and may contain anything a
 * user can type.
 */
function columnKey(scope: ColumnScope, value: string | null, iteration: string | null = null): string {
	// The iteration board's columns are folded PER ITERATION: its three buckets wear the
	// same three names on every scope, so a key without the path folds Resolved on Sprint
	// 13 because the reader folded it on Sprint 12 — the collision the scope prefix
	// already prevents between screens, one level in. The path is not lower-cased: it is a
	// vault path, and two notes differing only in case are two notes.
	const scoped = scope === 'iteration' ? `${scope}\u0000${iteration ?? ''}` : scope;
	return `${scoped}\u0000${(value ?? '').toLowerCase()}`;
}

/** Marks a fold key as one of the iteration board's, whose middle field is a note path. */
const ITERATION_COLUMN_PREFIX = 'iteration\u0000';

/**
 * The same key with its iteration path moved — or null for a key this rename does not
 * touch. The second path-bearing stored value after `ViewPrefs.scope`, and it carries
 * that field's obligation exactly: a fold whose note is renamed must move with it, or the
 * board reopens columns the reader closed and the store keeps entries nothing will match.
 */
function movedColumnKey(key: string, oldPath: string, newPath: string): string | null {
	if (!key.startsWith(ITERATION_COLUMN_PREFIX)) return null;
	const rest = key.slice(ITERATION_COLUMN_PREFIX.length);
	const cut = rest.indexOf('\u0000');
	if (cut < 0) return null;
	const moved = movedPath(rest.slice(0, cut), oldPath, newPath);
	return moved === null ? null : ITERATION_COLUMN_PREFIX + moved + rest.slice(cut);
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
// NOT exported. `flush()`'s own vault-existence prune (below) always discards a
// two-path scoped key (`RELEASE_FOLD`, `MYWORK_FOLD`) before it can reach storage,
// whether or not this guard runs — the two never disagree at the persisted result, only
// in the Sets between `restore()` and the next flush, which nothing outside this module
// can read. The guard stays anyway: it costs one line and keeps this migration and
// `seedCardScope` beside it symmetric for the next reader, but its effect is
// unobservable from outside the module, and exporting production code to let a test
// watch an unobservable effect buys a green line at the cost of a wider surface — the
// module's own boundary is worth more than that one assertion. `seedCardScope`'s
// identical-looking guard is not the same case and keeps its own direct test: its
// `notePath` reduction seeds a REAL note's card as collapsed, which DOES reach disk, so
// that one is checked through a saved view.
function seedTimelineScope(collapsed: Set<string>, settled: Set<string>): void {
	const keys = [...settled];
	if (keys.some((key) => key.startsWith(TIMELINE_SCOPE))) return;
	for (const key of keys) {
		// Every two-path scoped prefix is new on this branch, so no entry any of them
		// wrote predates the dated axis's own scope — there is nothing here for this
		// one-time carry to recover. Left in, it mints a `TIMELINE_SCOPE + <scope>…`
		// compound that names no note and can never match anything again, while still
		// spending a slot against `MAX_FOLDS`. `foldKeyPaths(key).length > 1` is exactly
		// "carries a scope path besides its member" — the same predicate a third scoped
		// prefix would satisfy with no further row here.
		if (foldKeyPaths(key).length > 1) continue;
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
	// Same exclusion as `seedTimelineScope`, for the same reason: a two-path scoped fold
	// (`RELEASE_FOLD`, `MYWORK_FOLD`) predates neither scope, so there is no prior card
	// bit to recover from it. `notePath` reduces it to the bare MEMBER path, so left in,
	// folding a note on a release's or a person's own screen would seed that same note's
	// card as collapsed on the backlog view too — a fold the reader never made there.
	for (const path of new Set(keys.filter((key) => foldKeyPaths(key).length === 1).map(notePath))) {
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
 * asks in — and delegates the
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
	/** Resource bands folded shut, by {@link laneKey} — see {@link isLaneCollapsed}. */
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

	/**
	 * The `Iteration` note a board is scoped to, as the reader LEFT it — a path this
	 * module never resolves. Whether that path still names an iteration, and whether the
	 * property is even configured, is the view's question and is asked on every render;
	 * retaining it here is what lets a note that comes back restore the reader's choice.
	 */
	boardScope(): string | null {
		return this.prefs.scope ?? null;
	}

	setBoardScope(path: string | null): void {
		this.setPref('scope', path);
	}

	/**
	 * The release whose screen is open, as the reader LEFT it — `boardScope`'s own rule
	 * for the second path-valued pref, and here for the same two halves of it: this
	 * module never resolves the path (whether it still names a release is the release
	 * view's question, asked on every render), and {@link renameScoped} carries it when
	 * the note moves so a rename does not read as a deletion.
	 *
	 * **This controller's carry is one of TWO, and it is not the one that keeps the rule.**
	 * It belongs to the backlog view, which is what subscribes to `vault.on('rename')`
	 * here, so it runs on an entry a `.base` view had while it was a backlog view — a view
	 * whose type was switched keeps its identity and its entry — and never while the
	 * release view is the one on screen, which is the ordinary case. What keeps the rule
	 * is `renamePathPrefs` (`storage/viewStateStore.ts`), wired to the same event at the
	 * PLUGIN in `main.ts`, which walks every stored entry whatever view is loaded.
	 *
	 * This one is still needed beside it, and `flush` is why: this controller holds `prefs`
	 * in memory and saves them WHOLESALE, so a loaded backlog view whose in-memory copy
	 * still named the old path would write it straight back over the stored walk's answer.
	 */
	releasePref(): string | null {
		return this.prefs.release ?? null;
	}

	setReleasePref(path: string | null): void {
		this.setPref('release', path);
	}

	/**
	 * The person whose work is on screen, as the reader LEFT it — `releasePref`'s own two
	 * halves, for the my-work view's own pick: this module never resolves the path (whether
	 * it still names a `Resource` is the my-work view's question, asked on every render),
	 * and {@link renameScoped} carries it when the note moves so a rename does not read as
	 * a deletion. And `renameScoped` is not the only carry — `storage/viewStateStore.ts`'s
	 * `renamePathPrefs` walks every stored entry whatever view is loaded, for the ordinary
	 * case where the my-work view is the one on screen. This one is still needed beside it
	 * for `releasePref`'s own reason: a view whose type was switched to the backlog view
	 * keeps its identity and its entry, and `flush` writes `prefs` back wholesale — a
	 * stale in-memory `person` would overwrite the stored walk's correct answer the next
	 * time this controller saves (fix round 2, PR #234).
	 */
	personPref(): string | null {
		return this.prefs.person ?? null;
	}

	setPersonPref(path: string | null): void {
		this.setPref('person', path);
	}

	/**
	 * Which board the `Boards` position opens when no iteration scope is set — the stored
	 * word, `deliverables` or null for the product. Retained and cleared by the
	 * controller, which keeps it and `scope` from ever both being set.
	 */
	boardPick(): string | null {
		return this.prefs.board ?? null;
	}

	setBoardPick(value: string | null): void {
		this.setPref('board', value);
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

	/**
	 * Whether fully-done subtrees are drawn — the default, so the stored pick is its
	 * absence. The inversion lives here and nowhere else, `bucketGrid`'s own rule below:
	 * everything above asks about SHOWING, which is what the toggle is named for, while
	 * the store keeps a default written as nothing at all.
	 */
	showCompleted(): boolean {
		return !(this.prefs.hideCompleted ?? false);
	}

	setShowCompleted(value: boolean): void {
		this.setPref('hideCompleted', value ? null : true);
	}

	/**
	 * Whether a horizon bucket lays its cards out as a grid — the default, so the stored
	 * pick is its absence. The inversion lives here and nowhere else: everything above
	 * asks about the GRID, which is what the toggle is named for, while the store keeps
	 * its own rule that a default is written as nothing at all.
	 */
	bucketGrid(): boolean {
		return !(this.prefs.bucketList ?? false);
	}

	setBucketGrid(grid: boolean): void {
		this.setPref('bucketList', grid ? null : true);
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

	/**
	 * How the shelf lays its cards out. The card grid is the default, so the stored pick is
	 * its absence — `bucketGrid`'s own rule above, and this is the only place the inversion
	 * between the stored boolean and the named layout is spelled. Everything above asks for
	 * a `ShelfLayout`, which is what the picker and the menu entries are named for.
	 */
	shelfLayout(): ShelfLayout {
		return (this.prefs.shelfList ?? false) ? 'list' : 'cards';
	}

	setShelfLayout(layout: ShelfLayout): void {
		this.setPref('shelfList', layout === 'list' ? true : null);
	}

	/** The retained shelf height for this saved view — null means the stylesheet's own share of the pane. */
	shelfHeightPick(): number | null {
		return this.prefs.shelfHeight ?? null;
	}

	setShelfHeight(value: number | null): void {
		this.setPref('shelfHeight', value);
	}

	shelfHiddenTypes(): ReadonlySet<string> {
		return this.hiddenShelfTypes;
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.hiddenShelfTypes = new Set(types);
		this.setPref('shelfHiddenTypes', [...types]);
	}

	/**
	 * Whether one resource's whole band is folded shut, asked of the row's own identity
	 * (`laneIdentity`, `domain/roadmap.ts`) — the note's path, or the milestones' constant.
	 *
	 * Its own set rather than a scope in {@link set}'s key space, and the reason is the
	 * flush: everything in there is a note PATH and is DROPPED when the vault has no file
	 * for it — which this key now genuinely is for every row but the milestones', unlike
	 * before this identity was a note at all. It stays out of that key space anyway,
	 * deliberately narrower than a full migration: no `renamePath` entry, so a resource's
	 * note renamed elsewhere leaves its old fold entry stranded rather than carried to the
	 * new path, and no `collapseNewParents` pass, since a band a reader has not ruled on is
	 * open. The stranded entry is a known, accepted cost (Task 5, 2026-08-28) — one
	 * open band on the next rename, no worse than the case-changing rename a name-keyed
	 * fold already could not survive — recorded here rather than silently fixed by adding
	 * this key to the migrated space.
	 *
	 * Keyed by {@link laneKey}, never by the spelling on screen: two resources of one
	 * basename draw ONE disambiguated label right up until they collide, and a rename
	 * changes what `lane.name` says without the note itself changing — a fold keyed on
	 * either would fold the wrong row, or reopen one the rename never touched.
	 */
	isLaneCollapsed(identity: string): boolean {
		return this.foldedLanes.has(laneKey(identity));
	}

	/** Returns true when the state actually changed — {@link set}'s own contract. */
	setLaneCollapsed(identity: string, collapsed: boolean): boolean {
		const key = laneKey(identity);
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
		const key = columnKey(scope, value, this.boardScope());
		if (this.foldedColumns.has(key)) return true;
		// Open is the default, so an unfolded column nobody has ruled on needs no entry —
		// only an open that CONTRADICTS a fold does, which is what `openedColumns` holds.
		if (!autoCollapse || this.openedColumns.has(key)) return false;
		this.foldedColumns.add(key);
		this.scheduleSave();
		return true;
	}

	setColumnCollapsed(scope: ColumnScope, value: string | null, collapsed: boolean): void {
		const key = columnKey(scope, value, this.boardScope());
		// Exclusive: the two sets are one tri-state (folded, opened, never ruled on), so a
		// key in both would make "did the reader open this against its default" unanswerable.
		// Deleted before the add on the branch taken, matching `set`'s own reason: a bare
		// `.add` on an already-present key leaves it at its ORIGINAL position, which
		// `readFolds`'s tail-retention budget reads as old. No caller today passes a
		// `collapsed` equal to the column's current state (every one negates what it just
		// read), so this is not reachable yet — fixed anyway, since the shape is identical
		// to `set`'s and a future caller (a "collapse all columns" action, say) would only
		// have to call this once redundantly to reopen the same bug.
		if (collapsed) {
			this.foldedColumns.delete(key);
			this.foldedColumns.add(key);
			this.openedColumns.delete(key);
		} else {
			this.foldedColumns.delete(key);
			this.openedColumns.delete(key);
			this.openedColumns.add(key);
		}
		this.scheduleSave();
	}

	/**
	 * Returns true when the state actually changed.
	 *
	 * Both sets are re-added through a DELETE first, never a bare `.add`. A JS `Set`
	 * does not move an already-present key to the end on a re-add — it keeps its
	 * original insertion position — and `flush()` writes both sets out in iteration
	 * order, which `readFolds`'s tail-retention budget (`storage/viewStateStore.ts`,
	 * `MAX_FOLDS`) trusts to mean "oldest first, newest last". `settled` in particular
	 * holds nearly every key this row has ever touched, so almost every call here is a
	 * re-add of an EXISTING key: without the delete, a row settled long ago would stay
	 * pinned near the front no matter how recently it was actually toggled, and a
	 * saturated budget would evict it first regardless.
	 */
	set(key: string, collapsed: boolean): boolean {
		const changed = collapsed ? !this.collapsed.has(key) : this.collapsed.delete(key);
		if (collapsed) {
			this.collapsed.delete(key);
			this.collapsed.add(key);
		}
		// An explicit expand or collapse settles this row, so the initial state is not
		// applied to it later. That matters most for a row with no children yet: a drop
		// or a create expands it before the write, and the refresh that follows would
		// otherwise collapse it as a newly seen parent and hide what just landed there.
		this.settled.delete(key);
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
			// One helper with `renamePathFolds` (`storage/viewStateStore.ts`), not a second
			// spelling of the same arithmetic: this walk covers the LOADED view's in-memory
			// copy, which `flush` writes back wholesale, and the store's walk covers every
			// stored entry — the same pair `renameScoped` and `renamePathPrefs` already form
			// for the prefs. It also carries a folder rename to every row beneath it, since
			// the event for a moved folder names the folder and nothing under it.
			const next = movedFoldKey(key, oldPath, newPath);
			if (next === null) continue;
			this.settled.delete(key);
			// The target is deleted before it is added, `set` and `setColumnCollapsed`'s
			// third site of the same shape: a bare `.add` of a key the set ALREADY holds
			// leaves it at its original position, which `readFolds`'s tail-retention budget
			// reads as old and evicts first. Not reachable today — Obsidian refuses a rename
			// onto an existing note, so the new path can only already be settled if its key
			// is stale — but a batch rename, or any caller that renamed A→B and then B→B,
			// would reproduce it, and the cost of keeping it right is one line.
			this.settled.delete(next);
			this.settled.add(next);
			if (this.collapsed.delete(key)) {
				this.collapsed.delete(next);
				this.collapsed.add(next);
			}
			changed = true;
		}
		if (this.renameScoped(oldPath, newPath)) changed = true;
		if (changed) this.scheduleSave();
	}

	/**
	 * The stored values that hold a note path without being a fold KEYED by one: the
	 * iteration this board is scoped to, the release whose screen is open, the person the
	 * my-work view has picked, and the column folds keyed by that same iteration path.
	 *
	 * Out of line from the loop above rather than merged into it, because they are a
	 * different question asked of a different collection — that loop walks `settled`,
	 * whose every entry IS a note path, while these carry one inside a value. What
	 * they share is the reason: a rename is an edit to the same note, and a stored pick
	 * that does not follow it silently stops matching. For the release that failure is
	 * worse than merely silent — a stale path resolves to no release, so a renamed note
	 * drops the reader to the index indistinguishably from a deleted one.
	 *
	 * The STORE has a walk of its own over the same three values (`renamePathPrefs`, wired
	 * at the plugin), and this is not a duplicate of it: that one covers every stored
	 * entry whatever view is loaded, this one covers the in-memory `prefs` that `flush`
	 * writes back wholesale. Neither replaces the other — see `releasePref` and
	 * `personPref` above.
	 */
	private renameScoped(oldPath: string, newPath: string): boolean {
		let changed = false;
		// `movedPath` matches the path itself OR its `oldPath/` prefix, so a folder anybody
		// tidies does not strand every pick inside it — the event names the folder and
		// never the notes under it.
		const carry = (current: string | null, set: (path: string) => void): void => {
			const moved = current === null ? null : movedPath(current, oldPath, newPath);
			if (moved === null) return;
			set(moved);
			changed = true;
		};
		carry(this.boardScope(), (path) => this.setBoardScope(path));
		carry(this.releasePref(), (path) => this.setReleasePref(path));
		carry(this.personPref(), (path) => this.setPersonPref(path));
		for (const set of [this.foldedColumns, this.openedColumns]) {
			for (const key of [...set]) {
				const moved = movedColumnKey(key, oldPath, newPath);
				if (moved === null) continue;
				set.delete(key);
				set.add(moved);
				changed = true;
			}
		}
		return changed;
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
		// No normalization on the way back in: `laneKey` is the identity `laneIdentity`
		// already hands over, so there is nothing left to canonicalize here. A legacy
		// name-keyed entry from before this shape (2026-08-28) is not converted either —
		// `laneKey`'s own comment states why — so it is simply never matched again.
		this.foldedLanes = new Set(folds.lanes);
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
		//
		// Asked of EVERY path the key names, not just the one it is filed under: a
		// release-fold key holds its release as well as its member, and a fold whose
		// release note is gone names a screen that can never be drawn again.
		for (const key of this.settled) {
			if (foldKeyPaths(key).every((path) => this.host.app.vault.getAbstractFileByPath(path) !== null)) continue;
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
