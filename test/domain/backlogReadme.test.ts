import { describe, expect, it } from 'vitest';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { backlogReadmeContent, readmeStates } from '../../src/domain/backlogReadme';
import { ALL_TYPES } from '../../src/domain/typeVocabulary';
import { ORDER_SPACING } from '../../src/domain/writePlan';

/**
 * The generated README is documentation the plugin promises is true, so these tests
 * ask what it SAYS rather than how it is built: every type explained, every key the
 * one this view uses, every state the view actually offers.
 */

/** Which view generated the document — the identity its marker carries. */
const SOURCE = 'work/Product Backlog.base › Backlog';
const readme = (settings: BacklogSettings, observed: string[] = []): string =>
	backlogReadmeContent(settings, observed, SOURCE);

/** The row of the type table for one type — the table is the contract, so rows are read whole. */
function typeRow(content: string, typeName: string): string {
	const row = content.split('\n').find((line) => line.startsWith(`| \`${typeName}\` |`));
	if (!row) throw new Error(`no table row for ${typeName}`);
	return row;
}

describe('backlogReadmeContent', () => {
	it('explains every type in the vocabulary', () => {
		const content = readme(settingsWith(), []);
		for (const type of ALL_TYPES) expect(typeRow(content, type)).toContain(type);
	});

	it('names each category as a list a person would write, at one name and at three', () => {
		const content = readme(settingsWith(), []);
		// The prose above the table names two categories whose lengths are `settings.ts`'s
		// business, and joining either with ` and ` between every pair reads as English
		// only at two: three shipped "Issue and Bug and Idea", and there are four now that
		// `Idea` and `Deliverable` were merged into one vocabulary. Both lengths are
		// asserted because both have a live caller — the one-name form is the markers'
		// today, and it is the arm that would otherwise be reachable code nothing checks.
		expect(content).toContain('Issue, Bug, Idea and Deliverable sit *beside* it');
		expect(content).toContain('Milestone is neither');
		expect(content).not.toContain('and Bug and');
	});

	it('reads the type table off childTypeChoices, not off the ladder', () => {
		const content = readme(settingsWith(), []);
		// The clamp at the deepest rung: a Task holds a Task, which the ladder read
		// literally would deny — and the + button on the row would then contradict it.
		expect(typeRow(content, 'Task')).toContain('| `Task` |');
		// An extra type hangs from any rung above the deepest and holds the deepest — the
		// root marker leads the cell, since it may also hang from nothing.
		expect(typeRow(content, 'Bug')).toMatch(/\| \*\(nothing — it is a root\)\*, `Epic`, `Feature`, `PBI` \| `Task` \|/);
		// EVERY declared type reads as a root, because the toolbar creates any of them with
		// no parent. Asked of the whole vocabulary rather than of Epic: the marker is
		// derived from `childTypeChoices(null)`, so a branch that narrowed again would put
		// a false parent requirement into the README this plugin writes into a vault.
		for (const type of ALL_TYPES) expect(typeRow(content, type)).toContain('*(nothing — it is a root)*');
	});

	it('names the keys this view uses, not the shipped defaults', () => {
		const content = readme(settingsWith({ parentKey: 'up', orderKey: 'rank', typeKey: 'kind' }), []);
		expect(content).toContain('| `up` |');
		expect(content).toContain('| `rank` |');
		expect(content).toContain('| `kind` |');
		expect(content).not.toContain('| `parent` |');
		// The example is written in the same keys, or it would teach what the table denies.
		expect(content).toContain('up: "[[Checkout redesign]]"');
		expect(content).toContain('kind: PBI');
	});

	it('documents the tags property when one is configured, and not when it is off', () => {
		expect(readme(settingsWith({ tagsKey: 'labels' }), [])).toContain('| `labels` |');
		expect(readme(settingsWith({ tagsKey: '' }), [])).not.toContain('Tags, as a YAML list');
	});

	it('lists Deliverable in the type section, and does not claim only extras can root', () => {
		const content = backlogReadmeContent(defaultSettings(), [], 'test');
		expect(content).toContain('Deliverable');
		// A Feature/PBI/Task can also be created with no parent (the toolbar's top-level
		// creator draws no line anywhere in ALL_TYPES) — the prose must not say otherwise.
		expect(content).not.toMatch(/only.*(root|no parent)/i);
	});

	it('states the ranking step the planner actually uses', () => {
		expect(readme(settingsWith(), [])).toContain(`${ORDER_SPACING} apart`);
	});

	it('omits the sections whose properties are unset', () => {
		const bare = readme(settingsWith({ stateKey: '', horizonKey: '', startKey: '', targetKey: '' }), ['Doing']);
		expect(bare).not.toContain('## Workflow states');
		expect(bare).not.toContain('## Planning');
	});

	it('describes the horizon and date axes when they are configured', () => {
		const content = readme(
			settingsWith({ horizonKey: 'horizon', horizonValues: ['Now', 'Later'], startKey: 'start', targetKey: 'due' }),
			[],
		);
		expect(content).toContain('## Planning');
		expect(content).toContain('`Now`, `Later`');
		expect(content).toContain('`start`');
		expect(content).toContain('`due`');
	});

	it('names a done value the workflow does not offer, because writing it still finishes an item', () => {
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Active'], doneValues: ['Done', 'Closed'] }),
			[],
		);
		expect(content).toContain('`Done`, `Closed` are not offered as states here');
		expect(content).toContain('what makes an item finished is this list, not the workflow above');
	});

	it('says nothing about unlisted done values when the workflow lists them all', () => {
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Done'], doneValues: ['Done'] }),
			[],
		);
		expect(content).not.toContain('not offered as');
	});

	it('does not call the planning properties read-only, because the row menu writes them', () => {
		const content = readme(settingsWith({ startKey: 'start', targetKey: 'due' }), []);
		expect(content).toContain('Schedule and Unschedule');
		expect(content).not.toContain('writes neither');
	});

	it('names only the placement actions this view offers', () => {
		// The row menu gates the two groups on the two axis predicates, so a document that
		// listed both would send a dated view looking for a Set horizon it does not have.
		const dated = readme(settingsWith({ startKey: 'start', targetKey: 'due', horizonKey: '' }), []);
		expect(dated).toContain('placement action — Schedule and Unschedule');
		expect(dated).not.toContain('Set horizon');
		const horizons = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: '', targetKey: '' }));
		expect(horizons).toContain('placement action — Set horizon and Clear horizon');
		expect(horizons).not.toContain('Unschedule');
		const both = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: 'start', targetKey: 'due' }));
		expect(both).toContain('placement actions — Set horizon and Clear horizon, Schedule and Unschedule');
	});

	it('describes the timeline when only one date property is configured', () => {
		// Either key alone is a configured axis, so a view with one must not be told it
		// has no roadmap at all.
		const content = readme(settingsWith({ startKey: '', targetKey: 'due', horizonKey: '' }), []);
		expect(content).toContain('## Planning');
		expect(content).toContain('`due` is the planned date');
		expect(content).toContain('drawn as a point in time');
		// A target-only view places a marker perfectly well, so it earns no exception.
		expect(content).not.toContain('this view cannot place one');
	});

	it('tells a start-only view it cannot place a marker at all', () => {
		// The generated document is a contract with editors outside Obsidian, and the
		// sentences above describe a point reached by how many dates an item STATES. A
		// marker is a point by TYPE: `placeMarker` reads the target key alone, so here it
		// shelves whatever it states — and `canSchedule` withholds the entry that would fix
		// it. Left unsaid, the README tells a user to write the one date it documents and
		// the milestone stays unplaced with no control offered to correct it.
		const startOnly = readme(settingsWith({ startKey: 'start', targetKey: '', horizonKey: '' }), []);
		expect(startOnly).toContain('`Milestone` is the exception, and this view cannot place one');
		expect(startOnly).toContain('the only date property here is `start`');
	});

	it('does not advertise a horizon property whose values have been cleared', () => {
		// Same gate the menu and the planner use: a horizon key with no values is an axis
		// nothing renders and nothing writes, so a row for it would name an inert key.
		const inert = readme(settingsWith({ horizonKey: 'horizon', horizonValues: [] }), []);
		expect(inert).not.toContain('`horizon`');
		expect(inert).not.toContain('## Planning');

		const live = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }), []);
		expect(live).toContain('| `horizon` | Optional |');
	});

	it('says an undeclared horizon gets its own bucket rather than being shelved', () => {
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }), []);
		expect(content).toContain('it gets a horizon of its own, after the declared ones');
	});

	it('warns that a folder move is a hierarchy move in folder mode, and not otherwise', () => {
		const folderMode = readme(settingsWith({ folderHierarchy: true }), []);
		expect(folderMode).toContain('moving such a note moves it in the tree');
		expect(folderMode).toContain('the property always wins');
		expect(readme(settingsWith({ folderHierarchy: false }), [])).toContain(
			'Folders are filing, not hierarchy',
		);
	});

	it('marks a declared workflow as declared and observed values as observed', () => {
		const declared = readme(settingsWith({ stateKey: 'status', states: ['Todo', 'Done'] }), []);
		expect(declared).toContain('| `Todo` | No | Declared in the view |');
		expect(declared).toContain('| `Done` | Yes | Declared in the view |');

		const observed = readme(settingsWith({ stateKey: 'status', states: [] }), ['Doing']);
		expect(observed).toContain('| `Doing` | No | Observed in these notes |');
	});

	it('lists a stray value a declared workflow does not name, because the board still offers it', () => {
		const content = readme(settingsWith({ stateKey: 'status', states: ['Todo'] }), ['Blocked']);
		expect(content).toContain('| `Blocked` | No | Observed in these notes |');
	});

	it('does not claim a done value nothing carries was observed', () => {
		// With no workflow declared, the menus append a done value so finishing work is
		// reachable. Calling that observed would be a statement about the vault, and false.
		const content = readme(settingsWith({ stateKey: 'status', states: [], doneValues: ['Done'] }), ['Doing']);
		expect(content).toContain('| `Doing` | No | Observed in these notes |');
		expect(content).toContain('| `Done` | Yes | Offered so work can be marked done |');
	});

	it('quotes a state in the example when writing it bare would change what it means', () => {
		const yamlHostile = readme(settingsWith({ stateKey: 'status', states: ['Needs: review'] }), []);
		expect(yamlHostile).toContain('status: "Needs: review"');
		// A plain value stays plain — the example is meant to read as the notes do.
		expect(readme(settingsWith({ stateKey: 'status', states: ['Todo'] }), [])).toContain('status: Todo');
	});

	it('escapes a line break in the example rather than emitting it', () => {
		// Quoting is not escaping: YAML folds a literal break inside a double-quoted
		// scalar, so the key a reader copies would not be the key this view reads.
		const content = readme(settingsWith({ typeKey: 'kind\nof', stateKey: 'status', states: ['a\tb'] }));
		expect(content).toContain('"kind\\nof": PBI');
		expect(content).toContain('status: "a\\tb"');
		expect(content.split('```markdown')[1].split('```')[0]).not.toMatch(/[\t]/);
	});

	it('quotes a configured key in the example for the same reason', () => {
		const content = readme(settingsWith({ typeKey: 'kind: of' }), []);
		expect(content).toContain('"kind: of": PBI');
	});

	it('keeps a value with markdown syntax inside the cell and the span it belongs to', () => {
		// A pipe ends a table cell whatever it sits in, code span included; a backtick
		// closes the span. Both are legal in a property name, a state and a folder.
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Waiting | external'], parentKey: 'up`link' }),
			[],
		);
		expect(content).toContain('| `Waiting \\| external` |');
		expect(content).toContain('``up`link``');
	});

	it('keeps a value the cell escaping cannot protect readable AND intact', () => {
		// A backslash before a pipe defeats the backslash escape, so the row quotes the
		// value as HTML instead — the value as configured, and a row a parser still reads
		// as three cells. The rule itself is `readmeText.ts`; this is that it is reached.
		const content = readme(settingsWith({ stateKey: 'status', states: ['Waiting \\| external'] }), []);
		expect(content).toContain('| <code>Waiting \\&#124; external</code> | No |');
		const row = content.split('\n').find((line) => line.includes('Waiting')) ?? '';
		expect(row.split('|')).toHaveLength(5);
	});

	it('documents the empty parent value, and what it means in folder mode', () => {
		// The plugin writes an empty value to move an item to the top level, and folder
		// mode reads an ABSENT key as "infer from the folder note" — so an outside editor
		// deleting the key gets a different tree from the one the plugin would write.
		const folderMode = readme(settingsWith({ folderHierarchy: true }), []);
		expect(folderMode).toContain('is not the same as no key at all');
		expect(folderMode).toContain('an empty value pins the note to the top level');
		expect(readme(settingsWith({ folderHierarchy: false }), [])).toContain(
			'Omitting the key entirely means the same thing here',
		);
	});

	it('does not tell a folder-mode reader that the folder cannot enrol a note', () => {
		// There a propertyless note under a folder note gets that folder note as its parent,
		// which is the hierarchy evidence the scope rule keeps it for — so "the folder does
		// not make it one" is false in exactly the mode where position IS hierarchy.
		const folderMode = readme(settingsWith({ hierarchyOnly: true, folderHierarchy: true }), []);
		expect(folderMode).not.toContain('the folder does not make it one');
		expect(folderMode).toContain('or sits under a folder note, which this view reads as its parent');
		expect(folderMode).toContain('in the folders beside it');

		const flat = readme(settingsWith({ hierarchyOnly: true, folderHierarchy: false }), []);
		expect(flat).toContain('the folder does not make it one');
		expect(flat).toContain('lives in frontmatter rather than in folders');
	});

	it('opens with the scope this view is actually configured for', () => {
		// Both directions: the opening and the scope paragraph further down are one claim
		// said twice, and a reader acting on a wrong opening files a meeting note as backlog.
		const scoped = readme(settingsWith({ hierarchyOnly: true }), []);
		expect(scoped).not.toContain('Every note here is one work item');
		expect(scoped).toContain('a note carrying only an order or a state is still an ordinary note');

		const unscoped = readme(settingsWith({ hierarchyOnly: false }), []);
		expect(unscoped).toContain('Every note this view returns is a work item');
		expect(unscoped).not.toContain('stay ordinary notes');
	});

	it('states the enrolment predicate the model actually applies', () => {
		// Wrong in both directions before: an order or a state is no evidence at all, and
		// the test runs per root subtree, so an untyped note holding a typed one is kept.
		const content = readme(settingsWith({ hierarchyOnly: true }));
		expect(content).toContain('carries the parent property — naming one, or left empty to say it is a root');
		expect(content).toContain('a note carrying only an order or a state is still an ordinary note');
		expect(content).toContain('a note that holds a work item is kept with it');
	});

	it('names the roadmap drag among the things that write a horizon', () => {
		// performHorizonMove applies computeHorizonWrites, so a card dropped into a bucket
		// writes the key — and "nothing writes them as a side effect of a move" was read as
		// covering the roadmap's primary interaction.
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }));
		expect(content).toContain('a card moved into a bucket or onto the shelf');
		expect(content).toContain('a move in the **hierarchy**');
	});

	it('names a stamp key nothing can stamp, because the backfill still creates it', () => {
		// startedStates empty is the default: missingKeyStubs stubs every configured key, so
		// omitting the row left the view creating one the document never mentions.
		const inert = readme(settingsWith({ stateKey: 'status', startedDateKey: 'started', startedStates: [] }));
		expect(inert).toContain('| `started` | Yours to fill |');
		expect(inert).toContain('which nothing in this view stamps');
		// And with no state property at all, the finish is in the same position.
		const noState = readme(settingsWith({ stateKey: '', finishedDateKey: 'finished' }));
		expect(noState).toContain('| `finished` | Yours to fill |');
	});

	it('names the backfill among the things that write a stamp key', () => {
		// missingKeyStubs covers the stamp fields too: the keys appear empty, with no state
		// transition anywhere, and the rule said a state change is what writes them.
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Done'], startedStates: ['Todo'], startedDateKey: 'started' }),
		);
		expect(content).toContain('the one way one appears without a state change');
	});

	it('names the backfill among the things that write a planning key', () => {
		// computeInitWrites adds the axis keys EMPTY to items that lack them, so a claim
		// that only the user and the placement actions write them leaves a reader unable to
		// explain a key the view created.
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }));
		expect(content).toContain('**Assign missing properties**');
		expect(content).toContain('adds the keys *empty* to items that lack them and places nothing');
	});

	it('says a folder note the base leaves out cannot be a parent, where that is true', () => {
		// Inference walks the notes this view LOADED. With outside parents on, the ancestor
		// is fetched from the vault and the promise holds whatever the filter says; with it
		// off, the child is drawn as a root — so the unconditional sentence is wrong in
		// exactly one configuration, and the caveat belongs only there.
		const hidden = readme(settingsWith({ folderHierarchy: true, showOutsideParents: false }));
		expect(hidden).toContain('the folder note has to be one this base returns');
		expect(hidden).toContain('drawn at the top level, exactly as an unresolved parent link is');

		const loaded = readme(settingsWith({ folderHierarchy: true, showOutsideParents: true }));
		expect(loaded).not.toContain('has to be one this base returns');
	});

	it('names creating in a bucket among the things that write a horizon', () => {
		// The roadmap's buckets carry a New button, and `createBacklogItem` puts the
		// bucket's value in the frontmatter it writes — a planning key on a note nobody
		// ever placed, which a list of writers made only of the placement actions and the
		// backfill leaves a reader unable to explain.
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: '', targetKey: '' }));
		expect(content).toContain('**New** inside a horizon on the roadmap');
		expect(content).toContain('in the same write that creates it');
	});

	it('does not claim creation writes a date, in a view with no horizons', () => {
		// Only a bucket creates in place: the dated axis is read-only, and nothing puts a
		// planned date on a note the view creates.
		const dated = readme(settingsWith({ horizonKey: '', startKey: 'start', targetKey: 'due' }));
		expect(dated).toContain('Schedule and Unschedule');
		expect(dated).not.toContain('**New** inside a horizon');
	});

	it('applies folder inference to an omitted parent key, not an empty one', () => {
		// An empty key is `explicitRoot`: the model deliberately skips inference for it, so
		// grouping it with "does not name a parent" would have a reader expect a pinned root
		// to be nested under the folder note above it.
		const content = readme(settingsWith({ folderHierarchy: true }));
		expect(content).toContain('a note that **omits** the parent property hangs');
		expect(content).toContain('one carrying the key empty, which pins it to the top level');
		expect(content).toContain('that omits the key hangs from the nearest folder note');
	});

	it('names the empty parent key as enrolment evidence too', () => {
		// `parent:` with nothing after it is the top-level marker, and pruneOutsideHierarchy
		// counts it: a predicate that only admitted a named parent would tell a reader their
		// explicit root stays an ordinary note.
		expect(readme(settingsWith({ hierarchyOnly: true }))).toContain('or left empty to say it is a root');
	});

	it('says the stamps follow what the view was asked to do, not the property', () => {
		// computeStateWrites runs from the view's own state interactions: editing the
		// frontmatter elsewhere stamps nothing, and a reader promised history would wait
		// for dates that never arrive.
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Doing', 'Done'], startedStates: ['Doing'], startedDateKey: 'started', finishedDateKey: 'finished' }),
		);
		expect(content).toContain('changed **in the view**');
		expect(content).toContain('Editing the state property directly, here or in any other editor, stamps nothing');
	});

	it('does not require an order or a type on every item', () => {
		// A note enrolled by its parent alone is legal: a missing order sorts last and a
		// missing type takes the position's level, so "every item" would have an outside
		// editor add metadata the model never asked for.
		const content = readme(settingsWith(), []);
		expect(content).toContain('Without one an item sorts after the ranked ones');
		expect(content).toContain('Without one an item takes the level its position implies');
		expect(content).toContain('or one of your own');
	});

	it('names the dates a state change stamps, and says a state change is what writes them', () => {
		// The view writes these two itself, so a contract that omitted them would leave an
		// outside editor two unexplained keys and would make its own "only the properties
		// above are written" rule false.
		const stamping = readme(
			settingsWith({
				stateKey: 'status',
				states: ['Todo', 'Active', 'Done'],
				startedStates: ['Active'],
				startedDateKey: 'started',
				finishedDateKey: 'finished',
			}),
			[],
		);
		expect(stamping).toContain('| `started` | Stamped by the view |');
		expect(stamping).toContain('| `finished` | Stamped by the view |');
		expect(stamping).toContain('written for you, by a state change');
		expect(stamping).toContain('only into an empty property');
		expect(stamping).toContain('leaving one removes it again');
		// And WHICH states start the clock. Done values are named in the table; started
		// ones are named nowhere else, so writing `Active` would put a date on a note for
		// reasons the document never gave.
		expect(stamping).toContain('Work counts as **started** at `Active`');
	});

	it('names a started state the workflow does not offer', () => {
		// The stamp matches the configured list, not the table — the same asymmetry the
		// done values have, and the same silence if it goes unsaid.
		const content = readme(
			settingsWith({
				stateKey: 'status',
				states: ['Todo', 'Done'],
				startedStates: ['Doing'],
				startedDateKey: 'started',
			}),
			[],
		);
		expect(content).toContain('Work counts as **started** at `Doing`');
		expect(content).toContain('is not offered as a state here, and still counts');
	});

	it('does not claim a state change writes a stamp key nothing can stamp', () => {
		// The key is still NAMED — the backfill creates it — but the rule that says a state
		// change writes it must not fire for a stamp no state can reach.
		const noStartedStates = readme(
			settingsWith({ stateKey: 'status', startedStates: [], startedDateKey: 'started', finishedDateKey: 'finished' }),
			[],
		);
		expect(noStartedStates).toContain('| `started` | Yours to fill |');
		expect(noStartedStates).toContain('| `finished` | Stamped by the view |');
		expect(noStartedStates).not.toContain('only into an empty property');

		const noState = readme(
			settingsWith({ stateKey: '', startedStates: ['Active'], startedDateKey: 'started', finishedDateKey: 'finished' }),
			[],
		);
		expect(noState).toContain('| `started` | Yours to fill |');
		expect(noState).toContain('| `finished` | Yours to fill |');
		expect(noState).not.toContain('written for you, by a state change');
	});

	it('does not require the parent property on every non-root item in folder mode', () => {
		// There the property is the OVERRIDE: a note without it hangs from the folder note
		// above, so "every item except a root" sends an outside editor to pin each note by
		// hand and switch off the inference the view is configured for.
		const folderMode = readme(settingsWith({ folderHierarchy: true }), []);
		expect(folderMode).toContain('| `parent` | Any item whose parent is not the folder note above it |');
		expect(readme(settingsWith({ folderHierarchy: false }), [])).toContain('| `parent` | Every item except a root |');
	});

	it('keeps a line break out of the table it would otherwise split', () => {
		// A row is one line: a state or a key holding a break ends the row early and the
		// rest of the table stops parsing. Shown the way the example block shows it.
		const content = readme(settingsWith({ stateKey: 'sta\ntus', states: ['Do\ning'] }));
		expect(content).toContain('| `sta\\ntus` |');
		expect(content).toContain('| `Do\\ning` |');
		// Every row of both tables is still a row.
		for (const line of content.split('\n')) {
			if (line.startsWith('| `')) expect(line.endsWith('|')).toBe(true);
		}
	});

	it('says a type of the reader s own does not by itself enrol a parentless note', () => {
		// pruneOutsideHierarchy seeds only on ALL_TYPES, so "declare a type" would send
		// an outside editor to write a custom-typed root the view then drops.
		const content = readme(settingsWith({ hierarchyOnly: true }), []);
		expect(content).toContain('only the types listed above are evidence on their own');
		expect(content).toContain('does not enrol a note that has no parent');
	});

	it('names the tie-break the model actually applies', () => {
		const content = readme(settingsWith(), []);
		expect(content).toContain('the order the base itself returned them in');
		expect(content).not.toContain('settled by file name');
	});

	it('follows the folder precedence this view actually applies', () => {
		const flat = readme(settingsWith({ homeFolder: 'work' }), []);
		expect(flat).not.toContain('folder note');
		expect(flat).toContain('1. The folder configured for the type');

		const folderMode = readme(settingsWith({ folderHierarchy: true, homeFolder: 'work' }), []);
		expect(folderMode).toContain("1. Beside the parent's folder note");
		expect(folderMode).toContain('Skipped when the parent is a note the view is showing from outside its own filter.');
		expect(folderMode).toContain('2. The folder configured for the type');
	});

	it('says what a move does to the type, per this view s setting', () => {
		expect(readme(settingsWith({ autoType: false }), [])).toContain('never rewrites its type');
		// The rules bullet names the trigger and sends the reader to the section that
		// qualifies it, rather than restating it: `computeTypeChanges` rewrites nothing on a
		// reorder and nothing on an extra type, so a second "a move re-types what it moves"
		// here is a sentence that is already wrong twice.
		const auto = readme(settingsWith({ autoType: true }), []);
		expect(auto).toContain('A move into a new parent is the one thing that rewrites a type');
		expect(auto).toContain('**The item types** above says which moves, and which types it leaves alone');
		expect(auto).toContain('## The item types');
		expect(auto).not.toContain('re-type what it moves');
	});

	it('qualifies the custom-type promise where a move rewrites it', () => {
		// computeTypeChanges exempts only DECLARED extra types, so with types assigned on a
		// move a dragged `Spike` is rewritten — the descendants keep theirs. An unqualified
		// promise is wrong in exactly the configuration that opts into rewriting.
		expect(readme(settingsWith({ autoType: false }))).toContain('Nothing rewrites it into one of these');
		const auto = readme(settingsWith({ autoType: true }));
		// Not every move: only one into a NEW parent, and never an extra type.
		expect(auto).toContain('rewrites what you drag into a **new parent**');
		expect(auto).toContain('Reordering among siblings rewrites nothing');
		expect(auto).toContain('`Issue`, `Bug`, `Idea` and `Deliverable` keep their type wherever they land');
		expect(auto).toContain('deeper in the subtree you dragged is left alone');
	});

	it('does not promise a propertyless note stays out of a folder-inferred tree', () => {
		// One paragraph answers this, at the top — two would be two chances to disagree.
		const folderMode = readme(settingsWith({ hierarchyOnly: true, folderHierarchy: true }));
		expect(folderMode).toContain('or sits under a folder note, which this view reads as its parent');
		expect(folderMode).not.toContain('the folder does not make it one');
		expect(readme(settingsWith({ hierarchyOnly: true, folderHierarchy: false }))).toContain(
			'the folder does not make it one',
		);
	});

	it('does not say a declared type is redrawn at the level its position implies', () => {
		// computeLevel keeps a declared ladder type's own level; only an untyped note takes
		// the position's. Saying otherwise describes the badge wrong for exactly the
		// mismatched hierarchy the sentence exists to explain.
		const content = readme(settingsWith(), []);
		expect(content).toContain('a type you declare is the type you keep');
		expect(content).toContain('Only a note with **no** type takes the level its position implies');
	});

	it('tells the reader how a note stays out of the backlog, per the scope setting', () => {
		expect(readme(settingsWith({ hierarchyOnly: true }), [])).toContain(
			'a note carrying only an order or a state is still an ordinary note',
		);
		expect(readme(settingsWith({ hierarchyOnly: false }), [])).toContain('treats **every** note it returns as an item');
	});

	it('is byte-identical for the same inputs and different for different states', () => {
		const settings = settingsWith({ stateKey: 'status' });
		expect(readme(settings, ['Doing'])).toBe(readme(settings, ['Doing']));
		// Two bases with identical settings and different states in their notes must not
		// document the same vocabulary — the states are not a setting.
		expect(readme(settings, ['Doing'])).not.toBe(readme(settings, ['Blocked']));
	});
});

describe('readmeStates', () => {
	it('reports the declared workflow as declared', () => {
		expect(readmeStates(settingsWith({ states: ['Todo', 'Done'] }), ['Todo'])).toEqual([
			{ value: 'Todo', source: 'declared' },
			{ value: 'Done', source: 'declared' },
		]);
	});

	it('appends a value the workflow does not declare, once', () => {
		expect(readmeStates(settingsWith({ states: ['Todo'] }), ['Blocked', 'blocked', 'Todo'])).toEqual([
			{ value: 'Todo', source: 'declared' },
			{ value: 'Blocked', source: 'observed' },
		]);
	});

	it('keeps the appended done target apart from what the notes carry', () => {
		expect(readmeStates(settingsWith({ states: [], doneValues: ['Done'] }), ['Doing'])).toEqual([
			{ value: 'Doing', source: 'observed' },
			{ value: 'Done', source: 'offered' },
		]);
	});

	it('reports a done value the notes DO carry as observed', () => {
		expect(readmeStates(settingsWith({ states: [], doneValues: ['Done'] }), ['Doing', 'Done'])).toEqual([
			{ value: 'Doing', source: 'observed' },
			{ value: 'Done', source: 'observed' },
		]);
	});
});
