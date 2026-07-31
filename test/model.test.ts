import { describe, expect, it } from 'vitest';
import { buildModel, childLevelIndex, displayType } from '../src/model';
import { defaultSettings } from '../src/settings';
import { FakeVault } from './helpers';

const settings = defaultSettings();
/** Fixtures made of plain notes: opt out of the hierarchy scope so they survive the build. */
const unscoped = { ...settings, hierarchyOnly: false };

function names(items: { title: string }[]): string[] {
	return items.map((i) => i.title);
}

describe('buildModel', () => {
	it('treats items without a parent as sorted roots', () => {
		const vault = new FakeVault();
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('C.md', { frontmatter: { type: 'Epic', order: 30 } });

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
		vault.addFile('Zeta.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Beta.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('First.md', { frontmatter: { type: 'Epic', order: 5 } });
		vault.addFile('Second.md', { frontmatter: { type: 'Epic', order: '7.5' } });

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

		const model = buildModel(vault.app, vault.entries(), unscoped);
		const numeric = model.roots.find((r) => r.title === 'Numeric');
		const boolean = model.roots.find((r) => r.title === 'Boolean');

		expect(numeric?.typeName).toBe('123');
		expect(boolean?.typeName).toBe('true');
		expect(numeric?.levelIndex).toBe(-1);
	});

	it('skips non-markdown files and duplicate paths', () => {
		const vault = new FakeVault();
		vault.addFile('Note.md', { frontmatter: { type: 'Epic' } });
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

		// Custom is a top-level note with an unsupported type — only the opt-out keeps it.
		const model = buildModel(vault.app, vault.entries(), unscoped);
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

describe('buildModel hierarchy scope', () => {
	/** A backlog folder that also holds ordinary notes, as `file.inFolder()` returns it. */
	function mixedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Feature A1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('Backlog/Untyped child.md', { parentLink: 'Feature A1' });
		vault.addFile('Backlog/Sprint notes.md');
		vault.addFile('Backlog/README.md', { frontmatter: { tags: ['meta'] } });
		vault.addFile('Backlog/Retro.md', { frontmatter: { type: 'meeting-note' } });
		return vault;
	}

	it('keeps only the notes that carry a supported type or a parent', () => {
		const vault = mixedVault();
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.items).sort()).toEqual(['Epic A', 'Feature A1', 'Untyped child']);
		// Sprint notes, README and the meeting note are not work items
		expect(model.ignoredCount).toBe(3);
		expect(model.byPath.has('Backlog/Sprint notes.md')).toBe(false);
	});

	it('shows every note when the option is off', () => {
		const vault = mixedVault();
		const model = buildModel(vault.app, vault.entries(), unscoped);

		expect(model.items).toHaveLength(6);
		expect(model.ignoredCount).toBe(0);
	});

	it('keeps an untyped container that holds typed items', () => {
		const vault = new FakeVault();
		vault.addFile('Program.md');
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' }, parentLink: 'Program' });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Program']);
		expect(names(model.roots[0].children)).toEqual(['Epic']);
		expect(model.ignoredCount).toBe(0);
	});

	it('keeps orphans so their stale parent link stays fixable', () => {
		const vault = new FakeVault();
		vault.addFile('Orphan.md', { parentLink: 'Missing Epic' });
		vault.addFile('Pinned.md', { frontmatter: { parent: '' } });
		vault.addFile('Plain.md');
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots).sort()).toEqual(['Orphan', 'Pinned']);
		expect(model.roots.find((r) => r.title === 'Orphan')?.orphan).toBe(true);
		expect(model.ignoredCount).toBe(1);
	});

	it('ignores the states of notes outside the hierarchy', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Active' } });
		vault.addFile('Meeting.md', { frontmatter: { status: 'Scheduled' } });
		const model = buildModel(vault.app, vault.entries(), { ...settings, stateKey: 'status' });

		expect(model.observedStates).toEqual(['Active']);
	});

	it('drops a whole component, not just its top note', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Notes/Index.md');
		vault.addFile('Notes/Detail.md', { parentLink: 'Index' });
		const model = buildModel(vault.app, vault.entries(), settings);

		// Detail has a parent, so its component belongs — the rule is per subtree
		expect(names(model.items).sort()).toEqual(['Detail', 'Epic', 'Index']);
		expect(model.ignoredCount).toBe(0);
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
		const model = buildModel(vault.app, vault.entries(), unscoped);
		expect(model.roots).toHaveLength(3);
	});

	it('keeps folder-inferred notes in scope even when they have no type', () => {
		const vault = projectVault();
		// Same layout, but the use-case note only belongs through its folder note.
		const model = buildModel(vault.app, vault.entries(), folderSettings);

		expect(model.ignoredCount).toBe(0);
		expect(names(model.items)).toContain('Pay with saved card');
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
		vault.addFile('Item.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.roots[0].stateValue).toBeNull();
		expect(model.roots[0].done).toBe(false);
	});

	it('flags subtrees as done only when the item and every descendant are done', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		vault.addFile('F1.md', { frontmatter: { status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { status: 'Open' }, parentLink: 'Epic' });
		vault.addFile('S1.md', { frontmatter: { status: 'Done' }, parentLink: 'F2' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, stateKey: 'status' });

		const epic = model.roots[0];
		// A done parent with an open child must stay visible when completed items hide.
		expect(epic.subtreeDone).toBe(false);
		expect(epic.children.find((c) => c.title === 'F1')?.subtreeDone).toBe(true);
		const f2 = epic.children.find((c) => c.title === 'F2');
		expect(f2?.subtreeDone).toBe(false);
		expect(f2?.children[0].subtreeDone).toBe(true);
	});

	it('collects observed states deduped, open states first, then done states', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', status: 'Ready' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		vault.addFile('C.md', { frontmatter: { type: 'Epic', status: 'ready' } });
		vault.addFile('D.md', { frontmatter: { type: 'Epic', status: 'Active' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const model = buildModel(vault.app, vault.entries(), { ...settings, stateKey: 'status' });

		expect(model.observedStates).toEqual(['Active', 'Ready', 'Done']);
	});
});

describe('buildModel with parents outside the filter', () => {
	/** A three-level chain; the Base's filter returns only the PBI. */
	function chainVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		return vault;
	}

	/** Stand-in for a Base filtered to one level or state. */
	function only(vault: FakeVault, ...paths: string[]) {
		return vault.entries().filter((e) => paths.includes(e.file.path));
	}

	it('rebuilds the whole ancestor chain above a match', () => {
		const vault = chainVault();
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);

		expect(names(model.roots)).toEqual(['Epic']);
		const feature = model.roots[0].children[0];
		expect(feature.title).toBe('Feature');
		expect(names(feature.children)).toEqual(['PBI']);
		// The match is a result; everything above it is context
		expect(model.roots[0].outsideFilter).toBe(true);
		expect(feature.outsideFilter).toBe(true);
		expect(feature.children[0].outsideFilter).toBe(false);
		// With its parent present, the match is no longer a broken orphan
		expect(feature.children[0].orphan).toBe(false);
	});

	it('leaves the match flat when the option is off', () => {
		const vault = chainVault();
		const model = buildModel(vault.app, only(vault, 'PBI.md'), { ...settings, showOutsideParents: false });

		expect(names(model.roots)).toEqual(['PBI']);
		expect(model.roots[0].orphan).toBe(true);
	});

	it('gives context ancestors no Bases row', () => {
		const vault = chainVault();
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);

		expect(model.roots[0].entry).toBeNull();
		expect(model.byPath.get('PBI.md')?.entry).not.toBeNull();
	});

	it('keeps a shared ancestor as one row for several matches', () => {
		const vault = chainVault();
		vault.addFile('PBI 2.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Feature' });
		const model = buildModel(vault.app, only(vault, 'PBI.md', 'PBI 2.md'), settings);

		expect(names(model.roots)).toEqual(['Epic']);
		expect(names(model.roots[0].children[0].children)).toEqual(['PBI', 'PBI 2']);
		expect(model.items).toHaveLength(4);
	});

	it('does not re-add an ancestor the filter already returned', () => {
		const vault = chainVault();
		const model = buildModel(vault.app, only(vault, 'Epic.md', 'PBI.md'), settings);

		expect(model.items).toHaveLength(3);
		expect(model.roots[0].outsideFilter).toBe(false);
		expect(model.roots[0].children[0].outsideFilter).toBe(true);
	});

	it('terminates on a parent cycle outside the filter', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic' }, parentLink: 'B' });
		vault.addFile('B.md', { frontmatter: { type: 'Epic' }, parentLink: 'A' });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI' }, parentLink: 'A' });
		const model = buildModel(vault.app, only(vault, 'Child.md'), settings);

		expect(model.items).toHaveLength(3);
		expect(model.roots).toHaveLength(1);
	});

	it('still ignores a parent link that resolves to nothing', () => {
		const vault = new FakeVault();
		vault.addFile('Lonely.md', { frontmatter: { type: 'PBI' }, parentLink: 'Missing Epic' });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Lonely']);
		expect(model.roots[0].orphan).toBe(true);
	});

	it('rolls up only the descendants the filter returned', () => {
		const vault = chainVault();
		vault.addFile('PBI 2.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Feature' });
		const model = buildModel(vault.app, only(vault, 'PBI.md'), settings);

		// One result below it: the excluded PBI 2 is not counted, and neither is the
		// context Feature that merely carries the chain.
		expect(model.roots[0].descendantCount).toBe(1);
		expect(model.roots[0].children[0].outsideFilter).toBe(true);
	});

	it('keeps a context row out of the progress a result reports', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Active' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', status: 'Active' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'Done' }, parentLink: 'Feature' });
		// Epic and PBI are results; the Feature between them is not
		const filtered = vault.entries().filter((e) => e.file.path !== 'Feature.md');
		const model = buildModel(vault.app, filtered, { ...settings, stateKey: 'status' });
		const epic = model.roots[0];

		// One descendant, and it is done — the open context Feature counts for neither
		expect(epic.descendantCount).toBe(1);
		expect(epic.doneDescendants).toBe(1);
	});

	it('lets a finished subtree complete despite an open context row in the middle', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', status: 'Active' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'Done' }, parentLink: 'Feature' });
		const filtered = vault.entries().filter((e) => e.file.path !== 'Feature.md');
		const model = buildModel(vault.app, filtered, { ...settings, stateKey: 'status' });

		// Every result in the subtree is done, so it may hide; the excluded note's
		// own state is not this base's business.
		expect(model.roots[0].subtreeDone).toBe(true);
	});
});

