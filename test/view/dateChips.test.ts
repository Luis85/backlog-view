// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { flush, makeView, promptButton, rowByTitle, scheduleInputs, submitSchedule, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The two ends of the plan, as chips on the row — the fourth instance of the shape
 * `Workflow state`, `Horizon and dates from the row` and `Risk from the row` settled.
 *
 * What is asserted here that the other chip suites do not have to: the chip is drawn per
 * COLUMN while which ends exist is a question about the item's TYPE, so a marker's start
 * cell has to answer differently from every other row in the same column.
 */

const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };
/** A chip is drawn by a VISIBLE column, so every test here says which columns the base shows. */
const VISIBLE = { order: ['note.start', 'note.due'] };

function dateVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Planned.md', {
		frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' },
	});
	vault.addFile('Unplanned.md', { frontmatter: { type: 'PBI', order: 20 } });
	vault.addFile('Garbled.md', { frontmatter: { type: 'PBI', order: 30, start: 'soon' } });
	vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 40, due: '2026-09-30' } });
	return vault;
}

/** The chip in a row's start or due cell, or null where that cell drew nothing. */
function chipOf(containerEl: HTMLElement, title: string, end: 'start' | 'target'): HTMLElement | null {
	const cell = rowByTitle(containerEl, title).querySelector(`.pbl-prop-${end}`);
	return cell?.querySelector<HTMLElement>('.pbl-date-chip') ?? null;
}

function textOf(chip: HTMLElement | null): string | undefined {
	return chip?.querySelector('.pbl-state-text')?.textContent ?? undefined;
}

describe('the date chips on a row', () => {
	it('shows each end the note states, in its own column', () => {
		const { containerEl } = makeView(dateVault(), DATES, VISIBLE);

		expect(textOf(chipOf(containerEl, 'Planned', 'start'))).toBe('2026-08-04');
		expect(textOf(chipOf(containerEl, 'Planned', 'target'))).toBe('2026-08-10');
		// A button assistive tech can activate, kept out of the tree's single tab stop.
		expect(chipOf(containerEl, 'Planned', 'start')?.tagName).toBe('BUTTON');
		expect(chipOf(containerEl, 'Planned', 'start')?.getAttribute('tabindex')).toBe('-1');
	});

	it('invites a date on a note that states none, under the COLUMN’s own name', () => {
		const { containerEl } = makeView(dateVault(), DATES, VISIBLE);

		// The risk and assignee chips' answer, not the horizon's: absence in a placement is
		// a state the shelf already names, while absence here is an invitation. The word is
		// the column's display name rather than a fixed one, because neither end has a noun
		// that is right in every vault — the key here is `due`, not `target`.
		const chip = chipOf(containerEl, 'Unplanned', 'target');
		expect(textOf(chip)).toBe('due');
		expect(chip?.classList.contains('pbl-date-unset')).toBe(true);
		expect(chip?.getAttribute('aria-label')).toBe('Set due');
	});

	it('says nothing for a value the reader refuses, with the reason in the tooltip', () => {
		const { containerEl } = makeView(dateVault(), DATES, VISIBLE);

		// The horizon chip's rule: a chip never shows a value the axis would not honor, so
		// unreadable wears the unset face and differs by tooltip alone.
		const chip = chipOf(containerEl, 'Garbled', 'start');
		expect(textOf(chip)).toBe('start');
		expect(chip?.classList.contains('pbl-date-unset')).toBe(true);
		expect(chip?.dataset.tooltip).toBe('Unreadable start date');
	});

	it('draws NOTHING in a marker’s start cell, and still draws the cell', () => {
		const { containerEl } = makeView(dateVault(), DATES, VISIBLE);

		// A milestone states one date and has no span, so the start is a key this type may
		// only ignore — offering a control over it is the thing `placementEnds` exists to
		// stop. The cell itself is still rendered, or every column after it would shift on
		// this row alone.
		expect(chipOf(containerEl, 'Ship 1.0', 'start')).toBeNull();
		expect(rowByTitle(containerEl, 'Ship 1.0').querySelector('.pbl-prop-start')).not.toBeNull();
		// Its own end is a chip like anyone else's.
		expect(textOf(chipOf(containerEl, 'Ship 1.0', 'target'))).toBe('2026-09-30');
	});

	it('is the property’s own cell, and goes away with the column', () => {
		const vault = dateVault();
		// The property is configured but the base is not showing it: no column, no chip —
		// and no read-only cell drawing the same value beside an editable one either.
		const { containerEl } = makeView(vault, DATES, { order: ['note.status'] });

		expect(containerEl.querySelector('.pbl-date-chip')).toBeNull();
		expect(containerEl.querySelector('.pbl-prop-start')).toBeNull();
	});

	it('shows a context row its dates and offers no way to change them', () => {
		const vault = dateVault();
		vault.addFile('Outside.md', { frontmatter: { type: 'Epic', order: 5, start: '2026-07-01' } });
		vault.addFile('Inside.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Outside' });
		const { containerEl } = makeView(vault, DATES, { ...VISIBLE, only: ['Inside.md'] });

		const chip = chipOf(containerEl, 'Outside', 'start');
		// A static div, never a button: shown with the reason, never a write target.
		expect(chip?.tagName).toBe('DIV');
		expect(textOf(chip)).toBe('2026-07-01');
		expect(chip?.dataset.tooltip).toContain("Not in this base's filter");
		// And with nothing to show it is absent entirely, rather than a button-shaped
		// invitation to a write the gate would refuse.
		expect(chipOf(containerEl, 'Outside', 'target')).toBeNull();
	});
});

