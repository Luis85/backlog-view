import { App, Notice } from 'obsidian';
import { applyRestores, RestoreOutcome, RestoreWrite } from '../../storage/frontmatter';

/**
 * The undo replay, packaged for the view's write gate. The view owns the slot
 * (which batch is undoable) and the gate (one batch at a time); this module owns
 * running a replay and telling the user what it could not put back.
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

/** The restores a failed replay never reached, back in write order for the slot. */
export function unfinishedRemainder(batch: RestoreWrite[], finished: number): RestoreWrite[] {
	return batch.slice(finished).reverse();
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
