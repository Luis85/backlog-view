// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';
import { useViewHarness } from '../helpers/view';
import { bucketByName, roadmapView } from '../helpers/roadmap';

useViewHarness();

/**
 * The horizon board draws the iteration card's signals minus Overdue (ADR 0027, second
 * 2026-10-18 amendment) — and the grid axes, whose items are timeline rows, draw none.
 */
const OPTIONS = {
	horizonProperty: 'note.horizon',
	startProperty: 'note.start',
	targetProperty: 'note.due',
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	dependsOnProperty: 'note.dependsOn',
	riskProperty: 'note.risk',
	riskValues: 'Low, High',
	priorityProperty: 'note.priority',
	priorityValues: 'Must, Could',
};

function vault(): FakeVault {
	const v = new FakeVault();
	v.addFile('Prereq.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing', horizon: 'Next', risk: 'Low' } });
	v.addFile('Waiting.md', {
		frontmatter: {
			type: 'Epic',
			order: 20,
			status: 'New',
			horizon: 'Now',
			dependsOn: 'Prereq',
			start: '2026-09-01',
			due: '2026-10-01',
			risk: 'High',
			priority: 'Must',
		},
	});
	return v;
}

const signal = (card: HTMLElement, kind: string) => card.querySelector<HTMLElement>(`.pbl-signal-${kind}`);

describe('horizon card signals', () => {
	it('draws blocked, risk and priority on a bucket card, and no overdue', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
		const { containerEl } = roadmapView(vault(), OPTIONS);
		const card = cardByTitle(bucketByName(containerEl, 'Now'), 'Waiting');
		expect(signal(card, 'blocked')?.dataset.tooltip).toBe('Waiting for Prereq');
		expect(signal(card, 'risk')?.textContent).toBe('High');
		expect(signal(card, 'priority')?.textContent).toBe('Must');
		// Five days past its target, and still no overdue: a horizon is not a date.
		expect(signal(card, 'overdue')).toBeNull();
	});

	it('draws none on the dated axis, whose items are timeline rows', () => {
		const { view, containerEl } = roadmapView(vault(), OPTIONS);
		view.setAxisPick('dates');
		expect(containerEl.querySelector('.pbl-timeline-row')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-card-signals')).toBeNull();
	});
});
