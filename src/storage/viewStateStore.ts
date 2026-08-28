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
 * everything KEYED by something the VAULT can lose, so it is what the prune walks and
 * `prefs` is everything else, which the prune never touches.
 *
 * The RENAME is the one asymmetry, and it is a real exception rather than a wording
 * slip: two `prefs` values HOLD a note path instead of being keyed by one, so a walk has
 * to reach them. {@link renamePathPrefs} is that walk, over exactly the two
 * {@link PATH_PREFS} names — see {@link ViewPrefs}.
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
 * The shape of an entry this version writes, stamped on every one of them.
 *
 * It exists because the shape has already changed once, and the change cost every reader
 * their working position: nothing on the entry said which shape it was, so the only way
 * to tell 0.8's from 0.9's was the KEY, and moving the key is a reset. A stamp makes the
 * next change a migration instead — read the old shape, write the new one — and costs one
 * field to have available.
 *
 * The two directions are deliberately not symmetrical. A stamp this version does not know
 * is a NEWER plugin's entry, and is dropped rather than read defensively: guessing at a
 * shape never seen is how a value lands somewhere it means something else. An ABSENT
 * stamp is this shape, because every entry in the wild is unstamped — the stamp arrives
 * after the shape it describes, so reading absence as "not mine" would reset the readers
 * it exists to protect.
 */
const SCHEMA = 1;

/**
 * Backstop on how many fold keys a single view may remember, across every one of its lists.
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
 * The value the `mode` field holds while the view is a board scoped to one iteration.
 * WHICH iteration is `ViewPrefs.scope` beside it, and the two cannot contradict each
 * other because choosing `Product` clears the scope and the mode together — so no route
 * in needs a guard against a mode without a scope.
 */
export const ITERATION_MODE = 'iteration';
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
const PROJECTION_MODES = [BOARD_MODE, ROADMAP_MODE, DELIVERABLES_MODE, CATALOG_MODE, ITERATION_MODE] as const;
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
 * The values the `estimationSort` field may hold: `${column}:${direction}` for the
 * prioritized list's clickable headers — column ∈
 * title|total|coverage|confidence|effort|indicator|currency, direction ∈ asc|desc. There is no
 * domain type to mirror the way `AXIS_VALUES` mirrors `RoadmapAxis` above: sorting is
 * that OTHER view's own question, answered nowhere under `domain/`, so the fourteen
 * combinations are spelled out directly — the same "stored state is not trusted as a
 * type" rule applied to a vocabulary this module is the only owner of.
 */
const ESTIMATION_SORT_VALUES = [
	'title:asc',
	'title:desc',
	'total:asc',
	'total:desc',
	'coverage:asc',
	'coverage:desc',
	'confidence:asc',
	'confidence:desc',
	'effort:asc',
	'effort:desc',
	'indicator:asc',
	'indicator:desc',
	'currency:asc',
	'currency:desc',
];
/**
 * Bounds on the `leadWidth` field, in pixels. Below the minimum the badge and its
 * padding alone would fill the column, leaving no room for a title at all; above the
 * maximum a fat-fingered drag would push most of the grid off screen. Unlike every
 * other stored pick this one is a NUMBER rather than an enum, so there is no fixed
 * vocabulary to check it against — see {@link inRange}.
 */
export const MIN_TIMELINE_LEAD_PX = 160;
export const MAX_TIMELINE_LEAD_PX = 480;
/**
 * The tree's property columns are fixed-width so values line up across rows; this is the
 * width one draws at until its reader resizes it, and the bounds a stored pick is read
 * back against. Here rather than in `domain/settings.ts`, where they lived while the
 * width was a view option: the bounds on a stored pick belong beside the field that
 * stores it, exactly as the lead column's do above.
 */
