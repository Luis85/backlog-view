// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { ManualSection, openManual } from '../../src/ui/manualDialog';
import { Modal } from '../helpers/obsidian-mock';

installObsidianDom();

const SECTIONS: ManualSection[] = [
	{ id: 'one', title: 'First', entries: [{ term: 'A', text: 'alpha' }] },
	{ id: 'two', title: 'Second', entries: [{ term: 'B', text: 'beta' }] },
];

/** The mock's Modal does not attach anything, so the content is read off contentEl. */
const content = () => {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no modal opened');
	return modal.contentEl;
};

describe('the manual dialog', () => {
	beforeEach(() => {
		Modal.lastOpened = null;
		document.body.empty();
	});

	it('opens on the section it was asked for, not the first one', () => {
		openManual({} as never, SECTIONS, 'two');
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
	});

	it('lists every section in the sidebar, marking the open one', () => {
		openManual({} as never, SECTIONS, 'two');
		const tabs = Array.from(content().querySelectorAll('.vertical-tab-nav-item'));
		expect(tabs.map((t) => t.textContent)).toEqual(['First', 'Second']);
		expect(tabs.filter((t) => t.hasClass('is-active')).map((t) => t.textContent)).toEqual(['Second']);
		// The class is a visual cue only; `aria-pressed` is what makes the current
		// section legible to assistive tech, the same convention `.pbl-mode-btn` uses.
		expect(tabs.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
	});

	it('switches the pane when a sidebar item is clicked', () => {
		openManual({} as never, SECTIONS, 'one');
		const tabs = Array.from(content().querySelectorAll<HTMLElement>('.vertical-tab-nav-item'));
		const [first, second] = tabs;
		expect(first.getAttribute('aria-pressed')).toBe('true');
		second.click();
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
		expect(content().querySelector('.pbl-manual-def')?.textContent).toBe('beta');
		// The newly-selected item is marked AND the one it replaced is cleared — a test
		// that only checked the new one would pass with both stuck at "true".
		expect(first.getAttribute('aria-pressed')).toBe('false');
		expect(second.getAttribute('aria-pressed')).toBe('true');
	});

	it('falls back to the first section when the id is unknown', () => {
		openManual({} as never, SECTIONS, 'nope');
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('First');
	});

	// Focus policy belongs to the caller, so what this asserts is that the dialog CALLS
	// back — where focus lands is each door's own test, in `manualEntryPoints.test.ts`.
	it('tells the caller when it closes, so focus policy stays out of ui/', () => {
		let closed = 0;
		openManual({} as never, SECTIONS, 'one', () => {
			closed += 1;
		});
		expect(closed).toBe(0);
		Modal.lastOpened?.close();
		expect(closed).toBe(1);
	});

	it('closes cleanly with no callback at all', () => {
		openManual({} as never, SECTIONS, 'one');
		expect(() => Modal.lastOpened?.close()).not.toThrow();
	});

	it('renders a badge when an entry carries one', () => {
		openManual({} as never, [{ id: 'x', title: 'X', entries: [{ term: 'Epic', text: 'e', badge: { text: 'Epic', cls: 'pbl-lvl-0' } }] }], 'x');
		const badge = content().querySelector('.pbl-badge');
		expect(badge?.hasClass('pbl-lvl-0')).toBe(true);
		expect(badge?.textContent).toBe('Epic');
	});
});
