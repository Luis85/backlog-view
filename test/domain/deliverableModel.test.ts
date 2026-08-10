import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { collectObservedDeliverableStates } from '../../src/domain/vocabulary';
import { buildModel } from '../../src/domain/model';
import { resolvedDeliverableStateKey } from '../../src/domain/optionalProperties';
import { ALL_TYPES } from '../../src/domain/typeVocabulary';
import { applyWrites } from '../../src/storage/frontmatter';
import { FakeVault } from '../helpers/vault';

describe('collectObservedDeliverableStates', () => {
	it('reads only Deliverable-typed items, never a PBI carrying the same key', () => {
		const settings = settingsWith({ deliverableStateKey: 'deliverableStatus' });
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, deliverableStatus: 'Stray' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(collectObservedDeliverableStates(model.items, settings)).toEqual(['Draft']);
	});

	it('sorts open states before its own done values', () => {
		const settings = settingsWith({ deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'], });
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Published' } });
		vault.addFile('B.md', { frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(collectObservedDeliverableStates(model.items, settings)).toEqual(['Draft', 'Published']);
	});
});

describe('BacklogItem.deliverableStateValue / deliverableDone', () => {
	it('reads the Deliverable workflow state independently of the requirements one', () => {
		const settings = settingsWith({ stateKey: 'status',
			deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'], });
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
		});
		const model = buildModel(vault.app, vault.entries(), settings);
		const d = model.items.find((i) => i.title === 'D');
		if (!d) throw new Error('missing D');

		expect(d.deliverableStateValue).toBe('Draft');
		expect(d.deliverableDone).toBe(false);
		// The requirements workflow's own fields are untouched by the second one.
		expect(d.stateValue).toBe('Done');
		expect(d.done).toBe(true);
	});

	it('marks deliverableDone true for a Deliverable done in ITS OWN workflow, requirements state untouched', () => {
		// Found by review: every other test in this describe block only ever asserts
		// deliverableDone === false, so an implementation that hardcoded false (or never
		// wired deliverableDoneValues into addItem at all) would still pass the suite.
		// This is the one case that actually exercises the true branch.
		const settings = settingsWith({ stateKey: 'status',
			deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'], });
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Open', deliverableStatus: 'Published' },
		});
		const model = buildModel(vault.app, vault.entries(), settings);
		const d = model.items.find((i) => i.title === 'D');
		if (!d) throw new Error('missing D');

		expect(d.deliverableDone).toBe(true);
		// Done in ITS OWN workflow, not the requirements one — 'Open' names no requirements
		// done value, so item.done must stay false.
		expect(d.stateValue).toBe('Open');
		expect(d.done).toBe(false);
	});

	it('collects observed Deliverable states onto the model, scoped to Deliverable items', () => {
		const settings = settingsWith({ deliverableStateKey: 'deliverableStatus' });
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.observedDeliverableStates).toEqual(['Draft']);
	});

	it('is null when the Deliverable state property is unconfigured', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const model = buildModel(vault.app, vault.entries(), defaultSettings());
		const d = model.items.find((i) => i.title === 'D');
		if (!d) throw new Error('missing D');

		expect(d.deliverableStateValue).toBeNull();
		expect(d.deliverableDone).toBe(false);
	});
});

describe('the Deliverable workflow falls back to the shared one, on the READ side', () => {
	it('reads deliverableStateValue off the shared state key when its own is unset', () => {
		const settings = settingsWith({ stateKey: 'status' });
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'Draft' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const d = model.items.find((i) => i.title === 'D');
		if (!d) throw new Error('missing D');

		expect(d.deliverableStateValue).toBe('Draft');
		// Both fields read the same property under the fallback — neither is a second
		// opinion about the note.
		expect(d.stateValue).toBe('Draft');
	});

	/**
	 * The invariant the root CLAUDE.md asks for: the reader and the writer must not be
	 * allowed to disagree about which key the Deliverable workflow's state lives in. This
	 * drives BOTH `addItem` (the model's read) and `applyWrites`' (the write) resolution
	 * of the same fallback through one write-then-read round trip, so a reader that
	 * resolved the fallback while the writer kept resolving the raw (unset) key — landing
	 * bytes nowhere — would show up here as the read finding nothing after the write.
	 */
	it('a card move under the fallback lands on the shared key, and the model reads it back', async () => {
		const settings = settingsWith({ stateKey: 'status' });
		const vault = new FakeVault();
		const file = vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });

		await applyWrites(vault.app, settings, [{ file, deliverableState: 'Draft' }]);
		expect(vault.fm('D.md')['status']).toBe('Draft');

		const model = buildModel(vault.app, vault.entries(), settings);
		const d = model.items.find((i) => i.title === 'D');
		if (!d) throw new Error('missing D');
		expect(d.deliverableStateValue).toBe('Draft');
	});

	it('resolvedDeliverableStateKey names the property both sides actually used', () => {
		const settings = settingsWith({ stateKey: 'status' });
		expect(resolvedDeliverableStateKey(settings)).toBe('status');
	});

	it('a Deliverable done under the fallback counts once in the parent rollup, not twice', () => {
		// `done` and `deliverableDone` read the same property and, once both done-value
		// lists are the same, agree for the same note — but the rollup (`assignAll`)
		// only ever reads `child.done`, never `child.deliverableDone`, so this is not
		// two facts about the same subtree being folded in twice.
		const settings = settingsWith({ stateKey: 'status', doneValues: ['Done'], deliverableDoneValues: ['Done'] });
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'Done' }, parentLink: 'Epic' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const epic = model.items.find((i) => i.title === 'Epic');
		if (!epic) throw new Error('missing Epic');

		expect(epic.descendantCount).toBe(1);
		expect(epic.doneDescendants).toBe(1);
	});
});

describe('BacklogModel.deliverableResults — immune to the focus level', () => {
	/**
	 * The Deliverable hangs directly off the Epic — a SIBLING of the Feature, never one
	 * of its descendants. Before this board was made focus-immune, focusing a level
	 * other than PBI/Deliverable re-rooted `model.results` at that level's own items,
	 * and `collectFocusRoots` never walks into a branch holding no match for the
	 * focused level — so a Deliverable sitting beside it, rather than under it, dropped
	 * out of `model.results` (and, with it, off the Deliverables board) entirely. The
	 * human's own words: switching to that board must never make a Deliverable
	 * invisible "as there are only the deliverables to display" — driven over every
	 * level `ALL_TYPES` names, plus no focus at all, rather than picking one favourite
	 * level to prove immune.
	 */
	function fixture(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI' });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 20 }, parentLink: 'Epic' });
		return vault;
	}

	it.each(['', ...ALL_TYPES])('contains the Deliverable under focus level %j', (level) => {
		const vault = fixture();
		const settings = settingsWith({ focusLevel: level });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.deliverableResults.map((item) => item.title)).toEqual(['D']);
	});
});
