import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import {
	reconfiguredKey,
	releaseDescriptionWrites,
	releaseReleasedWrites,
	releaseStatusWrites,
	ReleaseField,
	ReleaseWrite,
} from '../../src/domain/releaseWritePlan';

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
			{ file, role: 'status', sets: [{ key: 'status', value: 'Released' }], requiresType: 'Release' },
		]);
	});

	it('writes nothing for the value the note already holds, case-insensitively', () => {
		expect(releaseStatusWrites(file, 'status', 'planned', 'Planned')).toEqual([]);
		// And a DIFFERENT value still writes — or the rule above would be "writes nothing".
		expect(releaseStatusWrites(file, 'status', 'planned', 'Cut')).toHaveLength(1);
	});

	it('removes the key rather than blanking it, and writes nothing when there is nothing to remove', () => {
		expect(releaseStatusWrites(file, 'status', 'Planned', null)).toEqual([
			{ file, role: 'status', sets: [{ key: 'status', value: null }], requiresType: 'Release' },
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
			{ file, role: 'released', sets: [{ key: 'released', value: '2026-09-20' }], requiresType: 'Release' },
		]);
		expect(releaseReleasedWrites(file, 'released', on(2026, 9, 20), '')).toEqual([
			{ file, role: 'released', sets: [{ key: 'released', value: null }], requiresType: 'Release' },
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
			{ file, role: 'description', sets: [{ key: 'description', value: 'The billing rewrite.' }], requiresType: 'Release' },
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
			{ file, role: 'description', sets: [{ key: 'description', value: null }], requiresType: 'Release' },
		]);
		expect(releaseDescriptionWrites(file, 'description', null, '')).toEqual([]);
	});

	it('writes nothing at all where the key is unconfigured', () => {
		expect(releaseDescriptionWrites(file, '', null, 'Anything')).toEqual([]);
	});
});

describe('the keys this view may write', () => {
	const settings = { statusKey: 'status', descriptionKey: 'summary', releasedDateKey: 'released' };
	const write = (role: ReleaseField, key: string): ReleaseWrite[] => [
		{ file: file, role, sets: [{ key, value: 'x' }], requiresType: 'Release' },
	];

	it('accepts each of the three roles the release screen edits', () => {
		const roles: [ReleaseField, string][] = [
			['status', 'status'],
			['description', 'summary'],
			['released', 'released'],
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
