// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, rowByTitle, submitPrompt, useViewHarness } from '../helpers/view';

/**
 * Where a NEW note lands when context rows are on screen — split out of
 * `contextRowWrites.test.ts`, which asks the other half of the context-row rule: what may
 * be written to an EXISTING note. `New <child>` is the one action that writes to a note
 * the Base never returned and is still allowed, because the note it writes is a different
 * one; these tests are about the folder that note lands in and the parent link it carries.
 */

/**
 * Clear every configured folder, so folder INFERENCE is what runs. Both layers have to
 * go: a type's own folder answers first, and the home folder answers next.
 */
const NO_TYPE_FOLDERS: Record<string, string> = {
	homeFolder: '',
	...Object.fromEntries(['epic', 'feature', 'pbi', 'task', 'issue', 'bug'].map((t) => [`typeFolder.${t}`, ''])),
};

useViewHarness();

describe('new-item folder inference with context rows', () => {
	it('ignores ancestors that live outside the filtered folder', () => {
		const vault = new FakeVault();
		// A deep chain of ancestors elsewhere would outvote the two real results
		vault.addFile('Elsewhere/Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Elsewhere/Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Elsewhere/Sub.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });
		vault.addFile('Backlog/A.md', { frontmatter: { type: 'Task' }, parentLink: 'Sub' });
		vault.addFile('Backlog/B.md', { frontmatter: { type: 'Task' }, parentLink: 'Sub' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Inference is what this test is about, so the type folders that would answer
		// first are turned off.
		anyView.config = new FakeViewConfig({ ...NO_TYPE_FOLDERS });
		anyView.data = {
			data: vault.entries().filter((e) => e.file.path.startsWith('Backlog/')),
		};
		view.onDataUpdated();

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Three context ancestors in Elsewhere/ must not outvote two results in Backlog/
		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog"');
		expect(detail).not.toContain('Elsewhere');
	});
});

describe('creating a child under a context parent', () => {
	/**
	 * Folder mode, a base scoped to Backlog/, and a parent living outside it.
	 *
	 * Both notes carry a rank because a creation is a PLACEMENT now: it asks
	 * `orderForTarget` the question every drop asks, and an unranked neighbour refuses
	 * there rather than inventing a number. Ranks are what make this fixture about the
	 * folder and the parent link, which is what these tests are for.
	 */
	function outsideParentView() {
		const vault = new FakeVault();
		vault.addFile('Projects/Epic/Epic.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Backlog/PBI.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		anyView.config = new FakeViewConfig({ inferFolderHierarchy: true, ...NO_TYPE_FOLDERS });
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'Backlog/PBI.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('keeps the new note in the results folder, not beside the excluded parent', () => {
		const { containerEl } = outsideParentView();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('Under "Epic"');
		expect(detail).toContain('folder "Backlog"');
		expect(detail).not.toContain('Projects');
	});

	it('still writes the parent link, so the hierarchy survives the different folder', async () => {
		const { containerEl, vault } = outsideParentView();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'New work' });
		await flush();

		expect(vault.fm('Backlog/New work.md')['parent']).toBe('[[Epic]]');
	});

	it('still puts children beside a parent that is a real result', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic/Epic.md', { frontmatter: { type: 'Epic' } });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		anyView.config = new FakeViewConfig({ inferFolderHierarchy: true, ...NO_TYPE_FOLDERS });
		anyView.data = { data: vault.entries() };
		view.onDataUpdated();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog/Epic"');
	});
});