export const DEFAULT_PROP_COLUMN_WIDTH = 132;
export const MIN_PROP_COLUMN_WIDTH = 80;
export const MAX_PROP_COLUMN_WIDTH = 280;
/**
 * Bounds on the `shelfHeight` field, in pixels — the CAP an open shelf grows to before it
 * scrolls, dragged by the grip at its own foot. Below the minimum the band would be its
 * header and a sliver of the first card, which is what a collapse already says better;
 * above the maximum a fat-fingered drag would leave the columns or the axis the shelf
 * feeds with nothing but their own floor.
 *
 * A ceiling in PIXELS cannot bound the band on its own, and deliberately does not try to:
 * the pane is what a stored 720 has to answer to on a phone, and `styles/shelf.css` holds
 * this pick under a share of the pane with a CSS `min()` rather than a measurement here.
 * The stored number is untouched by that, exactly as `leadWidth`'s is — the clamp is what
 * is DRAWN, and the pick returns in full the moment there is room for it.
 */
export const MIN_SHELF_HEIGHT_PX = 72;
export const MAX_SHELF_HEIGHT_PX = 720;

/** Everything the reader has folded shut — rows by path, and bands and columns by name. */
export interface ViewFolds {
	collapsed: string[];
	expanded: string[];
	/**
	 * Resource bands folded shut, by name. A fold like the others, and NOT a path — which
	 * is why the prune walks the two lists above and never this one.
	 */
	lanes: string[];
	/**
	 * Board columns and horizon buckets folded shut, by KEY — a scope and the column's own
	 * value, minted by `columnKey` in `view/viewState.ts`. Not a path either, so the prune
	 * skips it the way it skips the lanes.
	 */
	collapsedColumns: string[];
	/**
	 * Columns explicitly opened; settled is this and {@link ViewFolds.collapsedColumns}
	 * together. A pair rather than one list, because unlike a band a column HAS a default
	 * worth suppressing — a done column of finished work starts shut — so the two together
	 * say what has been ruled on, exactly as `collapsed`/`expanded` do for rows.
	 */
	expandedColumns: string[];
}

/**
 * Everything else: keyed by nothing the vault owns — **except two values that are note
 * paths, `scope` and `release`**. Both are still a pref rather than a fold, because the
 * other half of what `folds` means does not hold for either: a path whose note the vault
 * has lost is RETAINED, never pruned, so restoring the note restores the reader's choice.
 *
 * Both carry the other obligation a note path brings, and carry it the same way: each is
 * walked on a rename, matching the path or its `oldPath/` prefix, so a folder anybody
 * tidies strands neither the scope nor the pick inside it.
 *
 * Each is walked TWICE, over two different copies, and both are needed.
 * {@link renamePathPrefs} walks the STORED entries — every one of them, whatever view is
 * loaded — and is wired to `vault.on('rename')` at the plugin in `main.ts`.
 * `renameScoped` (`view/viewState.ts`) walks the loaded backlog view's IN-MEMORY copy,
 * which its flush writes back wholesale and which would otherwise put a stale path
 * straight back. See {@link ViewPrefs.scope} and {@link ViewPrefs.release}.
 */
/**
 * The preferences whose VALUE is a note path — the two exceptions the comment above
 * names, spelled once so {@link renamePathPrefs} and the interface cannot disagree about
 * which they are. A third path-valued pref is one entry here and nothing else.
 */
const PATH_PREFS = ['scope', 'release'] as const;

