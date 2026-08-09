// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { flush, fixture, makeView, noOptionalProperties, useViewHarness } from '../helpers/view';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';

useViewHarness();

/**
 * The `⋯` is what makes "the ladder sheds controls" survive the rule that a responsive
 * hide is a space decision and no COMMAND is withheld for it. Two questions, and the
 * second is the one that can go quietly wrong: an entry that stays enabled while the
 * button it duplicates is disabled would write collapse state a quick filter is
 * overriding, from a pane too narrow to show the button refusing it.
 */
describe('the toolbar overflow menu', () => {
	const openOverflow = (containerEl: HTMLElement) => {
		const btn = containerEl.querySelector<HTMLElement>('.pbl-overflow-btn');
		if (!btn) throw new Error('overflow button not rendered');
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return Menu.lastShown?.items ?? [];
	};

	it('carries every action the ladder can shed, on the projection that has them', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		expect(openOverflow(containerEl).map((i) => i.titleText)).toEqual([
			'Compact rows',
			'Jump to today',
			'Assign missing properties',
			'Expand all',
			'Collapse all',
		]);
	});

	it('offers only what this projection renders — no density or today off the dated axis', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		view.setProjection('tree');

		expect(openOverflow(containerEl).map((i) => i.titleText)).toEqual([
			'Assign missing properties',
			'Expand all',
			'Collapse all',
		]);
	});

	/**
	 * A toggle is the one entry where omitting the state inverts the meaning: at the
	 * steps where this menu is the only copy of the density control, an unchecked
	 * "Compact rows" whose click turns compact rows OFF says the opposite of what it
	 * does. Mirrored from the button's `aria-pressed`, like `disabled` is from its flag.
	 */
	it('checks the density entry exactly when the toggle it duplicates is pressed', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const off = openOverflow(containerEl);
		expect(off.find((i) => i.titleText === 'Compact rows')?.checked).toBe(false);

		view.setDensity('compact');

		const on = openOverflow(containerEl);
		expect(on.find((i) => i.titleText === 'Compact rows')?.checked).toBe(true);
	});

	it('disables an entry exactly when the button it duplicates is disabled', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		const enabled = openOverflow(containerEl);
		expect(enabled.find((i) => i.titleText === 'Expand all')?.disabled).toBe(false);

		// A running quick filter overrides collapse state, so both bulk controls refuse
		// the press — and the menu has to refuse it too.
		view.setFilter('Epic');

		const filtering = openOverflow(containerEl);
		expect(filtering.find((i) => i.titleText === 'Expand all')?.disabled).toBe(true);
		expect(filtering.find((i) => i.titleText === 'Collapse all')?.disabled).toBe(true);
	});

	/**
	 * `setDisabled` is a request to the `Menu`, and the only thing between a disabled
	 * entry and a real write is that `Menu` honouring it — which nothing here can check,
	 * because the double's `click()` calls the handler regardless. That is the point: the
	 * button these two entries duplicate re-reads `btn.disabled` before mutating, for a
	 * reason of its own (a click on the icon inside a disabled button reaches its
	 * listener), and the entries had no such guard at all.
	 *
	 * Expand/collapse is the pair that matters. A mis-enabled ✨ is refused by the write
	 * gate; a mis-enabled Expand all really writes collapse state a quick filter is
	 * overriding, which the user then discovers when they clear the filter.
	 */
	it('refuses a disabled bulk-collapse entry even when the menu hands the click through', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {}, { collapsed: true });
		expect(view.isCollapsed('Epic B.md')).toBe(true);

		// A running quick filter overrides collapse state, so both bulk controls refuse
		// the press — the state the entry above asserts is mirrored into the menu.
		view.setFilter('Epic');
		openOverflow(containerEl)
			.find((i) => i.titleText === 'Expand all')
			?.click();

		// Asked with the filter gone, because `isCollapsed` reports false while one is
		// running: what is being checked is the stored state, not the overridden view of
		// it.
		view.setFilter('');
		expect(view.isCollapsed('Epic B.md')).toBe(true);

		// Both entries, from the state each one would visibly change: a refused Collapse
		// all has to leave an expanded tree expanded, and one guard covering one of the
		// pair is how the other comes to lose it.
		openOverflow(containerEl)
			.find((i) => i.titleText === 'Expand all')
			?.click();
		expect(view.isCollapsed('Epic B.md')).toBe(false);

		view.setFilter('Epic');
		openOverflow(containerEl)
			.find((i) => i.titleText === 'Collapse all')
			?.click();

		view.setFilter('');
		expect(view.isCollapsed('Epic B.md')).toBe(false);
	});

	it('runs the same action the button runs', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {}, { collapsed: true });

		// 'Epic B.md' is the fixture's only parent (it has two Features beneath it), so
		// it is the one path `collapseNewParents` actually collapses on first render.
		expect(view.isCollapsed('Epic B.md')).toBe(true);

		openOverflow(containerEl)
			.find((i) => i.titleText === 'Expand all')
			?.click();

		expect(view.isCollapsed('Epic B.md')).toBe(false);
	});

	it('collapses through the menu the same way the button does', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		expect(view.isCollapsed('Epic B.md')).toBe(false);

		openOverflow(containerEl)
			.find((i) => i.titleText === 'Collapse all')
			?.click();

		expect(view.isCollapsed('Epic B.md')).toBe(true);
	});

	it('toggles density through the menu the same way the button does', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		expect(view.density).toBeNull();

		openOverflow(containerEl)
			.find((i) => i.titleText === 'Compact rows')
			?.click();

		expect(view.density).toBe('compact');
	});

	it('jumps to today through the menu, resetting the scroller the same way the button does', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		if (!scroller) throw new Error('the scroller is missing');
		// Scrolled away by something else — a board or tree pan, in the real view — so
		// the click has an actual distance to close rather than a no-op zero to zero.
		scroller.scrollLeft = 999;

		openOverflow(containerEl)
			.find((i) => i.titleText === 'Jump to today')
			?.click();

		// The same clamped math `jumpToToday` itself uses (`roadmap.test.ts`'s own
		// `centredOnToday`): jsdom lays out nothing, so `clientWidth` is 0, narrower than
		// the lead column — the clamped case.
		const todayLeft = view.roadmap?.todayLeft ?? 0;
		expect(scroller.scrollLeft).toBe(Math.max(todayLeft - TIMELINE_LEAD_PX, 0));
	});

	it('runs the same backfill the ✨ button runs', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F1.md', { parentLink: 'Epic' });
		const { containerEl } = makeView(vault, noOptionalProperties());

		openOverflow(containerEl)
			.find((i) => i.titleText === 'Assign missing properties')
			?.click();
		await flush();

		expect(vault.writeLog.length).toBeGreaterThan(0);
	});
});
