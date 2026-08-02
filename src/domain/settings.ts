import { BasesViewConfig, normalizePath, parsePropertyId } from 'obsidian';

/**
 * Resolved, ready-to-use configuration for one Product Backlog view.
 * All property keys are plain frontmatter keys (without the `note.` prefix).
 */
export interface BacklogSettings {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	/**
	 * Only treat notes that belong to the work-item hierarchy as items: a supported
	 * type (one of `levels`) or a parent. When off, every note the base returns is an item.
	 */
	hierarchyOnly: boolean;
	/**
	 * Load the ancestors the Base's own filter left out, so a matching item keeps
	 * its place in the tree instead of rendering as a flat orphan.
	 */
	showOutsideParents: boolean;
	/** Parent notes are inferred from folder notes when no explicit parent link is set. */
	folderHierarchy: boolean;
	autoType: boolean;
	showChips: boolean;
	showCounts: boolean;
	/**
	 * Where new items go when their type has no folder of its own — the one general
	 * answer to "where does this plugin put things".
	 */
	homeFolder: string;
	/**
	 * Folder per item type, keyed by LOWERCASED type name. Each is its own option in
	 * the view options rather than a line of a mapping, so it is picked rather than
	 * typed. Takes precedence over `homeFolder`, but not over folder mode's "beside
	 * the parent" rule.
	 */
	typeFolders: Record<string, string>;
	/** Level name to use as the top of the tree, or '' to show the full hierarchy. */
	focusLevel: string;
	/** Frontmatter key holding the workflow state, or '' when progress tracking is off. */
	stateKey: string;
	/**
	 * Frontmatter key holding the note's tags, or '' to render them as plain text.
	 * Editing is offered only while this property is one of the visible ones.
	 */
	tagsKey: string;
	/** Width in pixels of one property column. */
	propColumnWidth: number;
	/** State values (case-insensitive) that count as done. */
	doneValues: string[];
	/**
	 * Frontmatter key stamped with the date work started, or '' when start stamping
	 * is off. History is the one thing a board cannot reconstruct later, so this
	 * captures it as the transition happens — and captures nothing until it is named.
	 */
	startedDateKey: string;
	/** Frontmatter key stamped with the date work finished, or '' when off. */
	finishedDateKey: string;
	/**
	 * State values (case-insensitive) that count as work started. Empty means NOTHING
	 * does: every part of stamping is opt-in, and a workflow's first column is a
	 * backlog as often as it is a start — guessing would date work nobody began.
	 */
	startedStates: string[];
	/** Workflow states offered by the state menus, in order; [] falls back to observed values. */
	states: string[];
	/** Render items whose whole subtree is done; when off they hide (the quick filter overrides). */
	showCompleted: boolean;
	/** Frontmatter key holding the roadmap horizon, or '' when no bucket axis is configured. */
	horizonKey: string;
	/**
	 * Declared horizon values, in roadmap order. Ships prefilled with Now, Next,
	 * Later — a default vocabulary, not a fixed one — and clearing it unconfigures
	 * the bucket axis: a horizon axis with no values is a board without stages.
	 */
	horizonValues: string[];
	/** Frontmatter key holding the planned start date, or '' when unset. */
	startKey: string;
	/** Frontmatter key holding the planned target date, or '' when unset. */
	targetKey: string;
}

/**
 * The work-item vocabulary, fixed. This plugin is opinionated about it on purpose: a
 * configurable ladder means every level rule has to hold for any list a user can type,
 * and the reward was a rename. What it cost was real — collision rules between levels
 * and extra types, defaults that could not be stated for a name nobody chose, and a
 * schema that had to be generated per view.
 *
 * `LEVELS` is the ladder, top to bottom; `EXTRA_TYPES` sit beside it (see `itemTypes.ts`).
 */
export const LEVELS = ['Epic', 'Feature', 'PBI', 'Task'];
export const EXTRA_TYPES = ['Issue', 'Bug'];
/** Every declared type, ladder first — the whole vocabulary in one list. */
export const ALL_TYPES = [...LEVELS, ...EXTRA_TYPES];
/**
 * The default mapping, kept as the text the option shows so the shipped default and the
 * parsed one cannot drift: `defaultSettings` parses this very string.
 */
