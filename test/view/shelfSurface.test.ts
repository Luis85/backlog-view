// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfOf } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { activeShelf } from '../../src/view/shelfSurface';

useViewHarness();

/**
 * Which shelf is on screen. Three surfaces draw one — the roadmap's two axes and the
 * iteration board — and the header's controls used to read `host.roadmap` directly, so on a
 * board they resolved to nothing and did nothing.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
	return vault;
}

describe('the shelf on screen', () => {
	it('is the roadmap’s where the roadmap drew one', () => {
		const { view, containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: false });
		const shelf = activeShelf(view);
		expect(shelf.el).toBe(shelfOf(containerEl));
		expect(shelf.cards.length).toBeGreaterThan(0);
		expect(shelf.collapsed).toBe(false);
	});

	it('is the iteration board’s where that is what drew one', () => {
		// The band the board draws is a POPULATION rather than a placement, and its collapse
		// is a column fold rather than the roadmap's own bit — so a resolver that read
		// `host.roadmap` answered null here and every control above it did nothing.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('Sprint 12.md');
		const shelf = activeShelf(harness.view);
		expect(shelf.el).not.toBeNull();
		expect(shelf.cards.map((card) => card.item.title)).toEqual(['Uncommitted']);
		expect(shelf.collapsed).toBe(false);
	});

	it('reports a collapsed board shelf from the column fold that shuts it', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('Sprint 12.md');
		harness.view.setColumnCollapsed('backlog', null, true);
		expect(activeShelf(harness.view).collapsed).toBe(true);
	});

	it('answers with nothing on a projection that draws no shelf', () => {
		const { view } = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		const shelf = activeShelf(view);
		expect(shelf.el).toBeNull();
		expect(shelf.cards).toEqual([]);
		expect(shelf.collapsed).toBe(false);
	});
});
