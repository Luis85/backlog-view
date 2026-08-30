import { ManualSection } from '../../ui/manualDialog';
import { EXTRA_TYPES } from '../../domain/typeVocabulary';
import { SETUP } from './setupSection';
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
			term: 'To the top level',
			text:
				'Outdent — Alt+Left, or the context menu — makes a row a sibling of its own parent, ' +
				'so a depth-one row becomes top-level, and it climbs one level at a time, so a ' +
				'deeply nested row takes several. A drag can also do it, but only onto a place: ' +
				'dropping a row just above or below one that is already top-level puts it there ' +
				'too. What does nothing is a drop on the empty space below the last row — making an ' +
				'item top-level is a deliberate action rather than one a released drag can mean by ' +
				'accident.',
		},
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
				'One number ranking every note this base returns, maintained by the view — not a ' +
				'number scoped to one parent. A drop between two rows takes a value between ' +
				'theirs, so it writes that one note and leaves its neighbours the numbers they ' +
				'had. Missing orders sort last, in whatever order the Base itself returned them.',
		},
		{
			term: 'A move does not re-type',
			text:
				'A drop, an indent, an outdent and Clear parent link all write the parent and the ' +
				'order and nothing else. A type is only ever what the note says or what Set type ' +
				'wrote; where a note carries none, its level is read from where it hangs.',
		},
		{
			term: 'When a drop is unavailable',
			text:
				'A row refuses a drop onto itself or into its own descendants. A between-drop ' +
				'(before or after a row) is also unavailable wherever the hovered row\'s own ' +
				'neighbours are not all on screen, since ranking against rows the view is not ' +
				'showing would be a guess: onto a row loaded only as an excluded parent, and onto a ' +
				'row this projection pulled up to the top because its real parent belongs to the ' +
				'other one — a test whose work item is on the plan. The ' +
				'same rule governs Move up, Move down, Move to top, Move to bottom and Outdent from ' +
				'the menu or Alt+arrow. Dropping into a parent stays available in every one of those ' +
				'cases, since landing last is what it means anyway — and so does Indent, except on a ' +
				'focus row: dropping between two of those ranks them against each other, which is ' +
				'what a focus level is for, while nesting one under another is a question about ' +
				'parentage that the rung above is not on screen to answer. ' +
				'One further case is about which screen a row is on rather than about ranking: ' +
				'a Task, or a note with no type, takes the level of whatever it hangs from, so moving ' +
				'one between the plan and the test catalog would take it off the screen it was moved ' +
				'on. Every move that could do that is unavailable — dropping it beside a row at the top ' +
				'level, Outdent, and the two menu entries that remove the parent ' +
				'link, Clear parent link and Use folder position — while every other type keeps its ' +
				'own ladder wherever it lands and is refused none of them. Indent is not among them: ' +
				'it nests under the row above, which is on this screen already.',
		},
		{
			term: 'When there is no number to give',
			text:
				'A drop the view accepted can still be refused once it is planned, and says so: ' +
				'the two rows it landed between hold the same rank, or the gap between them has ' +
				'been used up, or one of them has no rank at all. The message names the remedy — ' +
				'Seed ranks from the hierarchy, or Respace ranks, both in the command palette, or ' +
				"the toolbar's set-up button for the missing ranks. The menu and Alt+arrow ask the " +
				'same question before they offer a move, so there the entry is simply absent.',
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
				`extra type (${EXTRA_TYPES.join(', ')}), whose own children are always the deepest ` +
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
				`every extra type (${EXTRA_TYPES.join(', ')}) alongside that rung's own items; ` +
				'focusing an extra type by name matches only that one type. It is working position, ' +
				'remembered per view per device, and never written to the base.',
		},
		{
			term: 'Searching',
			text:
				"Use the Base's own search: it narrows the results this view is given, and the " +
				'ancestors a narrowed result needs are loaded around it, so a search still reads as ' +
				'a tree rather than a flat list. A shelf — the roadmap\'s unplaced band, or an ' +
				'iteration board\'s uncommitted one — has a search of its own, scoped to the ' +
				'untriaged work beside it.',
		},
		{
			term: 'Show completed items',
			text: 'When off, a subtree that is entirely done is hidden.',
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
				'Four causes, each with its own one-press fix. Focused on a type nothing matches — ' +
				'the rest of the backlog is untouched elsewhere (switch focus back to "All types", ' +
				'or create one). Unfocused: the Base returned nothing (point its filter at the ' +
				'backlog folder), or returned only ignored notes (turn off Ignore notes outside the ' +
				'hierarchy, per the count above). With items present: every subtree done ' +
				'(Show completed items).',
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
				'unconfigured key is never written to; nothing invents a value for one. ' +
				'Depends-on is the one property that can name itself: drawing or picking a ' +
				'dependency binds it first, and says so, unless you have cleared it.',
		},
		{
			term: 'A change is one batch',
			text:
				'A backfill that ranks sixty notes is a single change, and Ctrl or Cmd with Z, or ' +
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


/** The manual, in the order the sidebar shows it. */
export function manualSections(): ManualSection[] {
	return [typesSection(), MOVING, CREATING, FINDING, WRITES, SETUP];
}
