// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

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
