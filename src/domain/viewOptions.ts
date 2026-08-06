import { BasesAllOptions, BasesOptions, BasesPropertyId, BasesViewConfig } from 'obsidian';
import {
	ALL_TYPES,
	BacklogSettings,
	columnPolicyKey,
	DEFAULT_DONE_VALUES,
	DEFAULT_HOME_FOLDER,
	DEFAULT_HORIZON_VALUES,
	DEFAULT_PROP_COLUMN_WIDTH,
	defaultSettings,
	defaultTypeFolder,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
	OptionalField,
	optionalProperty,
	resolveSettings,
	typeFolderKey,
	wipLimitKey,
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
 * The picker for one of the optional properties. Its persisted key and the key it
 * suggests both come from `OPTIONAL_PROPERTIES`, so the placeholder a user reads
 * here is the very key the backfill adopts and writes — the two cannot drift into
 * suggesting one property and setting up another.
 */
function optionalPropertyOption(field: OptionalField, displayName: string): BasesOptions {
	const property = optionalProperty(field);
	return {
		type: 'property',
		key: property.option,
		displayName,
		placeholder: property.suggested,
		filter: notePropsOnly,
	};
}

/**
 * Options shown in the Bases toolbar "view options" menu. The focus level is
 * deliberately absent, and now doubly so: it lives in the view's own toolbar, next to
 * the New button whose level it changes, and it is not a base setting at all — working
 * position, stored beside the collapse state.
 */
export function getViewOptions(config?: BasesViewConfig): BasesAllOptions[] {
	// The type list is fixed, but each type's DEFAULT folder sits under this view's home
	// folder — so the callback still reads the config. Declaring the shipped `docs/…`
	// here regardless would make every picker in a `Roadmap` base advertise a folder the
	// creation flow does not use, and restoring that shown default would move the type.
	//
	// The workflow states are the same idea taken further: they are user data outright,
	// so the limit and policy boxes exist only once a workflow does.
	const settings = config ? resolveSettings(config) : defaultSettings();
	return [
		hierarchyGroup(),
		progressGroup(settings),
		deliverablesGroup(),
		roadmapGroup(),
		newItemsGroup(settings.homeFolder),
		displayGroup(),
	];
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

function progressGroup(settings: BacklogSettings): BasesAllOptions {
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	return {
		type: 'group',
		displayName: 'Progress',
		items: [
			optionalPropertyOption('state', 'State property'),
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
				type: 'text',
				key: 'startedStates',
				displayName: 'States that count as started',
				default: '',
				placeholder: 'Active, In review',
			},
			// Two properties rather than one, because they answer different questions and
			// a note may honestly have one and not the other. Both are unset by default:
			// a stamp writes to a property the user named — or accepted, by pressing
			// Assign missing properties — never to one this plugin chose for them.
			optionalPropertyOption('startedDate', 'Started date property'),
			optionalPropertyOption('finishedDate', 'Finished date property'),
			{
				type: 'toggle',
				key: 'showCompleted',
				displayName: 'Show completed items',
				default: true,
			},
			// One box per configured state, the mechanism the per-type folder keys use.
			// A limit is `text` rather than `slider` because a slider always holds a
			// number and cannot say "unset" — and an unset limit is not a limit of zero.
			...settings.states.flatMap((state): BasesOptions[] => [
				...(done.has(state.toLowerCase())
					? []
					: [
							{
								type: 'text',
								key: wipLimitKey(state),
								displayName: `WIP limit for ${state}`,
								default: '',
								placeholder: 'No limit',
							} as BasesOptions,
						]),
				{
					type: 'text',
					key: columnPolicyKey(state),
					displayName: `Policy for ${state}`,
					default: '',
					placeholder: 'What has to be true to leave this column',
				},
			]),
		],
	};
}

/**
 * The Deliverable workflow's own group — columns and a workflow only, per Scope: no
 * WIP-limit or policy boxes, unlike `progressGroup`'s requirements workflow.
 */
function deliverablesGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Deliverables',
		items: [
			optionalPropertyOption('deliverableState', 'Deliverable state property'),
			{
				type: 'text',
				key: 'deliverableStateValues',
				displayName: 'Deliverable workflow states (in order)',
				default: '',
				placeholder: 'Concept, Draft, Review, Published',
			},
			{
				type: 'text',
				key: 'deliverableDoneValues',
				displayName: 'Deliverable states that count as done',
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
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
			optionalPropertyOption('horizon', 'Horizon property'),
			{
				type: 'text',
				key: 'horizonValues',
				displayName: 'Horizons (in order)',
				default: DEFAULT_HORIZON_VALUES.join(', '),
				placeholder: DEFAULT_HORIZON_VALUES.join(', '),
			},
			optionalPropertyOption('start', 'Start date property'),
			optionalPropertyOption('target', 'Target date property'),
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
