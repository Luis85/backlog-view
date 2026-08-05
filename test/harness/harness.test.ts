// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountHarness } from './mount';
import { installObsidianDom } from '../helpers/dom';
import { projectionButton, submitPrompt } from '../helpers/view';

/** The rendered row for a title — the tree accessors take a container, and so do these. */
function rowFor(containerEl: HTMLElement, title: string): HTMLElement {
	const row = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row')).find(
		(r) => r.querySelector('.pbl-title')?.textContent === title,
	);
	if (!row) throw new Error(`row not found: ${title}`);
	return row;
}

function titlesIn(containerEl: HTMLElement): (string | null)[] {
	return Array.from(containerEl.querySelectorAll('.pbl-row .pbl-title')).map((t) => t.textContent);
}

installObsidianDom();

/**
 * The harness is not a test — it draws, and nothing asserts what it draws (ADR 0020).
 * These two are what stop it from rotting anyway, and neither costs a new gate step:
 * one mounts it so a harness that no longer builds fails here rather than the next time
 * someone tries to look at something, and one holds the theme stub to the stylesheet it
 * stands in for.
 */
describe('the browser harness mounts', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root);
	}

	it('draws a tree with the fixture at depth, including its context row', () => {
		const { containerEl } = mount();

		expect(titlesIn(containerEl)).toContain('Onboarding');
		// The parent the Base does not return: on screen, marked, and not a write target.
		const context = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row')).find(
			(row) => row.querySelector('.pbl-title')?.textContent === 'Retired platform',
		);
		expect(context?.classList.contains('pbl-outside')).toBe(true);
	});

	it('draws every board column the fixture configures, with cards in them', () => {
		const { view, containerEl } = mount();

		view.setProjection('board');

		const columns = Array.from(containerEl.querySelectorAll('.pbl-board-col .pbl-board-col-name')).map(
			(n) => n.textContent,
		);
		expect(columns).toEqual(expect.arrayContaining(['New', 'Ready', 'Active', 'Review', 'Done']));
		expect(containerEl.querySelectorAll('.pbl-board-cols .pbl-card').length).toBeGreaterThan(5);
	});

	it('draws the roadmap buckets and puts the untriaged items on the shelf', () => {
		const { view, containerEl } = mount();

		view.setProjection('roadmap');
		view.setShelfCollapsed(false);

		const buckets = Array.from(containerEl.querySelectorAll('.pbl-bucket .pbl-bucket-name')).map((n) => n.textContent);
		expect(buckets).toEqual(expect.arrayContaining(['Now', 'Next', 'Later']));
		expect(containerEl.querySelectorAll('.pbl-shelf .pbl-card').length).toBeGreaterThan(0);
	});

	it('switches projection through the real toolbar, which is the control being exercised', () => {
		const { containerEl } = mount();

		projectionButton(containerEl, 'Show as kanban board').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-board-cols')).not.toBeNull();
	});
});

/**
 * The mock RECORDS a menu and a dialog; the harness has to DRAW them or a right-click
 * produces nothing on a page that advertises menus as usable. These drive the drawing
 * through the same events a person would, and the creation one is why the fake vault
 * notifies on `create` as well as on a frontmatter write — without that the new note
 * existed and the screen kept showing the old result set.
 */
describe('the chrome the mock only records', () => {
	function mount() {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountHarness(root);
	}

	function contextMenuOn(el: HTMLElement): void {
		el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }));
	}

	it('draws a context menu where the pointer is, with the view’s own items in it', () => {
		const { containerEl } = mount();

		contextMenuOn(rowFor(containerEl, 'Onboarding'));

		const menu = document.querySelector<HTMLElement>('.pbl-harness-menu');
		expect(menu).not.toBeNull();
		const items = Array.from(menu?.querySelectorAll('.pbl-harness-menu-item') ?? []).map((i) => i.textContent);
		expect(items.length).toBeGreaterThan(3);
		expect(items.some((label) => label?.includes('Set type'))).toBe(true);
	});

	it('runs the item that is clicked, and takes the menu away', async () => {
		const { containerEl, vault } = mount();
		contextMenuOn(rowFor(containerEl, 'Onboarding'));
		const done = Array.from(document.querySelectorAll<HTMLElement>('.pbl-harness-menu-item')).find((i) =>
			i.textContent?.includes('Done'),
		);

		done?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.querySelector('.pbl-harness-menu')).toBeNull();
		expect(vault.fm('Onboarding.md').status).toBe('Done');
	});

	it('closes on Escape without running anything', () => {
		const { containerEl, vault } = mount();
		contextMenuOn(rowFor(containerEl, 'Onboarding'));

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(document.querySelector('.pbl-harness-menu')).toBeNull();
		expect(vault.fm('Onboarding.md').status).toBe('Active');
	});

	it('puts a dialog on the page, and re-renders once the note it creates lands', async () => {
		const { containerEl, vault } = mount();
		const newItem = containerEl.querySelector<HTMLElement>('.pbl-new-btn');
		newItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(document.querySelector('.pbl-harness-modal')).not.toBeNull();
		submitPrompt({ title: 'Drawn by the harness' });
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(document.querySelector('.pbl-harness-modal')).toBeNull();
		// Filed under the type's default folder, which is the shipped default layout.
		expect(vault.files.has('docs/requirements/Drawn by the harness.md')).toBe(true);
		// The re-render is the point: the fake vault notifies on create as well as on a
		// write, so the new row is on screen rather than waiting for an unrelated edit.
		expect(titlesIn(containerEl)).toContain('Drawn by the harness');
	});
});

/**
 * The stub going stale is the failure with teeth: add a `var(--text-selection)` to a
 * partial and the page draws it as nothing, silently, forever. So the set is MEASURED
 * off the partials rather than remembered — the instrument reads what the assembler
 * reads, and the rule is stated at the missing variable rather than as a list someone
 * maintains.
 */
describe('the theme stub covers the stylesheet', () => {
	/** Every `var(--x)` in a directory of CSS, minus the plugin's own, which code sets. */
	function variablesUsed(dir: string): Set<string> {
		const used = new Set<string>();
		for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
			for (const match of readFileSync(`${dir}/${file}`, 'utf8').matchAll(/var\(\s*(--[\w-]+)/g)) {
				if (!match[1].startsWith('--pbl')) used.add(match[1]);
			}
		}
		return used;
	}

	it('defines every Obsidian variable the partials read', () => {
		const theme = readFileSync('test/harness/theme.css', 'utf8');

		const missing = [...variablesUsed('styles')].filter((name) => !new RegExp(`^\\s*${name}\\s*:`, 'm').test(theme));

		expect(missing).toEqual([]);
	});

	it('measures something — the instrument is checked before its verdict is trusted', () => {
		// A regex that silently matched nothing would pass the test above forever.
		expect(variablesUsed('styles').size).toBeGreaterThan(20);
		expect(variablesUsed('styles').has('--background-primary')).toBe(true);
		expect(variablesUsed('styles').has('--pbl-indent')).toBe(false);
	});
});
