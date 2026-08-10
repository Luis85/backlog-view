import { BacklogSettings, stateMenuValues } from './settings';
import { resolvedDeliverableStateKey, resolvedTestStateKey } from './optionalProperties';
import { ALL_TYPES, EXTRA_TYPES, LEVELS, MARKER_TYPES, TEST_LEVELS } from './typeVocabulary';
import { childTypeChoices, EXTRA_TYPE_RANK, folderForType, keepsTypeOnMove, LadderPosition, ladderFor } from './itemTypes';
import { readmeMarker } from './readmeMarker';
import { stampRows, stampRule, startedStates } from './readmeStamps';
import { andList, cell, code, list, yamlScalar } from './readmeText';
import { hasDateAxis, hasHorizonAxis } from './roadmap';
import { ORDER_SPACING } from './writePlan';

/**
 * The README this plugin writes into a backlog folder: what the notes are, which
 * frontmatter carries the hierarchy, and how to write one by hand.
 *
 * Pure text from configuration — it reads no vault and applies nothing, exactly as
 * `writePlan.ts` decides a change without making it. `storage/readmeFile.ts` puts the
 * bytes on disk.
 *
 * Everything it says about *this* backlog is derived rather than retyped: the type
 * table comes from `childTypeChoices`, the property names from the resolved settings,
 * the ranking step from `ORDER_SPACING`, the states from what the view offers. A
 * sentence stating a rule the code does not hold is the one defect this module can
 * ship, so nothing it can compute is written by hand.
 */

/**
 * Where one offered state came from. Three sources, because the table says so out
 * loud and two of them would be a lie about the vault: a declared state is
 * configuration, an observed one is a value some note carries, and the **offered**
 * one is neither — `stateMenuValues` appends a done value that nothing has used yet,
 * so that marking work done is always reachable.
 */
export type StateSource = 'declared' | 'observed' | 'offered';

/** One state the view offers, and where it came from. */
export interface StateEntry {
	value: string;
	source: StateSource;
}

/**
 * The states this view actually offers, which no single setting holds: the declared
 * workflow, or the observed values standing in for it when nothing is declared — plus
 * the values a declared workflow does not list but notes carry anyway, since
 * `boardColumns` mints a column for each of those and the state menus then offer them.
 */
export function readmeStates(settings: BacklogSettings, observedStates: string[]): StateEntry[] {
	const declared = settings.states.length > 0;
	const seen = new Set(observedStates.map((v) => v.toLowerCase()));
	const source = (value: string): StateSource =>
		declared ? 'declared' : seen.has(value.toLowerCase()) ? 'observed' : 'offered';
	const offered = stateMenuValues(settings, observedStates);
	const entries = offered.map((value) => ({ value, source: source(value) }));
	const known = new Set(offered.map((v) => v.toLowerCase()));
	for (const value of observedStates) {
		if (known.has(value.toLowerCase())) continue;
		known.add(value.toLowerCase());
		entries.push({ value, source: 'observed' });
	}
	return entries;
}

/** How the table names each source — the reader's question is "may I write this?". */
const SOURCE_LABEL: Record<StateSource, string> = {
	declared: 'Declared in the view',
	observed: 'Observed in these notes',
	offered: 'Offered so work can be marked done',
};

/**
 * Where a type sits on its ladder, for the two questions the type table asks.
 *
 * Which ladder is asked of `ladderFor` with no parent, so a name belonging to one ladder
 * alone answers for itself — which is every name this table has, since it iterates
 * declared types and the one rung both ladders share (`Task`) is the deepest of each, so
 * either answer gives it the same children.
 */
function position(typeName: string): LadderPosition {
	const ladder = ladderFor(typeName, null);
	const levelIndex = ladder.indexOf(typeName);
	if (levelIndex >= 0) return { levelIndex, effectiveLevelIndex: levelIndex, ladder, typeName };
	// An extra type is pinned; a marker occupies no rung at all, and `childTypeChoices`
	// answers it by name before any rank is consulted.
	return { levelIndex: -1, effectiveLevelIndex: EXTRA_TYPE_RANK, ladder, typeName };
}

/**
 * The heading the type table gets, and the name the rules section points at — spelled
 * once, because a cross-reference to a heading that was renamed is a reader sent looking
 * for a section this document does not have.
 */
