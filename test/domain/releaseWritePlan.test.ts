import { describe, expect, it } from 'vitest';
import { TFile } from '../helpers/obsidian-mock';
import {
	reconfiguredKey,
	releaseCapacityWrites,
	releaseClosureWrites,
	releaseDescriptionWrites,
	releaseReleasedWrites,
	releaseStatusWrites,
	ReleaseField,
	ReleaseWrite,
} from '../../src/domain/releaseWritePlan';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { CivilDate } from '../../src/domain/noteFields';

const TODAY: CivilDate = { year: 2026, month: 8, day: 29 };

/**
 * Every batch below carries `requiresType: 'Release'`, and it is asserted rather than
 * ignored: it is the plan's own claim about what it is writing to, which
 * `applyPropertyWrites` checks against the LIVE note — a release retyped between the menu
 * opening and the pick is somebody else's note now (PR #211). A planner that stopped
 * stating it would leave that guard reading `undefined` and refusing nothing.
 *
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
			{ file, sets: [{ key: 'status', value: 'Released', role: 'status' }], requiresType: 'Release' },
		]);
	});

	it('writes nothing for the value the note already holds, case-insensitively', () => {
		expect(releaseStatusWrites(file, 'status', 'planned', 'Planned')).toEqual([]);
		// And a DIFFERENT value still writes — or the rule above would be "writes nothing".
		expect(releaseStatusWrites(file, 'status', 'planned', 'Cut')).toHaveLength(1);
	});

	it('removes the key rather than blanking it, and writes nothing when there is nothing to remove', () => {
		expect(releaseStatusWrites(file, 'status', 'Planned', null)).toEqual([
			{ file, sets: [{ key: 'status', value: null, role: 'status' }], requiresType: 'Release' },
		]);
		expect(releaseStatusWrites(file, 'status', null, null)).toEqual([]);
	});

	it('writes nothing at all where the key is unconfigured', () => {
		// The rule `applyPropertyWrites` also keeps at the writer, asked here so a plan never
		// CLAIMS a write the writer would drop.
		expect(releaseStatusWrites(file, '', null, 'Released')).toEqual([]);
	});
});

describe('planning a released date', () => {
	const on = (year: number, month: number, day: number) => ({ year, month, day });

	it('sets the date the reader picked, and clears the key for an emptied field', () => {
		expect(releaseReleasedWrites(file, 'released', null, '2026-09-20')).toEqual([
			{ file, sets: [{ key: 'released', value: '2026-09-20', role: 'released' }], requiresType: 'Release' },
		]);
		expect(releaseReleasedWrites(file, 'released', on(2026, 9, 20), '')).toEqual([
			{ file, sets: [{ key: 'released', value: null, role: 'released' }], requiresType: 'Release' },
		]);
	});

	it('writes nothing for the date the note already states, however the note spells it', () => {
		// `2026-9-1` is a date `readDate` accepts, and confirming the dialog it prefills must
		// not rewrite the note to the canonical spelling — the rule `computeScheduleWrites`
		// keeps for the roadmap's own two ends.
		expect(releaseReleasedWrites(file, 'released', on(2026, 9, 1), '2026-09-01')).toEqual([]);
		expect(releaseReleasedWrites(file, 'released', null, '')).toEqual([]);
	});

	it('writes nothing at all where the key is unconfigured', () => {
		expect(releaseReleasedWrites(file, '', null, '2026-09-20')).toEqual([]);
	});
});

describe('planning a release description', () => {
	it('trims the entry and sets it', () => {
		expect(releaseDescriptionWrites(file, 'description', null, '  The billing rewrite. ')).toEqual([
			{ file, sets: [{ key: 'description', value: 'The billing rewrite.', role: 'description' }], requiresType: 'Release' },
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
			{ file, sets: [{ key: 'description', value: null, role: 'description' }], requiresType: 'Release' },
		]);
		expect(releaseDescriptionWrites(file, 'description', null, '')).toEqual([]);
	});

	it('writes nothing at all where the key is unconfigured', () => {
		expect(releaseDescriptionWrites(file, '', null, 'Anything')).toEqual([]);
	});
});

describe('releaseCapacityWrites', () => {
	const file = { path: 'R.md' } as TFile;

	it('writes the number the reader typed', () => {
		expect(releaseCapacityWrites(file, 'capacity', null, ' 40 ')).toEqual([
			{ file, sets: [{ key: 'capacity', value: '40', role: 'capacity' }], requiresType: 'Release' },
		]);
	});

	it('plans nothing for the value the note already holds', () => {
		expect(releaseCapacityWrites(file, 'capacity', 40, '40')).toEqual([]);
		// The same number spelled differently is the same number — never a rewrite.
		expect(releaseCapacityWrites(file, 'capacity', 40, '40.0')).toEqual([]);
	});

	it('writes a genuinely different number over the one the note already holds', () => {
		// The `current !== null` half of the no-op test, exercised with its OTHER outcome:
		// `plans nothing for the value the note already holds` above never changes an
		// existing capacity, only re-confirms or clears one.
		expect(releaseCapacityWrites(file, 'capacity', 40, '55')).toEqual([
			{ file, sets: [{ key: 'capacity', value: '55', role: 'capacity' }], requiresType: 'Release' },
		]);
	});

	it('clears the key on an emptied box', () => {
		expect(releaseCapacityWrites(file, 'capacity', 40, '  ')).toEqual([
			{ file, sets: [{ key: 'capacity', value: null, role: 'capacity' }], requiresType: 'Release' },
		]);
	});

	it('plans nothing when the key is unbound, and nothing for a clear of an absent value', () => {
		expect(releaseCapacityWrites(file, '', null, '40')).toEqual([]);
		expect(releaseCapacityWrites(file, 'capacity', null, '')).toEqual([]);
	});

	it('refuses a value the reader of this figure would not count', () => {
		expect(releaseCapacityWrites(file, 'capacity', null, '40 pts')).toEqual([]);
		expect(releaseCapacityWrites(file, 'capacity', null, '-1')).toEqual([]);
	});
});

describe('the keys this view may write', () => {
	const settings = releaseSettingsWith({
		statusKey: 'status',
		descriptionKey: 'summary',
		releasedDateKey: 'released',
		capacityKey: 'capacity',
	});
	const write = (role: ReleaseField, key: string): ReleaseWrite[] => [
		{ file: file, sets: [{ key, value: 'x', role }], requiresType: 'Release' },
	];

	it('accepts each of the four roles the release screen edits', () => {
		const roles: [ReleaseField, string][] = [
			['status', 'status'],
			['description', 'summary'],
			['released', 'released'],
			['capacity', 'capacity'],
		];
		for (const [role, key] of roles) expect(reconfiguredKey(settings, write(role, key))).toBeNull();
		expect(reconfiguredKey(settings, [])).toBeNull();
	});

	it('refuses a key that is still editable but names ANOTHER role — two options SWAPPED', () => {
		// The corruption a union test cannot see: the status menu captured `status`, the
		// reader swapped the status and description options while it was open, and `status`
		// is now the DESCRIPTION key. Editable, and not this write's — submitting it would
		// put the picked status in the release's description.
		const swapped = { ...settings, statusKey: 'summary', descriptionKey: 'status' };
		expect(reconfiguredKey(swapped, write('status', 'status'))).toBe('status');
		expect(reconfiguredKey(swapped, write('description', 'summary'))).toBe('summary');
	});

	it('refuses the capacity key too, once it has swapped with another role — the widened union', () => {
		// The same corruption, asked of the role widening `reconfiguredKey` cost nothing at
		// its one call site: the capacity dialog captured `capacity`, the reader swapped the
		// capacity and released-date options while it was open, and `capacity` is now the
		// RELEASED key. Submitting it would put the typed number on the release's date.
		const swapped = { ...settings, capacityKey: 'released', releasedDateKey: 'capacity' };
		expect(reconfiguredKey(swapped, write('capacity', 'capacity'))).toBe('capacity');
		expect(reconfiguredKey(swapped, write('released', 'released'))).toBe('released');
	});

	it('refuses a key the settings no longer name — the captured key of a re-pointed option', () => {
		// The corruption this exists for: the description key CAPTURED while it aliased the
		// type property, submitted after the reader fixed that collision. The gate re-reads
		// the settings and sees no problem; the batch still says `type`.
		expect(reconfiguredKey(settings, write('description', 'type'))).toBe('type');
		// And the merely re-pointed case, refused with it: the old key is not this view's
		// any more, whether or not anything else owns it.
		expect(reconfiguredKey(settings, write('description', 'description'))).toBe('description');
	});

	it('refuses the captured write of a role that has since been UNCONFIGURED', () => {
		// No plan can carry the empty key — `fieldWrite` answers nothing for it — so the
		// unbound case reaches here as the key the control was DRAWN with, against a role
		// that now names nothing. Refused before `applyPropertyWrites` drops it quietly.
		expect(reconfiguredKey({ ...settings, descriptionKey: '' }, write('description', 'summary'))).toBe('summary');
	});
});

describe('closing a release', () => {
	it('plans the status and the date as ONE write with two sets', () => {
		const file = new TFile('0.9.md');
		const settings = releaseSettingsWith({
			statusKey: 'status',
			releasedDateKey: 'released',
			releasedTransition: 'Released',
		});
		const writes = releaseClosureWrites(
			file,
			settings,
			{ status: 'In progress', released: null },
			{ status: ' In progress ', released: undefined },
			TODAY,
		);

		// ONE write, because `applyPropertyWrites` opens one `processFrontMatter` per write:
		// two writes would be two saves, and a retype between them would land the status and
		// refuse the date — a release marked shipped with no record of when.
		expect(writes).toHaveLength(1);
		expect(writes[0].sets.map((s) => [s.key, s.value])).toEqual([
			['status', 'Released'],
			['released', '2026-08-29'],
		]);
		// The role is on each SET now, so `reconfiguredKey` can still ask per role.
		expect(writes[0].sets.map((s) => s.role)).toEqual(['status', 'released']);
		expect(writes[0].requiresType).toBe('Release');
		// The RAW spelling, not the trimmed reading: this is the value the writer compares
		// against the live frontmatter, and a normalised one would never match it.
		expect(writes[0].sets[0].expects).toBe(' In progress ');
	});

	it('plans nothing when the release is already at the transition value', () => {
		const settings = releaseSettingsWith({ statusKey: 'status', releasedDateKey: 'released', releasedTransition: 'Released' });
		// `sameValue`, case-insensitively, the rule every other pick in this plugin keeps.
		expect(
			releaseClosureWrites(
				new TFile('0.9.md'),
				settings,
				{ status: 'released', released: null },
				{ status: 'released', released: undefined },
				TODAY,
			),
		).toEqual([]);
	});

	it('reconfiguredKey checks the two-set write PER SET, never against one shared role', () => {
		// A two-set write under a single role would compare the date set's key against the
		// status key and refuse every release closure — the reason `role` moved onto the set.
		const settings = releaseSettingsWith({ statusKey: 'status', releasedDateKey: 'released', releasedTransition: 'Released' });
		const writes = releaseClosureWrites(
			new TFile('0.9.md'),
			settings,
			{ status: 'In progress', released: null },
			{ status: 'In progress', released: undefined },
			TODAY,
		);
		expect(reconfiguredKey(settings, writes)).toBeNull();
	});

	it('plans nothing where the closing options are not configured', () => {
		expect(
			releaseClosureWrites(
				new TFile('0.9.md'),
				releaseSettingsWith({ statusKey: '', releasedDateKey: 'released', releasedTransition: 'Released' }),
				{ status: 'In progress', released: null },
				{ status: 'In progress', released: undefined },
				TODAY,
			),
		).toEqual([]);
		expect(
			releaseClosureWrites(
				new TFile('0.9.md'),
				releaseSettingsWith({ statusKey: 'status', releasedDateKey: '', releasedTransition: 'Released' }),
				{ status: 'In progress', released: null },
				{ status: 'In progress', released: undefined },
				TODAY,
			),
		).toEqual([]);
		expect(
			releaseClosureWrites(
				new TFile('0.9.md'),
				releaseSettingsWith({ statusKey: 'status', releasedDateKey: 'released', releasedTransition: '' }),
				{ status: 'In progress', released: null },
				{ status: 'In progress', released: undefined },
				TODAY,
			),
		).toEqual([]);
	});
});
