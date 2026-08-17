import { App, Notice, TFile } from 'obsidian';
import { BusyState } from './host';
import { RestoreWrite, WriteOutcome } from '../storage/frontmatter';
import { ReplayTracker, replayRun } from './interactions/undo';
import { WriteLock } from './writeLock';

/**
 * How the gate reaches the view it guards. Both are the view's own elements — the
 * toolbar's indicator and the tree — which the gate never touches: it owns the write
 * path and the busy VALUE, and hands the publishing back.
 */
export interface WriteGateHooks {
	/** Publish the gate's current progress and undo availability to the chrome. */
	syncBusy(): void;
	/** Rebuild from the data update that arrived mid-batch, now the batch has ended. */
	flushDataUpdate(): void;
}

/** How the gate reaches the view it guards — narrow on purpose, so a second view can supply its own. */
export interface GateHost {
	/** The app, read at call time — a Bases view is handed its `app` after construction. */
	app(): App;
	/** Problems that block every write; each view validates its own settings. */
	writeProblems(): string[];
	/** True when this path is context this view's Base excluded — forward batches refuse whole. */
	outsideFilter(path: string): boolean;
}

/** The writer a forward batch runs — `applyWrites` for the backlog, `applyPropertyWrites` for estimation. */
export type ApplyRun<W> = (
	writes: W[],
	onProgress: (done: number, total: number) => void,
	onInverse: (inverse: RestoreWrite) => void,
) => Promise<WriteOutcome>;

/**
 * The write gate every batch passes: config validation, progress publication, and the
 * outside-filter refusal — the per-view half of the write path, and both of those
 * refusals are the FORWARD path's alone (a replay carries its authorization from capture
 * time and restores raw keys). The vault-wide half —
 * one batch at a time and the single-level undo slot, shared by every view — lives on
 * `WriteLock` (`writeLock.ts`), because a gate per view would be two views racing on one
 * vault with two ideas of what "the last batch" was (ADR 0030). What the gate publishes
 * is per view (`busy`) and what it says about the LOCK is not (`writing`): a batch is a
 * fact about the vault, and every view's chrome has to read it as one.
 */
export class WriteGate<W extends { file: TFile }> {
	/** A data update that arrived mid-batch and is waiting for it to finish. */
	private pendingDataUpdate = false;
	/** Progress of the batch in flight; null when idle. Drives the toolbar indicator. */
	busy: BusyState | null = null;
	private readonly unsubscribe: () => void;

	constructor(
		private readonly host: GateHost,
		private readonly hooks: WriteGateHooks,
		private readonly lock: WriteLock,
		private readonly apply: ApplyRun<W>,
	) {
		this.unsubscribe = lock.subscribe(() => this.followLock());
	}

	/**
	 * What this view does when the lock moves: publish, and — on the edge where the batch
	 * ENDS — rebuild from whatever landed while it ran. The flush is here rather than in
	 * `runExclusively`'s `finally` because `applying` is vault-wide: a SIBLING view defers
	 * its update on a batch whose `finally` it never reaches, so the writing gate's own
	 * exit released nobody but itself and every other view's update was swallowed for as
	 * long as it kept not being the one writing.
	 *
	 * Still synchronous inside that `finally` — `setBusy(null)` notifies from there — so
	 * "anything read after the await already sees the rebuilt model" holds unchanged, and
	 * a FAILED batch still rebuilds: the writes before the failure are on disk.
	 */
	private followLock(): void {
		this.hooks.syncBusy();
		if (this.lock.applying || !this.pendingDataUpdate) return;
		this.pendingDataUpdate = false;
		this.hooks.flushDataUpdate();
	}

	/**
	 * True while a batch is in flight ANYWHERE in the plugin. The chrome's disabled state
	 * follows this rather than `busy`, which is the writing view's own progress and null
	 * in every other view (ADR 0030): a sibling view showing enabled write controls
	 * offers a write the gate is about to refuse.
	 */
	get writing(): boolean {
		return this.lock.applying;
	}

	/** Stop following the lock — called from the view's own `onunload`. */
	dispose(): void {
		this.unsubscribe();
	}

	/**
	 * Record a data update, answering whether it has to wait. Every file a batch
	 * touches comes back as its own data update, and rebuilding the model and every
	 * row for each one is the one thing that genuinely stalls this view — a backfill
	 * over a large backlog would do it hundreds of times, each render showing a
	 * half-applied tree. The refresh waits for the batch and then runs once, against
	 * the final state.
	 */
	deferUpdate(): boolean {
		if (!this.lock.applying) return false;
		this.pendingDataUpdate = true;
		return true;
	}

