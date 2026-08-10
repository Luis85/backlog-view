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
	intro:
		'Where a drop lands decides what it means. The drop indicator is the cue. This ' +
		"section is the tree's own hierarchy — the same Alt+Left/Right moves a card to a " +
		'different workflow column on the board, or a different bucket on the roadmap ' +
		'when it is showing horizons, and touches neither parent nor order.',
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
				'In the tree, Alt and the arrow keys move, indent and outdent, and the context menu ' +
				'offers the same six as move up, down, to top, to bottom, indent and outdent — for a ' +
				'menu that cannot see which key is held. Both are tree-only: the menu\'s move section ' +
				"is absent from a card's own menu on the board and the roadmap, since every entry in " +
				"it is defined by a row's visible neighbours, which a card does not have.",
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
				'the menu or Alt+arrow. Dropping into a parent stays available in every one of those ' +
				'cases, since landing last is what it means anyway — and so do the top-level strip and ' +
				'Indent, except throughout a focused view, where neither works at all: the top-level ' +
				'strip refuses unconditionally while any focus is set, and a focus-root row has no ' +
				'previous sibling for Indent to nest it under, by the same no-shared-ranking rule ' +
				'above.',
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
				"the ladder. A Milestone's + is absent altogether — it draws no add affordance. The " +
				"toolbar's own New is a separate pair of controls, described below.",
		},
		{
			term: 'The toolbar\'s New, and the chevron beside it',
			text:
				'Two controls. New itself makes exactly one type — the current focus, if this ' +
				'projection shows it, else the ladder\'s top — with no picker. The chevron is the ' +
				'actual vocabulary: every type this projection can create, each its own prompt. ' +
				'Neither offers Deliverable on the requirements board; on the Deliverables board ' +
				'New is pinned to Deliverable and the chevron is absent, nothing left to pick.',
		},
		{
			term: 'The context menu',
			text:
				'Offers the same new-item choices as the +, plus structural actions with no drag ' +
				'gesture of their own — move to top, move to bottom, outdent — and whatever else that ' +
				"row's projection can do. It is also the +'s only keyboard route: the + itself carries " +
				'no tab stop, so with a row selected, the keyboard\'s Menu key (or Shift+F10 without ' +
				'one) opens this same menu.',
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
				'does not open; a notice names it, and nothing else moves.',
		},
		{
			term: 'Creating under an excluded parent',
			text:
				'The parent link is written explicitly regardless, so the hierarchy stays right ' +
				"wherever the note lands — the one exception being folder mode's beside-the-parent " +
				"filing rule, which this same exclusion already turns off for such a parent.",
		},
		{
			term: 'Whether the new note then appears',
			text:
				"Creating a note only decides where it is filed and how it is typed — it does not " +
				"check the Base's own filter. A destination folder or a written property the filter " +
				'excludes still creates the note successfully; the next refresh simply does not show ' +
				'it, and nothing announces that this happened.',
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
				'Picks which rung is the top of the tree: the first item matching from the top of ' +
				'each branch becomes a root, so a match nested under one already found stays a ' +
				'normal descendant rather than a second root. Focusing the rung a declared extra ' +
				'type is pinned to (PBI, since a Bug\'s own children are always Tasks) promotes ' +
				'every extra type (Issue, Bug, Idea, Deliverable) alongside that rung\'s own items; ' +
				'focusing an extra type by name matches only that one type. It is working position, ' +
				'remembered per view per device, and never written to the base.',
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
			term: 'The ignored-notes count',
			text:
				'A toolbar note whenever any note has no supported type and no parent, so it never ' +
				'became a backlog item — it shows any time that count is above zero, not only when ' +
				'the whole view is empty, so a single pruned note reads here while the rest renders ' +
				'fine: the first place to check for one missing item. Its tooltip names the fix — ' +
				'turn off Ignore notes outside the hierarchy, or type or link the note in.',
		},
		{
			term: 'The marker on a row loaded only for context',
			text:
				"A row the base's own filter excluded, kept only so the hierarchy around a real " +
				'result stays correct — hover for "Not in this base\'s filter — shown to keep the ' +
				'hierarchy". Its state, if it has one, still shows, as a static chip that cannot ' +
				'be clicked; no Set type or Set state, no reparenting, never draggable. A row that ' +
				'looks inert for no obvious reason is likely this marker.',
		},
		{
			term: 'Nothing showing at all',
			text:
				'Five causes, each with its own one-press fix. Focused on a type nothing matches — ' +
				'the rest of the backlog is untouched elsewhere (switch focus back to "All types", ' +
				'or create one). Unfocused: the Base returned nothing (point its filter at the ' +
				'backlog folder), or returned only ignored notes (turn off Ignore notes outside the ' +
				'hierarchy, per the count above). With items present: a quick filter matching none ' +
				'of them (Clear filter), or every subtree done (Show completed items).',
		},
		{
			term: 'Empty differently, on the board and the roadmap',
			text:
				'Focusing "Deliverable" empties the requirements board with its own message, ' +
				'since that board never shows Deliverables — clear the focus, or switch boards, ' +
				'never create another of a type it could not display. The Deliverables board has ' +
				'its own "no deliverables yet" state, unrelated to Show completed items: it has no ' +
				'done-and-hidden concept to distinguish from.',
		},
	],
};

