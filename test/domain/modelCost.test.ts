import { describe, expect, it, vi } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

/** One epic per ten notes, the rest features under it — a backlog shaped like a real one. */
function backlog(notes: number): FakeVault {
	const vault = new FakeVault();
	for (let i = 0; i < notes; i++) {
		if (i % 10 === 0) vault.addFile(`Epic ${i}.md`, { frontmatter: { type: 'Epic', order: i * 10 } });
		else
			vault.addFile(`Feature ${i}.md`, {
				frontmatter: { type: 'Feature', order: i * 10 },
				parentLink: `Epic ${i - (i % 10)}`,
			});
	}
	return vault;
}

/**
 * What one `buildModel` costs, measured by the two things observable from outside it:
 * how often it read the vault, and how many items went through a sort. Both spies go on
 * immediately before the build, so nothing the fixture did on the way in is counted.
 */
function costOf(notes: number): { reads: number; sorted: number; items: number } {
	const vault = backlog(notes);
	const entries = vault.entries();
	const reads = vi.spyOn(vault.app.metadataCache, 'getFileCache');
	const sort = vi.spyOn(Array.prototype, 'sort');
	const model = buildModel(vault.app, entries, settings);
	// Both counts are taken BEFORE restoring: `mockRestore` resets the recorded calls
	// along with the implementation, so reading them afterwards reports zero — which
	// looked exactly like the property holding.
	// The vocabulary collectors sort STRINGS; only the sibling groups hold items. An
	// empty group has no first element to ask and contributes nothing either way.
	const sorted = sort.mock.contexts
		.filter((ctx): ctx is object[] => Array.isArray(ctx) && typeof ctx[0] === 'object')
		.reduce((total, group) => total + group.length, 0);
	const cost = { reads: reads.mock.calls.length, sorted, items: model.items.length };
	sort.mockRestore();
	reads.mockRestore();
	return cost;
}

describe('model build cost', () => {
	/**
	 * `buildModel` runs on every data update, so its bound is worth a check rather than a
	 * sentence — see `src/domain/CLAUDE.md`, which states what these two numbers reach and
	 * what they do not. Both are counts of a call that must not happen more than once per
	 * item, in the shape `test/view/renderCost.test.ts` uses for the render pass; neither
	 * measures elapsed time, which in a node test would measure the runner.
	 */
	it('reads the vault once per note and sorts each item once, at any size', () => {
		const small = costOf(20);
		const large = costOf(400);

		// The fixture has to actually differ in size, or the equalities below prove nothing.
		expect(small.items).toBe(20);
		expect(large.items).toBe(400);

		// `addItem` is the only `getFileCache` call site in `domain/`, and it runs once per
		// note loaded. A later phase re-reading the cache per item shows up here as n².
		expect(small.reads).toBe(small.items);
		expect(large.reads).toBe(large.items);

		// `sortSiblingsDeep` sorts the roots, then each item's children, each exactly once —
		// so every item belongs to exactly one sorted group. Comparison sorting is the one
		// deliberately superlinear step in the build, and this is what keeps it seeing the
		// item set once rather than once per level.
		expect(small.sorted).toBe(small.items);
		expect(large.sorted).toBe(large.items);
	});
});
