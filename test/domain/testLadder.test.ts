import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { childTypeChoices, displayType, inCatalog, keepsTypeOnMove, ladderFor } from '../../src/domain/itemTypes';
import { computeInitWrites, computeTypeChanges } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { ALL_TYPES, EXTRA_TYPES, LEVELS, TEST_LEVELS } from '../../src/domain/typeVocabulary';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

/**
 * A vault holding both ladders and every row the register argues about: a plan, a
 * catalog, the two advisory mis-drags across them, and the typeless child of each test
 * rung.
 */
function fixture() {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
	vault.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
	vault.addFile('Plan task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'A PBI' });

	vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
	// A `Task` under a `Test case`: the one type whose membership is decided by what it
	// hangs from rather than by its own name.
	vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
	// The typeless child of each test rung — the rows where the raw `type` field and the
	// effective type disagree.
	vault.addFile('Untyped under suite.md', { frontmatter: { order: 20 }, parentLink: 'Suite' });
	vault.addFile('Untyped under case.md', { frontmatter: { order: 20 }, parentLink: 'Case' });
	// A plan type beneath a test, and a test beneath a plan type — the two advisory drags.
	vault.addFile('Stray PBI.md', { frontmatter: { type: 'PBI', order: 30 }, parentLink: 'Case' });
	vault.addFile('Stray case.md', { frontmatter: { type: 'Test case', order: 20 }, parentLink: 'A PBI' });
	// A type neither ladder holds, beneath a test: plan work in the wrong place, not a
	// catalog member.
	vault.addFile('Stray bug.md', { frontmatter: { type: 'Bug', order: 40 }, parentLink: 'Case' });

	const model = buildModel(vault.app, vault.entries(), settings);
	const get = (title: string) => {
		const item = model.byPath.get(`${title}.md`);
		if (!item) throw new Error(`missing fixture item ${title}`);
		return item;
	};
	return { vault, model, get };
}

describe('two ladders', () => {
	it('shares its deepest rung and touches the plan nowhere else', () => {
		// The sharing is what makes the rules below consequences rather than code, so it is
		// asserted as a property of the vocabulary and not left to the fixture to imply.
		expect(TEST_LEVELS[TEST_LEVELS.length - 1]).toBe(LEVELS[LEVELS.length - 1]);
		expect(TEST_LEVELS.slice(0, -1).some((t) => LEVELS.includes(t))).toBe(false);
	});

	it('decides a ladder by name where the name belongs to one, and by the parent where it does not', () => {
		// A name that names a rung of exactly one ladder answers for itself, whatever it
		// hangs from — which is what keeps the two ladders from merging by position.
		expect(ladderFor('Test suite', LEVELS)).toBe(TEST_LEVELS);
		expect(ladderFor('PBI', TEST_LEVELS)).toBe(LEVELS);
		// `Task` and a typeless note are the only two that chain, and they chain both ways.
		expect(ladderFor('Task', TEST_LEVELS)).toBe(TEST_LEVELS);
		expect(ladderFor('Task', LEVELS)).toBe(LEVELS);
		expect(ladderFor(null, TEST_LEVELS)).toBe(TEST_LEVELS);
		// At the top level there is nothing to chain from, so both fall to the plan — which
		// is what makes a `Task` created with no parent a plan item.
		expect(ladderFor('Task', null)).toBe(LEVELS);
		expect(ladderFor(null, null)).toBe(LEVELS);
		// A name NEITHER ladder holds is the plan's, and the clause is load-bearing: written
		// as "fall through to the parent" it would sweep an extra type, a marker or a
		// custom name beneath a `Test case` into the catalog.
		expect(ladderFor('Bug', TEST_LEVELS)).toBe(LEVELS);
		expect(ladderFor('Milestone', TEST_LEVELS)).toBe(LEVELS);
		expect(ladderFor('Spike', TEST_LEVELS)).toBe(LEVELS);
	});

	it('draws a typeless child of each test rung as the rung below it, and backfills the same', () => {
		const { model, get } = fixture();
		// Left on the plan's ladder these would read `Feature` and `PBI`. The badge half is
		// a wrong label; the WRITE half is the one that cannot be undone by looking away —
		// it would move the note into the plan, permanently, with nobody asking.
		expect(displayType(get('Untyped under suite'))).toBe('Test case');
		expect(displayType(get('Untyped under case'))).toBe('Task');
		const writes = computeInitWrites(model, settings);
		const typeOf = (path: string) => writes.find((w) => w.file.path === path)?.typeName;
		expect(typeOf('Untyped under suite.md')).toBe('Test case');
		expect(typeOf('Untyped under case.md')).toBe('Task');
	});

	it('offers the rung below inside the catalog and no extra type beside it', () => {
		const { get } = fixture();
		expect(childTypeChoices(get('Suite'))).toEqual(['Test case']);
		// The direction an implementation that merely "adds a rung" gets wrong for free:
		// `EXTRA_TYPES` are declared as things that hang from a plan rung, so a test rung
		// offers its own child alone.
		expect(childTypeChoices(get('Case'))).toEqual(['Task']);
		for (const type of EXTRA_TYPES) {
			expect(childTypeChoices(get('Suite'))).not.toContain(type);
			expect(childTypeChoices(get('Case'))).not.toContain(type);
		}
		// And the reverse: no plan rung offers a test type.
		for (const row of ['Epic', 'Feature', 'A PBI']) {
			for (const type of TEST_LEVELS.slice(0, -1)) expect(childTypeChoices(get(row))).not.toContain(type);
		}
	});
});

describe('catalog membership', () => {
	it('follows a Task to its parent and every other type to its own name', () => {
		const { get } = fixture();
		expect([...TEST_LEVELS.slice(0, -1)].every((t) => inCatalog({ ladder: ladderFor(t, null) }))).toBe(true);
		expect(inCatalog(get('Suite'))).toBe(true);
		expect(inCatalog(get('Case'))).toBe(true);
		// The pair, because a criterion naming only one of them reads as "work items go to
		// the plan" and that sentence is false of exactly one type.
		expect(inCatalog(get('Test task'))).toBe(true);
		expect(inCatalog(get('Plan task'))).toBe(false);
		// A `PBI` under a test is plan work in the wrong place; so is a `Bug`.
		expect(inCatalog(get('Stray PBI'))).toBe(false);
		expect(inCatalog(get('Stray bug'))).toBe(false);
		// A `Test case` under a `PBI` is still a test.
		expect(inCatalog(get('Stray case'))).toBe(true);
	});

	it('asks the EFFECTIVE type, so a typeless child of a suite is a member', () => {
		const { get } = fixture();
		// The row where the raw field and the effective type disagree, and the one a
		// predicate written as `isTestType(item.typeName)` gets backwards while passing
		// every other fixture here.
		expect(get('Untyped under suite').typeName).toBeNull();
		expect(inCatalog(get('Untyped under suite'))).toBe(true);
		expect(inCatalog(get('Untyped under case'))).toBe(true);
	});

	it('leaves a Task whose Test case parent is not in the model to the plan, reading nothing', () => {
		// The one configuration where the parent exists on disk and not in the model, and
		// the only one where the rule's two clauses disagree about the same note. The
		// answer is the item's own type — a plan type — and no vault read is made to find
		// out, because the read it would take is precisely the one the user turned off.
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
		vault.addFile('Orphan task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
		const noParents = settingsWith({ showOutsideParents: false });
		const model = buildModel(vault.app, [vault.entries()[2]], noParents);
		const task = model.byPath.get('Orphan task.md');
		expect(task?.parent).toBeNull();
		expect(task && inCatalog(task)).toBe(false);
	});
});

describe('the rollup stops at a test', () => {
	it('takes nothing from a test and nothing from beneath one', () => {
		const { get } = fixture();
		// Asserted on the MODEL rather than on what a projection drew: the whole point is a
		// number that moves while nothing visible does.
		const pbi = get('A PBI');
		// `Plan task` is the PBI's one countable descendant. `Stray case` and everything
		// under it — including its own `Stray PBI` and `Stray bug` — contribute nothing.
		expect(pbi.descendantCount).toBe(1);
		expect(get('Feature').descendantCount).toBe(2);
		expect(get('Epic').descendantCount).toBe(3);
	});

	it('is a stronger exception than a context row or a marker', () => {
		// A context row and a marker each contribute nothing themselves while their
		// subtrees still reach their ancestors. A test contributes nothing AND nothing from
		// below it, because a `Task` under a `Test case` is test work.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Under case.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.byPath.get('Epic.md')?.descendantCount).toBe(0);
	});

	it('costs the catalog its own rollups, which is stated rather than solved', () => {
		const { get } = fixture();
		// The accepted cost: one walk computes rollups and it is the one told to stop at a
		// test, so a suite shows no "3 of 5 cases done". Asserted so the cost is a fact
		// somebody chose rather than a bug somebody rediscovers.
		expect(get('Suite').descendantCount).toBe(0);
	});
});

describe('the type cascade crosses no ladder', () => {
	const autoTyped = settingsWith({ autoType: true });

	it('leaves a Test case dropped on a PBI alone, at the root of the move and inside it', () => {
		const { get } = fixture();
		const { typeField, cascade } = computeTypeChanges(get('Stray case'), get('A PBI'), autoTyped, true);
		expect(typeField).toBeUndefined();
		expect(cascade).toEqual([]);
	});

	it('leaves a PBI dropped under a suite alone, the same way', () => {
		const { get } = fixture();
		const { typeField, cascade } = computeTypeChanges(get('Stray PBI'), get('Suite'), autoTyped, true);
		expect(typeField).toBeUndefined();
		expect(cascade).toEqual([]);
	});

	it('still retypes within one ladder, so the exemption is not a blanket one', () => {
		const { get } = fixture();
		// The guard against a fix that stops the cascade everywhere: moving a `Test case`
		// under another suite is a move on ONE ladder, and the rung rule still applies.
		const onto = computeTypeChanges(get('Stray case'), get('Suite'), autoTyped, true);
		expect(onto.typeField).toBeUndefined(); // already the right rung — a no-op, not a refusal
		const promoted = computeTypeChanges(get('Case'), null, autoTyped, true);
		expect(promoted.typeField).toBe('Test suite');
	});

	it('names the types a move leaves alone from the predicate the cascade asks', () => {
		// The generated README derives this list rather than naming `EXTRA_TYPES`, which
		// was already wrong about a marker and would be wrong again at the next type that
		// is neither a rung nor an extra.
		expect(ALL_TYPES.filter(keepsTypeOnMove)).toEqual([...EXTRA_TYPES, 'Milestone']);
		// The test types are deliberately NOT here: inside their own ladder they ARE
		// rewritten by position. What protects them from the plan is the crossing rule.
		for (const type of TEST_LEVELS) expect(keepsTypeOnMove(type)).toBe(false);
	});
});
