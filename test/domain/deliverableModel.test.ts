import { describe, expect, it } from 'vitest';
import { collectObservedDeliverableStates } from '../../src/domain/vocabulary';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

describe('collectObservedDeliverableStates', () => {
	it('reads only Deliverable-typed items, never a PBI carrying the same key', () => {
		const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, deliverableStatus: 'Stray' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(collectObservedDeliverableStates(model.items, settings)).toEqual(['Draft']);
	});

	it('sorts open states before its own done values', () => {
		const settings = {
			...defaultSettings(),
			deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'],
		};
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Published' } });
		vault.addFile('B.md', { frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(collectObservedDeliverableStates(model.items, settings)).toEqual(['Draft', 'Published']);
	});
});

describe('BacklogItem.deliverableStateValue / deliverableDone', () => {
	it('reads the Deliverable workflow state independently of the requirements one', () => {
		const settings = {
			...defaultSettings(),
			stateKey: 'status',
			deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'],
		};
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
		const settings = {
			...defaultSettings(),
			stateKey: 'status',
			deliverableStateKey: 'deliverableStatus',
			deliverableDoneValues: ['Published'],
		};
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
		const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
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
