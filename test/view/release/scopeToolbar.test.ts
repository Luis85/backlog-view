// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, mountRelease, RELEASE_CONFIG, row } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';
import { FakeVault } from '../../helpers/vault';
import type { ReleaseView } from '../../../src/view/release/releaseView';

/**
 * The scope screen's own toolbar (`scopeToolbar.ts`): collapse all, expand all, hide done,
 * and the all-done state hide-done can uncover — Task 5, plus carried findings 1 and 2,
 * which are what let a Deliverables-only release reach this toolbar's hide-done control at
 * all and keep a row rollup from lying about a release that shares its cause with it.
 *
 * `mountRelease`'s own `scopeVault()` carries `Releases/0.5.md`/`0.7.md`/`0.8.md` beside its
 * original `R.md` for exactly this file — see that fixture's own comment for what each
 * release is shaped to prove.
 */
function hideDone(view: ReleaseView): HTMLButtonElement | null {
	return view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-hidedone');
}

describe('the scope toolbar', () => {
	useViewHarness();

	it('collapses and expands every row of THIS scope', () => {
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-collapse')!.click();
		expect(view.viewEl.querySelectorAll('.pbl-row')).toHaveLength(1);
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-expand')!.click();
		expect(view.viewEl.querySelectorAll('.pbl-row').length).toBeGreaterThan(1);
	});

	it('hides a finished subtree and leaves the rollups alone', () => {
		const { view } = mountRelease({ pick: 'Releases/0.7.md' });
		const before = row(view, 'Card payments.md').querySelector('.pbl-progress-label')!.textContent;
		hideDone(view)!.click();
		expect(row(view, 'Card payments.md', { optional: true })).toBeNull();
		hideDone(view)!.click();
		expect(row(view, 'Card payments.md').querySelector('.pbl-progress-label')!.textContent).toBe(before);
	});

	it('draws the all-done state with its count, never a blank scroller', () => {
		// Extension 4c, and the way back is this toolbar's own toggle beside it.
		const { view } = mountRelease({ pick: 'Releases/0.7.md' });
		hideDone(view)!.click();
		const done = view.viewEl.querySelector('.pbl-rel-alldone')!;
		expect(done.textContent).toContain('10');
		expect(hideDone(view)).not.toBeNull();
	});

	it('draws a parent whose children all hid as a LEAF', () => {
		// Extension 4a: an expander over nothing is worse than no expander.
		const { view } = mountRelease({ pick: 'Releases/0.5.md' });
		hideDone(view)!.click();
		const parent = row(view, 'Retention policy.md');
		expect(parent.hasAttribute('aria-expanded')).toBe(false);
	});

	it('withholds the toggle with no plan state key bound', () => {
		// Gated exactly as the `done` figure is: a control that could hide rows the summary
		// refuses to count would put two answers to "what is done here" on one screen.
		const { view } = mountRelease({ pick: 'Releases/0.8.md', stateKey: '' });
		expect(view.viewEl.querySelector('.pbl-rel-hidedone')).toBeNull();
		// Collapse and expand are unaffected — they ask nothing about progress.
		expect(view.viewEl.querySelector('.pbl-rel-collapse')).not.toBeNull();
	});

	it('has NO context-rows toggle', () => {
		// Cut by the register: [[The scope of a release as a tree]] extension 3b says a
		// context ancestor is drawn regardless, because hiding it breaks a member's place.
		const { view } = mountRelease({ pick: 'Releases/0.8.md' });
		expect(view.viewEl.textContent).not.toContain('Context rows');
	});

	it('never removes a context ancestor that still holds a visible member', () => {
		// [[The scope of a release as a tree]]'s own acceptance criterion, added with this
		// task: a context row carries no state of its own (extension 3b), so it can never
		// itself be the reason a subtree hides — only its members can be, one at a time.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Done member.md', {
			frontmatter: { type: 'Feature', release: '[[R]]', status: 'Done' },
			parentLink: 'Epic',
		});
		vault.addFile('Open member.md', {
			frontmatter: { type: 'Feature', release: '[[R]]', status: 'Open' },
			parentLink: 'Epic',
		});
		const { view } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');

		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-hidedone')!.click();

		expect(row(view, 'Epic.md').classList.contains('pbl-rel-context')).toBe(true);
		expect(row(view, 'Open member.md', { optional: true })).not.toBeNull();
		expect(row(view, 'Done member.md', { optional: true })).toBeNull();
	});

	it('toggles aria-pressed and the ON class together', () => {
		const { view } = mountRelease({ pick: 'Releases/0.7.md' });
		const before = hideDone(view)!;
		expect(before.getAttribute('aria-pressed')).toBe('false');
		expect(before.classList.contains('pbl-rel-toggle-on')).toBe(false);
		before.click();
		const after = hideDone(view)!;
		expect(after.getAttribute('aria-pressed')).toBe('true');
		expect(after.classList.contains('pbl-rel-toggle-on')).toBe(true);
	});

	/**
	 * Every control here calls `view.render()`, which `empty()`s `viewEl` and detaches
	 * whichever of them was focused — the finding this task fixes generally, in
	 * `ReleaseView.render` itself, rather than once per control. A keyboard user who
	 * presses one must land on its redrawn equivalent, not on `document.body`.
	 */
	describe('focus after a redraw', () => {
		it('restores focus to the redrawn collapse control', () => {
			const { view } = mountRelease({ pick: 'Releases/0.8.md' });
			const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-collapse')!;
			btn.focus();
			btn.click();
			const redrawn = view.viewEl.querySelector('.pbl-rel-collapse');
			expect(redrawn).not.toBeNull();
			expect(redrawn).not.toBe(btn);
			expect(document.activeElement).toBe(redrawn);
		});

		it('restores focus to the redrawn expand control', () => {
			const { view } = mountRelease({ pick: 'Releases/0.8.md' });
			const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-expand')!;
			btn.focus();
			btn.click();
			const redrawn = view.viewEl.querySelector('.pbl-rel-expand');
			expect(redrawn).not.toBeNull();
			expect(redrawn).not.toBe(btn);
			expect(document.activeElement).toBe(redrawn);
		});

		it('restores focus to the redrawn hide-done toggle', () => {
			const { view } = mountRelease({ pick: 'Releases/0.7.md' });
			const btn = hideDone(view)!;
			btn.focus();
			btn.click();
			const redrawn = hideDone(view);
			expect(redrawn).not.toBeNull();
			expect(redrawn).not.toBe(btn);
			expect(document.activeElement).toBe(redrawn);
		});
	});
});
