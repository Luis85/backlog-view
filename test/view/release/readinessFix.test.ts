// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../../src/i18n/en';
import { drawFixNote } from '../../../src/view/release/readinessFix';
import { Modal, Notice, TFile } from '../../helpers/obsidian-mock';
import { button, makeReleaseView, mountRelease, RELEASE_CONFIG, releaseScreen, scopeVault } from '../../helpers/release';
import { flush, submitPrompt, useViewHarness } from '../../helpers/view';

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
 *
 * The two risk vocabularies are bound on top of `RELEASE_CONFIG`, which leaves them out —
 * this fixture is about the two UNBOUND keys, and the risk criterion's own third fix
 * button (Task 4) would otherwise draw here too, for a state this fixture is not about.
 */
function unboundScreen() {
	const vault = scopeVault();
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', version: '0.9.0' } });
	const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: 'High', addressedRiskValues: 'Low' };
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

/**
 * The capacity figure's own two red states, driven through the real screen (Task 3) rather
 * than through `drawFixNote` directly — `renderReadiness.ts`'s `drawCapacityFigures` is what
 * wires them, and this is the file `drawFixNote`'s own header above already named for it.
 */
describe('the capacity figure’s own fix buttons', () => {
	it('opens the number dialog for an absent capacity, and writes what the reader types', async () => {
		const { view, vault } = releaseScreen({ capacity: undefined });
		button(view, '.pbl-rel-capacity-fix').click();
		await flush();
		// A `ValuePromptModal`, this dialog's own shape — one field, submitted through the
		// generic `title` slot `submitPrompt` reads for any single-input prompt.
		submitPrompt({ title: '40' });
		await flush();

		// A NUMBER on the note, never the string that was typed — `releaseCapacityWrites`'
		// own rule, read at the writer this dialog reaches.
		expect(vault.fm('0.9.md').capacity).toBe(40);
	});

	it('lands on the header’s Open button once the fix button that opened it is gone', async () => {
		// The one control among this screen's four editors that a SUCCESSFUL write always
		// removes: unlike the status chip and the released date's own button, which persist
		// across a write in a different visual state, a set capacity replaces the fix button
		// with a plain figure — nothing this view can put focus back on. Without
		// `releaseEdits.ts`'s `OPEN_BUTTON` fallback, this landed on `document.body`.
		const { view, containerEl } = releaseScreen({ capacity: undefined });
		button(view, '.pbl-rel-capacity-fix').click();
		await flush();
		submitPrompt({ title: '40' });
		await flush();

		expect(containerEl.querySelector('.pbl-rel-capacity-fix')).toBeNull();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-rel-open'));
	});

	it('opens the release note for an unreadable capacity, rather than a dialog that could not tell the two apart', async () => {
		const { view, vault } = releaseScreen({ capacity: 'lots' });
		button(view, '.pbl-rel-fix').click();
		await flush();

		expect(vault.opened.map((o) => o.path)).toContain('0.9.md');
		// No dialog opened, and no write happened — a plain navigation.
		expect(vault.writeLog).toEqual([]);
	});

	/**
	 * **The finding this pins**: `editReleaseCapacity` used to hand `40 pts` straight to
	 * `releaseCapacityWrites`, which correctly plans nothing for a value its own figure
	 * would not count — and the dialog closed anyway, on a confirm that recorded nothing
	 * and said nothing. The fix is `ValuePromptModal`'s own `validate`, asked with the same
	 * `estimateValue` the strip counts a capacity with, so the reader sees why nothing was
	 * kept instead of a closed dialog and an unchanged strip.
	 */
	it('refuses a capacity its own figure would not count, in the dialog, and writes nothing', async () => {
		const { view, vault } = releaseScreen({ capacity: undefined });
		button(view, '.pbl-rel-capacity-fix').click();
		await flush();
		submitPrompt({ title: '40 pts' });
		await flush();

		// Still open — a refused submit does not close the modal, unlike a successful one.
		const modal = Modal.lastOpened;
		expect(modal).not.toBeNull();
		expect(modal!.contentEl.querySelector('.pbl-modal-error')?.textContent).toBe(en['release.scope.capacityInvalid']);
		// The reader's typing is still there, not cleared out from under them.
		expect(modal!.contentEl.querySelector('input')?.value).toBe('40 pts');
		expect(vault.fm('0.9.md').capacity).toBeUndefined();
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses a negative capacity the same way', async () => {
		const { view, vault } = releaseScreen({ capacity: undefined });
		button(view, '.pbl-rel-capacity-fix').click();
		await flush();
		submitPrompt({ title: '-1' });
		await flush();

		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toBe(
			en['release.scope.capacityInvalid'],
		);
		expect(vault.fm('0.9.md').capacity).toBeUndefined();
		expect(vault.writeLog).toEqual([]);
	});
});

