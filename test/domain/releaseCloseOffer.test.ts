import { describe, expect, it } from 'vitest';
import { closeOffer, releaseIndex, ReleaseRow } from '../../src/domain/releases';
import { ReleaseSettings } from '../../src/domain/releaseOptions';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';

/** Everything this action needs, bound. Each test unbinds ONE of them by name. */
const BOUND: Partial<ReleaseSettings> = {
	statusKey: 'status',
	releasedDateKey: 'released',
	releasedValues: ['Released'],
	releasedTransition: 'Released',
};

const TODAY: CivilDate = { year: 2026, month: 9, day: 20 };

/**
 * A real row, read out of a real note by `releaseIndex` — never a hand-built literal.
 * The figures this predicate reads carry three answers each, and only the reader decides
 * which one a value gets: a fixture that asserted `invalid: true` itself would pass on a
 * spelling `readLabel` calls absent.
 */
function rowOf(frontmatter: Record<string, unknown>, overrides: Partial<ReleaseSettings> = BOUND): ReleaseRow {
	const vault = new FakeVault();
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', ...frontmatter } });
	const settings = releaseSettingsWith(overrides);
	const model = buildModel(vault.app, vault.entries(), settingsWith({ stateKey: 'status' }));
	const rows = releaseIndex(vault.app, model, settings, { stateKey: 'status', today: TODAY }).rows;
	const found = rows.find((r) => r.path === '0.9.md');
	if (found === undefined) throw new Error('no row for 0.9.md');
	return found;
}

function offerFor(frontmatter: Record<string, unknown>, overrides: Partial<ReleaseSettings> = BOUND) {
	return closeOffer(rowOf(frontmatter, overrides), releaseSettingsWith(overrides));
}

describe('whether a release may be marked out', () => {
	it('offers it on a configured release with a status and no date', () => {
		expect(offerFor({ status: 'In progress' })).toEqual({ missing: [], unreadable: null, offered: true });
	});

	it('names each unbound option rather than only withholding the action', () => {
		// Extension 3a asks the screen to say WHICH option to bind. A boolean cannot.
		expect(offerFor({ status: 'In progress' }, { ...BOUND, releasedValues: [] }).missing)
			.toEqual(['releasedStatusValues']);
		expect(offerFor({ status: 'In progress' }, { ...BOUND, releasedDateKey: '' }).missing)
			.toEqual(['releasedDateProperty']);
		expect(offerFor({ status: 'In progress' }, { ...BOUND, statusKey: '' }).missing)
			.toEqual(['releaseStatusProperty']);
		expect(offerFor({ status: 'In progress' }, { ...BOUND, releasedTransition: '' }).missing)
			.toEqual(['releasedTransitionValue']);
	});

	it('withholds it when the release is already out', () => {
		// 1a: nothing to write, and nothing to record twice.
		expect(offerFor({ status: 'Released' }).offered).toBe(false);
	});

	// Both fields, one case: a clause added for one of them has twice been missed for the
	// other, so the check is over the category rather than per field.
	it.each([
		['status', { status: { a: 1 }, released: null }],
		['released', { status: 'In progress', released: '   ' }],
	])('withholds it when %s is present but unreadable', (field, frontmatter) => {
		const offer = offerFor(frontmatter);
		expect(offer.offered).toBe(false);
		expect(offer.unreadable).toBe(field);
	});

	it('withholds it when a date is already recorded', () => {
		// The compare-and-swap protects a date that ARRIVES later; this is the one that
		// was already there when the dialog opened, and it must not be replaced.
		expect(offerFor({ status: 'In progress', released: '2026-08-01' }).offered).toBe(false);
	});
});
