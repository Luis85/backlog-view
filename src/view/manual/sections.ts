import { ManualSection } from '../../ui/manualDialog';
import { typesSection } from './typesSection';

/**
 * The five sections someone wrote, plus the one that is generated.
 *
 * `setup` is the odd one: its prose is authored, because
 * `docs/requirements/Help for setting up the view.md` requires grouping by what an option
 * CHANGES rather than by schema order — but its coverage is derived. Each entry names the
 * view-option keys it explains in `keys`, and `test/docs/surfaces.test.ts` asserts every
 * key `getViewOptions()` declares is claimed exactly once. The schema generates a folder
 * picker per type and a limit and a policy per workflow state, so the count moves with the
 * vocabulary and with the user's own configuration: a hand-listed section would read as
 * complete while omitting the generated half.
 */
const MOVING: ManualSection = {
	id: 'moving',
	title: 'Moving and ranking',
	intro: 'Where a drop lands decides what it means. The drop indicator is the cue.',
	entries: [
		{
			term: 'Between two rows',
			text:
				'Places the item as their sibling. If those rows have a different parent, it is ' +
				'reparented as well as ranked — the fastest way to move and rank in one gesture.',
		},
		{ term: 'Onto a row', text: 'Makes the item a child of that row.' },
		{
			term: 'Without a mouse',
			text:
				'Alt and the arrow keys move, indent and outdent. The context menu offers move up, ' +
				'down, to top, to bottom, indent and outdent — the same commands, for a menu that ' +
				'cannot see which key is held.',
		},
		{
			term: 'Order',
			text:
				'A number ranking siblings, maintained by the view. Missing orders sort last, in ' +
				'whatever order the Base itself returned them.',
		},
		{
			term: 'A move does not re-type',
			text:
				'Applies only when Assign item type when moving is on, and only on a move that ' +
				"changes an item's parent. It retypes the dragged item and every explicitly " +
				'ladder-typed descendant to match its new rung, cascading down through the whole ' +
				'subtree — and skips the rest: an untyped descendant (its level is already implied ' +
				'by its position), a descendant carrying a custom type outside the four levels, and ' +
				'a declared extra type (Issue, Bug, Idea, Deliverable), which keeps its own pinned ' +
				'rank rather than taking the ladder position. It stops descending a branch the moment ' +
				'it meets a note the Base excluded or a Milestone — neither has a rung for what sits ' +
				'below it to inherit.',
		},
		{
			term: 'When a drop is unavailable',
			text:
				'A row refuses a drop onto itself or into its own descendants. A between-drop ' +
				'(before or after a row) is also unavailable wherever there is no shared ranking to ' +
				'insert into: onto the top row of a focused view, onto a row loaded only as an ' +
				'excluded parent, or into any sibling group that itself contains an excluded row — ' +
				'renumbering that group would silently skip a write to a note the Base excludes. The ' +
				'same rule governs Move up, Move down, Move to top, Move to bottom and Outdent from ' +
				'the menu or Alt+arrow. Dropping into a parent, the top-level strip and Indent stay ' +
				'available in every one of those cases, since landing last is what they mean anyway.',
		},
		{
			term: 'While a quick filter is active',
			text:
				'Dragging is off entirely, because rows next to each other under a filter are not ' +
				'siblings. A row that will not lift is the filter, not a fault.',
		},
	],
};

const CREATING: ManualSection = {
	id: 'creating',
	title: 'Creating and filing',
	entries: [
		{
			term: 'The + on a row',
			text:
				'Offers the types that row may hold — but only on a row that is not already at the ' +
				'deepest rung: there it offers that one type alone, the same as under a declared ' +
				'extra type (Issue, Bug, Idea, Deliverable), whose own children are always the deepest ' +
				'level. A non-deepest ladder row offers one rung down plus the types that sit beside ' +
				"the ladder. A Milestone's + is absent altogether — it draws no add affordance — and " +
				"the toolbar's own New (no row at all) offers the whole vocabulary.",
		},
		{
			term: 'The context menu',
			text:
				'Offers the same new-item choices as the +, plus structural actions with no drag ' +
				'gesture of their own — move to top, move to bottom, outdent — and whatever else that ' +
				"row's projection can do.",
		},
		{
			term: 'Where the note lands',
			text:
				"In folder mode, beside the parent's own folder note — unless that parent is only " +
				'loaded as excluded context, whose folder is outside this base\'s filter, in which ' +
				"case this step is skipped. Otherwise: the type's own configured folder, else the " +
				'home folder, else the folder most existing items already live in, else — only when ' +
				'none of those can answer — asking.',
		},
		{
			term: 'What is written',
			text:
				'The type, the parent link (when there is one) and an order, in one batch — plus the ' +
				"bucket's own placement when the note was created from a roadmap bucket. The note " +
				'opens; nothing else moves.',
		},
		{
			term: 'Creating under an excluded parent',
			text:
				'The parent link is written explicitly regardless, so the hierarchy stays right ' +
				"wherever the note lands — the one exception being folder mode's beside-the-parent " +
				"filing rule, which this same exclusion already turns off for such a parent.",
		},
	],
};

