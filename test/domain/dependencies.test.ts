import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { dependentsClosure } from '../../src/domain/dependencies';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { FakeVault } from '../helpers/vault';

/**
 * Prerequisites, from the acceptance criteria of `Dependencies as a property`.
 *
 * Every test here is written from the criterion rather than from the pass, which is why
 * they drive `buildModel` rather than `resolveDependencies` directly: the criteria are
 * about what the model knows, and the one about the tree being unchanged cannot be
 * asked of the resolver at all.
 */

const settings = settingsWith({ dependsOnKey: 'dependsOn' });

/** Prerequisite titles for one path, so a test reads as the sentence it is checking. */
function waitsFor(model: { byPath: Map<string, BacklogItem> }, path: string): string[] {
	return (model.byPath.get(path)?.prerequisites ?? []).map((item) => item.title);
}

function broken(model: { byPath: Map<string, BacklogItem> }, path: string): string[] {
	return model.byPath.get(path)?.brokenPrerequisites ?? [];
}

describe('reading what a note declares', () => {
	it('accepts one entry or many, wikilink or bare name', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20 } });
		// A list of real wikilinks, resolved through the link cache Obsidian would build.
		vault.addFile('Many.md', { frontmatter: { type: 'PBI', order: 30 }, listLinks: { dependsOn: ['A', 'B'] } });
		// A single bare name, which never reaches the link cache at all.
		vault.addFile('One.md', { frontmatter: { type: 'PBI', order: 40, dependsOn: 'A' } });
		// A single bracketed string, the shape a user types by hand into a scalar.
		vault.addFile('Bracketed.md', { frontmatter: { type: 'PBI', order: 50, dependsOn: '[[B]]' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(waitsFor(model, 'Many.md')).toEqual(['A', 'B']);
		expect(waitsFor(model, 'One.md')).toEqual(['A']);
		expect(waitsFor(model, 'Bracketed.md')).toEqual(['B']);
	});

	it('drops blank entries and collapses repeats into one prerequisite', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('Dup.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: ['A', '  ', '[[A]]', ''] },
		});

		const model = buildModel(vault.app, vault.entries(), settings);

		// Two spellings of one note are one dependency; the blanks are not entries at all.
		expect(waitsFor(model, 'Dup.md')).toEqual(['A']);
		expect(broken(model, 'Dup.md')).toEqual([]);
	});

	it('ignores an entry that is not text, or spells no name at all', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		// Frontmatter is user data: a list can hold a number, and a bracket pair can
		// enclose nothing. Neither is a prerequisite and neither is worth a mark.
		vault.addFile('Odd.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: [7, '[[]]', 'A'] } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(waitsFor(model, 'Odd.md')).toEqual(['A']);
		// The empty link is text the note holds, so it is a line the removal path can name.
		expect(broken(model, 'Odd.md')).toEqual(['[[]]']);
	});

	it('is absent entirely when the key is unbound', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } });

		const model = buildModel(vault.app, vault.entries(), defaultSettings());

		expect(waitsFor(model, 'B.md')).toEqual([]);
		expect(broken(model, 'B.md')).toEqual([]);
	});
});

describe('what becomes an edge, and what is marked', () => {
	it('resolves to a result, and to an excluded ancestor the model already loaded', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Inside.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: ['Inside', 'Epic'] },
			parentLink: 'Epic',
		});
		// The epic is context: loaded as an ancestor, not returned by the base.
		const entries = vault.entries().filter((entry) => entry.file.path !== 'Epic.md');

		const model = buildModel(vault.app, entries, settings);

		expect(model.byPath.get('Epic.md')?.outsideFilter).toBe(true);
		// An excluded note may be NAMED — that statement belongs to the result that made it.
		expect(waitsFor(model, 'Waiter.md')).toEqual(['Inside', 'Epic']);
		expect(broken(model, 'Waiter.md')).toEqual([]);
	});

	it('marks an entry naming a note this base never returned, and calls it nothing else', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: '[[Missing]]' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		// The raw text survives exactly as written: it is what a removal will match on.
		expect(broken(model, 'A.md')).toEqual(['[[Missing]]']);
		expect(waitsFor(model, 'A.md')).toEqual([]);
	});

	it('marks an entry naming a note the scope prune dropped', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'Meeting' } });
		// Returned by the base, but not a work item — no type and no parent — so the
		// scope prune drops it. Nothing about this test names a pass, only the outcome.
		vault.addFile('Meeting.md', { frontmatter: { attendees: 3 } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.byPath.has('Meeting.md')).toBe(false);
		expect(broken(model, 'A.md')).toEqual(['Meeting']);
	});

	it('does not read a context row own list', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, dependsOn: 'Inside' } });
		vault.addFile('Inside.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		const entries = vault.entries().filter((entry) => entry.file.path !== 'Epic.md');

		const model = buildModel(vault.app, entries, settings);

		// It renders and it parents. Its prerequisites are not this base's facts, so the
		// entry produces neither an edge nor a mark.
		expect(waitsFor(model, 'Epic.md')).toEqual([]);
		expect(broken(model, 'Epic.md')).toEqual([]);
		// And "not read at all" is asserted rather than implied. The two lines above were
		// the whole of this test while the reader still parsed and resolved the list and
		// the derivation discarded it afterwards — true effects, a comment claiming more
		// than they check, and a link lookup per entry on every rebuild.
		expect(model.byPath.get('Epic.md')?.dependsOnEntries).toEqual([]);
	});

	it('marks an item that names itself', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'A' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(broken(model, 'A.md')).toEqual(['A']);
		expect(waitsFor(model, 'A.md')).toEqual([]);
	});
});

