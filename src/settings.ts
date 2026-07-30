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
}

export const DEFAULT_LEVELS = ['Epic', 'Feature', 'PBI', 'Task'];

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
	};
}

/** Name of the hierarchy level at the given depth; depths below the deepest level reuse it. */
export function levelForDepth(levels: string[], depth: number): string {
	return levels[Math.min(Math.max(depth, 0), levels.length - 1)];
}

const notePropsOnly = (prop: BasesPropertyId) => prop.startsWith('note.');

/** Options shown in the Bases toolbar "view options" menu. */
export function getViewOptions(): BasesAllOptions[] {
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
					type: 'toggle',
					key: 'autoAssignType',
					displayName: 'Assign item type when moving',
					default: true,
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
		} catch (e) {
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

	const levels = str('levels')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	return {
		parentKey: propKey('parentProperty', fallback.parentKey),
		orderKey: propKey('orderProperty', fallback.orderKey),
		typeKey: propKey('typeProperty', fallback.typeKey),
		levels: levels.length > 0 ? levels : fallback.levels,
		autoType: bool('autoAssignType', fallback.autoType),
		showChips: bool('showProperties', fallback.showChips),
		showCounts: bool('showCounts', fallback.showCounts),
		newItemFolder: str('newItemFolder').trim().replace(/^\/+|\/+$/g, ''),
	};
}
