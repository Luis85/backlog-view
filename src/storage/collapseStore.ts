import { App, FileView } from 'obsidian';

/**
 * Persistence for the state that is purely the user's working position: which
 * rows are open and which are shut, which projection — tree, board or roadmap —
 * the view is showing, which roadmap axis it shows when both are configured, and
 * which type the tree is focused on.
 *
 * This deliberately does NOT go in the `.base` file. The rule: base settings are
 * saved on the view (the options in the `.base`); UI state is saved here, in
 * vault-scoped localStorage through Obsidian's own
 * `loadLocalStorage`/`saveLocalStorage`, under a single key holding one entry per
 * base view. The `.base` is shared configuration, while a collapsed row or a
 * chosen projection is one person's working position on one device — and a path
 * per collapsed row is exactly the growth that shared file should not take.
 */

/** One vault-scoped entry holds every Product Backlog view's collapse state. */
const STORE_KEY = 'product-backlog:collapse';
/**
 * Backstop on how many KEYS a single view may remember. A real backlog is a few hundred
 * rows, so this is far above normal use and exists only so a pathological vault cannot
 * grow the entry without bound. Collapsed keys are kept first: an expanded entry only
 * suppresses the default, while a collapsed one is visible state.
 *
 * A key is a note path under one scope, and a parent settles under every scope it has
 * (the tree's, the dated axis's and a card's own — see `view/collapseState.ts`), so this
 * is up to three times the note count it bounds. It has grown with each scope added for
 * exactly that reason: leaving it at a lower multiple would quietly halve the headroom in
 * NOTES this has always promised, and the first thing lost at saturation is the expanded
 * keys, which read back as rows the user opened and found shut again.
 */
const MAX_PATHS = 12000;

/** The value the `mode` field holds while the view is a board. */
export const BOARD_MODE = 'board';
/** The value the `mode` field holds while the view is a roadmap. */
export const ROADMAP_MODE = 'roadmap';
/** The value the `mode` field holds while the view is the Deliverables board. */
export const DELIVERABLES_MODE = 'deliverables';
/** The value the `mode` field holds while the view is the test catalog. */
export const CATALOG_MODE = 'catalog';
/**
 * Every value the `mode` field may hold — the one list, read by `readEntry` below and
 * published as the TYPE beneath it.
 *
 * It runs storage → view and never the reverse, because `storage/` may not import
 * `view/` and lint fails the build on it; the constants already live here, so this is the
 * direction that works. What it buys is that the round trip stops being three independent
 * statements. `PROJECTION_MODE` (`view/collapseState.ts`) is a `Record<Projection, …>`
 * and so cannot compile without a case for a new projection; the OTHER two directions —
 * reading a stored value back into a projection, and deciding which stored values are
 * trusted — were a hand-written `if` chain with an unguarded `return 'tree'` and a
 * hand-written array literal beside it. Both accepted a new projection silently and
 * answered `tree`, which is not merely a lost session on reload: `setProjection` stores
 * the constant and then renders, and the render asks which projection this is, so the
 * toggle would do nothing the moment it was clicked.
 */
const PROJECTION_MODES = [BOARD_MODE, ROADMAP_MODE, DELIVERABLES_MODE, CATALOG_MODE] as const;
/**
 * One of those values, and the whole of what crosses the layer boundary.
 * `view/collapseState.ts` types its `Projection → constant` map to this, which makes the
 * agreement a COMPILE error rather than a promise: a projection mapped to a constant this
 * list does not hold would be stored, refused on the way back in, and read as the tree —
 * the exact silence this pair exists to prevent. The list itself stays private, because
 * the check is what the view needs and the values are this module's own business.
 */
export type ProjectionMode = (typeof PROJECTION_MODES)[number];
/**
 * The values the `axis` field may hold — which roadmap axis this saved view shows
 * when both are configured. Mirrors `RoadmapAxis` in `domain/roadmap.ts`; spelled
 * here as strings because stored state is read defensively, not trusted as a type.
 */
const AXIS_VALUES = ['horizons', 'dates', 'resources'];
/**
 * The values the `zoom` field may hold. Mirrors `ScaleId` in `domain/timeline.ts`;
 * spelled here as strings for the same reason `AXIS_VALUES` is — stored state is read
 * defensively, not trusted as a type.
 */
