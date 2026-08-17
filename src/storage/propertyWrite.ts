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
		let inverse: RestoreWrite | null = null;
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			const prior = write.sets.map((s) => rawValueOf(fm, s.key));
			for (const s of write.sets) {
				if (s.ifMissing) {
					if (!rawValueOf(fm, s.key).present) setOwn(fm, s.key, s.value);
				} else if (s.value === null) delete fm[s.key];
				else setOwn(fm, s.key, s.value);
			}
			const changed: KeyRestore[] = [];
			write.sets.forEach((s, i) => {
				const written = rawValueOf(fm, s.key);
				if (!sameRaw(prior[i], written)) changed.push({ key: s.key, prior: prior[i], written });
			});
			if (changed.length > 0) inverse = { file: write.file, keys: changed };
		});
		if (inverse) {
			outcome.changed = true;
			onInverse?.(inverse);
		}
		onProgress?.(++done, writes.length);
	}
	return outcome;
}
