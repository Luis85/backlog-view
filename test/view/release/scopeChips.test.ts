// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen, row, RELEASE_CONFIG, scopeVault } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';
import { FakeVault } from '../../helpers/vault';

useViewHarness();

/**
 * A member carrying `effort` and one carrying none — `scopeVault()`'s own `M1.md`/`M2.md`
 * both carry an estimate (the effort-sum fixture, 9 and 6), so this file's own small vault
 * is what supplies the unestimated half neither of them does.
 */
function effortVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('M1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[0.9]]', effort: 5 } });
	vault.addFile('M2.md', { frontmatter: { type: 'PBI', order: 2, release: '[[0.9]]' } });
	return vault;
}

/**
 * A context ancestor for release 0.9 itself — `scopeVault()`'s own context row (`E.md`) sits
 * above `F1.md`/`F2.md`, which name release `[[R]]` rather than `[[0.9]]`, so it is never
 * drawn in the scope `releaseScreen` opens (`0.9.md`, hard-coded there). This vault gives
 * `0.9` its own ancestor instead: `E.md` holds no membership property of its own and is kept
 * only because its child `C.md` does.
 */
function contextVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 1, release: '[[0.9]]', parent: 'E' } });
	return vault;
}

describe('the readiness chips', () => {
	it('draws a value chip on an estimated member and a dashed one on an unestimated member', () => {
		const { view } = releaseScreen({}, effortVault());
		const estimated = row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')!;
		const unestimated = row(view, 'M2.md').querySelector<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')!;

		expect(estimated.textContent).toContain('5');
		expect(unestimated.classList.contains('pbl-state-unset')).toBe(true);
		expect(unestimated.textContent).toContain('Effort');
	});

	it('draws neither chip on a context row', () => {
		const { view } = releaseScreen({}, contextVault());
		const context = row(view, 'E.md');

		expect(context.querySelector('.pbl-rel-effortcol .pbl-state-chip')).toBeNull();
		expect(context.querySelector('.pbl-rel-riskcol .pbl-state-chip')).toBeNull();
		// The CELLS are still there, or the columns after them would shift per row.
		expect(context.querySelector('.pbl-rel-effortcol')).not.toBeNull();
		expect(context.querySelector('.pbl-rel-riskcol')).not.toBeNull();
	});

	it('draws no risk chip where there is no value to offer', () => {
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
		// `scopeVault()`'s own members carry no risk value either: nothing declared, nothing
		// observed.
		const { view } = releaseScreen({}, scopeVault(), config);

		expect(row(view, 'M1.md').querySelector('.pbl-rel-riskcol .pbl-state-chip')).toBeNull();
	});

	it('draws a risk chip from an OBSERVED value alone, with neither list configured', () => {
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
		const vault = new FakeVault();
		vault.addFile('M1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[0.9]]', risk: 'High' } });
		const { view } = releaseScreen({}, vault, config);

		const chip = row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip');
		expect(chip).not.toBeNull();
		expect(chip!.textContent).toContain('High');
	});

	it('draws every chip as a tabindex -1 button — the tree is one tab stop', () => {
		const { view } = releaseScreen({}, effortVault());
		const chips = view.viewEl.querySelectorAll<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip');
		expect(chips.length).toBeGreaterThan(0);
		for (const chip of chips) {
			expect(chip.tagName).toBe('BUTTON');
			expect(chip.getAttribute('tabindex')).toBe('-1');
		}
	});
});
