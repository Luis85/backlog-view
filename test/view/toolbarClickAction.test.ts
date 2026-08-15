// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { rowFor, roadmapView, timelineTitles } from '../helpers/roadmap';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The toolbar toggle for whether a click folds a row. Its own file rather than
 * `toolbar.test.ts`'s tail, for the reason that file already states about the projection
 * zone and the Deliverables board: one subject, and the shared file is at its line budget.
 *
 * It is the ONLY surface for the value since 2026-08-11 — it was the **Handling items**
 * group's `clickAction` dropdown too until then, and is now working position in the
 * view-state store — so what this file asserts is the toggle's own loop: that pressing it
 * changes what the button reports about itself, and that the `⋯` says the same thing.
 * Two things belong elsewhere and are not repeated here: that the value SURVIVES the view
 * (`test/view/persistence.test.ts`), and that a click actually folds — asserted in
 * `test/view/opening.test.ts` for the tree, and in this file's second block for the dated
 * axis, which is the one no other suite covers.
 */
describe('the click-action toggle', () => {
	const toggle = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLElement>('.pbl-toolbar .pbl-click-action-toggle');

	it('reports the stored value, both ways round', () => {
		const opens = makeView(fixture());
		expect(toggle(opens.containerEl)?.getAttribute('aria-pressed')).toBe('false');
		expect(toggle(opens.containerEl)?.dataset.icon).toBe('file-text');

		const folds = makeView(fixture(), {}, { folds: true });
		expect(toggle(folds.containerEl)?.getAttribute('aria-pressed')).toBe('true');
		expect(toggle(folds.containerEl)?.dataset.icon).toBe('fold-vertical');
		expect(toggle(folds.containerEl)?.classList.contains('is-active')).toBe(true);
	});

	/**
	 * The name is the SETTING and never the next action — the density toggle's rule. A
	 * name that flipped would announce "clicking a row folds it, pressed" as the value
	 * that makes it true went away, which states the opposite of what is true; asserted
	 * across the flip, since one reading alone cannot tell a fixed name from a lucky one.
	 *
	 * No `refresh` between the presses, and that is the half of the move worth checking:
	 * nothing was written to the `.base`, so no Bases refresh is coming and the toggle
	 * has to bring itself back saying the new value.
	 */
	it('keeps one name across the flip and carries the value in aria-pressed', () => {
		const { view, containerEl, config } = makeView(fixture());
		const name = toggle(containerEl)?.getAttribute('aria-label');

		toggle(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.clickFolds).toBe(true);
		expect(toggle(containerEl)?.getAttribute('aria-label')).toBe(name);
		expect(toggle(containerEl)?.getAttribute('aria-pressed')).toBe('true');

		toggle(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.clickFolds).toBe(false);
		expect(toggle(containerEl)?.getAttribute('aria-pressed')).toBe('false');
		// Nothing reached the `.base`: this value is not a view setting any more.
		expect(config.setCalls).toEqual([]);
	});

	/**
	 * The option applies to the two ROW-shaped projections — the tree and the dated axis,
	 * each of which draws a chevron that folds rows — and to no card, whose disclosure
	 * lists children on its own face and is absent altogether when there are none. So the
	 * control is absent rather than inert on the three card screens: a toolbar toggle that
	 * changes nothing on the screen in front of you is worse than one that is not there.
	 */
	it('is drawn on every row-shaped projection and the dated axis, and on no card projection', () => {
		const { view, containerEl } = makeView(fixture(), {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		expect(toggle(containerEl)).not.toBeNull();

		view.setProjection('roadmap');
		view.setAxisPick('dates');
		expect(toggle(containerEl), 'the dated axis drew no click-action toggle').not.toBeNull();

		view.setAxisPick('horizons');
		expect(toggle(containerEl), 'the horizon axis draws buckets of cards').toBeNull();
		for (const projection of ['board', 'deliverables'] as const) {
			view.setProjection(projection);
			expect(toggle(containerEl), `${projection} drew a click-action toggle`).toBeNull();
		}
		// The catalog is ROW-shaped and renders through `renderTree`, so a click folds there
		// exactly as it does in the plan. Withholding the toggle left the only control over
		// a live behaviour on another screen — the defect a bare `projection === 'tree'`
		// produced when this toggle merged in beside a projection it had never seen.
		view.setProjection('catalog');
		expect(toggle(containerEl), 'the catalog folds on click and drew no toggle').not.toBeNull();

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
		expect(entry(makeView(fixture(), {}, { folds: true }).containerEl)?.checked).toBe(true);
	});
});

/**
 * What the value DOES on the dated axis, which is the half the toolbar test above
 * cannot see: the button being drawn there is a claim that a click folds, and the claim
 * is only worth what this block checks.
 */
describe('clicking a timeline row with the toggle set to fold', () => {
	const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };
	const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

	/** The dated axis with folding on — the roadmap helper takes config, and this is not. */
	function foldingAxis(vault: FakeVault): HTMLElement {
		const harness = roadmapView(vault, DATES);
		harness.view.setClickFolds(true);
		return harness.containerEl;
	}

	/** An epic over a feature, both dated, so the grid has a disclosure to answer for. */
	function nested(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' } });
		vault.addFile('Feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-05', due: '2026-09-01' },
			parentLink: 'Epic',
		});
		return vault;
	}

	it('folds the rows below it and opens nothing', () => {
		const vault = nested();
		const containerEl = foldingAxis(vault);
		// Open it first: a parent nobody has ruled on arrives collapsed, so the click
		// under test has something to shut rather than something to reveal.
		click(rowFor(containerEl, 'Epic')!.querySelector<HTMLElement>('.pbl-chevron')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);

		click(rowFor(containerEl, 'Epic')!);

		expect(timelineTitles(containerEl)).toEqual(['Epic']);
		expect(vault.opened).toEqual([]);
	});

	/**
	 * The tree's own rule about a leaf, kept here rather than re-decided: a row with
	 * nothing under it folds nothing and does not open either. One gesture cannot mean
	 * "fold" on a parent and "open" on a leaf without being unpredictable on both — and
	 * on this axis the question is `timelineRows`' own, since a bar's children are not
	 * always rows on the grid.
	 */
	it('spends the click on a bar with no rows under it', () => {
		const vault = nested();
		const containerEl = foldingAxis(vault);
		click(rowFor(containerEl, 'Epic')!.querySelector<HTMLElement>('.pbl-chevron')!);

		click(rowFor(containerEl, 'Feature')!);

		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		expect(vault.opened).toEqual([]);
	});

	/**
	 * The other half of the same rule, at the projection that must not have inherited it:
	 * `wireCardActivation` serves board, bucket and shelf cards from the same function,
	 * and the fold is a parameter exactly so those three keep opening notes.
	 */
	it('leaves a board card opening its note', () => {
		const vault = nested();
		const { view, containerEl } = makeView(vault, { ...DATES, stateProperty: 'note.status' });
		view.setProjection('board');

		const card = containerEl.querySelector<HTMLElement>('.pbl-card');
		expect(card).not.toBeNull();
		click(card!);

		expect(vault.opened.map((o) => o.path)).toEqual(['Epic.md']);
	});
});
