import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { releaseDescriptionWrites, releaseStatusWrites } from '../../src/domain/releaseWritePlan';

/**
 * What editing a release's own fields would write ([[Editing a release from its own
 * screen]]) — a node test, because the whole subject is a decision rather than a screen:
 * these two functions read no vault, touch no DOM and answer with a batch or with nothing.
 *
 * The three ways of answering NOTHING are what most of this file is about. Two of them are
 * unreachable from the controls on screen — the view withholds a Clear where there is
 * nothing to clear, and draws neither control where the key is unbound — so the plan is
 * where they can be asked at all, and asking them here is what keeps the rule true for a
 * caller nobody has written yet.
 */

const file = { path: 'R.md', basename: 'R' } as TFile;

describe('planning a release status', () => {
	it('sets the key it is given', () => {
		expect(releaseStatusWrites(file, 'status', null, 'Released')).toEqual([
			{ file, sets: [{ key: 'status', value: 'Released' }] },
		]);
	});

	it('writes nothing for the value the note already holds, case-insensitively', () => {
		expect(releaseStatusWrites(file, 'status', 'planned', 'Planned')).toEqual([]);
		// And a DIFFERENT value still writes — or the rule above would be "writes nothing".
		expect(releaseStatusWrites(file, 'status', 'planned', 'Cut')).toHaveLength(1);
	});

	it('removes the key rather than blanking it, and writes nothing when there is nothing to remove', () => {
		expect(releaseStatusWrites(file, 'status', 'Planned', null)).toEqual([
			{ file, sets: [{ key: 'status', value: null }] },
		]);
		expect(releaseStatusWrites(file, 'status', null, null)).toEqual([]);
	});

	it('writes nothing at all where the key is unconfigured', () => {
		// The rule `applyPropertyWrites` also keeps at the writer, asked here so a plan never
		// CLAIMS a write the writer would drop.
		expect(releaseStatusWrites(file, '', null, 'Released')).toEqual([]);
	});
});

describe('planning a release description', () => {
	it('trims the entry and sets it', () => {
		expect(releaseDescriptionWrites(file, 'description', null, '  The billing rewrite. ')).toEqual([
			{ file, sets: [{ key: 'description', value: 'The billing rewrite.' }] },
		]);
	});

	it('compares EXACTLY, where the status compares case-insensitively', () => {
		// A label and prose are different things: `Fix the typo` and `fix the typo` are one
		// status and two descriptions.
		expect(releaseDescriptionWrites(file, 'description', 'Fix the typo', 'Fix the typo')).toEqual([]);
		expect(releaseDescriptionWrites(file, 'description', 'Fix the typo', 'fix the typo')).toHaveLength(1);
	});

	it('clears the key for a box emptied or holding only spaces, and writes nothing when it was already empty', () => {
		expect(releaseDescriptionWrites(file, 'description', 'Something.', '   ')).toEqual([
			{ file, sets: [{ key: 'description', value: null }] },
		]);
		expect(releaseDescriptionWrites(file, 'description', null, '')).toEqual([]);
	});

	it('writes nothing at all where the key is unconfigured', () => {
		expect(releaseDescriptionWrites(file, '', null, 'Anything')).toEqual([]);
	});
});
