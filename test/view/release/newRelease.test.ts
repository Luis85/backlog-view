// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { en } from '../../../src/i18n/en';
import { makeReleaseView, noReleaseVault, RELEASE_CONFIG, releaseVault } from '../../helpers/release';
import { FakeVault } from '../../helpers/vault';
import { Modal, Notice } from '../../helpers/obsidian-mock';
import { flush, useViewHarness } from '../../helpers/view';
import { releaseIndex } from '../../../src/domain/releases';
import { CivilDate } from '../../../src/domain/noteFields';

useViewHarness();

/** This suite is not about `today` either, so a fixed value stands in for it. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

/** Every note this run put in the vault, with what it carries. */
function createdNotes(vault: FakeVault, before: Set<string>): { path: string; fm: Record<string, unknown> }[] {
	return [...vault.files.keys()]
		.filter((path) => !before.has(path))
		.map((path) => ({ path, fm: vault.frontmatter.get(path) ?? {} }));
}

function newBtn(viewEl: HTMLElement): HTMLButtonElement {
	const btn = viewEl.querySelector<HTMLButtonElement>('.pbl-rel-new');
	if (!btn) throw new Error('no New release control on screen');
	return btn;
}

/** The dialog the control opened, or a failure naming what happened instead. */
function openedDialog(): Modal {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no dialog opened');
	return modal;
}

const fieldNames = (modal: Modal): string[] =>
	Array.from(modal.contentEl.querySelectorAll('.setting-item-name')).map((n) => n.textContent ?? '');

/** Press the control and let the bind settle, so the dialog is open and askable. */
async function openNewRelease(vault: FakeVault, configValues: Record<string, unknown>) {
	const { view } = makeReleaseView(vault, configValues);
	newBtn(view.viewEl).click();
	await flush();
	return { view, modal: openedDialog() };
}

/**
 * Fill the title in — and, positionally, whichever optional fields the dialog is drawing —
 * then confirm and let the creation settle. Positional because the dialog draws exactly
 * `releaseFields`' list in order, which is the thing `fieldNames` above asserts separately:
 * a caller passing two values is saying "the first two boxes on screen", so a test that
 * fills them and a test that names them cannot drift apart.
 */
async function confirm(modal: Modal, title: string, optional: string[] = []): Promise<void> {
	const [titleEl, ...fieldEls] = Array.from(modal.contentEl.querySelectorAll('input'));
	if (!titleEl) throw new Error('no title field');
	const type = (el: HTMLInputElement, value: string): void => {
		el.value = value;
		el.dispatchEvent(new Event('input', { bubbles: true }));
	};
	type(titleEl, title);
	optional.forEach((value, i) => {
		const el = fieldEls[i];
		if (!el) throw new Error(`the dialog draws no field ${i + 1}`);
		type(el, value);
	});
	modal.contentEl.querySelector<HTMLButtonElement>('.mod-cta')?.click();
	await flush();
}

/**
 * One whole gesture, from the control on screen to what landed in the vault. Every
 * optional field FILLED, so what the two entry points are compared on is a note with
 * something in each of its keys — a comparison over three absent keys would agree just as
 * loudly and say nothing about the fields at all.
 */
async function createRelease(vault: FakeVault): Promise<{ path: string; fm: Record<string, unknown> }[]> {
	const before = new Set(vault.files.keys());
	const { modal } = await openNewRelease(vault, RELEASE_CONFIG);
	await confirm(modal, '2.4', ['2.4.0', '2026-11-30', 'Planned']);
	return createdNotes(vault, before);
}

