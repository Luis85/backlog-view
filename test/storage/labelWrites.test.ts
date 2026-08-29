// The label properties at the write boundary, in a file of their own: `risk`, `priority`
// and the iteration goal share one writer (`applyLabels`), so the tests that hold it to
// the two standing rules — never a key no property names, a null removes rather than
// blanks — belong beside each other rather than at the end of the file the rest of the
// boundary lives in, which had reached its own line budget saying so. The assignee LEFT
// this writer on 2026-08-28 — it is a link to a `Resource` note now, not a typed string —
// and joined `applyLinks`, tested below beside the iteration and the release.
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { settingsWith } from '../helpers/settings';

const settings = settingsWith({});

describe('writing the risk level', () => {
	const risky = { ...settings, riskKey: 'risk' };

	it('sets a level, and a null removes the key rather than blanking it', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });

		await applyWrites(vault.app, risky, [{ file, risk: '1 - High' }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', risk: '1 - High' });

		await applyWrites(vault.app, risky, [{ file, risk: null }]);
		// Absence is the value that means nobody has judged this, so the key goes.
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});

	it('writes nothing when no risk property is configured', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });

		// The rule at the boundary, not at the caller: a plan naming a field no property
		// names must not invent a key, whatever reached this module carrying one.
		await applyWrites(vault.app, settings, [{ file, risk: '1 - High' }]);

		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});

	it('captures an inverse, so a level is undoable and a removal restorable', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI', risk: '3 - Low' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, risky, [{ file, risk: null }], undefined, (inv) => inverses.push(inv));
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });

		await applyRestores(vault.app, inverses);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', risk: '3 - Low' });
	});
});

describe('writing the priority', () => {
	const ranked = { ...settings, priorityKey: 'priority' };

	it('sets a rung, a null removes the key, and an unnamed property is never invented', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });

		await applyWrites(vault.app, ranked, [{ file, priority: '1 - Must' }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', priority: '1 - Must' });

		await applyWrites(vault.app, ranked, [{ file, priority: null }]);
		// Absence is the value that means nobody has ranked this, so the key goes.
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });

		// The rule at the boundary, not at the caller — asked of the third label property.
		await applyWrites(vault.app, settings, [{ file, priority: '1 - Must' }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});

	it('captures an inverse, so a rung is undoable and a removal restorable', async () => {
		// This is what fails if `touchedKeys` does not name the priority key: the write
		// lands and nothing can take it back, which is the shape of every undo hole.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI', priority: '2 - Should' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, ranked, [{ file, priority: null }], undefined, (inv) => inverses.push(inv));
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });

		await applyRestores(vault.app, inverses);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', priority: '2 - Should' });
	});
});

describe('writing the iteration goal', () => {
	// A plain string on the Iteration note, so it takes the SAME writer as risk and the
	// assignee — one more row in `applyLabels`' list, never a function of its own.
	const goaled = { ...settings, iterationGoalKey: 'goal' };

	it('sets a goal, and a null removes the key rather than blanking it', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Sprint.md', { frontmatter: { type: 'Iteration' } });

		await applyWrites(vault.app, goaled, [{ file, iterationGoal: 'Ship the board' }]);
		expect(vault.fm('Sprint.md')).toEqual({ type: 'Iteration', goal: 'Ship the board' });

		await applyWrites(vault.app, goaled, [{ file, iterationGoal: null }]);
		// Absence is the value that means nobody has stated a goal, so the key goes.
		expect(vault.fm('Sprint.md')).toEqual({ type: 'Iteration' });
	});

	it('writes nothing when no iteration goal property is configured', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Sprint.md', { frontmatter: { type: 'Iteration' } });

		// The rule at the boundary, asked of the third label property: the shared writer
		// must not invent a key for a field no property names, whatever reached this
		// module carrying one.
		await applyWrites(vault.app, settings, [{ file, iterationGoal: 'Ship the board' }]);

		expect(vault.fm('Sprint.md')).toEqual({ type: 'Iteration' });
	});

	it('captures an inverse, so a goal is undoable and a removal restorable', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Sprint.md', { frontmatter: { type: 'Iteration', goal: 'Ship the board' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, goaled, [{ file, iterationGoal: null }], undefined, (inv) => inverses.push(inv));
		expect(vault.fm('Sprint.md')).toEqual({ type: 'Iteration' });

		await applyRestores(vault.app, inverses);
		expect(vault.fm('Sprint.md')).toEqual({ type: 'Iteration', goal: 'Ship the board' });
	});
});

