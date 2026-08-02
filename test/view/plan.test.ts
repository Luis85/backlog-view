// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, MenuItem, Modal } from '../helpers/obsidian-mock';
import { flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Setting the roadmap's placement properties from a row — the same writes the
 * roadmap's own gestures will plan, reached from the item rather than from the mode.
 */

/** Both axes configured, the way a roadmap view would have them. */
const AXES = {
	horizonProperty: 'note.horizon',
	startProperty: 'note.start',
	targetProperty: 'note.due',
};

function planVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
	vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Planned.md', {
		frontmatter: { type: 'Epic', order: 30, start: '2026-08-03', due: '2026-08-14' },
	});
	return vault;
}

/** Open a row's context menu and return it. */
function menuFor(containerEl: HTMLElement, title: string): Menu {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error(`no context menu for ${title}`);
	return menu;
}

function titlesOfMenu(menu: Menu): string[] {
	return menu.items.map((i) => i.titleText);
}

/** The entries of a submenu, by the title of the item holding it. */
function submenuOf(menu: Menu, title: string): MenuItem[] {
	const item = menu.item(title);
	if (!item?.submenu) throw new Error(`no submenu on ${title}`);
	return item.submenu.items;
}

function click(items: MenuItem[], title: string): void {
	const item = items.find((i) => i.titleText === title);
	if (!item) throw new Error(`no menu entry ${title}`);
	item.click();
}

/** Fill the open schedule prompt (start, then target) and press Save. */
function submitSchedule(values: string[]): void {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('schedule prompt not opened');
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	values.forEach((value, i) => {
		inputs[i].value = value;
		inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
	});
	modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('setting a horizon from the row', () => {
	it('offers the declared vocabulary, the values the results carry, and the item\'s own', () => {
		const vault = planVault();
		vault.addFile('Odd.md', { frontmatter: { type: 'Epic', order: 40, horizon: 'Someday' } });
		const { containerEl } = makeView(vault, { ...AXES, horizonValues: 'Now, Next' });

		const entries = submenuOf(menuFor(containerEl, 'Untriaged'), 'Set horizon');

		// Declared first, then the bucket another result already minted — the row menu
		// can reach every target the roadmap draws. No Clear entry: this row carries no
		// horizon key, so there would be nothing for it to remove.
		expect(entries.map((i) => i.titleText)).toEqual(['Now', 'Next', 'Someday']);
	});

	it('checks the value the item holds, whatever its casing', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'now' } });
		const { containerEl } = makeView(vault, { ...AXES, horizonValues: 'Now, Next' });

		const entries = submenuOf(menuFor(containerEl, 'A'), 'Set horizon');

		expect(entries.filter((i) => i.checked).map((i) => i.titleText)).toEqual(['Now']);
	});

	it('appends a value on neither list so the current horizon always renders checked', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Q3' } });
		const { containerEl } = makeView(vault, { ...AXES, horizonValues: 'Now, Next' });

		const entries = submenuOf(menuFor(containerEl, 'A'), 'Set horizon');

		expect(entries.map((i) => i.titleText)).toContain('Q3');
		expect(entries.filter((i) => i.checked).map((i) => i.titleText)).toEqual(['Q3']);
	});

	it('follows the buckets on screen when the roadmap is the projection', () => {
		const vault = new FakeVault();
		// The Epic is not drawn under a Feature focus, so the axis never mints its
		// bucket first — but the model met its value first. On screen, the buckets win.
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Xray' } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Yankee' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 20, horizon: 'Xray' }, parentLink: 'Epic' });
		const { view, containerEl } = makeView(vault, { ...AXES, focusLevel: 'Feature' });

		// The tree has no buckets to follow, so it lists the vocabulary as the model
		// met it: the hidden Epic's value first.
		expect(submenuOf(menuFor(containerEl, 'F1'), 'Set horizon').map((i) => i.titleText)).toEqual([
			'Now',
			'Next',
			'Later',
			'Xray',
			'Yankee',
			'Clear horizon',
		]);

		view.setProjection('roadmap');
		const card = containerEl.querySelector<HTMLElement>('.pbl-card');
		card?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const entries = Menu.lastShown?.item('Set horizon')?.submenu?.items ?? [];

		// Drawn order: the focused rows mint Yankee, then Xray. Nothing is lost — the
		// vocabulary is the same set, in the order the user can see.
		expect(entries.map((i) => i.titleText)).toEqual([
			'Now',
			'Next',
			'Later',
			'Yankee',
			'Xray',
			'Clear horizon',
		]);
	});

	it('writes the picked value to the note, and nothing else', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		click(submenuOf(menuFor(containerEl, 'Untriaged'), 'Set horizon'), 'Next');
		await flush();

		expect(vault.fm('Untriaged.md')['horizon']).toBe('Next');
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Untriaged.md']);
	});

	it('removes the key on Clear horizon, and offers it only where there is one', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		// Nothing to clear on a note with no horizon key at all.
		expect(submenuOf(menuFor(containerEl, 'Untriaged'), 'Set horizon').map((i) => i.titleText)).not.toContain(
			'Clear horizon',
		);

		click(submenuOf(menuFor(containerEl, 'Placed'), 'Set horizon'), 'Clear horizon');
		await flush();

		// Removed, never blanked: an empty value would render as a bucket named nothing.
		expect('horizon' in vault.fm('Placed.md')).toBe(false);
	});

	it('takes a horizon back with one undo', async () => {
		const vault = planVault();
		const { view, containerEl } = makeView(vault, AXES);

		click(submenuOf(menuFor(containerEl, 'Placed'), 'Set horizon'), 'Later');
		await flush();
		expect(vault.fm('Placed.md')['horizon']).toBe('Later');

		await view.undoLast();
		await flush();
		expect(vault.fm('Placed.md')['horizon']).toBe('Now');
	});
});

