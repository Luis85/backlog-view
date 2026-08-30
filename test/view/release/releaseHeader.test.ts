// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { releaseScreen } from '../../helpers/release';
import { en } from '../../../src/i18n/en';

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
});
