// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { fixture, makeView, refresh, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The toolbar's copy of the **Handling items** group's `clickAction` option. Its own file
 * rather than `toolbar.test.ts`'s tail, for the reason that file already states about the
 * projection zone and the Deliverables board: one subject, and the shared file is at its
 * line budget.
 *
 * Two surfaces over one `.base` value is the whole feature, so what is asserted is the
 * value — that the button writes exactly what the dropdown offers and reads back exactly
 * what the dropdown wrote. An assertion that a click FOLDS belongs to `foldOnClick`'s own
 * suite and is not repeated here; this file would still pass if the setting stopped
 * working, and says so rather than implying otherwise.
 */
describe('the click-action toggle', () => {
	const toggle = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLElement>('.pbl-toolbar .pbl-click-action-toggle');

	it('reads the setting the view options wrote, both ways round', () => {
		const opens = makeView(fixture());
		expect(toggle(opens.containerEl)?.getAttribute('aria-pressed')).toBe('false');
		expect(toggle(opens.containerEl)?.dataset.icon).toBe('file-text');

		const folds = makeView(fixture(), { clickAction: 'fold' });
		expect(toggle(folds.containerEl)?.getAttribute('aria-pressed')).toBe('true');
		expect(toggle(folds.containerEl)?.dataset.icon).toBe('fold-vertical');
		expect(toggle(folds.containerEl)?.classList.contains('is-active')).toBe(true);
	});

	/**
	 * The name is the SETTING and never the next action — the density toggle's rule. A
	 * name that flipped would announce "clicking a row folds it, pressed" as the value
	 * that makes it true went away, which states the opposite of what is true; asserted
	 * across the flip, since one reading alone cannot tell a fixed name from a lucky one.
	 */
	it('keeps one name across the flip and carries the value in aria-pressed', () => {
		const vault = fixture();
		const { view, containerEl, config } = makeView(vault);
		const name = toggle(containerEl)?.getAttribute('aria-label');

		toggle(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls.at(-1)).toEqual({ key: 'clickAction', value: 'fold' });

		// Bases persists the option and refreshes the view; nothing re-renders on its own.
		refresh(view, vault);
		expect(toggle(containerEl)?.getAttribute('aria-label')).toBe(name);
		expect(toggle(containerEl)?.getAttribute('aria-pressed')).toBe('true');

		toggle(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls.at(-1)).toEqual({ key: 'clickAction', value: 'open' });
	});

	/**
	 * The option is "Clicking an item in the tree" because that is where it applies —
	 * `foldOnClick` runs on a row's body, and a card has no fold to do. So the control is
	 * absent rather than inert on the three card projections: a toolbar toggle that
	 * changes nothing on the screen in front of you is worse than one that is not there.
	 */
	it('is drawn on the tree alone', () => {
		const { view, containerEl } = makeView(fixture(), {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		expect(toggle(containerEl)).not.toBeNull();

		for (const projection of ['board', 'roadmap', 'deliverables'] as const) {
			view.setProjection(projection);
			expect(toggle(containerEl), `${projection} drew a click-action toggle`).toBeNull();
		}
		view.setProjection('tree');
		expect(toggle(containerEl)).not.toBeNull();
	});

	/**
	 * The rung sheds it, so the `⋯` has to carry it — and carry its VALUE, not just its
	 * name: at the steps where the menu is the only copy, an unchecked entry that turns
	 * folding OFF says the opposite of what pressing it does. Read off the button's own
	 * `aria-pressed` by `overflowEntries`, which is why this holds without a second
	 * derivation of the setting.
	 */
	it('goes to the overflow menu with its state', () => {
		const entry = (containerEl: HTMLElement) => {
			containerEl
				.querySelector<HTMLElement>('.pbl-overflow-btn')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			return (Menu.lastShown?.items ?? []).find((i) => i.titleText === 'Clicking a row folds it');
		};

		expect(entry(makeView(fixture()).containerEl)?.checked).toBe(false);
		expect(entry(makeView(fixture(), { clickAction: 'fold' }).containerEl)?.checked).toBe(true);
	});
});
