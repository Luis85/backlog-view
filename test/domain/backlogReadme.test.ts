import { describe, expect, it } from 'vitest';
import { backlogReadmeContent, README_MARKER, readmeStates } from '../../src/domain/backlogReadme';
import { ALL_TYPES, BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { ORDER_SPACING } from '../../src/domain/writePlan';

/**
 * The generated README is documentation the plugin promises is true, so these tests
 * ask what it SAYS rather than how it is built: every type explained, every key the
 * one this view uses, every state the view actually offers.
 */

const settingsWith = (over: Partial<BacklogSettings> = {}): BacklogSettings => ({ ...defaultSettings(), ...over });

/** The row of the type table for one type — the table is the contract, so rows are read whole. */
function typeRow(content: string, typeName: string): string {
	const row = content.split('\n').find((line) => line.startsWith(`| \`${typeName}\` |`));
	if (!row) throw new Error(`no table row for ${typeName}`);
	return row;
}

describe('backlogReadmeContent', () => {
	it('opens with the marker that identifies its own output', () => {
		expect(backlogReadmeContent(settingsWith(), []).startsWith(README_MARKER)).toBe(true);
	});

	it('explains every type in the vocabulary', () => {
		const content = backlogReadmeContent(settingsWith(), []);
		for (const type of ALL_TYPES) expect(typeRow(content, type)).toContain(type);
	});

	it('reads the type table off childTypeChoices, not off the ladder', () => {
		const content = backlogReadmeContent(settingsWith(), []);
		// The clamp at the deepest rung: a Task holds a Task, which the ladder read
		// literally would deny — and the + button on the row would then contradict it.
		expect(typeRow(content, 'Task')).toContain('| `Task` |');
		// An extra type hangs from any rung above the deepest and holds the deepest.
		expect(typeRow(content, 'Bug')).toMatch(/\| `Epic`, `Feature`, `PBI` \| `Task` \|/);
		// The ladder's top reads as a root, because that is what is offered with no parent.
		expect(typeRow(content, 'Epic')).toContain('*(nothing — it is a root)*');
	});

	it('names the keys this view uses, not the shipped defaults', () => {
		const content = backlogReadmeContent(settingsWith({ parentKey: 'up', orderKey: 'rank', typeKey: 'kind' }), []);
		expect(content).toContain('| `up` |');
		expect(content).toContain('| `rank` |');
		expect(content).toContain('| `kind` |');
		expect(content).not.toContain('| `parent` |');
		// The example is written in the same keys, or it would teach what the table denies.
		expect(content).toContain('up: "[[Checkout redesign]]"');
		expect(content).toContain('kind: PBI');
	});

	it('documents the tags property when one is configured, and not when it is off', () => {
		expect(backlogReadmeContent(settingsWith({ tagsKey: 'labels' }), [])).toContain('| `labels` |');
		expect(backlogReadmeContent(settingsWith({ tagsKey: '' }), [])).not.toContain('Tags, as a YAML list');
	});

	it('states the ranking step the planner actually uses', () => {
		expect(backlogReadmeContent(settingsWith(), [])).toContain(`${ORDER_SPACING} apart`);
	});

	it('omits the sections whose properties are unset', () => {
		const bare = backlogReadmeContent(settingsWith({ stateKey: '', horizonKey: '', startKey: '', targetKey: '' }), ['Doing']);
		expect(bare).not.toContain('## Workflow states');
		expect(bare).not.toContain('## Planning');
	});

	it('describes the horizon and date axes when they are configured', () => {
		const content = backlogReadmeContent(
			settingsWith({ horizonKey: 'horizon', horizonValues: ['Now', 'Later'], startKey: 'start', targetKey: 'due' }),
			[],
		);
		expect(content).toContain('## Planning');
		expect(content).toContain('`Now`, `Later`');
		expect(content).toContain('`start`');
		expect(content).toContain('`due`');
	});

	it('names a done value the workflow does not offer, because writing it still finishes an item', () => {
		const content = backlogReadmeContent(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Active'], doneValues: ['Done', 'Closed'] }),
			[],
		);
		expect(content).toContain('`Done`, `Closed` are not offered as states here');
		expect(content).toContain('what makes an item finished is this list, not the workflow above');
	});

	it('says nothing about unlisted done values when the workflow lists them all', () => {
		const content = backlogReadmeContent(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Done'], doneValues: ['Done'] }),
			[],
		);
		expect(content).not.toContain('not offered as');
	});

	it('does not call the planning properties read-only, because the row menu writes them', () => {
		const content = backlogReadmeContent(settingsWith({ startKey: 'start', targetKey: 'due' }), []);
		expect(content).toContain('Schedule and Unschedule');
		expect(content).not.toContain('writes neither');
	});

	it('describes the timeline when only one date property is configured', () => {
		// Either key alone is a configured axis, so a view with one must not be told it
		// has no roadmap at all.
		const content = backlogReadmeContent(settingsWith({ startKey: '', targetKey: 'due', horizonKey: '' }), []);
		expect(content).toContain('## Planning');
		expect(content).toContain('`due` is the planned date');
		expect(content).toContain('drawn as a milestone');
	});

	it('does not advertise a horizon property whose values have been cleared', () => {
		// Same gate the menu and the planner use: a horizon key with no values is an axis
		// nothing renders and nothing writes, so a row for it would name an inert key.
		const inert = backlogReadmeContent(settingsWith({ horizonKey: 'horizon', horizonValues: [] }), []);
		expect(inert).not.toContain('`horizon`');
		expect(inert).not.toContain('## Planning');

		const live = backlogReadmeContent(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }), []);
		expect(live).toContain('| `horizon` | Optional |');
	});

	it('says an undeclared horizon gets its own bucket rather than being shelved', () => {
		const content = backlogReadmeContent(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }), []);
		expect(content).toContain('it gets a horizon of its own, after the declared ones');
	});

	it('warns that a folder move is a hierarchy move in folder mode, and not otherwise', () => {
		const folderMode = backlogReadmeContent(settingsWith({ folderHierarchy: true }), []);
		expect(folderMode).toContain('moving such a note moves it in the tree');
		expect(folderMode).toContain('the property always wins');
		expect(backlogReadmeContent(settingsWith({ folderHierarchy: false }), [])).toContain(
			'Folders are filing, not hierarchy',
		);
	});

	it('marks a declared workflow as declared and observed values as observed', () => {
		const declared = backlogReadmeContent(settingsWith({ stateKey: 'status', states: ['Todo', 'Done'] }), []);
		expect(declared).toContain('| `Todo` | No | Declared in the view |');
		expect(declared).toContain('| `Done` | Yes | Declared in the view |');

		const observed = backlogReadmeContent(settingsWith({ stateKey: 'status', states: [] }), ['Doing']);
		expect(observed).toContain('| `Doing` | No | Observed in these notes |');
	});

	it('lists a stray value a declared workflow does not name, because the board still offers it', () => {
		const content = backlogReadmeContent(settingsWith({ stateKey: 'status', states: ['Todo'] }), ['Blocked']);
		expect(content).toContain('| `Blocked` | No | Observed in these notes |');
	});

	it('does not claim a done value nothing carries was observed', () => {
		// With no workflow declared, the menus append a done value so finishing work is
		// reachable. Calling that observed would be a statement about the vault, and false.
		const content = backlogReadmeContent(settingsWith({ stateKey: 'status', states: [], doneValues: ['Done'] }), ['Doing']);
		expect(content).toContain('| `Doing` | No | Observed in these notes |');
		expect(content).toContain('| `Done` | Yes | Offered so work can be marked done |');
	});

	it('quotes a state in the example when writing it bare would change what it means', () => {
		const yamlHostile = backlogReadmeContent(settingsWith({ stateKey: 'status', states: ['Needs: review'] }), []);
		expect(yamlHostile).toContain('status: "Needs: review"');
		// A plain value stays plain — the example is meant to read as the notes do.
		expect(backlogReadmeContent(settingsWith({ stateKey: 'status', states: ['Todo'] }), [])).toContain('status: Todo');
	});

	it('quotes a configured key in the example for the same reason', () => {
		const content = backlogReadmeContent(settingsWith({ typeKey: 'kind: of' }), []);
		expect(content).toContain('"kind: of": PBI');
	});

	it('keeps a value with markdown syntax inside the cell and the span it belongs to', () => {
		// A pipe ends a table cell whatever it sits in, code span included; a backtick
		// closes the span. Both are legal in a property name, a state and a folder.
		const content = backlogReadmeContent(
			settingsWith({ stateKey: 'status', states: ['Waiting | external'], parentKey: 'up`link' }),
			[],
		);
		expect(content).toContain('| `Waiting \\| external` |');
		expect(content).toContain('``up`link``');
	});

	it('documents the empty parent value, and what it means in folder mode', () => {
		// The plugin writes an empty value to move an item to the top level, and folder
		// mode reads an ABSENT key as "infer from the folder note" — so an outside editor
		// deleting the key gets a different tree from the one the plugin would write.
		const folderMode = backlogReadmeContent(settingsWith({ folderHierarchy: true }), []);
		expect(folderMode).toContain('is not the same as no key at all');
		expect(folderMode).toContain('an empty value pins the note to the top level');
		expect(backlogReadmeContent(settingsWith({ folderHierarchy: false }), [])).toContain(
			'Omitting the key entirely means the same thing here',
		);
	});

	it('does not claim every note in the folder is a work item', () => {
		// The scope paragraph further down says the opposite, and a reader acting on the
		// opening line would treat a meeting note as backlog.
		const content = backlogReadmeContent(settingsWith({ hierarchyOnly: true }), []);
		expect(content).not.toContain('Every note here is one work item');
		expect(content).toContain('notes that carry none of them stay ordinary notes');
	});

	it('says a type of the reader s own does not by itself enrol a parentless note', () => {
		// pruneOutsideHierarchy seeds only on ALL_TYPES, so "declare a type" would send
		// an outside editor to write a custom-typed root the view then drops.
		const content = backlogReadmeContent(settingsWith({ hierarchyOnly: true }), []);
		expect(content).toContain('declares one of the types **listed above**');
		expect(content).toContain('does not by itself enrol a note that has no parent');
	});

	it('names the tie-break the model actually applies', () => {
		const content = backlogReadmeContent(settingsWith(), []);
		expect(content).toContain('the order the base itself returned them in');
		expect(content).not.toContain('settled by file name');
	});

	it('follows the folder precedence this view actually applies', () => {
		const flat = backlogReadmeContent(settingsWith({ homeFolder: 'work' }), []);
		expect(flat).not.toContain('folder note');
		expect(flat).toContain('1. The folder configured for the type');

		const folderMode = backlogReadmeContent(settingsWith({ folderHierarchy: true, homeFolder: 'work' }), []);
		expect(folderMode).toContain("1. Beside the parent's folder note");
		expect(folderMode).toContain('Skipped when the parent is a note the view is showing from outside its own filter.');
		expect(folderMode).toContain('2. The folder configured for the type');
	});

	it('says what a move does to the type, per this view s setting', () => {
		expect(backlogReadmeContent(settingsWith({ autoType: false }), [])).toContain('never rewrites its type');
		expect(backlogReadmeContent(settingsWith({ autoType: true }), [])).toContain('re-type what it moves');
	});

	it('does not say a declared type is redrawn at the level its position implies', () => {
		// computeLevel keeps a declared ladder type's own level; only an untyped note takes
		// the position's. Saying otherwise describes the badge wrong for exactly the
		// mismatched hierarchy the sentence exists to explain.
		const content = backlogReadmeContent(settingsWith(), []);
		expect(content).toContain('a type you declare is the type you keep');
		expect(content).toContain('Only a note with **no** type takes the level its position implies');
	});

	it('tells the reader how a note stays out of the backlog, per the scope setting', () => {
		expect(backlogReadmeContent(settingsWith({ hierarchyOnly: true }), [])).toContain('Declare neither');
		expect(backlogReadmeContent(settingsWith({ hierarchyOnly: false }), [])).toContain('treats **every** note it returns as an item');
	});

	it('is byte-identical for the same inputs and different for different states', () => {
		const settings = settingsWith({ stateKey: 'status' });
		expect(backlogReadmeContent(settings, ['Doing'])).toBe(backlogReadmeContent(settings, ['Doing']));
		// Two bases with identical settings and different states in their notes must not
		// document the same vocabulary — the states are not a setting.
		expect(backlogReadmeContent(settings, ['Doing'])).not.toBe(backlogReadmeContent(settings, ['Blocked']));
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