const TYPES_HEADING = 'The item types';

/** The types a `typeName` item may hold, from the same rule the + button uses. */
const childrenOf = (typeName: string): string[] => childTypeChoices(position(typeName));

/**
 * The types that may hold a `typeName` item — inverted from `childrenOf` rather than
 * stated, so the two halves of the table cannot disagree with each other or with the
 * view.
 *
 * The root marker is UNCONDITIONAL, and that is a statement about the toolbar: it
 * iterates the whole vocabulary with no parent, so every declared type is root-creatable
 * and `childTypeChoices(null)` returns `ALL_TYPES`. This used to ask that question per
 * type. Once the answer became "always", the test was a branch nothing could take —
 * dead code wearing the look of a check, and the kind coverage is supposed to find. The
 * pairing it used to enforce at runtime is now pinned by two tests instead: one asserts
 * `childTypeChoices(null)` IS `ALL_TYPES`, the other that every row here carries the
 * marker. Narrowing that function again fails both rather than silently re-animating a
 * branch this table stopped drawing.
 */
function parentsOf(typeName: string): string[] {
	return ['*(nothing — it is a root)*', ...ALL_TYPES.filter((candidate) => childrenOf(candidate).includes(typeName))];
}


function typeSection(settings: BacklogSettings): string[] {
	const rows = ALL_TYPES.map((t) => `| ${cell(t)} | ${list(parentsOf(t))} | ${list(childrenOf(t))} |`);
	return [
		`## ${TYPES_HEADING}`,
		'',
		`${LEVELS.join(' → ')} is a ladder: each level holds the next one down. ` +
			`${andList(EXTRA_TYPES)} sit *beside* it — they hang from any rung above the ` +
			`deepest and hold ${code(LEVELS[LEVELS.length - 1])} items wherever they hang, which ` +
			'is why they are types rather than levels. ' +
			`${andList(MARKER_TYPES)} is neither: a ` +
			`marker hangs from nothing and holds nothing, and states a date rather than work. ` +
			`${TEST_LEVELS.slice(0, -1).join(' → ')} is a **second ladder**, for tests rather than ` +
			`for work: a ${code(TEST_LEVELS[0])} hangs from nothing, and the two ladders share only ` +
			`${code(LEVELS[LEVELS.length - 1])}, the rung at the bottom of each.`,
		'',
		'| Type | Parent may be | Children may be |',
		'| --- | --- | --- |',
		...rows,
		'',
		'Write the type exactly as spelled above; matching is case-insensitive but the ' +
			'spelling is the vocabulary. A type this plugin does not ship is kept as written and ' +
			'shown as itself.' +
			(settings.autoType
				? ' With one exception, and it belongs to this view: assigning types on a move ' +
					`rewrites what you drag into a **new parent**, a name of your own included. ` +
					`Reordering among siblings rewrites nothing, ` +
					`${andList(ALL_TYPES.filter(keepsTypeOnMove).map(code))} ` +
					'keep their type wherever they land, a move between the two ladders above rewrites ' +
					'nothing in either direction, and the same custom name deeper in the subtree you ' +
					'dragged is left alone.'
				: ' Nothing rewrites it into one of these.'),
	];
}

/**
 * The `Optional, on a <label>` row for a secondary workflow's own state key —
 * Deliverable's and the test workflow's are the identical shape, stated once rather than
 * copied a second time. Empty when there is no key of its own to name: unset, or shared
 * with the requirements property, in which case the row above already carries it.
 */
function ownWorkflowRow(key: string, shared: boolean, label: string, settings: BacklogSettings): string[] {
	if (!key || shared) return [];
	// NOT "the one above": that claim is false whenever `settings.stateKey` is unset, since
	// `fieldRows` then has no requirements-workflow row at all (and no `## Workflow states`
	// section either) — a fully independent, reachable configuration, and the one where
	// there is nothing to be separate FROM, so the relationship goes unstated rather than
	// invented.
	const relation = settings.stateKey ? " — separate from the requirements workflow's" : '';
	return [`| ${cell(key)} | Optional, on a ${label} | The ${label} workflow's own state${relation} |`];
}

