// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { baseFileContent, createBacklogBase, promptCreateBacklogBase } from '../src/scaffold';
import { installObsidianDom } from './dom-helpers';
import { FakeVault } from './helpers';
import { Modal, Notice } from './obsidian-mock';

installObsidianDom();

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	document.body.empty();
	Notice.reset();
	Modal.lastOpened = null;
});

describe('baseFileContent', () => {
	it('filters to markdown notes in the folder and opens the backlog view', () => {
		const content = baseFileContent('Backlog');
		expect(content).toContain('- "file.inFolder(\\"Backlog\\")"');
		expect(content).toContain('file.ext == "md"');
		expect(content).toContain('type: product-backlog');
		// The creation folder is pre-wired so the first item lands inside the filter
		expect(content).toContain('newItemFolder: "Backlog"');
	});

	it('quotes the filter as a YAML scalar so hash folder names survive', () => {
		// In a plain scalar, " #" would start a YAML comment and truncate the filter
		const content = baseFileContent('Roadmap #1');
		expect(content).toContain('- "file.inFolder(\\"Roadmap #1\\")"');
		expect(content).toContain('newItemFolder: "Roadmap #1"');
	});

	it('escapes quotes in the folder name through both layers', () => {
		expect(baseFileContent('A"B')).toContain('"file.inFolder(\\"');
		expect(baseFileContent('A"B')).toContain('newItemFolder: "A\\"B"');
	});
});

describe('createBacklogBase', () => {
	it('creates the folder and a configured base file inside it', async () => {
		const vault = new FakeVault();
		const file = await createBacklogBase(vault.app, ' Backlog ');

		expect(file.path).toBe('Backlog/Product Backlog.base');
		expect(vault.folders.has('Backlog')).toBe(true);
		expect(vault.contents.get(file.path)).toContain('- "file.inFolder(\\"Backlog\\")"');
	});

	it('defaults an empty folder input to Backlog and dedupes the file name', async () => {
		const vault = new FakeVault();
		const first = await createBacklogBase(vault.app, '');
		const second = await createBacklogBase(vault.app, '');

		expect(first.path).toBe('Backlog/Product Backlog.base');
		expect(second.path).toBe('Backlog/Product Backlog 1.base');
	});
});

describe('promptCreateBacklogBase', () => {
	it('prefills the folder, scaffolds the base and opens it', async () => {
		const vault = new FakeVault();
		promptCreateBacklogBase(vault.app as never);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('folder input missing');
		expect(input.value).toBe('Backlog');

		input.value = 'Roadmap';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.files.has('Roadmap/Product Backlog.base')).toBe(true);
		expect(vault.opened).toEqual([{ path: 'Roadmap/Product Backlog.base', mode: true }]);
		expect(Notice.messages.some((m) => m.startsWith('Created'))).toBe(true);
	});
});
