// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { FolderSuggest, TagPromptModal, TagSuggest, TitlePromptModal } from '../../src/ui/prompts';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { TFolder } from '../helpers/obsidian-mock';

installObsidianDom();

function openModal(options: { askFolder?: boolean; detail?: string } = {}) {
	const vault = new FakeVault();
	const results: { title: string; folder?: string }[] = [];
	const modal = new TitlePromptModal(vault.app as never, {
		heading: 'New Epic',
		detail: options.detail,
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
		expect(results).toEqual([{ title: 'My Epic', folder: undefined }]);
	});

	it('asks for a folder when requested and normalizes it', () => {
		const { results, inputs } = openModal({ askFolder: true });
		expect(inputs).toHaveLength(2);
		type(inputs[0], 'My Epic');
		type(inputs[1], '/Backlog/');
		inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(results).toEqual([{ title: 'My Epic', folder: 'Backlog' }]);
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
		const { modal } = openModal({ detail: 'Under "Epic X" · in folder "Backlog"' });
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

		let inputEvents = 0;
		input.addEventListener('input', () => inputEvents++);
		suggest.selectSuggestion(matches[0], new MouseEvent('click'));
		expect(input.value).toBe('Backlog');
		expect(inputEvents).toBe(1);
	});
});

describe('TagPromptModal', () => {
	function openTagPrompt(known: string[] = ['alpha', 'beta']) {
		const vault = new FakeVault();
		const added: string[] = [];
		const modal = new TagPromptModal(vault.app as never, { known, onSubmit: (tag) => added.push(tag) });
		modal.open();
		const input = modal.contentEl.querySelector('input');
		const addBtn = modal.contentEl.querySelector('button');
		if (!input || !addBtn) throw new Error('tag prompt incomplete');
		return { vault, added, input, addBtn };
	}

	it('submits the typed tag and ignores a blank one', () => {
		const { added, input, addBtn } = openTagPrompt();
		addBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(added).toEqual([]);

		type(input, 'release/1-0');
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
		const suggest = new TagSuggest({} as never, input, ['alpha', 'beta', 'alphabet']);
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
});
