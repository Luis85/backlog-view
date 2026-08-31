// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fakeController, FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeViewConfig } from '../helpers/vault';
import { clickExpandAll, fixture, flush, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/** Risk named and levels declared — the configuration every Set risk test starts from. */
const configured = { riskProperty: 'note.risk' };

/** Open the row menu and return the Set risk submenu, or null when the entry is absent. */
function riskMenu(containerEl: HTMLElement, title: string): Menu | null {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	return Menu.lastShown?.item('Set risk')?.submenu ?? null;
}

describe('Set risk', () => {
	it('offers the declared levels and writes the one picked', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, configured);

		const menu = riskMenu(containerEl, 'Epic A');
		if (!menu) throw new Error('Set risk missing');
		expect(menu.items.map((i) => i.titleText)).toEqual(['1 - High', '2 - Normal', '3 - Low']);
		// Nothing is checked while the note has made no claim: absence is a value, and
		// checking a level would report a judgement nobody made.
		expect(menu.items.some((i) => i.checked)).toBe(false);

		menu.item('2 - Normal')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['risk']).toBe('2 - Normal');
	});

	it('offers the declared levels the user typed, in their order', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { ...configured, riskValues: 'Critical, Watch' });

		expect(riskMenu(containerEl, 'Epic A')?.items.map((i) => i.titleText)).toEqual(['Critical', 'Watch']);
	});

	it('checks the level the item holds, and re-picking it writes nothing', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '1 - high' } });
		const { containerEl } = makeView(vault, configured);

		const menu = riskMenu(containerEl, 'Epic A');
		// Case-insensitively: the note's own spelling is not a different level.
		expect(menu?.item('1 - High')?.checked).toBe(true);
		expect(menu?.item('3 - Low')?.checked).toBe(false);

		menu?.item('1 - High')?.click();
		await flush();

		// Untouched, spelling included — a re-pick must not spend the one undo slot, and
		// must not tidy a value the user wrote.
		expect(vault.fm('Epic A.md')['risk']).toBe('1 - high');
	});

	it('appends a level the declared list does not name, so it can render checked', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: 'Existential' } });
		const { containerEl } = makeView(vault, configured);

		const menu = riskMenu(containerEl, 'Epic A');
		// Clear risk closes the list, because this note carries the key.
		expect(menu?.items.map((i) => i.titleText)).toEqual([
			'1 - High',
			'2 - Normal',
			'3 - Low',
			'Existential',
			'Clear risk',
		]);
		expect(menu?.item('Existential')?.checked).toBe(true);
	});

	it('adds no nameless entry for the empty key the backfill leaves', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '' } });
		const { containerEl } = makeView(vault, configured);

		const menu = riskMenu(containerEl, 'Epic A');
		// No fourth, nameless level — an empty value is not a level anybody picked. The
		// key is still there, so Clear risk is what deals with it.
		expect(menu?.items.map((i) => i.titleText)).toEqual(['1 - High', '2 - Normal', '3 - Low', 'Clear risk']);
		expect(menu?.items.some((i) => i.checked)).toBe(false);
	});
});

describe('Clear risk', () => {
	it('removes the key, and is offered only while the note carries one', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '3 - Low' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = makeView(vault, configured);

		// Presence, not value: the note with no key gets no entry, so no offered action
		// here can write nothing.
		expect(riskMenu(containerEl, 'Epic B')?.item('Clear risk')).toBeUndefined();

		riskMenu(containerEl, 'Epic A')?.item('Clear risk')?.click();
		await flush();

		// Deleted rather than blanked: unjudged is a state a note returns to.
		expect('risk' in vault.fm('Epic A.md')).toBe(false);
	});

	it('is offered for the empty key the backfill leaves, and takes it away', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '' } });
		const { containerEl } = makeView(vault, configured);

		riskMenu(containerEl, 'Epic A')?.item('Clear risk')?.click();
		await flush();

		expect('risk' in vault.fm('Epic A.md')).toBe(false);
	});
});

