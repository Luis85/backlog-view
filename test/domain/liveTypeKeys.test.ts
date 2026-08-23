// `mayHoldField` (`src/domain/itemTypes.ts`) is the one statement of "may a note of this
// type hold this optional property" — asked at both doors a planning key reaches a note
// through. This file drives the new `release` field's own rule, and the control every
// EXISTING field's answer must survive it byte-identical: `mayHoldField` carries a
// warning against widening it, and the release field's clause is the one exception this
// task is allowed to add.
import { describe, expect, it } from 'vitest';
import { mayHoldField } from '../../src/domain/itemTypes';
import { settingsWith } from '../helpers/settings';

describe('which types may hold a release', () => {
	it('refuses every marker and admits plan work', () => {
		const settings = settingsWith({ releaseKey: 'release' });
		// A release holds WORK, and a marker is not work — the reader already refuses
		// such a note; this is the same rule at the writing end.
		for (const marker of ['Milestone', 'Iteration', 'Release']) {
			expect(mayHoldField(marker, 'release', settings)).toBe(false);
		}
		for (const work of ['Epic', 'Feature', 'PBI', 'Task']) {
			expect(mayHoldField(work, 'release', settings)).toBe(true);
		}
	});

	it("leaves every other field's answer exactly as it was", () => {
		const settings = settingsWith({ releaseKey: 'release' });
		// The guard this task edits carries a warning against widening it. These are the
		// shipped answers; none of them may move.
		expect(mayHoldField('Release', 'horizon', settings)).toBe(false);
		expect(mayHoldField('Release', 'iteration', settings)).toBe(false);
		expect(mayHoldField('Milestone', 'horizon', settings)).toBe(true);
		expect(mayHoldField('Iteration', 'start', settings)).toBe(true);
	});
});