	async applySafely(writes: W[]): Promise<WriteOutcome | null> {
		if (writes.length === 0) return null;
		// Notes the Base excluded are context, and nothing may write to them: the
		// controls that could are withheld and the auto-type cascade stops at them.
		// If one still arrives, the batch is refused whole — dropping just that write
		// would apply the rest and leave the hierarchy half-updated.
		if (writes.some((w) => this.host.outsideFilter(w.file.path))) {
			console.error('Product Backlog: refused a batch writing to a note outside the filter', writes);
			new Notice('That change would edit a note outside this base’s filter, so nothing was written.');
			return null;
		}
		return this.runExclusively(writes.length, (onProgress, onInverse) => this.apply(writes, onProgress, onInverse));
	}

	/**
	 * Whether there is something to take back AND anything may be written at all. The
	 * second half is not the button's business to remember: inverses install on the first
	 * EFFECTIVE write, so mid-batch the slot already holds the applied prefix — an undo
	 * button armed on the slot alone re-enabled in the middle of the very batch it would
	 * be undoing part of, in every view at once.
	 */
	canUndo(): boolean {
		return !this.lock.applying && this.lock.lastUndo !== null && this.lock.lastUndo.length > 0;
	}

	async undoLast(): Promise<boolean> {
		const restores = this.lock.lastUndo;
		if (!restores || restores.length === 0) {
			new Notice('Nothing to undo.');
			return false;
		}
		// No context-row check here, deliberately: authorization came at capture time.
		// This batch can only name files its forward batch wrote while they were
		// results — and the write being undone may itself have moved one out of the
		// filter, which is exactly the change the user is taking back. The current
		// model's verdict on those files answers a different question.
		const batch = [...restores].reverse();
		const tracker: ReplayTracker = { finished: 0 };
		const ok = (await this.runExclusively(batch.length, replayRun(this.host.app(), batch, tracker), restores)) !== null;
		// What the slot becomes is the recovery's question, not the gate's: a
		// completed replay rejoins any redo stranded by the failure it recovered
		// from, and one that failed partway holds its place with the unfinished
		// remainder, so the next undo finishes taking the change back.
		this.lock.lastUndo = this.lock.recovery.settle(ok, restores, batch, tracker, this.lock.lastUndo);
		// The closing sync ran before this bookkeeping settled the slot — a consumed
		// retry re-arms the carried redo AFTER setBusy(null) disabled the button — so
		// publish the settled answer.
		this.lock.notify();
		return ok;
	}

	/**
	 * The gate itself: serialized, validated, published, and the undo slot. Inverses
	 * install on the first EFFECTIVE write — a batch that changes nothing (a state
	 * re-set to itself) emits none and leaves the previous undo in place, while a
	 * batch that fails partway has already installed the applied prefix, which is
	 * exactly the part that still needs to be undoable.
	 */
	private async runExclusively<T>(
		total: number,
		run: (
			onProgress: (done: number, total: number) => void,
			onInverse: (inverse: RestoreWrite) => void,
		) => Promise<T>,
		replaying?: RestoreWrite[],
	): Promise<T | null> {
		// Forward batches only, the same split the outside-filter refusal makes and for the
		// same reason: a replay's authorization came at capture time, and it restores RAW
		// captured keys rather than planning against these settings — so a collision this
		// view's planner would corrupt notes with cannot be reached by one. Asking it of a
		// replay let a config problem in ONE view veto taking back a batch ANOTHER view
		// wrote, reported as a notice about options the undo never reads.
		if (!replaying) {
			const problems = this.host.writeProblems();
			if (problems.length > 0) {
				// Writing with e.g. parent and order on the same key would corrupt notes.
				new Notice(`Fix the view options first: ${problems[0]}`);
				return null;
			}
		}
		if (this.lock.applying) {
			new Notice('Still applying the previous change — try again in a moment.');
			return null;
		}
		this.lock.applying = true;
		this.setBusy({ done: 0, total });
		const inverses: RestoreWrite[] = [];
		let installed = false;
		let completed = false;
		const onInverse = (inverse: RestoreWrite) => {
			if (!installed) {
				installed = true;
				this.lock.lastUndo = inverses;
			}
			inverses.push(inverse);
		};
		try {
			const result = await run((done, tot) => this.setBusy({ done, total: tot }), onInverse);
			completed = true;
			return result;
		} catch (e) {
			console.error('Product Backlog: failed to update items', e);
			new Notice('Failed to update backlog items. See the developer console for details.');
			return null;
		} finally {
			// A replay that completed but restored nothing is SPENT, not retryable:
			// its conflicts stay conflicted and its missing notes stay missing, so
			// re-offering the same dead batch would make the undo button lie forever.
			// A forward batch that changed nothing keeps the slot (the whole point of
			// effective-only inverses), and so does a replay that FAILED — a
			// transient write error deserves its retry.
			if (replaying && completed && !installed && this.lock.lastUndo === replaying) {
				this.lock.lastUndo = null;
			}
			this.lock.applying = false;
			// Publishes the end of the batch, which is also what makes every gate flush
			// its own deferred update — this one's included. See `followLock`.
			this.setBusy(null);
		}
	}

	/** Publish batch progress through the lock; the gate itself renders nothing. */
	private setBusy(state: BusyState | null): void {
		this.busy = state;
		this.lock.notify();
	}
}