export interface ViewPrefs {
	mode?: string;
	axis?: string;
	zoom?: string;
	density?: string;
	leadWidth?: number;
	focus?: string;
	clickFolds?: boolean;
	/**
	 * Whether a horizon bucket lays its cards out one per row instead of the responsive
	 * grid. Stored as the OFF state for the grid, because the grid is the default and a
	 * default stores nothing — the same absence rule `density` keeps for comfortable rows.
	 */
	bucketList?: boolean;
	shelfExpanded?: boolean;
	shelfSort?: string;
	/**
	 * Whether the shelf draws one compact row per item instead of its card grid. The OFF
	 * state for the cards, `bucketList`'s own rule above and for its reason: the grid is
	 * the default and a default is written as nothing at all. `ShelfLayout` in
	 * `domain/shelf.ts` is the vocabulary above this; the inversion between the two is
	 * spelled once, in `view/viewState.ts`.
	 */
	shelfList?: boolean;
	/**
	 * The cap an open shelf grows to before it scrolls, in pixels, or absent for the share
	 * of the pane the stylesheet gives it until someone drags the grip. A NUMBER like
	 * `leadWidth` rather than an enum, and read back through the same {@link inRange}.
	 *
	 * ONE height for the shelf, not one per projection: the roadmap's shelf and the
	 * iteration board's are the same band drawn by the same component, only ever one of
	 * them is on screen, and a reader who sizes the band on one projection is stating how
	 * much of the pane they want it to take — not something about horizons.
	 */
	shelfHeight?: number;
	shelfHiddenTypes?: string[];
	/**
	 * The tree's resized property columns, in pixels, keyed by the Bases property id the
	 * column draws. A key is present only once its column has been dragged away from
	 * {@link DEFAULT_PROP_COLUMN_WIDTH}; absent or empty means every column is at it.
	 *
	 * A pref rather than a fold, by the rule this whole shape states: a key here is a
	 * property id, never a note path, so neither the prune nor the rename may reach it —
	 * a column whose property leaves the Base keeps its entry, and a property hidden for
	 * an afternoon comes back the width its reader left it.
	 */
	colWidths?: Record<string, number>;
	/**
	 * The `Iteration` note a board is scoped to, as a vault path — one of now two values
	 * in this bucket the VAULT owns ({@link ViewPrefs.release} is the other), and the
	 * reason the comment above this interface carries an exception.
	 *
	 * Two obligations follow from being a note path, and half of them is not an option.
	 * The rename walk must reach it, matching the path **or its `oldPath/` prefix**, so a
	 * folder anybody tidies does not strand every scope inside it — {@link renamePathPrefs}
	 * here and `renameScoped` in `view/viewState.ts` are those walks, over the stored
	 * entries and over the loaded view's own copy, and {@link ViewPrefs.release} goes
	 * through both beside this one. And the prune must NOT: a stale path is retained rather than
	 * rewritten, since the note may come back — a deletion undone, a filter widened, a
	 * vault synced late — and spending the reader's choice on a condition that is often
	 * temporary is worse than an empty board they can leave. That half holds for both by
	 * construction: `prefs` is never pruned by path at all, only `folds` is.
	 */
	scope?: string;
	/**
	 * The release whose screen is open, as a note path — absent when the index is showing.
	 * A working position, per device and per saved view, never a `.base` setting
	 * ([[Settings scoped to their view]]).
	 *
	 * Both of {@link ViewPrefs.scope}'s obligations, for its reasons and one of its own.
	 * Both rename walks carry this too, matching the path or its `oldPath/` prefix; without
	 * that, a renamed release note reads as a DELETED one, since either way the path names
	 * no release and the view falls back to the index without a word. The one that answers
	 * for THIS pref in the ordinary case is {@link renamePathPrefs}: the release view holds
	 * no controller, so a walk that ran only on the loaded backlog view would leave a
	 * reader with the release view alone on screen exactly where this sentence started.
	 */
	release?: string;
	/**
	 * Whether the release view's scope screen is hiding finished subtrees. The ON state of
	 * a toggle that starts OFF, so a default writes nothing — `bucketList`'s own rule.
	 */
	releaseHideDone?: boolean;
	/**
	 * Which board the `Boards` position opens when no iteration scope is set — today the
	 * one legal value is {@link DELIVERABLES_MODE}, and absence means the product board.
	 * A WORD, never a path, so unlike `scope` beside it neither the prune nor the rename
	 * walk may touch it. The two clear each other on the way in (`ViewStateController`),
	 * so the redirect always answers from the newest pick and they cannot contradict.
	 */
	board?: string;
	/**
	 * The prioritized list's active sort — the OTHER Bases view's own pick, kept in
	 * this same store because it is the identical question (working position, per
	 * saved view, per device) asked by a different screen. `${column}:${direction}`,
	 * validated against the twelve combinations in {@link PREF_READERS}'s row for it.
	 * Absent means Base order, unsorted — the default, and what a pick back to it
	 * stores: nothing.
	 */
	estimationSort?: string;
}

