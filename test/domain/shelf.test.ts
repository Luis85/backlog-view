import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { organizeShelf, searchShelf } from '../../src/domain/shelf';
import { FakeVault } from '../helpers/vault';

function shelfFrom(vault: FakeVault, overrides: Partial<BacklogSettings> = {}) {
	const settings = settingsWith({ horizonKey: 'horizon', horizonValues: ['Now', 'Next', 'Later'], ...overrides });
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

describe('searching the shelf', () => {
	function shelfOf(): ReturnType<typeof shelfFrom> {
		const vault = new FakeVault();
		vault.addFile('Login screen.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Billing Export.md', { frontmatter: { type: 'Epic', order: 20 } });
		return shelfFrom(vault);
	}

	it('keeps the cards whose title holds the needle, whatever its case', () => {
		// One needle each way, because the search folds BOTH sides and an assertion that
		// only ever upper-cases the needle passes with the haystack's fold deleted — which
		// is what this test did until review caught it. `SCREEN` proves the needle is
		// folded, `export` against `Billing Export` proves the title is.
		//
		// Neither needle holds an `I`, and that is deliberate: the search folds in the
		// RUN's locale, so `LOGIN` against `Login screen` asserts ENGLISH case folding —
		// under `PBL_TEST_LOCALE=tr-TR` those are two different letters and the miss is
		// correct Turkish. The same trap `num()` names for a number, wearing a letter.
		// Which locale folds what is `test/i18n/localeFolds.test.ts`'s subject; this
		// assertion is only that case is ignored at all.
		expect(titlesOf(searchShelf(shelfOf(), 'SCREEN'))).toEqual(['Login screen']);
		expect(titlesOf(searchShelf(shelfOf(), 'export'))).toEqual(['Billing Export']);
	});

	it('narrows nothing on an empty or blank needle', () => {
		// Whitespace is not a search, so a stray space never empties the shelf. The rule
		// arrived with the toolbar's own quick filter (`FilterState.active`, withdrawn
		// 2026-08-17) and this is where it still holds.
		expect(titlesOf(searchShelf(shelfOf(), ''))).toHaveLength(2);
		expect(titlesOf(searchShelf(shelfOf(), '   '))).toHaveLength(2);
	});

	it('keeps the input order, leaving grouping and sort to say what comes first', () => {
		expect(titlesOf(searchShelf(shelfOf(), 'i'))).toEqual(['Login screen', 'Billing Export']);
	});
});
