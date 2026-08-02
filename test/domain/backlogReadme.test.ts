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
		expect(backlogReadmeContent(settingsWith({ autoType: false }), [])).toContain('moving it does not rewrite its type');
		expect(backlogReadmeContent(settingsWith({ autoType: true }), [])).toContain('re-typed to match when it is moved');
	});

	it('tells the reader how a note stays out of the backlog, per the scope setting', () => {
		expect(backlogReadmeContent(settingsWith({ hierarchyOnly: true }), [])).toContain('Give it neither');
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
			{ value: 'Todo', observed: false },
			{ value: 'Done', observed: false },
		]);
	});

	it('appends a value the workflow does not declare, once', () => {
		expect(readmeStates(settingsWith({ states: ['Todo'] }), ['Blocked', 'blocked', 'Todo'])).toEqual([
			{ value: 'Todo', observed: false },
			{ value: 'Blocked', observed: true },
		]);
	});

	it('falls back to the observed values, with a done state to reach', () => {
		const states = readmeStates(settingsWith({ states: [], doneValues: ['Done'] }), ['Doing']);
		expect(states).toEqual([
			{ value: 'Doing', observed: true },
			{ value: 'Done', observed: true },
		]);
	});
});
