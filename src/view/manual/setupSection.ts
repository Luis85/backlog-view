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
				'onto notes lacking them, overwriting nothing — except a planned date the note\'s own ' +
				'type cannot use: a milestone is a point, so it is given the target and not the start. ' +
				'Never writes to an excluded note, and ' +
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
			term: 'Priority',
			text:
				'The property Set priority and the priority chip write to, and the levels ' +
				'offered. Ships holding MoSCoW — 1 - Must, 2 - Should, 3 - Could, 4 - Won\'t — ' +
				'and the words are yours to change. Clear the list and the chip and the menu go ' +
				'away, leaving an ordinary property Obsidian\'s own editor still edits.',
			keys: ['priorityProperty', 'priorityValues'],
		},
		{
			term: 'Iteration',
			text:
				'The property that records which iteration an item is in. The view reads it, and ' +
				'the toolbar\'s ✨ Assign missing properties will create the empty key on notes ' +
				'that lack it. The iteration goal property holds what that iteration is FOR, in ' +
				'one line, on the Iteration note alone. It is drawn above the columns of a board ' +
				'scoped to that iteration, and it fills the goal field of the scope picker\'s ' +
				'Edit iteration dialog. ✨ never creates it, since a goal on every other note in ' +
				'the vault would mean nothing. ' +
				'The two state lists say how a board scoped to one iteration narrows your own ' +
				'workflow into three columns: the states it reads as not started, the states it ' +
				'reads as finished, and everything else in between. Two readings hold whether or ' +
				'not you name them — an item with no state at all is Open, and any state that ' +
				'counts as done is Resolved — so with both lists empty the outer columns still ' +
				'fill and the middle one takes every remaining state. ' +
				'The length is how many days a new iteration runs for ' +
				'when the board derives one — a whole number of days, 14 if it cannot be read. ' +
				'Show iterations on the roadmap timeline decides whether the dated and resource ' +
				'axes draw them at all: turned off, an iteration draws nowhere — not as a mark ' +
				'and not on the unplaced shelf — and no note is changed either way. Turned off, ' +
				'it also takes the bar option below out of the menu, since there is no reading ' +
				'left to choose; your pick is kept and comes back with the timeline. ' +
				'Draw iterations as bars switches an iteration\'s own reading on the roadmap ' +
				'between a single point at its target date — the default, the same reduction a ' +
				'Milestone always gets — and a span from its start to its target.',
			keys: [
				'iterationProperty',
				'iterationGoalProperty',
				'iterationOpenStates',
				'iterationResolvedStates',
				'iterationLengthDays',
				'iterationsOnTimeline',
				'iterationBars',
			],
		},
		{
			term: 'Placing work on the roadmap',
			text:
				'The horizon property and its buckets; the start and target date properties the ' +
				'timeline schedules; the resources whose rows the timeline can be grouped into, ' +
				'which is optional because an assignee nobody declared still gets a row of its ' +
				'own; and the depends-on property a dependency connector writes.',
			keys: [
				'horizonProperty',
				'horizonValues',
				'startProperty',
				'targetProperty',
				'resourceNames',
				'dependsOnProperty',
			],
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
			term: 'The test catalog\'s own workflow',
			text:
				'Unset by default, like the Deliverable property above: with no key of its own, a ' +
				'`Test suite` or `Test case` row\'s state chip reads and writes State property ' +
				'instead, sharing its property and its states while it is falling back. Name a ' +
				'property here to make it independent; its own done values then default to the ' +
				'shipped Done, Closed, Completed, Removed rather than this vault\'s customized ' +
				'shared list, while its own states stay unset. Records no run history and draws no ' +
				'columns: the catalog is a tree, and this is the same per-item state mechanism ' +
				'every other workflow here already has, over its own property.',
			keys: ['testStateProperty', 'testStateValues', 'testDoneValues'],
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
				'above cannot be coloured, because there would be nowhere to keep the choice. A ' +
				'done state is not listed either: a finished bar is always green. The swatch opens ' +
				'on the colour that state is drawn in now, and the arrow beside it puts it back on ' +
				'the default. A chosen colour is fixed, where the default follows the theme ' +
				'between light and dark.',
		},
		{
			term: 'Where new notes go',
			text:
				"The home folder new items fall back to, and each type's own folder — a picker per " +
				'type in the fixed vocabulary, one more for absences, and each ranking ahead of ' +
				"the home folder. A resource note has its own folder the same way, ranking ahead of " +
				'the home folder too.',
			keys: ['homeFolder', 'typeFolder.*', 'resourceFolder'],
		},
		{
			term: 'How an item opens',
			text:
				'Where the note a click opens goes. Whether a click OPENS it at all is not here: ' +
				'the toolbar toggle beside the completed-items eye decides that, on the tree and ' +
				'the timeline — the two places a row has a chevron, never a card, whose children ' +
				'are listed on its own face. It is kept per view on this device, like the ' +
				'projection and the focus level, rather than in the base.',
			keys: ['openIn'],
		},
		{
			term: 'Presentation',
			text:
				'Whether descendant counts show. The WIDTH of a property column is not here: drag ' +
				'the grip at its header (double click it to put it back), and the width is kept ' +
				'per view on this device, like the projection and the focus level, rather than ' +
				'in the base.',
			keys: ['showCounts'],
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
				'Their WIDTH is this view\'s, and the reader\'s: drag the grip on a column ' +
				'header, or double click it to reset. Columns still drop when the row will ' +
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

