import { App } from 'obsidian';
import { movedPath, ViewIdentity, viewNameOf, viewStateKey } from './viewIdentity';

/**
 * Everything one saved view remembers between sessions, in vault-scoped localStorage:
 * which rows are folded, and every pick that is this device's rather than the base's.
 *
 * Never the `.base` file (ADR 0011). Base settings are saved on the view; working
 * position and per-device preferences are saved here, under one key holding one entry
 * per base view.
 *
 * The entry has two buckets and the split is behavioural, not cosmetic: `folds` is
 * everything keyed by something the VAULT can lose, so it is what the prune and the
 * rename walk; `prefs` is everything else and neither ever touches it.
 */

/** One vault-scoped entry holds every Product Backlog view's state. */
const STORE_KEY = 'product-backlog:view-state';
/**
 * The key 0.8 and earlier wrote. Not read and not migrated — the decision is in ADR 0011's
 * consequences and ADR 0016 is what permits it before 1.0. Cleared on the first write so
 * no vault carries a dead entry forever.
 */
const LEGACY_KEY = 'product-backlog:collapse';

/**
 * Backstop on how many fold keys a single view may remember, across all three lists.
 * A real backlog is a few hundred rows, so this is far above normal use and exists only
 * so a pathological vault cannot grow the entry without bound. Collapsed keys are kept
 * first: an expanded entry only suppresses the default, while a collapsed one is visible
 * state, and a lane is one per resource rather than one per note.
 *
 * A fold key is a note path under one scope, and a parent settles under every scope it
 * has (the tree's, the dated axis's and a card's own — see `view/viewState.ts`), so
 * this is up to three times the note count it bounds. It has grown with each scope added
 * for exactly that reason: leaving it at a lower multiple would quietly halve the
 * headroom in NOTES this has always promised, and the first thing lost at saturation is
 * the expanded keys, which read back as rows the user opened and found shut again.
 */
const MAX_FOLDS = 12000;

/** The value the `mode` field holds while the view is a board. */
export const BOARD_MODE = 'board';
/** The value the `mode` field holds while the view is a roadmap. */
export const ROADMAP_MODE = 'roadmap';
/** The value the `mode` field holds while the view is the Deliverables board. */
export const DELIVERABLES_MODE = 'deliverables';
/** The value the `mode` field holds while the view is the test catalog. */
export const CATALOG_MODE = 'catalog';
/**
 * Every value the `mode` field may hold — the one list, read by {@link PREF_READERS}
 * below and published as the TYPE beneath it.
 *
 * It runs storage → view and never the reverse, because `storage/` may not import
 * `view/` and lint fails the build on it; the constants already live here, so this is the
 * direction that works. What it buys is that the round trip stops being three independent
 * statements. `PROJECTION_MODE` (`view/viewState.ts`) is a `Record<Projection, …>`
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
 * `view/viewState.ts` types its `Projection → constant` map to this, which makes the
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
/** The values the `shelfSort` field may hold. Mirrors `ShelfSort` in `domain/shelf.ts`. */
const SHELF_SORT_VALUES = ['tree', 'title', 'modified'];
/**
 * Bounds on the `leadWidth` field, in pixels. Below the minimum the badge and its
 * padding alone would fill the column, leaving no room for a title at all; above the
 * maximum a fat-fingered drag would push most of the grid off screen. Unlike every
 * other stored pick this one is a NUMBER rather than an enum, so there is no fixed
 * vocabulary to check it against — see {@link inRange}.
 */
export const MIN_TIMELINE_LEAD_PX = 160;
export const MAX_TIMELINE_LEAD_PX = 480;

/** Everything keyed by something the vault can lose: note paths, and a lane's own name. */
export interface ViewFolds {
	collapsed: string[];
	expanded: string[];
	/**
	 * Resource bands folded shut, by name. A fold like the others, and NOT a path — which
	 * is why the prune walks the two lists above and never this one.
	 */
	lanes: string[];
}