function fieldRows(settings: BacklogSettings): string[] {
	// In folder mode the property is how you OVERRIDE the folder note above, so calling
	// it required would have an outside editor pin every note by hand and switch off the
	// inference this view was configured for — the same failure as `order` and `type`
	// read as mandatory, from the other direction.
	const parentOn = settings.folderHierarchy
		? 'Any item whose parent is not the folder note above it'
		: 'Every item except a root';
	const rows = [
		`| ${cell(settings.parentKey)} | ${parentOn} | A link to the parent note: ${code('"[[Note name]]"')}. Quote it, or YAML reads the brackets as a list. Present but empty means the top level |`,
		`| ${cell(settings.orderKey)} | Anything you want ranked | A number. The rank among the notes sharing a parent — see below. Without one an item sorts after the ranked ones |`,
		`| ${cell(settings.typeKey)} | Anything you want typed | One of the type names above, or one of your own. Without one an item takes the level its position implies |`,
	];
	// One property or two is decided by the resolved KEY, never by whether the Deliverable
	// option was filled in: the two workflows share a property both when the Deliverable
	// key is unset (the fallback) and when it is set to the requirements key on purpose —
	// the one collision `configProblems` exempts. Asking the raw option instead documented
	// that second, explicitly-shared configuration as two separate properties, and listed
	// the one key twice in a table of what a note may carry.
	const deliverableKey = resolvedDeliverableStateKey(settings);
	const sharedStateKey = deliverableKey !== '' && deliverableKey === settings.stateKey;
	// The test workflow shares by the same fallback, and by default it does — sharing the
	// requirements property is `resolvedTestStateKey`'s DEFAULT, not an edge case, so this
	// row has to be able to name it too rather than just the Deliverable.
	const testKey = resolvedTestStateKey(settings);
	const sharedTestKey = testKey !== '' && testKey === settings.stateKey;
	if (settings.stateKey) {
		const sharers = [
			...(sharedStateKey ? ["the Deliverable workflow's own state on a Deliverable"] : []),
			...(sharedTestKey ? ["the test workflow's own state on a test"] : []),
		];
		const alsoShared = sharers.length > 0 ? `, and ${andList(sharers)}` : '';
		rows.push(`| ${cell(settings.stateKey)} | Optional | The workflow state — see below${alsoShared} |`);
	}
	if (settings.tagsKey) rows.push(`| ${cell(settings.tagsKey)} | Optional | Tags, as a YAML list or one string |`);
	// The two the view WRITES for you. They belong in the contract for the reason every
	// other row does — a document that named only what a reader writes would leave two
	// keys appearing in these notes with nothing to explain them, and would make the
	// "only the properties above are written" rule below false.
	rows.push(...stampRows(settings));
	// The same gate the menu and the planner use: a horizon property with no values is an
	// axis nothing renders and nothing writes, and a row for it would advertise an inert key.
	if (hasHorizonAxis(settings)) rows.push(`| ${cell(settings.horizonKey)} | Optional | Which planning horizon the item sits in |`);
	if (settings.startKey) rows.push(`| ${cell(settings.startKey)} | Optional | Planned start, ${code('YYYY-MM-DD')} |`);
	if (settings.targetKey) rows.push(`| ${cell(settings.targetKey)} | Optional | Planned target, ${code('YYYY-MM-DD')} |`);
	// A row of its OWN only where it is its own property. Shared, the row above already
	// names this key and says it carries both — a second row for one key would be the
	// table contradicting itself about how many properties a note has. The test workflow's
	// key gets the identical treatment, for the identical reason.
	rows.push(...ownWorkflowRow(deliverableKey, sharedStateKey, 'Deliverable', settings));
	rows.push(...ownWorkflowRow(testKey, sharedTestKey, 'test', settings));
	return rows;
}