const ZOOM_VALUES = ['week', 'month', 'quarter'];
/** The values the `density` field may hold; absent means comfortable rows, the default. */
const DENSITY_VALUES = ['compact'];
/**
 * Bounds on the `leadWidth` field, in pixels. Below the minimum the badge and its
 * padding alone would fill the column, leaving no room for a title at all; above the
 * maximum a fat-fingered drag would push most of the grid off screen. Unlike every
 * other stored pick this one is a NUMBER rather than an enum, so `readEntry` cannot
 * check it against a fixed vocabulary — a value outside this range reads back as
 * absent instead, never trusted into a layout.
 */
export const MIN_TIMELINE_LEAD_PX = 160;
export const MAX_TIMELINE_LEAD_PX = 480;
/** The values the `shelfSort` field may hold. Mirrors `ShelfSort` in `domain/shelf.ts`. */
const SHELF_SORT_VALUES = ['tree', 'title', 'modified'];

/** One view's working position: the rows it has settled, and its projection. */
export interface CollapseSnapshot {
	collapsed: Set<string>;
	expanded: Set<string>;
	/** `BOARD_MODE`, `ROADMAP_MODE` or `DELIVERABLES_MODE`; null or absent means the tree. */
	mode?: string | null;
	/** The retained roadmap-axis pick; null or absent means the user never picked. */
	axis?: string | null;
	/** The retained timeline zoom; null or absent means the user never picked. */
	zoom?: string | null;
	/** The retained timeline row density; null or absent means comfortable, the default. */
	density?: string | null;
	/**
	 * The retained timeline lead-column width, in pixels; null or absent means
	 * `TIMELINE_LEAD_PX`, the default. A number, not an enum — see
	 * `MIN_TIMELINE_LEAD_PX`/`MAX_TIMELINE_LEAD_PX` for how it is validated on read.
	 */
	leadWidth?: number | null;
	/** The focused type name; null or absent means the whole tree, the default. */
	focus?: string | null;
	/**
	 * True when a plain click on a row folds it; absent means it opens the note, the
	 * default. A boolean rather than the two-name vocabulary this was while it lived in
	 * the `.base`: the only thing that reads it is a toggle.
	 */
	clickFolds?: boolean;
	/** True only once the user has explicitly expanded the shelf; absent means collapsed, the default. */
	shelfExpanded?: boolean;
	/** Absent or null means 'tree' (sibling order), the default. */
	shelfSort?: string | null;
	/** Types currently hidden by the shelf's own type filter; absent or empty means none. */
	shelfHiddenTypes?: string[] | null;
	/**
	 * Resource bands the reader has folded shut, by NAME. Absent or empty means every band
	 * is open, which is the default a fresh view gets.
	 *
	 * Beside the shelf's hidden types rather than in the `collapsed` path set, and that is
	 * the whole reason it is a field of its own: everything in that set is a NOTE PATH, and
	 * the flush prunes any entry the vault has no file for. A resource is a name somebody
	 * typed into the view options or wrote on a note — never a file — so a band's key would
	 * be dropped on the first save. The same fact makes it need no rename migration: nothing
	 * renames a resource, and a roster edited in the options is the reader saying which rows
	 * exist.
	 */
	collapsedLanes?: string[] | null;
	/**
	 * Board columns and horizon buckets the reader has folded shut, by KEY — a scope and
	 * the column's own value, minted by `columnKey` in `view/collapseState.ts`.
	 *
	 * Beside {@link CollapseSnapshot.collapsedLanes} and out of the `collapsed` path set
	 * for the identical reason: everything in that set is a note PATH, so a state value put
	 * there would be dropped by the first flush. A pair rather than one list, because
	 * unlike a band a column HAS a default worth suppressing — a done column of finished
	 * work starts shut — so the two together say what has been ruled on, exactly as
	 * `collapsed`/`expanded` do for rows.
	 */
	collapsedColumns?: string[] | null;
	/** Columns explicitly opened; settled is this and {@link collapsedColumns} together. */
	expandedColumns?: string[] | null;
}

/** Which base view an entry belongs to. */
export interface ViewIdentity {
	/** Path of the `.base` file. */
	base: string;
	/** The view's name within that base. */
	view: string;
}

