import { describe, expect, it, vi } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

/**
 * One epic per ten notes, the rest features under it — a backlog shaped like a real one
 * — plus `resources` Resource notes, which never become items and never join a sibling
 * group: they are the model's second, deliberately superlinear sort (`src/domain/CLAUDE.md`'s
 * Cost section), so a fixture with none of them cannot exercise it.
 */
function backlog(notes: number, resources = 0): FakeVault {
	const vault = new FakeVault();
	for (let i = 0; i < notes; i++) {
		if (i % 10 === 0) vault.addFile(`Epic ${i}.md`, { frontmatter: { type: 'Epic', order: i * 10 } });
		else
			vault.addFile(`Feature ${i}.md`, {
				frontmatter: { type: 'Feature', order: i * 10 },
				parentLink: `Epic ${i - (i % 10)}`,
			});
	}
	for (let i = 0; i < resources; i++) vault.addFile(`Resource ${i}.md`, { frontmatter: { type: 'Resource' } });
	return vault;
}

/**
 * What one `buildModel` costs, measured by the two things observable from outside it:
 * how often it read the vault, and how many items (and resources) went through a sort.
 * Both spies go on immediately before the build, so nothing the fixture did on the way
 * in is counted.
 */
function costOf(
	notes: number,
	resources = 0,
): { reads: number; sorted: number; resourcesSorted: number; rankSorts: number; items: number } {
	const vault = backlog(notes, resources);
	const entries = vault.entries();
	const reads = vi.spyOn(vault.app.metadataCache, 'getFileCache');
	const sort = vi.spyOn(Array.prototype, 'sort');
	const model = buildModel(vault.app, entries, settings);
	// Both counts are taken BEFORE restoring: `mockRestore` resets the recorded calls
	// along with the implementation, so reading them afterwards reports zero — which
	// looked exactly like the property holding.
	// The vocabulary collectors sort STRINGS; only the sibling groups, the global rank
	// pass and the resource roster hold objects. An empty group has no first element to
	// ask and contributes nothing either way. The two are told apart by `typeName`, a
	// `RawItem`/`LinkedItem` field no `ResourceNote` carries — `readItems.ts`'s
	// `divertResource` diverts a resource before it is ever an item, so this is the one
	// shape distinguishing the build's comparison sorts from outside it.
	const groups = sort.mock.contexts.filter((ctx): ctx is object[] => Array.isArray(ctx) && typeof ctx[0] === 'object');
	const itemGroups = groups.filter((g) => 'typeName' in g[0]);
	// TWO passes over items now, each once: `sortSiblingsDeep` over the sibling groups,
	// and the global rank sort. A third would still fail this.
	const wholeSet = itemGroups.filter((g) => g.length === model.items.length);
	const sorted = itemGroups.filter((g) => !wholeSet.includes(g)).reduce((total, g) => total + g.length, 0);
	const rankSorts = wholeSet.length;
	const resourcesSorted = groups
		.filter((g) => !('typeName' in g[0]))
		.reduce((total, group) => total + group.length, 0);
	const cost = { reads: reads.mock.calls.length, sorted, resourcesSorted, rankSorts, items: model.items.length };
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

		// `addItem` is the only `getFileCache` call site `buildModel` reaches, and it runs
		// once per note loaded. A later phase re-reading the cache per item shows up here as n².
		expect(small.reads).toBe(small.items);
		expect(large.reads).toBe(large.items);

		// `sortSiblingsDeep` sorts the roots, then each item's children, each exactly once —
		// so every item belongs to exactly one sorted group. Comparison sorting is the one
		// deliberately superlinear step in the build, and this is what keeps it seeing the
		// item set once rather than once per level.
		expect(small.sorted).toBe(small.items);
		expect(large.sorted).toBe(large.items);
	});

	/**
	 * The roster (`buildModel`'s `resources`, sorted in `model.ts` beside `sortSiblingsDeep`)
	 * is the build's SECOND deliberately superlinear step — `src/domain/CLAUDE.md`'s Cost
	 * section names it now. The test above cannot see it: `readItems.ts`'s `divertResource`
	 * diverts a `Resource` note before it is ever an item, so a resource never joins a
	 * sibling group and never counted toward `sorted` even when one existed in the fixture.
	 * This pins the roster sort at its own seam instead of restating the item check.
	 */
	it('sorts the resource roster exactly once, separately from the items', () => {
		const cost = costOf(20, 7);

		expect(cost.items).toBe(20);
		// Sorted exactly once: a second sort (or one moved into a per-item path) would sum
		// to a multiple of the roster size instead of the roster size itself.
		expect(cost.resourcesSorted).toBe(7);
		// The two sorts must not be conflated: an item is never counted as a resource sort
		// and a resource is never counted as an item sort.
		expect(cost.sorted).toBe(cost.items);
	});

	it('sorts the whole item set exactly once for the global rank', () => {
		expect(costOf(200).rankSorts).toBe(1);
	});
});
