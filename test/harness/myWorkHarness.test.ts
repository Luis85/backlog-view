// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountMyWorkHarness } from './mountMyWork';
import { installObsidianDom } from '../helpers/dom';

installObsidianDom();

/**
 * The my-work entry's own guarantees, `releaseHarness.test.ts`'s shape for the fourth
 * view: it still mounts, its fixture still draws the cases it exists for (a done and an
 * open state, the Next marker, an `outsideFilter` context ancestor), and the `?width=`
 * knob still constrains the pane it says it constrains.
 *
 * **What this file cannot check is the whole reason Task 10 exists.** jsdom computes no
 * layout, so nothing here can show the state column actually vanishing, the toolbar
 * actually wrapping, or the title actually keeping its width — narrow.test.ts's second
 * describe block pins the RULE existing in the stylesheet source; looking at its EFFECT
 * is `npm run harness -- test/harness/mywork.ts`, at three widths, reported in
 * `task-10-report.md` rather than pretended here.
 */
describe('the my-work harness mounts', () => {
	function mount(widthPx?: number) {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountMyWorkHarness(root, widthPx);
	}

	it('draws the toolbar and a roster with no one picked yet', () => {
		const { containerEl } = mount();
		expect(containerEl.querySelector('.pbl-mw-view')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-mw-person')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-mw-tree')).toBeNull();
	});

	/**
	 * The marker moved DEEPER on purpose (review, PR #239). The row that runs out of a
	 * narrow pane first is the deepest one CARRYING the marker — ~36px that never shrinks —
	 * not the deepest one, so a fixture with the marker on a shallow row draws clean at
	 * every width and says nothing about the case that clips. `Send the magic link` is
	 * finished here so `nextAssigned` walks past it to the Task below it.
	 */
	it('draws Ada’s tree with finished rows, and the Next marker on the deepest open one', () => {
		const { view, containerEl } = mount();
		view.pick('People/Ada.md');

		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row'));
		const byTitle = (title: string) => rows.find((r) => r.querySelector('.pbl-title')?.textContent === title);

		const open = byTitle('Rotate the token signing key on a schedule');
		const done = byTitle('Send the magic link');
		expect(open?.querySelector('.pbl-state-chip.pbl-state-done')).toBeNull();
		expect(done?.querySelector('.pbl-state-chip.pbl-state-done')).not.toBeNull();
		expect(open?.querySelector('.pbl-mw-next')).not.toBeNull();
		expect(done?.querySelector('.pbl-mw-next')).toBeNull();
		// The whole point of moving it: the marked row is deeper than the rows above it.
		expect(Number(open?.style.getPropertyValue('--pbl-depth'))).toBeGreaterThan(
			Number(done?.style.getPropertyValue('--pbl-depth')),
		);
	});

	it('walks THROUGH the outsideFilter ancestor — no row for it, its member re-rooted above it', () => {
		const { view, containerEl } = mount();
		view.pick('People/Ada.md');

		const titles = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-row .pbl-title')).map(
			(el) => el.textContent,
		);
		expect(titles).not.toContain('Hidden Feature');
		expect(titles).toContain('Rotate the signing key');
	});

	it('constrains the leaf to the width it is asked for, and leaves it unconstrained otherwise', () => {
		const wide = mount().containerEl.closest('.pbl-harness-leaf') as HTMLElement;
		expect(wide.style.maxInlineSize).toBe('');

		const narrow = mount(280).containerEl.closest('.pbl-harness-leaf') as HTMLElement;
		expect(narrow.style.maxInlineSize).toBe('280px');
	});
});
