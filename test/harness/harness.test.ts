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
 * These are what stop it from rotting anyway, and none costs a new gate step: one mounts
 * it so a harness that no longer builds fails here rather than the next time someone
 * tries to look at something, one holds the theme stub to the stylesheet it stands in
 * for, and one holds the icon set to the names the view actually asks for.
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
describe('the harness draws every icon the view asks for', () => {
	/**
	 * Walk all three projections and both roadmap axes, collecting what `setIcon` was
	 * asked for. Driving the view rather than grepping `src/` on purpose: several icon
	 * names never appear as a literal beside a `setIcon` call — the type badges come
	 * from a table, the spinner and the filter's two states from branches — and a grep
	 * written to find them missed exactly those four. The instrument has to be able to
	 * see the whole set before its verdict is worth anything.
	 */
	function sweepIcons(): { asked: Set<string>; missing: Set<string> } {
		const root = document.createElement('div');
		document.body.appendChild(root);
		const { view, containerEl } = mountHarness(root);
		const asked = new Set<string>();
		const missing = new Set<string>();
		const collect = () => {
			for (const el of containerEl.querySelectorAll<HTMLElement>('[data-icon]')) asked.add(el.dataset.icon ?? '');
			for (const el of containerEl.querySelectorAll<HTMLElement>('[data-icon-missing]')) {
				missing.add(el.dataset.iconMissing ?? '');
			}
		};
		for (const projection of ['tree', 'board', 'roadmap'] as const) {
			view.setProjection(projection);
			collect();
		}
		for (const axis of ['horizons', 'dates'] as const) {
			view.setAxisPick(axis);
			view.setShelfCollapsed(false);
			collect();
		}
		return { asked, missing };
	}

	it('resolves every name, aliases included', () => {
		// `data-icon-missing` is set by the harness renderer for a name lucide does not
		// carry. Obsidian bundles an older lucide, so some of its names are that
		// release's and are mapped in `icons.ts`; a rename lucide makes later lands
		// here rather than as a silently blank control on the page.
		expect([...sweepIcons().missing]).toEqual([]);
	});

	it('measures something — the instrument is checked before its verdict is trusted', () => {
		// A sweep that drove nothing, or a selector that matched nothing, would satisfy
		// the test above forever.
		const { asked } = sweepIcons();
		expect(asked.size).toBeGreaterThan(20);
		expect(asked).toContain('inbox');
	});
});

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

	/**
	 * What the page actually resolves in one scheme: everything outside the two
	 * scheme blocks, plus that scheme's own. Asked per scheme rather than of the whole
	 * file, because the file having a name in it somewhere is not the question — a
	 * variable set only under `theme-dark` reads as nothing in light, and a search of
	 * the text would call that covered.
	 */
	function variablesDefined(scheme: 'dark' | 'light'): Set<string> {
		const theme = readFileSync('test/harness/theme.css', 'utf8');
		const blockOf = (name: string) => new RegExp(`body\\.theme-${name}\\s*\\{([^}]*)\\}`).exec(theme)?.[1] ?? '';
		const shared = theme.replace(/body\.theme-(dark|light)\s*\{[^}]*\}/g, '');
		const defined = new Set<string>();
		for (const source of [shared, blockOf(scheme)]) {
			for (const match of source.matchAll(/^\s*(--[\w-]+)\s*:/gm)) defined.add(match[1]);
		}
		return defined;
	}

	it.each(['dark', 'light'] as const)('defines every Obsidian variable the partials read, in %s', (scheme) => {
		const defined = variablesDefined(scheme);

		expect([...variablesUsed('styles')].filter((name) => !defined.has(name))).toEqual([]);
	});

	it('splits the schemes rather than defining one of them', () => {
		// The instrument again: a regex that failed to find either block would make the
		// test above a search of the whole file, which is the thing it exists not to be.
		const dark = variablesDefined('dark');
		const light = variablesDefined('light');
		expect(dark.has('--color-base-00')).toBe(true);
		expect(light.has('--color-base-00')).toBe(true);
		// Same set, different values — a name in one and not the other is the defect.
		expect([...dark].filter((name) => !light.has(name))).toEqual([]);
		expect([...light].filter((name) => !dark.has(name))).toEqual([]);
	});

	it('measures something — the instrument is checked before its verdict is trusted', () => {
		// A regex that silently matched nothing would pass the test above forever.
		expect(variablesUsed('styles').size).toBeGreaterThan(20);
		expect(variablesUsed('styles').has('--background-primary')).toBe(true);
		expect(variablesUsed('styles').has('--pbl-indent')).toBe(false);
	});
});
