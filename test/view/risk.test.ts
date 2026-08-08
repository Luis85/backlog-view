// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { fixture, flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

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
