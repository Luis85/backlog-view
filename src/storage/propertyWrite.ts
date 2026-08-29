import { App, Notice } from 'obsidian';
import { t } from '../i18n/t';
import { PropertyWrite } from '../domain/estimationWritePlan';
import { isResourceType } from '../domain/itemTypes';
import { ownValue, readString, sameValue } from '../domain/noteFields';
import { captureInverse, RestoreWrite, WriteOutcome, rawValueOf } from './frontmatter';
import { setOwn } from './ownProperty';

/**
 * Plain key/value frontmatter batches — the estimation view's writer, and the
 * third file inside the write boundary (root CLAUDE.md names all three). It
 * captures the same RestoreWrite inverses `applyWrites` does (`captureInverse`,
 * exported from `frontmatter.ts` for exactly this reuse), so `applyRestores`
 * replays either's batches without knowing which writer produced them.
 *
 * `PropertySet`/`PropertyWrite` live in `domain/estimationWritePlan.ts` beside the
 * planners that produce them, not here beside their consumer — this module reads them,
 * it does not own them.
 */

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
	typeKey: string,
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
		// The refusal's own SENTENCE rather than a reason code, and composed where the
		// refusal is decided: two refusals say different things to the reader, and the
		// alternative — a code read back out here — needs a fallback for a parameter that
		// cannot be missing (`requiresType` is what the second refusal is about), which is a
		// branch nothing can take.
		let refusal: string | null = null;
		// Nothing left to say is not a save: `processFrontMatter` rewrites the note whether
		// or not the callback changed anything.
		if (sets.length > 0) {
			await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
				// **A RESOURCE is never written to, and the model cannot answer this.** The
				// row this batch was planned from is the model's, and the model is what a
				// note retyped to `Resource` since the last Bases pass is stale about — so
				// the score, the recalculation and the cleanup would all land on a person.
				// `applyWrites` keeps the identical guard for the backlog's own batches;
				// this is the estimation view's writer and shares none of that path, which
				// is why the rule is asked again rather than inherited.
				//
				// Refused per FILE rather than stopping the batch, unlike `applyWrites`: a
				// batch here is one note's own scores, and ✨'s many-file batch has no
				// ordering between its files, so a later note is not made incoherent by an
				// earlier one being skipped.
				const live = readString(ownValue(fm, typeKey));
				if (isResourceType(live)) {
					refusal = t('gate.becameResource');
					return;
				}
				// **The plan's own type claim, asked of the LIVE note.** A write that names a
				// type is one whose planner knew what it was writing to — the release view's
				// status and description are only ever a RELEASE's — and the window between
				// the menu opening and the pick is one nothing upstream can see. Retyped in
				// it, the note is somebody else's now: on the common configuration where a
				// release's status and an item's workflow state share `status`, the write
				// would land on a work item's own state (found by review, PR #211).
				//
				// `sameValue` rather than `===`, the comparison every type test in this
				// plugin makes: a type is matched case-insensitively, and a note carrying no
				// type at all answers null and is refused.
				if (write.requiresType !== undefined && !sameValue(live, write.requiresType)) {
					refusal = t('gate.retyped', { type: write.requiresType });
					return;
				}
				const keys = sets.map((s) => s.key);
				const prior = keys.map((key) => rawValueOf(fm, key));
				for (const s of sets) {
					if (s.ifMissing) {
						if (!rawValueOf(fm, s.key).present) setOwn(fm, s.key, s.value);
					} else if (s.value === null) delete fm[s.key];
					else setOwn(fm, s.key, s.value);
				}
				// The same inverse capture `applyWrites` uses — this writer has no tags and
				// no dependsOn list, so it hands `captureInverse` an empty pair rather than
				// a parallel copy of the same before/after key comparison.
				inverse = captureInverse(write.file, keys, prior, fm, {});
			});
		}
		if (refusal !== null) {
			console.error('Product Backlog: refused a property write', write);
			new Notice(refusal);
		}
		if (inverse) {
			outcome.changed = true;
			onInverse?.(inverse);
		}
		onProgress?.(++done, writes.length);
	}
	return outcome;
}
