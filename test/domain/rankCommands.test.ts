import { describe, expect, it } from 'vitest';
import { BacklogItem, BacklogModel, buildModel } from '../../src/domain/model';
import { computeRespaceWrites, computeSeedWrites, SpreadResult } from '../../src/domain/rankSpread';
import { anchoredOrder, ItemWrite } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

/** The plan's writes, or a failure naming the rows it says are wedged. */
function writes(result: SpreadResult): ItemWrite[] {
	if ('wedged' in result) throw new Error(`wedged: ${result.wedged.map((i) => i.file.basename).join(', ')}`);
	return result.writes;
}

/** Every loaded row's rank once the plan is applied — the vault as the next build reads it. */
function applied(model: BacklogModel, result: SpreadResult): Map<string, number | null> {
	const ranks = new Map([...model.byPath].map(([path, item]) => [path, item.order]));
	for (const write of writes(result)) ranks.set(write.file.path, write.order ?? null);
	return ranks;
}

/** The writable rows in the order the tree draws them, depth-first. */
function drawn(model: BacklogModel): string[] {
	const paths: string[] = [];
	const visit = (items: BacklogItem[]) => {
		for (const item of items) {
			if (!item.outsideFilter) paths.push(item.file.path);
			visit(item.children);
		}
	};
	visit(model.realRoots);
	return paths;
}

/**
 * Seed's whole contract, asked of the applied result rather than of the numbers: the
 * writable rows sort into the order the tree draws them, and no two share a rank. That
 * second half is what `inRankOrder` tests before it sorts anything at all, so a plan
 * that wrote numbers without it would leave the view exactly where it started.
 */
function expectRankOrderMatchesDrawnOrder(model: BacklogModel, result: SpreadResult): void {
	const ranks = applied(model, result);
	const expected = drawn(model);
	const byRank = [...expected].sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0));
	expect(byRank).toEqual(expected);
	const values = expected.map((path) => ranks.get(path));
	expect(values).not.toContain(null);
	expect(new Set(values).size).toBe(values.length);
}

/**
 * Two epics whose sibling-scoped legacy ranks contradict the drawn order: every first
 * child carries 10, so the global sort interleaves the parents. The vault the rank
 * change has to migrate.
 */
function legacyVault(): BacklogModel {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
	vault.addFile('A2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic A' });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic B' });
	return buildModel(vault.app, vault.entries(), settings);
}

describe('computeSeedWrites', () => {
	it('makes the rank order agree with the drawn order, distinctly', () => {
		const model = legacyVault();
		// The fixture really is a vault Seed exists for: sorting its ranks interleaves
		// the two epics rather than revealing a priority.
		expect(model.ranked.map((i) => i.title)).not.toEqual(['Epic A', 'A1', 'A2', 'Epic B', 'B1']);
		expectRankOrderMatchesDrawnOrder(model, computeSeedWrites(model));
	});

	it('spaces the ranks so the next drop has somewhere to land', () => {
		const model = legacyVault();
		expect(writes(computeSeedWrites(model)).map((w) => w.order)).toEqual([1000, 2000, 3000, 4000, 5000]);
	});
});

describe('computeRespaceWrites', () => {
	it('keeps the order the population is already in', () => {
		const model = legacyVault();
		const result = computeRespaceWrites(model);
		const ranks = applied(model, result);
		const before = model.ranked.map((item) => item.file.path);
		expect([...before].sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0))).toEqual(before);
	});

	it('reopens a spent gap', () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Two.md', { frontmatter: { type: 'Epic', order: 1000.000001 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(anchoredOrder(model.ranked, model.ranked[0], 'after')).toEqual({ refusal: 'gapSpent' });

		const ranks = applied(model, computeRespaceWrites(model));
		const respaced = model.ranked.map((item) => ({ ...item, order: ranks.get(item.file.path) ?? null })) as BacklogItem[];
		expect(anchoredOrder(respaced, respaced[0], 'after')).toEqual({ order: 1500 });
	});

	it('is not the seed: on a legacy vault the two plans disagree', () => {
		// Neither can be derived from the other. Ranked order is not the drawn order here,
		// and on a seeded vault the drawn order is not the user's hand-ranked order.
		const model = legacyVault();
		expect(writes(computeRespaceWrites(model)).map((w) => w.file.path)).not.toEqual(
			writes(computeSeedWrites(model)).map((w) => w.file.path),
		);
	});
});

/** A base returning two PBIs, so both epics arrive as context rows the view may not write. */
function contextVault(lowOrder: number, highOrder: number): BacklogModel {
	const vault = new FakeVault();
	vault.addFile('Epic Low.md', { frontmatter: { type: 'Epic', order: lowOrder } });
	vault.addFile('PBI One.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic Low' });
	vault.addFile('Epic High.md', { frontmatter: { type: 'Epic', order: highOrder } });
	vault.addFile('PBI Two.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic High' });
	const results = vault.entries().filter((e) => e.file.path.startsWith('PBI'));
	return buildModel(vault.app, results, settings);
}

