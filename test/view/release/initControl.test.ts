// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../../src/i18n/en';
import { RELEASE_SUGGESTED_KEYS, RELEASE_SUGGESTED_VALUES } from '../../../src/view/release/init';
import { makeReleaseView, mountRelease, noReleaseVault, RELEASE_CONFIG } from '../../helpers/release';
import { Notice } from '../../helpers/obsidian-mock';
import { flush, useViewHarness } from '../../helpers/view';

useViewHarness();

describe('the release view’s ✨', () => {
	it('is drawn on the index bar even with nothing left to bind', () => {
		// Every candidate already bound: the bar control is a fixture of the bar, not a
		// state of the config — `render/toolbar.ts` and `estimation/toolbar.ts` both draw
		// theirs unconditionally, and a control that came and went would be worse.
		const { view } = mountRelease({ bindAll: true, notesFolder: 'docs/release-notes' });
		expect(view.viewEl.querySelector('.pbl-rel-init')).not.toBeNull();
	});

	it('says it bound nothing rather than looking dead', async () => {
		const { view } = mountRelease({ bindAll: true, notesFolder: 'docs/release-notes' });
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

	it('writes no note from the bar position', async () => {
		// Only the bar is driven here; the category claim ("this view never edits a note")
		// is held separately and for both positions by `releaseNeverEdits.test.ts`.
		const { view, vault } = mountRelease({ bindAll: false });
		const before = vault.files.size;
		view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!.click();
		await flush();
		expect(vault.files.size).toBe(before);
		expect(vault.writeLog).toEqual([]);
	});

	describe('on the `noReleases` guidance', () => {
		// `releaseView.draw` returns before `renderIndex` ever runs, so the bar control it
		// draws never reaches a base with zero releases — the first-use case that most needs
		// all four bindings. These pin that the guidance shell draws this control at all,
		// not only that a press on it behaves correctly (the shared suite above).
		it('is drawn there when anything is adoptable', () => {
			const { view } = makeReleaseView(noReleaseVault(), { typeProperty: 'note.type' });
			expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).not.toBeNull();
		});

		it('is drawn there when every PROPERTY is bound but a non-property value is not', () => {
			// Codex, PR #221: `anythingToBind` used to filter `RELEASE_SUGGESTED_KEYS` alone,
			// which cannot see the three non-property options — so an upgraded vault with
			// every property already bound but the folder still unset (`RELEASE_CONFIG`
			// deliberately leaves it that way) would hide a button that, pressed, would still
			// do real work. `wouldBindValue` is what closes the gap: the offer and the press
			// have to agree, and this fixture is exactly the case where they used not to.
			const { view } = makeReleaseView(noReleaseVault(), RELEASE_CONFIG);
			expect(view.config.get('releaseNotesFolder')).toBeUndefined();
			expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).not.toBeNull();
		});

		it('is withheld there once every candidate is bound or cleared, unlike `New release`', () => {
			// `New release` stays: it is offered whenever a type key is bound, and none of the
			// options this ✨ handles govern it.
			// Every candidate, derived rather than listed — properties AND the three
			// non-property values since 2026-08-30: a further one joins this fixture by being
			// declared in either list, which is the whole point of the check — a candidate
			// nobody cleared here would leave the control drawn and pass nothing.
			const cleared = Object.fromEntries([
				['typeProperty', 'note.type'],
				...RELEASE_SUGGESTED_KEYS.map((candidate) => [candidate.option, '']),
				...RELEASE_SUGGESTED_VALUES.map((candidate) => [candidate.option, '']),
			]);
			const { view } = makeReleaseView(noReleaseVault(), cleared);
			expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-init')).toBeNull();
			expect(view.viewEl.querySelector('.pbl-empty .pbl-rel-new')).not.toBeNull();
		});

		it('binds every candidate from this screen, not only `membershipProperty`', async () => {
			// The `noMembership` screen names one option on purpose; this one has nothing bound
			// yet and nothing to narrow to, so a press here must reach every candidate —
			// otherwise a fresh vault would still need the bar (unreachable until a release
			// exists) to pick up version, target date and status.
			const { view } = makeReleaseView(noReleaseVault(), { typeProperty: 'note.type' });
			view.viewEl.querySelector<HTMLButtonElement>('.pbl-empty .pbl-rel-init')!.click();
			await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
			expect(view.config.get('membershipProperty')).toBeTruthy();
			expect(view.config.get('versionProperty')).toBeTruthy();
			expect(view.config.get('targetDateProperty')).toBeTruthy();
			expect(view.config.get('releaseStatusProperty')).toBeTruthy();
			// Derived, so the two candidates added on 2026-08-29 (the item state and the
			// released date) are covered here by being declared rather than by anybody
			// remembering to add a line — the same reason `cleared` above is derived.
			for (const candidate of RELEASE_SUGGESTED_KEYS) {
				expect(view.config.get(candidate.option), candidate.option).toBeTruthy();
			}
		});
	});

	describe('focus after a press', () => {
		it('does not redraw on a no-op, so the pressed button keeps its DOM identity and focus', async () => {
			const { view } = mountRelease({ bindAll: true, notesFolder: 'docs/release-notes' });
			const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!;
			const renderSpy = vi.spyOn(view, 'render');
			btn.focus();
			btn.click();
			await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
			expect(renderSpy).not.toHaveBeenCalled();
			expect(view.viewEl.querySelector('.pbl-rel-init')).toBe(btn);
			expect(document.activeElement).toBe(btn);
		});

		it('restores focus to the redrawn ✨ on the bar', async () => {
			const { view } = mountRelease({ bindAll: false });
			const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!;
			btn.focus();
			btn.click();
			await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
			const redrawn = view.viewEl.querySelector('.pbl-rel-init');
			expect(redrawn).not.toBeNull();
			expect(redrawn).not.toBe(btn);
			expect(document.activeElement).toBe(redrawn);
		});

		it('falls back to the redrawn screen’s first control when the press removed its own', async () => {
			// Binding `membershipProperty` on the `noMembership` empty state replaces that whole
			// screen with the scope, which draws no `.pbl-rel-init` of its own —
			// `ReleaseView.render`'s general focus restore (`releaseView.ts`) has no fresh copy
			// of this control to find. The press SUCCEEDED and removed its own control on
			// purpose, so stranding the reader on `document.body` would charge a keyboard user
			// for a change that worked; the fallback is the redrawn scope's own first button
			// (Back), not a landing spot invented for the occasion.
			const { view } = mountRelease({ bindAll: false, pick: 'R.md' });
			const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-init')!;
			btn.focus();
			btn.click();
			await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
			expect(view.viewEl.querySelector('.pbl-rel-init')).toBeNull();
			expect(document.activeElement).not.toBe(document.body);
			expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-rel-back'));
		});
	});
});