describe('buildModel with folder-note ancestors outside the filter', () => {
	const folderSettings = { ...settings, folderHierarchy: true };

	/** The documented folder layout; the Base returns only the deepest use-case note. */
	function folderVault(): FakeVault {
		const vault = new FakeVault();
		const epics = 'product-managements/payments/epics';
		vault.addFile(`${epics}/Checkout/Checkout.md`, { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile(`${epics}/Checkout/One-click pay/One-click pay.md`, {
			frontmatter: { type: 'Feature', order: 10 },
		});
		vault.addFile(`${epics}/Checkout/One-click pay/use-cases/Pay with saved card.md`, {
			frontmatter: { type: 'PBI', order: 10 },
		});
		return vault;
	}

	function onlyUseCase(vault: FakeVault) {
		return vault.entries().filter((e) => e.file.path.includes('use-cases/'));
	}

	it('loads the folder notes an unlinked descendant infers its place from', () => {
		const vault = folderVault();
		const model = buildModel(vault.app, onlyUseCase(vault), folderSettings);

		expect(names(model.roots)).toEqual(['Checkout']);
		const feature = model.roots[0].children[0];
		expect(feature.title).toBe('One-click pay');
		expect(names(feature.children)).toEqual(['Pay with saved card']);
		// Both folder notes are context; the container folder still passes through
		expect(model.roots[0].outsideFilter).toBe(true);
		expect(feature.outsideFilter).toBe(true);
		expect(feature.children[0].outsideFilter).toBe(false);
	});

	it('leaves the descendant flat when folder inference is off', () => {
		const vault = folderVault();
		const model = buildModel(vault.app, onlyUseCase(vault), settings);

		expect(names(model.roots)).toEqual(['Pay with saved card']);
	});

	it('lets an explicit parent link still win over the folder note', () => {
		const vault = folderVault();
		vault.addFile('Elsewhere/Other Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('product-managements/payments/epics/Checkout/One-click pay/use-cases/Linked.md', {
			frontmatter: { type: 'PBI' },
			parentLink: 'Other Epic',
		});
		const linked = vault.entries().filter((e) => e.file.path.endsWith('Linked.md'));
		const model = buildModel(vault.app, linked, folderSettings);

		expect(names(model.roots)).toEqual(['Other Epic']);
		expect(names(model.roots[0].children)).toEqual(['Linked']);
	});

	it('does not chase folder notes for an item pinned to the top level', () => {
		const vault = folderVault();
		vault.addFile('product-managements/payments/epics/Checkout/Pinned.md', {
			frontmatter: { type: 'Epic', parent: '' },
		});
		const pinned = vault.entries().filter((e) => e.file.path.endsWith('Pinned.md'));
		const model = buildModel(vault.app, pinned, folderSettings);

		expect(names(model.roots)).toEqual(['Pinned']);
		expect(model.items).toHaveLength(1);
	});
});

describe('observed states with parents outside the filter', () => {
	it('offers only the states the Base results actually use', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Archived' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'Active' }, parentLink: 'Epic' });
		const filtered = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, filtered, { ...settings, stateKey: 'status' });

		// The Epic is context, so "Archived" is not this base's vocabulary
		expect(model.byPath.get('Epic.md')?.outsideFilter).toBe(true);
		expect(model.observedStates).toEqual(['Active']);
	});
});