it('writes only the label it was given, whichever of the three that is', async () => {
	// The label properties share one writer, so each row of its list pairs a planned
	// value with a configured key — and this is the only test that fails if any two are
	// paired wrongly while all three are configured at once. Watched failing against a
	// swapped pairing, which it catches in every direction.
	const all = { ...settings, riskKey: 'risk', priorityKey: 'priority', iterationGoalKey: 'goal' };
	const vault = new FakeVault();
	const file = vault.addFile('Item.md', {
		frontmatter: { type: 'PBI', risk: '3 - Low', priority: '1 - Must', goal: 'Ship the board' },
	});

	await applyWrites(vault.app, all, [{ file, iterationGoal: 'Ship v2' }]);
	expect(vault.fm('Item.md')).toEqual({ type: 'PBI', risk: '3 - Low', priority: '1 - Must', goal: 'Ship v2' });

	await applyWrites(vault.app, all, [{ file, priority: '3 - Could' }]);
	expect(vault.fm('Item.md')).toEqual({ type: 'PBI', risk: '3 - Low', priority: '3 - Could', goal: 'Ship v2' });

	await applyWrites(vault.app, all, [{ file, risk: null }]);
	expect(vault.fm('Item.md')).toEqual({ type: 'PBI', priority: '3 - Could', goal: 'Ship v2' });
});

describe('writing the link properties', () => {
	// One rule read twice, which is what makes the loop worth having: `applyIteration` and
	// `applyRelease` were two spellings of it.
	const linked = { ...settings, iterationKey: 'iteration', releaseKey: '' };

	it('spells a wikilink, skips an unconfigured key, and a null removes rather than blanks', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });
		const sprint = vault.addFile('Sprint 4.md', { frontmatter: { type: 'Iteration' } });
		const release = vault.addFile('1.0.md', { frontmatter: { type: 'Release' } });

		// The release key is unconfigured, so its half of this batch invents no key.
		await applyWrites(vault.app, linked, [{ file, iteration: sprint, release }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', iteration: '[[Sprint 4]]' });

		await applyWrites(vault.app, linked, [{ file, iteration: null }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});
});

describe('writing the assignee', () => {
	// The link key's own shape, joined 2026-08-28: who an item is assigned to is a
	// `Resource` note now, spelled as a wikilink exactly as the iteration and the release
	// are, and it shares the same two standing rules.
	const assigned = { ...settings, assigneeKey: 'assignee' };

	it('spells a wikilink, and a null removes the key rather than blanking it', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });
		const dana = vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });

		await applyWrites(vault.app, assigned, [{ file, assignee: dana }]);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', assignee: '[[Dana]]' });

		await applyWrites(vault.app, assigned, [{ file, assignee: null }]);
		// Absence is the value that means nobody is on this, so the key goes.
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});

	it('writes nothing when no assignee property is configured', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI' } });
		const dana = vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });

		// The rule at the boundary, not at the caller: a plan naming a field no property
		// names must not invent a key, whatever reached this module carrying one.
		await applyWrites(vault.app, settings, [{ file, assignee: dana }]);

		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });
	});

	it('captures an inverse, so a link is undoable and a removal restorable', async () => {
		const vault = new FakeVault();
		vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI', assignee: '[[Dana]]' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, assigned, [{ file, assignee: null }], undefined, (inv) => inverses.push(inv));
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI' });

		await applyRestores(vault.app, inverses);
		expect(vault.fm('Item.md')).toEqual({ type: 'PBI', assignee: '[[Dana]]' });
	});
});