function propertySection(settings: BacklogSettings): string[] {
	return [
		'## The properties that carry the hierarchy',
		'',
		'These are the keys **this** backlog uses. They are configurable per view, so they ' +
			'are read out of the configuration rather than assumed.',
		'',
		'| Property | On | Holds |',
		'| --- | --- | --- |',
		...fieldRows(settings),
		'',
		`The parent link is read generously: ${code('"[[Note name]]"')}, a bare note name, an ` +
			`alias (${code('"[[Note name|what it reads as]]"')}) and a YAML list whose first entry ` +
			'is any of those all resolve to the same note. A link that resolves to nothing leaves ' +
			'the item where it is rather than dropping it. Numbers may be written as strings.',
		'',
		settings.folderHierarchy
			? `A key with **no value** — ${code(`${settings.parentKey}:`)} and nothing after it — is not ` +
				'the same as no key at all, and in this view the difference decides the tree: an ' +
				'empty value pins the note to the top level, while omitting the key lets the folder ' +
				'note above it become the parent. That is also what this plugin writes when it moves ' +
				'something to the top.'
			: `A key with **no value** — ${code(`${settings.parentKey}:`)} and nothing after it — reads ` +
				'as the top level, which is what this plugin writes when it moves something there. ' +
				'Omitting the key entirely means the same thing here.',
		'',
		// What enrols a note is stated once, at the top, and not restated here: two
		// paragraphs answering one question is how they came to disagree about folder mode.
		// What belongs here is the part that is about these keys.
		settings.hierarchyOnly
			? 'A **type of your own** is kept and shown, but it does not enrol a note that has no ' +
				'parent: only the types listed above are evidence on their own. Give such a note a ' +
				'parent, or it stays out of the tree.'
			: 'This view treats **every** note it returns as an item, so a note with none of these ' +
				'properties still appears, at the top level and untyped.',
	];
}

function rankingSection(settings: BacklogSettings): string[] {
	return [
		'## Ranking',
		'',
		`${code(settings.orderKey)} ranks an item among the notes that share its parent — lowest ` +
			`first. Nothing is global: the same number under two different parents is two ` +
			`unrelated ranks. The view writes them ${ORDER_SPACING} apart, leaving room to insert ` +
			'without renumbering, and renumbers a group only when a move needs it.',
		'',
		'Two siblings may end up sharing a number, and an item may carry none at all. Nothing ' +
			'breaks: the tie is settled by the order the base itself returned them in — whatever ' +
			'sort is configured in the Bases toolbar, file name by default — and items without a ' +
			'number sort last. That means the tie-break is a view setting rather than a property ' +
			'of these notes, so give siblings distinct numbers when writing by hand.',
	];
}

/**
 * The done values this workflow does not offer. Writing one still finishes an item —
 * `doneValues` is what the model matches, whatever the state list says — so a reader
 * whose workflow omits `Done` has to be told that writing it anyway means done.
 */
function unlistedDone(settings: BacklogSettings, states: StateEntry[]): string[] {
	const listed = new Set(states.map((s) => s.value.toLowerCase()));
	const missing = settings.doneValues.filter((v) => v && !listed.has(v.toLowerCase()));
	if (missing.length === 0) return [];
	return [
		'',
		`${missing.map(code).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not offered as ` +
			`${missing.length === 1 ? 'a state' : 'states'} here, but ${missing.length === 1 ? 'it counts' : 'they count'} ` +
			'as done wherever written: what makes an item finished is this list, not the workflow above.',
	];
}

function stateSection(settings: BacklogSettings, states: StateEntry[]): string[] {
	if (!settings.stateKey || states.length === 0) return [];
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	const rows = states.map(
		(s) => `| ${cell(s.value)} | ${done.has(s.value.toLowerCase()) ? 'Yes' : 'No'} | ${SOURCE_LABEL[s.source]} |`,
	);
	return [
		'## Workflow states',
		'',
		`${code(settings.stateKey)} holds the state. Matching is case-insensitive.`,
		'',
		'| State | Counts as done | Where it comes from |',
		'| --- | --- | --- |',
		...rows,
		'',
		states.some((s) => s.source !== 'declared')
			? 'The states marked observed are not configured anywhere — they are simply the values ' +
				'these notes carry, so a new one written here becomes a state this backlog has.'
			: 'These are the declared states. A value outside the list still shows, in a column of ' +
				'its own, so nothing is lost by writing one — it just sits outside the workflow.',
		// Done-matching runs against the configured values, not against the workflow, so a
		// value missing from the table above still finishes an item — silently, from the
		// reader's point of view, since nothing else here would have mentioned it.
		...unlistedDone(settings, states),
		...startedStates(settings, states.map((e) => e.value)),
	];
}

