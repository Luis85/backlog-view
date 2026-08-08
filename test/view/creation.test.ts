// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { fixture, flush, makeView, rowByTitle, submitPrompt, useViewHarness } from '../helpers/view';

/**
 * Clear every configured folder, so folder INFERENCE is what runs. Both layers have to
 * go: a type's own folder answers first, and the home folder answers next.
 */
const NO_TYPE_FOLDERS: Record<string, string> = {
	homeFolder: '',
	...Object.fromEntries(['epic', 'feature', 'pbi', 'task', 'issue', 'bug'].map((t) => [`typeFolder.${t}`, ''])),
};

useViewHarness();

describe('item creation', () => {
	it('creates a child via the add button with prompt, inferred folder and properties', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		// Folders by type off: this is the inference path, which only runs when the
		// type being created has no folder of its own.
		const { containerEl } = makeView(vault, { ...NO_TYPE_FOLDERS });

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// An Epic can hold a Feature or any of the extra types, so the modal asks which — and
		// the heading cannot name the type it is in the middle of asking about.
		expect(modal.titleEl.textContent).toBe('New item');
		const typePicker = modal.contentEl.querySelector('select');
		expect([...(typePicker?.options ?? [])].map((o) => o.value)).toEqual(['Feature', 'Issue', 'Bug', 'Idea']);
		expect(typePicker?.value).toBe('Feature');
		// The prompt says where the item will land before anything is written
		expect(modal.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe(
			'Under "Epic A" · in folder "Backlog"',
		);

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		const createBtn = modal.contentEl.querySelector('button');
		expect(createBtn?.disabled).toBe(true);
		input.value = 'Login flow';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(createBtn?.disabled).toBe(false);
		createBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Created in the folder most items live in, ranked after its sibling
		const fm = vault.fm('Backlog/Login flow.md');
		expect(fm['type']).toBe('Feature');
		expect(fm['parent']).toBe('[[Epic A]]');
		expect(fm['order']).toBe(20);
		expect(Notice.messages.some((m) => m.startsWith('Created'))).toBe(true);
	});

	it('creates the extra type picked in the modal, under a parent three rungs up', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, { ...NO_TYPE_FOLDERS });

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		const picker = modal.contentEl.querySelector('select');
		if (!picker) throw new Error('type picker missing');
		picker.value = 'Bug';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		input.value = 'Login times out';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The chosen type is written, not the ladder's own child.
		const fm = vault.fm('Backlog/Login times out.md');
		expect(fm['type']).toBe('Bug');
		expect(fm['parent']).toBe('[[Epic A]]');
	});

	it('files a new item in its type folder, and follows the picker', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		// The landing spot is announced for the default type...
		const detail = () => modal.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail()).toBe('Under "Epic A" · in folder "docs/requirements"');

		// ...and must follow the picker, or it tells the user something untrue at the
		// moment they confirm.
		const picker = modal.contentEl.querySelector('select');
		if (!picker) throw new Error('type picker missing');
		picker.value = 'Bug';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		expect(detail()).toBe('Under "Epic A" · in folder "docs/bugs"');

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		input.value = 'Login times out';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Filed by type, not beside the items it was created from.
		expect(vault.fm('docs/bugs/Login times out.md')['type']).toBe('Bug');
		expect(vault.fm('docs/bugs/Login times out.md')['parent']).toBe('[[Epic A]]');
	});

	it('files into the shipped folders on a vault with nothing in it yet', () => {
		const { containerEl } = makeView(new FakeVault());

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent).toContain(
			'folder "docs/requirements"',
		);
	});

	it('asks nothing when the row can hold only one type', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Bug A.md', { frontmatter: { type: 'Bug', order: 10 }, parentLink: 'Epic A' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Bug A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// A Bug holds only Tasks, so there is no question to ask and the heading says so.
		expect(modal.titleEl.textContent).toBe('New Task');
		expect(modal.contentEl.querySelector('select')).toBeNull();
	});
});

describe('creation flows', () => {
	it('asks for a folder on an empty view and persists the choice', async () => {
		const vault = new FakeVault();
		// The prompt only asks when the type being created has nowhere to go: no folder
		// of its own, none configured, and no items to infer from.
		const { containerEl, config } = makeView(vault, { ...NO_TYPE_FOLDERS });

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// With the folder still a user choice there is no landing spot to announce
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')).toBeNull();
		submitPrompt({ title: 'First Epic', folder: 'Backlog' });
		await flush();

		expect(config.values['homeFolder']).toBe('Backlog');
		expect(vault.folders.has('Backlog')).toBe(true);
		expect(vault.fm('Backlog/First Epic.md')['type']).toBe('Epic');
	});

	it('describes the vault root as the landing spot for rootless backlogs', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { ...NO_TYPE_FOLDERS });

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe('In the vault root');
	});

	it('ranks top-level creations against the real roots in focus mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic 1.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Epic 2.md', { frontmatter: { type: 'Epic', order: 200 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic 1' });
		const { containerEl } = makeView(vault, NO_TYPE_FOLDERS, { focus: 'Feature' });

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Fresh Feature' });
		await flush();

		// After the real epics (order 200), not squeezed between the focus rows
		expect(vault.fm('Fresh Feature.md')['order']).toBe(210);
	});

	it('infers the folder from hidden items when a focused view is empty', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// Focused on Feature, nothing matches — but the full tree knows the folder
		const { containerEl } = makeView(vault, NO_TYPE_FOLDERS, { focus: 'Feature' });
		expect(containerEl.querySelector('.pbl-empty')).not.toBeNull();

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// No folder question: the location is known
		expect(modal.contentEl.querySelectorAll('input')).toHaveLength(1);
		submitPrompt({ title: 'Fresh Feature' });
		await flush();

		expect(vault.fm('Backlog/Fresh Feature.md')['type']).toBe('Feature');
	});

	it('creates children beside the parent folder note in folder mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic X/Epic X.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Epic X')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Fast checkout' });
		await flush();

		const fm = vault.fm('Backlog/Epic X/Fast checkout.md');
		expect(fm['type']).toBe('Feature');
		expect(fm['parent']).toBe('[[Epic X]]');
	});

	it('surfaces creation failures as a notice', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const vault = fixture();
		const { containerEl } = makeView(vault);
		(vault.app.vault as { create: unknown }).create = async () => {
			throw new Error('disk full');
		};

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Doomed' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not create the item'))).toBe(true);
	});
});
