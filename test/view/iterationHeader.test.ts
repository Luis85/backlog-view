// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { shelfOf } from '../helpers/roadmap';
import { cardTitles, columnByName } from '../helpers/board';
import { makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The iteration board's header: which sprint, what it is for, where its timebox is, how
 * far the work has got — and the Daily/Planning switch that hides the backlog shelf for
 * the stand-up.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
	startProperty: 'note.start',
	targetProperty: 'note.due',
	iterationGoalProperty: 'note.goal',
};

const SPRINT = 'Sprint 12.md';
const IN = '[[Sprint 12]]';

/** A sprint holding one item per bucket, the Done one under a parent the Base excluded. */
function sprintVault(sprint: Record<string, unknown> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10, goal: 'Ship the importer', ...sprint } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 5, status: 'Done' } });
	vault.addFile('Finished.md', {
		frontmatter: { type: 'PBI', order: 10, status: 'Done', iteration: IN },
		parentLink: 'Feature',
	});
	vault.addFile('Working.md', { frontmatter: { type: 'PBI', order: 20, status: 'Doing', iteration: IN } });
	vault.addFile('Waiting.md', { frontmatter: { type: 'PBI', order: 30, status: 'New', iteration: IN } });
	vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 40, status: 'New' } });
	return vault;
}

function onSprint(vault = sprintVault()) {
	const harness = makeView(vault, OPTIONS, { base: 'Plan.base', except: ['Feature.md'] });
	harness.view.setProjection('iteration');
	harness.view.setBoardScope(SPRINT);
	return harness;
}

const headerOf = (root: HTMLElement) => root.querySelector<HTMLElement>('.pbl-iteration-header');
const whenOf = (root: HTMLElement) => root.querySelector<HTMLElement>('.pbl-iteration-when');
const modeButton = (root: HTMLElement, name: string) =>
	Array.from(root.querySelectorAll<HTMLButtonElement>('.pbl-iteration-mode button')).find(
		(b) => b.textContent === name,
	);

/** Today pinned to 2026-10-06, the sixth day of a sprint running 1–14 October. */
function pinToday(): void {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
}

describe('the iteration header', () => {
	it('names the sprint under a kicker', () => {
		const { containerEl } = onSprint();
		expect(containerEl.querySelector('h2.pbl-iteration-name')?.textContent).toBe('Sprint 12');
		expect(containerEl.querySelector('.pbl-iteration-kicker')?.textContent).toBe('Iteration');
	});

	it('states the goal, and draws no goal line when there is none', () => {
		const goal = onSprint().containerEl.querySelector('.pbl-iteration-goal');
		expect(goal?.textContent).toBe('Ship the importer');
		const blank = onSprint(sprintVault({ goal: '  ' })).containerEl;
		expect(headerOf(blank)).not.toBeNull();
		expect(blank.querySelector('.pbl-iteration-goal')).toBeNull();
		expect(blank.querySelector('.pbl-iteration-goal-label')).toBeNull();
	});

	it('says which day of a running sprint it is, and how many are left', () => {
		pinToday();
		const when = whenOf(onSprint(sprintVault({ start: '2026-10-01', due: '2026-10-14' })).containerEl);
		expect(when?.textContent).toContain('Day 6 of 14');
		expect(when?.textContent).toContain('8 days left');
	});

	it('says how long ago an ended sprint ended', () => {
		pinToday();
		const when = whenOf(onSprint(sprintVault({ start: '2026-09-21', due: '2026-10-04' })).containerEl);
		expect(when?.textContent).toContain('Ended 2 days ago');
	});

	it('draws no timebox when the sprint states no dates', () => {
		expect(whenOf(onSprint().containerEl)).toBeNull();
	});

	it('counts progress over the sprint, never over a context row', () => {
		// `Feature` is Done and excluded: counted, it would read 2 of 4.
		const progress = onSprint().containerEl.querySelector('.pbl-iteration-progress');
		expect(progress?.textContent).toBe('1 of 3 resolved');
	});

	it('leaves progress unchanged by a folded column', () => {
		const { view, containerEl } = onSprint();
		expect(cardTitles(columnByName(containerEl, 'Resolved'))).not.toEqual([]);
		view.setColumnCollapsed('iteration', 'resolved', true);
		// The fold drew: Resolved shows no card, and the count still reads the population.
		expect(cardTitles(columnByName(containerEl, 'Resolved'))).toEqual([]);
		expect(containerEl.querySelector('.pbl-iteration-progress')?.textContent).toBe('1 of 3 resolved');
	});

	it('hides the shelf for the daily and shows it again for planning', () => {
		const { view, containerEl } = onSprint();
		expect(shelfOf(containerEl)).not.toBeNull();

		modeButton(containerEl, 'Daily')?.click();
		expect(view.iterationDaily).toBe(true);
		expect(shelfOf(containerEl)).toBeNull();
		expect(modeButton(containerEl, 'Daily')?.getAttribute('aria-pressed')).toBe('true');
		expect(modeButton(containerEl, 'Planning')?.getAttribute('aria-pressed')).toBe('false');
		// The render replaced the button that was pressed; focus follows to its replacement.
		expect(containerEl.ownerDocument.activeElement).toBe(modeButton(containerEl, 'Daily'));

		modeButton(containerEl, 'Planning')?.click();
		expect(shelfOf(containerEl)).not.toBeNull();
		expect(modeButton(containerEl, 'Planning')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('is not drawn on the product board', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		expect(headerOf(harness.containerEl)).toBeNull();
	});
});
