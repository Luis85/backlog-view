import { BasesAllOptions, BasesOptions, BasesPropertyId, BasesViewConfig } from 'obsidian';
import {
	BacklogSettings,
	columnPolicyKey,
	DEFAULT_DONE_VALUES,
	DEFAULT_HORIZON_VALUES,
	DEFAULT_ITERATION_DAYS,
	DEFAULT_PRIORITY_VALUES,
	DEFAULT_RISK_VALUES,
	wipLimitKey,
} from './settings';
import { OptionalField, optionalProperty } from './optionalProperties';
import { resolveSettings } from './settingsResolve';
import { ABSENCE_TYPE, ALL_TYPES, DEFAULT_HOME_FOLDER, defaultTypeFolder, typeFolderKey } from './typeVocabulary';
import { defaultItemHandling, OPEN_TARGETS } from './itemHandling';

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
 * position, stored in the view-state store.
 */
export function getViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	// The type list is fixed, but each type's DEFAULT folder sits under this view's home
	// folder — so the callback still reads the config. Declaring the shipped `docs/…`
	// here regardless would make every picker in a `Roadmap` base advertise a folder the
	// creation flow does not use, and restoring that shown default would move the type.
	//
	// The workflow states are the same idea taken further: they are user data outright,
	// so the limit and policy boxes exist only once a workflow does.
	//
	// The config is REQUIRED, and that is the 1.12.0 floor doing work: Obsidian passed
	// this callback nothing until then, so the parameter was optional and fell back to
	// `defaultSettings()` — which is exactly the wrong menu, advertising the shipped
	// `docs/…` folders in someone else's base and hiding the per-state boxes entirely.
	// A fallback for an Obsidian below the floor is dead code (ADR 0016); it is gone.
	const settings = resolveSettings(config);
	return [
		hierarchyGroup(),
		progressGroup(settings),
		deliverablesGroup(),
		iterationsGroup(),
		testManagementGroup(),
		roadmapGroup(),
		riskGroup(),
		priorityGroup(),
		newItemsGroup(settings.homeFolder),
		handlingItemsGroup(),
		displayGroup(),
	];
}

/**
 * Where an opened note goes — every projection opens notes the same way, so this one
 * needs no qualifier naming where it applies.
 *
 * **Whether a plain click opens the note or folds the row was the group's other option
 * until 2026-08-11.** It is not configuration any more: it is flipped while working, on
 * the screen in front of you, so it lives in the view-state store with the projection and
 * the focus level (ADR 0011) and is reached only from the toolbar toggle. Nothing here
 * reads a `clickAction` key, so one left in a `.base` written before the move is inert.
 */
function handlingItemsGroup(): BasesAllOptions {
	const defaults = defaultItemHandling();
	return {
		type: 'group',
		displayName: 'Handling items',
		items: [
			// The offered vocabulary is `itemHandling.ts`'s own, which is also what reads
			// a stored value back — so nothing can be offered that cannot be read.
			{
				type: 'dropdown',
				key: 'openIn',
				displayName: 'Open the note in',
				default: defaults.openIn,
				options: OPEN_TARGETS,
			},
		],
	};
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
			// A property and no list beside it, unlike the state above and the risk
			// levels below: the names Set assignee offers are the ones the results
			// already carry, plus whatever the user types, so there is no vocabulary
			// to declare here and nothing an empty box could turn off. The Roadmap
			// group's "Resources (in order)" is not that missing list — it declares the
			// resources AXIS's rows and never narrows what this menu offers.
			optionalPropertyOption('assignee', 'Assignee property'),
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
 * The iterations group. It holds no state PROPERTY and that is the decision, not an
 * omission: the iteration board reads the PRODUCT state key and narrows it, so there is
 * no second property to configure here. See the 2026-08-16 revision of the design.
 *
 * What it does hold is which of the product's own states fall in the two outer columns.
 * Everything unnamed is In Progress, so an unconfigured pair is a board that says nothing
 * rather than one that refuses to draw — which is why neither list ships a default: a
 * guessed Open column would sort a vault's cards by a vocabulary nobody chose.
 */
function iterationsGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Iterations',
		items: [
			optionalPropertyOption('iteration', 'Iteration property'),
			optionalPropertyOption('iterationGoal', 'Iteration goal property'),
			{
				type: 'text',
				key: 'iterationOpenStates',
				displayName: 'Product states an iteration has not started',
				default: '',
				placeholder: 'New, Ready',
			},
			{
				type: 'text',
				key: 'iterationResolvedStates',
				displayName: 'Product states an iteration is finished with',
				default: '',
				placeholder: 'In review, Done',
			},
			// Bases has no number option, so a length is text and `resolveIterationDays`
			// is what makes it a number of days.
			{
				type: 'text',
				key: 'iterationLengthDays',
				displayName: 'Default iteration length in days',
				default: String(DEFAULT_ITERATION_DAYS),
				placeholder: String(DEFAULT_ITERATION_DAYS),
			},
		],
	};
}

