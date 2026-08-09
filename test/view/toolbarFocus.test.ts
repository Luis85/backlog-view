// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
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

	it('restores the two buttons their own text names, and not by that name', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		const newBtn = control(containerEl, 'pbl-new-btn');
		// These two are named by their own text, which the fit ladder hides on a narrow
		// pane — so they carry an explicit `aria-label` as well, and NEITHER name is what
		// focus is restored by. The key is, which is the whole point of the mechanism:
		// `New Epic` becomes `New Feature` when the focus changes, and the label with it.
		expect(newBtn.getAttribute('aria-label')).toBe('New Epic');
		expect(newBtn.getAttribute('data-pbl-key')).toBe('new');
		newBtn.focus();
		refresh(view, vault); // what creating a note comes back as
		expect(document.activeElement).toBe(control(containerEl, 'pbl-new-btn'));

		const focusBtn = control(containerEl, 'pbl-focus-btn');
		expect(focusBtn.getAttribute('aria-label')).toBe('Focus: all types');
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

	/**
	 * A menu pick is a rebuild the render-pass mechanism cannot see: while a `Menu` is
	 * open, focus is on the body, so `capturedFocusKey` finds nothing inside the toolbar
	 * and the button that opened the menu is destroyed with nothing to restore. Driven
	 * per control, through the menu, so it asserts the path a keyboard user takes.
	 */
	it('puts focus back on the control whose menu was just used', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const pickFrom = (key: string, title: string) => {
			const btn = containerEl.querySelector<HTMLElement>(`[data-pbl-key="${key}"]`);
			if (!btn) throw new Error(`no toolbar control keyed ${key}`);
			btn.focus();
			btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			// Obsidian parks focus on the menu, which lives outside the toolbar.
			(document.activeElement as HTMLElement | null)?.blur();
			Menu.lastShown?.item(title)?.click();
			expect(
				containerEl.querySelector(`[data-pbl-key="${key}"]`),
				`${key} lost focus to the document after its own menu`,
			).toBe(document.activeElement);
		};

		pickFrom('zoom', 'Weeks');
		pickFrom('axis', 'Horizons');
		view.setAxisPick('dates');
		pickFrom('focus', 'Feature');

		// The fourth caller, and the one that is not a menu: pressing clear is what
		// unrenders the clear button, so `focus-clear` has no replacement to be found
		// and the named destination is the focus button beside it.
		const clear = containerEl.querySelector<HTMLElement>('[data-pbl-key="focus-clear"]');
		if (!clear) throw new Error('no clear button under an active focus');
		clear.focus();
		clear.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('[data-pbl-key="focus-clear"]')).toBeNull();
		expect(containerEl.querySelector('[data-pbl-key="focus"]')).toBe(document.activeElement);
	});

	// The rule: the ladder may hide a `.pbl-btn-label` only on a control that is named
	// without it. Asked of every label the toolbar renders, so a control added later
	// with a bare text name fails here rather than going quiet on a narrow pane.
	it('never lets a hidden label be the only name a control has', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		const check = () => {
			const toolbar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
			if (!toolbar) throw new Error('toolbar not rendered');
			const labels = Array.from(toolbar.querySelectorAll<HTMLElement>('.pbl-btn-label'));
			expect(labels.length).toBeGreaterThan(0);
			const unnamed = labels
				.map((el) => el.closest('button'))
				.filter((btn) => (btn?.getAttribute('aria-label') ?? '') === '')
				.map((btn) => btn?.className);
			expect(unnamed, `hiding these labels leaves the control unnamed`).toEqual([]);
		};
		view.setProjection('tree');
		check();
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		check();
		view.setProjection('deliverables');
		check();
	});
});
