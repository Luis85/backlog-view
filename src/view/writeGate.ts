import { App, Notice, TFile } from 'obsidian';
import { BusyState } from './host';
import { t } from '../i18n/t';
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
	/** Whether the batch `applySafely` most recently ran already rebuilt this view through
	 *  its own deferred-update flush — see `flushedLastBatch`. */
	private flushedOnLastBatch = false;
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
		this.flushedOnLastBatch = true;
		this.hooks.flushDataUpdate();
	}

	/**
	 * True once, right after `applySafely` resolves, when that very batch's own deferred
	 * update already rebuilt this view (`followLock`'s flush). A caller that always
	 * refreshes after a write reads this to skip a second full rebuild of the state the
	 * flush already drew. The estimation view has TWO such readers, and the split follows
	 * who PLANNED the write rather than taste: the four `perform*` actions all hand a
	 * planner's output to `EstimationView.applyPlan`, which reads this once for all of
	 * them, while `runEstimationInit` (`estimation/init.ts`) builds its own backfill batch,
	 * calls `applySafely` itself and so reads this itself after it. Nothing checks that a
	 * third caller remembers to — this is a fact about these two, not an invariant.
	 */
	get flushedLastBatch(): boolean {
		return this.flushedOnLastBatch;
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
		// Reset before every branch below, including the empty-batch return right after it:
		// `flushedLastBatch` answers for THIS call, and any refusal here — empty, outside-filter,
		// or `runExclusively`'s own config/lock checks — flushed nothing, whatever the previous
		// call left behind.
		this.flushedOnLastBatch = false;
		if (writes.length === 0) return null;
		// Notes the Base excluded are context, and nothing may write to them: the
		// controls that could are withheld and the auto-type cascade stops at them.
		// If one still arrives, the batch is refused whole — dropping just that write
		// would apply the rest and leave the hierarchy half-updated.
		if (writes.some((w) => this.host.outsideFilter(w.file.path))) {
			console.error('Product Backlog: refused a batch writing to a note outside the filter', writes);
			new Notice(t('gate.outsideFilter'));
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
			new Notice(t('gate.nothingToUndo'));
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
	 * A vault write that is not a frontmatter batch — the release notes file today.
	 *
	 * Reading `writing` is not the same as HOLDING the lock: generation awaits a folder
	 * create and a file write, and a sibling batch starting inside that window would run
	 * concurrently, landing this file from a membership that has since changed. This takes
	 * the same exclusive section every batch takes.
	 *
	 * It installs no undo slot, because nothing here reports an inverse — a whole-file
	 * write has no per-key restore to offer, which is exactly why the notes writer refuses
	 * another release's file rather than replacing it.
	 */
	runFileWrite<T>(run: () => Promise<T>): Promise<T | null> {
		return this.runExclusively(1, () => run());
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
				new Notice(t('config.fixFirst', { problem: problems[0] }));
				return null;
			}
		}
		if (this.lock.applying) {
			new Notice(t('gate.stillApplying'));
			return null;
		}
		this.lock.applying = true;
		// The batch STARTING is a vault-wide fact — every sibling gate's disabled state
		// follows `lock.applying`, so this one tick has to reach every subscriber.
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
			// Per-file progress is this view's own text, not a vault-wide fact: no sibling
			// gate's disabled state depends on it (that follows `lock.applying`, unchanged
			// between the batch's start and its end), so a tick publishes straight through
			// this gate's own hooks rather than fanning `lock.notify()` out to every
			// subscribed view for every file of a batch that can run into the hundreds.
			const result = await run((done, tot) => this.setOwnBusy({ done, total: tot }), onInverse);
			completed = true;
			return result;
		} catch (e) {
			console.error('Product Backlog: failed to update items', e);
			// Not `gate.updateFailed` — this gate is shared by every view's batch now
			// (ADR 0030), and that message names "backlog items" specifically. See the
			// key's own comment in en.ts.
			new Notice(t('writeGate.applyFailed'));
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

	/** Publish a vault-wide fact — batch start or end — through the lock, so every
	 *  subscribed gate's disabled state and deferred-update flush follow it. */
	private setBusy(state: BusyState | null): void {
		this.busy = state;
		this.lock.notify();
	}

	/** Publish this batch's own progress tick: text only, and only to this view's own
	 *  chrome. `lock.applying` does not change between a batch's start and its end, so a
	 *  sibling gate has nothing new to read here. */
	private setOwnBusy(state: BusyState): void {
		this.busy = state;
		this.hooks.syncBusy();
	}
}
