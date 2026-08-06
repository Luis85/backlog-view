import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { computeDeliverableStateWrites, computeInitWrites } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/**
 * The Deliverable workflow's own state, planned: what a state change WOULD write —
 * no stamp logic, no span/date semantics, the `state`/`removeStateKey` shape and
 * nothing else (Scope) — plus the backfill's stub, scoped to the item's own type
 * rather than to a global configuration flag. Everything here is pure — nothing in
 * this file touches a vault.
 */

describe('computeInitWrites — the Deliverable state stub', () => {
	it('backfills the Deliverable state key only on Deliverable-typed items', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10 } });
		const configured = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
		const model = buildModel(vault.app, vault.entries(), configured);

		const writes = computeInitWrites(model, configured);

		const forD = writes.find((w) => w.file.path === 'D.md');
		const forP = writes.find((w) => w.file.path === 'P.md');
		expect(forD?.stubs).toContain('deliverableState');
		expect(forP?.stubs ?? []).not.toContain('deliverableState');
	});
});

describe('computeDeliverableStateWrites', () => {
	function deliverable(state: string | null) {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, ...(state !== null ? { deliverableStatus: state } : {}) },
		});
		const settings = { ...defaultSettings(), deliverableStateKey: 'deliverableStatus' };
		const model = buildModel(vault.app, vault.entries(), settings);
		return model.results[0];
	}

	it('writes the canonical value, untransformed', () => {
		const item = deliverable('Draft');
		expect(computeDeliverableStateWrites(item, 'Review')).toEqual([{ file: item.file, deliverableState: 'Review' }]);
	});

	it('plans nothing for a re-pick of the same state, case-insensitively', () => {
		expect(computeDeliverableStateWrites(deliverable('draft'), 'Draft')).toEqual([]);
	});

	it('removes the key for a drop on the no-state column', () => {
		const item = deliverable('Draft');
		const writes = computeDeliverableStateWrites(item, null);
		expect(writes).toEqual([{ file: item.file, removeDeliverableStateKey: true }]);
	});

	it('plans nothing for a stateless card dropped on the no-state column', () => {
		expect(computeDeliverableStateWrites(deliverable(null), null)).toEqual([]);
	});
});
