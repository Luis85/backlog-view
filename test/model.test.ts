import { describe, expect, it } from 'vitest';
import { buildModel, childLevelIndex, displayType } from '../src/model';
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

	it('sorts unordered siblings last, preserving the Base result order', () => {
		const vault = new FakeVault();
		// Entry order stands in for the sort the user configured in the Bases toolbar
		vault.addFile('Zeta.md');
		vault.addFile('Beta.md');
		vault.addFile('First.md', { frontmatter: { order: 5 } });
		vault.addFile('Second.md', { frontmatter: { order: '7.5' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		// Ranked items ignore the result order; unranked ones keep it (Zeta before Beta)
		expect(names(model.roots)).toEqual(['First', 'Second', 'Zeta', 'Beta']);
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

	it('coerces non-string type values to strings', () => {
		const vault = new FakeVault();
		vault.addFile('Numeric.md', { frontmatter: { type: 123 } });
		vault.addFile('Boolean.md', { frontmatter: { type: true } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const numeric = model.roots.find((r) => r.title === 'Numeric');
		const boolean = model.roots.find((r) => r.title === 'Boolean');

		expect(numeric?.typeName).toBe('123');
		expect(boolean?.typeName).toBe('true');
		expect(numeric?.levelIndex).toBe(-1);
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

	it('implies child levels from the parent type, not the visual depth', () => {
		const vault = new FakeVault();
		// A Feature at the top level (no epic above it yet)
		vault.addFile('Standalone Feature.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Untyped Child.md', { parentLink: 'Standalone Feature' });

		const model = buildModel(vault.app, vault.entries(), settings);
		const child = model.roots[0].children[0];

		// Depth-based implication would wrongly say Feature (depth 1); the parent
		// is a Feature, so the child must imply PBI.
		expect(child.impliedType).toBe(true);
		expect(displayType(child, settings)).toBe('PBI');
	});

	it('chains the ladder through unknown types without focus re-rooting', () => {
		const vault = new FakeVault();
		// Feature at the top; an unknown "Bugfix" occupies the PBI slot below it.
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Bugfix Item.md', { frontmatter: { type: 'Bugfix' }, parentLink: 'Feature' });
		vault.addFile('Untyped.md', { parentLink: 'Bugfix Item' });

		const model = buildModel(vault.app, vault.entries(), settings);
		const bugfix = model.roots[0].children[0];
		const grandchild = bugfix.children[0];

		expect(bugfix.effectiveLevelIndex).toBe(2);
		// New or backfilled children of the Bugfix must be Tasks, not PBIs
		expect(childLevelIndex(bugfix, settings.levels)).toBe(3);
		expect(displayType(grandchild, settings)).toBe('Task');
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

describe('buildModel with folder hierarchy', () => {
	const folderSettings = { ...settings, folderHierarchy: true };

	/** The documented layout: domains > epics > epic folders > feature folders > use-cases. */
	function projectVault(): FakeVault {
		const vault = new FakeVault();
		const epics = 'product-managements/payments/epics';
		vault.addFile(`${epics}/Checkout/Checkout.md`, { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile(`${epics}/Checkout/One-click pay/One-click pay.md`, {
			frontmatter: { type: 'Feature', order: 10 },
		});
		vault.addFile(`${epics}/Checkout/One-click pay/use-cases/Pay with saved card.md`, {
			frontmatter: { order: 10 },
		});
		return vault;
	}

	it('infers the hierarchy from folder notes in a domain/epics layout', () => {
		const vault = projectVault();
		const model = buildModel(vault.app, vault.entries(), folderSettings);

		expect(names(model.roots)).toEqual(['Checkout']);
		const epic = model.roots[0];
		expect(names(epic.children)).toEqual(['One-click pay']);
		const feature = epic.children[0];
		// The use-cases container has no folder note; the walk passes through it
		expect(names(feature.children)).toEqual(['Pay with saved card']);
		const pbi = feature.children[0];
		expect(pbi.orphan).toBe(false);
		expect(pbi.impliedType).toBe(true);
		expect(displayType(pbi, folderSettings)).toBe('PBI');
	});

	it('stays off unless the option is enabled', () => {
		const vault = projectVault();
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.roots).toHaveLength(3);
	});

	it('lets explicit parent links override the folder structure', () => {
		const vault = new FakeVault();
		vault.addFile('epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('epics/Beta/Beta.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('epics/Alpha/Stray Feature/Stray Feature.md', {
			frontmatter: { type: 'Feature' },
			parentLink: 'Beta',
		});
		const model = buildModel(vault.app, vault.entries(), folderSettings);

		const beta = model.roots.find((r) => r.title === 'Beta');
		expect(names(beta?.children ?? [])).toEqual(['Stray Feature']);
	});

	it('pins items to the top level when the parent key is explicitly empty', () => {
		const vault = new FakeVault();
		vault.addFile('epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('epics/Alpha/Detached.md', { frontmatter: { parent: '' } });
		const model = buildModel(vault.app, vault.entries(), folderSettings);

		const detached = model.roots.find((r) => r.title === 'Detached');
		expect(detached).toBeDefined();
		expect(detached?.orphan).toBe(false);
		expect(detached?.explicitRoot).toBe(true);
	});
});

describe('buildModel with a focus level', () => {
	function focusVault() {
		const vault = new FakeVault();
		vault.addFile('Epic 1.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feat 1a.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic 1' });
		vault.addFile('Story 1a1.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feat 1a' });
		vault.addFile('Epic 2.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Feat 2a.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic 2' });
		// A Feature already at the top level
		vault.addFile('Loose Feature.md', { frontmatter: { type: 'Feature', order: 5 } });
		return vault;
	}

	it('re-roots the tree at the topmost items of the focus level', () => {
		const vault = focusVault();
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Feature' });

		expect(model.focused).toBe(true);
		expect(names(model.roots).sort()).toEqual(['Feat 1a', 'Feat 2a', 'Loose Feature']);
		expect(model.roots.every((r) => r.focusRoot)).toBe(true);
		// Visual depth resets; semantic level and children stay intact
		const feat1a = model.roots.find((r) => r.title === 'Feat 1a');
		expect(feat1a?.depth).toBe(0);
		expect(feat1a?.levelIndex).toBe(1);
		expect(names(feat1a?.children ?? [])).toEqual(['Story 1a1']);
		expect(feat1a?.children[0].depth).toBe(1);
		// The real parent pointer survives for correct move semantics
		expect(feat1a?.parent?.title).toBe('Epic 1');
	});

	it('does not duplicate nested items of the same level', () => {
		const vault = new FakeVault();
		vault.addFile('Outer.md', { frontmatter: { type: 'Feature' } });
		vault.addFile('Inner.md', { frontmatter: { type: 'Feature' }, parentLink: 'Outer' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Feature' });

		expect(names(model.roots)).toEqual(['Outer']);
		expect(model.items).toHaveLength(2);
	});

	it('includes untyped items whose implied level matches', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Implied Feature.md', { parentLink: 'Epic' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Feature' });

		expect(names(model.roots)).toEqual(['Implied Feature']);
	});

	it('keeps the effective level of unknown types when re-rooted', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feat.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Bugfix Item.md', { frontmatter: { type: 'Bugfix' }, parentLink: 'Feat' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Feature' });

		const bugfix = model.roots[0].children[0];
		expect(bugfix.levelIndex).toBe(-1);
		// Visually one level below the focused Feature, but on the ladder it sits
		// at the PBI slot, so its children imply Task (index 3), not PBI
		expect(bugfix.depth).toBe(1);
		expect(bugfix.effectiveLevelIndex).toBe(2);
		expect(childLevelIndex(bugfix, settings.levels)).toBe(3);
	});

	it('ignores a focus level that is not in the configured levels', () => {
		const vault = focusVault();
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Sprint' });
		expect(model.focused).toBe(false);
		expect(names(model.roots)).toEqual(['Loose Feature', 'Epic 1', 'Epic 2']);
	});
});

describe('buildModel progress rollup', () => {
	it('counts done descendants using the configured state values, case-insensitively', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'In Progress' } });
		vault.addFile('F1.md', { frontmatter: { status: 'done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { status: 'Open' }, parentLink: 'Epic' });
		vault.addFile('S1.md', { frontmatter: { status: 'CLOSED' }, parentLink: 'F2' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, stateKey: 'status' });

		const epic = model.roots[0];
		expect(epic.done).toBe(false);
		expect(epic.descendantCount).toBe(3);
		expect(epic.doneDescendants).toBe(2);
		const f2 = epic.children.find((c) => c.title === 'F2');
		expect(f2?.doneDescendants).toBe(1);
	});

	it('tracks no state when the state property is unset', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { status: 'Done' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.roots[0].stateValue).toBeNull();
		expect(model.roots[0].done).toBe(false);
	});
});
