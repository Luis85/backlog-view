// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { horizonVault, makeRoadmap } from '../helpers/roadmap';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The toolbar toggle for how a horizon bucket lays its cards out. Its own file rather than
 * `toolbar.test.ts`'s tail, for the reason that file already states about the projection
 * zone: one subject, and the shared file is over its line budget.
 *
 * What it asserts is the toggle's own loop — the button reports the value, pressing it
 * changes what the buckets draw, and the `⋯` says the same thing. That the pick SURVIVES
 * the view is `test/view/viewStatePersistence.test.ts`'s, beside every other stored pick.
 */
describe('the bucket-grid toggle', () => {
	const toggle = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLElement>('.pbl-toolbar .pbl-bucket-grid-toggle');
	const buckets = (containerEl: HTMLElement) => containerEl.querySelector<HTMLElement>('.pbl-roadmap-buckets');

	/**
	 * The grid is the default, so the row carries no class and the button reads pressed.
	 * Both halves, because either alone can be right while the pair disagrees.
	 */
	it('starts on the grid, with nothing stored to say so', () => {
		const { view, containerEl, config } = makeRoadmap(horizonVault());

		expect(view.bucketGrid).toBe(true);
		expect(toggle(containerEl)?.getAttribute('aria-pressed')).toBe('true');
		expect(buckets(containerEl)?.classList.contains('pbl-buckets-list')).toBe(false);
		expect(config.setCalls).toEqual([]);
	});

	/**
	 * The name is the SETTING and never the next action — the density toggle's rule —
	 * asserted across the flip, since one reading cannot tell a fixed name from a lucky
	 * one. And no `refresh` between the presses: nothing reached the `.base`, so no Bases
	 * update is coming and the toggle has to bring itself back saying the new value.
	 */
	it('turns the grid off and on, keeping one name and writing no .base', () => {
		const { view, containerEl, config } = makeRoadmap(horizonVault());
		const name = toggle(containerEl)?.getAttribute('aria-label');

		toggle(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.bucketGrid).toBe(false);
		expect(buckets(containerEl)?.classList.contains('pbl-buckets-list')).toBe(true);
		expect(toggle(containerEl)?.getAttribute('aria-label')).toBe(name);
		expect(toggle(containerEl)?.getAttribute('aria-pressed')).toBe('false');

		toggle(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.bucketGrid).toBe(true);
		expect(buckets(containerEl)?.classList.contains('pbl-buckets-list')).toBe(false);
		expect(config.setCalls).toEqual([]);
	});

	/**
	 * Buckets are the horizon axis's alone, so the control is absent everywhere else
	 * rather than inert: a toolbar toggle that changes nothing on the screen in front of
	 * you is worse than one that is not there.
	 */
	it('is drawn on the horizon axis and on no other screen', () => {
		const { view, containerEl } = makeView(fixture(), {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		expect(toggle(containerEl), 'the tree draws no buckets').toBeNull();

		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		expect(toggle(containerEl)).not.toBeNull();

		view.setAxisPick('dates');
		expect(toggle(containerEl), 'the dated axis draws bars, not buckets').toBeNull();

		for (const projection of ['board', 'deliverables', 'catalog'] as const) {
			view.setProjection(projection);
			expect(toggle(containerEl), `${projection} drew a bucket-grid toggle`).toBeNull();
		}
	});

	/**
	 * The rung sheds it with the density toggle, so the `⋯` has to carry it — and carry
	 * its VALUE: at the steps where the menu is the only copy, an unchecked entry that
	 * turns the grid OFF says the opposite of what pressing it does.
	 */
	it('goes to the overflow menu with its state', () => {
		const entry = (containerEl: HTMLElement) => {
			containerEl
				.querySelector<HTMLElement>('.pbl-overflow-btn')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			return (Menu.lastShown?.items ?? []).find((i) => i.titleText === 'Grid in buckets');
		};

		const { view, containerEl } = makeRoadmap(horizonVault());
		expect(entry(containerEl)?.checked).toBe(true);

		view.setBucketGrid(false);
		expect(entry(containerEl)?.checked).toBe(false);
	});
});