export const DEFAULT_HOME_FOLDER = 'docs';
/**
 * Where each of the DEFAULT types is filed, under the home folder. Only the shipped
 * vocabulary has an opinion — a level someone renames has no default and falls through
 * to the home folder, which is the honest answer for a name this plugin never chose.
 */
const DEFAULT_TYPE_SUBFOLDERS: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, {
	epic: 'requirements',
	feature: 'requirements',
	pbi: 'requirements',
	task: 'tasks',
	issue: 'issues',
	bug: 'bugs',
});

/**
 * Look a user-supplied type name up in a table keyed by lowercased type name.
 *
 * Type names are user data, so `table[name]` is not safe: `constructor`, `toString`,
 * `valueOf` and `__proto__` all find something inherited from `Object`, and every one of
 * those hits is truthy — so a guard like `if (!found)` passes and a function ends up
 * being used as a folder path or a CSS class. This has now been shipped three times, on
 * three different tables, so it is a function rather than a rule to remember: reach for
 * this instead of a bare index whenever the key came from the user.
 *
 * It lives here rather than in `itemTypes.ts`, which is where it reads more naturally,
 * because that module imports this one and the dependency cannot run both ways.
 */
export function byTypeName<T>(table: Record<string, T>, typeName: string | null): T | undefined {
	if (typeName === null) return undefined;
	const key = typeName.toLowerCase();
	return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * The persisted option key for one type's folder. Shared by the schema that declares
 * these options and the resolver that reads them back, because a key spelled twice is
 * a key that can differ — and these are user data in the `.base` file.
 */
export function typeFolderKey(typeName: string): string {
	return `typeFolder.${typeName.toLowerCase()}`;
}

/**
 * The shipped folder for a type, under the given home folder, or '' for a type this
 * plugin did not name. Derived from the home folder rather than fixed, so relocating a
 * backlog stays ONE setting even though each type has its own picker: the options are
 * generated per view, so the default in each box follows the home folder above it.
 */
export function defaultTypeFolder(typeName: string, homeFolder = DEFAULT_HOME_FOLDER): string {
	const sub = byTypeName(DEFAULT_TYPE_SUBFOLDERS, typeName);
	if (!sub) return '';
	return homeFolder ? `${homeFolder}/${sub}` : sub;
}

/** Folders for every given type, keyed lowercase, skipping the ones with none. */
function typeFoldersFor(types: string[], read: (type: string) => string): Record<string, string> {
	// Null-prototype: type names are user data, so a type called `constructor` must be
	// a plain key rather than a collision with something inherited off Object.
	const folders: Record<string, string> = Object.create(null) as Record<string, string>;
	for (const type of types) {
		const folder = read(type);
		if (folder) folders[type.toLowerCase()] = folder;
	}
	return folders;
}
export const DEFAULT_DONE_VALUES = ['Done', 'Closed', 'Completed', 'Removed'];
/**
 * The shipped horizon vocabulary — the canonical Now-Next-Later triple. A default
 * the user edits freely, never a fixed list: the values are the user's own
 * placements, exactly as the workflow states are.
 */
export const DEFAULT_HORIZON_VALUES = ['Now', 'Next', 'Later'];
/** Property columns are fixed-width so values line up across rows; this is that width. */
export const DEFAULT_PROP_COLUMN_WIDTH = 132;
export const MIN_PROP_COLUMN_WIDTH = 80;
export const MAX_PROP_COLUMN_WIDTH = 280;

export function defaultSettings(): BacklogSettings {
	return {
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		hierarchyOnly: true,
		showOutsideParents: true,
		folderHierarchy: false,
		autoType: false,
		showChips: true,
		showCounts: true,
		homeFolder: DEFAULT_HOME_FOLDER,
		typeFolders: typeFoldersFor(ALL_TYPES, (t) => defaultTypeFolder(t)),
		focusLevel: '',
		stateKey: '',
		tagsKey: 'tags',
		propColumnWidth: DEFAULT_PROP_COLUMN_WIDTH,
		doneValues: [...DEFAULT_DONE_VALUES],
		startedDateKey: '',
		finishedDateKey: '',
		startedStates: [],
		states: [],
		showCompleted: true,
		horizonKey: '',
		horizonValues: [...DEFAULT_HORIZON_VALUES],
		startKey: '',
		targetKey: '',
	};
}

/**
 * The roadmap's three write targets, named by FIELD rather than by key. Every layer
 * that has to ask "which property does this placement live in" asks here, so the
 * mapping from a field to a configured key is stated once: the planner, the writer
 * and the backfill would otherwise each spell out the same three-way switch.
 */
export type AxisField = 'horizon' | 'start' | 'target';
export const AXIS_FIELDS: AxisField[] = ['horizon', 'start', 'target'];

/** The frontmatter key one axis field is stored under; '' when it is unconfigured. */
export function axisKeyFor(settings: BacklogSettings, field: AxisField): string {
	if (field === 'horizon') return settings.horizonKey;
	return field === 'start' ? settings.startKey : settings.targetKey;
}

/**
 * The states offered by the state menus: the configured list when set, else the
 * values observed in the backlog — with a done state appended so marking an item
 * done is always one click away. Menus append the item's own unlisted value on
 * top of this, so the current state can always render checked.
 */
export function stateMenuValues(settings: BacklogSettings, observedStates: string[]): string[] {
	if (settings.states.length > 0) return settings.states;
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	if (observedStates.some((v) => done.has(v.toLowerCase()))) return observedStates;
	return [...observedStates, settings.doneValues[0]];
}

/**
 * Whether a state value counts as done, by the same case-insensitive match the model
 * and the board's columns already use. Takes a VALUE rather than an item because the
 * stamps ask it of a state being written, which no item holds yet.
 */
export function isDoneValue(settings: BacklogSettings, state: string | null): boolean {
	return state !== null && settings.doneValues.some((v) => v.toLowerCase() === state.toLowerCase());
}

/**
 * Whether a state value counts as work started. Nothing does until the states are
 * named: a first column is a backlog as often as it is a start, and a date is worse
 * than no date when it says work began that nobody began.
 */
export function isStartedValue(settings: BacklogSettings, state: string | null): boolean {
	return state !== null && settings.startedStates.some((v) => v.toLowerCase() === state.toLowerCase());
}

/**
 * The horizons Set horizon offers: the declared vocabulary, plus every value the
 * RESULTS actually carry that it does not name — which is exactly the bucket list
 * the roadmap draws, in the order it draws it (declared first, then each minted
 * bucket in the order it was first seen). Union rather than the state menu's
 * either/or, because the two questions differ: an undeclared state is a state the
 * board shows in a stray column, while an undeclared horizon is a bucket a drag can
 * already drop into — so a row menu offering only the declared list could not reach
 * a target the roadmap can. Menus append the item's own unlisted value on top of
 * this, so the current horizon always renders checked.
 */
export function horizonMenuValues(settings: BacklogSettings, observedHorizons: string[]): string[] {
	const declared = new Set(settings.horizonValues.map((v) => v.toLowerCase()));
	return [...settings.horizonValues, ...observedHorizons.filter((v) => !declared.has(v.toLowerCase()))];
}

/**
 * Configuration mistakes that would corrupt writes (e.g. parent and order stored
 * under the same frontmatter key). The view surfaces these instead of guessing.
 */
export function configProblems(settings: BacklogSettings): string[] {
	const problems: string[] = [];
	const keys = new Map<string, string[]>();
	const add = (label: string, key: string) => {
		if (!key) return;
		const users = keys.get(key) ?? [];
		users.push(label);
		keys.set(key, users);
	};
	add('parent', settings.parentKey);
	add('order', settings.orderKey);
	add('type', settings.typeKey);
	add('state', settings.stateKey);
	// A stamp must never overwrite a key the plugin already owns, so the two join the
	// gate rather than yielding quietly: a date written over someone's parent link is
	// not a thing to recover from by noticing later.
	add('started date', settings.startedDateKey);
	add('finished date', settings.finishedDateKey);
	// The roadmap's axis keys are write targets like the four above, and the rules
	// they must never collide into are wider by one: start and target sharing one
	// key cannot store a span, and a horizon sharing either is two semantics on one
	// field — one rule over the whole set of configured write targets.
	add('horizon', settings.horizonKey);
	add('start', settings.startKey);
	add('target', settings.targetKey);
	// `tagsKey` cannot collide with the four core properties by the time anything
	// reads it — `resolveSettings` turns such a tags key off, because reporting it
	// would block every write in a view that was working before the option existed.
	// It does NOT yield to the newer options — the axis keys, or the stamps — which
	// have no working views to protect, so pointing one of those at the tags key is
	// a fresh mistake, and the honest answer is the collision report every other
	// pair gets.
	add('tags', settings.tagsKey);
	for (const [key, users] of keys) {
		if (users.length > 1) {
			problems.push(`The ${users.join(' and ')} properties share the key "${key}".`);
		}
	}
	return problems;
}

/** The readers `resolveFolders` borrows, so it can be its own function without repeating them. */
interface ConfigReaders {
	str: (key: string) => string;
	clearable: <T>(key: string, def: T, parse: () => T) => T;
}

/**
 * A user-typed folder path as the VAULT spells it: trimmed, stripped of the separators
 * either side, and normalized. One answer, because a folder setting is read by three
 * kinds of code that must agree — `storage/` creates the folder and puts files in it,
 * the creation prompt tells the user where a note will land, and the generated README
 * tells an editor outside Obsidian where to file one. A hand-edited or Windows-shaped
 * `work\backlog` normalized only at the write would have the document name a folder
 * this plugin never writes to.
 *
 * Both separators are stripped before the guard, since `normalizePath` answers `/` — the
 * vault root spelled as a folder that does not exist — for anything that normalizes away.
 */
export function vaultFolder(value: string): string {
	const trimmed = value.trim().replace(/^[\\/]+|[\\/]+$/g, '');
	return trimmed ? normalizePath(trimmed) : '';
}

/**
 * Where new items are filed, resolved together because the two answers depend on each
 * other: every type folder defaults to a subfolder of the home folder, so moving the
 * home folder moves each one that has not been picked by hand.
 */
function resolveFolders(
	read: ConfigReaders,
	types: string[],
	fallback: BacklogSettings,
): Pick<BacklogSettings, 'homeFolder' | 'typeFolders'> {
	const { str, clearable } = read;
	const homeFolder = clearable('homeFolder', fallback.homeFolder, () => vaultFolder(str('homeFolder')));
	return {
		homeFolder,
		// One option per type, so a folder is picked rather than typed into a mapping,
		// and each default sits under the resolved home folder — the value in the box is
		// the value that applies, and moving the home folder moves every untouched one.
		typeFolders: typeFoldersFor(types, (type) =>
			clearable(typeFolderKey(type), defaultTypeFolder(type, homeFolder), () =>
				vaultFolder(str(typeFolderKey(type))),
			),
		),
	};
}

/** Read the persisted view config into a BacklogSettings, applying defaults for anything unset. */
export function resolveSettings(config: BasesViewConfig): BacklogSettings {
	const fallback = defaultSettings();

	const propKey = (key: string, def: string): string => {
		try {
			const pid = config.getAsPropertyId(key);
			if (pid) {
				const parsed = parsePropertyId(pid);
				if (parsed.type === 'note' && parsed.name) return parsed.name;
			}
		} catch {
			// fall through to default
		}
		return def;
	};
	/**
	 * Like `propKey`, but only for an option whose default is a real key: clearing
	 * it in the view options has to mean "off", and only an option that was never
	 * touched falls back. Without the distinction the tags property could never be
	 * turned off — `getAsPropertyId` reports cleared and unset the same way.
	 */
	const clearablePropKey = (key: string, def: string): string => {
		// Set to something: honor it, and treat anything unusable (cleared, or a
		// property this view cannot write, like file.tags) as off.
		return config.get(key) === undefined ? def : propKey(key, '');
	};
	/**
	 * An option whose default is a REAL value has to tell "never set" from "cleared",
	 * or it can never be turned off — the same distinction `clearablePropKey` draws for
	 * property ids, and now shared by the home folder, the extra types and the type
	 * folders rather than spelled out three times.
	 */
	const clearable = <T>(key: string, def: T, parse: () => T): T => (config.get(key) === undefined ? def : parse());
	const str = (key: string): string => {
		const v = config.get(key);
		return typeof v === 'string' ? v : '';
	};
	const bool = (key: string, def: boolean): boolean => {
		const v = config.get(key);
		return typeof v === 'boolean' ? v : def;
	};
	// A slider stores a number, but a hand-edited .base file can hold anything;
	// clamp so a stray value cannot collapse the columns to nothing.
	const width = (key: string, def: number): number => {
		const v = config.get(key);
		const n = typeof v === 'number' ? v : Number.parseFloat(typeof v === 'string' ? v : '');
		if (!Number.isFinite(n)) return def;
		return Math.min(Math.max(Math.round(n), MIN_PROP_COLUMN_WIDTH), MAX_PROP_COLUMN_WIDTH);
	};
	const list = (key: string): string[] =>
		str(key)
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	// Duplicate states would render as duplicate menu entries — drop them silently.
	const dedupe = (values: string[]): string[] => {
		const seen = new Set<string>();
		return values.filter((v) => {
			const key = v.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};

	const doneValues = list('doneValues');
	const folders = resolveFolders({ str, clearable }, ALL_TYPES, fallback);
	const tagsKey = (): string => {
		const key = clearablePropKey('tagsProperty', fallback.tagsKey);
		const taken = [
			propKey('parentProperty', fallback.parentKey),
			propKey('orderProperty', fallback.orderKey),
			propKey('typeProperty', fallback.typeKey),
			propKey('stateProperty', fallback.stateKey),
		];
		return taken.includes(key) ? '' : key;
	};

	return {
		parentKey: propKey('parentProperty', fallback.parentKey),
		orderKey: propKey('orderProperty', fallback.orderKey),
		typeKey: propKey('typeProperty', fallback.typeKey),
		hierarchyOnly: bool('hierarchyOnly', fallback.hierarchyOnly),
		showOutsideParents: bool('showOutsideParents', fallback.showOutsideParents),
		folderHierarchy: bool('inferFolderHierarchy', fallback.folderHierarchy),
		autoType: bool('autoAssignType', fallback.autoType),
		showChips: bool('showProperties', fallback.showChips),
		showCounts: bool('showCounts', fallback.showCounts),
		...folders,
		focusLevel: str('focusLevel').trim(),
		stateKey: propKey('stateProperty', fallback.stateKey),
		tagsKey: tagsKey(),
		propColumnWidth: width('propertyColumnWidth', fallback.propColumnWidth),
		doneValues: doneValues.length > 0 ? doneValues : fallback.doneValues,
		startedDateKey: propKey('startedDateProperty', fallback.startedDateKey),
		finishedDateKey: propKey('finishedDateProperty', fallback.finishedDateKey),
		startedStates: dedupe(list('startedStates')),
		states: dedupe(list('stateValues')),
		showCompleted: bool('showCompleted', fallback.showCompleted),
		horizonKey: propKey('horizonProperty', fallback.horizonKey),
		// A real default that must stay clearable: an emptied list means "no bucket
		// axis", and only an option never touched falls back to Now, Next, Later.
		horizonValues: clearable('horizonValues', fallback.horizonValues, () => dedupe(list('horizonValues'))),
		startKey: propKey('startProperty', fallback.startKey),
		targetKey: propKey('targetProperty', fallback.targetKey),
	};
}
