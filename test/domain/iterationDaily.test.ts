import { describe, expect, it } from 'vitest';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { boardPeople, cardSignals, iterationProgress, personKey, timebox } from '../../src/domain/iterationDaily';
import { settingsFrom } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * What the daily asks of an iteration. Every answer takes `today` as an argument, so the
 * tests pin a day instead of faking a clock.
 */
const day = (year: number, month: number, d: number): CivilDate => ({ year, month, day: d });

describe('timebox', () => {
	const start = day(2026, 10, 12);
	const target = day(2026, 10, 23);

	it('reads no dates as none', () => {
		expect(timebox(null, null, start)).toEqual({ kind: 'none' });
	});

	it('keeps a single end as it is', () => {
		expect(timebox(start, null, target)).toEqual({ kind: 'startOnly', start });
		expect(timebox(null, target, start)).toEqual({ kind: 'targetOnly', target });
	});

	it('counts days to the start before it begins', () => {
		expect(timebox(start, target, day(2026, 10, 9))).toEqual({ kind: 'upcoming', start, target, startsIn: 3 });
	});

	it('calls the first day day 1', () => {
		expect(timebox(start, target, start)).toEqual({ kind: 'running', start, target, day: 1, length: 12, left: 11 });
	});

	it('leaves 0 days on the last day', () => {
		expect(timebox(start, target, target)).toEqual({ kind: 'running', start, target, day: 12, length: 12, left: 0 });
	});

	it('counts days since the end after it', () => {
		expect(timebox(start, target, day(2026, 10, 25))).toEqual({ kind: 'ended', start, target, endedAgo: 2 });
	});

	it('treats a target before its start as a target alone', () => {
		expect(timebox(target, start, day(2026, 10, 15))).toEqual({ kind: 'targetOnly', target: start });
	});
});

const settings = settingsFrom({
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationOpenStates: 'New',
	assigneeProperty: 'note.assignee',
	dependsOnProperty: 'note.dependsOn',
	targetProperty: 'note.target',
});

const TODAY = day(2026, 10, 15);

type Files = Record<string, Record<string, unknown>>;

/** A model over `files` (all PBIs unless they say otherwise); `only` narrows the Base's results. */
function build(files: Files, only?: string[], parents: Record<string, string> = {}): Map<string, BacklogItem> {
	const vault = new FakeVault();
	vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('People/Bo.md', { frontmatter: { type: 'Resource' } });
	for (const [path, frontmatter] of Object.entries(files)) {
		vault.addFile(path, { frontmatter: { type: 'PBI', ...frontmatter }, parentLink: parents[path] });
	}
	const entries = vault.entries().filter((e) => only === undefined || only.includes(e.file.path));
	return buildModel(vault.app, entries, settings).byPath;
}

const all = (items: Map<string, BacklogItem>): BacklogItem[] => [...items.values()];

/** `Ctx.md` is excluded from the Base and loaded as the context parent of `Kid.md`. */
function withContextRow(): Map<string, BacklogItem> {
	const items = build(
		{ 'Ctx.md': { order: 10, status: 'Doing', assignee: 'Bo', target: '2026-10-01' }, 'Kid.md': { type: 'Task', order: 10, status: 'Done' } },
		['Kid.md'],
		{ 'Kid.md': 'Ctx' },
	);
	expect(items.get('Ctx.md')?.outsideFilter).toBe(true);
	return items;
}

describe('iterationProgress', () => {
	it('counts open, in progress and resolved, and the total', () => {
		const items = build({
			'A.md': { order: 10 },
			'B.md': { order: 20, status: 'Doing' },
			'C.md': { order: 30, status: 'Done' },
		});
		expect(iterationProgress(all(items), settings)).toEqual({ open: 1, inProgress: 1, resolved: 1, total: 3 });
	});

	it('reads a note with no state as open and a done value as resolved', () => {
		const items = build({ 'A.md': { order: 10 }, 'B.md': { order: 20, status: 'Done' } });
		expect(iterationProgress(all(items), settings)).toMatchObject({ open: 1, resolved: 1 });
	});

	it('skips a context row', () => {
		expect(iterationProgress(all(withContextRow()), settings)).toEqual({ open: 0, inProgress: 0, resolved: 1, total: 1 });
	});
});

describe('personKey and boardPeople', () => {
	it('keys a resolved assignee by path and an unresolved one by its raw text', () => {
		const items = build({
			'A.md': { order: 10, assignee: 'Ada' },
			'B.md': { order: 20, assignee: 'Ghost' },
			'C.md': { order: 30 },
		});
		expect(personKey(items.get('A.md')!)).toBe('People/Ada.md');
		expect(personKey(items.get('B.md')!)).toBe('Ghost');
		expect(personKey(items.get('C.md')!)).toBe('');
	});

	it('sorts people by name with Unassigned last', () => {
		const items = build({
			'A.md': { order: 10 },
			'B.md': { order: 20, assignee: 'Bo' },
			'C.md': { order: 30, assignee: 'Ada' },
			'D.md': { order: 40, assignee: 'Bo' },
		});
		expect(boardPeople(all(items))).toEqual([
			{ key: 'People/Ada.md', name: 'Ada', count: 1 },
			{ key: 'People/Bo.md', name: 'Bo', count: 2 },
			{ key: '', name: null, count: 1 },
		]);
	});

	it('leaves Unassigned out when nobody is unassigned', () => {
		const items = build({ 'A.md': { order: 10, assignee: 'Ada' } });
		expect(boardPeople(all(items)).map((p) => p.key)).toEqual(['People/Ada.md']);
	});

	it('does not count a context row', () => {
		expect(boardPeople(all(withContextRow()))).toEqual([{ key: '', name: null, count: 1 }]);
	});
});

describe('cardSignals', () => {
	const NONE = { blockedBy: null, overdueDays: 0 };

	it('names the first prerequisite that is not resolved', () => {
		const items = build({
			'A.md': { order: 10, status: 'Doing' },
			'B.md': { order: 20, dependsOn: 'A' },
		});
		const signals = cardSignals(items.get('B.md')!, settings, TODAY);
		expect(signals.blockedBy?.file?.path).toBe('A.md');
	});

	it('is not blocked once the prerequisite is resolved', () => {
		const items = build({
			'A.md': { order: 10, status: 'Done' },
			'B.md': { order: 20, dependsOn: 'A' },
		});
		expect(cardSignals(items.get('B.md')!, settings, TODAY)).toEqual(NONE);
	});

	it('counts the days past the target', () => {
		const items = build({ 'A.md': { order: 10, status: 'Doing', target: '2026-10-12' } });
		expect(cardSignals(items.get('A.md')!, settings, TODAY).overdueDays).toBe(3);
	});

	it('is not overdue on or before the target day', () => {
		const items = build({ 'A.md': { order: 10, target: '2026-10-15' }, 'B.md': { order: 20, target: '2026-10-20' } });
		expect(cardSignals(items.get('A.md')!, settings, TODAY).overdueDays).toBe(0);
		expect(cardSignals(items.get('B.md')!, settings, TODAY).overdueDays).toBe(0);
	});

	it('says nothing about a resolved item', () => {
		const items = build({
			'A.md': { order: 10, status: 'Doing' },
			'B.md': { order: 20, status: 'Done', dependsOn: 'A', target: '2026-10-01' },
		});
		expect(cardSignals(items.get('B.md')!, settings, TODAY)).toEqual(NONE);
	});

	it('says nothing about a context row', () => {
		expect(cardSignals(withContextRow().get('Ctx.md')!, settings, TODAY)).toEqual(NONE);
	});
});
