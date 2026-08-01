import { BasesViewConfig, parsePropertyId } from 'obsidian';

/**
 * Resolved, ready-to-use configuration for one Product Backlog view.
 * All property keys are plain frontmatter keys (without the `note.` prefix).
 */
export interface BacklogSettings {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	levels: string[];
	/**
	 * Declared types that are not rungs on the ladder (Issue, Bug): they hold the
	 * deepest level as children wherever they hang, and are never re-typed by position.
	 * See `itemTypes.ts` for why the ladder cannot express them.
	 */
	extraTypes: string[];
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
	/**
	 * True when this base actually names a folder — any of the per-type options, the
	 * home folder, or the `newItemFolder` that preceded it. False means every folder
	 * above is this plugin's GUESS, which matters because a guess must not outrank
	 * evidence: see `folderFor` in `interactions/create.ts`.
	 */
	foldersConfigured: boolean;
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
	/** Workflow states offered by the state menus, in order; [] falls back to observed values. */
	states: string[];
	/** Render items whose whole subtree is done; when off they hide (the quick filter overrides). */
	showCompleted: boolean;
}

export const DEFAULT_LEVELS = ['Epic', 'Feature', 'PBI', 'Task'];
export const DEFAULT_EXTRA_TYPES = ['Issue', 'Bug'];
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
	const sub = DEFAULT_TYPE_SUBFOLDERS[typeName.toLowerCase()];
	// A non-empty STRING or nothing — the same test `folderForType` makes, for the same
	// reason and now at the table too: a type named `constructor` reads a function off a
	// plain object, and interpolating it would produce `docs/function Object() {…}` as a
	// folder default that then beats the home folder.
	if (typeof sub !== 'string' || !sub) return '';
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
/** Property columns are fixed-width so values line up across rows; this is that width. */
export const DEFAULT_PROP_COLUMN_WIDTH = 132;
export const MIN_PROP_COLUMN_WIDTH = 80;
export const MAX_PROP_COLUMN_WIDTH = 280;

export function defaultSettings(): BacklogSettings {
	return {
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		levels: [...DEFAULT_LEVELS],
		extraTypes: [...DEFAULT_EXTRA_TYPES],
		hierarchyOnly: true,
		showOutsideParents: true,
		folderHierarchy: false,
		autoType: false,
		showChips: true,
		showCounts: true,
		homeFolder: DEFAULT_HOME_FOLDER,
		foldersConfigured: false,
		typeFolders: typeFoldersFor([...DEFAULT_LEVELS, ...DEFAULT_EXTRA_TYPES], (t) => defaultTypeFolder(t)),
		focusLevel: '',
		stateKey: '',
		tagsKey: 'tags',
		propColumnWidth: DEFAULT_PROP_COLUMN_WIDTH,
		doneValues: [...DEFAULT_DONE_VALUES],
		states: [],
		showCompleted: true,
	};
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
	// `tagsKey` is deliberately absent: unlike the four above it cannot collide by
	// the time anything reads it, because `resolveSettings` turns a colliding tags
	// key off. Reporting it here would instead block every write in a view that was
	// working before this option existed — a base whose state property happens to be
	// `tags` would upgrade into a read-only view.
	for (const [key, users] of keys) {
		if (users.length > 1) {
			problems.push(`The ${users.join(' and ')} properties share the key "${key}".`);
		}
	}
	const seen = new Set<string>();
	for (const level of settings.levels) {
		const name = level.toLowerCase();
		if (seen.has(name)) {
			problems.push(`The level "${level}" is listed more than once.`);
			break;
		}
		seen.add(name);
	}
	return problems;
}

/** The readers `resolveFolders` borrows, so it can be its own function without repeating them. */
interface ConfigReaders {
	str: (key: string) => string;
	clearable: <T>(key: string, def: T, parse: () => T) => T;
	config: BasesViewConfig;
}

/** A user-typed folder path, trimmed and stripped of surrounding slashes. */
function folderPath(value: string): string {
	return value.trim().replace(/^\/+|\/+$/g, '');
}

/**
 * Everything about where new items are filed, resolved together because the three answers
 * depend on each other: each type folder defaults under the home folder, the home folder
 * falls back to the `newItemFolder` that preceded it, and whether ANY of them was named
 * decides if they are choices or this plugin's guesses.
 */
function resolveFolders(
	read: ConfigReaders,
	types: string[],
	fallback: BacklogSettings,
): Pick<BacklogSettings, 'homeFolder' | 'foldersConfigured' | 'typeFolders'> {
	const { str, clearable, config } = read;
	// A base configured before the home folder existed carries the old `newItemFolder`,
	// and it means exactly what the home folder means: reading it keeps such a view
	// filing where it already filed.
	const legacyFolder = folderPath(str('newItemFolder'));
	const homeFolder = clearable('homeFolder', legacyFolder || fallback.homeFolder, () =>
		folderPath(str('homeFolder')),
	);
	/**
	 * Has this base named a folder at all? A base predating these options has named none
	 * — and it is not a fresh install, it is a backlog already living somewhere. Answering
	 * "no" is what lets creation prefer where the items already are over a default this
	 * plugin picked. Reading `newItemFolder` alone missed most of them, since it was
	 * optional and most such bases left it unset.
	 */
	const foldersConfigured =
		config.get('homeFolder') !== undefined ||
		config.get('newItemFolder') !== undefined ||
		types.some((type) => config.get(typeFolderKey(type)) !== undefined);
	return {
		homeFolder,
		foldersConfigured,
		// One option per type, so a folder is picked rather than typed into a mapping,
		// and each default sits under the resolved home folder — the value in the box is
		// the value that applies, and moving the home folder moves every untouched one.
		typeFolders: typeFoldersFor(types, (type) =>
			clearable(typeFolderKey(type), defaultTypeFolder(type, homeFolder), () =>
				folderPath(str(typeFolderKey(type))),
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

	const levels = list('levels');
	const resolvedLevels = levels.length > 0 ? levels : fallback.levels;
	const doneValues = list('doneValues');
	/**
	 * Like the tags key, this one defaults to something real, so "cleared" has to differ
	 * from "never set" or the extra types could not be turned off. A name that is already
	 * a level yields rather than being reported: the level wins wherever both are read, so
	 * the declaration is merely inert, and gating every write over an inert duplicate
	 * would turn a working view read-only.
	 */
	const extraTypes = (): string[] => {
		const taken = new Set(resolvedLevels.map((l) => l.toLowerCase()));
		const declared = clearable('extraTypes', fallback.extraTypes, () => dedupe(list('extraTypes')));
		return declared.filter((t) => !taken.has(t.toLowerCase()));
	};
	/**
	 * The tags column is the only one whose property is also *editable*, so it gives
	 * way to every other role: a key already spoken for by parent, order, type or
	 * state is that feature's, and `chipProps` skips such a property anyway, so tag
	 * editing would be unreachable. Resolving it to "off" here keeps that one fact
	 * in one place instead of a collision report that would gate unrelated writes.
	 */
	const resolvedExtras = extraTypes();
	const folders = resolveFolders({ str, clearable, config }, [...resolvedLevels, ...resolvedExtras], fallback);
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
		levels: resolvedLevels,
		extraTypes: resolvedExtras,
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
		states: dedupe(list('stateValues')),
		showCompleted: bool('showCompleted', fallback.showCompleted),
	};
}
