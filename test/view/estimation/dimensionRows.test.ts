// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView, selectItem } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

/**
 * The shape of one `.pbl-est-dim` row — the head line (label, points, clear control) and
 * the rubric note beside it, not inside it. `panel.test.ts` covers what the panel STATES;
 * this file covers how one row is BUILT, which is its own subject (Task 6).
 */

/** `panel.test.ts`'s own full profile (8 of 8 dimensions, total 3.55), so a selected row
 *  has a held value, a stored key and something to clear. */
function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', {
		frontmatter: {
			'strategic-alignment': 5,
			'customer-value': 4,
			'business-impact': 4,
			reach: 3,
			'risk-reduction': 2,
			compliance: 1,
			'time-criticality': 4,
			enablement: 3,
			confidence: 2,
		},
	});
	vault.addFile('Empty.md');
	return vault;
}

describe('a dimension row', () => {
	it('puts a row label, its points and its clear control on one line, with the rubric under', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const dim = containerEl.querySelector('.pbl-est-dim')!;
		const head = dim.querySelector(':scope > .pbl-est-dim-head')!;
		expect(head.querySelector(':scope > .pbl-est-dim-label')).not.toBeNull();
		expect(head.querySelector(':scope > .pbl-est-points')).not.toBeNull();
		expect(head.querySelector(':scope > .pbl-est-clear')).not.toBeNull();
		// The rubric sentence stays visible and stays on its own line. Moving it to hover is
		// forbidden by `docs/requirements/A rubric for every point.md`: a row with an answer is
		// never silent about it.
		expect(dim.querySelector(':scope > .pbl-est-rubric')).not.toBeNull();
	});

	it('keeps the clear control OUT of the points group', () => {
		// Inside it, it is a sixth arrow-key stop on a five-point scale (Task 7's radiogroup).
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const points = containerEl.querySelector('.pbl-est-points')!;
		expect(points.querySelector('.pbl-est-clear')).toBeNull();
	});

	it('draws no clear control for a row holding nothing', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Empty.md');
		expect(containerEl.querySelector('.pbl-est-clear')).toBeNull();
	});
});
