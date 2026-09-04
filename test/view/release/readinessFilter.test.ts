// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { button, refreshRelease, releaseScreen, row } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';
import { FakeVault } from '../../helpers/vault';
import type { ReleaseView } from '../../../src/view/release/releaseView';

/**
 * Task 11: a readiness chip narrows the scope tree to the rows failing that criterion.
 * `outstandingPaths` (Task 9) and `rowsForPaths` (Task 10) are what this joins — see
 * `docs/requirements/Answering the readiness checklist.md` for the criteria themselves.
 */

const chip = (view: ReleaseView, key: string) =>
	view.viewEl.querySelector<HTMLButtonElement>(`.pbl-rel-crit[data-criterion="${key}"]`)!;

/**
 * `E.md` an Epic, holding two members — `M1.md` estimated, `M2.md` not — so the
 * "estimated" criterion narrows to exactly one member and keeps the Epic as context.
 * Not `scopeVault()`: that shared fixture's own `M1`/`M2` both carry an estimate now (the
 * capacity comparison's own fixture, `test/helpers/release.ts`'s own comment on why), so it
 * no longer has an unestimated member to drill down to.
 */
function drillVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', effort: 9 }, parentLink: 'E' });
	vault.addFile('M2.md', { frontmatter: { type: 'PBI', release: '[[0.9]]' }, parentLink: 'E' });
	return vault;
}

useViewHarness();

describe('drilling into a criterion', () => {
	it('narrows the tree to the failing rows and their ancestors', () => {
		const { view } = releaseScreen({}, drillVault());
		chip(view, 'estimated').click();

		// `M2.md` is unestimated; `M1.md` is not. The ancestor stays as context.
		expect(row(view, 'M2.md', { optional: true })).not.toBeNull();
		expect(row(view, 'M1.md', { optional: true })).toBeNull();
		expect(row(view, 'E.md', { optional: true })).not.toBeNull();
		expect(chip(view, 'estimated').getAttribute('aria-pressed')).toBe('true');
	});

	it('restores the whole tree on a second press', () => {
		const { view } = releaseScreen({}, drillVault());
		chip(view, 'estimated').click();
		chip(view, 'estimated').click();

		expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
		expect(chip(view, 'estimated').getAttribute('aria-pressed')).toBe('false');
	});

	it('suspends hide-done while narrowed', () => {
		// Turn the hide-done toggle on, then narrow to a criterion a DONE member fails.
		// The done member must be drawn: hiding the row you are being told to fix is the
		// dead end this whole feature is about.
		const vault = new FakeVault();
		vault.addFile('M1.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', status: 'Done' } });
		vault.addFile('M2.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', status: 'Open', effort: 3 } });
		const { view } = releaseScreen({}, vault);

		button(view, '.pbl-rel-hidedone').click();
		// The preference took effect on the ordinary tree: the done, unestimated member hid.
		expect(row(view, 'M1.md', { optional: true })).toBeNull();

		chip(view, 'estimated').click();
		// Narrowed to the one outstanding member, which hide-done must not take back off.
		expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
		expect(row(view, 'M2.md', { optional: true })).toBeNull();
	});

	it('clears itself once the criterion is satisfied', () => {
		const { view, vault } = releaseScreen({}, drillVault());
		chip(view, 'estimated').click();
		expect(row(view, 'M1.md', { optional: true })).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-filterclear')).not.toBeNull();

		// Give the last unestimated member an effort, out of band, and refresh.
		vault.setFrontmatter('M2.md', { type: 'PBI', release: '[[0.9]]', effort: 3 });
		refreshRelease(view, vault);

		expect(view.criterionFilter).toBeNull();
		expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
		// The toolbar's own clear control must not survive a render that already cleared
		// the filter it names — a stale "Show every row again" is a control that lies.
		// Review finding: this failed before `criterionRows` was moved to resolve right
		// after `readiness`, ahead of `drawScopeToolbar`'s own read of `criterionFilter`.
		expect(view.viewEl.querySelector('.pbl-rel-filterclear')).toBeNull();
	});

	it('resumes a suspended hide-done in the SAME render the filter clears, not the next one', () => {
		// The bug this pins: `drawScopeToolbar` and the hide-done/all-done check used to
		// read `view.criterionFilter` BEFORE `criterionRows` cleared it, so a render that
		// satisfied the filtered criterion still suspended hide-done for one render — a
		// done, now-estimated member stayed drawn instead of folding into the all-done
		// state, and the toolbar kept showing "Show every row again" for a narrowing that
		// had already ended. Both self-heal on the NEXT render, which is why nothing caught
		// it before review.
		const vault = new FakeVault();
		vault.addFile('M.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', status: 'Done' } });
		const { view, vault: v } = releaseScreen({}, vault);

		button(view, '.pbl-rel-hidedone').click();
		// Alone, done and unestimated: hide-done (filter not yet active) already hides it.
		expect(view.viewEl.querySelector('.pbl-rel-alldone')).not.toBeNull();

		chip(view, 'estimated').click();
		// Narrowed to the one outstanding member — hide-done suspended, so the done row is
		// drawn again despite the preference staying on.
		expect(view.viewEl.querySelector('.pbl-rel-alldone')).toBeNull();
		expect(row(view, 'M.md', { optional: true })).not.toBeNull();

		// Estimate it, out of band, and refresh: the ONLY outstanding member clears the
		// criterion, so the filter self-clears this same render.
		v.setFrontmatter('M.md', { type: 'PBI', release: '[[0.9]]', status: 'Done', effort: 3 });
		refreshRelease(view, v);

		expect(view.criterionFilter).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-filterclear')).toBeNull();
		// Hide-done resumed in THIS render: the done, now-estimated member folds straight
		// into the all-done state rather than drawing as a bare, filter-free tree for one
		// more render.
		expect(view.viewEl.querySelector('.pbl-rel-alldone')).not.toBeNull();
		expect(row(view, 'M.md', { optional: true })).toBeNull();
	});

	it('offers no narrowing on a satisfied criterion', () => {
		// A release whose only member is estimated, has no dependencies and no risk value:
		// every criterion is satisfied, so there is nothing any of them could narrow TO.
		//
		// Chosen answer: the chip stays the plain, unfocusable `div` it already draws for a
		// satisfied criterion, rather than a disabled button — a control that filters to the
		// whole tree is a control that lies, and there was never a control here to disable.
		const vault = new FakeVault();
		vault.addFile('M1.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', effort: 9 } });
		const { view } = releaseScreen({}, vault);

		const el = chip(view, 'estimated');
		expect(el.tagName).toBe('DIV');
		expect(el.hasAttribute('aria-pressed')).toBe(false);

		// A click on a plain div with no listener does nothing — the control genuinely is not
		// there, not merely inert-looking.
		el.click();
		expect(view.criterionFilter).toBeNull();
	});
});

describe('the clear-filter control', () => {
	it('is offered only while narrowed, and clears the narrowing', () => {
		const { view } = releaseScreen({}, drillVault());
		expect(view.viewEl.querySelector('.pbl-rel-filterclear')).toBeNull();

		chip(view, 'estimated').click();
		const clear = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-filterclear')!;
		expect(clear).not.toBeNull();
		expect(clear.textContent).toBe('Show every row again');

		clear.click();
		expect(view.criterionFilter).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-filterclear')).toBeNull();
		expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
	});
});
