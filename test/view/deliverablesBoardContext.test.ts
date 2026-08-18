// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { cardTitles, columnByName, countOf } from '../helpers/board';

useViewHarness();

/** A configured three-state workflow; the mode itself is not a config key. */
const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done' };

/**
 * A view flipped to the board through the toolbar's own path — the mode is UI state,
 * never a base setting, so tests set it the way the user does: through the host.
 */
function boardView(vault: FakeVault, cfg: Record<string, unknown> = { ...WORKFLOW }) {
	const harness = makeView(vault, cfg, { collapsed: true });
	harness.view.setProjection('board');
	return harness;
}

describe('an excluded Deliverable still carries a matching descendant', () => {
	/**
	 * The Base excludes the Deliverable itself — the same shape `board.test.ts`'s own
	 * `focusedView` uses for an Epic — but returns its Task child. Under PBI focus,
	 * `extraFocused` admits the (parentless) Deliverable as a focus root exactly as it
	 * would an Issue or a Bug, so it is the only thing standing between the rendered
	 * board and the Task's match.
	 */
	function contextVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		vault.addFile('Widget.md', { frontmatter: { type: 'Task', order: 10, status: 'Active' }, parentLink: 'D' });
		return vault;
	}

	function excludedDeliverableView(focus: string) {
		const vault = contextVault();
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const config = new FakeViewConfig(WORKFLOW);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'D.md') };
		view.onDataUpdated();
		view.setFocusLevel(focus);
		view.setProjection('board');
		return { view, config, containerEl, vault };
	}

	it('never counts the exempted Deliverable — the rule the fix must not break', () => {
		const { containerEl } = excludedDeliverableView('PBI');

		// A rendered context card still contributes 0 to its column's count.
		expect(countOf(columnByName(containerEl, 'No state'))).toBe('0');
		// ...and 0 to the toolbar's item count: only the Task it places is a real result,
		// and the Deliverable itself was never in `model.results` to begin with.
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('a REAL (in-filter) Deliverable still never becomes a card, focus or not', () => {
		// Same shape, but the Base returns the Deliverable directly — the exemption is
		// for outsideFilter rows only, never for a genuine Deliverable result.
		const vault = contextVault();
		const { containerEl } = boardView(vault);
		expect(cardTitles(containerEl)).not.toContain('D');
	});
});

describe('a focus never takes a Deliverable’s requirement work off the requirements board', () => {
	/**
	 * `Deliverable` is in `EXTRA_TYPES`, so a focus on the extra-type rung promotes one to
	 * a focus root exactly as it promotes a Bug — and this board excludes it. Under a focus
	 * the ROOTS are the candidates, so an excluded root used to take its whole subtree off
	 * screen with it: the Task below was counted by the toolbar and drawn by nothing.
	 */
	function ownedTaskVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'Active' } });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 10, status: 'Active' }, parentLink: 'D' });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 20, status: 'Active' } });
		return vault;
	}

	it('cards the Task its Deliverable owns, the same as with no focus', () => {
		const focused = boardView(ownedTaskVault());
		focused.view.setFocusLevel('PBI');

		// The Deliverable itself is still no card; what changes is that excluding it no
		// longer excludes the requirement work hanging from it.
		expect(cardTitles(focused.containerEl)).toEqual(['T', 'P']);
		expect(cardTitles(focused.containerEl)).not.toContain('D');
	});

	it('agrees with the unfocused board about which items are cards', () => {
		// The rule stated as the two surfaces agreeing rather than as one expected list:
		// pressing the focus button must not decide whether a Task exists on this board.
		const unfocused = boardView(ownedTaskVault());
		const focused = boardView(ownedTaskVault());
		focused.view.setFocusLevel('PBI');

		expect(cardTitles(focused.containerEl)).toEqual(cardTitles(unfocused.containerEl));
	});

	it('counts exactly what it draws, so the toolbar cannot report work the board hides', () => {
		const { containerEl, view } = boardView(ownedTaskVault());
		view.setFocusLevel('PBI');

		// The half that made this visible: the count was already Deliverable-free and read
		// "2 items" over a board drawing one card.
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('2 items');
		expect(cardTitles(containerEl)).toHaveLength(2);
	});

	it('descends through a Deliverable under a Deliverable', () => {
		// The descent is a walk, not one hop: nesting must not restore the hole.
		const vault = ownedTaskVault();
		vault.addFile('D2.md', { frontmatter: { type: 'Deliverable', order: 30, status: 'Active' }, parentLink: 'D' });
		vault.addFile('T2.md', { frontmatter: { type: 'Task', order: 10, status: 'Active' }, parentLink: 'D2' });
		const { containerEl, view } = boardView(vault);
		view.setFocusLevel('PBI');

		// Sorted, because within-column order is the Base's own sort rather than the order
		// this descent happens to reach things in — asserting the walk would test the walk.
		expect(cardTitles(containerEl).sort()).toEqual(['P', 'T', 'T2']);
	});
});
