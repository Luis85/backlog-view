import { describe, expect, it } from 'vitest';
import {
	boardColumns,
	BoardColumn,
	deliverablesWorkflow,
	NO_STATE_COLLISION_LABEL,
	NO_STATE_LABEL,
	overBy,
	requirementsWorkflow,
} from '../../src/domain/board';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { computeStateWrites } from '../../src/domain/writePlan';
import { BacklogSettings } from '../../src/domain/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * Progress tracking on, with a configured workflow — the board's home ground. Resolved
 * from view options rather than spread from `defaultSettings()`: the resolver is where
 * the Deliverable lists FOLLOW a falling-back key, so the literal expressed a
 * configuration nobody could set. `assertResolvedSettings` rejects it now.
 */
const settings = resolveSettings(
	new FakeViewConfig({ stateProperty: 'note.status', stateValues: 'New, Active, Done', doneValues: 'Done' }) as never,
);

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

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

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

		const board = boardColumns(
			requirementsWorkflow(model, reordered),
			model.focused ? model.roots : model.results,
			everything,
		);

		expect(board.columns[1]).toMatchObject({ label: 'Done', done: true });
		expect(board.columns[2]).toMatchObject({ label: 'New', done: false });
	});

	it('falls back to the observed states plus a done value when no list is configured', () => {
		const unconfigured = { ...settings, states: [] };
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing' } });
		const model = buildModel(vault.app, vault.entries(), unconfigured);

		const board = boardColumns(
			requirementsWorkflow(model, unconfigured),
			model.focused ? model.roots : model.results,
			everything,
		);

		// The same fallback the state menus use: observed values, then a done state.
		expect(labels(board)).toEqual([NO_STATE_LABEL, 'Doing', 'Done']);
		expect(board.columns.some((c) => c.outsideWorkflow)).toBe(false);
	});

	it('matches values to columns case-insensitively', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'done' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

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

		const board = boardColumns(
			requirementsWorkflow(model, clashing),
			model.focused ? model.roots : model.results,
			everything,
		);

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

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

		expect(board.columns[0].state).toBeNull();
		expect(board.columns[0].cards.map((c) => c.title)).toEqual(['A']);
	});

	it('appends a column for an observed value the workflow does not name', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Blocked' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

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

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

		expect(board.cardCount).toBe(3);
		expect(board.columns.reduce((n, c) => n + c.count, 0)).toBe(3);
	});

	it('orders cards by the Base result order, not by sibling rank', () => {
		const vault = new FakeVault();
		// The Base's sort put B first; sibling orders say otherwise and must not win.
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

		const col = board.columns.find((c) => c.label === 'New');
		expect(col?.cards.map((c) => c.title)).toEqual(['B', 'A']);
	});

	it('drops hidden cards from the columns and the counts together', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			(item) => item.title !== 'B',
		);

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

		const board = boardColumns(
			requirementsWorkflow(model, settings),
			model.focused ? model.roots : model.results,
			everything,
		);

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

			const board = boardColumns(
				requirementsWorkflow(model, focused),
				model.focused ? model.roots : model.results,
				everything,
			);

			expect(board.cardCount).toBe(2);
			const active = board.columns.find((c) => c.label === 'Active');
			expect(active?.cards.map((c) => c.title)).toEqual(['F1']);
		});

		it('places a focused context card under its own state, uncounted', () => {
			const vault = focusVault();
			const focused = { ...settings, focusLevel: 'Feature' };
			const model = buildModel(vault.app, only(vault, 'P1.md', 'P2.md'), focused);

			const board = boardColumns(
				requirementsWorkflow(model, focused),
				model.focused ? model.roots : model.results,
				everything,
			);

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

			const board = boardColumns(
				requirementsWorkflow(model, focused),
				model.focused ? model.roots : model.results,
				everything,
			);

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
		return boardColumns(requirementsWorkflow(model, s), model.focused ? model.roots : model.results, everything);
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
			requirementsWorkflow(model, limited),
			model.focused ? model.roots : model.results,
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

describe('boardColumns with the Deliverables workflow', () => {
	function deliverablesSettings(extra: Partial<BacklogSettings> = {}): BacklogSettings {
		return { ...settings, deliverableStateKey: 'deliverableStatus', ...extra };
	}

	it('cards only Deliverable-typed results, never a PBI sharing the candidate list', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, deliverableStatus: 'Draft' } });
		const s = deliverablesSettings();
		const model = buildModel(vault.app, vault.entries(), s);

		const isDeliverable = (item: BacklogItem) => item.typeName?.toLowerCase() === 'deliverable';
		const board = boardColumns(
			deliverablesWorkflow(model, s),
			model.results,
			(item) => isDeliverable(item),
		);

		expect(board.cardCount).toBe(1);
		expect(board.columns.flatMap((c) => c.cards.map((card) => card.title))).toEqual(['D']);
	});

	it('reads state from deliverableStateValue, never the requirements stateValue', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
		});
		const s = { ...deliverablesSettings(), stateKey: 'status' };
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(deliverablesWorkflow(model, s), model.results, () => true);

		const col = board.columns.find((c) => c.label === 'Draft');
		expect(col?.cards.map((c) => c.title)).toEqual(['D']);
	});

	it('never applies WIP limits or column policies — the Deliverables board has none', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		// The requirements workflow's OWN limit/policy for the same state name, so this
		// fails if deliverablesWorkflow ever forwards settings.wipLimits/columnPolicies
		// instead of {} — a fixture with both already empty cannot tell the two apart.
		//
		// `states` carries `Draft` too, and has to: the resolver builds `wipLimits` over the
		// CONFIGURED states, so a limit on a state the requirements workflow does not have
		// is one no user could set. Without it this fixture was staging the collision it
		// claims to test rather than reproducing it.
		const s = deliverablesSettings({
			states: ['Draft'],
			deliverableStates: ['Draft'],
			wipLimits: { draft: 2 },
			columnPolicies: { draft: 'x' },
		});
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(deliverablesWorkflow(model, s), model.results, () => true);

		const col = board.columns.find((c) => c.label === 'Draft');
		expect(col?.limit).toBeNull();
		expect(col?.policy).toBe('');
	});

	it("draws its columns from its OWN observed values, never the requirements workflow's declared states, when its key is configured but its own states are not", () => {
		// A normal requirements board (its own key AND declared states) plus a
		// Deliverable state property of its own with no declared vocabulary yet — the
		// key is NOT falling back here, so the states list must not borrow the shared
		// one either; it must fall through to observed Deliverable values instead.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Blocked' } });
		const s = resolveSettings(
			new FakeViewConfig({
				stateProperty: 'note.status',
				stateValues: 'New, Active, Done',
				deliverableStateProperty: 'note.deliverableStatus',
			}),
		);
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(deliverablesWorkflow(model, s), model.results, everything);

		// Not the shared workflow's declared vocabulary (an unrelated property) — the
		// requirements states never leak into a stray column, whatever `menuValues`
		// does beyond that with the observed tier it correctly falls through to (it
		// still appends a done value from `deliverableDoneValues` so marking something
		// done is always offered, exactly as it does for any unconfigured workflow —
		// unrelated to this fallback, and not what this test is about).
		const columnLabels = labels(board);
		expect(columnLabels).not.toContain('New');
		expect(columnLabels).not.toContain('Active');
		expect(columnLabels).toContain('Blocked');
	});

	it("suggests the shipped default as its one-click-done value, never the requirements workflow's customized done values, when its key is configured but its own done values are not", () => {
		// The sibling of the states test above, for `deliverableDoneValues`: an OWN,
		// distinct Deliverable state property with no done values of its own is a
		// genuinely independent workflow. `menuValues` appends a done value once the
		// observed tier is reached (nothing declared for either list) — that suggestion
		// must be the shipped default ('Done'), never an unrelated property's
		// customized ('Shipped') done values.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Blocked' } });
		const s = resolveSettings(
			new FakeViewConfig({ doneValues: 'Shipped, Retired', deliverableStateProperty: 'note.deliverableStatus' }),
		);
		const model = buildModel(vault.app, vault.entries(), s);

		const board = boardColumns(deliverablesWorkflow(model, s), model.results, everything);

		expect(labels(board)).toEqual(['No state', 'Blocked', 'Done']);
	});
});

