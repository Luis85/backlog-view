// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { FolderSuggest, KnownValueSuggest, TitlePromptModal, ValuePromptModal } from '../../src/ui/prompts';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { openTextPrompt } from '../../src/ui/textPrompt';
import { Modal, TFolder } from '../helpers/obsidian-mock';

installObsidianDom();

function openModal(options: { askFolder?: boolean; detail?: () => string; types?: string[] } = {}) {
	const vault = new FakeVault();
	const results: { title: string; folder?: string; typeName?: string }[] = [];
	const modal = new TitlePromptModal(vault.app as never, {
		heading: 'New Epic',
		detail: options.detail,
		types: options.types ?? ['Epic'],
		askFolder: options.askFolder,
		onSubmit: (result) => results.push(result),
	});
	modal.open();
	const inputs = Array.from(modal.contentEl.querySelectorAll('input'));
	const createBtn = modal.contentEl.querySelector('button');
	if (!createBtn) throw new Error('create button missing');
	return { modal, results, inputs, createBtn };
}

function type(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() =>
	document.body.empty(),
);

describe('TitlePromptModal', () => {
	it('submits the trimmed title', () => {
		const { results, inputs, createBtn } = openModal();
		expect(inputs).toHaveLength(1);
		type(inputs[0], '  My Epic  ');
		createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(results).toEqual([{ title: 'My Epic', folder: undefined, typeName: 'Epic' }]);
	});

	it('asks for a folder when requested and normalizes it', () => {
		const { results, inputs } = openModal({ askFolder: true });
		expect(inputs).toHaveLength(2);
		type(inputs[0], 'My Epic');
		type(inputs[1], '/Backlog/');
		inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(results).toEqual([{ title: 'My Epic', folder: 'Backlog', typeName: 'Epic' }]);
	});

	it('does not submit an empty title', () => {
		const { results, createBtn } = openModal();
		createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(results).toHaveLength(0);
	});

	it('enables Create only while a non-blank title is present', () => {
		const { inputs, createBtn } = openModal();
		expect(createBtn.disabled).toBe(true);
		type(inputs[0], 'My Epic');
		expect(createBtn.disabled).toBe(false);
		type(inputs[0], '   ');
		expect(createBtn.disabled).toBe(true);
	});

	it('shows the landing-spot detail line only when provided', () => {
		const { modal } = openModal({ detail: () => 'Under "Epic X" · in folder "Backlog"' });
		expect(modal.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe(
			'Under "Epic X" · in folder "Backlog"',
		);
		const { modal: plain } = openModal();
		expect(plain.contentEl.querySelector('.pbl-modal-detail')).toBeNull();
	});
});

describe('FolderSuggest', () => {
	it('suggests matching folders sorted by path and applies the selection', () => {
		const vault = new FakeVault();
		vault.folders.add('Backlog/Items');
		vault.folders.add('Backlog');
		vault.folders.add('Archive');
		const input = document.body.createEl('input') as HTMLInputElement;
		const suggest = new FolderSuggest(vault.app as never, input);

		const matches = (
			suggest as unknown as { getSuggestions: (query: string) => TFolder[] }
		).getSuggestions('back');
		expect(matches.map((f) => f.path)).toEqual(['Backlog', 'Backlog/Items']);
		// The vault root is never suggested
		const all = (suggest as unknown as { getSuggestions: (query: string) => TFolder[] }).getSuggestions('');
		expect(all.some((f) => f.path === '/')).toBe(false);

		// The FULL path, which is the whole reason a row is legible: `Backlog` and
		// `Backlog/Items` are both in this list and a leaf name would draw them alike.
		const el = document.body.createDiv();
		suggest.renderSuggestion(matches[1], el);
		expect(el.textContent).toBe('Backlog/Items');

		let inputEvents = 0;
		input.addEventListener('input', () => inputEvents++);
		suggest.selectSuggestion(matches[0], new MouseEvent('click'));
		expect(input.value).toBe('Backlog');
		expect(inputEvents).toBe(1);
	});
});

describe('ValuePromptModal', () => {
	function openTagPrompt(known: string[] = ['alpha', 'beta']) {
		const vault = new FakeVault();
		const added: string[] = [];
		// The tag prompt's own arguments: the one caller with a sigil, which is the half
		// of this modal a plain value prompt does not exercise.
		const modal = new ValuePromptModal(vault.app as never, {
			title: 'Add tag',
			fieldName: 'Tag',
			placeholder: 'Sprint-12',
			ctaLabel: 'Add',
			sigil: '#',
			known,
			onSubmit: (tag) => added.push(tag),
		});
		modal.open();
		const input = modal.contentEl.querySelector('input');
		const addBtn = modal.contentEl.querySelector('button');
		if (!input || !addBtn) throw new Error('tag prompt incomplete');
		return { vault, modal, added, input, addBtn };
	}

	it('submits the typed tag and ignores a blank one', () => {
		const { added, input, addBtn } = openTagPrompt();
		addBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(added).toEqual([]);

		type(input, 'release/1-0');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(added).toEqual(['release/1-0']);
	});

	it('submits the TRIMMED value, which is the one it validated', () => {
		// Found by review (Codex, PR #211) against the release view's free-text status, and it
		// is this modal's rule rather than that caller's: `submit` refuses a blank on
		// `value.trim()` and then handed `onSubmit` the RAW string, so the value it judged and
		// the value it delivered were two different things. Every caller mints vault DATA from
		// this — a tag, a resource's name, a release's first status — and a padded one reads
		// back trimmed while the frontmatter still holds the spaces, so a Base filter
		// comparing against what the screen shows drops the note.
		//
		// Fixed here rather than at the three call sites: the rule is about the modal's own
		// two answers disagreeing, and a fourth caller written next year inherits it.
		const { added, input } = openTagPrompt();
		type(input, '  release/1-0  ');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(added).toEqual(['release/1-0']);
	});

	it('lets an IME finish its composition before submitting', () => {
		const { added, input } = openTagPrompt();
		type(input, 'にほん');

		// The Enter that confirms the composition is not a submit
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
		expect(added).toEqual([]);

		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(added).toEqual(['にほん']);
	});

	it('suggests the known tags, matching with or without the hash', () => {
		const { input } = openTagPrompt(['alpha', 'beta', 'alphabet']);
		const suggest = new KnownValueSuggest({} as never, input, ['alpha', 'beta', 'alphabet'], '#');
		const matches = (suggest as unknown as { getSuggestions: (q: string) => string[] }).getSuggestions('#alph');
		expect(matches).toEqual(['alpha', 'alphabet']);

		const el = document.body.createDiv();
		suggest.renderSuggestion('alpha', el);
		expect(el.textContent).toBe('#alpha');

		let inputEvents = 0;
		input.addEventListener('input', () => inputEvents++);
		suggest.selectSuggestion('alpha', new MouseEvent('click'));
		expect(input.value).toBe('alpha');
		expect(inputEvents).toBe(1);
	});

	it('warns on a case-insensitive duplicate, clears when edited away, and still submits', () => {
		const vault = new FakeVault();
		const added: string[] = [];
		const modal = new ValuePromptModal(vault.app as never, {
			title: 'New resource',
			fieldName: 'Name',
			placeholder: 'Alex Chen',
			ctaLabel: 'Create',
			known: ['Alex Chen', 'Sam Rivera'],
			duplicateWarning: 'A resource with this name already exists.',
			onSubmit: (name) => added.push(name),
		});
		modal.open();
		const input = modal.contentEl.querySelector('input');
		const createBtn = modal.contentEl.querySelector('button');
		if (!input || !createBtn) throw new Error('resource prompt incomplete');
		const warningEl = () => modal.contentEl.querySelector('.pbl-modal-warning');

		expect(warningEl()?.textContent).toBe('');

		type(input, 'ALEX CHEN');
		expect(warningEl()?.textContent).toBe('A resource with this name already exists.');

		type(input, 'ALEX CHEN JR');
		expect(warningEl()?.textContent).toBe('');

		type(input, 'ALEX CHEN');
		createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(added).toEqual(['ALEX CHEN']);
	});

	it('announces the warning as a polite live region tied to the field, never an alert', () => {
		// Non-blocking and typed past on every keystroke: `role="alert"` (assertive) would
		// interrupt the reader on each character near a match, where `.pbl-modal-error`'s
		// alert is right because it stops a submit. `aria-describedby` is what a screen
		// reader user needs to hear it at all, since nothing here is refused.
		const vault = new FakeVault();
		const modal = new ValuePromptModal(vault.app as never, {
			title: 'New resource',
			fieldName: 'Name',
			placeholder: 'Alex Chen',
			ctaLabel: 'Create',
			known: ['Alex Chen'],
			duplicateWarning: 'A resource with this name already exists.',
			onSubmit: () => {},
		});
		modal.open();
		const input = modal.contentEl.querySelector('input');
		const warningEl = modal.contentEl.querySelector('.pbl-modal-warning');
		if (!input || !warningEl) throw new Error('resource prompt incomplete');

		expect(warningEl.getAttribute('role')).toBeNull();
		expect(warningEl.getAttribute('aria-live')).toBe('polite');
		expect(warningEl.id).not.toBe('');
		expect(input.getAttribute('aria-describedby')).toBe(warningEl.id);
	});

	it('renders no warning element at all when the option is absent', () => {
		const { modal } = openTagPrompt();
		expect(modal.contentEl.querySelector('.pbl-modal-warning')).toBeNull();
	});
});

/**
 * `textPrompt.ts` is its own file only because `prompts.ts` is at its line budget, and the
 * caret is the thing that split cost: the autofocus rides along inside `submitOnEnter`
 * there, so declining the Enter rule — which a paragraph field has to — silently declined
 * the focus with it (found by review, PR #211).
 */
describe('openTextPrompt', () => {
	it('puts the caret in the field, like every prompt beside it', async () => {
		const vault = new FakeVault();
		openTextPrompt(vault.app as never, {
			title: 'Describe',
			fieldName: 'Description',
			placeholder: '',
			ctaLabel: 'Save',
			initial: 'What shipped.',
			onSubmit: () => {},
		});
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('no prompt opened');
		// The mock leaves the frame detached, and a detached element cannot hold focus.
		document.body.appendChild(modal.contentEl);
		const area = modal.contentEl.querySelector('textarea');
		if (!area) throw new Error('no textarea drawn');

		// Deferred a tick, as in `prompts.ts`: the field claims focus once the modal is up.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.activeElement).toBe(area);
		expect(area.value).toBe('What shipped.');
	});
});
