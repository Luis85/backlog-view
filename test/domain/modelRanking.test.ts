import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

describe('buildModel ranking', () => {
	it('ranks every loaded item globally, context rows included, unranked last', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('PBI C.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('PBI D.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.ranked.map((i) => i.file.basename)).toEqual(['Epic B', 'PBI C', 'Epic A', 'PBI D']);
	});

	it('orders focus rows by global rank, not by tree position', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		// A's child ranks AFTER B's child globally — DFS preorder would list it first.
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 9000 }, parentLink: 'Epic A' });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 3000 }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'PBI' });
		expect(model.roots.map((i) => i.file.basename)).toEqual(['PBI B1', 'PBI A1']);
	});

	it('falls back to tree order when the focused rows\' ranks are not globally distinct', () => {
		// Legacy, unseeded ranks are sibling-scoped: every first child holds 10 and every
		// second holds 20. Sorting those globally would interleave the parents (A1, B1,
		// A2, B2) rather than reveal a priority, so the guard keeps tree order instead.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('PBI A2.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic A' });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic B' });
		vault.addFile('PBI B2.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'PBI' });
		expect(model.roots.map((i) => i.file.basename)).toEqual(['PBI A1', 'PBI A2', 'PBI B1', 'PBI B2']);
	});

	it('renders in rank order once the same shape of fixture has distinct ranks', () => {
		// Same structure as the legacy fixture above, but every rank is globally
		// distinct — and deliberately reversed, so passing this could not be an
		// accident of tree order already agreeing with rank order.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 40 }, parentLink: 'Epic A' });
		vault.addFile('PBI A2.md', { frontmatter: { type: 'PBI', order: 30 }, parentLink: 'Epic A' });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic B' });
		vault.addFile('PBI B2.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic B' });
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'PBI' });
		expect(model.roots.map((i) => i.file.basename)).toEqual(['PBI B2', 'PBI B1', 'PBI A2', 'PBI A1']);
	});

	it('reaches rank order despite an unranked context row at the focused level', () => {
		// Seed and Respace never write context notes, so a context row with no order is
		// permanent — the distinctness check must look only at the WRITABLE rows, or one
		// such row vetoes rank order forever, even once every writable note is migrated.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		// No order at all: this PBI is excluded from the base's own results below, so it
		// is loaded only as context for its child — never a write target, never migrated.
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic A' });
		vault.addFile('Task A1a.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI A1' });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic B' });
		vault.addFile('PBI B2.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic B' });
		// The base returns only the two writable PBIs and the Task; PBI A1 is context.
		const entries = vault
			.entries()
			.filter((e) => ['Task A1a.md', 'PBI B1.md', 'PBI B2.md'].includes(e.file.path));
		const model = buildModel(vault.app, entries, { ...settings, focusLevel: 'PBI' });
		const pbiA1 = model.byPath.get('PBI A1.md');
		expect(pbiA1?.outsideFilter).toBe(true);
		expect(pbiA1?.order).toBeNull();
		// The two writable ranks are distinct, so rank order applies; the unranked
		// context row still sorts last, exactly as `ranked` already places it.
		expect(model.roots.map((i) => i.file.basename)).toEqual(['PBI B2', 'PBI B1', 'PBI A1']);
	});
});