/** Everything else: one value each, never pruned, never renamed. */
export interface ViewPrefs {
	mode?: string;
	axis?: string;
	zoom?: string;
	density?: string;
	leadWidth?: number;
	focus?: string;
	clickFolds?: boolean;
	shelfExpanded?: boolean;
	shelfSort?: string;
	shelfHiddenTypes?: string[];
}

export interface ViewStateSnapshot {
	folds: ViewFolds;
	prefs: ViewPrefs;
}

interface StoredEntry {
	/**
	 * The base this entry belongs to, carried rather than parsed back out of the key.
	 * A view name may contain anything a user can type — "Sprint #3" is an ordinary
	 * name — so splitting the key on a separator would misread the base path and let
	 * another view's save prune a live entry.
	 */
	base: string;
	folds: ViewFolds;
	prefs: ViewPrefs;
}

type StoredMap = Record<string, StoredEntry>;

/** A stored value this plugin recognises, or `undefined` for one it does not. */
type Reader<T> = (value: unknown) => T | undefined;

function oneOf(allowed: readonly string[]): Reader<string> {
	return (value) => (typeof value === 'string' && allowed.includes(value) ? value : undefined);
}

/**
 * Only a stored `true`. Anything else a hand-edited entry holds is not a boolean this
 * wrote, and the default is what it falls back to anyway.
 */
function onlyTrue(value: unknown): true | undefined {
	return value === true ? true : undefined;
}

/**
 * A NUMBER rather than an enum, so there is no vocabulary to check it against. Outside
 * the range it reads back as absent rather than clamped: a clamp would still trust a
 * corrupt-but-plausible number into the layout.
 */
