import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

function names(items: { title: string }[]): string[] {
	return items.map((i) => i.title);
}

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

	it('offers only the tags the Base results actually use', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', tags: ['archived'] } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', tags: ['active'] }, parentLink: 'Epic' });
		const filtered = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, filtered, settings);

		expect(model.observedTags).toEqual(['active']);
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
