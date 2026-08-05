import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { organizeShelf } from '../../src/domain/shelf';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

function shelfFrom(vault: FakeVault, overrides: Partial<BacklogSettings> = {}) {
	const settings = { ...defaultSettings(), horizonKey: 'horizon', horizonValues: ['Now', 'Next', 'Later'], ...overrides };
	const model = buildModel(vault.app, vault.entries(), settings);
	return buildRoadmap(model, settings, () => true, 'horizons').shelf;
}

function titlesOf(cards: { item: { title: string } }[]): string[] {
	return cards.map((c) => c.item.title);
}

describe('organizing the shelf', () => {
	it('groups by ALL_TYPES order, not input order, with an Other group last', () => {
		const vault = new FakeVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('A Bug.md', { frontmatter: { type: 'Bug', order: 20 } });
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 30 } });
		// A root-level custom type with no parent would normally be pruned by
		// hierarchyOnly (the default) — it matches no declared level or extra type
		// and has nothing to anchor it, so it disables that pruning rather than
		// giving the note a parent it does not need for what this test is about.
		vault.addFile('A Custom.md', { frontmatter: { type: 'Spike', order: 40 } });

		const groups = organizeShelf(shelfFrom(vault, { hierarchyOnly: false }), 'tree', new Set());
		expect(groups.map((g) => g.type)).toEqual(['Epic', 'Task', 'Bug', 'Other']);
	});

	it('omits an empty group entirely rather than rendering it with nothing in it', () => {
		const vault = new FakeVault();
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const groups = organizeShelf(shelfFrom(vault), 'tree', new Set());
		expect(groups).toHaveLength(1);
		expect(groups[0].type).toBe('Epic');
	});

	it("omits a hidden type's group whole, and conserves every other card", () => {
		const vault = new FakeVault();
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 20 } });
		const shelf = shelfFrom(vault);

		const shown = organizeShelf(shelf, 'tree', new Set());
		expect(shown.flatMap((g) => g.cards)).toHaveLength(shelf.length);

		const filtered = organizeShelf(shelf, 'tree', new Set(['Task']));
		expect(filtered.map((g) => g.type)).toEqual(['Epic']);
		expect(filtered.flatMap((g) => g.cards)).toHaveLength(shelf.length - 1);
	});

	it('sorts within a group by title A to Z, never across groups', () => {
		const vault = new FakeVault();
		vault.addFile('Zed Task.md', { frontmatter: { type: 'Task', order: 10 } });
		vault.addFile('Ann Task.md', { frontmatter: { type: 'Task', order: 20 } });

		const byTitle = organizeShelf(shelfFrom(vault), 'title', new Set());
		expect(titlesOf(byTitle[0].cards)).toEqual(['Ann Task', 'Zed Task']);
	});

	it('sorts within a group by last modified, most recent first', () => {
		const vault = new FakeVault();
		// Declared in the OPPOSITE order from their mtimes, so a test that accidentally
		// fell back to input order (or sorted oldest-first) would still fail.
		vault.addFile('Older Task.md', { frontmatter: { type: 'Task', order: 10 }, mtime: 1000 });
		vault.addFile('Newer Task.md', { frontmatter: { type: 'Task', order: 20 }, mtime: 2000 });

		const byModified = organizeShelf(shelfFrom(vault), 'modified', new Set());
		expect(titlesOf(byModified[0].cards)).toEqual(['Newer Task', 'Older Task']);
	});

	it('groups an untyped child by its inferred level, not into Other', () => {
		const vault = new FakeVault();
		vault.addFile('An Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped child.md', { frontmatter: { order: 10 }, parentLink: 'An Epic' });
		const shelf = shelfFrom(vault);
		expect(shelf.some((c) => c.item.title === 'Untyped child')).toBe(true);

		const groups = organizeShelf(shelf, 'tree', new Set());
		const featureGroup = groups.find((g) => g.type === 'Feature');
		expect(featureGroup?.cards.map((c) => c.item.title)).toContain('Untyped child');
	});

	it('folds a differently-cased declared type into the one canonical group', () => {
		const vault = new FakeVault();
		vault.addFile('lowercase task.md', { frontmatter: { type: 'task', order: 10 } });
		const groups = organizeShelf(shelfFrom(vault), 'tree', new Set());
		expect(groups.map((g) => g.type)).toEqual(['Task']);
	});
});
