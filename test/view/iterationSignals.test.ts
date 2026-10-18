// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';
import { makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * What an iteration-board card says needs talking about at the stand-up: Blocked, Overdue,
 * its risk and its priority. Text, never controls — and only on THIS board.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
	dependsOnProperty: 'note.dependsOn',
	targetProperty: 'note.due',
	riskProperty: 'note.risk',
	riskValues: 'Low, High',
	priorityProperty: 'note.priority',
	priorityValues: 'Must, Could',
};

const SPRINT = 'Sprint 12.md';
const IN = '[[Sprint 12]]';

function sprintVault(waiting: Record<string, unknown> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Feature.md', {
		frontmatter: { type: 'Feature', order: 5, status: 'Doing', risk: 'High', priority: 'Must', due: '2026-10-01' },
	});
	vault.addFile('Prereq.md', { frontmatter: { type: 'PBI', order: 10, status: 'Doing', iteration: IN } });
	vault.addFile('Waiting.md', {
		frontmatter: { type: 'PBI', order: 20, status: 'New', iteration: IN, dependsOn: 'Prereq', ...waiting },
	});
	vault.addFile('Finished.md', {
		frontmatter: {
			type: 'PBI',
			order: 30,
			status: 'Done',
			iteration: IN,
			dependsOn: 'Prereq',
			due: '2026-10-01',
			risk: 'High',
			priority: 'Must',
		},
		parentLink: 'Feature',
	});
	return vault;
}

function onSprint(vault = sprintVault(), options: Record<string, unknown> = OPTIONS) {
	const harness = makeView(vault, options, { base: 'Plan.base', except: ['Feature.md'] });
	harness.view.setBoardScope(SPRINT);
	return harness;
}

const signalsOf = (card: HTMLElement) => card.querySelector<HTMLElement>('.pbl-card-signals');
const signal = (card: HTMLElement, kind: string) => card.querySelector<HTMLElement>(`.pbl-signal-${kind}`);

describe('iteration card signals', () => {
	it('says Blocked, naming the prerequisite that is not resolved', () => {
		const card = cardByTitle(onSprint().containerEl, 'Waiting');
		const blocked = signal(card, 'blocked');
		expect(blocked?.textContent).toBe('Blocked');
		expect(blocked?.dataset.tooltip).toBe('Waiting for Prereq');
		expect(blocked?.querySelector('[data-icon="lock"]')).not.toBeNull();
	});

	it('is not blocked once the prerequisite is resolved', () => {
		const vault = sprintVault();
		vault.addFile('Prereq.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done', iteration: IN } });
		expect(signalsOf(cardByTitle(onSprint(vault).containerEl, 'Waiting'))).toBeNull();
	});

	it('counts the days past the target against the view clock', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
		const late = cardByTitle(onSprint(sprintVault({ due: '2026-10-05' })).containerEl, 'Waiting');
		expect(signal(late, 'overdue')?.textContent).toBe('Overdue 1 day');
		const later = cardByTitle(onSprint(sprintVault({ due: '2026-10-01' })).containerEl, 'Waiting');
		expect(signal(later, 'overdue')?.textContent).toBe('Overdue 5 days');
		const onTime = cardByTitle(onSprint(sprintVault({ due: '2026-10-06' })).containerEl, 'Waiting');
		expect(signal(onTime, 'overdue')).toBeNull();
	});

	it('draws risk and priority as the item’s own values, in order after the flags', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
		const card = cardByTitle(
			onSprint(sprintVault({ due: '2026-10-01', risk: 'High', priority: 'Must' })).containerEl,
			'Waiting',
		);
		const kinds = Array.from(signalsOf(card)!.children).map((el) => el.className);
		expect(kinds).toEqual([
			'pbl-signal pbl-signal-blocked',
			'pbl-signal pbl-signal-overdue',
			'pbl-signal pbl-signal-risk',
			'pbl-signal pbl-signal-priority',
		]);
		expect(signal(card, 'risk')?.textContent).toBe('High');
		expect(signal(card, 'risk')?.dataset.tooltip).toBe('Risk: High');
		expect(signal(card, 'priority')?.textContent).toBe('Must');
		expect(signal(card, 'priority')?.dataset.tooltip).toBe('Priority: Must');
	});

	it('is text, never a control', () => {
		const card = cardByTitle(onSprint(sprintVault({ risk: 'High' })).containerEl, 'Waiting');
		expect(signalsOf(card)!.querySelector('button, [tabindex], a, input')).toBeNull();
	});

	it('draws no risk or priority without a configured property, or with a blank value', () => {
		const unconfigured = { ...OPTIONS, riskProperty: '', priorityProperty: '' };
		const card = cardByTitle(
			onSprint(sprintVault({ risk: 'High', priority: 'Must' }), unconfigured).containerEl,
			'Waiting',
		);
		expect(signal(card, 'risk')).toBeNull();
		expect(signal(card, 'priority')).toBeNull();
		const blank = cardByTitle(onSprint(sprintVault({ risk: '  ', priority: '' })).containerEl, 'Waiting');
		expect(signal(blank, 'risk')).toBeNull();
		expect(signal(blank, 'priority')).toBeNull();
	});

	it('says nothing on a resolved card, whatever it carries', () => {
		expect(signalsOf(cardByTitle(onSprint().containerEl, 'Finished'))).toBeNull();
	});

	it('says nothing on a context card', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
		const card = cardByTitle(onSprint().containerEl, 'Feature');
		expect(card.classList.contains('pbl-card-context')).toBe(true);
		expect(signalsOf(card)).toBeNull();
	});

	it('is the iteration board’s alone: the product board draws none for the same item', () => {
		const { view, containerEl } = onSprint(sprintVault({ risk: 'High', priority: 'Must' }));
		expect(signalsOf(cardByTitle(containerEl, 'Waiting'))).not.toBeNull();
		view.setBoardScope(null);
		expect(signalsOf(cardByTitle(containerEl, 'Waiting'))).toBeNull();
	});
});
