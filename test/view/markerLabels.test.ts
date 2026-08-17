// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The marker row's three surfaces — the lane caption, the legend swatch and the
 * announced sentence — naming what they actually draw (Milestone, Iteration, or
 * both) instead of a fixed "Milestone" word. Split out of `roadmap.test.ts`, which
 * is already near the per-file test line budget (`test/CLAUDE.md`).
 */
const MARKER_OPTIONS = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	iterationProperty: 'note.iteration',
};

function markerVault(kinds: ('milestone' | 'iteration')[]): FakeVault {
	const vault = new FakeVault();
	vault.addFile('An epic.md', { frontmatter: { type: 'Epic', order: 1, start: '2026-09-01', due: '2026-10-15' } });
	if (kinds.includes('milestone')) {
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-09-30' } });
	}
	if (kinds.includes('iteration')) {
		vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', order: 20, start: '2026-09-07', due: '2026-09-20' },
		});
	}
	return vault;
}

function datedAxis(vault: FakeVault, extra: Record<string, unknown> = {}) {
	const harness = makeView(vault, { ...MARKER_OPTIONS, ...extra }, { base: 'Plan.base' });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('dates');
	return harness;
}

describe('the marker surfaces name what is drawn', () => {
	const caption = (el: HTMLElement) => el.querySelector('.pbl-lane-head .pbl-lane-name')?.textContent;
	const swatchLabel = (el: HTMLElement) =>
		el.querySelector('.pbl-legend-swatch.pbl-legend-milestone')?.parentElement?.querySelector('.pbl-legend-label')
			?.textContent;

	it('captions the marker lane by its contents', () => {
		// Milestone-only vaults see no change — the user accepted truncation, not renaming.
		expect(caption(datedAxis(markerVault(['milestone'])).containerEl)).toBe('Milestones');
		expect(caption(datedAxis(markerVault(['iteration'])).containerEl)).toBe('Iterations');
		expect(caption(datedAxis(markerVault(['milestone', 'iteration'])).containerEl)).toBe('Milestones · Iterations');
	});

	it('captions the cyan legend swatch the same three ways', () => {
		expect(swatchLabel(datedAxis(markerVault(['milestone'])).containerEl)).toBe('Milestone');
		expect(swatchLabel(datedAxis(markerVault(['iteration'])).containerEl)).toBe('Iteration');
		expect(swatchLabel(datedAxis(markerVault(['milestone', 'iteration'])).containerEl)).toBe('Milestone · Iteration');
	});

	it('announces a point by its own type, never the literal Milestone', () => {
		// Asserted on the string a screen reader receives, per the PBI's criterion.
		const both = datedAxis(markerVault(['milestone', 'iteration'])).containerEl;
		const sentences = Array.from(both.querySelectorAll('.pbl-lane-head .pbl-bar .pbl-sr-only')).map(
			(el) => el.textContent ?? '',
		);
		expect(sentences.some((s) => s.startsWith('Sprint 12 — Iteration 2026-09-20'))).toBe(true);
		expect(sentences.some((s) => s.startsWith('Ship 1.0 — Milestone 2026-09-30'))).toBe(true);
		expect(sentences.some((s) => s.includes('Sprint 12 — Milestone'))).toBe(false);
	});
});
