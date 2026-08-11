import { ManualSection } from '../../ui/manualDialog';

/**
 * Setting up the view: the section whose prose is authored and whose COVERAGE is derived —
 * see `sections.ts`, where that contract is stated and where the other five live. Its own
 * module because it is the section that grows with the SCHEMA rather than with what
 * someone thought to explain: a folder picker per type, and a limit, a policy and a colour
 * per workflow state, so it outgrew the file holding the five that do not.
 */

export const SETUP: ManualSection = {
	id: 'setup',
	title: 'Setting up the view',
	intro:
		'The fast way: run Product Backlog: Create backlog. It writes a folder, a configured ' +
		'base, and opens the view.',
	entries: [
		{
			term: 'The toolbar\'s ✨ Assign missing properties',
			text:
				'The fast way to configure an EXISTING backlog, as Create backlog is for a new one. ' +
				'Config gate first, then two things in one press: binds this view\'s suggested key ' +
				'to every optional property you have not named — never one you have set or ' +
				'deliberately cleared, since Bases tells "untouched" from "set to nothing" — then ' +
				'backfills type, order and (for slot properties, not relationships) an empty value ' +
				'onto notes lacking them, overwriting nothing. Never writes to an excluded note, and ' +
				'never guesses a type for a parent link that resolves nowhere. The board and the ' +
				'roadmap offer the same action, worded "Add the default properties", from their ' +
				'own unconfigured empty states.',
		},
		{
			term: 'What the tree is',
			text:
				'The three property names, whether notes outside the hierarchy are ignored, whether ' +
				'excluded parents are loaded, and whether parents come from folder notes.',
			keys: ['parentProperty', 'orderProperty', 'typeProperty', 'hierarchyOnly', 'showOutsideParents', 'inferFolderHierarchy'],
		},
		{
			term: 'Assign item type when moving',
			text:
				"Off by default. On, a move that changes an item's parent retypes the ladder levels " +
				'in its subtree to match — see "Moving and ranking" for exactly what it skips.',
			keys: ['autoAssignType'],
		},
		{
			term: 'State, tags, assignee and the stamps a state carries',
			text:
				'The properties the state chip, the tag column, the assignee chip, and a state ' +
				'change\'s own started/finished dates write to. None is written until its property ' +
				'is named — a stamp is never written to a property this plugin chose on its own. ' +
				'The assignee takes no list beside it: it offers the names already in the base, ' +
				'plus whatever you type.',
			keys: [
				'stateProperty',
				'tagsProperty',
				'assigneeProperty',
				'startedDateProperty',
				'finishedDateProperty',
			],
		},
		{
			term: 'Risk',
			text: 'The property Set risk and the risk chip write to, and the levels offered.',
			keys: ['riskProperty', 'riskValues'],
		},
		{
			term: 'Placing work on the roadmap',
			text:
				'The horizon property and its buckets; the start and target date properties the ' +
				'timeline schedules; and the depends-on property a dependency connector writes.',
			keys: ['horizonProperty', 'horizonValues', 'startProperty', 'targetProperty', 'dependsOnProperty'],
		},
		{
			term: 'The Deliverables workflow\'s own state property — an override',
			text:
					'Unset by default, and a first-run ✨ deliberately leaves it that way: with no key of its own, Deliverables ' +
					'reads and writes State property above instead — sharing its property, values and done values as one workflow. ' +
					'Name a property here only to make Deliverables independent; its own done values (below) then default to the ' +
					'shipped Done, Closed, Completed, Removed rather than this vault’s customized shared list, while its own state ' +
					'values stay unset and columns come from whatever this vault’s Deliverables already use instead — an own key ' +
					'with nothing declared is a genuinely separate workflow.',
			keys: ['deliverableStateProperty'],
		},
		{
			term: 'What progress means',
			text:
				'The workflow states offered for writing, done values, started values, and Show ' +
				'completed items — deciding the rollups, done styling and which subtrees render. ' +
				'A WIP limit and leave-column policy are offered per state, requirements only — ' +
				'Deliverables carries no equivalent. Its own states/done-values boxes win the ' +
				'moment either is filled in, whatever the property above is; only an EMPTY box\'s ' +
				'fallback depends on it — these values with a shared property, the shipped ' +
				'defaults once Deliverables has its own.',
			keys: [
				'stateValues', 'doneValues', 'startedStates', 'showCompleted',
				'deliverableStateValues', 'deliverableDoneValues',
				'wipLimit.*', 'columnPolicy.*',
			],
		},
		{
			term: 'A colour per state',
			text:
				'Not here: Bases has no colour control, so the picker is this plugin’s own dialog, ' +
				'opened by the palette button on the roadmap toolbar — dated axis only, since that ' +
				'is the one place a state colour is drawn. It offers one swatch per DECLARED state, ' +
				'across both workflows, each state once; a state you have not listed in the boxes ' +
				'above cannot be coloured, because there would be nowhere to keep the choice. The ' +
				'swatch opens on the colour that state is drawn in now, and the arrow beside it puts ' +
				'it back on the default. A chosen colour is fixed, where the default follows the ' +
				'theme between light and dark; a finished state stays green whatever is chosen.',
		},
		{
			term: 'Where new notes go',
			text:
				"The home folder new items fall back to, and each type's own folder — a picker per " +
				'type in the fixed vocabulary, ranking ahead of the home folder.',
			keys: ['homeFolder', 'typeFolder.*'],
		},
		{
			term: 'How an item opens',
			text:
				'What a click on a row does, and where the note it opens goes. The first of the ' +
				'two is also a toggle on the toolbar, beside the completed-items eye, so it can ' +
				'be flipped without opening this panel.',
			keys: ['clickAction', 'openIn'],
		},
		{
			term: 'Presentation',
			text: 'The width of a property column, and whether descendant counts show.',
			keys: ['propertyColumnWidth', 'showCounts'],
		},
		{
			term: 'The state property is a prerequisite',
			text:
				'Without one there are no progress rollups, no done styling, no state chip and no ' +
				'completed-items toggle — several other options here do nothing until it is set.',
		},
		{
			term: 'What the Base still owns',
			text:
				'The filter, the sort that orders unranked items, and which properties show as ' +
				"columns are the Base's own settings, reached from the same toolbar — its " +
				'properties menu is the only switch for what a row shows, and in what order. ' +
				'This view decides their width, and drops leading columns when the row will ' +
				'not fit.',
		},
		{
			term: "What this view ignores, and what it can't work around",
			text:
				'A group-by set on the Base has no effect here — the hierarchy is the tree\'s own ' +
				'grouping, and the toolbar says so. A limit set on the Base is a different kind of ' +
				'problem: it truncates the results before this view ever sees them, so items are ' +
				'missing from the tree and from every count. Loading excluded parents restores the ' +
				'ancestors a truncation dropped, never the other items it left out.',
		},
	],
};

