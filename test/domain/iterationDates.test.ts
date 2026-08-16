import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { computeIterationWrites } from '../../src/domain/writePlan';
import { FakeVault } from '../helpers/vault';

/**
 * `computeIterationWrites` — the link alone, for now (a later task in this plan adds the
 * two dates the iteration's own timeframe supplies, in the same batch). Its own file
 * because the two dated-axis suites already split by subject before a shared file
 * becomes the place tests hide.
 */

const settings = settingsWith({ iterationKey: 'iteration' });

/**
 * A PBI and a `Sprint 12` iteration note, built together so the PBI's own link (when
 * given) resolves against the SAME model the target item comes from — matching by path
 * is only a meaningful assertion when both sides are read off one build.
 */
function fixture(iteration?: string) {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });
	vault.addFile('PBI-1.md', {
		frontmatter: { type: 'PBI', order: 10, ...(iteration !== undefined ? { iteration } : {}) },
	});
	const model = buildModel(vault.app, vault.entries(), settings);
	return {
		pbi: model.byPath.get('PBI-1.md')!,
		sprint12: model.byPath.get('Sprint 12.md')!,
	};
}

describe('computeIterationWrites — the link', () => {
	it('plans the link when the item is not already in that iteration', () => {
		const { pbi, sprint12 } = fixture();
		expect(computeIterationWrites(pbi, sprint12, settings)).toEqual([
			{ file: pbi.file, iteration: sprint12.file },
		]);
	});

	it('plans nothing when the item is already in that iteration', () => {
		const { pbi, sprint12 } = fixture('[[Sprint 12]]');
		expect(computeIterationWrites(pbi, sprint12, settings)).toEqual([]);
	});

	it('plans a removal for None', () => {
		const { pbi } = fixture('[[Sprint 12]]');
		expect(computeIterationWrites(pbi, null, settings)).toEqual([{ file: pbi.file, iteration: null }]);
	});

	it('plans nothing at all when no iteration key is configured', () => {
		const { pbi, sprint12 } = fixture();
		expect(computeIterationWrites(pbi, sprint12, settingsWith({ iterationKey: '' }))).toEqual([]);
	});

	it('clears a link that resolved to nothing', () => {
		// Unresolved is not unset: an item holding a broken link must still be clearable.
		const { pbi } = fixture('[[Gone]]');
		expect(pbi.iterationEntry?.file).toBeNull();
		expect(computeIterationWrites(pbi, null, settings)).toEqual([{ file: pbi.file, iteration: null }]);
	});

	it('offers a removal for a key that failed to parse as a link at all — presence, not the parsed entry', () => {
		// `readLinkList` refuses a non-string value outright, so a hand-edited `iteration: 12`
		// reads as no ENTRY (`iterationEntry === null`) while the KEY is still visibly there on
		// the note. Asking the parsed entry for "is there something to clear" would report
		// nothing to remove on a note the reader can plainly see is not empty — the same
		// drift `computeAssigneeWrites` avoids by asking `ownKeys` instead of the reading.
		const vault = new FakeVault();
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, iteration: 12 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const pbi = model.byPath.get('PBI-1.md')!;

		expect(pbi.iterationEntry).toBeNull();
		expect(pbi.ownKeys.iteration).toBe(true);
		expect(computeIterationWrites(pbi, null, settings)).toEqual([{ file: pbi.file, iteration: null }]);
	});
});