describe('scheduling from the row', () => {
	it('prefills the entry with the dates the note states', () => {
		const { containerEl } = makeView(planVault(), AXES);

		menuFor(containerEl, 'Planned').item('Schedule')?.click();

		const inputs = Array.from(Modal.lastOpened?.contentEl.querySelectorAll('input') ?? []);
		expect(inputs.map((i) => i.value)).toEqual(['2026-08-03', '2026-08-14']);
	});

	it('writes both ends as one batch, taken back by one undo', async () => {
		const vault = planVault();
		const { view, containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Untriaged').item('Schedule')?.click();
		submitSchedule(['2026-09-01', '2026-09-30']);
		await flush();

		expect(vault.fm('Untriaged.md')['start']).toBe('2026-09-01');
		expect(vault.fm('Untriaged.md')['due']).toBe('2026-09-30');

		await view.undoLast();
		await flush();
		expect('start' in vault.fm('Untriaged.md')).toBe(false);
		expect('due' in vault.fm('Untriaged.md')).toBe(false);
	});

	it('removes the end whose field is emptied, leaving the other alone', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Planned').item('Schedule')?.click();
		submitSchedule(['2026-08-03', '']);
		await flush();

		expect(vault.fm('Planned.md')['start']).toBe('2026-08-03');
		expect('due' in vault.fm('Planned.md')).toBe(false);
	});

	it('writes nothing when a prompt opened on empty keys is confirmed unchanged', async () => {
		const vault = planVault();
		// The stub the backfill leaves: the keys exist, holding nothing.
		vault.addFile('Stubbed.md', { frontmatter: { type: 'Epic', order: 40, start: '', due: '' } });
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Stubbed').item('Schedule')?.click();
		submitSchedule(['', '']);
		await flush();

		// A field that ARRIVED blank states nothing, so confirming must not delete the
		// key and spend the undo slot. Unschedule is the way to take one away.
		expect(vault.writeLog).toEqual([]);
		expect('start' in vault.fm('Stubbed.md')).toBe(true);
	});

	it('still clears a date the note does state when its field is emptied', async () => {
		const vault = planVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 40, start: 'someday' } });
		const { containerEl } = makeView(vault, AXES);

		// An unreadable value arrives blank; confirming replaces it rather than
		// writing it back — the entry asks for a date and that was not one.
		menuFor(containerEl, 'Garbled').item('Schedule')?.click();
		submitSchedule(['', '']);
		await flush();

		expect('start' in vault.fm('Garbled.md')).toBe(false);
	});

	it('refuses a date it cannot read, keeping the prompt open and the note untouched', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Untriaged').item('Schedule')?.click();
		submitSchedule(['next tuesday', '']);
		await flush();

		const modal = Modal.lastOpened;
		expect(modal?.contentEl.querySelector('.pbl-modal-error')?.textContent).toContain('not a date');
		// Still open, still holding what was typed: nothing is guessed at, and nothing
		// is written on the way out either.
		expect(modal?.contentEl.querySelector('input')?.value).toBe('next tuesday');
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses a target before its start', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Untriaged').item('Schedule')?.click();
		submitSchedule(['2026-09-30', '2026-09-01']);
		await flush();

		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toContain(
			'cannot be before',
		);
		expect(vault.writeLog).toEqual([]);
	});

	it('asks only for the end the configuration has', () => {
		const { containerEl } = makeView(planVault(), { horizonProperty: 'note.horizon', startProperty: 'note.start' });

		menuFor(containerEl, 'Planned').item('Schedule')?.click();

		const inputs = Array.from(Modal.lastOpened?.contentEl.querySelectorAll('input') ?? []);
		expect(inputs).toHaveLength(1);
		expect(inputs[0].value).toBe('2026-08-03');
	});

	it('unschedules by removing the keys, and offers it only where there are some', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		expect(titlesOfMenu(menuFor(containerEl, 'Untriaged'))).not.toContain('Unschedule');

		menuFor(containerEl, 'Planned').item('Unschedule')?.click();
		await flush();

		expect('start' in vault.fm('Planned.md')).toBe(false);
		expect('due' in vault.fm('Planned.md')).toBe(false);
	});
});