/**
 * Who writes the planning keys, named only where each can fire — the menu offers per
 * axis, so a horizon-only view has no Schedule and a dated one no Set horizon. Two are
 * not edits to an existing placement at all: **New** inside a bucket writes the horizon
 * into the note it creates, and the backfill leaves the keys empty without placing
 * anything, which is the only way one appears that a reader cannot trace to a placement.
 */
function planningWriters(settings: BacklogSettings): string {
	const actions = [
		...(hasHorizonAxis(settings) ? ['Set horizon and Clear horizon'] : []),
		...(hasDateAxis(settings) ? ['Schedule and Unschedule'] : []),
	];
	const horizons = hasHorizonAxis(settings);
	const writers = [
		`the view's own placement ${actions.length > 1 ? 'actions' : 'action'} — ${actions.join(', ')}, ` +
			'each writing or removing exactly the keys named here' +
			(horizons ? ', and the drag that does the same thing: a card moved into a bucket or onto the shelf' : ''),
		...(horizons
			? ['**New** inside a horizon on the roadmap, which writes that horizon into the note it creates, in the same write that creates it']
			: []),
		'**Assign missing properties**, which adds the keys *empty* to items that lack them and places nothing',
	];
	return `${writers.slice(0, -1).join('; ')}; and ${writers[writers.length - 1]}`;
}

function planningSection(settings: BacklogSettings): string[] {
	const lines: string[] = [];
	if (hasHorizonAxis(settings)) {
		lines.push(
			`${code(settings.horizonKey)} places an item in a planning horizon: ` +
				`${settings.horizonValues.map(code).join(', ')}. A value outside that list is not ` +
				'lost and not guessed at — it gets a horizon of its own, after the declared ones, ' +
				'the same way a state nobody declared still gets a column. What is set aside is an ' +
				'item with no value at all, or one written in a way the reader cannot make a ' +
				'horizon of.',
		);
	}
	// Either key alone is a configured axis — a milestone-only roadmap is coherent, and
	// `configuredAxes` says so — and a view with one would otherwise get no section at all.
	const dateKeys = [settings.startKey, settings.targetKey].filter(Boolean);
	if (dateKeys.length === 2) {
		lines.push(
			`${code(settings.startKey)} and ${code(settings.targetKey)} are the planned dates, ` +
				`written ${code('YYYY-MM-DD')}. An item stating only one of the two is drawn as a point ` +
				'on that date; a target earlier than its start is set aside rather than drawn backwards.',
		);
	} else if (dateKeys.length === 1) {
		lines.push(
			`${code(dateKeys[0])} is the planned date, written ${code('YYYY-MM-DD')}. It is the only ` +
				'date property configured here, so every item that states one is drawn as a ' +
				'point in time rather than as a span.',
		);
	}
	// Both sentences above describe a point reached by how many dates an item STATES, and a
	// marker is a point by TYPE — so they are wrong for one wherever the target key is not
	// the one configured. A `Milestone` handed the start property states a date this view
	// will never place it by, and the entry that would correct that is withheld for the same
	// reason, so the document would be promising a placement the projection contradicts.
	// Say which key a marker actually reads, in the one voice this file has.
	if (dateKeys.length > 0 && settings.targetKey === '') {
		lines.push(
			`A ${code(MARKER_TYPES[0])} is the exception, and this view cannot place one: a marker's ` +
				`date is the **target** property, and the only date property here is ` +
				`${code(settings.startKey)}. One waits, unplaced, until a target property is picked — ` +
				'and Schedule is withheld from it rather than opened onto a date its own type ignores.',
		);
	} else if (dateKeys.length === 2) {
		lines.push(
			`A ${code(MARKER_TYPES[0])} is the exception: it is a point by **type** rather than by how ` +
				`many dates it states, so it reads ${code(settings.targetKey)} alone. A ` +
				`${code(settings.startKey)} on one is ignored — never rewritten, and never removed.`,
		);
	}
	if (lines.length > 0) {
		lines.push(
			`These are a **plan**, and the only things that write them are you, ${planningWriters(settings)}. ` +
				'Nothing writes them as a side effect of a move in the **hierarchy**, a state change ' +
				'or a rename.',
		);
	}
	return lines.length > 0 ? ['## Planning', '', ...lines.flatMap((l) => [l, ''])].slice(0, -1) : [];
}