describe('a cycle marks every entry in it, whatever order the notes arrive in', () => {
	/** `A → B → A`, built with the two notes added in the given order. */
	function cycle(first: 'A' | 'B'): FakeVault {
		const vault = new FakeVault();
		const add = {
			A: () => vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'B' } }),
			B: () => vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } }),
		};
		if (first === 'A') {
			add.A();
			add.B();
		} else {
			add.B();
			add.A();
		}
		return vault;
	}

	it.each(['A', 'B'] as const)('marks both edges when %s is read first', (first) => {
		const model = buildModel(cycle(first).app, cycle(first).entries(), settings);

		// Neither is "the one that closed it": that is a fact about the traversal, and it
		// would move between the two notes when the Base re-sorts.
		expect(broken(model, 'A.md')).toEqual(['B']);
		expect(broken(model, 'B.md')).toEqual(['A']);
		expect(waitsFor(model, 'A.md')).toEqual([]);
		expect(waitsFor(model, 'B.md')).toEqual([]);
	});

	it('marks a longer cycle whole, and leaves a healthy edge into it alone', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'C' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } });
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: 'B' } });
		vault.addFile('Outside.md', { frontmatter: { type: 'PBI', order: 40, dependsOn: 'A' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(broken(model, 'A.md')).toEqual(['C']);
		expect(broken(model, 'B.md')).toEqual(['A']);
		expect(broken(model, 'C.md')).toEqual(['B']);
		// Depending on something that is in a cycle is not itself a cycle.
		expect(waitsFor(model, 'Outside.md')).toEqual(['A']);
		expect(broken(model, 'Outside.md')).toEqual([]);
	});
});

describe('what dependencies must not touch', () => {
	/** The same fixture, with a cycle in it, built with the key bound and unbound. */
	function shapes(): { withKey: string; without: string } {
		const build = (used: ReturnType<typeof defaultSettings>) => {
			const vault = new FakeVault();
			vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, dependsOn: 'B' }, parentLink: 'Epic' });
			vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' }, parentLink: 'Epic' });
			vault.addFile('C.md', { frontmatter: { type: 'Task', order: 30, dependsOn: 'Nope' }, parentLink: 'A' });
			const model = buildModel(vault.app, vault.entries(), used);
			// Everything structural, in one string: shape, order, level and depth.
			return model.items
				.map((i) => `${i.file.path}@${i.depth}/${i.effectiveLevelIndex}/${i.parent?.title ?? '-'}`)
				.join(' ');
		};
		return { withKey: build(settings), without: build(defaultSettings()) };
	}

	it('changes no item hiding, parent, rank, level or depth — broken edges included', () => {
		const { withKey, without } = shapes();
		expect(withKey).toBe(without);
	});

	it('does not roll up: a parent never acquires a child prerequisite', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Dep.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'Dep' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(waitsFor(model, 'Child.md')).toEqual(['Dep']);
		expect(waitsFor(model, 'Epic.md')).toEqual([]);
	});
});

describe('which picks would close a loop', () => {
	it('names the item itself and everything already waiting on it, however far down', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } });
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: 'B' } });
		vault.addFile('Elsewhere.md', { frontmatter: { type: 'PBI', order: 40 } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const prerequisites = new Map(
			[...model.byPath].map(([path, item]) => [path, item.prerequisites.map((p) => p.file.path)]),
		);

		// Naming any of these as a prerequisite of A creates a path back to A.
		const closes = dependentsClosure('A.md', prerequisites);
		expect([...closes].sort()).toEqual(['A.md', 'B.md', 'C.md']);
		expect(closes.has('Elsewhere.md')).toBe(false);
	});

	it('reaches every dependent when several wait on the same item', () => {
		// The fan-out case: one prerequisite named by two notes, which is what a reverse
		// index built one entry at a time has to accumulate rather than overwrite.
		const vault = new FakeVault();
		vault.addFile('Shared.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('First.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'Shared' } });
		vault.addFile('Second.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: 'Shared' } });
		vault.addFile('Third.md', { frontmatter: { type: 'PBI', order: 40, dependsOn: 'Second' } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const prerequisites = new Map(
			[...model.byPath].map(([path, item]) => [path, item.prerequisites.map((p) => p.file.path)]),
		);

		expect([...dependentsClosure('Shared.md', prerequisites)].sort()).toEqual([
			'First.md',
			'Second.md',
			'Shared.md',
			'Third.md',
		]);
	});
});