interface StoredEntry {
	/**
	 * The base this entry belongs to, carried rather than parsed back out of the key.
	 * A view name may contain anything a user can type — "Sprint #3" is an ordinary
	 * name — so splitting the key on a separator would misread the base path and let
	 * another view's save prune a live entry.
	 */
	base: string;
	collapsed: string[];
	expanded: string[];
	/** Absent while the view is a tree — the default needs no entry at all. */
	mode?: string;
	/** Absent until the user picks a roadmap axis; retained even while unused. */
	axis?: string;
	/** Absent until the user picks a timeline zoom; retained even while unused. */
	zoom?: string;
	/** Absent means comfortable rows, the default. */
	density?: string;
	/**
	 * Absent means `TIMELINE_LEAD_PX`, the default. Validated against
	 * `MIN_TIMELINE_LEAD_PX`/`MAX_TIMELINE_LEAD_PX` on the way in — see `readLeadWidth`.
	 */
	leadWidth?: number;
	/**
	 * Absent means the whole tree, the default. Stored as the type name the user picked
	 * and NOT checked against the vocabulary here: `focusTarget` already answers a name
	 * no configured type matches with "no focus", the same way it did while this lived
	 * in the `.base`.
	 */
	focus?: string;
	/** Absent means a click opens the note, the default; stored only as `true`, like `shelfExpanded`. */
	clickFolds?: boolean;
	/** Absent means collapsed, the default; only ever stored as `true`, since `false` needs no entry. */
	shelfExpanded?: boolean;
	/** Absent means 'tree', the default. */
	shelfSort?: string;
	/** Absent or empty means nothing hidden. */
	shelfHiddenTypes?: string[];
	/** Absent or empty means every resource band is open. */
	collapsedLanes?: string[];
	/** Absent or empty means no column has been folded. */
	collapsedColumns?: string[];
	/** Absent or empty means no column has been explicitly opened. */
	expandedColumns?: string[];
}

type StoredMap = Record<string, StoredEntry>;

/**
 * The map key. It only has to be unique, never parsed — both halves are encoded so
 * no pair of base path and view name can collide with a different pair.
 */
function mapKey(id: ViewIdentity): string {
	return `${encodeURIComponent(id.base)}#${encodeURIComponent(id.view)}`;
}

/**
 * Which base view this is, as a storage key — or null when that cannot be answered.
 *
 * The Bases API hands a view no reference to its own file, but the leaf rendering it
 * does have one: the view element lives inside some `FileView`'s container, and that
 * view knows its file. The view's own name disambiguates several views of one base.
 *
 * Null means session-only, exactly as before persistence existed. Falling back to a
 * shared key would be worse than not persisting: two bases would inherit each other's
 * open rows and prune each other's paths.
 */
export function collapseStoreIdentity(app: App, el: HTMLElement, viewName: string): ViewIdentity | null {
	// An array rather than a nullable local: the callback runs synchronously, but
	// narrowing after a closure assignment does not survive the type checker.
	const owner: string[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		if (owner.length > 0) return;
		const view = leaf.view;
		if (!(view instanceof FileView) || !view.file || !view.containerEl.contains(el)) return;
		// It must be the `.base` itself. A base embedded in a note is drawn inside that
		// note's leaf, so the file here would be the host note — and every base embedded
		// in it, plus every view of each, would answer to one key and overwrite each
		// other. That is the sharing this function exists to refuse, so an embedded base
		// keeps its collapse state for the session and no longer.
		if (view.file.extension === 'base') owner.push(view.file.path);
	});
	return owner.length > 0 ? { base: owner[0], view: viewName } : null;
}

/**
 * Follow a `.base` that was renamed or moved — directly, or by moving a folder above
 * it. The path is half the key, so without this an ordinary bit of vault tidying
 * would orphan every entry for that base: never found again under the new path, and
 * then deleted by the next save, because a base that no longer exists is exactly what
 * `pruneMissingBases` looks for.
 *
 * Takes any rename, file or folder, and does nothing when no entry sits under the old
 * path. That also makes it idempotent: whether Obsidian reports a folder move as one
 * event or as one per descendant, the second pass finds nothing left to move.
 */
