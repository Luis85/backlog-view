import { describe, expect, it } from 'vitest';
import { boardColumns, BoardColumn, NO_STATE_COLLISION_LABEL, NO_STATE_LABEL, overBy } from '../../src/domain/board';
import { buildModel } from '../../src/domain/model';
import { computeStateWrites } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/** Progress tracking on, with a configured workflow — the board's home ground. */
const settings = {
	...defaultSettings(),
	stateKey: 'status',
	states: ['New', 'Active', 'Done'],
	doneValues: ['Done'],
};

const everything = () => true;

/** The date the caller hands the planner — fixed, because planning stays pure. */
const TODAY = '2026-08-02';

function labels(board: { columns: { label: string }[] }): string[] {
	return board.columns.map((c) => c.label);
}

/** Stand-in for a Base filtered to a subset of the vault. */
function only(vault: FakeVault, ...paths: string[]) {
	return vault.entries().filter((e) => paths.includes(e.file.path));
}

describe('boardColumns', () => {
	it('renders one column per configured state, in order, no-state first', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, everything);

		expect(labels(board)).toEqual([NO_STATE_LABEL, 'New', 'Active', 'Done']);
		// A configured state's column exists cards or none.
		expect(board.columns[1].cards).toHaveLength(0);
		expect(board.columns[2].cards.map((c) => c.title)).toEqual(['A']);
	});

	it('marks done columns wherever the user put them in the order', () => {
		const reordered = { ...settings, states: ['Done', 'New'] };
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), reordered);

		const board = boardColumns(model, reordered, everything);

		expect(board.columns[1]).toMatchObject({ label: 'Done', done: true });
		expect(board.columns[2]).toMatchObject({ label: 'New', done: false });
	});

	it('falls back to the observed states plus a done value when no list is configured', () => {
		const unconfigured = { ...settings, states: [] };
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing' } });
		const model = buildModel(vault.app, vault.entries(), unconfigured);

		const board = boardColumns(model, unconfigured, everything);

		// The same fallback the state menus use: observed values, then a done state.
		expect(labels(board)).toEqual([NO_STATE_LABEL, 'Doing', 'Done']);
		expect(board.columns.some((c) => c.outsideWorkflow)).toBe(false);
	});

	it('matches values to columns case-insensitively', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'done' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, everything);

		const doneCol = board.columns.find((c) => c.label === 'Done');
		expect(doneCol?.cards.map((c) => c.title)).toEqual(['A']);
		expect(labels(board)).toEqual([NO_STATE_LABEL, 'New', 'Active', 'Done']);
	});

	it('yields the unset column’s label when a real state claims “No state”', () => {
		const clashing = { ...settings, states: ['No state', 'Done'] };
		const vault = new FakeVault();
		vault.addFile('Named.md', { frontmatter: { type: 'Epic', order: 10, status: 'No state' } });
		vault.addFile('Bare.md', { frontmatter: { type: 'Epic', order: 20 } });
		const model = buildModel(vault.app, vault.entries(), clashing);

		const board = boardColumns(model, clashing, everything);

		// Two columns with the same name and opposite drop semantics would make
		// targeting a coin toss; the synthetic one yields, the user's stays.
		expect(labels(board)).toEqual([NO_STATE_COLLISION_LABEL, 'No state', 'Done']);
		expect(board.columns[0].state).toBeNull();
		expect(board.columns[0].cards.map((c) => c.title)).toEqual(['Bare']);
		expect(board.columns[1].cards.map((c) => c.title)).toEqual(['Named']);
	});

	it('gathers items without the state property in the leading no-state column', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, everything);

		expect(board.columns[0].state).toBeNull();
		expect(board.columns[0].cards.map((c) => c.title)).toEqual(['A']);
	});

	it('appends a column for an observed value the workflow does not name', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Blocked' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, everything);

		// After the configured columns, visibly outside the workflow — never a dropped card.
		expect(labels(board)).toEqual([NO_STATE_LABEL, 'New', 'Active', 'Done', 'Blocked']);
		const stray = board.columns[4];
		expect(stray.outsideWorkflow).toBe(true);
		expect(stray.cards.map((c) => c.title)).toEqual(['A']);
	});

	it('sums the column counts to the result cards on the board', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('B.md', { frontmatter: { type: 'Feature', order: 10, status: 'Active' }, parentLink: 'A' });
		vault.addFile('C.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'A' });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, everything);

		expect(board.cardCount).toBe(3);
		expect(board.columns.reduce((n, c) => n + c.count, 0)).toBe(3);
	});

	it('orders cards by the Base result order, not by sibling rank', () => {
		const vault = new FakeVault();
		// The Base's sort put B first; sibling orders say otherwise and must not win.
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, everything);

		const col = board.columns.find((c) => c.label === 'New');
		expect(col?.cards.map((c) => c.title)).toEqual(['B', 'A']);
	});

	it('drops hidden cards from the columns and the counts together', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(model, settings, (item) => item.title !== 'B');

		const col = board.columns.find((c) => c.label === 'New');
		expect(col?.cards.map((c) => c.title)).toEqual(['A']);
		expect(col?.count).toBe(1);
		expect(board.cardCount).toBe(1);
	});

	it('never counts a context item and never mints a column from its state', () => {
		const vault = new FakeVault();
		// The Epic holds a state the workflow does not name, and the filter excludes it.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Someday' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Epic' });
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);

		const board = boardColumns(model, settings, everything);

		// Unfocused, a context ancestor is not a card at all — it labels its child's card.
		expect(labels(board)).toEqual([NO_STATE_LABEL, 'New', 'Active', 'Done']);
		expect(board.cardCount).toBe(1);
		const all = board.columns.flatMap((c) => c.cards.map((card) => card.title));
		expect(all).toEqual(['PBI']);
	});

	describe('with a focus level', () => {
		/** Two Features under an excluded Epic; the Base returns only the PBIs. */
		function focusVault(): FakeVault {
			const vault = new FakeVault();
			vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Active' }, parentLink: 'Epic' });
			vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 20, status: 'Someday' }, parentLink: 'Epic' });
			vault.addFile('P1.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'F1' });
			vault.addFile('P2.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'F2' });
			return vault;
		}

		it('makes the focused level the cards', () => {
			const vault = focusVault();
			const focused = { ...settings, focusLevel: 'Feature' };
			const model = buildModel(vault.app, vault.entries(), focused);

			const board = boardColumns(model, focused, everything);

			expect(board.cardCount).toBe(2);
			const active = board.columns.find((c) => c.label === 'Active');
			expect(active?.cards.map((c) => c.title)).toEqual(['F1']);
		});

		it('places a focused context card under its own state, uncounted', () => {
			const vault = focusVault();
			const focused = { ...settings, focusLevel: 'Feature' };
			const model = buildModel(vault.app, only(vault, 'P1.md', 'P2.md'), focused);

			const board = boardColumns(model, focused, everything);

			// F1's state names a workflow column, so its context card sits there — placed,
			// but in no count: the column counts describe results alone.
			const active = board.columns.find((c) => c.label === 'Active');
			expect(active?.cards.map((c) => c.title)).toEqual(['F1']);
			expect(active?.count).toBe(0);
			// F2's state names no column, and an excluded note's value must not mint one:
			// it gathers under no-state instead.
			expect(labels(board)).toEqual([NO_STATE_LABEL, 'New', 'Active', 'Done']);
			expect(board.columns[0].cards.map((c) => c.title)).toEqual(['F2']);
			expect(board.columns[0].count).toBe(0);
			expect(board.cardCount).toBe(0);
		});

		it('sorts a context card where its first placed result would sort', () => {
			const vault = new FakeVault();
			vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('Loud.md', { frontmatter: { type: 'Feature', order: 10, status: 'Active' } });
			vault.addFile('Quiet.md', { frontmatter: { type: 'Feature', order: 20, status: 'Active' }, parentLink: 'Epic' });
			vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Quiet' });
			const focused = { ...settings, focusLevel: 'Feature' };
			// The Base returns the Task first, then Loud — Quiet itself is excluded.
			const entries = [...only(vault, 'Task.md'), ...only(vault, 'Loud.md')];
			const model = buildModel(vault.app, entries, focused);

			const board = boardColumns(model, focused, everything);

			const active = board.columns.find((c) => c.label === 'Active');
			// Quiet is context (entry: null) loaded after every result; sorted by its own
			// load position it would sink last. It sorts where Task, its first placed
			// result, sits in the Base's order — before Loud.
			expect(active?.cards.map((c) => c.title)).toEqual(['Quiet', 'Loud']);
		});
	});
});

