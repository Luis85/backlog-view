// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault, setResults } from '../helpers/vault';
import { fixture, makeView, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * What the toolbar SAYS about the result set — the grouping advisory and the count
 * breakdown — split out of `toolbar.test.ts` when that file crossed its 450-line budget.
 * One subject per file is the rule the budget exists to force: the suite without a cap is
 * the one that becomes the place tests hide.
 */

describe('grouping advisory', () => {
	it('flags a configured group-by as having no effect', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();

		setResults(view, vault.entries(), [{ hasKey: () => true, entries: [] }]);

		expect(containerEl.querySelector('.pbl-grouping-note')?.textContent).toBe('Grouping ignored');
	});

	it('stays quiet for the implicit single ungrouped group', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		setResults(view, vault.entries(), [{ hasKey: () => false, entries: [] }]);

		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();
	});

	/**
	 * `groupedData` is Bases' own shape and `hasKey()` is a call into it, so the detection
	 * is a question asked of another plugin's object rather than of our model. It is
	 * wrapped for that reason, and the wrap is load-bearing rather than defensive habit:
	 * it runs inside `onDataUpdated`, ahead of the render, so a throw would take the whole
	 * data update with it and leave the view showing the previous pass. Unreadable
	 * grouping means "no advisory", never "no tree".
	 */
	it('treats grouping it cannot read as none, and still draws the tree', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		setResults(view, vault.entries(), [
				{
					hasKey: () => {
						throw new Error('not a shape this version has');
					},
					entries: [],
				},
			]);

		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();
		expect(titlesOf(containerEl)).toContain('Epic A');
	});
});

describe('toolbar count breakdown', () => {
	it('summarizes items per level in the count tooltip', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const count = containerEl.querySelector<HTMLElement>('.pbl-count-label');

		expect(count?.textContent).toBe('4 items');
		expect(count?.dataset.tooltip).toBe('2 Epic · 2 Feature');
		// Filter changes to the count are announced to assistive tech
		expect(count?.getAttribute('aria-live')).toBe('polite');
	});

	it('counts a marker, and does not count a resource the base returned', () => {
		// The two sides of one line, asserted together because they are easy to confuse and
		// this increment moved one of them. A `Milestone` IS counted: never counted is a
		// rule about a ROLLUP, not an exemption from the reader's own view of what the base
		// returned (`Milestones as their own type`). A `Resource` is not counted, and not
		// because the toolbar excludes it — nothing here knows the type. It never became an
		// item at all (`readItems`), so there is nothing for this or any other projection
		// to leave out.
		const vault = new FakeVault();
		vault.addFile('Onboarding.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone' } });
		vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });
		const { containerEl } = makeView(vault);
		const count = containerEl.querySelector<HTMLElement>('.pbl-count-label');

		expect(count?.textContent).toBe('2 items');
		expect(count?.dataset.tooltip).toBe('1 Epic · 1 Milestone');
	});

	/**
	 * That `aria-live` is exactly why this test exists. A live region announces on
	 * MUTATION, not on a changed value — and `setText` assigns `textContent`, which
	 * destroys the text node and builds a new one even when the string is identical.
	 * `syncCountLabel` runs on every content render, so a render that changed nothing
	 * about the number queued an announcement of "4 items" anyway.
	 *
	 * Node identity is the whole claim, and comparing `textContent` cannot reach it: that
	 * assertion is true of the broken code. The tooltip is checked the same way through a
	 * sentinel, because `setTooltip` writing the same string back is equally invisible to
	 * a value comparison — and it is the write that carries Obsidian's hover handling and,
	 * in some versions, an `aria-label` for this element.
	 */
	it('rewrites neither the text node nor the tooltip when nothing about the count changed', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const count = () => containerEl.querySelector<HTMLElement>('.pbl-count-label');
		const label = count();
		const node = label?.firstChild;
		if (!label || !node) throw new Error('the count label is missing its text');
		label.dataset.tooltip = 'untouched';

		// A content-only render — the toolbar itself is not rebuilt, which is what makes
		// the element identity below meaningful — leaving the number exactly as it was.
		// The shelf's collapse is one: it redraws the pane and nothing above it.
		view.setShelfCollapsed(!view.shelfCollapsed);

		expect(count()).toBe(label);
		expect(label.textContent).toBe('4 items');
		expect(label.firstChild).toBe(node);
		expect(label.dataset.tooltip).toBe('untouched');
	});
});

// The Deliverables board's own toolbar behavior (its toggle, its count scoping, its
// New button and its reduced focus control) lives in deliverablesToolbar.test.ts —
// split out to keep this file under its line budget, and because it is one subject.
