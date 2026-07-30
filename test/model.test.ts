import { describe, expect, it } from 'vitest';
import { buildModel, displayType } from '../src/model';
import { defaultSettings } from '../src/settings';
import { FakeVault } from './helpers';

const settings = defaultSettings();

function names(items: { title: string }[]): string[] {
	return items.map((i) => i.title);
}

describe('buildModel', () => {
	it('treats items without a parent as sorted roots', () => {
		const vault = new FakeVault();
		vault.addFile('B.md', { frontmatter: { order: 20 } });
		vault.addFile('A.md', { frontmatter: { order: 10 } });
		vault.addFile('C.md', { frontmatter: { order: 30 } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['A', 'B', 'C']);
		expect(model.items).toHaveLength(3);
		expect(model.roots.every((r) => r.depth === 0)).toBe(true);
		expect(model.roots.every((r) => !r.orphan)).toBe(true);
	});

	it('builds a hierarchy from frontmatter parent links', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Story.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Epic']);
		const epic = model.roots[0];
		expect(names(epic.children)).toEqual(['Feature']);
		expect(names(epic.children[0].children)).toEqual(['Story']);
		expect(epic.depth).toBe(0);
		expect(epic.children[0].depth).toBe(1);
		expect(epic.children[0].children[0].depth).toBe(2);
		expect(epic.descendantCount).toBe(2);
		expect(epic.children[0].descendantCount).toBe(1);
		// Depth-first visual order
		expect(names(model.items)).toEqual(['Epic', 'Feature', 'Story']);
	});

	it('sorts siblings by order, placing unordered items last alphabetically', () => {
		const vault = new FakeVault();
		vault.addFile('Zeta.md');
		vault.addFile('Beta.md');
		vault.addFile('First.md', { frontmatter: { order: 5 } });
		vault.addFile('Second.md', { frontmatter: { order: '7.5' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['First', 'Second', 'Beta', 'Zeta']);
		expect(model.roots[1].order).toBe(7.5);
	});

	it('flags items whose parent is outside the result set as orphaned roots', () => {
		const vault = new FakeVault();
		vault.addFile('Child.md', { parentLink: 'Missing Epic' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Child']);
		expect(model.roots[0].orphan).toBe(true);
		expect(model.roots[0].hasParentValue).toBe(true);
		expect(model.roots[0].parent).toBeNull();
	});

	it('resolves raw string parents without a link cache', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md');
		vault.addFile('Wiki.md', { frontmatter: { parent: '[[Epic]]' } });
		vault.addFile('Plain.md', { frontmatter: { parent: 'Epic' } });
		vault.addFile('Alias.md', { frontmatter: { parent: '[[Epic|The Epic]]' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Epic']);
		expect(names(model.roots[0].children).sort()).toEqual(['Alias', 'Plain', 'Wiki']);
	});

	it('uses the first entry of a list-valued parent property', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md');
		vault.addFile('Child.md', { frontmatter: { parent: ['[[Epic]]', '[[Other]]'] } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Epic']);
		expect(names(model.roots[0].children)).toEqual(['Child']);
	});

	it('breaks parent cycles instead of dropping the items', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { parentLink: 'B' });
		vault.addFile('B.md', { parentLink: 'A' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.items).toHaveLength(2);
		expect(model.roots).toHaveLength(1);
		expect(model.roots[0].title).toBe('A');
		expect(model.roots[0].orphan).toBe(true);
		expect(names(model.roots[0].children)).toEqual(['B']);
	});

	it('treats a self-parenting item as a root', () => {
		const vault = new FakeVault();
		vault.addFile('Loop.md', { parentLink: 'Loop' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Loop']);
		expect(model.roots[0].children).toHaveLength(0);
	});

	it('skips non-markdown files and duplicate paths', () => {
		const vault = new FakeVault();
		vault.addFile('Note.md');
		vault.addFile('image.png');
		const entries = [...vault.entries(), ...vault.entries()];

		const model = buildModel(vault.app, entries, settings);

		expect(model.items).toHaveLength(1);
		expect(model.items[0].title).toBe('Note');
	});

	it('derives level from the type property, falling back to depth', () => {
		const vault = new FakeVault();
		vault.addFile('Top.md', { frontmatter: { type: 'epic' } });
		vault.addFile('Untyped.md', { parentLink: 'Top' });
		vault.addFile('Custom.md', { frontmatter: { type: 'Bugfix' } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const top = model.roots.find((r) => r.title === 'Top');
		const custom = model.roots.find((r) => r.title === 'Custom');
		const untyped = top?.children[0];

		// Case-insensitive match against the configured level names
		expect(top?.levelIndex).toBe(0);
		expect(top ? displayType(top, settings) : '').toBe('Epic');
		// Unknown type keeps its raw name with no level color
		expect(custom?.levelIndex).toBe(-1);
		expect(custom ? displayType(custom, settings) : '').toBe('Bugfix');
		// Missing type implies the level from tree depth
		expect(untyped?.impliedType).toBe(true);
		expect(untyped?.levelIndex).toBe(1);
		expect(untyped ? displayType(untyped, settings) : '').toBe('Feature');
	});

	it('clamps implied levels to the deepest configured level', () => {
		const vault = new FakeVault();
		vault.addFile('L0.md');
		vault.addFile('L1.md', { parentLink: 'L0' });
		vault.addFile('L2.md', { parentLink: 'L1' });
		vault.addFile('L3.md', { parentLink: 'L2' });
		vault.addFile('L4.md', { parentLink: 'L3' });

		const model = buildModel(vault.app, vault.entries(), settings);
		let item = model.roots[0];
		while (item.children.length > 0) item = item.children[0];

		expect(item.depth).toBe(4);
		expect(item.levelIndex).toBe(settings.levels.length - 1);
		expect(displayType(item, settings)).toBe('Task');
	});
});
