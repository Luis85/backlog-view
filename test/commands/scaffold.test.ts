// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { promptCreateBacklogBase } from '../../src/commands/scaffold';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { Modal, Notice } from '../helpers/obsidian-mock';

installObsidianDom();

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	document.body.empty();
	Notice.reset();
	Modal.forget();
});

describe('promptCreateBacklogBase', () => {
	it('prefills the folder, scaffolds the base and opens it', async () => {
		const vault = new FakeVault();
		promptCreateBacklogBase(vault.app as never);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('folder input missing');
		expect(input.value).toBe('docs');

		input.value = 'Roadmap';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.files.has('Roadmap/Product Backlog.base')).toBe(true);
		expect(vault.opened).toEqual([{ path: 'Roadmap/Product Backlog.base', mode: true }]);
		expect(Notice.messages.some((m) => m.startsWith('Created'))).toBe(true);
	});
});
