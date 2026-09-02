// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { refresh, useViewHarness } from '../helpers/view';
import { datedAxis, labelTexts, markerVault, markFor } from '../helpers/roadmap';

useViewHarness();

/**
 * Bar mode's drawing and write-narrowing — the option (`iterationBars`, "Draw
 * iterations as bars") that turns an Iteration from a point in the marker row
 * (`drawsAsPoint`, Task 1) into a start→target bar there, with no boundary line and
 * a grip per configured end.
 *
 * Its own file rather than `roadmap.test.ts` or `markerLabels.test.ts`, both near the
 * per-file test line budget (`test/CLAUDE.md`). `markerVault` and `datedAxis` come from
 * `test/helpers/roadmap.ts`: they were copied here and into `markerLabels.test.ts` on the
 * rule that no `test/view/*.test.ts` file imports another's fixtures — which is the right
 * rule, and a helper is how two suites share one without either reaching into the other.
 */

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
