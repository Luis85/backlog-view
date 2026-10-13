import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { MapCard, releaseMap } from '../../src/domain/releaseMap';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { daysBetween, MAX_TIMELINE_DAYS } from '../../src/domain/timeline';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

const KEYS = releaseSettingsWith({
	parentKey: 'parent',
	orderKey: 'order',
	typeKey: 'type',
	membershipKey: 'release',
	versionKey: 'version',
	targetDateKey: 'target-date',
	statusKey: 'status',
	releasedDateKey: 'released',
});

const TODAY: CivilDate = { year: 2026, month: 9, day: 20 };

function d(iso: string): CivilDate {
	const [year, month, day] = iso.split('-').map(Number);
	return { year, month, day };
}

function release(vault: FakeVault, name: string, frontmatter: Record<string, unknown>): void {
	vault.addFile(`${name}.md`, { frontmatter: { type: 'Release', ...frontmatter } });
}

/** The map exactly as the view builds it: the real index, the real scope per release. */
function mapOf(vault: FakeVault) {
	const model = buildModel(vault.app, vault.entries(), settingsWith({ stateKey: 'status' }));
	const index = releaseIndex(vault.app, model, KEYS, { stateKey: 'status', today: TODAY });
	return releaseMap(index, (path) => releaseScope(vault.app, model, KEYS, index, path).rows, TODAY);
}

const names = (cards: MapCard[]) => cards.map((card) => card.release.name);

/** Four releases: one shipped late, two ending the same day, one later. */
function plan(): FakeVault {
	const vault = new FakeVault();
	release(vault, 'A', { 'target-date': '2026-11-01', order: 1 });
	release(vault, 'B', { 'target-date': '2026-08-25', released: '2026-09-01', order: 2 });
	release(vault, 'C', { 'target-date': '2026-10-01', order: 3 });
	release(vault, 'D', { 'target-date': '2026-10-01', order: 4 });
	return vault;
}

describe('the release map', () => {
	it('orders rows by their end — released once shipped, else target — keeping the list’s order on a tie', () => {
		const map = mapOf(plan());
		expect(names(map.rows)).toEqual(['B', 'C', 'D', 'A']);
		expect(map.rows[0].end).toEqual(d('2026-09-01'));
		expect(map.rows[3].end).toEqual(d('2026-11-01'));
	});

	it('derives each start from the row before it, and none for the first row or a same-day end', () => {
		const [b, c, dRow, a] = mapOf(plan()).rows;
		expect(b.start).toBeNull();
		expect(c.start).toEqual(d('2026-09-01'));
		// D ends the day C ends: a zero-length lead-in is no lead-in.
		expect(dRow.start).toBeNull();
		expect(a.start).toEqual(d('2026-10-01'));
	});

	it('ticks the target of a shipped release that slipped, either way, and not one on time', () => {
		const vault = plan();
		release(vault, 'OnTime', { 'target-date': '2026-09-05', released: '2026-09-05' });
		release(vault, 'Early', { 'target-date': '2026-09-15', released: '2026-09-10' });
		const rows = mapOf(vault).rows;
		const row = (name: string) => rows.find((r) => r.release.name === name);
		expect(row('B')?.slipTarget).toEqual(d('2026-08-25'));
		expect(row('Early')?.slipTarget).toEqual(d('2026-09-15'));
		expect(row('OnTime')?.slipTarget).toBeNull();
		expect(row('A')?.slipTarget).toBeNull();
	});

	it('keeps an overdue release on the map, ending at its target', () => {
		const vault = new FakeVault();
		release(vault, 'Late', { 'target-date': '2026-09-10' });
		const [row] = mapOf(vault).rows;
		expect(row.end).toEqual(d('2026-09-10'));
		expect(row.release.overdue).toBe(true);
	});

	it('shelves in-flight releases with no readable target, in the list’s order, and never a shipped one', () => {
		const vault = new FakeVault();
		release(vault, 'Unset', { order: 1 });
		release(vault, 'Unreadable', { 'target-date': 'soon', order: 2 });
		release(vault, 'Shipped', { released: '2026-09-01', order: 3 });
		const map = mapOf(vault);
		expect(names(map.shelf)).toEqual(['Unset', 'Unreadable']);
		expect(names(map.rows)).toEqual(['Shipped']);
	});

	it('heads a card with the first three top-level scope items and counts the rest', () => {
		const vault = new FakeVault();
		release(vault, 'R', { 'target-date': '2026-10-01' });
		release(vault, 'Empty', { 'target-date': '2026-11-01' });
		for (let i = 1; i <= 5; i++) vault.addFile(`P${i}.md`, { frontmatter: { type: 'PBI', order: i, release: '[[R]]' } });
		const [r, empty] = mapOf(vault).rows;
		expect(r.headline).toEqual(['P1', 'P2', 'P3']);
		expect(r.more).toBe(2);
		expect(empty.headline).toEqual([]);
		expect(empty.more).toBe(0);
		expect(empty.release.members.value).toBe(0);
	});

	it('spans the window over every row, every slipped target and today', () => {
		const { window } = mapOf(plan());
		// B's target (Aug 25) is the earliest date, padded back to July; A (Nov 1) the latest, padded to December.
		expect(window.start).toEqual(d('2026-07-01'));
		expect(daysBetween(window.start, d('2026-12-31'))).toBe(window.days - 1);
	});

	it('draws from today alone when no release has a date', () => {
		const vault = new FakeVault();
		release(vault, 'Someday', {});
		const map = mapOf(vault);
		expect(map.rows).toEqual([]);
		expect(map.window.start).toEqual(d('2026-08-01'));
		expect(map.window.days).toBe(92);
	});

	it('clamps a release far past the drawable window rather than stretching the window to it', () => {
		const vault = new FakeVault();
		release(vault, 'Far', { 'target-date': '2034-01-01' });
		const map = mapOf(vault);
		expect(names(map.rows)).toEqual(['Far']);
		expect(map.window.days).toBe(MAX_TIMELINE_DAYS);
	});
});
