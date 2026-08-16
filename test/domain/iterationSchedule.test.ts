import { describe, expect, it } from 'vitest';
import { nextIterationDates, previousIteration } from '../../src/domain/iterations';
import { CivilDate } from '../../src/domain/noteFields';
import { buildModel } from '../../src/domain/model';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * Where the NEXT iteration falls: which one it follows, and the span it takes. Every
 * value here is a prefill — the dialog writes what the reader confirmed — so what is
 * checked is the derivation and never a write.
 */
const settings = resolveSettings(
	new FakeViewConfig({ startProperty: 'note.start', targetProperty: 'note.due' }) as never,
);

/** A civil date from the spelling a test reads best. */
function civil(text: string): CivilDate {
	const [year, month, day] = text.split('-').map(Number);
	return { year, month, day };
}

/** Iterations by path, each with whatever ends the case needs. */
function iterations(spec: Record<string, { start?: string; due?: string }>) {
	const vault = new FakeVault();
	let order = 10;
	for (const [path, ends] of Object.entries(spec)) {
		vault.addFile(path, { frontmatter: { type: 'Iteration', order: (order += 10), ...ends } });
	}
	// `byPath`, not `results`: an `Iteration` is not a row of the plan, so the plan's
	// population no longer holds one — which is exactly why the caller reads the same
	// focus-immune set the scope picker does.
	return [...buildModel(vault.app, vault.entries(), settings).byPath.values()];
}

describe('previousIteration', () => {
	it('follows the iteration that ends latest, not the one on screen', () => {
		// Not the chosen scope: creating from Sprint 8 while Sprint 12 exists would
		// silently make an iteration overlapping every sprint between them.
		const found = previousIteration(
			iterations({
				'Sprint 8.md': { start: '2026-06-01', due: '2026-06-14' },
				'Sprint 12.md': { start: '2026-08-03', due: '2026-08-16' },
			}),
		);
		expect(found?.title).toBe('Sprint 12');
	});

	it('breaks a tie on target by start, then by path', () => {
		// Total, so the answer cannot depend on the order the vault happened to load in.
		const sameEnd = { due: '2026-08-16' };
		expect(
			previousIteration(
				iterations({ 'A.md': { ...sameEnd, start: '2026-08-01' }, 'B.md': { ...sameEnd, start: '2026-08-03' } }),
			)?.title,
		).toBe('B');
		expect(previousIteration(iterations({ 'B.md': sameEnd, 'A.md': sameEnd }))?.title).toBe('B');
	});

	it('follows a predecessor that has a target and no start', () => {
		expect(previousIteration(iterations({ 'Sprint 12.md': { due: '2026-08-16' } }))?.title).toBe('Sprint 12');
	});

	it('answers nothing when no iteration carries a target', () => {
		expect(previousIteration(iterations({ 'Undated.md': {} }))).toBeNull();
		expect(previousIteration([])).toBeNull();
	});

	it('never follows a note that is not an Iteration', () => {
		const vault = new FakeVault();
		vault.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-12-31' } });
		expect(previousIteration([...buildModel(vault.app, vault.entries(), settings).byPath.values()])).toBeNull();
	});
});

describe('nextIterationDates', () => {
	it('makes an inclusive span: 14 days from a Monday ends the second Sunday', () => {
		expect(nextIterationDates(null, civil('2026-09-07'), 14)).toEqual({ start: '2026-09-07', target: '2026-09-20' });
	});

	it('starts today when there is no dated predecessor', () => {
		expect(nextIterationDates(null, civil('2026-08-16'), 7).start).toBe('2026-08-16');
	});

	it('abuts rather than overlaps: start is the previous target plus one day', () => {
		const previous = previousIteration(iterations({ 'Sprint 12.md': { start: '2026-08-03', due: '2026-08-16' } }));
		expect(nextIterationDates(previous, civil('2026-08-16'), 14)).toEqual({ start: '2026-08-17', target: '2026-08-30' });
	});

	it('runs a one-day iteration from its own start', () => {
		expect(nextIterationDates(null, civil('2026-09-07'), 1)).toEqual({ start: '2026-09-07', target: '2026-09-07' });
	});
});
