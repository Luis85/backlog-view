// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeViewConfig } from '../helpers/vault';
import { clickExpandAll, fixture, flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

/**
 * The MoSCoW ladder as a property, a menu and a chip.
 *
 * Priority is the second DECLARED ladder and it reuses risk's machinery whole — one row
 * in `PROPERTY_TABLE`, one in `LABEL_CHIPS`, one in `applyLabels`, and `declaredChoices`
 * shared with `addRiskItems`. So this suite deliberately does NOT restate what
 * `risk.test.ts` already drives through that shared code (the fit budget, the
 * value-drawn-twice rule, the empty stub the backfill leaves). What is priority's OWN and
 * is asserted here: the ladder it ships with, that the wiring reaches every layer end to
 * end, that a level and its removal land on the note, and that each gate — the levels, the
 * property, the base's filter — withholds this control exactly where it withholds risk's.
 */

useViewHarness();

/** Priority named; the levels come from the shipped default unless a test says otherwise. */
const configured = { priorityProperty: 'note.priority' };
/** A chip is drawn by a VISIBLE column, so every chip test needs the property in the order. */
const visible = { order: ['note.priority'] };

/** Open the row menu and return the Set priority submenu, or null when the entry is absent. */
function priorityMenu(containerEl: HTMLElement, title: string): Menu | null {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	return Menu.lastShown?.item('Set priority')?.submenu ?? null;
}

const chipOf = (containerEl: HTMLElement, title: string) =>
	rowByTitle(containerEl, title).querySelector('.pbl-prop-priority .pbl-priority-chip');

describe('Set priority', () => {
	it('ships the MoSCoW ladder, numbered, and writes the rung picked', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, configured);

		const menu = priorityMenu(containerEl, 'Epic A');
		if (!menu) throw new Error('Set priority missing');
		// The shipped default, in rank order, `Won't` included: dropping the last rung
		// makes "not this time" indistinguishable from "nobody has judged it".
		expect(menu.items.map((i) => i.titleText)).toEqual(['1 - Must', '2 - Should', '3 - Could', "4 - Won't"]);
		// Nothing checked while the note has made no claim — absence is not a rung.
		expect(menu.items.some((i) => i.checked)).toBe(false);

		menu.item('2 - Should')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['priority']).toBe('2 - Should');
	});

	it('offers the ladder the user declared instead, in their order', () => {
		const vault = fixture();
		// MoSCoW is what this ships with, not what the property means.
		const { containerEl } = makeView(vault, { ...configured, priorityValues: 'P1, P2, P3' });

		expect(priorityMenu(containerEl, 'Epic A')?.items.map((i) => i.titleText)).toEqual(['P1', 'P2', 'P3']);
	});

	it('checks the rung the note holds, appends an unlisted one, and re-picking writes nothing', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, priority: '1 - must' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, priority: 'Blocker' } });
		const { containerEl } = makeView(vault, configured);

		// Case-insensitively: the note's own spelling is not a different rung.
		expect(priorityMenu(containerEl, 'Epic A')?.item('1 - Must')?.checked).toBe(true);
		// A rung the list does not name is appended so it can render checked — a menu
		// that cannot show what the item IS loses that value on the next pick.
		const unlisted = priorityMenu(containerEl, 'Epic B');
		expect(unlisted?.items.map((i) => i.titleText)).toEqual([
			'1 - Must',
			'2 - Should',
			'3 - Could',
			"4 - Won't",
			'Blocker',
			'Clear priority',
		]);
		expect(unlisted?.item('Blocker')?.checked).toBe(true);

		priorityMenu(containerEl, 'Epic A')?.item('1 - Must')?.click();
		await flush();

		// Untouched, spelling included: a re-pick must not spend the one undo slot, and
		// must not tidy a value the user wrote.
		expect(vault.fm('Epic A.md')['priority']).toBe('1 - must');
	});
});

describe('Clear priority', () => {
	it('removes the key, and is offered only while the note carries one', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, priority: '3 - Could' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = makeView(vault, configured);

		// Presence, not value: the note with no key gets no entry, so no offered action
		// here can write nothing.
		expect(priorityMenu(containerEl, 'Epic B')?.item('Clear priority')).toBeUndefined();

		priorityMenu(containerEl, 'Epic A')?.item('Clear priority')?.click();
		await flush();

		// Deleted rather than blanked: unranked is a state a note returns to.
		expect('priority' in vault.fm('Epic A.md')).toBe(false);
	});
});

describe('the priority chip', () => {
	it('shows the rung the note declares and writes the one picked from it', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, priority: '3 - Could' } });
		const { containerEl } = makeView(vault, configured, visible);

		const chip = chipOf(containerEl, 'Epic A');
		expect(chip?.textContent).toBe('3 - Could');
		expect(chip?.getAttribute('aria-label')).toBe('Change priority (currently 3 - Could)');
		// No Tab stop: the tree is one stop and the context menu is the keyboard path.
		expect(chip?.getAttribute('tabindex')).toBe('-1');

		(chip as HTMLElement).click();
		// The chip opens the row menu's OWN list, so the two cannot offer different rungs
		// or disagree about which is current.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual([
			'1 - Must',
			'2 - Should',
			'3 - Could',
			"4 - Won't",
			'Clear priority',
		]);
		expect(Menu.lastShown?.item('3 - Could')?.checked).toBe(true);

		Menu.lastShown?.item('1 - Must')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['priority']).toBe('1 - Must');
	});

	it('invites a ranking on a note that carries none', () => {
		const { containerEl } = makeView(fixture(), configured, visible);

		const chip = chipOf(containerEl, 'Epic A');
		// Absence is not a rung, so nothing is named — but the chip is still there to
		// press, which is the whole point of putting it on the row.
		expect(chip?.textContent).toBe('Priority');
		expect(chip?.classList.contains('pbl-priority-unset')).toBe(true);
		expect(chip?.getAttribute('aria-label')).toBe('Set priority');
	});

	it('is static on a row the base filtered out, and absent where it says nothing', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, priority: '1 - Must' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig(configured);
		config.order = ['note.priority'];
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'PBI.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);

		// It renders and it parents; it is never a write target. So: shown, not pressable.
		const context = chipOf(containerEl, 'Epic');
		expect(context?.tagName).toBe('DIV');
		expect(context?.textContent).toBe('1 - Must');
		// With nothing to show it draws nothing at all, rather than a button-shaped
		// invitation to a write this row cannot take.
		expect(chipOf(containerEl, 'Feature')).toBeNull();
	});
});

describe('when priority is not fully configured', () => {
	it('offers no Set priority without a property, however the levels are set', () => {
		const { containerEl } = makeView(fixture(), {});

		expect(priorityMenu(containerEl, 'Epic A')).toBeNull();
	});

	it('withdraws the menu and the chip once the levels are cleared, leaving an ordinary column', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, priority: '3 - Could' } });
		vault.entryValues.set('Epic A.md', { 'note.priority': { toString: () => '3 - Could' } });
		const { containerEl, config, view } = makeView(vault, { ...configured, priorityValues: '' });
		config.order = ['note.priority'];
		view.onDataUpdated();

		// Both halves or nothing: a submenu opening onto an empty list, and a chip whose
		// menu could set nothing, are the lie an absent control avoids. The property is
		// still a property — Obsidian's own editor edits it, and the column shows it.
		expect(priorityMenu(containerEl, 'Epic A')).toBeNull();
		expect(containerEl.querySelector('.pbl-priority-chip')).toBeNull();
		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-prop-value')?.textContent).toBe('3 - Could');
	});
});
