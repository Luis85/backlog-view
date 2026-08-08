import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { childLevelIndex, displayType } from '../../src/domain/itemTypes';
import { LEVELS, defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';

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

		const model = buildModel(vault.app, vault.entries(), defaultSettings());
		let item = model.roots[0];
		while (item.children.length > 0) item = item.children[0];

		expect(item.depth).toBe(4);
		expect(item.levelIndex).toBe(LEVELS.length - 1);
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

	it('re-roots extra types alongside the level they rank with', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });
		// A Bug ranks with the PBI rung, so focusing that rung has to surface it —
		// otherwise it does not render at all, having no PBI above it to hang from.
		vault.addFile('Bug.md', { frontmatter: { type: 'Bug' }, parentLink: 'Epic' });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ focusLevel: 'PBI' }));
		expect(model.focused).toBe(true);
		expect(model.roots.map((r) => r.title).sort()).toEqual(['Bug', 'PBI']);
	});

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

	it('reads tags from a list or a single string, deduped and without the hash', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', tags: ['#alpha', 'beta', 'Alpha'] } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', tags: 'gamma, #delta epsilon' } });
		vault.addFile('C.md', { frontmatter: { type: 'Epic', tags: 42 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const tagsOf = (title: string) => model.items.find((i) => i.title === title)?.tags;

		expect(tagsOf('A')).toEqual(['alpha', 'beta']);
		expect(tagsOf('B')).toEqual(['gamma', 'delta', 'epsilon']);
		expect(tagsOf('C')).toEqual([]);
		expect(model.observedTags).toEqual(['alpha', 'beta', 'delta', 'epsilon', 'gamma']);
	});

	it('leaves tags empty when no tags property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', tags: ['alpha'] } });
		const model = buildModel(vault.app, vault.entries(), { ...settings, tagsKey: '' });

		expect(model.items[0].tags).toEqual([]);
		expect(model.observedTags).toEqual([]);
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

describe('buildModel refuses settings the resolver could not have produced', () => {
	/**
	 * The guard's own test, at the call site rather than on the predicate — which
	 * `settings.test.ts` covers separately. It exists because a fixture is the one producer
	 * that skips `resolveSettings`, and `buildModel` is the widest choke point a settings
	 * object passes through: see
	 * `docs/issues/A hand-built fixture can model a state the producer cannot produce.md`.
	 *
	 * The literal spread is what the rule bans and what this test is ABOUT, so it is written
	 * out rather than built through `settingsWith` — which would derive the very defect
	 * being driven here.
	 */
	it('throws, naming the relationship and where to go instead', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });
		// eslint-disable-next-line no-restricted-syntax
		const unreachable = { ...defaultSettings(), stateKey: 'status', states: ['New', 'Done'] };

		expect(() => buildModel(vault.app, vault.entries(), unreachable)).toThrow(/deliverableStates is empty/);
		expect(() => buildModel(vault.app, vault.entries(), unreachable)).toThrow(/resolveSettings/);
	});

	it('builds normally once that same fixture is one a user could set', () => {
		// The pair, so "refuses" cannot drift into "refuses everything".
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const reachable = settingsWith({ stateKey: 'status', states: ['New', 'Done'] });

		expect(buildModel(vault.app, vault.entries(), reachable).items).toHaveLength(1);
	});
});
