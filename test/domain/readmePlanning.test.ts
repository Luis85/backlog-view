import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { backlogReadmeContent } from '../../src/domain/backlogReadme';
import { MARKER_TYPES } from '../../src/domain/typeVocabulary';
import { placementEnds } from '../../src/domain/itemTypes';

/**
 * The generated README's **Planning** section (`src/domain/readmePlanning.ts`): which types
 * this view places, which it places on neither axis, and that both lists are DERIVED from
 * the placement rules rather than spelled.
 *
 * Split out of `backlogReadme.test.ts` by subject, following the module split and the
 * `test/` line budget that forced it. These two are the pair that has to be asked from the
 * RULE rather than from the sentence: a check re-spelled to match new output is what let a
 * marker's prose ship false once already, and it is checked through the whole document
 * (`backlogReadmeContent`) rather than through the section, because what a reader gets is
 * the document.
 */

const SOURCE = 'work/Product Backlog.base › Backlog';
const readme = (settings: BacklogSettings, observed: string[] = []): string =>
	backlogReadmeContent(settings, observed, SOURCE);

describe('the Planning section names types by the placement rule', () => {
	it('names in the marker sentence exactly the markers this view places at one date', () => {
		// The generated document is a contract with editors outside Obsidian, and the
		// sentences above it describe a point reached by how many dates an item STATES. A
		// marker is a point by TYPE: `placeMarker` reads the target key alone, so a
		// start-only view shelves whatever it states — and `canSchedule` withholds the entry
		// that would fix it.
		//
		// WHICH markers, though, is `placementEnds`' answer and not the classification's,
		// and this test is written from the rule for that reason: the sentence used to list
		// `MARKER_TYPES`, so declaring a third marker published two sentences that were
		// false for it to every reader at once — a release reads neither key and does not
		// wait for one, because it speaks no end at any mapping. Re-spelling the assertion
		// is what let that through, so nothing here spells the list. Both branches and both
		// readings of `iterationBars`, since an `Iteration` is target-only in exactly one of
		// them and is the marker the classification already got wrong before `Release`.
		const markerLine = (text: string) => text.split('\n').find((l) => l.startsWith('A **marker**')) ?? '';
		for (const iterationBars of [false, true]) {
			const startOnly = readme(settingsWith({ startKey: 'start', targetKey: '', horizonKey: '', iterationBars }), []);
			const both = readme(settingsWith({ startKey: 'start', targetKey: 'due', horizonKey: '', iterationBars }), []);
			expect(markerLine(startOnly)).toContain('this view cannot place one');
			expect(startOnly).toContain('the only date property here is `start`');
			expect(markerLine(both)).toContain('it is a point by **type**');
			for (const marker of MARKER_TYPES) {
				const ends = placementEnds(marker, iterationBars);
				const point = ends.length === 1 && ends[0] === 'target';
				const named = `\`${marker}\``;
				expect(markerLine(startOnly).includes(named), `${marker}, bars=${iterationBars}`).toBe(point);
				expect(markerLine(both).includes(named), `${marker}, bars=${iterationBars}`).toBe(point);
			}
		}
	});

	it('says which types this plan does not place, rather than only omitting them', () => {
		// Removing a falsehood is not the same as saying the true thing. Dropping `Release`
		// out of the marker sentence stopped the README lying about it and left the generic
		// prose above telling a reader that a horizon places "an item" and that every item
		// stating the date is drawn — so somebody following that guide for a type this very
		// document lists gets no card, no chip and no menu entry, with nothing explaining it.
		//
		// Derived from the same rule the marker sentence uses, and asked the same way: a type
		// is named here exactly when `placementEnds` gives it no end at all. Nothing spells a
		// list, so the next such type is documented by arriving.
		//
		// Per CONFIGURATION, because the clause naming the axes is built from the same two
		// predicates every neighbouring sentence is. Fixed text saying "these dates or a
		// horizon" would point at dates a horizon-only base does not configure and name a
		// horizon a dated base has no axis for — prose asserting what the configuration does
		// not support, which is the defect this whole paragraph exists to fix.
		const dated = { startKey: 'start', targetKey: 'due', horizonKey: '', horizonValues: [] };
		const bucketed = { startKey: '', targetKey: '', horizonKey: 'horizon', horizonValues: ['Now'] };
		const both = { ...dated, horizonKey: 'horizon', horizonValues: ['Now'] };
		const lineOf = (cfg: Partial<BacklogSettings>) =>
			readme(settingsWith(cfg), [])
				.split('\n')
				.find((l) => l.includes('outside all of that')) ?? '';

		for (const cfg of [dated, bucketed, both]) {
			const line = lineOf(cfg);
			for (const marker of MARKER_TYPES) {
				const speaks = placementEnds(marker, false).length > 0;
				expect(line.includes(`\`${marker}\``), marker).toBe(!speaks);
			}
			// And no promise of the deferred feature: nothing here may read as a date
			// property on its way, which is a decision this increment has not taken.
			expect(line).not.toMatch(/yet|coming|future|will be|not supported/i);
		}
		// Each names the axes this base HAS, and only those.
		expect(lineOf(both)).toContain('not placed by these dates or a horizon');
		expect(lineOf(dated)).toContain('not placed by these dates,');
		expect(lineOf(bucketed)).toContain('not placed by a horizon,');
	});
});

/**
 * The backfill sentence in the same section, which said the ✨ backfill "adds the keys
 * *empty* to items that lack them" with a `Milestone`'s start as the only exception. That
 * is FALSE for a `Release`: `missingKeyStubs` filters the whole vocabulary through
 * `mayHoldField`, which refuses a release's `start`, `target`, `horizon`, `iteration` and
 * `iterationGoal` alike, so a release gets no planning key stubbed at all — while the
 * paragraph above it already told the reader "there is nothing to fill in".
 *
 * Why the old derivation could not see it, which is the part worth pinning: the filter
 * asked `ends.length > 0 && !ends.includes('start')`, and `schemaEnds('Release')` is
 * EMPTY, so the first term dropped the type before the rule about starts was ever reached.
 */
describe('the backfill sentence excepts the types it stubs nothing on', () => {
	const lineOf = (over: Partial<BacklogSettings>): string =>
		readme(settingsWith(over), []).split('\n').find((l) => l.includes('**Assign missing properties**')) ?? '';

	it('says a Release gets no planning key at all, on every axis this section can name', () => {
		// The refusal is gated on no date key, unlike the start narrowing beside it, so all
		// three axis configurations are asked.
		for (const axis of [
			{ startKey: 'start', targetKey: 'due', horizonKey: '' },
			{ startKey: '', targetKey: 'due', horizonKey: '' },
			{ startKey: '', targetKey: '', horizonKey: 'horizon', horizonValues: ['Now'] },
		]) {
			const line = lineOf(axis);
			expect(line, JSON.stringify(axis)).toContain('a `Release` gets none of these keys at all');
			// Never the marker CATEGORY: an `Iteration` and a `Milestone` are both stubbed
			// keys here, so naming it would publish a falsehood about two types at once.
			expect(line, JSON.stringify(axis)).not.toContain('`Iteration`');
		}
	});

	it('states both exceptions where both apply, rather than one replacing the other', () => {
		const line = lineOf({ startKey: 'start', targetKey: 'due', horizonKey: '' });
		expect(line).toContain('a `Milestone` never gets a start added');
		expect(line).toContain('a `Release` gets none of these keys at all');
	});
});
