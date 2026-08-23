import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { computeReleaseWrites } from '../../src/domain/writePlan';
import { FakeVault } from '../helpers/vault';

/**
 * `computeReleaseWrites` — the release membership planner. Its own file for the same
 * reason `iterationDates.test.ts` is: a shared file becomes the place tests hide.
 */

/**
 * A PBI and a `2.4` release note, built together so the PBI's own link (when given)
 * resolves against the SAME model the target comes from — matching by path is only a
 * meaningful assertion when both sides are read off one build.
 */
function fixture(opts: { release: string | null; spelling?: string; settings?: ReturnType<typeof settingsWith> }) {
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

	it('plans nothing at all when the key is unbound', () => {
		const { item, target } = fixture({ release: null });
		expect(computeReleaseWrites(item, target, settingsWith({ releaseKey: '' }))).toEqual([]);
	});
});
