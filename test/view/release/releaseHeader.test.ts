// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen } from '../../helpers/release';
import { en } from '../../../src/i18n/en';
import { Modal } from '../../helpers/obsidian-mock';
import { flush } from '../../helpers/view';

describe('the default screen opens a release that has members', () => {
	// The fixture's own invariant, checked because it silently was not true until
	// 2026-08-30: `releaseScreen` adds and picks `0.9` while `scopeVault()`'s members named
	// `R`, so every caller taking the default drove the EMPTY scope — the screen
	// `renderScope` returns early from. Nothing failed, because the cases that take the
	// default assert withholding, locking and paths, which no member can affect; the one
	// that lost a real check is `releaseNotes.test.ts`'s idempotence case, and it now
	// builds its own populated vault rather than leaning on this.
	//
	// `.pbl-rel-summary` is the assertion rather than a row count because `drawSummary`
	// WITHHOLDS it on a memberless release — so this is the one element whose presence
	// cannot be true of the empty screen, and repointing the members again fails here
	// rather than quietly somewhere downstream.
	it('draws the summary strip, which a memberless release withholds', () => {
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-summary')).not.toBeNull();
		expect(view.viewEl.querySelectorAll('.pbl-row').length).toBe(2);
	});
});

describe('the released date is a control only when there is one, or Mark as released cannot cover it', () => {
	it('draws nothing when the key is bound, the value absent, and Mark as released is offered', () => {
		// `Mark as released` covers exactly this condition when it is offered: writing the
		// status and the date together, so a second control on the same field is one too
		// many. Confirmed alongside the very fixture that offers it, below.
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-released')).toBeNull();
	});

	it('and that fixture really does offer Mark as released', () => {
		// The premise the case above rests on: if this ever stopped being true, the first
		// test would assert nothing about the rule it names.
		const { view } = releaseScreen({ status: 'In progress' });
		expect(view.viewEl.querySelector('.pbl-rel-close')).not.toBeNull();
	});

	it('draws the date itself as the control when one exists', () => {
		const { view } = releaseScreen({ status: 'Released', released: '2026-06-18' });
		const el = view.viewEl.querySelector('.pbl-rel-released');
		expect(el?.textContent).toBe(en['release.scope.releasedOn'].replace('{date}', '2026-06-18'));
	});

	it('still says so when the date cannot be read', () => {
		const { view } = releaseScreen({ status: 'In progress', released: ['a', 'b'] });
		expect(view.viewEl.querySelector('.pbl-rel-released')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-unreadable')).not.toBeNull();
	});

	it('draws the invitation when the status is already released but the date is not', () => {
		// `alreadyOut`: the note's status already reads as released (`RELEASE_CONFIG`'s
		// `releasedStatusValues` is `Released`), so `closeOffer` withholds `Mark as
		// released` — nothing left on this note to mark. Without this control an imported
		// or hand-edited note in this state would have no way to set a released date at
		// all, which is the case the ruling exists for.
		const { view } = releaseScreen({ status: 'Released' });
		expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();
		const el = view.viewEl.querySelector('.pbl-rel-released');
		expect(el).not.toBeNull();
		expect(el?.textContent).toBe(en['release.scope.markReleased']);
	});

	it('does not strand focus when clearing a date takes its own control off screen', async () => {
		// Found on review, `renderChevron`/`refocus`'s own class of defect: clearing this
		// release's date makes `Mark as released` offered again, so the button the reader
		// just pressed is gone with the redraw. Its replacement — the same control this
		// release's own screen now offers for the field — is the stable neighbour, `refocus`'s
		// own shape rather than a body a keyboard reader would be dropped on.
		const { view } = releaseScreen({ status: 'In progress', released: '2026-06-18' });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-released')!.click();
		const modal = Modal.lastOpened!;
		const input = modal.contentEl.querySelector('input')!;
		input.value = '';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		const buttons = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>('button'));
		buttons[buttons.length - 1].click();
		await flush();

		expect(view.viewEl.querySelector('.pbl-rel-released')).toBeNull();
		expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-rel-close'));
	});
});
