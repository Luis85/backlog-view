// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { TitlePromptModal } from '../src/modal';
import { installObsidianDom } from './dom-helpers';
import { FakeVault } from './helpers';

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