describe('New release', () => {
	it('creates a release from the index and from the empty state alike', async () => {
		// One move, N inputs: both entry points land on one function, which is the only
		// place the note is created. A second creation path beside it is the thing this
		// asserts against.
		//
		// NOT the plan's `vault.writeLog`, which records `processFrontMatter` alone and is
		// empty for both sides — `vault.create` appends to nothing, so comparing it would
		// compare [] with []. What the note IS, and where it landed, is the comparison that
		// fails when a second path plans its own frontmatter.
		const indexVault = releaseVault();
		const emptyVault = noReleaseVault();
		const fromIndex = await createRelease(indexVault);
		const fromEmpty = await createRelease(emptyVault);
		expect(fromIndex).toEqual([
			{ path: 'docs/releases/2.4.md', fm: { type: 'Release', version: '2.4.0', 'target-date': '2026-11-30', status: 'Planned' } },
		]);
		expect(fromEmpty).toEqual(fromIndex);
		// And the design's §5 on the one gesture that reaches a writer at all: this view
		// never EDITS a note that already exists. `test/view/releaseNeverEdits.test.ts` puts
		// that check on the calls, but its script never presses this control — so the whole
		// gesture is asked here, at the vault, where an edit or a deletion lands whatever
		// function reached it. Empty for the reason the comment above gives, which is exactly
		// what makes it the assertion: a creation appends to neither log.
		for (const vault of [indexVault, emptyVault]) {
			expect(vault.writeLog).toEqual([]);
			expect(vault.trashed).toEqual([]);
		}
	});

	it("binds the view's options before asking for fields", async () => {
		// The order is the rule: on a fresh vault every option is unset, the bind gives
		// them their suggested keys, and every field then appears. The description joined
		// them on 2026-08-29 and is LAST for a stated reason (`releaseFields`): it is the one
		// box rather than a line, so a dialog that put it in the middle would push the short
		// fields below the fold of a box nobody has typed in yet.
		const { modal } = await openNewRelease(noReleaseVault(), {});
		expect(fieldNames(modal)).toEqual(['Title', 'Version', 'Target date', 'Status', 'Description']);
	});

	it('says so when the press bound the options, rather than changing the base silently', async () => {
		await openNewRelease(noReleaseVault(), {});
		expect(Notice.messages).toEqual([en['release.new.bound']]);
	});

	it('puts focus on the control the CURRENT screen draws when the dialog closes', async () => {
		// Looked up at close time rather than captured: the press itself can call
		// `config.set`, and the refresh behind that replaces the button that opened the
		// dialog. A data update is that redraw, driven here directly — capturing the opener
		// would leave focus on a detached element, which is nowhere.
		const { view } = makeReleaseView(noReleaseVault(), RELEASE_CONFIG);
		const opener = newBtn(view.viewEl);
		opener.focus();
		opener.click();
		await flush();
		view.onDataUpdated();
		const current = newBtn(view.viewEl);
		expect(current).not.toBe(opener);
		openedDialog().close();
		expect(document.activeElement).toBe(current);
	});

	it('puts focus back after the CREATE, not only after the close', async () => {
		// `NewReleaseDialog.submit` closes before it submits, so `onClosed` fires first and
		// the creation runs after it — and the refresh the new release causes then replaces
		// the button `onClosed` just focused. The data update is driven here BETWEEN the
		// confirm and the flush, which is where it can land inside the await; a vault's own
		// refresh may instead land after it, and nothing in this file can say what happens
		// then (see `focusNewRelease`).
		const { view, modal } = await openNewRelease(noReleaseVault(), RELEASE_CONFIG);
		const opener = newBtn(view.viewEl);
		opener.focus();
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no title field');
		input.value = '2.4';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector<HTMLButtonElement>('.mod-cta')?.click();
		view.onDataUpdated();
		await flush();
		const current = newBtn(view.viewEl);
		expect(current).not.toBe(opener);
		expect(document.activeElement).toBe(current);
	});

	/**
	 * Finding 1 of Task 7: `pbl-rel-new` was absent from `FOCUS_HANDLE_CLASSES`, so a
	 * refresh landing AFTER `focusNewRelease` had already restored focus — a further Bases
	 * pass, an external edit, anything not itself part of this press's own two redraws —
	 * ran `render()` with `document.activeElement` sitting on the New release button,
	 * `focusedControlClass()` finding no class for it, and neither the exact match nor the
	 * fallback below it running at all: focus dropped on `document.body`, silently undoing
	 * what the creation had just put back.
	 *
	 * This is deliberately a SECOND `onDataUpdated()`, after the two the tests above already
	 * drive: those two pass whether or not `pbl-rel-new` is in the vocabulary, because
	 * `focusNewRelease`'s own direct call — not `render()`'s restore — is what focuses the
	 * button both times. Only a further redraw with no such call behind it asks the question
	 * this test is about.
	 */
	it('keeps focus on New release across a refresh that follows the one the creation caused', async () => {
		const { view, modal } = await openNewRelease(noReleaseVault(), RELEASE_CONFIG);
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no title field');
		input.value = '2.4';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector<HTMLButtonElement>('.mod-cta')?.click();
		view.onDataUpdated();
		await flush();
		// The creation's own two redraws are done and `focusNewRelease` has already run.
		expect(document.activeElement).toBe(newBtn(view.viewEl));

		// A further, unrelated refresh — nothing in `newRelease.ts` runs for this one.
		view.onDataUpdated();

		expect(document.activeElement).toBe(newBtn(view.viewEl));
	});

	it('binds nothing and says nothing when every option is already bound', async () => {
		// `RELEASE_CONFIG` deliberately leaves `releaseNotesFolder` unbound (see its own
		// docblock), so it is bound here explicitly — this test's claim is about a
		// genuinely fully-configured view.
		await openNewRelease(noReleaseVault(), { ...RELEASE_CONFIG, releaseNotesFolder: 'docs/release-notes' });
		expect(Notice.messages).toEqual([]);
	});

	it('says nothing when the options were bound since the last data update', async () => {
		// `view.settings` is a snapshot from the last data update — `init.ts`'s own
		// documented trap, in the other direction. Bound here with no update behind it, the
		// press binds nothing and must therefore report nothing: a notice here would tell
		// the reader their view's configuration changed when it did not.
		const { view, config } = makeReleaseView(noReleaseVault(), {});
		const fullyBound = { ...RELEASE_CONFIG, releaseNotesFolder: 'docs/release-notes' };
		for (const [option, value] of Object.entries(fullyBound)) config.set(option, value);
		const bound = config.setCalls.length;
		newBtn(view.viewEl).click();
		await flush();
		expect(config.setCalls).toHaveLength(bound);
		expect(Notice.messages).toEqual([]);
	});

	it('leaves a CLEARED option alone, and asks for no field it would land in', async () => {
		// Cleared is a decision, unset is an omission — and only the live config tells them
		// apart. `versionProperty` is present and empty here, so the bind skips it and the
		// dialog respects it; a test using an UNSET option would assert the opposite rule.
		const vault = noReleaseVault();
		const before = new Set(vault.files.keys());
		const { modal } = await openNewRelease(vault, { versionProperty: '' });
		expect(fieldNames(modal)).toEqual(['Title', 'Target date', 'Status', 'Description']);
		// Both boxes filled, so the absent `version` is the CLEARED option and not merely a
		// field nobody typed into — the two are the same note once a blank is skipped, and
		// this test is about the first of them.
		await confirm(modal, '2.4', ['2026-11-30', 'Planned']);
		expect(createdNotes(vault, before)).toEqual([
			{ path: 'docs/releases/2.4.md', fm: { type: 'Release', 'target-date': '2026-11-30', status: 'Planned' } },
		]);
	});

	it('asks for the title alone where every optional property is cleared', async () => {
		// The PBI's extension 2b: a vault that tracks none of them can still make a release,
		// and the note carries nothing but its type. Cleared rather than unset for the reason
		// above — unset would be bound on the way in and every field would appear.
		const vault = noReleaseVault();
		const before = new Set(vault.files.keys());
		const cleared = {
			versionProperty: '',
			targetDateProperty: '',
			releaseStatusProperty: '',
			descriptionProperty: '',
		};
		const { modal } = await openNewRelease(vault, cleared);
		expect(fieldNames(modal)).toEqual(['Title']);
		await confirm(modal, '2.4');
		expect(createdNotes(vault, before)).toEqual([{ path: 'docs/releases/2.4.md', fm: { type: 'Release' } }]);
	});

	it('files the note where the vault is configured NOW, not where it was when the dialog opened', async () => {
		// Found by review (Codex, PR #211), twice over: the type key and the folder are both
		// things the dialog never draws, so capturing them filed the release under a property
		// the view had stopped reading, or in a folder the reader had just moved releases out
		// of — created, reported as created, and in the wrong place either way.
		//
		// The captured FIELD bindings still win, which is the other half of the same rule and
		// is what the second assertion is for: the box the reader typed in was labelled by
		// `version`, so their text lands there even though the option now says `edition`.
		const vault = noReleaseVault();
		const before = new Set(vault.files.keys());
		const { view, modal } = await openNewRelease(vault, RELEASE_CONFIG);
		const values = (view.config as unknown as { values: Record<string, unknown> }).values;
		values.typeProperty = 'note.kind';
		values.releaseFolder = 'shipped';
		values.releaseVersionProperty = 'note.edition';
		view.onDataUpdated();
		await confirm(modal, '2.4', ['9.9.9']);

		expect(createdNotes(vault, before)).toEqual([
			{ path: 'shipped/2.4.md', fm: { kind: 'Release', version: '9.9.9' } },
		]);
	});

	it('reports a refusal rather than throwing it', async () => {
		// A create that fails for ANY reason — `createRelease`'s own type-key guard, or the
		// vault refusing the write, which is what this stages — is reported rather than left
		// to the console: the vault is unchanged and the reader is told. A press that made no
		// note and said nothing looks like a dead button.
		//
		// Staged at the vault rather than by clearing `typeKey` mid-dialog, which no longer
		// reaches the guard and should not: the dialog captures its bindings when it opens
		// (see `newRelease`), and the one configuration that guard refuses is the one both
		// empty states withhold this control on.
		const vault = noReleaseVault();
		const { modal } = await openNewRelease(vault, RELEASE_CONFIG);
		vault.beforeWrite = () => {
			throw new Error('the vault refused the write');
		};
		Notice.reset();
		await confirm(modal, '2.4');
		expect(vault.files.has('docs/releases/2.4.md')).toBe(false);
		expect(Notice.messages).toEqual([en['release.new.failed']]);
	});

	/**
	 * The two halves that were each green while the defect shipped, asked as ONE question.
	 * `test/domain/releases.test.ts` says a present-but-blank `version` reads as invalid and
	 * this file used to say the create wrote one, so both passed and the release this view
	 * had just made drew `Unreadable` in three of its own columns.
	 *
	 * Driven through the real gesture and read back through the real reader: a second mount
	 * over the same vault, because `makeReleaseView` snapshots `vault.entries()` when it
	 * mounts and the note arrives after that. Asked of `releaseIndex` rather than of the
	 * frontmatter, which is what makes it the JOIN — the frontmatter assertion above is the
	 * half that could not see this.
	 */
	it('writes a description typed into the dialog’s own box', async () => {
		// The fourth field, and the only one that is a `textarea` rather than an `input` —
		// which `confirm` above cannot fill, since it reads the dialog's inputs positionally.
		// Driven directly here for that reason, and it is the whole of the create half of
		// [[Editing a release from its own screen]]: the box, the property, the note.
		const vault = noReleaseVault();
		const before = new Set(vault.files.keys());
		const { modal } = await openNewRelease(vault, RELEASE_CONFIG);
		const titleEl = modal.contentEl.querySelector('input');
		const areaEl = modal.contentEl.querySelector('textarea');
		if (!titleEl || !areaEl) throw new Error('the dialog draws no title field or no description box');
		for (const [el, value] of [
			[titleEl, '2.4'],
			[areaEl, 'The billing rewrite.'],
		] as [HTMLElement & { value: string }, string][]) {
			el.value = value;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}
		modal.contentEl.querySelector<HTMLButtonElement>('.mod-cta')?.click();
		await flush();

		expect(createdNotes(vault, before)).toEqual([
			{ path: 'docs/releases/2.4.md', fm: { type: 'Release', description: 'The billing rewrite.' } },
		]);
	});

	it('writes the description under the key the dialog was OPENED against', async () => {
		// The `.base` re-pointed while the box is open — the capture rule the three editors
		// keep, asked of the create (found by review, PR #211). Reading the settings again at
		// the submit dropped the reader's text on the floor while the notice still said the
		// release was made, since `createRelease` writes no unconfigured key.
		const vault = noReleaseVault();
		const before = new Set(vault.files.keys());
		const { view, modal } = await openNewRelease(vault, RELEASE_CONFIG);
		const titleEl = modal.contentEl.querySelector('input');
		const areaEl = modal.contentEl.querySelector('textarea');
		if (!titleEl || !areaEl) throw new Error('the dialog draws no title field or no description box');
		for (const [el, value] of [
			[titleEl, '2.4'],
			[areaEl, 'The billing rewrite.'],
		] as [HTMLElement & { value: string }, string][]) {
			el.value = value;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}
		// After the box was drawn and filled, before it is submitted.
		view.settings = { ...view.settings, descriptionKey: '' };
		modal.contentEl.querySelector<HTMLButtonElement>('.mod-cta')?.click();
		await flush();

		expect(createdNotes(vault, before)).toEqual([
			{ path: 'docs/releases/2.4.md', fm: { type: 'Release', description: 'The billing rewrite.' } },
		]);
	});

	it('creates a release its own reader reads back, with only a title filled in', async () => {
		const vault = noReleaseVault();
		const { modal } = await openNewRelease(vault, RELEASE_CONFIG);
		await confirm(modal, '2.4');

		const { view } = makeReleaseView(vault, RELEASE_CONFIG);
		const model = view.model;
		if (!model) throw new Error('the second mount built no model');
		// `done` is not this test's subject, so `stateKey` is left unbound — the same answer
		// `settingsWith()`'s own default gives.
		const row = releaseIndex(vault.app, model, view.settings, { stateKey: '', today: TODAY }).rows.find(
			(r) => r.path === 'docs/releases/2.4.md',
		);
		if (!row) throw new Error('the created release is not in the index');
		expect({ version: row.version.invalid, target: row.target.invalid, status: row.status.invalid }).toEqual({
			version: false,
			target: false,
			status: false,
		});
	});

	/**
	 * The bind may never hand a suggestion to a key one of this view's MODEL mappings
	 * already holds. `typeProperty: note.status` is a legal choice, and with
	 * `releaseStatusProperty` untouched the bind used to adopt `status` on top of it —
	 * `createRelease` then wrote the type and overwrote it with the status, so the release
	 * came out with no type at all and this view could not see it. Reported on PR #203.
	 *
	 * Driven through the real gesture and read back through `releaseIndex`, because the
	 * damage is only visible at the join: the bind looks reasonable, the write looks
	 * reasonable, and the note is gone from the view.
	 */
	it('never binds a release key onto a mapping this view already reads', async () => {
		const vault = noReleaseVault();
		const { modal, view } = await openNewRelease(vault, { typeProperty: 'note.status' });
		expect(view.settings.statusKey).not.toBe(view.settings.typeKey);
		await confirm(modal, '2.4', ['Planned']);

		const reread = makeReleaseView(vault, { typeProperty: 'note.status' }).view;
		const model = reread.model;
		if (!model) throw new Error('the second mount built no model');
		expect(releaseIndex(vault.app, model, reread.settings, { stateKey: '', today: TODAY }).rows.map((r) => r.path)).toContain(
			'docs/releases/2.4.md',
		);
	});

	it('withholds the control where no type property is bound', () => {
		// `createRelease` refuses without one, and `runReleaseInit` deliberately does not
		// bind `typeProperty` — a cleared type key is a decision, so this state keeps its
		// settings guidance and offers no press that could only fail.
		const { view } = makeReleaseView(noReleaseVault(), { typeProperty: '' });
		expect(view.viewEl.querySelector('.pbl-rel-new')).toBeNull();
	});
});