describe('pressing a date chip', () => {
	it('asks for that end ALONE and writes only its key', async () => {
		const vault = dateVault();
		const { containerEl } = makeView(vault, DATES, VISIBLE);

		chipOf(containerEl, 'Planned', 'target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// One field, not two: the entry is narrowed to the end the chip names.
		expect(scheduleInputs()).toHaveLength(1);
		expect(scheduleInputs()[0].value).toBe('2026-08-10');
		submitSchedule(['2026-08-20']);
		await flush();

		expect(vault.fm('Planned.md').due).toBe('2026-08-20');
		// The end it did not name is untouched, and so is everything else on the note.
		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('removes that end alone when the field is cleared, and undo restores it', async () => {
		const vault = dateVault();
		const { view, containerEl } = makeView(vault, DATES, VISIBLE);

		chipOf(containerEl, 'Planned', 'start')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		promptButton('Clear start').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		promptButton('Save').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Removed, never blanked, and the span reduced to a milestone rather than unscheduled.
		expect('start' in vault.fm('Planned.md')).toBe(false);
		expect(vault.fm('Planned.md').due).toBe('2026-08-10');

		await view.undoLast();
		await flush();
		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
	});

	it('writes nothing when the entry is confirmed unchanged', async () => {
		const vault = dateVault();
		const { containerEl } = makeView(vault, DATES, VISIBLE);

		chipOf(containerEl, 'Planned', 'start')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		promptButton('Save').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('refuses a target before the start the note states, naming the date it cannot show', async () => {
		const vault = dateVault();
		const { containerEl } = makeView(vault, DATES, VISIBLE);

		chipOf(containerEl, 'Planned', 'target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitSchedule(['2026-08-01']);
		await flush();

		// The one-end entry has no start field, so the rule is checked against what the NOTE
		// says — and the message names that date, because a refusal measured against a field
		// the reader cannot see otherwise reads as a bug.
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toContain('2026-08-04');
		expect(vault.writeLog).toEqual([]);
		// The prompt stays open on what was entered rather than discarding it.
		expect(scheduleInputs()[0].value).toBe('2026-08-01');
	});

	it('applies no span rule to a marker, which has no start to be before', async () => {
		const vault = dateVault();
		vault.addFile('Stale.md', {
			// A stale start the timeline deliberately keeps and ignores: narrowing by
			// `placementEnds` is what stops it refusing a target this type says is its only date.
			frontmatter: { type: 'Milestone', order: 50, start: '2026-12-01', due: '2026-09-30' },
		});
		const { containerEl } = makeView(vault, DATES, VISIBLE);

		chipOf(containerEl, 'Stale', 'target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitSchedule(['2026-10-15']);
		await flush();

		expect(vault.fm('Stale.md').due).toBe('2026-10-15');
		expect(vault.fm('Stale.md').start).toBe('2026-12-01');
	});
});

describe('a date property on a CARD', () => {
	/**
	 * Found by review (Codex, PR #152) and it was a real regression: reclassifying the
	 * date keys took them off every card, because `renderCardBody` filters the resolved
	 * columns to the kinds a card draws and these two were `value` before this change.
	 *
	 * The rule the card filter states for state and horizon does not reach the dates: they
	 * are excluded there because a column already IS a card's state and a bucket already IS
	 * its horizon, so the chip would repeat what the card's own position says. A board
	 * column and a horizon bucket say nothing about WHEN, so a date on a card is not a
	 * repetition of anything — it is the only place the value appears.
	 */
	it('still renders, as the value it was before the chips existed', () => {
		const vault = new FakeVault();
		// A state property, or the board has no workflow and draws guidance instead of
		// cards — which would fail this test for a reason that is not the one it is about.
		vault.addFile('Planned.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New', start: '2026-08-04', due: '2026-08-10' },
		});
		// A Bases ROW value, not just frontmatter: `renderValue` reads `entry.getValue`,
		// which the fake leaves null unless a test says otherwise — so without this the
		// card draws nothing whether or not the fix is in, and the test passes for a
		// reason that is not the one it is about.
		vault.entryValues.set('Planned.md', { 'note.start': '2026-08-04', 'note.due': '2026-08-10' });
		const { view, containerEl } = makeView(vault, { ...DATES, stateProperty: 'note.status' }, VISIBLE);

		view.setProjection('board');

		const card = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card')).find(
			(el) => el.querySelector('.pbl-card-title')?.textContent === 'Planned',
		);
		expect(card?.textContent).toContain('2026-08-04');
		// A value, never the tree's chip: the entry behind it is the ROW's, and a card
		// carrying a control no card projection routes to would be an affordance that
		// looks live and is not.
		expect(card?.querySelector('.pbl-date-chip')).toBeNull();
	});
});
