// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, MenuItem, Modal } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

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

/** The date fields of the open schedule prompt, in the order it asks for them. */
function scheduleInputs(): HTMLInputElement[] {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('schedule prompt not opened');
	return Array.from(modal.contentEl.querySelectorAll('input'));
}

/** A button of the open prompt, by its label — the clear buttons sit beside the fields. */
function promptButton(label: string): HTMLElement {
	const modal = Modal.lastOpened;
	const found = Array.from(modal?.contentEl.querySelectorAll('button') ?? []).find(
		(btn) => btn.textContent === label || btn.getAttribute('aria-label') === label,
	);
	if (!found) throw new Error(`no prompt button ${label}`);
	return found;
}

/** Fill the open schedule prompt (start, then target) and press Save. */
function submitSchedule(values: string[]): void {
	const inputs = scheduleInputs();
	values.forEach((value, i) => {
		inputs[i].value = value;
		inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
	});
	promptButton('Save').dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
		const { view, containerEl } = makeView(vault, AXES, { focus: 'Feature' });

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

describe('the horizon chip on a row', () => {
	const chipOf = (containerEl: HTMLElement, title: string) =>
		rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-horizon-chip');
	/** The property order every chip test needs: a chip is drawn by a VISIBLE column. */
	const visible = { order: ['note.horizon'] };

	it('shows the placement and writes the one picked from its menu', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES, visible);

		expect(chipOf(containerEl, 'Placed')?.querySelector('.pbl-state-text')?.textContent).toBe('Now');
		// Unplaced is named with the roadmap's own word for it, and dashed like the
		// unset state chip beside it.
		const untriaged = chipOf(containerEl, 'Untriaged');
		expect(untriaged?.querySelector('.pbl-state-text')?.textContent).toBe('Unplaced');
		expect(untriaged?.classList.contains('pbl-horizon-unset')).toBe(true);
		// A button assistive tech can activate, kept out of the tree's single tab stop.
		expect(untriaged?.tagName).toBe('BUTTON');
		expect(untriaged?.getAttribute('tabindex')).toBe('-1');

		untriaged?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const menu = Menu.lastShown;
		// The row menu's own Set horizon list, not a second one: same values, same
		// checkmarks asked of the same plan, and the same Clear entry rule.
		expect(menu?.items.map((i) => i.titleText)).toEqual(['Now', 'Next', 'Later']);
		menu?.item('Next')?.click();
		await flush();

		expect(vault.fm('Untriaged.md')['horizon']).toBe('Next');
		// The chip is a control, not part of the row: pressing it opens no note.
		expect(vault.opened).toEqual([]);
	});

	it('says unplaced, with the reason, for a value the axis refuses', () => {
		const vault = planVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 40, horizon: { nested: true } } });
		const { containerEl } = makeView(vault, AXES, visible);

		// The roadmap shelves such a card with the reason on its face; the chip says the
		// same thing rather than showing a horizon the axis would not honor.
		const chip = chipOf(containerEl, 'Garbled');
		expect(chip?.querySelector('.pbl-state-text')?.textContent).toBe('Unplaced');
		expect(chip?.dataset.tooltip).toBe('Unreadable horizon value');
		// And Clear is still offered: the key is there, holding something.
		chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOfMenu(Menu.lastShown ?? new Menu())).toContain('Clear horizon');
	});

	it('offers Clear exactly where the note carries the key', () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES, visible);

		chipOf(containerEl, 'Untriaged')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOfMenu(Menu.lastShown ?? new Menu())).not.toContain('Clear horizon');

		chipOf(containerEl, 'Placed')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOfMenu(Menu.lastShown ?? new Menu())).toContain('Clear horizon');
	});

	it('shows a context row where it sits without offering to move it', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		// The Epic is context: an ancestor the filter did not return.
		const { view, containerEl } = makeView(vault, AXES, visible);
		(view as unknown as Record<string, unknown>).data = {
			data: vault.entries().filter((e) => e.file.path === 'Feature.md'),
		};
		view.onDataUpdated();
		clickExpandAll(containerEl);

		const context = rowByTitle(containerEl, 'Epic').querySelector('.pbl-horizon-chip');
		expect(context?.querySelector('.pbl-state-text')?.textContent).toBe('Now');
		// Static, like its state chip: it renders, it never writes.
		expect(context?.tagName).toBe('DIV');
		expect(context?.classList.contains('pbl-state-static')).toBe(true);
	});

	it('is absent while the bucket axis is unconfigured', () => {
		const { containerEl } = makeView(planVault(), { horizonProperty: 'note.horizon', horizonValues: '' });
		expect(containerEl.querySelector('.pbl-horizon-chip')).toBeNull();
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

	it('leaves an unreadable value alone when its blank field is confirmed untouched', async () => {
		const vault = planVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 40, start: 'someday' } });
		const { containerEl } = makeView(vault, AXES);

		// An unreadable value arrives blank, exactly as an absent one does — so a reader
		// pressing Save cannot have MEANT to delete it, having never been shown it. The
		// entry decides from the form, and a field returned as it arrived states nothing.
		// Typing a date replaces it; Unschedule removes it.
		menuFor(containerEl, 'Garbled').item('Schedule')?.click();
		submitSchedule(['', '']);
		await flush();

		expect(vault.fm('Garbled.md')['start']).toBe('someday');
		expect(vault.writeLog).toEqual([]);
	});

	it('does not revert an end corrected while the entry sat open', async () => {
		const vault = planVault();
		vault.addFile('Both.md', { frontmatter: { type: 'Epic', order: 50, start: 'someday', due: '2026-09-01' } });
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Both').item('Schedule')?.click();
		// Another editor repairs the unreadable start while the prompt is open. The
		// reader never sees it: their start field is still the blank it opened with.
		vault.setFrontmatter('Both.md', { type: 'Epic', order: 50, start: '2026-08-20', due: '2026-09-01' });
		// They edit only the target and save.
		submitSchedule(['', '2026-09-15']);
		await flush();

		expect(vault.fm('Both.md')['start']).toBe('2026-08-20');
		expect(vault.fm('Both.md')['due']).toBe('2026-09-15');
	});

	it('asks with native date fields, which cannot hand back anything but a date', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Planned').item('Schedule')?.click();

		// `type="date"` is what brings the platform's own picker, and it is also what
		// makes "not a date" unreachable rather than merely refused: the field round-
		// trips YYYY-MM-DD and sanitizes everything else to nothing, so no unreadable
		// value can reach the plan. The domain keeps its own backstop either way.
		expect(scheduleInputs().map((i) => i.type)).toEqual(['date', 'date']);
		submitSchedule(['next tuesday', '2026-08-14']);
		await flush();

		expect('start' in vault.fm('Planned.md')).toBe(false);
		expect(vault.fm('Planned.md')['due']).toBe('2026-08-14');
	});

	it('clears one end from its own button, without touching the other', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Planned').item('Schedule')?.click();
		// A date input empties segment by segment from the keyboard, which is a gesture
		// nobody finds — so "leave a field empty to remove that date" gets a button.
		promptButton('Clear start').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(scheduleInputs()[0].value).toBe('');
		promptButton('Save').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect('start' in vault.fm('Planned.md')).toBe(false);
		expect(vault.fm('Planned.md')['due']).toBe('2026-08-14');
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

	it('validates a start-only vault’s one-field entry with no target key to compare against', async () => {
		// The mirror of the milestone case above: here it is `target` that is absent
		// from the submitted values, not `start` — `validateSchedule`'s own two `?? ''`
		// fallbacks answered from the other side, on the ordinary work-item path this
		// vault's configuration (not the type) narrows to one field.
		const vault = planVault();
		const { containerEl } = makeView(vault, { horizonProperty: 'note.horizon', startProperty: 'note.start' });

		menuFor(containerEl, 'Untriaged').item('Schedule')?.click();
		submitSchedule(['2026-09-01']);
		await flush();

		expect(vault.fm('Untriaged.md')['start']).toBe('2026-09-01');
		expect('due' in vault.fm('Untriaged.md')).toBe(false);
	});

	it('leaves an end alone that another edit changed while the prompt sat open, unless the user touched it', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Planned').item('Schedule')?.click();
		// Another editor moves the target while the prompt is open. The modal still
		// shows what it was prefilled with — it has no way to know.
		vault.setFrontmatter('Planned.md', { type: 'Epic', order: 30, start: '2026-08-03', due: '2026-08-20' });

		// The user edits only the start; the target field is submitted exactly as it
		// arrived, having never been touched.
		submitSchedule(['2026-08-10', '2026-08-14']);
		await flush();

		expect(vault.fm('Planned.md')['start']).toBe('2026-08-10');
		// A field that states what it was prefilled with states nothing new, so the
		// concurrent edit survives — not the dialog's stale prefill for the end
		// nobody edited.
		expect(vault.fm('Planned.md')['due']).toBe('2026-08-20');
	});

	it('refuses the whole batch when the untouched end would leave a reversed pair against the live note', async () => {
		const vault = planVault();
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Planned').item('Schedule')?.click();
		// Another editor slides the start later while the prompt is open.
		vault.setFrontmatter('Planned.md', { type: 'Epic', order: 30, start: '2026-08-20', due: '2026-08-14' });

		// The start field is submitted untouched (the stale prefill), and the user
		// only edits the target — to a date that is fine against the prefill but
		// reversed against the live start.
		submitSchedule(['2026-08-03', '2026-08-05']);
		await flush();

		// Refused whole: the live start survives, and so does the original target.
		expect(vault.fm('Planned.md')['start']).toBe('2026-08-20');
		expect(vault.fm('Planned.md')['due']).toBe('2026-08-14');
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

describe('placement actions answer for the milestone type', () => {
	it('asks a milestone for its target alone, and never applies the span rule to it', () => {
		const vault = new FakeVault();
		// A start later than the target would trip the span rule for a work item; a
		// milestone must never see it, because the field it might compare against is
		// never offered in the first place.
		vault.addFile('Ship 1.0.md', {
			frontmatter: { type: 'Milestone', order: 10, start: '2026-12-31', due: '2026-01-01' },
		});
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Ship 1.0').item('Schedule')?.click();

		const inputs = scheduleInputs();
		expect(inputs).toHaveLength(1);
		expect(inputs[0].value).toBe('2026-01-01');
	});

	it('takes the target alone away on Unschedule, leaving a start it only promised to ignore', async () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', {
			frontmatter: { type: 'Milestone', order: 10, start: '2026-01-01', due: '2026-12-01' },
		});
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Ship 1.0').item('Unschedule')?.click();
		await flush();

		// Ignoring a value and deleting it are different acts, and only the first was
		// specified. This is the rule reached by the other hand.
		expect('due' in vault.fm('Ship 1.0.md')).toBe(false);
		expect(vault.fm('Ship 1.0.md')['start']).toBe('2026-01-01');
	});

	it('offers a milestone no schedule entry at all on a start-only vault', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10 } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 20 } });
		// Narrowing the fields to the target alone narrows what may offer them: an entry
		// opened onto no fields is the failure the context-row rule and the empty add
		// button both answer by removing the control. A gesture that can only end in
		// nothing must not start.
		const { containerEl } = makeView(vault, { startProperty: 'note.start' });

		expect(titlesOfMenu(menuFor(containerEl, 'Ship 1.0'))).not.toContain('Schedule');
		// A work item in the same vault keeps it — the rule is per type, not per vault.
		expect(titlesOfMenu(menuFor(containerEl, 'A story'))).toContain('Schedule');
	});

	it('answers Unschedule’s offer on the target key alone for a milestone', () => {
		const vault = new FakeVault();
		// A start-only milestone carries nothing this action may take away.
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-01-01' } });
		const { containerEl } = makeView(vault, AXES);

		expect(titlesOfMenu(menuFor(containerEl, 'Ship 1.0'))).not.toContain('Unschedule');
	});

	it('writes a milestone’s target alone from its one-field entry, leaving an unreadable start it was never asked about', async () => {
		// The entry narrows to the fields the type answers for (`scheduleFields`), so
		// a milestone's submitted values never carry a `start` key at all —
		// `validateSchedule` and `planFrom` both have to answer a field that is simply
		// ABSENT rather than blank, which an ordinary work item's entry (both fields
		// always present) never exercises. The stray unreadable start proves the
		// difference: `values` carries no `start` key at all here, which is not the same
		// question as a start field returned unchanged (see "leaves an unreadable value
		// alone" above) even though both must leave the note's own value alone.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, start: 'not a real date' } });
		const { containerEl } = makeView(vault, AXES);

		menuFor(containerEl, 'Ship 1.0').item('Schedule')?.click();
		submitSchedule(['2026-10-01']);
		await flush();

		expect(vault.fm('Ship 1.0.md')['due']).toBe('2026-10-01');
		expect(vault.fm('Ship 1.0.md')['start']).toBe('not a real date');
	});
});