export interface ViewStateSnapshot {
	folds: ViewFolds;
	prefs: ViewPrefs;
}

interface StoredEntry {
	/** The shape this entry was written in — see {@link SCHEMA}. */
	v: number;
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
 * {@link inRange} applied per ENTRY of a map, and that granularity is the whole of what
 * makes it its own reader: a bad entry is dropped ALONE rather than taking the map with
 * it, because one hand-edited number should not reset every other column. Every other
 * reader here refuses the value whole, which is right for a single pick and wrong for a
 * collection of independent ones.
 *
 * `Object.create(null)`, like the settings' own name tables: a stored key spelled
 * `constructor` or `__proto__` must be a plain entry rather than a collision with
 * something inherited off `Object` — and `__proto__` on an object literal would rewrite
 * the prototype instead of storing a width.
 */
function eachInRange(min: number, max: number): Reader<Record<string, number>> {
	const width = inRange(min, max);
	return (value) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
		const widths: Record<string, number> = Object.create(null) as Record<string, number>;
		let any = false;
		for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
			if (key.length === 0 || width(entry) === undefined) continue;
			widths[key] = entry as number;
			any = true;
		}
		return any ? widths : undefined;
	};
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
	bucketList: onlyTrue,
	shelfExpanded: onlyTrue,
	shelfSort: oneOf(SHELF_SORT_VALUES),
	shelfList: onlyTrue,
	shelfHeight: inRange(MIN_SHELF_HEIGHT_PX, MAX_SHELF_HEIGHT_PX),
	shelfHiddenTypes: nonEmptyTexts,
	colWidths: eachInRange(MIN_PROP_COLUMN_WIDTH, MAX_PROP_COLUMN_WIDTH),
	// Any name, like `focus`: a path is checked by RESOLVING it against the vault, which
	// this layer cannot do and which the view redoes on every render anyway. What a reader
	// refuses here is a value of the wrong shape, not one naming a note that has moved.
	scope: anyName,
	// `anyName`, for `scope`'s own stated reason: a path is checked by RESOLVING it against
	// the vault, which this layer cannot do. A remembered release that has moved or been
	// deleted returns the index, which the view decides on render — not a failure.
	release: anyName,
	releaseHideDone: onlyTrue,
	board: oneOf([DELIVERABLES_MODE]),
	estimationSort: oneOf(ESTIMATION_SORT_VALUES),
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

/**
 * The same, for the folds — one {@link MAX_FOLDS} budget spent across the lists, in the
 * order they are read here. That order is the rule: what is left when the budget runs out
 * is dropped, so the collapsed rows are taken first.
 */
function readFolds(source: unknown): ViewFolds {
	const record = objectOf(source);
	let budget = MAX_FOLDS;
	const take = (value: unknown): string[] => {
		const list = texts(value).slice(0, budget);
		budget -= list.length;
		return list;
	};
	return {
		collapsed: take(record.collapsed),
		expanded: take(record.expanded),
		lanes: take(record.lanes),
		collapsedColumns: take(record.collapsedColumns),
		expandedColumns: take(record.expandedColumns),
	};
}

/**
 * A view at its defaults needs no entry. Asked by the read side and the write side with
 * one function, so a shape one writes and the other refuses cannot arise.
 */
