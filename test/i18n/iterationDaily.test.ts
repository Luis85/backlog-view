// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Catalog } from '../../src/i18n/t';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { fromToday } from '../helpers/window';
import { drawnText, markedCatalog, unmarked, useMarkedLocale } from './fixtures';

installObsidianDom();
useViewHarness();

const xx: Catalog = markedCatalog();
useMarkedLocale(xx);

/**
 * The iteration board's daily surfaces — the header, the person chips and the card
 * signals — under a catalog that is not English. `projections.test.ts` enters the
 * iteration board too, but with no dates, no goal, no assignee and no signal, so the
 * timebox, the chips and the signal row were drawn by no marked run until this file.
 */
describe('the iteration board for the daily, under a marked catalog', () => {
	it('leaves nothing but titles, names, values and counts unmarked', () => {
		const vault = new FakeVault();
		const IN = '[[Sprint 12]]';
		vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', order: 10, goal: 'Ship it', start: fromToday(-5), due: fromToday(8) },
		});
		vault.addFile('Prereq.md', { frontmatter: { type: 'PBI', order: 10, status: 'Doing', iteration: IN } });
		vault.addFile('Waiting.md', {
			frontmatter: {
				type: 'PBI',
				order: 20,
				status: 'New',
				iteration: IN,
				dependsOn: 'Prereq',
				due: fromToday(-2),
				risk: 'High',
				priority: 'Must',
				assignee: 'Ada',
			},
		});
		const { view, containerEl } = makeView(
			vault,
			{
				stateProperty: 'note.status',
				stateValues: 'New, Doing, Done',
				doneValues: 'Done',
				iterationProperty: 'note.iteration',
				iterationGoalProperty: 'note.goal',
				iterationOpenStates: 'New',
				iterationResolvedStates: 'Done',
				dependsOnProperty: 'note.dependsOn',
				startProperty: 'note.start',
				targetProperty: 'note.due',
				riskProperty: 'note.risk',
				priorityProperty: 'note.priority',
				assigneeProperty: 'note.assignee',
			},
			{ base: 'Plan.base' },
		);
		view.setBoardScope('Sprint 12.md');
		const header = containerEl.querySelector<HTMLElement>('.pbl-iteration-header');
		const signals = containerEl.querySelector<HTMLElement>('.pbl-card-signals');
		expect(header?.querySelector('.pbl-iteration-when')).not.toBeNull();
		expect(header?.querySelector('.pbl-iteration-people')).not.toBeNull();
		expect(signals).not.toBeNull();

		// The sprint's title, its goal, a person's count, initial and name, and the card's own
		// risk and priority: data, every one — plus the timebox's `·`, an aria-hidden
		// separator between sentences rather than a word. Everything else is the catalog's.
		expect(unmarked(drawnText(header as HTMLElement)).sort()).toEqual(['1', 'A', 'Ada', 'Ship it', 'Sprint 12', '·']);
		expect(unmarked(drawnText(signals as HTMLElement)).sort()).toEqual(['High', 'Must']);
	});
});
