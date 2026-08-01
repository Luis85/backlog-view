import { BasesAllOptions, BasesPropertyId } from 'obsidian';
import {
	DEFAULT_DONE_VALUES,
	DEFAULT_EXTRA_TYPES,
	DEFAULT_LEVELS,
	DEFAULT_TYPE_FOLDERS,
	DEFAULT_PROP_COLUMN_WIDTH,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
} from './settings';

/**
 * What Bases shows in the view-options menu: pure declaration, no logic. Split from
 * `settings.ts` because it changes for a different reason — a new option to offer,
 * rather than a new rule for reading one — and because it is the half most often
 * edited when adding a feature.
 *
 * Every `key` here is PERSISTED in the user's `.base` file and read back by
 * `resolveSettings`. Renaming one silently resets that option for everyone.
 */

const notePropsOnly = (prop: BasesPropertyId) => prop.startsWith('note.');

/**
 * Options shown in the Bases toolbar "view options" menu. The focus level is
 * deliberately absent: it lives in the view's own toolbar, next to the New button
 * whose level it changes.
 */
export function getViewOptions(): BasesAllOptions[] {
	return [hierarchyGroup(), progressGroup(), newItemsGroup(), displayGroup()];
}

function hierarchyGroup(): BasesAllOptions {
	return {
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
				type: 'text',
				key: 'extraTypes',
				displayName: 'Extra types',
				default: DEFAULT_EXTRA_TYPES.join(', '),
				placeholder: DEFAULT_EXTRA_TYPES.join(', '),
			},
			{
				type: 'toggle',
				key: 'hierarchyOnly',
				displayName: 'Ignore notes outside the hierarchy',
				default: true,
			},
			{
				type: 'toggle',
				key: 'showOutsideParents',
				displayName: 'Show parents outside the filter',
				default: true,
			},
			{
				type: 'toggle',
				key: 'inferFolderHierarchy',
				displayName: 'Infer hierarchy from folder notes',
				default: false,
			},
			{
				type: 'toggle',
				key: 'autoAssignType',
				displayName: 'Assign item type when moving',
				default: true,
			},
		],
	};
}

function progressGroup(): BasesAllOptions {
	return {
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
				key: 'stateValues',
				displayName: 'Workflow states (in order)',
				default: '',
				placeholder: 'New, Active, Done',
			},
			{
				type: 'text',
				key: 'doneValues',
				displayName: 'States that count as done',
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
			{
				type: 'toggle',
				key: 'showCompleted',
				displayName: 'Show completed items',
				default: true,
			},
		],
	};
}

function newItemsGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'New items',
		items: [
			{
				type: 'folder',
				key: 'newItemFolder',
				displayName: 'Folder for new items',
				placeholder: 'Same folder as existing items',
			},
			{
				type: 'text',
				key: 'typeFolders',
				displayName: 'Folders by type',
				default: DEFAULT_TYPE_FOLDERS,
				placeholder: DEFAULT_TYPE_FOLDERS,
			},
		],
	};
}

function displayGroup(): BasesAllOptions {
	return {
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
				type: 'slider',
				key: 'propertyColumnWidth',
				displayName: 'Property column width',
				default: DEFAULT_PROP_COLUMN_WIDTH,
				min: MIN_PROP_COLUMN_WIDTH,
				max: MAX_PROP_COLUMN_WIDTH,
				step: 4,
			},
			{
				type: 'property',
				key: 'tagsProperty',
				displayName: 'Tags property',
				default: 'note.tags',
				placeholder: 'tags',
				filter: notePropsOnly,
			},
			{
				type: 'toggle',
				key: 'showCounts',
				displayName: 'Show descendant counts',
				default: true,
			},
		],
	};
}
