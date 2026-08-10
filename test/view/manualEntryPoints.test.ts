// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Menu, Modal } from '../helpers/obsidian-mock';
import { fixture, flush, key, makeView, treeOf, useViewHarness } from '../helpers/view';

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

describe('the manual is reachable where its questions are asked', () => {
	beforeEach(() => {
		Modal.lastOpened = null;
	});

	const openedOn = () =>
		Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent ?? null;

	// All THREE empty-state renderers, driven at the surface. One test per renderer,
	// because a single generic case passes while the other two doors are missing — which
	// is the whole defect this covers.
	it('opens on finding work from the nothing-to-show state', () => {
		const { containerEl } = makeView(fixture({ empty: true }), {});
		containerEl.querySelector<HTMLElement>('.pbl-empty .pbl-help-link')?.click();
		expect(openedOn()).toBe('Finding work');
	});

	it('opens on finding work from the no-match state', () => {
		const { view, containerEl } = makeView(fixture(), {});
		view.setFilter('zzzznomatch');
		// `.pbl-empty-filter`, NOT `.pbl-empty` — `renderFilterEmptyState` builds its own
		// shell rather than going through `guidanceShell`. Confirmed against
		// `src/view/render/emptyStates.ts` before writing this selector.
		containerEl.querySelector<HTMLElement>('.pbl-empty-filter .pbl-help-link')?.click();
		expect(openedOn()).toBe('Finding work');
	});

	it('opens on finding work from the all-done state', () => {
		// Every item done, with Show completed items off. `renderAllDoneState` shares
		// `noticeShell` with `renderFilterEmptyState` — confirmed in `emptyStates.ts` and
		// in `test/view/visibility.test.ts`'s own "all-done" case — so this is
		// `.pbl-empty-filter` too, and `showCompleted` has to be turned off explicitly:
		// its default is `true`, so nothing would be hidden without it.
		const { containerEl } = makeView(fixture({ allDone: true }), {
			stateProperty: 'note.status',
			showCompleted: false,
		});
		containerEl.querySelector<HTMLElement>('.pbl-empty-filter .pbl-help-link')?.click();
		expect(openedOn()).toBe('Finding work');
	});

	it('opens on setting up the view from the config warning', () => {
		// Two options naming the same property is a config problem, which is what draws
		// the warning.
		const { containerEl } = makeView(fixture(), { parentProperty: 'note.x', orderProperty: 'note.x' });
		// A structural regression guard, not only a functional one: `.pbl-config-warning`
		// is fit step 6's one shrinkable, clipped-rather-than-hidden readout
		// (`styles/toolbarFit.css`), so a focusable control drawn INSIDE it would stay
		// tabbable while invisible — jsdom cannot see that directly (it lays out nothing),
		// but it can see whether the door was ever put back there. Found by its own
		// section id, the attribute `manualLink` always writes.
		expect(containerEl.querySelector('.pbl-config-warning .pbl-help-link')).toBeNull();
		const link = containerEl.querySelector<HTMLElement>('.pbl-toolbar [data-pbl-section="setup"]');
		expect(link?.closest('.pbl-config-warning')).toBeNull();
		link?.click();
		expect(openedOn()).toBe('Setting up the view');
	});

	// The opener can vanish while the dialog is up. Finish the batch BEFORE closing —
	// a test that closes first passes even when the fallback is missing.
	it('falls back to the help button when the busy indicator is gone by closing time', async () => {
		// THE HARD PART OF THIS TEST IS MAKING IT ABLE TO FAIL. The batch must actually be
		// IN FLIGHT when the manual opens and FINISHED before it closes — held and released
		// the same way `test/view/state.test.ts` holds `processFrontMatter`, copied rather
		// than invented.
		const vault = fixture();
		const { containerEl } = makeView(vault, {});
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const fileManager = vault.app.fileManager as {
			processFrontMatter: (file: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void>;
		};
		const original = fileManager.processFrontMatter.bind(fileManager);
		fileManager.processFrontMatter = async (file, fn) => {
			await gate;
			return original(file, fn);
		};

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true }); // starts a write held by the gate

		containerEl.querySelector<HTMLElement>('.pbl-busy .pbl-help-link')?.click();
		expect(openedOn()).toBe('Safe writes and undo');

		release();
		await flush();

		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-toolbar .pbl-help-btn'));
	});

	it('opens on creating and filing from the new-item prompt', () => {
		const { containerEl } = makeView(fixture(), {});
		containerEl.querySelector<HTMLButtonElement>('.pbl-toolbar .pbl-new-btn')?.click();
		const prompt = Modal.lastOpened;
		prompt?.contentEl.querySelector<HTMLElement>('.pbl-help-link')?.click();
		expect(openedOn()).toBe('Creating and filing');
	});
});
