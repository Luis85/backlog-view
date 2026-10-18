// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { flush, makeView, refresh, useViewHarness } from '../helpers/view';

useViewHarness();

/** Closing an iteration from its own board: the button, the dialog, and the one batch. */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
	startProperty: 'note.start',
	targetProperty: 'note.due',
};

function sprintVault(next = true): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10, start: '2026-10-01', due: '2026-10-14' } });
	if (next) {
		vault.addFile('Sprint 13.md', {
			frontmatter: { type: 'Iteration', order: 20, start: '2026-10-15', due: '2026-10-28' },
		});
	}
	vault.addFile('Finished.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done', iteration: '[[Sprint 12]]' } });
	vault.addFile('Working.md', { frontmatter: { type: 'PBI', order: 20, status: 'Doing', iteration: '[[Sprint 12]]' } });
	return vault;
}

function onSprint(vault: FakeVault) {
	const harness = makeView(vault, OPTIONS);
	harness.view.setProjection('iteration');
	harness.view.setBoardScope('Sprint 12.md');
	return harness;
}

const closeButton = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.pbl-iteration-close');
const dialogButton = (selector: string) => Modal.lastOpened?.contentEl.querySelector<HTMLElement>(selector);

describe('closing an iteration from its board', () => {
	it('closes and carries the unfinished work to the next iteration, as one undoable batch', async () => {
		const vault = sprintVault();
		const { view, containerEl } = onSprint(vault);
		closeButton(containerEl)?.click();
		expect(Modal.lastOpened?.titleEl.textContent).toBe('Close Sprint 12?');
		expect(dialogButton('.mod-cta')?.textContent).toBe('Close and move to Sprint 13');
		// The unfinished member is listed so it can be checked first; the finished one is not.
		const listed = Array.from(Modal.lastOpened!.contentEl.querySelectorAll('.pbl-confirm-link'), (b) => b.textContent);
		expect(listed).toEqual(['Working']);
		dialogButton('.mod-cta')?.click();
		await flush();
		expect(vault.fm('Sprint 12.md').status).toBe('Done');
		expect(vault.fm('Working.md').iteration).toBe('[[Sprint 13]]');
		expect(vault.fm('Working.md').start).toBe('2026-10-15');
		expect(vault.fm('Finished.md').iteration).toBe('[[Sprint 12]]');
		refresh(view, vault);
		expect(closeButton(containerEl)).toBeNull();
		expect(containerEl.querySelector('.pbl-iteration-closed')?.textContent).toBe('Closed');
		await view.undoLast();
		expect(vault.fm('Sprint 12.md').status).toBeUndefined();
		expect(vault.fm('Working.md').iteration).toBe('[[Sprint 12]]');
	});

	it('closes only, leaving the work where it is, when the reader picks that', async () => {
		const vault = sprintVault();
		onSprint(vault).containerEl.querySelector<HTMLButtonElement>('.pbl-iteration-close')?.click();
		dialogButton('.pbl-confirm-alternative')?.click();
		await flush();
		expect(vault.fm('Sprint 12.md').status).toBe('Done');
		expect(vault.fm('Working.md').iteration).toBe('[[Sprint 12]]');
	});

	it('says the work stays when no later iteration exists, and cancelling writes nothing', async () => {
		const vault = sprintVault(false);
		closeButton(onSprint(vault).containerEl)?.click();
		expect(dialogButton('.mod-cta')?.textContent).toBe('Close iteration');
		expect(dialogButton('.pbl-confirm-alternative')).toBeNull();
		expect(Modal.lastOpened?.contentEl.textContent).toContain('There is no later iteration');
		dialogButton('.pbl-confirm-cancel')?.click();
		await flush();
		expect(vault.fm('Sprint 12.md').status).toBeUndefined();
	});

	it('draws no close control without a state property', () => {
		const vault = sprintVault();
		const { view, containerEl } = makeView(vault, { ...OPTIONS, stateProperty: '' });
		view.setProjection('iteration');
		view.setBoardScope('Sprint 12.md');
		expect(closeButton(containerEl)).toBeNull();
		expect(containerEl.querySelector('.pbl-iteration-closed')).toBeNull();
	});
});
