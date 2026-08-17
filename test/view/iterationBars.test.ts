// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, refresh, useViewHarness } from '../helpers/view';
import { labelTexts, markFor } from '../helpers/roadmap';

useViewHarness();

/**
 * Bar mode's drawing and write-narrowing — the option (`iterationBars`, "Draw
 * iterations as bars") that turns an Iteration from a point in the marker row
 * (`drawsAsPoint`, Task 1) into a start→target bar there, with no boundary line and
 * a grip per configured end.
 *
 * Its own file rather than `roadmap.test.ts` or `markerLabels.test.ts`, both near the
 * per-file test line budget (`test/CLAUDE.md`). The fixtures below are Task 3's
 * `markerVault`/`datedAxis`, copied rather than imported — no `test/view/*.test.ts`
 * file imports another's fixtures, and `markerLabels.test.ts`'s own duplication of
 * `roadmap.test.ts`'s AXES/vault shape is the precedent this follows.
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
	// `vault` rides along beside the harness's own fields — the fourth test below needs
	// it for `writeLog`, which `Harness` itself does not carry.
	return { ...harness, vault };
}

describe('an iteration draws as a bar while the option is on', () => {
	it('draws a start→target bar in the marker row and no boundary line', () => {
		const el = datedAxis(markerVault(['milestone', 'iteration']), { iterationBars: true }).containerEl;
		const mark = markFor(el, 'Sprint 12');
		expect(mark.classList.contains('pbl-bar-milestone')).toBe(false);
		// The milestone's own line still draws; the sprint gets none and no header label.
		expect(el.querySelectorAll('.pbl-milestone-line').length).toBe(1);
		expect(labelTexts(el).some((label) => label.includes('Sprint 12'))).toBe(false);
	});

	it('draws a line and a diamond while the option is off — the default', () => {
		const el = datedAxis(markerVault(['milestone', 'iteration'])).containerEl;
		expect(markFor(el, 'Sprint 12').classList.contains('pbl-bar-milestone')).toBe(true);
		expect(el.querySelectorAll('.pbl-milestone-line').length).toBe(2);
		expect(labelTexts(el).some((label) => label.includes('Sprint 12'))).toBe(true);
	});

	it('gives the bar a grip per configured end, and none for an unconfigured key', () => {
		const both = datedAxis(markerVault(['iteration']), { iterationBars: true }).containerEl;
		expect(markFor(both, 'Sprint 12').querySelector('.pbl-bar-grip-start')).not.toBeNull();
		expect(markFor(both, 'Sprint 12').querySelector('.pbl-bar-grip-end')).not.toBeNull();
		// The type decides drawable, the configuration writable: no start property, no
		// start grip, and the end grip survives.
		const noStart = datedAxis(markerVault(['iteration']), { iterationBars: true, startProperty: '' }).containerEl;
		expect(markFor(noStart, 'Sprint 12').querySelector('.pbl-bar-grip-start')).toBeNull();
		expect(markFor(noStart, 'Sprint 12').querySelector('.pbl-bar-grip-end')).not.toBeNull();
	});

	it('changing the option rewrites nothing on any note', () => {
		const harness = datedAxis(markerVault(['milestone', 'iteration']));
		harness.vault.writeLog.length = 0;
		// The option is a `.base` setting; flipping it re-renders and touches no note.
		harness.view.config.set('iterationBars', true);
		refresh(harness.view, harness.vault);
		expect(harness.vault.writeLog).toEqual([]);
	});
});
