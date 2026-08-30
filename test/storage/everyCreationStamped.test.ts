import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The category invariant behind the id, checked at the CALL rather than by driving the
 * creators somebody remembered — `../CLAUDE.md`'s own rule, and the one the four
 * per-creator assertions in `createNote.test.ts` cannot keep: a fifth creator added later
 * calls `vault.create` on a path no existing test drives, and every one of them stays
 * green. Reported by automated review on PR #226.
 *
 * It counts CALLS rather than files, and that distinction is the finding it was rewritten
 * from: `createNote.ts` holds three creators already, so "the file mentions `nextItemId`
 * somewhere" is satisfied by its neighbours and a fourth creator added beside them would
 * have passed. One `nextItemId` per `vault.create` is what actually fails on the day such
 * a creator is written.
 *
 * What this reads is the SOURCE, not the behaviour, so it stays a coarse instrument. Two
 * things it cannot see, stated rather than implied: a creator that stamps on one branch and
 * not another (the counts still match), and a helper that calls `nextItemId` twice for one
 * creation (likewise). Both fail the per-creator assertions in `createNote.test.ts`
 * instead — the two checks are complements and neither covers the other.
 */

/**
 * The files that create something the plugin MAINTAINS rather than something anyone
 * tracks: a generated README, and the `.base` file itself. Adding a third name here is a
 * deliberate edit with a reason, which is the whole point of listing them.
 */
const ARTIFACT_WRITERS = ['readmeFile.ts', 'baseFile.ts'];

const STORAGE = 'src/storage';

/** How many times a source file spells one call. */
function calls(source: string, needle: string): number {
	return source.split(needle).length - 1;
}

/** Every `.ts` in `storage/`, with the two counts this asks about. */
function creationCounts(dir: string): { name: string; creates: number; stamps: number }[] {
	return readdirSync(dir)
		.filter((name) => name.endsWith('.ts'))
		.map((name) => {
			const source = readFileSync(`${dir}/${name}`, 'utf8');
			return { name, creates: calls(source, 'vault.create('), stamps: calls(source, 'nextItemId(') };
		});
}

describe('every note creator stamps an id', () => {
	it('takes an id once per file it creates, in every file in storage/ that creates one', () => {
		const unstamped = creationCounts(STORAGE)
			.filter(({ name }) => !ARTIFACT_WRITERS.includes(name))
			.filter(({ creates, stamps }) => creates !== stamps);

		expect(unstamped).toEqual([]);
	});

	it('is looking at a directory that actually creates files', () => {
		// The instrument tested before it is trusted: a test asking "no file matches" passes
		// just as happily when its pattern matches nothing at all, so a moved directory and
		// a renamed call would each silence the check above without failing it.
		const creators = creationCounts(STORAGE)
			.filter(({ creates }) => creates > 0)
			.map(({ name }) => name);

		expect(creators).toEqual(expect.arrayContaining([...ARTIFACT_WRITERS, 'createNote.ts', 'absenceNotes.ts']));
	});
});