describe('computeStateWrites', () => {
	function item(state: string | null) {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, ...(state !== null ? { status: state } : {}) } });
		const model = buildModel(vault.app, vault.entries(), settings);
		return model.results[0];
	}

	it('writes the canonical configured value, untransformed', () => {
		const card = item('New');
		const writes = computeStateWrites(card, 'Done', settings, TODAY);
		expect(writes).toEqual([{ file: card.file, state: 'Done' }]);
	});

	it('plans nothing for a drop on the card’s own column, case-insensitively', () => {
		expect(computeStateWrites(item('done'), 'Done', settings, TODAY)).toEqual([]);
	});

	it('removes the key for a drop on the no-state column', () => {
		const writes = computeStateWrites(item('New'), null, settings, TODAY);
		expect(writes).toHaveLength(1);
		expect(writes[0].removeStateKey).toBe(true);
		expect(writes[0].state).toBeUndefined();
	});

	it('plans nothing for a stateless card dropped on the no-state column', () => {
		expect(computeStateWrites(item(null), null, settings, TODAY)).toEqual([]);
	});
});

describe('a column carries its own agreement', () => {
	const limited = {
		...settings,
		wipLimits: { active: 2 } as Record<string, number>,
		columnPolicies: { active: 'Someone is actually working on it' } as Record<string, string>,
	};

	function board(vault: FakeVault, s = limited) {
		const model = buildModel(vault.app, vault.entries(), s);
		return boardColumns(model, s, everything);
	}

	function column(vault: FakeVault, label: string, s = limited) {
		const col = board(vault, s).columns.find((c) => c.label === label);
		if (!col) throw new Error(`column not found: ${label}`);
		return col;
	}

	function vaultWith(...states: string[]): FakeVault {
		const vault = new FakeVault();
		states.forEach((status, i) => vault.addFile(`A${i}.md`, { frontmatter: { type: 'Epic', order: i, status } }));
		return vault;
	}

	it('reads the limit and the policy off the settings, keyed by its own state', () => {
		const col = column(vaultWith('Active'), 'Active');
		expect(col.limit).toBe(2);
		expect(col.policy).toBe('Someone is actually working on it');
	});

	it('leaves an unconfigured column with no limit and no policy', () => {
		const col = column(vaultWith('New'), 'New');
		expect(col.limit).toBeNull();
		expect(col.policy).toBe('');
	});

	it('gives the no-state column neither, without reading a key off Object.prototype', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const col = column(vault, NO_STATE_LABEL);
		expect(col.limit).toBeNull();
		expect(col.policy).toBe('');
	});

	it('does not read a limit or policy off Object.prototype for a state named "constructor"', () => {
		// Plain object literals, not null-prototype: `active` above merely fails to
		// collide, this is the case that actually exercises the guard. With no OWN
		// `constructor` key, a bare index would find the inherited Object function.
		const collision = {
			...settings,
			states: ['constructor'],
			wipLimits: {} as Record<string, number>,
			columnPolicies: {} as Record<string, string>,
		};
		const col = column(vaultWith('constructor'), 'constructor', collision);
		expect(col.limit).toBeNull();
		expect(col.policy).toBe('');
	});

	it('counts the overage from the FULL population, never the matches', () => {
		// Extension 4a: a filter that made an over-limit column look under its limit
		// would turn a search into a lie about the work.
		const vault = vaultWith('Active', 'Active', 'Active');
		const model = buildModel(vault.app, vault.entries(), limited);
		const filtered = boardColumns(
			model,
			limited,
			(item) => item.file.path === 'A0.md',
			() => true,
		);
		const col = filtered.columns.find((c) => c.label === 'Active');
		expect(col?.count).toBe(1);
		expect(col?.fullCount).toBe(3);
		expect(overBy(col as BoardColumn)).toBe(1);
	});

	it('is not over at the limit, and never over without one', () => {
		expect(overBy(column(vaultWith('Active', 'Active'), 'Active'))).toBe(0);
		expect(overBy(column(vaultWith('New', 'New', 'New'), 'New'))).toBe(0);
	});
});