function filingSection(settings: BacklogSettings): string[] {
	const configured = ALL_TYPES.map((t) => ({ type: t, folder: folderForType(t, settings) })).filter((e) => e.folder);
	const rows = configured.map((e) => `| ${cell(e.type)} | ${cell(e.folder ?? '')} |`);
	return [
		'## Where notes are filed',
		'',
		settings.folderHierarchy
			? 'In this view folders are **also** hierarchy: a note that **omits** the parent ' +
				'property hangs from the nearest folder note above it, so moving such a note moves ' +
				'it in the tree. A note that names its parent is unaffected — the property always ' +
				'wins — and so is one carrying the key empty, which pins it to the top level ' +
				'instead of asking the folder. Either is the way to file a note anywhere and keep ' +
				'its place.' +
				// The inference runs over the notes this view LOADED, so a folder note the base
				// leaves out is a parent it cannot find. With "Show parents outside the filter"
				// on — the default — the ancestor is fetched from the vault and the promise above
				// holds whatever the filter says; with it off, nothing fetches it, and the note
				// draws where an unresolved link draws. Said only in the configuration where it
				// is true, and about the drawing rather than the notes: the folder tree is
				// unchanged, and so is what every other reader of these notes makes of it.
				(settings.showOutsideParents
					? ''
					: ' One limit, and it is this view\'s rather than these notes\': the folder note ' +
						'has to be one this base returns, since **Show parents outside the filter** is ' +
						'off here. Where it is not returned there is nothing to hang from and the note ' +
						'is drawn at the top level, exactly as an unresolved parent link is — its place ' +
						'in the folder tree unchanged, and read as written by anything else.') +
				' Below is where this view puts a note it creates, in this order:'
			: 'Folders are filing, not hierarchy: the tree comes from the properties above, so a ' +
				'note is in the right place wherever it lives. What follows is only where **this** ' +
				'view puts a note it creates, in this order:',
		'',
		...(settings.folderHierarchy
			? [
					'1. Beside the parent\'s folder note — this view infers hierarchy from folders, ' +
						'so that placement is meaningful here. Skipped when the parent is a note the ' +
						'view is showing from outside its own filter.',
				]
			: []),
		`${settings.folderHierarchy ? '2' : '1'}. The folder configured for the type, when it has one.`,
		`${settings.folderHierarchy ? '3' : '2'}. ${settings.homeFolder ? `The home folder, ${code(settings.homeFolder)}.` : 'The home folder, which is not configured here.'}`,
		`${settings.folderHierarchy ? '4' : '3'}. Wherever most of the existing items already live.`,
		...(rows.length > 0 ? ['', '| Type | Folder |', '| --- | --- |', ...rows] : []),
	];
}

function exampleSection(settings: BacklogSettings, states: StateEntry[]): string[] {
	const feature = LEVELS[Math.min(1, LEVELS.length - 1)];
	const child = LEVELS[Math.min(2, LEVELS.length - 1)];
	// Keys are configurable and therefore user data too: one containing a colon would
	// turn the line a reader copies into a different mapping, or into nothing valid.
	const entry = (key: string, value: string): string => `${yamlScalar(key)}: ${value}`;
	const lines = [
		'---',
		entry(settings.typeKey, child),
		entry(settings.parentKey, '"[[Checkout redesign]]"'),
		entry(settings.orderKey, String(ORDER_SPACING * 2)),
	];
	if (settings.stateKey && states.length > 0) lines.push(entry(settings.stateKey, yamlScalar(states[0].value)));
	lines.push('---', '', `# Pay with a saved card`, '', 'Whatever the note is about.');
	return [
		'## A note, written by hand',
		'',
		`A ${code(child)} under a ${code(feature)} called *Checkout redesign*, ranked ` +
			`${ORDER_SPACING * 2} — after every sibling ranked below that and before every sibling ` +
			'above it, which is all a number here ever means. Nothing else is needed: the view ' +
			'fills in what it writes itself.',
		'',
		'```markdown',
		...lines,
		'```',
	];
}