describe('a column reports whether it still holds open work', () => {
	/**
	 * Two done items in Done, one of which still carries an unfinished Task — so the
	 * column is finished-looking and is not finished, which is the whole distinction
	 * `openWork` exists to draw for the fold default in `render/board.ts`.
	 */
	function doneVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('Retained.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('Loose end.md', {
			frontmatter: { type: 'Task', order: 10, status: 'Active' },
			parentLink: 'Retained',
		});
		return vault;
	}

	it('is false where every card in the column is a finished subtree', () => {
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, everything);

		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(false);
		// And it is a question about THIS column, never about the board: the item in a
		// not-done column is open work and says nothing about Done.
		expect(board.columns.find((c) => c.label === 'Active')?.openWork).toBe(false);
	});

	it('is true where a done card still carries unfinished work below it', () => {
		const vault = doneVault();
		const model = buildModel(vault.app, vault.entries(), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, everything);

		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(true);
	});

	it('reads the POPULATION, so a filter that hid the open card cannot say the column is finished', () => {
		// The failure this pins: measured over `cards`, a search matching only the tidy
		// item would report Done as finished, and the board would fold a column holding a
		// retained card — the user searching their board into a different shape. The
		// second predicate is the filter; the third is the population it is measured
		// against, which is exactly what `fullCount` already borrows.
		const vault = doneVault();
		const model = buildModel(vault.app, vault.entries(), settings);
		const matched = (item: BacklogItem) => item.title === 'Shipped';
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, matched, everything);

		const done = board.columns.find((c) => c.label === 'Done');
		expect(done?.cards.map((c) => c.title)).toEqual(['Shipped']);
		expect(done?.openWork).toBe(true);
	});

	it('ignores a context card, which is placement rather than work', () => {
		// The context-row rule, asked of one more derived quantity: an excluded note's own
		// state must not decide whether this board folds a column.
		const vault = doneVault();
		const model = buildModel(vault.app, only(vault, 'Shipped.md', 'Loose end.md'), settings);
		const board = boardColumns(requirementsWorkflow(model, settings), model.results, everything);

		// "Retained" is on screen as context in Done, and its unfinished Task is a result
		// in Active — so Done itself holds nothing unfinished of its own.
		expect(board.columns.find((c) => c.label === 'Done')?.openWork).toBe(false);
	});
});