describe('hierarchy scope when context rows are not loaded', () => {
	it('keeps a folder-inferred match whose folder note the filter excluded', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic/Epic.md', { frontmatter: { type: 'Epic' } });
		// Untyped and unlinked: it belongs only through the folder note above it
		vault.addFile('Backlog/Epic/use-cases/Note.md', {});
		const filtered = vault.entries().filter((e) => e.file.path.includes('use-cases/'));
		const hidden = { ...settings, folderHierarchy: true, showOutsideParents: false };

		const model = buildModel(vault.app, filtered, hidden);

		// The ancestor is not rendered, but the Base's own result must not vanish
		expect(names(model.roots)).toEqual(['Note']);
		expect(model.ignoredCount).toBe(0);
		expect(model.roots[0].parentExists).toBe(true);
	});

	it('still drops a note with no anchor at all', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Backlog/Loose note.md', {});
		const filtered = vault.entries().filter((e) => e.file.path.endsWith('Loose note.md'));
		const hidden = { ...settings, folderHierarchy: true, showOutsideParents: false };

		const model = buildModel(vault.app, filtered, hidden);

		// No folder note above it, no type, no link — genuinely not a work item
		expect(model.items).toHaveLength(0);
		expect(model.ignoredCount).toBe(1);
	});
});