/**
 * The two remaining red states with a `run` remedy: the capacity unit and the two risk
 * vocabularies. Both write the `.base` rather than a note — `view.config.set`, never the
 * gate — so neither leaves a mark in `vault.writeLog` and both are read back straight off
 * `view.config` instead.
 */
describe('the capacity unit', () => {
	it('is typed into the note that says it is unset', async () => {
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, capacityUnit: '' };
		const { view } = releaseScreen({ capacity: 40 }, scopeVault(), config);
		button(view, '.pbl-rel-unit-fix').click();
		await flush();
		submitPrompt('story points');
		await flush();

		expect(view.config.get('capacityUnit')).toBe('story points');
	});
});

describe('the risk vocabularies', () => {
	it('are written together, or not at all', async () => {
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
		const { view } = releaseScreen({}, scopeVault(), config);
		button(view, '.pbl-rel-riskvalues-fix').click();
		await flush();
		submitPrompt({ critical: 'High, Critical', addressed: 'Mitigated' });
		await flush();

		expect(view.config.get('criticalRiskValues')).toBe('High, Critical');
		expect(view.config.get('addressedRiskValues')).toBe('Mitigated');
	});

	/**
	 * **The dead end this whole branch exists to remove**, met inside the dialog that clears
	 * it: a criterion needs BOTH lists (`releaseReadiness.ts`'s own rule), so a submit that
	 * leaves either empty writes `''` twice and lands the reader back on the identical red
	 * note with nothing said. `Refusable` is already wired, so the refusal is the dialog's.
	 */
	it('refuses a submit that would leave the criterion exactly as unconfigured as it found it', async () => {
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
		const { view, config: viewConfig } = releaseScreen({}, scopeVault(), config);
		button(view, '.pbl-rel-riskvalues-fix').click();
		await flush();
		submitPrompt({ critical: '', addressed: '' });
		await flush();

		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toBe(
			en['release.scope.riskValuesRequired'],
		);
		expect(viewConfig.setCalls.map((c) => c.key)).not.toContain('criticalRiskValues');

		// One list alone is the same state: the criterion is unconfigured either way, so the
		// half-filled submit is refused with the same reason rather than written.
		submitPrompt({ critical: 'High', addressed: '' });
		await flush();
		expect(viewConfig.setCalls.map((c) => c.key)).not.toContain('addressedRiskValues');
	});

	/**
	 * **The narrower dead end this pins**: the refusal above checked the raw string against
	 * `''` alone, but `list()` (`settingsResolve.ts`) trims and drops empty entries — so
	 * `"  "` or `","` passed the dialog's own guard, wrote a string that parses to `[]`, and
	 * left the criterion exactly as unconfigured as `''` would have, with no reason shown.
	 * Reusing `list()`'s own split (`parseListValue`) is what closes that door rather than
	 * narrowing it a second time.
	 */
	it('refuses whitespace or a bare comma the same way, because both parse to nothing', async () => {
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
		const { view, config: viewConfig } = releaseScreen({}, scopeVault(), config);
		button(view, '.pbl-rel-riskvalues-fix').click();
		await flush();
		submitPrompt({ critical: '  ', addressed: 'Mitigated' });
		await flush();

		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toBe(
			en['release.scope.riskValuesRequired'],
		);
		expect(viewConfig.setCalls.map((c) => c.key)).not.toContain('criticalRiskValues');

		submitPrompt({ critical: 'High', addressed: ',' });
		await flush();
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-error')?.textContent).toBe(
			en['release.scope.riskValuesRequired'],
		);
		expect(viewConfig.setCalls.map((c) => c.key)).not.toContain('addressedRiskValues');
	});

	it('hints at the vault’s own observed values on both fields, deduplicated case-insensitively', async () => {
		const vault = scopeVault();
		vault.setFrontmatter('M1.md', { type: 'PBI', order: 1, release: '[[0.9]]', risk: 'High' });
		vault.setFrontmatter('M2.md', { type: 'PBI', order: 2, release: '[[0.9]]', status: 'Done', risk: 'high' });
		const config: Record<string, unknown> = { ...RELEASE_CONFIG, criticalRiskValues: '', addressedRiskValues: '' };
		const { view } = releaseScreen({}, vault, config);
		button(view, '.pbl-rel-riskvalues-fix').click();
		await flush();

		const inputs = Array.from(Modal.lastOpened!.contentEl.querySelectorAll('input'));
		expect(inputs[0].placeholder).toBe('High');
		expect(inputs[1].placeholder).toBe('High');
	});
});
