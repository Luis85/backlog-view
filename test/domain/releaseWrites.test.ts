import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { releaseIndex } from '../../src/domain/releases';
import { CivilDate } from '../../src/domain/noteFields';
import { computeReleaseWrites } from '../../src/domain/writePlan';
import { FakeVault } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/releaseSettings';

/** This suite is not about `today` either, so a fixed value stands in for it. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

/**
 * `computeReleaseWrites` — the release membership planner. Its own file for the same
 * reason `iterationDates.test.ts` is: a shared file becomes the place tests hide.
 */

/**
 * A PBI and a `2.4` release note, built together so the PBI's own link (when given)
 * resolves against the SAME model the target comes from — matching by path is only a
 * meaningful assertion when both sides are read off one build.
 */
function fixture(opts: {
	release: string | null;
	spelling?: unknown;
	settings?: ReturnType<typeof settingsWith>;
}) {
	const vault = new FakeVault();
	vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
	vault.addFile('PBI-1.md', {
		frontmatter: {
			type: 'PBI',
			order: 10,
			...(opts.release !== null ? { release: opts.spelling ?? '[[Releases/2.4]]' } : {}),
		},
	});
	const settings = opts.settings ?? settingsWith({ releaseKey: 'release' });
	const model = buildModel(vault.app, vault.entries(), settings);
	return {
		item: model.byPath.get('PBI-1.md')!,
		target: model.byPath.get('Releases/2.4.md')!,
		settings,
		/** What the READER makes of the same note, off the same build the planner is asked about. */
		readAsMembership: () =>
			!releaseIndex(
				vault.app,
				model,
				releaseSettingsWith({
					parentKey: 'parent',
					orderKey: 'order',
					typeKey: 'type',
					membershipKey: 'release',
					versionKey: 'version',
					targetDateKey: 'target-date',
					statusKey: 'status',
				}),
				{ stateKey: settings.stateKey, today: TODAY },
			).unresolved.some((i) => i.file.path === 'PBI-1.md'),
	};
}

