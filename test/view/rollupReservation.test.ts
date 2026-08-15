// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * What actually holds the bars on one line, and the reason it is a text check.
 *
 * The bar is pinned to the START of a lane every row shares, so its x is the lane's and
 * nothing about the label can move it. The first design reserved the LABEL's width
 * instead, which made the bar's position whatever the label left over — and a reservation
 * is only as good as its metric: `.pbl-complete` draws the label at `--font-medium`, and
 * a font's medium figures need not share its regular figures' advance, so two equal
 * reservations could come out different widths (Codex, PR #153).
 *
 * jsdom computes no layout, so this cannot see a bar's x. Its reach is exactly the two
 * declarations that pin it — it fails if someone drops them, which is the failure that
 * would silently bring the drift back, and it cannot tell you the bars came out level.
 * A browser is what answers that: `?fixture=edges` in the harness.
 */
describe('the declarations that pin the bar', () => {
	const css = readFileSync('styles/columns.css', 'utf8');
	const rule = (selector: string): string => {
		const at = css.indexOf(`\n${selector} {`);
		if (at === -1) throw new Error(`no rule for ${selector}`);
		return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
	};

	it('fills the lane and pins the bar to its start', () => {
		expect(rule('.pbl-progress')).toContain('justify-content: space-between');
		expect(rule('.pbl-progress')).toContain('flex: 1 1 auto');
	});

	it('refuses to let the bar be what a narrow lane shrinks', () => {
		// Filling the lane is what made this reachable: a group sized by its content cannot
		// squeeze its children, and one sized by the lane resolves an overflow out of
		// whatever will shrink. The bar is the wrong thing to take it out of — the fill is a
		// percentage of this box, so a shrunk bar reports a different quantity rather than
		// merely looking wrong. (Codex, PR #153.)
		expect(rule('.pbl-progress-bar')).toContain('flex: 0 0 48px');
		expect(rule('.pbl-progress-bar')).not.toContain('width:');
	});

	it('reserves nothing on the label, whose weight the complete state changes', () => {
		// The pairing IS the check: the completion rule may go on setting a weight exactly
		// because no width here is stated in a metric that weight could move.
		expect(rule('.pbl-progress-label')).not.toContain('min-width');
		expect(rule('.pbl-progress.pbl-complete .pbl-progress-label')).toContain('font-weight');
	});
});

/**
 * The rollup lane's own geometry — split out of `columns.test.ts` when that file reached
 * its line budget, and a subject rather than an offcut: everything here is about the ONE
 * declaration the render publishes for the label's width, and nothing here is about which
 * columns fit or what a cell draws.
 *
 * Reported from a vault of 800-odd PBIs (2026-08-15). The bar and the label share a lane
 * anchored at its END, so the label's width decides where the bar starts, and a flat 28px
 * reservation holds `9/99` and not `44/136` — bars at three different x down one column.
 * What jsdom can check is the reservation; that it then aligns anything is the browser's
 * arithmetic, and `?fixture=edges` in the harness is where that was looked at.
 */
describe('the rollup label reservation', () => {
	it('reserves the widest rollup label in the tree, so every bar starts in one place', () => {
		const vault = new FakeVault();
		vault.addFile('Small.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Big.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
		vault.addFile('Only child.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Small' });
		for (let i = 1; i <= 120; i += 1) {
			vault.addFile(`Big ${i}.md`, {
				frontmatter: { type: 'Feature', order: i * 10, status: i <= 44 ? 'Done' : 'Active' },
				parentLink: 'Big',
			});
		}
		const { containerEl, view } = makeView(vault, { stateProperty: 'note.status' });
		view.onDataUpdated();

		// `44/120` — six characters, from `Big`, not the three of `Small`'s `1/1`.
		expect(rowByTitle(containerEl, 'Small').querySelector('.pbl-progress-label')?.textContent).toBe('1/1');
		expect(rowByTitle(containerEl, 'Big').querySelector('.pbl-progress-label')?.textContent).toBe('44/120');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-rollup-label')).toBe('6ch');
	});

	it('budgets the lane at the width it actually draws, so a wide label drops a column', () => {
		// The fit subtracted a flat 84px while the lane grew past it, and the two disagree
		// exactly where it matters: at a boundary the row's flexible middle is already at
		// zero and `.pbl-tree` is `overflow-x: hidden`, so the extra width comes out of the
		// end of the row rather than out of slack. Same pane, same columns, same everything
		// but the COUNTS — the wider lane is the only thing that can drop the column.
		// (Codex, PR #153.)
		const wide = new FakeVault();
		wide.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		for (let i = 1; i <= 120; i += 1) {
			wide.addFile(`Child ${i}.md`, {
				frontmatter: { type: 'Feature', order: i * 10, status: i <= 44 ? 'Done' : 'Active' },
				parentLink: 'Root',
			});
		}
		const narrow = new FakeVault();
		narrow.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		narrow.addFile('Child 1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Root' });

		const drawn = (vault: FakeVault) => {
			const { containerEl, view } = makeView(
				vault,
				{ stateProperty: 'note.status' },
				{ order: ['note.points'], widths: { 'note.points': 280 } },
			);
			// 720 = the row's own lead (308) + the tree's padding (16) + one level of indent
			// (24) + a 280px column, with 92px over — enough for the flat 84px lane and not
			// for the 100px one six characters ask for. The verdict turns on the lane alone.
			Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 720, configurable: true });
			view.onDataUpdated();
			return rowByTitle(containerEl, 'Root').querySelectorAll('.pbl-prop').length;
		};

		expect(drawn(narrow)).toBe(1);
		expect(drawn(wide)).toBe(0);
	});

	it('sizes from the rows a hiding mode leaves, but never from what is expanded', () => {
		// Two halves of one rule. A filter that hides the deep subtree must narrow the
		// reservation — reserving for a label no remaining row draws widens the lane for all
		// of them and can drop a column (Codex, PR #153). COLLAPSE must not: sizing from the
		// rows literally rendered would move every bar on screen sideways as a side effect
		// of expanding one row, which is why the predicate that decides this is
		// `isRowHidden` and not "did this pass draw it".
		const vault = new FakeVault();
		vault.addFile('Small.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Only child.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Small' });
		vault.addFile('Big.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
		for (let i = 1; i <= 120; i += 1) {
			vault.addFile(`Big ${i}.md`, {
				frontmatter: { type: 'Feature', order: i * 10, status: i <= 44 ? 'Done' : 'Active' },
				parentLink: 'Big',
			});
		}
		const { containerEl, view } = makeView(vault, { stateProperty: 'note.status' }, { collapsed: true });
		// Collapsed to the two roots — `Big`'s own `44/120` is on screen, and nothing under
		// either root is. The reservation is the same as it will be expanded.
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-rollup-label')).toBe('6ch');

		view.setFilter('Only child');

		// `Big` and its 120 are all hidden now, so the widest label left is `Small`'s.
		expect(rowByTitle(containerEl, 'Small').querySelector('.pbl-progress-label')?.textContent).toBe('1/1');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-rollup-label')).toBe('3ch');
	});

	it('takes the reservation back off when a re-render no longer has one', () => {
		// The tree element is built once and emptied per render, so its inline style
		// outlives the pass that wrote it and `setCssProps` clears nothing it is not given.
		// Clearing the state property while counts stay on is the reachable transition:
		// rows stop drawing a bar, and a stale reservation would go on widening their lane
		// at the title's expense. (Codex, PR #153.)
		const vault = fixture();
		const { containerEl, view, config } = makeView(vault, { stateProperty: 'note.status' });
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-rollup-label')).toBe('3ch');

		config.set('stateProperty', '');
		view.onDataUpdated();

		expect(treeOf(containerEl).style.getPropertyValue('--pbl-rollup-label')).toBe('');
	});

	it('reserves nothing where there is no bar to push out of line', () => {
		// Counts without a workflow: one number, already anchored at the lane's end, and
		// no bar beside it that a wider label could move. Reserving there would widen the
		// lane for nothing — the assertion is the ABSENCE, since the stylesheet's own 28px
		// fallback is what should apply.
		const vault = fixture();
		const { containerEl, view } = makeView(vault, { stateProperty: '' });
		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Epic B').querySelector('.pbl-count')?.textContent).toBe('2');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-rollup-label')).toBe('');
	});

});