const FINDING: ManualSection = {
	id: 'finding',
	title: 'Finding work',
	entries: [
		{
			term: 'Focus level',
			text:
				'Picks which rung is the top of the tree. It is working position, remembered per ' +
				'view per device, and never written to the base.',
		},
		{
			term: 'Quick filter',
			text:
				'Narrows to matching titles — but keeps the whole match path visible: a match, its ' +
				'ancestors and its entire subtree all stay on screen, and collapsed rows are forced ' +
				'open while it runs. Most of what remains did not match itself. On the board and the ' +
				"roadmap, a match a card is not already showing on its own face gets named there " +
				'instead of disappearing.',
		},
		{
			term: 'Show completed items',
			text:
				'When off, a subtree that is entirely done is hidden. The quick filter overrides it ' +
				'while it runs.',
		},
		{
			term: 'Nothing showing at all',
			text:
				'Either the Base returned nothing, or nothing it returned belongs to the hierarchy. ' +
				'The toolbar says how many notes were skipped, which tells the two apart.',
		},
	],
};

const WRITES: ManualSection = {
	id: 'writes',
	title: 'Safe writes and undo',
	entries: [
		{
			term: 'A change is one batch',
			text:
				'A drag that renumbers six siblings is a single change, and undo takes all six back ' +
				'— Ctrl or Cmd with Z, or the toolbar arrow.',
		},
		{
			term: 'One at a time',
			text:
				'A second change is refused while one is in flight, rather than queued behind it. ' +
				'The indicator says a batch is running.',
		},
		{
			term: 'A forward write never targets an excluded note',
			text:
				'A batch is refused whole if any write in it would touch a note the base excluded — ' +
				'better a change fails loudly than half-applies. Such a note renders only to keep the ' +
				'tree\'s shape: no state chip, no Set type, no reparenting. Undo is the one ' +
				'exception — a batch being taken back was authorized when it was first written, ' +
				'before the note (perhaps) left the filter, so undo replays it without repeating this ' +
				'check.',
		},
		{
			term: 'A misconfigured view writes nothing',
			text:
				'If two properties collide or a required one is unset, the toolbar warns and every ' +
				'write path — including undo — stays closed until it is fixed.',
		},
	],
};

const SETUP: ManualSection = {
	id: 'setup',
	title: 'Setting up the view',
	intro:
		'The fast way: run Product Backlog: Create backlog. It writes a folder, a configured ' +
		'base, and opens the view.',
	entries: [
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
			term: 'State, tags and the stamps a state carries',
			text:
				'The properties the state chip, the tag column, and a state change\'s own started/' +
				'finished dates write to. None is written until its property is named — a stamp is ' +
				'never written to a property this plugin chose on its own.',
			keys: ['stateProperty', 'tagsProperty', 'startedDateProperty', 'finishedDateProperty'],
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
			term: 'The Deliverables workflow',
			text: "The property the Deliverables board's own Set state writes.",
			keys: ['deliverableStateProperty'],
		},
		{
			term: 'What progress means',
			text:
				'The workflow states offered for writing, the values counted as done, the values ' +
				'counted as started, and Show completed items — which decide the rollups, the done ' +
				'styling and which subtrees render at all. A WIP limit and a leave-column policy are ' +
				'offered per configured state, and per Deliverable state a parallel pair of values ' +
				'does the same for that board.',
			keys: [
				'stateValues', 'doneValues', 'startedStates', 'showCompleted',
				'deliverableStateValues', 'deliverableDoneValues',
				'wipLimit.*', 'columnPolicy.*',
			],
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
			text: 'What a click on a row does, and where the note it opens goes.',
			keys: ['clickAction', 'openIn'],
		},
		{
			term: 'Presentation',
			text: 'Whether property columns render on rows, their width, and descendant counts.',
			keys: ['showProperties', 'propertyColumnWidth', 'showCounts'],
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
				"The filter and the sort that orders unranked items are the Base's own settings, " +
				'reached from the same toolbar. So is which properties are visible at all — this ' +
				'view only decides whether they render as columns, and how wide, once the Base names ' +
				'them.',
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

/** The manual, in the order the sidebar shows it. */
export function manualSections(): ManualSection[] {
	return [typesSection(), MOVING, CREATING, FINDING, WRITES, SETUP];
}
