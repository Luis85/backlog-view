// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Menu, Modal } from '../helpers/obsidian-mock';
import { horizonVault, makeRoadmap, shelfCountOf, shelfGroupHeaders, shelfTitles } from '../helpers/roadmap';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';
import { bodyOf } from '../helpers/cssVars';

useViewHarness();

/** The shelf's search box, which the pane rebuilds under every keystroke. */
function searchBox(containerEl: HTMLElement): HTMLInputElement {
	const input = containerEl.querySelector<HTMLInputElement>('.pbl-shelf-search-input');
	if (!input) throw new Error('shelf search box not rendered');
	return input;
}

/** Type into the box the way a keyboard does: the value, then the event it fires. */
function typeSearch(containerEl: HTMLElement, text: string): void {
	const input = searchBox(containerEl);
	input.value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function openTypeMenu(containerEl: HTMLElement): Menu {
	Menu.forget();
	containerEl
		.querySelector<HTMLButtonElement>('.pbl-shelf-filter')
		?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
	if (!Menu.lastShown) throw new Error('no type menu opened');
	return Menu.lastShown;
}

function cardMenu(containerEl: HTMLElement, title: string): Menu {
	Menu.forget();
	cardByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	if (!Menu.lastShown) throw new Error('no card menu opened');
	return Menu.lastShown;
}

/** Three shelved epics with distinguishable titles, plus a task to group beside them. */
function searchVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Login screen.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Login audit.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('Billing export.md', { frontmatter: { type: 'Epic', order: 30 } });
	vault.addFile('Login task.md', { frontmatter: { type: 'Task', order: 40 } });
	return vault;
}

describe("the shelf's own search", () => {
	it('narrows the shelf to matching titles while the count keeps the true total', () => {
		const { containerEl } = makeRoadmap(searchVault());
		expect(shelfTitles(containerEl)).toHaveLength(4);

		typeSearch(containerEl, 'login');

		// Case-insensitive, and the groups it empties go with the cards: the search is a
		// narrowing over the same grouping the type filter narrows.
		expect(shelfTitles(containerEl)).toEqual(['Login screen', 'Login audit', 'Login task']);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		// The count is the shelf's statement about the results, never about what is on
		// screen — the same rule the type filter is held to.
		expect(shelfCountOf(containerEl)).toBe('4');
	});

	it('drops a group whole when nothing in it matches', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'billing');
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
	});

	it('keeps the caret in the box across the rebuild each keystroke causes', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const before = searchBox(containerEl);
		before.focus();
		before.value = 'login';
		before.setSelectionRange(3, 3);

		before.dispatchEvent(new Event('input', { bubbles: true }));

		// The pane rebuilds under the typing and takes this very input with it, so the
		// replacement has to take the focus AND the caret: focus on the pane (what every
		// other shelf control gets) would end the search at its first keystroke, and a
		// caret reset to the end would scramble any edit made mid-word.
		const after = searchBox(containerEl);
		expect(after).not.toBe(before);
		expect(document.activeElement).toBe(after);
		expect(after.value).toBe('login');
		expect(after.selectionStart).toBe(3);
	});

	it('waits for an IME to finish composing before it rebuilds the pane', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const input = searchBox(containerEl);
		input.value = 'bil';

		// A composing keystroke: narrowing here would destroy the field being composed
		// into and commit a half-typed word.
		input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
		expect(shelfTitles(containerEl)).toHaveLength(4);
		expect(searchBox(containerEl)).toBe(input);

		input.value = 'billing';
		input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
	});

	it('clears on Escape and puts every card back', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'billing');
		expect(shelfTitles(containerEl)).toHaveLength(1);

		searchBox(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(searchBox(containerEl).value).toBe('');
		expect(shelfTitles(containerEl)).toHaveLength(4);
	});

	it('leaves an Escape that is dismissing the IME to the IME', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'billing');
		const input = searchBox(containerEl);

		const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true });
		input.dispatchEvent(evt);

		// That Escape is rejecting a candidate, not the search: answering it would take
		// the whole query away, and `preventDefault` would stop the IME cancelling at all.
		expect(evt.defaultPrevented).toBe(false);
		expect(searchBox(containerEl).value).toBe('billing');
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
	});

	it('goes back into the tab order when the search itself empties the pane', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeRoadmap(vault);
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');

		typeSearch(containerEl, 'nothing matches this');

		// Nothing is left to arrow through, so the composite is gone — and the control
		// that caused it is the only way back, exactly as a filter hiding the last type is.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		expect(searchBox(containerEl).getAttribute('tabindex')).toBe('0');
		expect(containerEl.querySelector('.pbl-shelf-filter')?.getAttribute('tabindex')).toBe('0');
	});

	it('is offered to the keyboard through the card menu, with a clear only while it runs', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		const titles = () => cardMenu(containerEl, 'Login screen').items.map((i) => i.titleText);
		// The box is `tabindex="-1"` inside the composite, so the menu is its keyboard path.
		expect(titles()).toContain('Search the shelf...');
		// Nothing to clear yet: an entry that would write nothing is not offered.
		expect(titles()).not.toContain('Clear the shelf search');

		view.setShelfSearch('login');
		expect(titles()).toContain('Clear the shelf search');
	});

	it('narrows from the prompt that menu entry opens', () => {
		const { containerEl } = makeRoadmap(searchVault());
		cardMenu(containerEl, 'Login screen').items.find((i) => i.titleText === 'Search the shelf...')?.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('search prompt not opened');
		const input = modal.contentEl.querySelector('input');
		const submit = modal.contentEl.querySelector('button');
		if (!input || !submit) throw new Error('search prompt incomplete');

		input.value = 'billing';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The pointer's live box and the keyboard's prompt are one narrowing: the box
		// comes back carrying what the prompt submitted.
		expect(shelfTitles(containerEl)).toEqual(['Billing export']);
		expect(searchBox(containerEl).value).toBe('billing');
	});

	it('clears from that menu entry', () => {
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'login');
		expect(shelfTitles(containerEl)).toHaveLength(3);

		cardMenu(containerEl, 'Login screen').items.find((i) => i.titleText === 'Clear the shelf search')?.click();

		expect(shelfTitles(containerEl)).toHaveLength(4);
	});
});

