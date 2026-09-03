// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../../src/i18n/en';
import { drawFixNote } from '../../../src/view/release/readinessFix';
import { Notice, TFile } from '../../helpers/obsidian-mock';
import { makeReleaseView, mountRelease, RELEASE_CONFIG, scopeVault } from '../../helpers/release';
import { flush, useViewHarness } from '../../helpers/view';

useViewHarness();

/**
 * The scope screen with the estimate and capacity properties deliberately UNBOUND — never
 * merely absent from an override. `releaseScreen(release, vault, over)` builds its config
 * as `{ ...RELEASE_CONFIG, ...over }`, so a key missing from `over` is still supplied by
 * `RELEASE_CONFIG`; deleting the two keys off a copy and handing it in as `over` would
 * therefore still leave them bound. This builds the config from scratch instead — a copy
 * of `RELEASE_CONFIG` with both keys actually removed — and mounts it directly, doing by
 * hand the two things `releaseScreen` does for every other caller: adding the release note
 * `scopeVault()`'s own members already name, and picking it.
 */
function unboundScreen() {
	const vault = scopeVault();
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', version: '0.9.0' } });
	const config: Record<string, unknown> = { ...RELEASE_CONFIG };
	delete config.estimateProperty;
	delete config.capacityProperty;
	const { view } = makeReleaseView(vault, config, { base: 'Releases.base' });
	view.pick('0.9.md');
	return { view, vault };
}

describe('an unbound readiness key', () => {
	it('draws its red note as a button that binds that one option', async () => {
		const { view } = unboundScreen();
		// The state the fixture claims: neither key is bound yet, and not merely cleared to
		// `''` (which `getAsPropertyId` cannot tell apart from unset either way — this is the
		// fixture's own guarantee, not the assertion the rest of the test is about).
		expect(view.config.getAsPropertyId('estimateProperty')).toBeNull();
		expect(view.config.getAsPropertyId('capacityProperty')).toBeNull();

		const fixes = view.viewEl.querySelectorAll<HTMLButtonElement>('.pbl-rel-fix');
		// One for the effort key, one for the capacity key.
		expect(fixes.length).toBe(2);

		const effort = [...fixes].find((el) => el.dataset.fix === 'estimateProperty')!;
		effort.click();
		await flush();

		expect(view.config.getAsPropertyId('estimateProperty')).toBe('note.effort');
		// The capacity option is NOT bound: the button binds what its own sentence is about.
		expect(view.config.getAsPropertyId('capacityProperty')).toBeNull();
	});
});

/**
 * `drawFixNote`'s other two remedy kinds, and its no-remedy span — none of them reachable
 * from `renderReadiness.ts` yet (Task 2 routes only the two `bind` states; Tasks 3 and 4
 * take the rest), so these drive the module directly rather than through a screen. The
 * shape this task hands the later ones is only real once it is exercised.
 */
describe('drawFixNote', () => {
	it('draws a plain span, not a button, with no remedy', () => {
		const { view } = unboundScreen();
		const el = view.viewEl.createDiv();
		drawFixNote(view, el, 'Nothing to do about this one', null);
		const span = el.querySelector('.pbl-rel-unreadable');
		expect(span?.tagName).toBe('SPAN');
		expect(el.querySelector('.pbl-rel-fix')).toBeNull();
	});

	it('runs a run remedy directly, touching neither the config nor the workspace', async () => {
		const { view } = unboundScreen();
		const el = view.viewEl.createDiv();
		let ran = false;
		drawFixNote(view, el, 'Open the dialog', { kind: 'run', run: () => (ran = true) });
		el.querySelector<HTMLButtonElement>('.pbl-rel-fix')!.click();
		await flush();
		expect(ran).toBe(true);
		expect(view.config.getAsPropertyId('estimateProperty')).toBeNull();
	});

	it('opens the named note for an open remedy', async () => {
		const { view, vault } = unboundScreen();
		const file = view.app.vault.getAbstractFileByPath('E.md') as TFile;
		const el = view.viewEl.createDiv();
		drawFixNote(view, el, 'Open the note', { kind: 'open', file });
		el.querySelector<HTMLButtonElement>('.pbl-rel-fix')!.click();
		await flush();
		expect(vault.opened.map((o) => o.path)).toContain('E.md');
	});

	/** A bind remedy naming an option this vault has already bound — `initControl.ts`'s own
	 *  "says it bound nothing" case, asked of a fix button instead of the ✨: the config
	 *  cannot change twice, so a second press has nothing left to do. */
	it('reports a bind remedy that bound nothing, and does not redraw', async () => {
		const { view } = mountRelease({ bindAll: true });
		const renderSpy = vi.spyOn(view, 'render');
		const el = view.viewEl.createDiv();
		drawFixNote(view, el, 'Already bound', { kind: 'bind', option: 'estimateProperty' });
		el.querySelector<HTMLButtonElement>('.pbl-rel-fix')!.click();
		await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
		expect(Notice.messages[0]).toBe(en['release.init.nothing']);
		expect(renderSpy).not.toHaveBeenCalled();
	});
});
