import { App, Notice } from 'obsidian';
import { applyRestores, RestoreOutcome, RestoreWrite } from '../../storage/frontmatter';

/**
 * The undo replay, packaged for the view's write gate. The view owns the slot
 * (which batch is undoable) and the gate (one batch at a time); this module owns
 * running a replay, telling the user what it could not put back, and the
 * bookkeeping that keeps undo and redo coherent across a replay failing partway.
 */

/** How far a replay got — the view turns this into the retry remainder on failure. */
export interface ReplayTracker {
	finished: number;
}

/** The batch runner `runExclusively` expects, wrapping `applyRestores` with bookkeeping. */
export function replayRun(
	app: App,
	batch: RestoreWrite[],
	tracker: ReplayTracker,
): (
	onProgress: (done: number, total: number) => void,
	onInverse: (inverse: RestoreWrite) => void,
) => Promise<void> {
	return async (onProgress, onInverse) => {
		const outcome = await applyRestores(
			app,
			batch,
			(done, total) => {
				tracker.finished = done;
				onProgress(done, total);
			},
			onInverse,
		);
		reportRestoreOutcome(outcome);
	};
}

/**
 * What a failed replay strands: the redo inverses of the prefix it DID restore,
 * keyed to the remainder that has to complete before they mean anything again.
 * Without this, the retry's own redo would re-apply only the tail and leave the
 * prefix restored — files pointing two ways, the exact state the remainder rule
 * exists to prevent, just in the redo direction.
 */
export class UndoRecovery {
	private stash: { forSlot: RestoreWrite[]; redo: RestoreWrite[] } | null = null;

	/**
	 * A replay of `restores` completed; `slot` is what the run installed. Returns
	 * the slot to keep — any stashed prefix redo rejoined in front, so the next
	 * undo re-applies the whole recovered batch. Settles the stash either way.
	 */
	completed(restores: RestoreWrite[], slot: RestoreWrite[] | null): RestoreWrite[] | null {
		const carried = this.carried(restores);
		if (this.stash?.forSlot === restores) this.stash = null;
		if (carried.length === 0) return slot;
		// A retry consumed whole by conflicts or missing notes installs nothing and
		// the spent-slot rule has cleared it — but the prefix the FAILED attempt did
		// restore is still coherently redoable, and the carried redo is all of it.
		if (!slot || slot === restores) return carried;
		return [...carried, ...slot];
	}

	/**
	 * A replay of `restores` failed at `finished` of `batch` (newest-first).
	 * Returns the unfinished remainder for the slot — the next undo finishes
	 * taking the change back instead of redoing the prefix — and stashes the
	 * prefix's redo (`installed`, when the failed run installed one) toward that
	 * retry's completion. Chained failures accumulate into one stash.
	 */
	failed(
		restores: RestoreWrite[],
		batch: RestoreWrite[],
		finished: number,
		installed: RestoreWrite[] | null,
	): RestoreWrite[] {
		const remainder = batch.slice(finished).reverse();
		const prefixRedo = installed && installed !== restores ? installed : [];
		this.stash = { forSlot: remainder, redo: [...this.carried(restores), ...prefixRedo] };
		return remainder;
	}

	/**
	 * What the undo slot becomes once a replay of `restores` has run — the whole
	 * verdict in one place, because "completed" and "failed partway" are two answers
	 * to one question and the view had them as two branches beside each other. A
	 * replay that threw on the FIRST file installed nothing and finished nothing, so
	 * the original slot (and any stash pointed at it) simply stays for the retry.
	 */
	settle(
		ok: boolean,
		restores: RestoreWrite[],
		batch: RestoreWrite[],
		tracker: ReplayTracker,
		slot: RestoreWrite[] | null,
	): RestoreWrite[] | null {
		if (ok) return this.completed(restores, slot);
		if (tracker.finished > 0 && tracker.finished < batch.length) {
			return this.failed(restores, batch, tracker.finished, slot);
		}
		return slot;
	}

	/** The stashed redo waiting on `restores`; [] when the stash is for another batch. */
	private carried(restores: RestoreWrite[]): RestoreWrite[] {
		return this.stash?.forSlot === restores ? this.stash.redo : [];
	}
}

/** Say what an undo could not put back; a clean undo shows in the tree itself. */
function reportRestoreOutcome(outcome: RestoreOutcome): void {
	const parts: string[] = [];
	if (outcome.conflicts > 0) {
		parts.push(`${outcome.conflicts} value${outcome.conflicts === 1 ? ' was' : 's were'} edited since and kept`);
	}
	if (outcome.missing > 0) {
		parts.push(`${outcome.missing} note${outcome.missing === 1 ? '' : 's'} no longer exist`);
	}
	if (parts.length > 0) new Notice(`Undo: ${parts.join('; ')}.`);
}
