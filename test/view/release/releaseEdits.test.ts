// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Menu, Modal } from '../../helpers/obsidian-mock';
import * as frontmatter from '../../../src/storage/frontmatter';
import { makeReleaseView, RELEASE_CONFIG } from '../../helpers/release';
import { WriteLock } from '../../../src/view/writeLock';
import { FakeVault } from '../../helpers/vault';
import { flush, useViewHarness } from '../../helpers/view';

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
		vault.afterWrite = undefined;

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
		expect(said).toEqual(['Status unreadable', 'Release description property unreadable']);
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