/**
 * The test workflow's own group — the Deliverables group's mirror MINUS its colour
 * section, which is a decision rather than an omission. `stateColors` is keyed by the
 * state VALUE, so a test state spelled like a requirements state shares that state's
 * colour key — no second control needed. What a test-ONLY state gives up is not an
 * override in favour of a positional slot: `statePalettes` (`board.ts`) builds only the
 * Work and Deliverables palettes, so a value in neither is in no palette at all —
 * `paletteSlot` returns null and it draws the plain accent. A colour box here would key a
 * colour nothing ever paints.
 */
function testManagementGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Test management',
		items: [
			optionalPropertyOption('testState', 'Test state property'),
			{
				type: 'text',
				key: 'testStateValues',
				displayName: 'Test workflow states (in order)',
				default: '',
				// About whether a case is fit to be WALKED. Deliberately not the plan's
				// New/Active/Done, and deliberately not Pass/Fail — a result, which this epic
				// refuses. A placeholder suggests and configures nothing.
				placeholder: 'Draft, Ready, Approved',
			},
			{
				type: 'text',
				key: 'testDoneValues',
				displayName: 'Test states that count as done',
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
 * the ecosystem's own vocabulary (the Tasks plugin's `start`, `due` and `dependsOn`)
 * without assuming it.
 *
 * The depends-on property sits here rather than under Hierarchy for the reason
 * `Dependencies as a property` states — a prerequisite list is not a second tree, and
 * the group that owns `parent` is the tree's. It is the roadmap's because that is the
 * projection that DRAWS one; the menu that sets one is offered wherever an item renders.
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
			// The resources axis's ROW list, not a vocabulary: it adds rows nothing has
			// landed in yet and never narrows what Set assignee offers. No default,
			// unlike the horizons above — nobody declares who exists, so an empty box is
			// the configured state rather than a cleared one.
			{
				type: 'text',
				key: 'resourceNames',
				displayName: 'Resources (in order)',
				placeholder: 'Optional, comma separated',
			},
			optionalPropertyOption('dependsOn', 'Depends-on property'),
		],
	};
}

/**
 * How risky an item is, read off a property and chosen from a declared list. Both
 * halves are needed before anything can be set: a property with no levels has nothing
 * to offer, and levels with no property have nowhere to go — `hasRiskLevels` is that
 * pair asked once. The default list is spelled as the text the box shows, so the
 * shipped default and the parsed one cannot drift: `defaultSettings` parses this list.
 */
function riskGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Risk management',
		items: [
			optionalPropertyOption('risk', 'Risk property'),
			{
				type: 'text',
				key: 'riskValues',
				displayName: 'Risk levels (in order)',
				default: DEFAULT_RISK_VALUES.join(', '),
				placeholder: DEFAULT_RISK_VALUES.join(', '),
			},
		],
	};
}

/**
 * How important an item is, read off a property and chosen from a declared list — the
 * risk group's two halves and its `hasPriorityLevels` pair, over the ladder a backlog is
 * ordinarily ranked by. Its own group rather than two more rows under **Risk management**:
 * the group's display name is a promise about what is inside it, and a priority is not a
 * risk.
 *
 * The list ships holding MoSCoW because that is the vocabulary most backlogs already use,
 * and it is editable for `riskValues`' reason — the words belong to the reader. The
 * default is spelled as the text the box shows, so the shipped default and the parsed one
 * cannot drift.
 */
function priorityGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Prioritization',
		items: [
			optionalPropertyOption('priority', 'Priority property'),
			{
				type: 'text',
				key: 'priorityValues',
				displayName: 'Priority levels (in order)',
				default: DEFAULT_PRIORITY_VALUES.join(', '),
				placeholder: DEFAULT_PRIORITY_VALUES.join(', '),
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
			// A picker per type, in ladder order then the extras — and then the absence,
			// which has a folder like any other note this plugin writes and is a type in
			// no other sense. One input each is the difference between choosing a folder
			// and spelling a mapping correctly. `defaultTypeFolder` answers '' for the
			// absence, so its box shows the home folder as a placeholder and an unset
			// option files it there.
			...[...ALL_TYPES, ABSENCE_TYPE].map(
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