function rulesSection(settings: BacklogSettings): string[] {
	return [
		'## What the view will and will not do to these notes',
		'',
		'- **The type rules are advisory.** They decide what the view *offers*; nothing is ' +
			`refused, and a type you declare is the type you keep: a ${code(LEVELS[LEVELS.length - 1])} ` +
			`under an ${code(LEVELS[0])} stays one, at its own level, however oddly it sits. Only a ` +
			'note with **no** type takes the level its position implies, and a type this plugin ' +
			'does not ship sits one rung below its parent so its own children continue the ladder.' +
			// Which moves rewrite a type, and which types are exempt, is stated once — under
			// the type table, where the vocabulary it qualifies is. Said again here it would
			// be a second sentence to keep true, and this is the bullet that would drift:
			// "a move re-types what it moves" is wrong for a reorder and wrong for a Bug.
			`${settings.autoType ? ` A move into a new parent is the one thing that rewrites a type — **${TYPES_HEADING}** above says which moves, and which types it leaves alone.` : ' Moving a note never rewrites its type.'}`,
		'- **Only the properties above are written.** Prose, headings and any other frontmatter ' +
			'are left alone.',
		'- **Levels, progress and board position are derived, never stored.** Do not write them ' +
			'back: they are computed from the properties above every time the view opens.',
		'- **A note nothing links to is still a note.** An unresolved parent leaves the item at ' +
			'the top level rather than hiding it.',
		...stampRule(settings),
	];
}

/**
 * What makes a note here an item. In folder mode the answer is not the properties
 * alone: `inferFolderParent` gives a propertyless note the folder note above it as a
 * parent, and that parent is the hierarchy evidence `pruneOutsideHierarchy` keeps it
 * for — so "the folder does not make it one" is exactly false in the configuration
 * where position IS hierarchy, and would tell a reader their new note stays out of a
 * backlog it has already joined.
 */
function openingScope(settings: BacklogSettings): string {
	if (!settings.hierarchyOnly)
		return 'Every note this view returns is a work item, whether or not it carries the ' + 'properties below — that is how this view is configured. ';
	// Two facts, both easy to get backwards: only a TYPE or a PARENT enrols — an order or
	// a state is not evidence of anything — and the test runs per root subtree, so an
	// untyped note holding a typed one is kept as that subtree's root.
	return (
		'A note here is a work item when it names one of the types below, or carries the ' +
		'parent property — naming one, or left empty to say it is a root' +
		(settings.folderHierarchy
			? ' — or sits under a folder note, which this view reads as its parent'
			: ', and the folder does not make it one') +
		'. The other properties do not enrol it: a note carrying only an order or a state is ' +
		'still an ordinary note. Nor is the question asked one note at a time — a note that ' +
		'holds a work item is kept with it, so an untyped page grouping typed ones stays. '
	);
}

/** Where the hierarchy is kept — the same question, and the same folder-mode answer. */
function openingHierarchy(settings: BacklogSettings): string {
	const plain =
		'They stay plain markdown, so they can be read, written and reviewed in any editor, ' +
		'with or without Obsidian and the Product Backlog view that generated this file.';
	return settings.folderHierarchy
		? 'The hierarchy between the items lives in frontmatter and, in this view, in the ' +
				'folders beside it: a note naming its parent is placed by that property, and one ' +
				`that omits the key hangs from the nearest folder note above it. ${plain}`
		: `The hierarchy between the items lives in frontmatter rather than in folders, on purpose. ${plain}`;
}

/**
 * The whole document. Deterministic in its inputs — same settings and states in, same
 * bytes out — so a regeneration that changes nothing can be recognized as a no-op and
 * a repository gets no diff for running the command twice.
 */
export function backlogReadmeContent(settings: BacklogSettings, observedStates: string[], source: string): string {
	const states = readmeStates(settings, observedStates);
	const sections = [
		[
			readmeMarker(source),
			'',
			'# This folder is a product backlog',
			'',
			openingScope(settings) + openingHierarchy(settings),
			'',
			'This document is generated from that view\'s configuration, so the property names ' +
				'below are the ones this backlog actually uses.',
		],
		typeSection(settings),
		propertySection(settings),
		rankingSection(settings),
		stateSection(settings, states),
		planningSection(settings),
		filingSection(settings),
		exampleSection(settings, states),
		rulesSection(settings),
	].filter((s) => s.length > 0);
	return sections.map((s) => s.join('\n')).join('\n\n') + '\n';
}
