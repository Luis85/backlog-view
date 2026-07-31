import { App, FileView } from 'obsidian';

/**
 * Persistence for the one piece of state that is purely the user's view of the
 * tree: which rows are open and which are shut.
 *
 * This deliberately does NOT go in the `.base` file — a path per collapsed row is
 * exactly the growth that file should not take, and it is shared state, while this
 * is one person's working position. It goes to vault-scoped localStorage through
 * Obsidian's own `loadLocalStorage`/`saveLocalStorage`, under a single key holding
 * one entry per base view.
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

/** The rows a view has settled: shut, and explicitly opened. */
export interface CollapseSnapshot {
	collapsed: Set<string>;
	expanded: Set<string>;
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
		if (view instanceof FileView && view.file && view.containerEl.contains(el)) {
			owner.push(view.file.path);
		}
	});
	return owner.length > 0 ? { base: owner[0], view: viewName } : null;
}

export function loadCollapseState(app: App, id: ViewIdentity): CollapseSnapshot {
	const entry = readMap(app)[mapKey(id)];
	return {
		collapsed: new Set(entry?.collapsed ?? []),
		expanded: new Set(entry?.expanded ?? []),
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
	if (collapsed.length === 0 && expanded.length === 0) delete map[key];
	else map[key] = { base: id.base, collapsed, expanded };
	pruneMissingBases(app, map, key);
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
	// Without a base an entry cannot be pruned, so it is not worth keeping — that
	// also drops anything written before the base was recorded alongside the paths.
	const base = record.base;
	if (typeof base !== 'string' || base.length === 0) return null;
	const entry = { base, collapsed: readPaths(record.collapsed), expanded: readPaths(record.expanded) };
	return entry.collapsed.length > 0 || entry.expanded.length > 0 ? entry : null;
}

function readPaths(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((path): path is string => typeof path === 'string' && path.length > 0);
}
