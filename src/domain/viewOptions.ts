import { BasesAllOptions, BasesOptions, BasesPropertyId, BasesViewConfig } from 'obsidian';
import {
	ALL_TYPES,
	DEFAULT_DONE_VALUES,
	DEFAULT_HOME_FOLDER,
	DEFAULT_HORIZON_VALUES,
	DEFAULT_PROP_COLUMN_WIDTH,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
	defaultTypeFolder,
	resolveSettings,
	typeFolderKey,
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
export function getViewOptions(config?: BasesViewConfig): BasesAllOptions[] {
	// The type list is fixed, but each type's DEFAULT folder sits under this view's home
	// folder — so the callback still reads the config. Declaring the shipped `docs/…`
	// here regardless would make every picker in a `Roadmap` base advertise a folder the
	// creation flow does not use, and restoring that shown default would move the type.
	const homeFolder = config ? resolveSettings(config).homeFolder : DEFAULT_HOME_FOLDER;
	return [hierarchyGroup(), progressGroup(), roadmapGroup(), newItemsGroup(homeFolder), displayGroup()];
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
				// Must match `defaultSettings().autoType`: the toggle showing on while
				// moves changed nothing would be the UI lying about the behaviour.
				default: false,
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

/**
 * The roadmap's axis, declared rather than detected: a horizon property with its
 * ordered values makes the bucket axis, a start and a target property make the
 * timeline, and nothing is ever picked by name-matching. The placeholders suggest
 * the ecosystem's own vocabulary (the Tasks plugin's `start` and `due`) without
 * assuming it.
 */
function roadmapGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Roadmap',
		items: [
			{
				type: 'property',
				key: 'horizonProperty',
				displayName: 'Horizon property',
				placeholder: 'horizon',
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: 'horizonValues',
				displayName: 'Horizons (in order)',
				default: DEFAULT_HORIZON_VALUES.join(', '),
				placeholder: DEFAULT_HORIZON_VALUES.join(', '),
			},
			{
				type: 'property',
				key: 'startProperty',
				displayName: 'Start date property',
				placeholder: 'start',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'targetProperty',
				displayName: 'Target date property',
				placeholder: 'due',
				filter: notePropsOnly,
			},
		],
	};
}

function newItemsGroup(homeFolder: string): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'New items',
		items: [
			{
				type: 'folder',
				key: 'homeFolder',
				displayName: 'Home folder',
				default: DEFAULT_HOME_FOLDER,
				placeholder: 'Same folder as existing items',
			},
			// A picker per type, in ladder order then the extras. One input each is the
			// difference between choosing a folder and spelling a mapping correctly.
			...ALL_TYPES.map(
				(type): BasesOptions => ({
					type: 'folder',
					key: typeFolderKey(type),
					displayName: `Folder for ${type} items`,
					// Tracks the home folder above: the value shown is the value that applies.
					default: defaultTypeFolder(type, homeFolder),
					placeholder: homeFolder || 'Home folder',
				}),
			),
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
