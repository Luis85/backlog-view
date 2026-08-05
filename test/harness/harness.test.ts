// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountHarness } from './mount';
import { installObsidianDom } from '../helpers/dom';
import { projectionButton } from '../helpers/view';

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

		const titles = Array.from(containerEl.querySelectorAll('.pbl-row .pbl-title')).map((t) => t.textContent);
		expect(titles).toContain('Onboarding');
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