export function rekeyBase(app: App, oldPath: string, newPath: string): void {
	const map = readMap(app);
	let moved = false;
	for (const [key, entry] of Object.entries(map)) {
		const base = movedPath(entry.base, oldPath, newPath);
		if (base === null) continue;
		const view = viewNameOf(key);
		if (view === null) continue;
		delete map[key];
		map[mapKey({ base, view })] = { ...entry, base };
		moved = true;
	}
	if (moved) writeMap(app, map);
}

/**
 * Where `path` ends up when `oldPath` becomes `newPath`, or null when it is unaffected.
 * A rename moves the thing itself and everything beneath it, so a folder carries its
 * whole subtree — which is the only way a `.base` inside a moved folder is noticed.
 */
export function movedPath(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath;
	return path.startsWith(`${oldPath}/`) ? newPath + path.slice(oldPath.length) : null;
}

/**
 * The view name back out of a key. Only possible because both halves are encoded,
 * so the single literal `#` is always the separator — the property that
 * `pruneMissingBases` deliberately does not rely on, but that a rename needs.
 */
function viewNameOf(key: string): string | null {
	const parts = key.split('#');
	if (parts.length !== 2) return null;
	try {
		return decodeURIComponent(parts[1]);
	} catch {
		return null;
	}
}

function defaultShelf(
	entry: StoredEntry | undefined,
): Pick<CollapseSnapshot, 'shelfExpanded' | 'shelfSort' | 'shelfHiddenTypes' | 'collapsedLanes'> {
	return {
		shelfExpanded: entry?.shelfExpanded ?? false,
		shelfSort: entry?.shelfSort ?? null,
		shelfHiddenTypes: entry?.shelfHiddenTypes ?? [],
		collapsedLanes: entry?.collapsedLanes ?? [],
	};
}

/**
 * The folded columns and the opened ones — a pair, so a column nobody has ruled on can
 * still be told from one the reader deliberately opened against its own default.
 */
function defaultColumns(entry: StoredEntry | undefined): Pick<CollapseSnapshot, 'collapsedColumns' | 'expandedColumns'> {
	return {
		collapsedColumns: entry?.collapsedColumns ?? [],
		expandedColumns: entry?.expandedColumns ?? [],
	};
}

/**
 * The seven picks whose default is simply absence, read back off a stored entry — split
 * out of {@link loadCollapseState} so that function's own complexity stays readable as
 * the picks grow; this one is nothing but `??` chains.
 */
function defaultPicks(
	entry: StoredEntry | undefined,
): Pick<CollapseSnapshot, 'mode' | 'axis' | 'zoom' | 'density' | 'leadWidth' | 'focus' | 'clickFolds'> {
	return {
		mode: entry?.mode ?? null,
		axis: entry?.axis ?? null,
		zoom: entry?.zoom ?? null,
		density: entry?.density ?? null,
		leadWidth: entry?.leadWidth ?? null,
		focus: entry?.focus ?? null,
		clickFolds: entry?.clickFolds ?? false,
	};
}

/** Empty is the default on both sides, so neither list is written when it holds nothing. */
function writeColumns(entry: StoredEntry, snapshot: CollapseSnapshot): void {
	const collapsed = snapshot.collapsedColumns ?? [];
	const expanded = snapshot.expandedColumns ?? [];
	if (collapsed.length > 0) entry.collapsedColumns = collapsed;
	if (expanded.length > 0) entry.expandedColumns = expanded;
}

function writeShelf(entry: StoredEntry, shelf: ShelfState): void {
	if (shelf.expanded) entry.shelfExpanded = true;
	if (shelf.sort !== null) entry.shelfSort = shelf.sort;
	if (shelf.types.length > 0) entry.shelfHiddenTypes = shelf.types;
	if (shelf.lanes.length > 0) entry.collapsedLanes = shelf.lanes;
}

/** The frame's own display picks, grouped so `writeShelf` stays under max-params. */
interface ShelfState {
	expanded: boolean;
	sort: string | null;
	types: string[];
	/** Resource bands folded shut — beside the shelf's because both are per-view name sets. */
	lanes: string[];
}