describe("the shelf's type picker", () => {
	it('comes straight back open after a pick, showing the state that pick produced', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const first = openTypeMenu(containerEl);

		Menu.forget();
		first.items.find((i) => i.titleText === 'Task (1)')?.click();

		// A pick rebuilds the pane and Obsidian's menu closes itself, so "stays open" is a
		// fresh menu at the same control — carrying the checkmark the pick just wrote.
		const second = Menu.lastShown;
		expect(second).not.toBeNull();
		expect(second).not.toBe(first);
		expect(second?.items.find((i) => i.titleText === 'Task (1)')?.checked).toBe(false);
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic']);
	});

	it('opens under its own button both times, so a reopen never moves the menu', () => {
		const { containerEl } = makeRoadmap(searchVault());
		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-filter');
		if (!btn) throw new Error('no type filter rendered');
		// Every frame's button reports the same box, which is what a stable anchor means:
		// the pick below destroys this one and the reopen anchors to its replacement.
		const rect = { left: 44, bottom: 26, top: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
		Object.defineProperty(HTMLButtonElement.prototype, 'getBoundingClientRect', {
			configurable: true,
			value: () => rect as DOMRect,
		});

		// A real pointer, which `showAtMouseEvent` would have honoured — dropping the first
		// menu at the cursor and every one after it at the button, so the picker jumped the
		// moment it was used. A picker that comes back has to come back in one place.
		const first = openTypeMenu(containerEl);
		expect(Menu.lastPosition).toEqual({ x: 44, y: 26 });

		Menu.forget();
		first.items.find((i) => i.titleText === 'Task (1)')?.click();
		expect(Menu.lastPosition).toEqual({ x: 44, y: 26 });

		Reflect.deleteProperty(HTMLButtonElement.prototype, 'getBoundingClientRect');
	});

	it('hides every type at once, and shows every one back', () => {
		const { containerEl } = makeRoadmap(searchVault());

		openTypeMenu(containerEl).items.find((i) => i.titleText === 'Hide all types')?.click();
		expect(shelfGroupHeaders(containerEl)).toEqual([]);
		// The count is untouched by any of this — the shelf still holds four cards.
		expect(shelfCountOf(containerEl)).toBe('4');

		openTypeMenu(containerEl).items.find((i) => i.titleText === 'Show all types')?.click();
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
	});

	it('leaves a remembered type hidden when hiding all', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		// A type hidden while its last card was shelved stays in the store, unused until
		// one comes back — nothing on this shelf is a Bug.
		view.setShelfHiddenTypes(new Set(['Bug']));

		openTypeMenu(containerEl).items.find((i) => i.titleText === 'Hide all types')?.click();

		// Everything on screen is hidden AND the remembered one still is: a set rebuilt
		// from the groups in front of us would silently un-hide it, and nobody would find
		// out until the day a Bug was shelved again.
		expect(view.shelfHiddenTypes.has('Bug')).toBe(true);
		expect(shelfGroupHeaders(containerEl)).toEqual([]);
	});

	it('keeps Show all live for a hidden type this shelf has no card of', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		// Nothing here is a Bug, so hiding one changes nothing on screen — and clearing it
		// is the only way to stop the next shelved Bug arriving already hidden. Gated on
		// the groups in front of the reader, this entry was dead in the one state it is
		// for; it asks the STORE, which is what its own handler clears.
		view.setShelfHiddenTypes(new Set(['Bug']));
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);

		const entry = openTypeMenu(containerEl).items.find((i) => i.titleText === 'Show all types');
		expect(entry?.disabled).toBe(false);
		entry?.click();
		expect(view.shelfHiddenTypes.size).toBe(0);
	});

	it('withholds each bulk entry exactly where it would change nothing', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		const entry = (title: string) => openTypeMenu(containerEl).items.find((i) => i.titleText === title);
		// Nothing hidden: there is nothing to show back.
		expect(entry('Show all types')?.disabled).toBe(true);
		expect(entry('Hide all types')?.disabled).toBe(false);

		view.setShelfHiddenTypes(new Set(['Epic', 'Task']));
		expect(entry('Show all types')?.disabled).toBe(false);
		expect(entry('Hide all types')?.disabled).toBe(true);
	});

	it('offers the same bulk entries to the keyboard as to the pointer', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const submenu = cardMenu(containerEl, 'Now item').items.find((i) => i.titleText === 'Filter the shelf by type')
			?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toEqual(
			openTypeMenu(containerEl).items.map((i) => i.titleText),
		);
	});
});

