// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { flush, fixture, makeView, noOptionalProperties, useViewHarness } from '../helpers/view';

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

	it('jumps to today through the menu without throwing off the dated axis', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		expect(() =>
			openOverflow(containerEl)
				.find((i) => i.titleText === 'Jump to today')
				?.click(),
		).not.toThrow();
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
