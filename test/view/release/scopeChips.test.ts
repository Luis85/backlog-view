// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../../helpers/obsidian-mock';
import { releaseScreen, row, RELEASE_CONFIG, scopeVault } from '../../helpers/release';
import { flush, submitPrompt, useViewHarness } from '../../helpers/view';
import { FakeVault } from '../../helpers/vault';

useViewHarness();

/** Right-click a row and hand back the menu it opened — `scopeCreate.test.ts`'s own
 *  `openMenu`, over the same real listener the readiness entries join. */
function openMenu(view: { viewEl: HTMLElement }, path: string): Menu {
	Menu.forget();
	const rowEl = row(view, path);
	rowEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
	if (!Menu.lastShown) throw new Error(`no menu opened on ${path}`);
	return Menu.lastShown;
}

const titles = (menu: Menu): string[] => menu.items.map((item) => item.titleText);
const checkedTitles = (menu: Menu): string[] => menu.items.filter((item) => item.checked).map((item) => item.titleText);

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

/**
 * A member carrying a risk and one carrying none — `scopeVault()`'s own `M1.md`/`M2.md`
 * carry no risk value at all ("draws no risk chip where there is no value to offer" above
 * states that as the fixture's own invariant), so this file's own small vault is what
 * supplies the readiness suite a value to check and a value to offer no clear on.
 */
function riskVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('M1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[0.9]]', risk: 'High' } });
	vault.addFile('M2.md', { frontmatter: { type: 'PBI', order: 2, release: '[[0.9]]' } });
	return vault;
}

describe('writing a member’s readiness values', () => {
	describe('effort', () => {
		it('writes what the chip’s dialog was given', async () => {
			const { view, vault } = releaseScreen({});
			row(view, 'M2.md').querySelector<HTMLElement>('.pbl-rel-effortcol .pbl-state-chip')!.click();
			await flush();
			submitPrompt('8');
			await flush();

			expect(vault.fm('M2.md').effort).toBe('8');
		});

		it('is reachable from the row menu too, through the same method', async () => {
			const { view, vault } = releaseScreen({});
			const menu = openMenu(view, 'M2.md');
			menu.item('Set effort')!.click();
			submitPrompt('8');
			await flush();

			expect(vault.fm('M2.md').effort).toBe('8');
		});
	});

	describe('risk', () => {
		it('checks the entry that would write nothing', () => {
			const { view } = releaseScreen({}, riskVault());
			row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip')!.click();

			// `M1.md` carries `risk: High` (`riskVault`, above) — the one value observed, so
			// it is also the whole of `riskChoices` and the one entry the plan writes
			// nothing for.
			expect(checkedTitles(Menu.lastShown!)).toEqual(['High']);
		});

		it('checks case-insensitively, asking the plan rather than a bare ===', () => {
			const vault = new FakeVault();
			vault.addFile('M1.md', { frontmatter: { type: 'PBI', order: 1, release: '[[0.9]]', risk: 'high' } });
			const config = { ...RELEASE_CONFIG, criticalRiskValues: 'High', addressedRiskValues: '' };
			const { view } = releaseScreen({}, vault, config);
			row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip')!.click();

			// The note holds `high`; the declared vocabulary offers `High` too, so both are
			// on the menu. `memberRiskWrites`' own case-insensitive `sameValue` checks BOTH —
			// a naive `===` against the raw value would tick only the exact-case `high`.
			expect(checkedTitles(Menu.lastShown!)).toEqual(['High', 'high']);
		});

		it('offers no clear on a member carrying nothing', () => {
			const { view } = releaseScreen({}, riskVault());
			row(view, 'M2.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip')!.click();

			expect(titles(Menu.lastShown!)).not.toContain('Clear risk');
		});

		it('clears the key on a member that carries one', async () => {
			const { view, vault } = releaseScreen({}, riskVault());
			row(view, 'M1.md').querySelector<HTMLElement>('.pbl-rel-riskcol .pbl-state-chip')!.click();
			Menu.lastShown!.item('Clear risk')!.click();
			await flush();

			expect(vault.fm('M1.md').risk).toBeUndefined();
		});

		it('writes what the row menu’s entry picks, through the same method the chip uses', async () => {
			const { view, vault } = releaseScreen({}, riskVault());
			const rowMenu = openMenu(view, 'M2.md');
			// `Set risk` is a true SUBMENU (`submenuOf`), never a second popup — so its
			// entries are read straight off the item rather than off a fresh `Menu.lastShown`.
			const submenu = rowMenu.item('Set risk')!.submenu!;
			submenu.item('High')!.click();
			await flush();

			expect(vault.fm('M2.md').risk).toBe('High');
		});
	});
});

describe('a context row’s menu', () => {
	it('has no readiness entries, and no chips either', () => {
		const { view } = releaseScreen({}, contextVault());

		expect(row(view, 'E.md').querySelector('.pbl-rel-effortcol .pbl-state-chip')).toBeNull();
		expect(row(view, 'E.md').querySelector('.pbl-rel-riskcol .pbl-state-chip')).toBeNull();

		const menu = openMenu(view, 'E.md');
		expect(titles(menu)).not.toContain('Set effort');
		expect(titles(menu)).not.toContain('Set risk');
	});
});
