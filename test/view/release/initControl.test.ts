// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../../src/i18n/en';
import { mountRelease } from '../../helpers/release';
import { Notice } from '../../helpers/obsidian-mock';
import { flush, useViewHarness } from '../../helpers/view';

useViewHarness();

describe('the release view’s ✨', () => {
	it('is drawn on the index bar even with nothing left to bind', () => {
		// Every candidate already bound: the bar control is a fixture of the bar, not a
		// state of the config — `render/toolbar.ts` and `estimation/toolbar.ts` both draw
		// theirs unconditionally, and a control that came and went would be worse.
		const { view } = mountRelease({ bindAll: true });
		expect(view.viewEl.querySelector('.pbl-rel-init')).not.toBeNull();
	});

	it('says it bound nothing rather than looking dead', async () => {
		const { view } = mountRelease({ bindAll: true });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
		expect(Notice.messages[0]).toBe(en['release.init.nothing']);
	});

	it('reports the keys it bound', async () => {
		const { view } = mountRelease({ bindAll: false });
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
		expect(Notice.messages[0]).not.toBe(en['release.init.nothing']);
		expect(view.config.get('membershipProperty')).toBeTruthy();
	});

	it('is WITHHELD on the noMembership empty state when nothing is adoptable', () => {
		// `renderSetupCta`'s own rule, and the reason is the same: an option someone
		// CLEARED is a decision this must not overrule, so a press that could only no-op
		// is not offered where guidance already names the option to set.
		const { view } = mountRelease({ membership: '', bindAll: true, pick: 'R.md' });
		expect(view.viewEl.querySelector('.pbl-empty')).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).toBeNull();
	});

	it('is WITHHELD when only a DIFFERENT property is adoptable', () => {
		// Membership CLEARED (a decision `adoptCandidates` must not overrule) and
		// `versionProperty` merely untouched: a wider question ("is anything at all
		// adoptable") would answer true here and draw a button whose press could only
		// ever bind `versionProperty` — reporting success while redrawing this exact
		// empty state, since the one option it names stays unbound either way.
		const { view } = mountRelease({ membership: '', bindAll: false, pick: 'R.md' });
		expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).toBeNull();
	});

	it('is offered on that empty state when the membership key can still be bound', () => {
		const { view } = mountRelease({ bindAll: false, pick: 'R.md' });
		expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).not.toBeNull();
	});

	it('writes no note from either position', async () => {
		const { view, vault } = mountRelease({ bindAll: false });
		const before = vault.files.size;
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		await flush();
		expect(vault.files.size).toBe(before);
		expect(vault.writeLog).toEqual([]);
	});
});