const WRITES: ManualSection = {
	id: 'writes',
	title: 'Safe writes and undo',
	entries: [
		{
			term: 'What this view writes',
			text:
				'Three hierarchy properties, always: parent, order and type. Beyond those, a fixed ' +
				'set of optional ones — the workflow state (and the Deliverables board\'s own ' +
				'state), tags, a state change\'s own started and finished date stamps, risk, the ' +
				'roadmap\'s horizon and its start and target dates, and prerequisites (depends-on) ' +
				'— each written only once its own property is named in the view options. An ' +
				'unconfigured key is never written to; nothing invents one.',
		},
		{
			term: 'A change is one batch',
			text:
				'A drag that renumbers six siblings is a single change, and Ctrl or Cmd with Z, or ' +
				'the toolbar arrow, takes the whole batch back at once — with the limits below.',
		},
		{
			term: 'A batch is not atomic',
			text:
				'Writes land one file at a time, in order. If a large one fails partway — a big ' +
				'drag, a backfill — every file already written stays written; the batch stops there ' +
				'rather than undoing them, and the view refreshes to exactly what is now on disk. ' +
				'Undo still works on what landed: it takes back only that prefix.',
		},
		{
			term: 'What undo does not guarantee',
			text:
				'Undo is compare-and-swap, key by key, not a blind rewind: a key hand-edited since ' +
				'the write it is undoing is left as it now stands, and the notice counts it — ' +
				'"edited since and kept" — rather than silently overwriting it. A note deleted since ' +
				'is skipped whole, and the rest of the batch still restores. There is one undo slot ' +
				'— one batch, per view, per session, not a stack — so a second change replaces what ' +
				'the first left undoable. Creating an item never touches this slot: undo does not ' +
				'delete a new note, and a slot already holding an earlier change is untouched by the ' +
				'creation that followed it — delete the note by hand to take a creation back.',
		},
		{
			term: 'One at a time — except creating an item',
			text:
				'Every write that goes through the gate — a drag, a state or risk or tag or ' +
				'horizon change, the ✨ backfill, undo — is refused while another is already in ' +
				'flight, rather than queued behind it, and the toolbar\'s ✨ and undo go disabled ' +
				'to say so. Creating a new item does not go through that gate at all: the New ' +
				'button and the + stay live throughout, so a note can be created while a large ' +
				'batch elsewhere is still running.',
		},
		{
			term: 'A forward write never targets an excluded note',
			text:
				'A batch is refused whole if any write in it would touch a note the base excluded — ' +
				'better a change fails loudly than half-applies. Such a note renders only to keep the ' +
				"tree's shape: its state chip, if it has one, is static and unclickable, and there " +
				'is no Set type, no reparenting. Undo is the one exception — a batch being taken ' +
				'back was authorized when it was first written, before the note (perhaps) left the ' +
				'filter, so undo replays it without repeating this check.',
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

/** The manual, in the order the sidebar shows it. */
export function manualSections(): ManualSection[] {
	return [typesSection(), MOVING, CREATING, FINDING, WRITES, SETUP];
}
