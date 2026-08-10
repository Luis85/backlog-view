// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Menu, Modal } from '../helpers/obsidian-mock';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

const help = (containerEl: HTMLElement) => {
	const el = containerEl.querySelector<HTMLButtonElement>('.pbl-toolbar .pbl-help-btn');
	if (!el) throw new Error('no help button in the toolbar');
	return el;
};

describe('the manual is reachable from the toolbar', () => {
	beforeEach(() => {
		Modal.lastOpened = null;
	});

	it('is a real button in the toolbar', () => {
		const { containerEl } = makeView(fixture(), {});
		expect(help(containerEl).tagName).toBe('BUTTON');
		expect(help(containerEl).getAttribute('data-pbl-key')).toBe('help');
	});

	it('opens the manual on the types section', () => {
		const { containerEl } = makeView(fixture(), {});
		help(containerEl).click();
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent).toBe('Item types');
	});

	it('returns focus to the help button when closed', () => {
		const { containerEl } = makeView(fixture(), {});
		const btn = help(containerEl);
		btn.focus();
		btn.click();
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(btn);
	});

	it('is mirrored into the overflow menu', () => {
		const { containerEl } = makeView(fixture(), {});
		const overflow = containerEl.querySelector<HTMLButtonElement>('.pbl-overflow-btn');
		overflow?.click();
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open the manual');
	});

	it('opens the manual from the overflow entry without focusing the overflow button first', () => {
		const { containerEl } = makeView(fixture(), {});
		const overflow = containerEl.querySelector<HTMLButtonElement>('.pbl-overflow-btn');
		overflow?.click();
		Menu.lastShown?.item('Open the manual')?.click();
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent).toBe('Item types');
		// Skipping `pickAndRefocus` is the whole point: the overflow button must still be
		// in the document (the rebuild-and-refocus that would fight the modal never ran),
		// and focus must be on the modal's own content, not yanked back to the toolbar.
		expect(document.activeElement).not.toBe(containerEl.querySelector('.pbl-overflow-btn'));
	});

	it('returns focus to the overflow button when the mirrored entry closes', () => {
		const { containerEl } = makeView(fixture(), {});
		const overflow = containerEl.querySelector<HTMLButtonElement>('.pbl-overflow-btn');
		overflow?.click();
		Menu.lastShown?.item('Open the manual')?.click();
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-overflow-btn'));
	});
});