describe('the risk chip', () => {
	/** The chip on a row, whether it is the button or a context row's static div. */
	const chipOf = (containerEl: HTMLElement, title: string) =>
		rowByTitle(containerEl, title).querySelector('.pbl-prop-risk .pbl-risk-chip');
	/** The property order every chip test needs: a chip is drawn by a VISIBLE column. */
	const visible = { order: ['note.risk'] };

	it('shows the level the note declares and writes the one picked from it', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '3 - Low' } });
		const { containerEl } = makeView(vault, configured, visible);

		const chip = chipOf(containerEl, 'Epic A');
		expect(chip?.textContent).toBe('3 - Low');
		expect(chip?.getAttribute('aria-label')).toBe('Change risk (currently 3 - Low)');
		// No Tab stop: the tree is one stop and the context menu is the keyboard path.
		expect(chip?.getAttribute('tabindex')).toBe('-1');

		(chip as HTMLElement).click();
		// The chip opens the row menu's OWN list, so the two cannot offer different
		// levels or disagree about which is current.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['1 - High', '2 - Normal', '3 - Low', 'Clear risk']);
		expect(Menu.lastShown?.item('3 - Low')?.checked).toBe(true);

		Menu.lastShown?.item('1 - High')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['risk']).toBe('1 - High');
	});

	it('invites a judgement on a note that carries none', () => {
		const { containerEl } = makeView(fixture(), configured, visible);

		const chip = chipOf(containerEl, 'Epic A');
		// Absence is not a level, so nothing is named — but the chip is still there to
		// press, which is the whole point of putting it on the row.
		expect(chip?.textContent).toBe('Risk');
		expect(chip?.classList.contains('pbl-risk-unset')).toBe(true);
		expect(chip?.getAttribute('aria-label')).toBe('Set risk');
	});

	it('is what its own column draws, so the value is never rendered twice', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '3 - Low', horizon: 'Now' } });
		vault.entryValues.set('Epic A.md', {
			'note.risk': { toString: () => '3 - Low' },
			'note.points': { toString: () => '5' },
		});
		const { containerEl, config, view } = makeView(vault, { ...configured, horizonProperty: 'note.horizon' });
		// The risk property is among the visible ones — the chip is what its cell draws,
		// the state chip's own rule, so the value is never drawn twice with one of them
		// inert. And the column sits where the menu put it, not past the properties.
		config.order = ['note.risk', 'note.points', 'note.horizon'];
		view.onDataUpdated();

		const header = treeOf(containerEl).querySelector('.pbl-cols');
		expect(Array.from(header?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent)).toEqual([
			'risk',
			'points',
			'horizon',
			'Items',
		]);
		expect(Array.from(rowByTitle(containerEl, 'Epic A').querySelectorAll('.pbl-prop-value')).length).toBe(1);
	});

	it('is absent once the levels are cleared, and the property goes back to a column', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '3 - Low' } });
		vault.entryValues.set('Epic A.md', { 'note.risk': { toString: () => '3 - Low' } });
		const { containerEl, config, view } = makeView(vault, { ...configured, riskValues: '' });
		config.order = ['note.risk'];
		view.onDataUpdated();

		// A chip whose menu could set nothing is the lie an absent control avoids — and
		// nothing else is showing the property now, so the ordinary column is right.
		expect(containerEl.querySelector('.pbl-risk-chip')).toBeNull();
		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-prop-value')?.textContent).toBe('3 - Low');
	});

	it('is static on a row the base filtered out, and absent where it says nothing', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, risk: '1 - High' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView(fakeController(), containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig(configured);
		config.order = ['note.risk'];
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'PBI.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);

		// It renders and it parents; it is never a write target. So: shown, not pressable.
		const context = chipOf(containerEl, 'Epic');
		expect(context?.tagName).toBe('DIV');
		expect(context?.textContent).toBe('1 - High');
		// With nothing to show it draws nothing at all, rather than a button-shaped
		// invitation to a write this row cannot take.
		expect(chipOf(containerEl, 'Feature')).toBeNull();
	});

	it('is counted in the budget, so a pane too narrow for it drops it', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, risk: '3 - Low' } });
		const { containerEl, view } = makeView(vault, { ...configured, stateProperty: 'note.status' }, visible);
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};

		const drawn = () => rowByTitle(containerEl, 'Epic A').querySelectorAll('.pbl-prop').length;

		paneWidth(700);
		expect(drawn()).toBe(1);

		// A column the budget did not account for would overflow instead of dropping,
		// and this pane is too narrow only once the chip's own column is counted.
		paneWidth(500);
		expect(drawn()).toBe(0);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);
	});
});

describe('when risk is not fully configured', () => {
	it('offers no Set risk without a property, however the levels are set', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {});

		expect(riskMenu(containerEl, 'Epic A')).toBeNull();
	});

	it('offers no Set risk once the levels are cleared', () => {
		const vault = fixture();
		// Both halves are needed: a property with nothing to offer opens a submenu onto
		// nothing, which is what an absent control exists to avoid.
		const { containerEl } = makeView(vault, { ...configured, riskValues: '' });

		expect(riskMenu(containerEl, 'Epic A')).toBeNull();
	});
});
