// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Menu, Modal, Notice } from '../../helpers/obsidian-mock';
import * as frontmatter from '../../../src/storage/frontmatter';
import { makeReleaseView, RELEASE_CONFIG } from '../../helpers/release';
import { WriteLock } from '../../../src/view/writeLock';
import { FakeVault } from '../../helpers/vault';
import { flush, submitPrompt, useViewHarness } from '../../helpers/view';

/**
 * The two edits a release's own screen offers ([[Editing a release from its own screen]]):
 * pick a status, and write what the release is for.
 *
 * This is the file that drives them. `test/view/releaseNeverEdits.test.ts` beside it still
 * says what the ordinary gestures do NOT do, and the two together are the whole of the
 * narrowed claim: this view edits the release note it is showing, and nothing else.
 */

useViewHarness();

/** One release with a status and two members — a scope screen with a header to act on. */
function editVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', {
		frontmatter: { type: 'Release', version: '1.0.0', 'target-date': '2026-09-12', status: 'Planned' },
	});
	vault.addFile('M1.md', { frontmatter: { type: 'Feature', order: 1, release: '[[R]]', status: 'Done' } });
	vault.addFile('M2.md', { frontmatter: { type: 'Feature', order: 2, release: '[[R]]', status: 'Doing' } });
	// A SECOND release, carrying a status nobody declared: the observed half of the menu's
	// own vocabulary, and the reason this fixture has two releases at all.
	vault.addFile('S.md', { frontmatter: { type: 'Release', version: '0.9.0', status: 'Cut' } });
	return vault;
}

function openScope(config: Record<string, unknown> = RELEASE_CONFIG) {
	const harness = makeReleaseView(editVault(), config);
	harness.view.pick('R.md');
	return { ...harness, vault: harness.view.app.vault as never as FakeVault };
}

const statusChip = (containerEl: HTMLElement) => containerEl.querySelector<HTMLElement>('.pbl-rel-status')!;