/**
 * The clear button beside the search box, asked for directly (2026-08-17). The box is
 * `type="search"` and the comment beside it used to say the PLATFORM draws this button
 * "only while there is something to clear" — a promise the code never checked and a vault
 * did not keep. It is the plugin's own control now, on the toolbar filter's pattern, with
 * the native one suppressed in CSS so the field can never wear two.
 *
 * jsdom neither draws nor hides a pseudo-element, so the suppression is a text check over
 * the stylesheet at the foot of this block — `timelineBoxing.test.ts`'s shape, with its
 * honesty: it refuses the deletion and cannot tell you what the field looks like. The rest
 * is the button's own loop — when it exists, what it clears, and that a keyboard can reach
 * it in the state where it is the only way back.
 */
describe("the shelf search's clear button", () => {
	const clearBtn = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLButtonElement>('.pbl-shelf-search-clear');

	it('is absent while there is nothing to clear', () => {
		const { containerEl } = makeRoadmap(searchVault());

		expect(clearBtn(containerEl)).toBeNull();
	});

	it('appears once something is typed, and clears the search when pressed', () => {
		const { containerEl, view } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'login');
		expect(shelfTitles(containerEl)).toHaveLength(3);

		clearBtn(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.shelfSearch).toBe('');
		expect(searchBox(containerEl).value).toBe('');
		// The cards it was hiding are back, and the count never moved — a narrowing is a
		// display choice, which is the rule the count keeps throughout.
		expect(shelfTitles(containerEl)).toHaveLength(4);
		expect(shelfCountOf(containerEl)).toBe('4');
		expect(clearBtn(containerEl)).toBeNull();
	});

	it('puts focus back in the box it emptied, not on the pane', () => {
		// `runSearch`'s third answer, inherited rather than restated: the button is gone
		// with the rebuild, and a caret in the search box is not a selection in a composite.
		const { containerEl } = makeRoadmap(searchVault());
		typeSearch(containerEl, 'login');

		const btn = clearBtn(containerEl);
		// Named before it is used: without this the click is a no-op on `null` and the
		// assertion below passes on the focus `runSearch` had already placed.
		expect(btn).not.toBeNull();
		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(document.activeElement).toBe(searchBox(containerEl));
	});

	it('suppresses the native cancel button, so the field can never wear two', () => {
		// A text check, and its reach is exactly that: jsdom draws no pseudo-element and the
		// browser harness could not answer what the platform does either — a bare
		// `input[type='search']` carrying a value cleared nothing when its right edge was
		// clicked in headless Chromium, so the premise the type was chosen on is
		// unverifiable here in BOTH directions. What this refuses is the deletion that would
		// leave the answer to chance.
		// From the WORKING DIRECTORY, not from `import.meta.url`: this file is jsdom, where
		// that URL is not a `file:` one and `readFileSync` refuses it — which is why the
		// other stylesheet checks sit in node-env files. vitest runs from the repository
		// root, the same resolution every script here uses.
		// `shelfControls.css` since 2026-08-21: the header's chrome and the grip at the band's
		// foot left `shelf.css` when the two together passed the 400 line budget, and this
		// field's rules went with the header they are part of.
		const css = readFileSync('styles/shelfControls.css', 'utf8');
		// Through the shared reader, which slices from the `{` and throws on a rename. The
		// copy this replaced sliced from the SELECTOR, so its needle was matched against the
		// prelude as well as the body — harmless for `display: none;` and a false pass for
		// any needle a selector could carry.
		expect(bodyOf(css, '.pbl-shelf-search-input::-webkit-search-cancel-button', 'styles/shelfControls.css')).toContain(
			'display: none;',
		);
	});

	it('is a named tab-invisible button beside the pickers, lifted with them when the pane empties', () => {
		const { containerEl } = makeRoadmap(searchVault());
		// A search that matches nothing: the pane draws no card, so it is a `region` rather
		// than a composite and every header control has to be tab-reachable — this button
		// most of all, since it is the one that undoes the state.
		typeSearch(containerEl, 'zzz');
		expect(shelfTitles(containerEl)).toEqual([]);

		const btn = clearBtn(containerEl);
		expect(btn?.tagName).toBe('BUTTON');
		expect(btn?.getAttribute('aria-label')).toBeTruthy();
		expect(btn?.getAttribute('tabindex')).toBe('0');

		// And with cards on screen it is out of the tab order like every other picker.
		typeSearch(containerEl, 'login');
		expect(clearBtn(containerEl)?.getAttribute('tabindex')).toBe('-1');
	});
});