/**
 * The seven picks whose default is simply absence — the tree, no axis pick, no zoom, no
 * density, the default lead width, the whole tree, a click that opens. Empty, false and
 * null are the same thing
 * here, which is what makes clearing a focus remove the field rather than store a name
 * meaning "none". `leadWidth` fits the same truthy check as the others despite being a
 * number: every value this module ever WRITES is already clamped to
 * `MIN_TIMELINE_LEAD_PX..MAX_TIMELINE_LEAD_PX`, so it is never zero.
 */
function writePicks(entry: StoredEntry, snapshot: CollapseSnapshot): void {
	if (snapshot.mode) entry.mode = snapshot.mode;
	if (snapshot.axis) entry.axis = snapshot.axis;
	if (snapshot.zoom) entry.zoom = snapshot.zoom;
	if (snapshot.density) entry.density = snapshot.density;
	if (snapshot.leadWidth) entry.leadWidth = snapshot.leadWidth;
	if (snapshot.focus) entry.focus = snapshot.focus;
	if (snapshot.clickFolds) entry.clickFolds = true;
}

export function loadCollapseState(app: App, id: ViewIdentity): CollapseSnapshot {
	const entry = readMap(app)[mapKey(id)];
	return {
		collapsed: new Set(entry?.collapsed ?? []),
		expanded: new Set(entry?.expanded ?? []),
		...defaultPicks(entry),
		...defaultShelf(entry),
		...defaultColumns(entry),
	};
}

/**
 * Write this view's entry, leaving every other view's alone. Entries whose base file
 * is gone go with it — the only chance to notice, since nothing enumerates the bases
 * that ever wrote here.
 */
export function saveCollapseState(app: App, id: ViewIdentity, snapshot: CollapseSnapshot): void {
	const map = readMap(app);
	const key = mapKey(id);
	const collapsed = [...snapshot.collapsed].slice(0, MAX_PATHS);
	const expanded = [...snapshot.expanded].slice(0, MAX_PATHS - collapsed.length);
	const entry: StoredEntry = { base: id.base, collapsed, expanded };
	writePicks(entry, snapshot);
	writeShelf(entry, {
		expanded: snapshot.shelfExpanded ?? false,
		sort: snapshot.shelfSort ?? null,
		types: snapshot.shelfHiddenTypes ?? [],
		lanes: snapshot.collapsedLanes ?? [],
	});
	writeColumns(entry, snapshot);
	// A view at its defaults — nothing settled, the tree, no pick, shelf untouched —
	// needs no entry. That is the same question the read side asks of a stored entry, so
	// it is asked with the same function: a field added to one and forgotten in the other
	// is how an entry comes to be written and then dropped on the way back in.
	if (entryHasContent(entry)) map[key] = entry;
	else delete map[key];
	pruneMissingBases(app, map, key);
	writeMap(app, map);
}

/** Forget one view's entry — used when its state has just been written elsewhere. */
export function dropCollapseState(app: App, id: ViewIdentity): void {
	const map = readMap(app);
	if (!(mapKey(id) in map)) return;
	delete map[mapKey(id)];
	writeMap(app, map);
}

function writeMap(app: App, map: StoredMap): void {
	try {
		app.saveLocalStorage(STORE_KEY, map);
	} catch (e) {
		// A full or unavailable localStorage must not take the view down with it:
		// collapse state is a convenience, and the tree renders fine without it.
		console.error('Product Backlog: could not save collapse state', e);
	}
}

/** Drop entries for bases that no longer exist, never the one being written. */
function pruneMissingBases(app: App, map: StoredMap, keep: string): void {
	for (const [key, entry] of Object.entries(map)) {
		if (key === keep) continue;
		if (app.vault.getAbstractFileByPath(entry.base) === null) delete map[key];
	}
}

/**
 * Read the stored map defensively. It is user-writable state on disk that older —
 * or newer — versions of this plugin may have written, so every level is checked
 * and anything unrecognizable is dropped rather than trusted.
 */
function readMap(app: App): StoredMap {
	let raw: unknown = null;
	try {
		raw = app.loadLocalStorage(STORE_KEY) as unknown;
	} catch {
		return {};
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const map: StoredMap = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		const entry = readEntry(value);
		if (entry) map[key] = entry;
	}
	return map;
}