describe('setting a release status', () => {
	it('offers the declared vocabulary, then what the other releases carry, then this one’s own', async () => {
		const { containerEl } = openScope();
		statusChip(containerEl).click();
		await flush();

		// Declared first and in declared order (`releaseStatusValues`), then `Cut` — which no
		// option names and the other release carries. `Planned` is in both and is offered once.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual([
			'Planned',
			'In progress',
			'Released',
			'Cut',
			'Clear status',
		]);
	});

	it('offers a way to write the vault’s FIRST status, where the menu would else be empty', async () => {
		// Found by review (Codex, PR #211). Declared ∪ observed ∪ this note's own is the whole
		// vocabulary, so a vault that has declared none and written none had a chip inviting a
		// press and an empty menu behind it — the one configuration where the control could
		// not do the thing it offered.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		const { view, containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, releaseStatusValues: [] });
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();

		// The bootstrap entry, alone: no choices to pick and no Clear, since there is nothing
		// on the note to take off.
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['New status...']);
		Menu.lastShown?.items[0]?.click();
		await flush();
		submitPrompt({ title: 'Shipping soon' });
		await flush();

		expect(vault.fm('R.md').status).toBe('Shipping soon');
		// And it is gone the moment the vault HAS a status: the value it just wrote is the
		// vocabulary now, which is what makes this a bootstrap rather than a permanent entry.
		statusChip(containerEl).click();
		await flush();
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Shipping soon', 'Clear status']);
	});

	it('checks the entry that would write nothing, and writes the one that would', async () => {
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();

		// The checkmark is the PLAN's answer, not a comparison beside it: the note holds
		// `Planned`, so picking `Planned` writes nothing and is the entry drawn as current.
		expect(Menu.lastShown?.items.filter((i) => i.checked).map((i) => i.titleText)).toEqual(['Planned']);

		Menu.lastShown?.item('Released')?.click();
		await flush();
		expect(vault.fm('R.md').status).toBe('Released');
		// The release note ALONE: a member is work, and this view never writes work.
		expect(vault.writeLog.map((w) => w.path)).toEqual(['R.md']);
	});

	it('plans nothing for the status the note already holds, whatever its casing', async () => {
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', status: 'planned' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();

		Menu.lastShown?.item('Planned')?.click();
		await flush();
		// `sameValue`'s rule, the one every pick in this plugin keeps: the note is already AT
		// that status, so the note is not rewritten to the declared casing.
		expect(vault.writeLog).toEqual([]);
		expect(vault.fm('R.md').status).toBe('planned');
	});

	it('redraws nothing when the batch is empty, which two comments already promised', async () => {
		// Found by review (Codex, PR #211). `applySafely` returns on `writes.length === 0`
		// before it touches the lock, so `flushedLastBatch` stays false and `applyRelease`
		// called `onDataUpdated()` anyway — a full model rebuild and a whole scope tree
		// redrawn for a pick that wrote nothing.
		//
		// It is the "an invariant asserted in a comment is not a check" rule caught in the
		// act: `releaseWritePlan.ts`'s own header says an empty batch spends no undo slot and
		// triggers NO REFRESH, and `save`'s comment in `releaseEdits.ts` leans on it —
		// "a batch that wrote NOTHING redraws nothing, so the line the reader pressed is still
		// on screen and still focused". Both were false for as long as this line stood.
		const { containerEl } = openScope();
		const chip = statusChip(containerEl);
		const rows = containerEl.querySelectorAll('.pbl-row').length;
		chip.click();
		await flush();
		// The CHECKED entry — the one whose plan is empty by construction, so this asks the
		// no-op contract rather than a value that happens to match.
		Menu.lastShown?.items.find((i) => i.checked)?.click();
		await flush();

		// The same element, not merely an equal one: a redraw empties `viewEl`, so identity is
		// what says nothing was rebuilt. The row count is the tree half of the same claim.
		expect(statusChip(containerEl)).toBe(chip);
		expect(containerEl.querySelectorAll('.pbl-row').length).toBe(rows);
	});

	it('clears the key rather than blanking it, and offers no clear where there is nothing to take off', async () => {
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.item('Clear status')?.click();
		await flush();

		// Removed, never `''`: this view's own reader calls an empty string UNREADABLE
		// ([[Releases as their own type]] 3b), so a blanked field would come back drawn as
		// somebody's mistake.
		expect('status' in vault.fm('R.md')).toBe(false);

		// And with nothing under the key, the entry is gone — an action that would write
		// nothing is not offered.
		statusChip(view.viewEl).click();
		await flush();
		expect(Menu.lastShown?.item('Clear status')).toBeUndefined();
	});

	it('names the chip with the value it draws, for the reader who cannot see it', () => {
		// An `aria-label` REPLACES an element's content, so a name saying only what the
		// control DOES would take the status away from a screen reader. The tree's own chip
		// names are reused rather than a sentence of this screen's own.
		const { containerEl } = openScope();
		expect(statusChip(containerEl).getAttribute('aria-label')).toBe('Change Status (currently Planned)');

		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		const { view } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		expect(statusChip(view.viewEl).getAttribute('aria-label')).toBe('Set Status');
	});

	it('names all three write controls with their value, since a tooltip takes the content’s place', async () => {
		// Found by review (Codex, PR #211): Obsidian's `setTooltip` is reported to implement
		// its tooltip THROUGH `aria-label`, which replaces an element's content-derived
		// accessible name — so the description's own sentence and the released date were
		// reachable only by sight, and the status chip's carefully built name was at risk of
		// being taken back off by the call two lines under it.
		//
		// **What this test can and cannot say**: the jsdom mock writes `data-tooltip` and no
		// `aria-label`, so nothing here can see Obsidian's real behaviour — only a vault can.
		// What is asserted is the OUTCOME that holds either way: each control names its value
		// and its action, set after the tooltip so ours is last.
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', status: 'Planned', description: 'Sign-in.', released: '2026-06-18' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		const cls = ['.pbl-rel-status', '.pbl-rel-desc', '.pbl-rel-released'];

		const names = cls.map((sel) => containerEl.querySelector(sel)?.getAttribute('aria-label'));
		expect(names).toEqual(['Change Status (currently Planned)', 'Change Description (currently Sign-in.)', 'Change Released (currently 2026-06-18)']);
	});

	it('draws an unset status as an invitation rather than withholding it', () => {
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');

		// `drawFigure` withholds a figure with no value, which is right for the version and
		// wrong for the one field this screen can change: absence here is one press from
		// being fixed.
		const chip = containerEl.querySelector<HTMLElement>('.pbl-rel-status');
		expect(chip?.classList.contains('pbl-state-unset')).toBe(true);
		expect(view.viewEl.querySelector('.pbl-rel-status')).not.toBeNull();
	});

	it('draws no status control at all where the key is unbound', () => {
		const { containerEl } = openScope({ ...RELEASE_CONFIG, releaseStatusProperty: '' });
		expect(containerEl.querySelector('.pbl-rel-status')).toBeNull();
	});
});