describe('spreading around rows the base excluded', () => {
	it('writes none of them, and fits the writable rows between the ranks they hold', () => {
		const model = contextVault(100, 200);
		const plan = writes(computeSeedWrites(model));
		expect(plan.map((w) => w.file.path)).toEqual(['PBI One.md', 'PBI Two.md']);
		// Strictly between the two context ranks, then clear of the higher one.
		expect(plan.map((w) => w.order)).toEqual([150, 1200]);
	});

	it('writes none of them on a respace either', () => {
		const model = contextVault(100, 200);
		expect(model.ranked.some((item) => item.outsideFilter)).toBe(true);
		expect(writes(computeRespaceWrites(model)).map((w) => w.file.path)).toEqual(['PBI One.md', 'PBI Two.md']);
	});

	it('does not let an unranked one split the allocation', () => {
		// A context row with no rank constrains nothing. Treating it as a boundary restarts
		// the run after it at ORDER_SPACING, which is the rank the run before it already
		// handed out — a collision manufactured by the migration itself.
		const vault = new FakeVault();
		vault.addFile('Epic Nil.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('PBI A.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic Nil' });
		vault.addFile('Root B.md', { frontmatter: { type: 'Epic' } });
		const results = vault.entries().filter((e) => e.file.path !== 'Epic Nil.md');
		const model = buildModel(vault.app, results, settings);
		expect(model.byPath.get('Epic Nil.md')?.outsideFilter).toBe(true);

		const plan = writes(computeSeedWrites(model));
		expect(plan.map((w) => w.order)).toEqual([1000, 2000]);
	});

	it('keeps the writable rows in drawn order when a context rank contradicts it', () => {
		// A context Feature ranked BELOW the context Epic it sits under: the drawn order and
		// the immovable ranks disagree, and no plan can fix that without writing to a note
		// the base excluded. What must still hold is the part that is ours: the writable
		// rows keep their drawn order, distinctly, and none of them lands on a rank a
		// context row already holds.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('PBI X.md', { frontmatter: { type: 'PBI', order: 5 }, parentLink: 'Epic' });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 1000 }, parentLink: 'Epic' });
		vault.addFile('PBI Y.md', { frontmatter: { type: 'PBI', order: 1 }, parentLink: 'Feature' });
		const results = vault.entries().filter((e) => e.file.path.startsWith('PBI'));
		const model = buildModel(vault.app, results, settings);
		expect(drawn(model)).toEqual(['PBI X.md', 'PBI Y.md']);

		const result = computeSeedWrites(model);
		expectRankOrderMatchesDrawnOrder(model, result);
		const placed = writes(result).map((w) => w.order);
		expect(placed).not.toContain(3000);
		expect(placed).not.toContain(1000);
	});
});

describe('rows that cannot be given distinct ranks', () => {
	it('answers with the wedged rows rather than an empty plan', () => {
		// Two context ranks a hair apart: no six-decimal value sits strictly between them,
		// and `[]` would be indistinguishable from a plan with nothing to do — the command
		// would confirm zero notes and say nothing at all.
		const model = contextVault(1000, 1000.000001);
		expect(computeSeedWrites(model)).toEqual({ wedged: [model.byPath.get('PBI One.md')] });
	});

	it('fails closed where the spacing cannot clear the rank below it', () => {
		// Above about 1e19 the IEEE-754 unit exceeds ORDER_SPACING, so the next rank IS the
		// context row's own — a duplicate, which is what `midpoint` and `edgeRank` already
		// refuse. An unbounded run is not exempt from that.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 1e20 } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const results = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, results, settings);
		expect(computeSeedWrites(model)).toEqual({ wedged: [model.byPath.get('PBI.md')] });
	});

	it('wedges rather than writing Infinity when the floor is at the top of the float range', () => {
		// `1e308 + ORDER_SPACING === 1e308` in float, so the step does nothing — and
		// `roundOrder` used to OVERFLOW there (`Math.round(1e308 * 1e6)` is Infinity), which
		// cleared `placeRun`'s own `order <= previous` guard and wrote a value YAML cannot
		// hold. The next build's `readNumber` then rejects it and a note that HAD a rank
		// loses it. `order` is hand-editable frontmatter, so 1e308 is reachable.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 1e308 } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const results = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, results, settings);
		expect(computeSeedWrites(model)).toEqual({ wedged: [model.byPath.get('PBI.md')] });
	});

	it('hangs a leading run below its context row rather than counting up from zero', () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 5 } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const results = vault.entries().filter((e) => e.file.path !== 'Epic.md');
		const model = buildModel(vault.app, results, settings);
		expect(drawn(model)).toEqual(['Root.md', 'PBI.md']);
		// Root is drawn above a context row ranked 100, so its new rank has to be below it.
		expect(writes(computeSeedWrites(model)).map((w) => w.order)).toEqual([-900, 1100]);
	});
});