function inRange(min: number, max: number): Reader<number> {
	return (value) =>
		typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

/** Not an enum: a focus or a type name outside the configured vocabulary already reads as none. */
function anyName(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function texts(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((text): text is string => typeof text === 'string' && text.length > 0);
}

function nonEmptyTexts(value: unknown): string[] | undefined {
	const list = texts(value);
	return list.length > 0 ? list : undefined;
}

/**
 * The one statement of what a stored preference may be. It is run on the way IN, over an
 * entry another version of this plugin may have written, and on the way OUT, over the
 * snapshot the view hands down — so a value the store would refuse to read can never be
 * written in the first place. Two directions, one rule; a new preference is one row here
 * and one field on {@link ViewPrefs}.
 *
 * Exported for the test that asks whether the round-trip fixture names every preference.
 * The mapped type is the other half of that guarantee and needs no test: a field added to
 * {@link ViewPrefs} with no row here fails the build.
 */
export const PREF_READERS: { [K in keyof ViewPrefs]-?: Reader<NonNullable<ViewPrefs[K]>> } = {
	mode: oneOf(PROJECTION_MODES),
	axis: oneOf(AXIS_VALUES),
	zoom: oneOf(ZOOM_VALUES),
	density: oneOf(DENSITY_VALUES),
	leadWidth: inRange(MIN_TIMELINE_LEAD_PX, MAX_TIMELINE_LEAD_PX),
	focus: anyName,
	clickFolds: onlyTrue,
	shelfExpanded: onlyTrue,
	shelfSort: oneOf(SHELF_SORT_VALUES),
	shelfHiddenTypes: nonEmptyTexts,
};

/** A record, or an empty one for anything that is not a plain object. */
function objectOf(value: unknown): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

/**
 * Absence is a value: a reader answering `undefined` means the key is not written at all,
 * which is what makes clearing a focus remove the field rather than store a name meaning
 * "none".
 */
function readPrefs(source: unknown): ViewPrefs {
	const record = objectOf(source);
	const prefs: Record<string, unknown> = {};
	for (const [key, read] of Object.entries(PREF_READERS)) {
		const value = (read as Reader<unknown>)(record[key]);
		if (value !== undefined) prefs[key] = value;
	}
	return prefs;
}

/** The same, for the folds — one {@link MAX_FOLDS} budget spent across the three lists. */
function readFolds(source: unknown): ViewFolds {
	const record = objectOf(source);
	const collapsed = texts(record.collapsed).slice(0, MAX_FOLDS);
	const expanded = texts(record.expanded).slice(0, MAX_FOLDS - collapsed.length);
	const lanes = texts(record.lanes).slice(0, MAX_FOLDS - collapsed.length - expanded.length);
	return { collapsed, expanded, lanes };
}

/**
 * A view at its defaults needs no entry. Asked by the read side and the write side with
 * one function, so a shape one writes and the other refuses cannot arise.
 */
function hasContent(entry: StoredEntry): boolean {
	const { collapsed, expanded, lanes } = entry.folds;
	return collapsed.length + expanded.length + lanes.length > 0 || Object.keys(entry.prefs).length > 0;
}

export function loadViewState(app: App, id: ViewIdentity): ViewStateSnapshot {
	const entry = readMap(app)[viewStateKey(id)];
	return { folds: readFolds(entry?.folds), prefs: readPrefs(entry?.prefs) };
}

/**
 * Write this view's entry, leaving every other view's alone. Entries whose base file is
 * gone go with it — the only chance to notice, since nothing enumerates the bases that
 * ever wrote here.
 */
export function saveViewState(app: App, id: ViewIdentity, state: ViewStateSnapshot): void {
	const map = readMap(app);
	const key = viewStateKey(id);
	const entry: StoredEntry = { base: id.base, folds: readFolds(state.folds), prefs: readPrefs(state.prefs) };
	if (hasContent(entry)) map[key] = entry;
	else delete map[key];
	pruneMissingBases(app, map, key);
	writeMap(app, map);
}

/** Forget one view's entry — used when its state has just been written elsewhere. */
export function dropViewState(app: App, id: ViewIdentity): void {
	const map = readMap(app);
	const key = viewStateKey(id);
	if (!(key in map)) return;
	delete map[key];
	writeMap(app, map);
}

/**
 * Follow a `.base` that was renamed or moved — directly, or by moving a folder above it.
 * The path is half the key, so without this an ordinary bit of vault tidying would orphan
 * every entry for that base: never found again under the new path, and then deleted by
 * the next save, because a base that no longer exists is what `pruneMissingBases` looks
 * for.
 *
 * Takes any rename, file or folder, and does nothing when no entry sits under the old
 * path. That also makes it idempotent.
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
		map[viewStateKey({ base, view })] = { ...entry, base };
		moved = true;
	}
	if (moved) writeMap(app, map);
}

function writeMap(app: App, map: StoredMap): void {
	try {
		app.saveLocalStorage(STORE_KEY, map);
		// Not a migration: the 0.8 entry is never read. Cleared here so the bytes go with
		// the version that stopped understanding them.
		if (app.loadLocalStorage(LEGACY_KEY) !== null) app.saveLocalStorage(LEGACY_KEY, null);
	} catch (e) {
		// A full or unavailable localStorage must not take the view down with it: this
		// state is a convenience, and every projection renders fine without it.
		console.error('Product Backlog: could not save view state', e);
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
 * Read the stored map defensively. It is user-writable state on disk that older — or
 * newer — versions of this plugin may have written, so every level is checked and
 * anything unrecognizable is dropped rather than trusted.
 *
 * Dropped, never carried: an OLDER plugin version writing over a newer one's entry loses
 * the newer values. The nested shape makes it look like it might merge.
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
	const record = objectOf(value);
	// An entry with no base cannot be pruned when its file goes, so it would linger
	// forever; dropping it costs one view's state and is self-healing.
	const base = record.base;
	if (typeof base !== 'string' || base.length === 0) return null;
	const entry: StoredEntry = { base, folds: readFolds(record.folds), prefs: readPrefs(record.prefs) };
	return hasContent(entry) ? entry : null;
}
