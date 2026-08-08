import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/**
 * The Deliverable workflow's own write path, split out of `frontmatter.test.ts`
 * (which sat at that file's own line budget) — a coherent subject on its own, the
 * same split `test/view/deliverablesToolbar.test.ts` already made for the toolbar.
 */
const settings = defaultSettings();

describe('applyWrites — the Deliverable workflow', () => {
	it('writes the Deliverable state to its own configured key, never to an empty key', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('D.md', { frontmatter: { type: 'Deliverable' } });
		const configured = { ...settings, deliverableStateKey: 'deliverableStatus' };

		await applyWrites(vault.app, configured, [{ file: item, deliverableState: 'Draft' }]);
		expect(vault.fm('D.md')['deliverableStatus']).toBe('Draft');

		await applyWrites(vault.app, settings, [{ file: item, deliverableState: 'Review' }]);
		expect(vault.fm('D.md')['deliverableStatus']).toBe('Draft');
	});

	it('removes the Deliverable state key, and undo puts it back', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('D.md', { frontmatter: { type: 'Deliverable', deliverableStatus: 'Draft' } });
		const configured = { ...settings, deliverableStateKey: 'deliverableStatus' };
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, configured, [{ file: item, removeDeliverableStateKey: true }], undefined, (inv) => inverses.push(inv));
		expect('deliverableStatus' in vault.fm('D.md')).toBe(false);

		await applyRestores(vault.app, inverses);
		expect(vault.fm('D.md')['deliverableStatus']).toBe('Draft');
	});

	it("falls back to the shared state key when its own is unset — write, remove, undo", async () => {
		// "Deliverables don't need their own dedicated status property" — the write must
		// land on the requirements workflow's own key rather than being dropped, which is
		// what an unresolved empty key would otherwise do (see "never to an empty key",
		// above). Capture-and-restore must agree with the same fallback, or the undo
		// would have no inverse to put the value back with.
		const vault = new FakeVault();
		const item = vault.addFile('D.md', { frontmatter: { type: 'Deliverable' } });
		const shared = { ...settings, stateKey: 'status' };
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, shared, [{ file: item, deliverableState: 'Draft' }]);
		expect(vault.fm('D.md')['status']).toBe('Draft');
		await applyWrites(vault.app, shared, [{ file: item, removeDeliverableStateKey: true }], undefined, (inv) => inverses.push(inv));
		expect('status' in vault.fm('D.md')).toBe(false);
		await applyRestores(vault.app, inverses);
		expect(vault.fm('D.md')['status']).toBe('Draft');
	});

	it('stubs a shared key exactly once when both workflows explicitly share it', async () => {
		// `configProblems`' new exemption lets this configuration reach `applyWrites`
		// for the first time, so `missingKeyStubs` stubbing both `state` and
		// `deliverableState` onto one raw key never had a live path before. Two
		// duplicate entries would make the second look like a restore conflict.
		const vault = new FakeVault();
		const item = vault.addFile('D.md', { frontmatter: { type: 'Deliverable' } });
		const shared = { ...settings, stateKey: 'status', deliverableStateKey: 'status' };
		const inverses: RestoreWrite[] = [];
		await applyWrites(vault.app, shared, [{ file: item, stubs: ['state', 'deliverableState'] }], undefined, (inv) => inverses.push(inv));

		expect(inverses[0].keys).toHaveLength(1);
		expect((await applyRestores(vault.app, inverses)).conflicts).toBe(0);
	});
});