describe('describing a release', () => {
	const openDialog = (containerEl: HTMLElement): Modal => {
		containerEl.querySelector<HTMLElement>('.pbl-rel-desc')!.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('no dialog opened');
		return modal;
	};
	const type = (modal: Modal, value: string): void => {
		const area = modal.contentEl.querySelector('textarea')!;
		area.value = value;
		area.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector<HTMLButtonElement>('button')!.click();
	};

	it('writes the description to the bound property, on the release note alone', async () => {
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		type(openDialog(containerEl), 'Everything the beta asked for.');
		await flush();

		expect(vault.fm('R.md').description).toBe('Everything the beta asked for.');
		expect(vault.writeLog.map((w) => w.path)).toEqual(['R.md']);
	});

	it('opens holding what the note carries, and draws it back on the header', async () => {
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		type(openDialog(containerEl), 'First words.');
		await flush();

		expect(containerEl.querySelector('.pbl-rel-desc')?.textContent).toBe('First words.');
		const modal = openDialog(containerEl);
		expect(modal.contentEl.querySelector('textarea')?.value).toBe('First words.');
	});

	it('clears the key when the box is emptied, and writes nothing when it is unchanged', async () => {
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		type(openDialog(containerEl), 'Something.');
		await flush();
		vault.writeLog.length = 0;

		// Unchanged: no batch, so no undo slot is spent on a save that changed nothing.
		type(openDialog(containerEl), 'Something.');
		await flush();
		expect(vault.writeLog).toEqual([]);

		type(openDialog(containerEl), '   ');
		await flush();
		expect('description' in vault.fm('R.md')).toBe(false);
	});

	it('invites one where the key is bound and empty, and draws nothing where it is unbound', () => {
		const bound = openScope();
		const empty = bound.containerEl.querySelector('.pbl-rel-desc');
		expect(empty?.textContent).toBe('Add a description');
		expect(empty?.classList.contains('pbl-rel-desc-empty')).toBe(true);

		const { containerEl } = openScope({ ...RELEASE_CONFIG, descriptionProperty: '' });
		expect(containerEl.querySelector('.pbl-rel-desc')).toBeNull();
	});
});

