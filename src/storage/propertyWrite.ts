import { App, TFile } from 'obsidian';
import { KeyRestore, RestoreWrite, WriteOutcome, rawValueOf, sameRaw } from './frontmatter';
import { setOwn } from './ownProperty';

/**
 * Plain key/value frontmatter batches — the estimation view's writer, and the
 * third file inside the write boundary (root CLAUDE.md names all three). It
 * captures the same RestoreWrite inverses `applyWrites` does, so `applyRestores`
 * replays either's batches without knowing which writer produced them.
 */

/** One key to set. `value: null` REMOVES the key; `ifMissing` writes only when the
 *  live note lacks the key already — never overwriting an answer that is there. */
export interface PropertySet {
	key: string;
	value: unknown;
	ifMissing?: boolean;
}

export interface PropertyWrite {
	file: TFile;
	sets: PropertySet[];
}

/**
 * Apply one file's sets inside a single `processFrontMatter` call, so a score, its
 * recomputed total and its stamp land — or fail to land — together. Sequential across
 * files for the same reason `applyWrites` is: concurrent edits of the same file must
 * not race.
 *
 * `onInverse` fires once per file, with the keys that ACTUALLY changed — a re-pick of
 * the value already held changes nothing, so a no-op write costs the caller no undo
 * slot, the same rule `applyWrites` keeps.
 */
export async function applyPropertyWrites(
	app: App,
	writes: PropertyWrite[],
	onProgress?: (done: number, total: number) => void,
	onInverse?: (inverse: RestoreWrite) => void,
): Promise<WriteOutcome> {
	const outcome: WriteOutcome = { changed: false, dates: null };
	let done = 0;
	for (const write of writes) {
		// An UNCONFIGURED key is never written to — the rule `axisEntries` keeps for the
		// roadmap's own keys, asked here rather than of each planner: '' is what
		// `resolveEstimationSettings` resolves an unnamed property to, and `setOwn(fm, '')`
		// would put a nameless key in a note somebody reads. At the write, so it holds for
		// a planner not yet written.
		const sets = write.sets.filter((s) => s.key !== '');
		let inverse: RestoreWrite | null = null;
		// Nothing left to say is not a save: `processFrontMatter` rewrites the note whether
		// or not the callback changed anything.
		if (sets.length > 0) {
			await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
				const prior = sets.map((s) => rawValueOf(fm, s.key));
				for (const s of sets) {
					if (s.ifMissing) {
						if (!rawValueOf(fm, s.key).present) setOwn(fm, s.key, s.value);
					} else if (s.value === null) delete fm[s.key];
					else setOwn(fm, s.key, s.value);
				}
				const changed: KeyRestore[] = [];
				sets.forEach((s, i) => {
					const written = rawValueOf(fm, s.key);
					if (!sameRaw(prior[i], written)) changed.push({ key: s.key, prior: prior[i], written });
				});
				if (changed.length > 0) inverse = { file: write.file, keys: changed };
			});
		}
		if (inverse) {
			outcome.changed = true;
			onInverse?.(inverse);
		}
		onProgress?.(++done, writes.length);
	}
	return outcome;
}
