import { describe, expect, it } from 'vitest';
import { configProblems } from '../../src/domain/settingsConsistency';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { optionalKeyFor } from '../../src/domain/optionalProperties';

/**
 * What an iterations vault configures: the two properties an item and an iteration
 * carry, and the three options the iteration board narrows the PRODUCT workflow with.
 * Split out of `settings.test.ts` when that file reached its line budget — one subject
 * per file is the rule the budget exists to force, and this is the subject that was
 * still growing.
 */

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return {
		get: (key: string) => values[key],
		getAsPropertyId: (key: string) => {
			const v = values[key];
			return typeof v === 'string' && v.includes('.') ? v : null;
		},
	} as never;
}

describe('resolveSettings — the two iteration properties', () => {
	// The link and its goal resolve the same way, so one table of cases drives the three
	// behaviours both share rather than two blocks restating them.
	const cases = [
		{ option: 'iterationProperty', field: 'iteration', settingsKey: 'iterationKey', label: 'iteration' },
		{ option: 'iterationGoalProperty', field: 'iterationGoal', settingsKey: 'iterationGoalKey', label: 'iteration goal' },
	] as const;

	it.each(cases)('resolves $option into its own key', ({ option, field, settingsKey }) => {
		const settings = resolveSettings(fakeConfig({ [option]: 'note.x' }));
		expect(settings[settingsKey]).toBe('x');
		expect(optionalKeyFor(settings, field)).toBe('x');
	});

	it.each(cases)('leaves $settingsKey empty when nothing names it', ({ field, settingsKey }) => {
		const settings = resolveSettings(fakeConfig({}));
		expect(settings[settingsKey]).toBe('');
		expect(optionalKeyFor(settings, field)).toBe('');
	});

	it.each(cases)('refuses a $label key that collides with a key this view owns', ({ option, label }) => {
		const problems = configProblems(
			resolveSettings(fakeConfig({ [option]: 'note.status', stateProperty: 'note.status' })),
		);
		expect(problems.join(' ')).toContain(label);
	});
});

describe('resolveSettings — the iteration board options', () => {
	it('parses the iteration length, falling back to 14 on anything unusable', () => {
		expect(resolveSettings(fakeConfig({ iterationLengthDays: '21' })).iterationLengthDays).toBe(21);
		// `7.5` is here deliberately: a fraction is not a number of days, and rounding one
		// silently would be a decision the reader cannot see. `0` and `-3` matter more —
		// either yields a target BEFORE its start, which shelves the new iteration with the
		// reversed-span reason for a value nobody meant to type.
		for (const bad of ['', 'two weeks', '0', '-3', '7.5']) {
			expect(resolveSettings(fakeConfig({ iterationLengthDays: bad })).iterationLengthDays).toBe(14);
		}
	});

	it('reads the two bucket lists, defaulting both to empty', () => {
		const s = resolveSettings(fakeConfig({ iterationOpenStates: 'New, Ready', iterationResolvedStates: 'In review' }));
		expect(s.iterationOpenStates).toEqual(['New', 'Ready']);
		expect(s.iterationResolvedStates).toEqual(['In review']);
		expect(resolveSettings(fakeConfig({})).iterationOpenStates).toEqual([]);
		expect(resolveSettings(fakeConfig({})).iterationResolvedStates).toEqual([]);
	});
});
