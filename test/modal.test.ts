// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { FolderSuggest, TitlePromptModal } from '../src/modal';
import { installObsidianDom } from './dom-helpers';
import { FakeVault } from './helpers';
import { TFolder } from './obsidian-mock';

installObsidianDom();

function openModal(options: { askFolder?: boolean } = {}) {
	const vault = new FakeVault();
	const results: { title: string; folder?: string }[] = [];
	const modal = new TitlePromptModal(vault.app as never, {
		heading: 'New Epic',
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
