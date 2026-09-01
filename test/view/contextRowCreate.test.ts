// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { flush, makeView, rowByTitle, submitPrompt, useViewHarness } from '../helpers/view';

/**
 * Where a note CREATED beside a context row lands — the other half of
 * `contextRowWrites.test.ts`, split out when the two subjects together passed the test
 * tree's 450-line budget. That file asks what a move may write; this one asks what a
 * creation may infer, which is the same rule (`outsideFilter` is never a source of
 * anything derived from the Base's results) read at a different entry point.
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
		// Inference is what this test is about, so the type folders that would answer
		// first are turned off.
		const { containerEl } = makeView(
			vault,
			{ ...NO_TYPE_FOLDERS },
			{ collapsed: true, only: ['Backlog/A.md', 'Backlog/B.md'] },
		);

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
	 * **Both notes carry a rank**, which they did not need before `order` became global:
	 * a child is appended after the destination's last ranked row, so an unranked parent
	 * now refuses the creation with `rank.unrankedParent` and the folder question below
	 * would never be reached. The rule under test is where the note LANDS, so the vault
	 * it is asked of has to be one where it lands at all.
	 */
	function outsideParentView() {
		const vault = new FakeVault();
		vault.addFile('Projects/Epic/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/PBI.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic' });
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		const { view, containerEl } = makeView(
			vault,
			{ inferFolderHierarchy: true, ...NO_TYPE_FOLDERS },
			{ only: ['Backlog/PBI.md'] },
		);
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
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true, ...NO_TYPE_FOLDERS }, { collapsed: true });

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog/Epic"');
	});
});