function hasContent(entry: StoredEntry): boolean {
	const { collapsed, expanded, lanes, collapsedColumns, expandedColumns } = entry.folds;
	const folded = [collapsed, expanded, lanes, collapsedColumns, expandedColumns].reduce(
		(total, list) => total + list.length,
		0,
	);
	return folded > 0 || Object.keys(entry.prefs).length > 0;
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
	const entry: StoredEntry = {
		v: SCHEMA,
		base: id.base,
		folds: readFolds(state.folds),
		prefs: readPrefs(state.prefs),
	};
	if (hasContent(entry)) map[key] = entry;
	else delete map[key];
	// The base comes from the IDENTITY, never from `map[key]`: a view at its defaults has
	// just had its entry deleted, and the guard still has to know what to ask about.
	pruneMissingBases(app, map, key, id.base);
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

/**
 * Follow a NOTE that was renamed or moved, through every entry's path-valued preferences
 * ({@link PATH_PREFS}) — the board's iteration `scope` and the release view's `release`
 * pick. {@link rekeyBase} is the same event asked about the base half of the key; this is
 * the same event asked about what an entry HOLDS.
 *
 * Wired to `vault.on('rename')` in `main.ts`, and at the plugin rather than on a view for
 * the reason `rekeyBase` is: an entry belongs to a saved view, not to whichever view
 * happens to be loaded, so a walk that runs only while one view is on screen leaves every
 * other entry stranded. For `release` that failure is not merely a lost position — a
 * stale path resolves to no release, so a renamed note drops the reader to the index
 * indistinguishably from a deleted one.
 *
 * `ViewState.renameScoped` (`view/viewState.ts`) walks the same two values and is NOT
 * made redundant by this: that controller holds `prefs` in MEMORY and saves them
 * wholesale, so a loaded backlog view whose in-memory copy still named the old path would
 * write it back over this one. Two walks, one rule, each over a different copy.
 *
 * RETAINS, never prunes: only a path the vault reports as MOVED is rewritten, and a path
 * whose note is merely gone is left exactly as the reader left it, since the note may come
 * back. Takes any rename, file or folder — `movedPath` matches the path itself or its
 * `oldPath/` prefix — and does nothing when no entry names it, which also makes it
 * idempotent.
 */
export function renamePathPrefs(app: App, oldPath: string, newPath: string): void {
	const map = readMap(app);
	let moved = false;
	for (const entry of Object.values(map)) {
		for (const key of PATH_PREFS) {
			const current = entry.prefs[key];
			const next = current === undefined ? null : movedPath(current, oldPath, newPath);
			if (next === null) continue;
			entry.prefs[key] = next;
			moved = true;
		}
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

/**
 * Drop entries for bases that no longer exist, never the one being written.
 *
 * The whole prune rests on one question asked of the vault index, and it deletes OTHER
 * views' state on the answer — which is why it first asks that question about a file it
 * knows is there: `writing` is the base of the view doing the saving, and this code is
 * running because that view is on screen. An index that cannot find THAT is not evidence
 * about anybody else's base, so a save while it is unavailable would forget every other
 * base in the vault. That is the one loss here that reopening a view cannot undo — the
 * entries are gone, not merely unread.
 *
 * Same shape of rule as `collapseNewParents` keeps for the model: never read "I cannot
 * see it" as "it is not there" without first checking that the reader can see anything.
 */
function pruneMissingBases(app: App, map: StoredMap, keep: string, writing: string): void {
	if (app.vault.getAbstractFileByPath(writing) === null) return;
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
	// A stamp this version does not know belongs to a newer one — see {@link SCHEMA} for
	// why absence is the current shape and anything else is nobody's business here.
	if (record.v !== undefined && record.v !== SCHEMA) return null;
	const base = record.base;
	if (typeof base !== 'string' || base.length === 0) return null;
	const entry: StoredEntry = { v: SCHEMA, base, folds: readFolds(record.folds), prefs: readPrefs(record.prefs) };
	return hasContent(entry) ? entry : null;
}
