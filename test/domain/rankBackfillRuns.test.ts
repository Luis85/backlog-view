import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { computeInitWrites } from '../../src/domain/rankBackfill';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

/**
 * A RUN of consecutive blanks under one ceiling is allocated in one go, not bisected row
 * by row.
 *
 * Asking `rankBetween(floor, ceiling)` per blank and then raising the floor to the value
 * just handed out HALVES the remaining interval every row: 1000..2000 gave 1500, 1750,
 * 1875, … and `roundOrder`'s six-decimal grid ran out after about thirty of them, whatever
 * the interval was to begin with — a wide run of blank siblings under one ranked row, which
 * is exactly the legacy shape the ✨ exists to migrate, was reported part-unplaceable and
 * the user sent to Seed.
 */
describe('the backfill allocates a whole run of blanks at once', () => {
	/**
	 * `count` blank Features under one ranked Epic, with a later Feature ranked between the
	 * two Epics so every blank shares one ceiling.
	 */
	function run(count: number, ceiling: number) {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		for (let i = 0; i < count; i++) {
			vault.addFile(`F${String(i).padStart(2, '0')}.md`, { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		}
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: ceiling }, parentLink: 'Epic B' });
		return computeInitWrites(buildModel(vault.app, vault.entries(), settings), settings);
	}

	it('places thirty-five blank siblings sharing one ceiling, all of them', () => {
		const { writes, unplaceable } = run(35, 2000);

		const ranked = writes.filter((write) => write.file.path.startsWith('F'));
		expect(ranked).toHaveLength(35);
		const orders = ranked.map((write) => write.order as number);
		// Distinct, inside the interval, and ascending in the order they are drawn — the
		// three things the per-row bisection stopped delivering at about the thirty-first.
		expect(new Set(orders).size).toBe(35);
		expect(orders.every((order) => order > 1000 && order < 2000)).toBe(true);
		expect([...orders].sort((a, b) => a - b)).toEqual(orders);
		expect(unplaceable).toBe(0);
	});

	it('does not drag a blank down to the ceiling of the blank drawn under it', () => {
		// One run carries ONE ceiling. `A` is an Epic with nothing of its own level ranked
		// below it, so it fits above `X` perfectly well; `Feature1` is bounded by its own
		// nested `Feature2` at 50, which is under the floor, so nothing fits for it. Placed
		// as one run under the LOWER of the two ceilings, `A` would be refused for a
		// collision it cannot have — a blank the row-at-a-time walk placed, left blank.
		const vault = new FakeVault();
		vault.addFile('X.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature1.md', { frontmatter: { type: 'Feature' }, parentLink: 'A' });
		vault.addFile('Feature2.md', { frontmatter: { type: 'Feature', order: 50 }, parentLink: 'Feature1' });
		const { writes, unplaceable } = computeInitWrites(buildModel(vault.app, vault.entries(), settings), settings);

		expect(writes.find((write) => write.file.path === 'A.md')?.order).toBe(1100);
		expect(unplaceable).toBe(1);
	});

	it('sees the poison from the run its own ceiling just ended', () => {
		// The ordering inside the walk, which nothing else reaches: `Bug1` ends `Feature1`'s
		// run by carrying a different ceiling, and `Feature1` is refused BY that flush. Ask
		// the poison question before the split and `Bug1` is still clean when it is asked,
		// joins a run of its own, takes a number and sorts itself ahead of the blank
		// `Feature1` it shares a parent with — the exact move the poison set exists to stop.
		const vault = new FakeVault();
		vault.addFile('X.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 200 } });
		vault.addFile('Feature1.md', { frontmatter: { type: 'Feature' }, parentLink: 'A' });
		vault.addFile('Bug1.md', { frontmatter: { type: 'Bug' }, parentLink: 'A' });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 300 } });
		// Drawn last and ranked under everything above it, so `Feature1` — and only
		// `Feature1` — has a ceiling no number can reach.
		vault.addFile('Feature3.md', { frontmatter: { type: 'Feature', order: 50 }, parentLink: 'B' });
		const { writes, unplaceable } = computeInitWrites(buildModel(vault.app, vault.entries(), settings), settings);

		expect(writes.some((write) => write.order !== undefined)).toBe(false);
		expect(unplaceable).toBe(2);
	});

	it('refuses a run too large for its interval WHOLE, counting every member', () => {
		// Two millionths of a rank between the floor and the ceiling: five six-decimal
		// values do not fit, and half-placing the group is the state the register already
		// complains about. Every member is counted so the notice stays true.
		const { writes, unplaceable } = run(5, 1000.000002);

		expect(writes.some((write) => write.order !== undefined)).toBe(false);
		expect(unplaceable).toBe(5);
	});
});
