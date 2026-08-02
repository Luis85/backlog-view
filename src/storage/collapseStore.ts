import { App, FileView } from 'obsidian';

/**
 * Persistence for the state that is purely the user's working position: which
 * rows are open and which are shut, which projection — tree, board or roadmap —
 * the view is showing, and which roadmap axis it shows when both are configured.
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
 * Backstop on how many paths a single view may remember. A real backlog is a few
 * hundred rows, so this is far above normal use and exists only so a pathological
 * vault cannot grow the entry without bound. Collapsed paths are kept first: an
 * expanded entry only suppresses the default, while a collapsed one is visible state.
 */
const MAX_PATHS = 4000;

/** The value the `mode` field holds while the view is a board. */
export const BOARD_MODE = 'board';
/** The value the `mode` field holds while the view is a roadmap. */
export const ROADMAP_MODE = 'roadmap';
/**
 * The values the `axis` field may hold — which roadmap axis this saved view shows
 * when both are configured. Mirrors `RoadmapAxis` in `domain/roadmap.ts`; spelled
 * here as strings because stored state is read defensively, not trusted as a type.
 */
const AXIS_VALUES = ['horizons', 'dates'];

/** One view's working position: the rows it has settled, and its projection. */
export interface CollapseSnapshot {
	collapsed: Set<string>;
	expanded: Set<string>;
	/** `BOARD_MODE` or `ROADMAP_MODE`; null or absent means the tree. */
	mode?: string | null;
	/** The retained roadmap-axis pick; null or absent means the user never picked. */
	axis?: string | null;
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

export function loadCollapseState(app: App, id: ViewIdentity): CollapseSnapshot {
	const entry = readMap(app)[mapKey(id)];
	return {
		collapsed: new Set(entry?.collapsed ?? []),
		expanded: new Set(entry?.expanded ?? []),
		mode: entry?.mode ?? null,
		axis: entry?.axis ?? null,
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
	const mode = snapshot.mode ?? null;
	const axis = snapshot.axis ?? null;
	// A view at its defaults — nothing settled, the tree, no pick — needs no entry.
	if (collapsed.length === 0 && expanded.length === 0 && mode === null && axis === null) delete map[key];
	else {
		map[key] = { base: id.base, collapsed, expanded };
		if (mode !== null) map[key].mode = mode;
		if (axis !== null) map[key].axis = axis;
	}
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

function readEntry(value: unknown): StoredEntry | null {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	// An entry with no base cannot be pruned when its file goes, so it would linger
	// forever; dropping it costs one view's collapse state and is self-healing.
	const base = record.base;
	if (typeof base !== 'string' || base.length === 0) return null;
	const entry: StoredEntry = { base, collapsed: readPaths(record.collapsed), expanded: readPaths(record.expanded) };
	// The modes this plugin has ever written; anything else is not trusted, and an
	// unrecognized value simply means the tree — the stored choice is user state,
	// dropped rather than guessed at.
	if (record.mode === BOARD_MODE || record.mode === ROADMAP_MODE) entry.mode = record.mode;
	if (typeof record.axis === 'string' && AXIS_VALUES.includes(record.axis)) entry.axis = record.axis;
	return entry.collapsed.length > 0 || entry.expanded.length > 0 || entry.mode !== undefined || entry.axis !== undefined
		? entry
		: null;
}

function readPaths(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((path): path is string => typeof path === 'string' && path.length > 0);
}
