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

describe('drilling into a criterion', () => {
	useViewHarness();

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

		// Give the last unestimated member an effort, out of band, and refresh.
		vault.setFrontmatter('M2.md', { type: 'PBI', release: '[[0.9]]', effort: 3 });
		refreshRelease(view, vault);

		expect(view.criterionFilter).toBeNull();
		expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
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
	useViewHarness();

	it('is offered only while narrowed, and clears the narrowing', () => {
		const { view } = releaseScreen({}, drillVault());
		expect(view.viewEl.querySelector('.pbl-rel-toggle-on')).toBeNull();

		chip(view, 'estimated').click();
		const clear = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-toggle-on')!;
		expect(clear).not.toBeNull();
		expect(clear.textContent).toBe('Show every row again');

		clear.click();
		expect(view.criterionFilter).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-toggle-on')).toBeNull();
		expect(row(view, 'M1.md', { optional: true })).not.toBeNull();
	});
});
