import { RestoreWrite } from '../storage/frontmatter';
import { UndoRecovery } from './interactions/undo';

/**
 * The vault-wide half of the write path: one batch at a time and one undo slot,
 * whichever view wrote. Created once in `main.ts` and handed to every view's
 * gate — a gate per view would be two views racing on one vault with two ideas
 * of what "the last batch" was (ADR 0030). The per-view halves — validation,
 * the outside-filter refusal, busy publication — stay in `WriteGate`.
 */
export class WriteLock {
	/** A batch is in flight somewhere in the plugin. */
	applying = false;
	/** Inverses of the vault's most recent effective batch, in write order. */
	lastUndo: RestoreWrite[] | null = null;
	/** Keeps undo and redo coherent when a replay fails partway. */
	readonly recovery = new UndoRecovery();
	private readonly listeners = new Set<() => void>();

	/** A view's busy-sync follows the lock while the view lives; returns the unsubscribe. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Tell every live view the lock changed — the OTHER view's undo button follows the
	 * slot, and every view with a data update deferred on this batch rebuilds from it.
	 *
	 * Each listener is isolated, because a listener does real work: it publishes chrome
	 * and it can run a whole rebuild, so any bug in one view's render would otherwise
	 * reach the WRITING gate — which calls this from `setBusy`, once outside its own
	 * `try` (leaving `applying` stuck true and the plugin's write path dead) and once
	 * inside its `finally` (reporting a batch that landed as failed, and skipping every
	 * later listener's flush). One view's failure is not the vault's.
	 */
	notify(): void {
		for (const listener of this.listeners) {
			try {
				listener();
			} catch (e) {
				console.error('Product Backlog: a view failed to follow the write lock', e);
			}
		}
	}
}