describe('what the menu withholds', () => {
	it('offers no placement actions while neither axis is configured', () => {
		const { containerEl } = makeView(planVault(), {});

		const titles = titlesOfMenu(menuFor(containerEl, 'Placed'));

		// Absent, not inert: nothing offered can write to a key nobody named.
		expect(titles).not.toContain('Set horizon');
		expect(titles).not.toContain('Schedule');
		expect(titles).not.toContain('Unschedule');
	});

	it('withholds each axis on its own', () => {
		const horizonsOnly = makeView(planVault(), { horizonProperty: 'note.horizon' });
		expect(titlesOfMenu(menuFor(horizonsOnly.containerEl, 'Placed'))).toContain('Set horizon');
		expect(titlesOfMenu(menuFor(horizonsOnly.containerEl, 'Placed'))).not.toContain('Schedule');

		const datesOnly = makeView(planVault(), { startProperty: 'note.start' });
		expect(titlesOfMenu(menuFor(datesOnly.containerEl, 'Planned'))).toContain('Schedule');
		expect(titlesOfMenu(menuFor(datesOnly.containerEl, 'Planned'))).not.toContain('Set horizon');
	});

	it('withholds the horizon actions when the values list is cleared', () => {
		// A horizon property with no vocabulary is a board without stages: the bucket
		// axis is unconfigured, so there is nothing here to set a row to either.
		const { containerEl } = makeView(planVault(), { ...AXES, horizonValues: '' });

		expect(titlesOfMenu(menuFor(containerEl, 'Placed'))).not.toContain('Set horizon');
	});
});
