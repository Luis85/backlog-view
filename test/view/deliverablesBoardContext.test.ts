// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { cardByTitle, cardTitles, columnByName, countOf } from '../helpers/board';

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

	function excludedDeliverableView(focus: string, filter: string) {
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
		view.setFilter(filter);
		return { view, config, containerEl, vault };
	}

	it('still renders the Deliverable as a context card, and names the hidden match on its face', () => {
		const { containerEl } = excludedDeliverableView('PBI', 'Widget');

		// Excluding Deliverables from the requirements board must not remove the
		// context-row scaffolding an outsideFilter Deliverable is entitled to like any
		// other excluded ancestor — its Task child has no card of its own under focus
		// (only PBI-rank roots are candidates), so this card is the only way to reach it.
		const card = cardByTitle(containerEl, 'D');
		expect(card.hasClass('pbl-card-context')).toBe(true);
		const matches = card.querySelector('.pbl-card-matches');
		expect(matches?.textContent).toContain('Widget');
	});

	it('never counts the exempted Deliverable — the rule the fix must not break', () => {
		const { containerEl } = excludedDeliverableView('PBI', 'Widget');

		// A rendered context card still contributes 0 to its column's count AND its
		// fullCount — the filter is active, so the header speaks the pair.
		expect(countOf(columnByName(containerEl, 'No state'))).toBe('0 of 0');
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