describe('focus across the redraw an edit causes', () => {
	/**
	 * Found by review (Codex, PR #211) on the open-note control, and true of all three of
	 * this header's controls: each is a real tab stop that a redraw detaches, and none was in
	 * `FOCUS_HANDLE_CLASSES`, so focus fell to the body. It bites hardest on the two that
	 * WRITE, because pressing one causes the redraw that detaches it.
	 */
	it('keeps focus on the header control a routine data update detached', () => {
		const { view, containerEl } = openScope();
		for (const cls of ['pbl-rel-open', 'pbl-rel-status', 'pbl-rel-desc']) {
			const before = containerEl.querySelector<HTMLElement>(`.${cls}`)!;
			before.focus();
			view.onDataUpdated();
			const after = containerEl.querySelector<HTMLElement>(`.${cls}`);
			expect(after, cls).not.toBe(before);
			expect(document.activeElement, cls).toBe(after);
		}
	});

	it('puts focus back on the status chip after a pick and after a clear', async () => {
		// Found by review (Codex, PR #211), and the earlier focus fix could not cover it: an
		// Obsidian `Menu` is mounted on the BODY, so while it is open `focusedHandle` correctly
		// answers null — `viewEl` does not contain the focused element — and the write's own
		// redraw then leaves the reader on `document.body`. `FOCUS_HANDLE_CLASSES` is the
		// wrong mechanism here for the same reason the description's dialog needed a second
		// one; this is that same explicit refocus, on the two entries that write.
		const { containerEl } = openScope();
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.items.find((i) => i.titleText === 'Released')?.click();
		await flush();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-rel-status'));

		// The Clear foot writes too, so it takes the same route — and lands on the chip in
		// its UNSET form, which is the same element by class and a different one by content.
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.items.find((i) => i.titleText === 'Clear status')?.click();
		await flush();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-rel-status'));
	});

	it('puts focus back on the control a CANCELLED dialog would leave nowhere', async () => {
		// Found by review (Codex, PR #211). Every one of these dialogs has a second exit —
		// Escape, the close control — that never reaches `onSubmit`, so the refocus `save` does
		// after its await covers only the half that writes. The status prompt is the worst of
		// the three and the reason the rule is stated at the prompt rather than at one caller:
		// it is opened from a body-mounted `Menu` item that no longer exists by the time it
		// closes, so cancelling left a keyboard reader on `document.body` with nothing to go
		// back to. `PromptModal.onClose` is where it is answered, so a prompt written next year
		// gets it by asking for it.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		const { view, containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, releaseStatusValues: [] });
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.item('New status...')?.click();
		await flush();

		Modal.lastOpened!.close();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-rel-status'));
		// And it wrote nothing on the way out: a cancel is a cancel.
		expect(vault.writeLog).toEqual([]);
	});

	it('does the same for the two dialogs a header control opens, which cancel too', async () => {
		// The same hole, one control over each time — the reason the fix is on the shared base
		// rather than on the prompt review named. Neither dialog's opening control is destroyed
		// by the cancel, so what a reader loses here is their PLACE rather than the way back.
		// `releasedStatusValues` cleared so `Mark as released` is withheld and the invitation
		// still draws — the fixture's status alone would leave `.pbl-rel-released` absent.
		const { containerEl } = openScope({ ...RELEASE_CONFIG, releasedStatusValues: '' });
		for (const cls of ['.pbl-rel-desc', '.pbl-rel-released']) {
			containerEl.querySelector<HTMLElement>(cls)!.click();
			Modal.lastOpened!.close();
			expect(document.activeElement, cls).toBe(containerEl.querySelector(cls));
		}
	});

	it('puts focus back on the description line after the dialog that closed before it wrote', async () => {
		// `TextPromptModal` closes before it submits, so focus is off this view by the time
		// the write's redraw runs and the handle mechanism above correctly answers null —
		// `focusNewRelease`'s own case, and the same fresh look-up after the await.
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		containerEl.querySelector<HTMLElement>('.pbl-rel-desc')!.click();
		const modal = Modal.lastOpened!;
		const area = modal.contentEl.querySelector('textarea')!;
		area.value = 'Words.';
		area.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector<HTMLButtonElement>('button')!.click();
		await flush();

		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-rel-desc'));
	});
});

describe('recording the day a release shipped', () => {
	const openDate = (containerEl: HTMLElement): Modal => {
		containerEl.querySelector<HTMLElement>('.pbl-rel-released')!.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('no dialog opened');
		return modal;
	};
	/** The CTA, which is the LAST button: the date field draws its own clear button first
	 *  (`SchedulePromptModal`), and clicking that empties the very entry being submitted. */
	const confirm = (modal: Modal): void => {
		const buttons = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>('button'));
		buttons[buttons.length - 1].click();
	};
	const pick = (modal: Modal, value: string): void => {
		const input = modal.contentEl.querySelector('input')!;
		input.value = value;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		confirm(modal);
	};

	it('invites one where the key is bound and empty, and writes the date the reader picks', async () => {
		// The whole reason this control exists: NOTHING in the plugin wrote this key before,
		// so a bound released property could never come to hold anything and the index's
		// Shipped group and slip figure were unreachable without hand-editing a note.
		// `releasedStatusValues` cleared so `Mark as released` is withheld — otherwise
		// R.md's status alone offers it and this invitation never draws.
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, releasedStatusValues: '' });
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-released')?.textContent).toBe('Set released date');

		pick(openDate(containerEl), '2026-09-20');
		await flush();
		expect(vault.fm('R.md').released).toBe('2026-09-20');
		expect(vault.writeLog.map((w) => w.path)).toEqual(['R.md']);
		expect(containerEl.querySelector('.pbl-rel-released')?.textContent).toBe('Released 2026-09-20');
	});

	it('opens holding the date the note states, and writes nothing when it is confirmed unchanged', async () => {
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', released: '2026-9-1' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');

		const modal = openDate(containerEl);
		// The note's own date in the register's spelling, which is what a date input accepts.
		expect(modal.contentEl.querySelector('input')?.value).toBe('2026-09-01');
		confirm(modal);
		await flush();
		// And confirming rewrites nothing — `2026-9-1` is not respelled by a reader who
		// opened the dialog and pressed Save.
		expect(vault.writeLog).toEqual([]);
		expect(vault.fm('R.md').released).toBe('2026-9-1');
	});

	it('clears the key when the field is emptied', async () => {
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', released: '2026-09-20' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		pick(openDate(containerEl), '');
		await flush();

		expect('released' in vault.fm('R.md')).toBe(false);
	});

	it('says so and offers no control where the date is unreadable, or where the key is unbound', () => {
		// An unreadable date and an absent one both reach the planner as null, so a dialog
		// opened on the first could not tell "leave it empty" from "it already is" — the
		// clear would look available and write nothing.
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', released: 'soon' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-released')).toBeNull();
		expect(Array.from(containerEl.querySelectorAll('.pbl-rel-unreadable')).map((el) => el.textContent)).toContain(
			'Released unreadable',
		);

		const { containerEl: unbound } = openScope({ ...RELEASE_CONFIG, releasedDateProperty: '' });
		expect(unbound.querySelector('.pbl-rel-released')).toBeNull();
	});
});