/**
 * An optional field's stored value, kept only when it is one this plugin has ever
 * written. Stored state is user-writable data another version may have written, so
 * anything else is dropped rather than trusted — never guessed at as the tree default.
 */
function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/**
 * `leadWidth`'s own version of {@link readEnum} — a NUMBER rather than an enum, so there
 * is no fixed vocabulary to check it against. Finite and inside the allowed range is the
 * whole of the check: a value failing either test reads back as absent (the default)
 * rather than clamped to the nearest bound, because a clamp would still trust a
 * corrupt-but-plausible number into the layout, and this is user-writable state another
 * version of the plugin — or a hand-edited localStorage entry — may have written.
 */
function readLeadWidth(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
	return value >= MIN_TIMELINE_LEAD_PX && value <= MAX_TIMELINE_LEAD_PX ? value : undefined;
}

function readShelfFields(record: Record<string, unknown>, entry: StoredEntry): void {
	if (typeof record.shelfExpanded === 'boolean' && record.shelfExpanded) entry.shelfExpanded = true;
	const sort = readEnum(record.shelfSort, SHELF_SORT_VALUES);
	if (sort !== undefined) entry.shelfSort = sort;
	const types = readPaths(record.shelfHiddenTypes);
	if (types.length > 0) entry.shelfHiddenTypes = types;
	// `readPaths` reads a list of strings defensively; that these are names rather than
	// paths changes nothing it checks.
	const lanes = readPaths(record.collapsedLanes);
	if (lanes.length > 0) entry.collapsedLanes = lanes;
	// Same reader again: a column key is a string in a list, whatever the string names.
	const folded = readPaths(record.collapsedColumns);
	if (folded.length > 0) entry.collapsedColumns = folded;
	const opened = readPaths(record.expandedColumns);
	if (opened.length > 0) entry.expandedColumns = opened;
}

function entryHasContent(entry: StoredEntry): boolean {
	return (
		entry.collapsed.length > 0 ||
		entry.expanded.length > 0 ||
		entry.mode !== undefined ||
		entry.axis !== undefined ||
		entry.zoom !== undefined ||
		entry.density !== undefined ||
		entry.leadWidth !== undefined ||
		entry.focus !== undefined ||
		entry.clickFolds !== undefined ||
		entry.shelfExpanded !== undefined ||
		entry.shelfSort !== undefined ||
		entry.shelfHiddenTypes !== undefined ||
		entry.collapsedLanes !== undefined ||
		entry.collapsedColumns !== undefined ||
		entry.expandedColumns !== undefined
	);
}

function readEntry(value: unknown): StoredEntry | null {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	// An entry with no base cannot be pruned when its file goes, so it would linger
	// forever; dropping it costs one view's collapse state and is self-healing.
	const base = record.base;
	if (typeof base !== 'string' || base.length === 0) return null;
	const entry: StoredEntry = { base, collapsed: readPaths(record.collapsed), expanded: readPaths(record.expanded) };
	const mode = readEnum(record.mode, PROJECTION_MODES);
	if (mode !== undefined) entry.mode = mode;
	const axis = readEnum(record.axis, AXIS_VALUES);
	if (axis !== undefined) entry.axis = axis;
	const zoom = readEnum(record.zoom, ZOOM_VALUES);
	if (zoom !== undefined) entry.zoom = zoom;
	const density = readEnum(record.density, DENSITY_VALUES);
	if (density !== undefined) entry.density = density;
	const leadWidth = readLeadWidth(record.leadWidth);
	if (leadWidth !== undefined) entry.leadWidth = leadWidth;
	// Not an enum: the vocabulary this is matched against lives in `domain/settings.ts`
	// and a name outside it already reads as no focus, so the only check here is shape.
	if (typeof record.focus === 'string' && record.focus.length > 0) entry.focus = record.focus;
	// `=== true` rather than a truthy read: anything else a hand-edited entry holds is
	// not a boolean this wrote, and the default is the value it falls back to anyway.
	if (record.clickFolds === true) entry.clickFolds = true;
	readShelfFields(record, entry);
	return entryHasContent(entry) ? entry : null;
}

function readPaths(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((path): path is string => typeof path === 'string' && path.length > 0);
}