describe('planning one release membership', () => {
	it('writes the picked release onto the item, and nothing else', () => {
		const { item, target, settings } = fixture({ release: null });
		const writes = computeReleaseWrites(item, target, settings);
		expect(writes).toEqual([{ file: item.file, release: target.file }]);
	});

	it('plans NOTHING when the item is already in that release', () => {
		// The checkmark is asked of this output, so an agreeing re-pick must be empty —
		// not a write the applier happens to no-op, which would spend the undo slot.
		const { item, target, settings } = fixture({ release: '2.4.md' });
		expect(computeReleaseWrites(item, target, settings)).toEqual([]);
	});

	it('compares by PATH, so two spellings of one note are one release', () => {
		const { item, target, settings } = fixture({ release: '2.4.md', spelling: '[[Releases/2.4|2.4]]' });
		expect(computeReleaseWrites(item, target, settings)).toEqual([]);
	});

	it('REMOVES the key for a "no release" pick, never writes it empty', () => {
		const { item, settings } = fixture({ release: '2.4.md' });
		expect(computeReleaseWrites(item, null, settings)).toEqual([{ file: item.file, release: null }]);
	});

	it('REMOVES the key for a "no release" pick even when the key holds an empty value', () => {
		// Presence, never the parsed entry: `release: ''` is exactly the shape the
		// docstring names — the key is there, ownKeys.release must read true, and
		// readLinkList refuses an empty string outright, so releaseEntry must read null.
		// Reachable only if BOTH halves disagree — the state the alternate implementation
		// `item.releaseEntry ? … : []` cannot distinguish from "no key at all".
		const vault = new FakeVault();
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, release: '' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ releaseKey: 'release' }));
		const item = model.byPath.get('PBI-1.md')!;

		expect(item.ownKeys.release).toBe(true);
		expect(item.releaseEntry).toBeNull();
		expect(computeReleaseWrites(item, null, settingsWith({ releaseKey: 'release' }))).toEqual([
			{ file: item.file, release: null },
		]);
	});

	it('plans nothing for "no release" when the note carries no key', () => {
		// Asked of PRESENCE (`ownKeys`), never of the parsed entry: a hand-edited
		// `release: ''` reads as no entry while the key visibly holds something, and
		// asking the entry would tick the None checkmark on a note that is not empty.
		const { item, settings } = fixture({ release: null });
		expect(computeReleaseWrites(item, null, settings)).toEqual([]);
	});

	it('rewrites a membership the note spells TWICE, even to the release it names first', () => {
		// [[The scope of a release as a tree]] 1c: membership is ONE value, so
		// `membershipTarget` reports a two-valued key as unresolved whatever it names. The
		// planner reads `releaseEntry`, which has already collapsed the list to its first
		// entry — so comparing that path alone made a pick of `2.4` a no-op, ticked `2.4`
		// as current, and left the reader no way to repair the note from the menu at all.
		// The no-op question is about CARDINALITY as well as identity: exactly one, and it
		// is the target.
		const { item, target, settings } = fixture({
			release: '2.4.md',
			spelling: ['[[Releases/2.4]]', '[[Releases/2.5]]'],
		});
		// Not vacuous: the first entry really does resolve to the release being picked, so
		// the path comparison this test exists for answers "already there".
		expect(item.releaseEntry?.file?.path).toBe(target.file.path);
		expect(computeReleaseWrites(item, target, settings)).toEqual([{ file: item.file, release: target.file }]);
	});

	it('REMOVES a two-valued key for a "no release" pick', () => {
		// The mirror, and it follows from presence rather than from the reading:
		// `ownKeys.release` is true for a list as for a scalar, so the one write takes the
		// whole key off. Asserted rather than assumed — this is the other half of the
		// repair, and the only one that was already correct.
		const { item, settings } = fixture({ release: '2.4.md', spelling: ['[[Releases/2.4]]', '[[Releases/2.5]]'] });
		expect(computeReleaseWrites(item, null, settings)).toEqual([{ file: item.file, release: null }]);
	});

	it('plans nothing at all when the key is unbound', () => {
		const { item, target } = fixture({ release: null });
		expect(computeReleaseWrites(item, target, settingsWith({ releaseKey: '' }))).toEqual([]);
	});
});

/**
 * **The two ends answer ONE question**, and this is where that is checked rather than
 * asserted in a comment: `membershipTarget` (`domain/releases.ts`) counts the property's
 * SLOTS to decide whether the note names a membership at all, and `computeReleaseWrites`
 * asks the same cardinality to decide whether a pick would write nothing. A pick plans
 * nothing exactly when the reader already calls the note a member of that release —
 * anything else is the disagreement [[Setting an item's release]] 1f forbids, and it has
 * now moved once already, from `releaseEntry` down into `readLinkList`.
 *
 * `readLinkList` returns PARSED entries, so it drops a blank slot and a non-string one
 * before anyone can count them; `membershipTarget` counts the raw array. Those are the
 * first two shapes below, and each was a note the release view called unresolved while
 * the menu ticked its first release as current — unrepairable from the menu, which is the
 * whole defect. The third is the control: a ONE-element list is unwrapped by `readString`,
 * so the reader calls it an ordinary membership and the planner must agree by planning
 * nothing.
 */
describe('cardinality, read the same way at both ends', () => {
	const shapes: { name: string; spelling: unknown; member: boolean }[] = [
		{ name: 'a link and a blank slot', spelling: ['[[Releases/2.4]]', ''], member: false },
		{ name: 'a link and a slot that is not a string', spelling: ['[[Releases/2.4]]', 42], member: false },
		{ name: 'a single link in a list', spelling: ['[[Releases/2.4]]'], member: true },
	];

	for (const shape of shapes) {
		it(`agrees about ${shape.name}`, () => {
			const { item, target, settings, readAsMembership } = fixture({ release: '2.4.md', spelling: shape.spelling });
			// The fixture reaches the state its name claims before anything is concluded
			// from it: this is the READER's verdict, and it is what the plan must match.
			expect(readAsMembership()).toBe(shape.member);
			expect(computeReleaseWrites(item, target, settings)).toEqual(
				shape.member ? [] : [{ file: item.file, release: target.file }],
			);
		});
	}
});
