// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixture, makeView, refresh, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * `barEl.empty()` destroys whatever control has focus, so every toolbar control whose
 * activation re-renders has to be found again afterwards. The identity that survives is
 * the per-control key (`data-pbl-key`), and these are the two halves of that: the
 * controls the previous identity — `aria-label` — could not restore, and the instrument
 * that says the mechanism reaches all of them rather than the ones someone listed.
 */
describe('focus survives the toolbar rebuilding itself', () => {
	/** By CLASS, so what is asserted is where focus went and never how it got there. */
	const control = (containerEl: HTMLElement, cls: string) => {
		const el = containerEl.querySelector<HTMLElement>(`.pbl-toolbar .${cls}`);
		if (!el) throw new Error(`toolbar control not rendered: .${cls}`);
		return el;
	};

	it('restores the completed toggle, whose own label changes across the render its click causes', () => {
		const vault = fixture();
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 30, status: 'Done' } });
		const { view, containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const before = control(containerEl, 'pbl-completed-toggle');
		before.focus();
		expect(before.getAttribute('aria-label')).toBe('Hide completed items');

		before.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		refresh(view, vault); // the Bases round trip the option change causes

		const after = control(containerEl, 'pbl-completed-toggle');
		expect(after).not.toBe(before);
		// The name it used to be found by is gone — it states the other action, and a count.
		expect(after.getAttribute('aria-label')).toBe('Show completed items (1 hidden)');
		expect(document.activeElement).toBe(after);
	});

	it('restores the two buttons their own text names, which carry no aria-label at all', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		const newBtn = control(containerEl, 'pbl-new-btn');
		expect(newBtn.getAttribute('aria-label')).toBeNull();
		newBtn.focus();
		refresh(view, vault); // what creating a note comes back as
		expect(document.activeElement).toBe(control(containerEl, 'pbl-new-btn'));

		const focusBtn = control(containerEl, 'pbl-focus-btn');
		expect(focusBtn.getAttribute('aria-label')).toBeNull();
		focusBtn.focus();
		view.setFocusLevel('Feature'); // re-roots the model and rebuilds everything
		expect(document.activeElement).toBe(control(containerEl, 'pbl-focus-btn'));
	});

	it('never TAKES focus that was outside the toolbar doing the rebuilding', () => {
		// The other direction of the same mechanism, and the one three restore tests
		// cannot see: `capturedFocusKey` asks whether the focused element is inside THIS
		// bar before reading its key. One base open in two split panes is two views over
		// one set of keys — `new` names a button in each — so without that containment
		// question the second view's rebuild reads the first view's focused control and
		// pulls focus across the pane divider, out of the toolbar the user was in.
		const vault = fixture();
		const first = makeView(vault);
		const second = makeView(vault);

		const held = control(first.containerEl, 'pbl-new-btn');
		held.focus();
		expect(document.activeElement).toBe(held);

		refresh(second.view, vault); // any data update rebuilds the second view's toolbar

		expect(document.activeElement).toBe(held);
		expect(document.activeElement).not.toBe(control(second.containerEl, 'pbl-new-btn'));
	});

	it('gives every focusable toolbar control a key, and no two the same, in every projection', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(
			vault,
			{
				stateProperty: 'note.status',
				horizonProperty: 'note.horizon',
				startProperty: 'note.start',
				targetProperty: 'note.due',
			},
			{ focus: 'Feature' },
		);
		// Asked of the rendered toolbar rather than of a list of controls: the next
		// control added is exactly the one a list would not have.
		const check = () => {
			const toolbar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
			if (!toolbar) throw new Error('toolbar not rendered');
			const found = Array.from(toolbar.querySelectorAll<HTMLElement>('button, input, [tabindex]')).map((el) => ({
				what: el.className || el.tagName,
				key: el.getAttribute('data-pbl-key'),
			}));
			expect(found.length).toBeGreaterThan(0);
			expect(found.filter((c) => c.key === null)).toEqual([]);
			expect(new Set(found.map((c) => c.key)).size, `two controls share a key: ${JSON.stringify(found)}`).toBe(
				found.length,
			);
		};

		view.setProjection('tree');
		check();
		view.setProjection('board');
		check();
		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		check();
		view.setAxisPick('dates'); // adds the zoom picker, the density toggle and today
		check();
	});
});
