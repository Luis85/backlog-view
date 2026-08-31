import { describe, expect, it } from 'vitest';
import { closeOffer, closingFieldsMoved, releaseIndex, ReleaseRow } from '../../src/domain/releases';
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
function screenOf(
	frontmatter: Record<string, unknown>,
	overrides: Partial<ReleaseSettings> = BOUND,
): { row: ReleaseRow; vault: FakeVault } {
	const vault = new FakeVault();
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', ...frontmatter } });
	const settings = releaseSettingsWith(overrides);
	const model = buildModel(vault.app, vault.entries(), settingsWith({ stateKey: 'status' }));
	const rows = releaseIndex(vault.app, model, settings, { stateKey: 'status', today: TODAY }).rows;
	const found = rows.find((r) => r.path === '0.9.md');
	if (found === undefined) throw new Error('no row for 0.9.md');
	return { row: found, vault };
}

function rowOf(frontmatter: Record<string, unknown>, overrides: Partial<ReleaseSettings> = BOUND): ReleaseRow {
	return screenOf(frontmatter, overrides).row;
}

/** Edit the LIVE note without redrawing — Obsidian's metadata cache advancing ahead of the
 *  results Bases last handed the view, which is the whole of what `closingFieldsMoved`
 *  answers about. */
function editLiveNote(vault: FakeVault, changes: Record<string, unknown>): void {
	const cache = vault.caches.get('0.9.md');
	if (cache === undefined) throw new Error('no cache for 0.9.md');
	cache.frontmatter = { ...cache.frontmatter, ...changes };
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

describe('whether the note has moved past the row on screen', () => {
	const settings = releaseSettingsWith(BOUND);

	it('is not a move when nothing changed', () => {
		const { row, vault } = screenOf({ status: 'In progress', released: '2026-08-01' });
		expect(closingFieldsMoved(vault.app, row, settings)).toBe(false);
	});

	it('is not a move when the note was merely RESPELLED', () => {
		// Read through the same two readers the row was built with, never `===` on the raw
		// value: a date rewritten `2026-9-1` and a status retrimmed are the same answer, and
		// refusing an action over them would be a refusal the reader cannot act on.
		const { row, vault } = screenOf({ status: 'In progress', released: '2026-08-01' });
		editLiveNote(vault, { status: '  In progress  ', released: '2026-8-1' });
		expect(closingFieldsMoved(vault.app, row, settings)).toBe(false);
	});

	it('is a move when the status changed', () => {
		const { row, vault } = screenOf({ status: 'In progress' });
		editLiveNote(vault, { status: 'Released' });
		expect(closingFieldsMoved(vault.app, row, settings)).toBe(true);
	});

	it('is a move when a date ARRIVED that the row does not have', () => {
		// The sharp one: the row says dateless, so `closeOffer` offers the action, and the
		// raw value captured at the press would hand the write the date somebody else just
		// recorded — as the value it EXPECTS to find.
		const { row, vault } = screenOf({ status: 'In progress' });
		editLiveNote(vault, { released: '2026-08-01' });
		expect(closingFieldsMoved(vault.app, row, settings)).toBe(true);
	});

	it('withholds it when the transition is not one of the released values', () => {
		// A hand-edited `.base` can set a transition this vault does not count as released,
		// and the release can already CARRY that value. `alreadyOut` is then false — the
		// status is not a RELEASED one — so the action was offered, `releaseClosureWrites`
		// planned nothing because the status already equals the transition, and the empty
		// batch returned before `applyRelease` reached the gate. A confirmed press wrote
		// nothing and said nothing. `releaseNoteProblems` reports the same mismatch and
		// would refuse loudly, but only a NON-EMPTY batch ever gets there.
		const offer = offerFor({ status: 'Shipped' }, { ...BOUND, releasedValues: ['Released'], releasedTransition: 'Shipped' });
		expect(offer.offered).toBe(false);
		// Named, so the reader is told WHICH of the two values disagrees — the gate could
		// only have said the configuration is wrong.
		expect(offer.missing).toContain('releasedTransitionValue');
	});

	it('is a move when a field became UNREADABLE', () => {
		// A different kind of answer, not a different value — and the row still shows the
		// old one, so nothing about the value alone would notice.
		const { row, vault } = screenOf({ status: 'In progress' });
		editLiveNote(vault, { status: { a: 1 } });
		expect(closingFieldsMoved(vault.app, row, settings)).toBe(true);
	});

});