describe('what an edit is, and is not', () => {
	it('goes through the gate’s own writer, never the item-batch path', async () => {
		// `applyWrites` and `applyRestores` are the BACKLOG's batches — a hierarchy, a state,
		// a placement — and this view plans none of them. It writes plain key/value sets on
		// one note, which is `applyPropertyWrites`' shape and the estimation view's own.
		const applyWrites = vi.spyOn(frontmatter, 'applyWrites');
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.item('Released')?.click();
		await flush();

		expect(applyWrites).not.toHaveBeenCalled();
		expect(vault.trashed).toEqual([]);
	});

	it('installs an inverse in the shared slot, so the backlog view’s undo takes it back', async () => {
		// ADR 0030 read for this view: it draws no undo control, and the slot is the vault's
		// last batch whichever view wrote it — so the way back from a status set here is
		// another view's button. Driven through the gate the two share rather than through
		// that button, which lives on a view this suite does not mount.
		const vault = editVault();
		const lock = new WriteLock();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG, { lock });
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.item('Released')?.click();
		await flush();
		expect(vault.fm('R.md').status).toBe('Released');

		expect(view.gate.canUndo()).toBe(true);
		await view.gate.undoLast();
		await flush();
		// The value it HELD, not an empty key: an inverse restores what was there.
		expect(vault.fm('R.md').status).toBe('Planned');
	});

	it('draws through a data update that lands mid-batch rather than on top of one', async () => {
		// The gate's deferral, which this view took on with its first batch: every file a
		// batch touches comes back as its own update, and a view that did not defer would
		// draw the half-applied state. `afterWrite` is the harness's way to interleave a
		// Bases update with a write (`test/CLAUDE.md`).
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		vault.afterWrite = () => view.onDataUpdated();
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.item('Released')?.click();
		await flush();
		vault.afterWrite = null;

		// The screen the flush drew is the one the write produced: the chip reads back the
		// value on the note, and the reader is still on the same release.
		expect(view.viewEl.querySelector('.pbl-rel-status')?.textContent).toBe('Released');
		expect(view.pickedPath).toBe('R.md');
	});

	it('says so and offers no edit where either key holds something unreadable', () => {
		// Extension 1c, for both fields: "somebody wrote something there" is not an
		// invitation to write over it blind, and the header's Open release note control is
		// one press from the note where it can be repaired.
		const vault = editVault();
		vault.addFile('R.md', {
			frontmatter: { type: 'Release', version: '1.0.0', status: ['Planned', 'Cut'], description: { a: 1 } },
		});
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');

		expect(containerEl.querySelector('.pbl-rel-status')).toBeNull();
		expect(containerEl.querySelector('.pbl-rel-desc')).toBeNull();
		const said = Array.from(containerEl.querySelectorAll('.pbl-rel-unreadable')).map((el) => el.textContent);
		expect(said).toEqual(['Status unreadable', 'Description unreadable']);
	});

	it('refuses every edit while two release properties name one key', async () => {
		// Found by review (Codex, PR #211). `createRelease` has refused this since #203 — a
		// status aimed at the TYPE key takes `Release` off the note, and the release vanishes
		// from its own view — but an edit never passes the creator, so the gate had to ask the
		// same question. ✨ cannot produce this state; a property picker can.
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		const { view, containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, releaseStatusProperty: 'note.type' });
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.items[0]?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
		// Still a release, which is the whole of what the refusal protects.
		expect(vault.fm('R.md').type).toBe('Release');
		expect(Notice.messages.some((m) => m.includes('release status'))).toBe(true);
	});

	it('refuses a captured key the settings stopped naming, even where the gate now sees no problem', async () => {
		// Found by review (Codex, PR #211), and it is the two earlier fixes meeting: the
		// control captures its KEY when it is drawn (so a re-pointed option cannot redirect
		// the reader's text), while the gate re-reads `releaseNoteProblems` off the settings
		// as they are at SUBMIT. So a collision present at the open and fixed while the menu
		// is up lets the batch through carrying the key that collision was about — here the
		// TYPE key, which is PR #203's corruption arriving through the door that fix missed.
		const vault = editVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		const { view, containerEl, config } = makeReleaseView(vault, { ...RELEASE_CONFIG, releaseStatusProperty: 'note.type' });
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();

		// The reader repairs the collision with the menu open — every entry in it was planned
		// against `type`, and the gate is about to find nothing wrong with the configuration.
		config.values.releaseStatusProperty = 'note.status';
		view.onDataUpdated();
		Menu.lastShown?.items[0]?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(vault.fm('R.md').type).toBe('Release');
		// The refusal names the key, so the reader knows which editor to reopen.
		expect(Notice.messages.some((m) => m.includes('type'))).toBe(true);
	});

	it('refuses the write when the note stopped being a release while the menu was open', async () => {
		// Found by review (Codex, PR #211). The plan comes from a model that can be a refresh
		// behind, and the window between a menu opening and its pick is one nothing upstream
		// sees. Retyped in it, the note is somebody else's — and on the shipped configuration
		// where a release's status and an item's workflow state share `status`, this write
		// would land on a work item's own state. `applyPropertyWrites` refused only a live
		// `Resource` before `PropertyWrite.requiresType` existed.
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		const pick = Menu.lastShown?.item('Released');

		// Retyped in the vault, exactly as an external edit would: the model still says
		// release, and the note no longer does.
		vault.fm('R.md').type = 'PBI';
		pick?.click();
		await flush();

		expect(vault.fm('R.md').status).toBe('Planned');
		expect(Notice.messages.some((m) => m.includes('no longer a Release'))).toBe(true);
	});

	it('refuses an edit when the status shares the ORDER key, which the index ranks by', async () => {
		// Found by review (Codex, PR #211), on the collision set the earlier finding produced:
		// it named the keys this view WRITES and left out the two model mappings it READS on
		// a release note. `rank` sorts the index by `item.order`, so a status written onto
		// the order key replaces a release's rank with a word and sends it to the tail.
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, releaseStatusProperty: 'note.order' });
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		Menu.lastShown?.items[0]?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('order'))).toBe(true);
	});

	it('refuses a write to a release the base excluded but the TREE still holds', async () => {
		// Found by review (Codex, PR #211). `byPath` is not the results: a work item with a
		// hand-written `parent: [[R]]` pulls the release it names into the model as a context
		// row through `loadOutsideParents`, which is not type-gated — so a `has(path)` test
		// authorized an edit to a release the Base excluded, which is the one thing the
		// context-row rule says this plugin never does.
		const vault = editVault();
		vault.addFile('Child.md', { frontmatter: { type: 'Feature', release: '[[R]]' }, parentLink: 'R' });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		const pick = Menu.lastShown?.item('Released');

		(view as unknown as { data: unknown }).data = {
			data: vault.entries().filter((e) => e.file.path !== 'R.md'),
		};
		view.onDataUpdated();
		// The release is still IN the model — as the context parent `Child.md` names — which
		// is what makes this different from the case below.
		expect(view.model?.byPath.get('R.md')?.outsideFilter).toBe(true);
		pick?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(vault.fm('R.md').status).toBe('Planned');
	});

	it('refuses a write to a release this base did not return', async () => {
		// The gate's outside-filter refusal, which this view now has a batch to be refused:
		// a release the Base excluded is not this view's to write, and the batch is refused
		// WHOLE rather than filtered.
		const vault = editVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		statusChip(containerEl).click();
		await flush();
		const pick = Menu.lastShown?.item('Released');

		// The menu was built while R was a result; the Base then stops returning it, which is
		// the window between a menu opening and its pick that every gate refusal exists for.
		(view as unknown as { data: unknown }).data = {
			data: vault.entries().filter((e) => e.file.path !== 'R.md'),
		};
		view.onDataUpdated();
		pick?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});
