import { BasesAllOptions, BasesPropertyId, BasesViewConfig, parsePropertyId } from 'obsidian';

/**
 * Resolved, ready-to-use configuration for one Product Backlog view.
 * All property keys are plain frontmatter keys (without the `note.` prefix).
 */
export interface BacklogSettings {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	levels: string[];
	autoType: boolean;
	showChips: boolean;
	showCounts: boolean;
	newItemFolder: string;
	/** Level name to use as the top of the tree, or '' to show the full hierarchy. */
	focusLevel: string;
	/** Frontmatter key holding the workflow state, or '' when progress tracking is off. */
	stateKey: string;
	/** State values (case-insensitive) that count as done. */
	doneValues: string[];
}

export const DEFAULT_LEVELS = ['Epic', 'Feature', 'PBI', 'Task'];
export const DEFAULT_DONE_VALUES = ['Done', 'Closed', 'Completed', 'Removed'];

export function defaultSettings(): BacklogSettings {
	return {
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		levels: [...DEFAULT_LEVELS],
		autoType: true,
		showChips: true,
		showCounts: true,
		newItemFolder: '',
		focusLevel: '',
		stateKey: '',
		doneValues: [...DEFAULT_DONE_VALUES],
	};
}

/** Name of the hierarchy level at the given depth; depths below the deepest level reuse it. */
export function levelForDepth(levels: string[], depth: number): string {
	return levels[Math.min(Math.max(depth, 0), levels.length - 1)];
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

const notePropsOnly = (prop: BasesPropertyId) => prop.startsWith('note.');

/** Options shown in the Bases toolbar "view options" menu. */
export function getViewOptions(config?: BasesViewConfig): BasesAllOptions[] {
	let levels = [...DEFAULT_LEVELS];
	if (config) {
		try {
			levels = resolveSettings(config).levels;
		} catch {
			// fall back to the default level names
		}
	}
	const focusOptions: Record<string, string> = { '': 'All levels' };
	for (const level of levels) focusOptions[level] = level;

	return [
		{
			type: 'group',
			displayName: 'Hierarchy',
			items: [
				{
					type: 'property',
					key: 'parentProperty',
					displayName: 'Parent property',
					default: 'note.parent',
					placeholder: 'parent',
					filter: notePropsOnly,
				},
				{
					type: 'property',
					key: 'orderProperty',
					displayName: 'Order property',
					default: 'note.order',
					placeholder: 'order',
					filter: notePropsOnly,
				},
				{
					type: 'property',
					key: 'typeProperty',
					displayName: 'Item type property',
					default: 'note.type',
					placeholder: 'type',
					filter: notePropsOnly,
				},
				{
					type: 'text',
					key: 'levels',
					displayName: 'Levels (top → bottom)',
					default: DEFAULT_LEVELS.join(', '),
					placeholder: DEFAULT_LEVELS.join(', '),
				},
				{
					type: 'dropdown',
					key: 'focusLevel',
					displayName: 'Focus level',
					default: '',
					options: focusOptions,
				},
				{
					type: 'toggle',
					key: 'autoAssignType',
					displayName: 'Assign item type when moving',
					default: true,
				},
			],
		},
		{
			type: 'group',
			displayName: 'Progress',
			items: [
				{
					type: 'property',
					key: 'stateProperty',
					displayName: 'State property',
					placeholder: 'status',
					filter: notePropsOnly,
				},
				{
					type: 'text',
					key: 'doneValues',
					displayName: 'States that count as done',
					default: DEFAULT_DONE_VALUES.join(', '),
					placeholder: DEFAULT_DONE_VALUES.join(', '),
				},
			],
		},
		{
			type: 'group',
			displayName: 'New items',
			items: [
				{
					type: 'folder',
					key: 'newItemFolder',
					displayName: 'Folder for new items',
					placeholder: 'Same folder as existing items',
				},
			],
		},
		{
			type: 'group',
			displayName: 'Display',
			items: [
				{
					type: 'toggle',
					key: 'showProperties',
					displayName: 'Show visible properties on rows',
					default: true,
				},
				{
					type: 'toggle',
					key: 'showCounts',
					displayName: 'Show descendant counts',
					default: true,
				},
			],
		},
	];
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
	const str = (key: string): string => {
		const v = config.get(key);
		return typeof v === 'string' ? v : '';
	};
	const bool = (key: string, def: boolean): boolean => {
		const v = config.get(key);
		return typeof v === 'boolean' ? v : def;
	};
	const list = (key: string): string[] =>
		str(key)
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

	const levels = list('levels');
	const doneValues = list('doneValues');

	return {
		parentKey: propKey('parentProperty', fallback.parentKey),
		orderKey: propKey('orderProperty', fallback.orderKey),
		typeKey: propKey('typeProperty', fallback.typeKey),
		levels: levels.length > 0 ? levels : fallback.levels,
		autoType: bool('autoAssignType', fallback.autoType),
		showChips: bool('showProperties', fallback.showChips),
		showCounts: bool('showCounts', fallback.showCounts),
		newItemFolder: str('newItemFolder').trim().replace(/^\/+|\/+$/g, ''),
		focusLevel: str('focusLevel').trim(),
		stateKey: propKey('stateProperty', fallback.stateKey),
		doneValues: doneValues.length > 0 ? doneValues : fallback.doneValues,
	};
}
