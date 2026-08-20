// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView, selectItem } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { key } from '../../helpers/view';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, compliance: 1, confidence: 4 } });
	vault.addFile('Second.md', { frontmatter: { compliance: 2 } });
	return vault;
}

describe('the estimation view from the keyboard', () => {
	it('gives each points group one tab stop rather than one per point', () => {
		// 8 dimensions at 1-5 plus three 1-5 scales is 55 point buttons on the shipped
		// default: 55 tab stops between the table and the note below it.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		for (const group of Array.from(containerEl.querySelectorAll('.pbl-est-points'))) {
			expect(group.getAttribute('role')).toBe('radiogroup');
			const stops = Array.from(group.querySelectorAll('button.pbl-est-point')).filter((b) => b.getAttribute('tabindex') === '0');
			expect(stops, 'exactly one tab stop per group').toHaveLength(1);
		}
	});

	it('puts the group tab stop on the held value, and on the first point when nothing is held', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const held = containerEl.querySelector('[data-dim="strategic-alignment"][data-value="5"]')!;
		expect(held.getAttribute('tabindex')).toBe('0');
		expect(held.getAttribute('aria-checked')).toBe('true');
		expect(held.getAttribute('aria-pressed')).toBeNull();
		const unheldFirst = containerEl.querySelector('[data-dim="reach"][data-value="1"]')!;
		expect(unheldFirst.getAttribute('tabindex')).toBe('0');
		expect(unheldFirst.getAttribute('aria-checked')).toBe('false');
	});

	it('moves and picks with the arrows, and holds at both ends', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const group = containerEl.querySelector('[data-dim="compliance"]')!.closest('.pbl-est-points') as HTMLElement;
		// Held is 1, the first point: ArrowLeft must not wrap to the last.
		key(group, 'ArrowLeft');
		expect(containerEl.querySelector('[data-dim="compliance"][data-value="1"]')!.getAttribute('tabindex')).toBe('0');
	});

	it('reaches the panel from a table row with ArrowRight, and still opens the note with Enter', () => {
		// `Enter` is `docs/requirements/Ranking the items by value.md` extension 4a and is
		// unchanged — this adds a key rather than reassigning one. The brief's own test ended
		// on `expect(view.app.workspace).toBeDefined()`, which checks almost nothing; the fake
		// vault records every `openFile` call (`vault.opened`), so this asserts Enter actually
		// reached it rather than merely that the object exists.
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'ArrowDown');
		key(table, 'ArrowRight');
		expect(containerEl.querySelector('.pbl-est-panel')!.contains(document.activeElement)).toBe(true);
		key(table, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Full.md', mode: false }]);
	});
});
