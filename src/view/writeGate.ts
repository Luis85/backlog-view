import { Notice } from 'obsidian';
import { BacklogViewHost, BusyState } from './host';
import { ItemWrite } from '../domain/writePlan';
import { configProblems } from '../domain/settings';
import { applyWrites, RestoreWrite, WriteOutcome } from '../storage/frontmatter';
import { ReplayTracker, replayRun, UndoRecovery } from './interactions/undo';

/**
 * How the gate reaches the view it guards. Both are the view's own elements — the
 * toolbar's indicator and the tree — which the gate never touches: it owns the write
 * path, the undo slot and the busy VALUE, and hands the publishing back.
 */
export interface WriteGateHooks {
	/** Publish the gate's current progress and undo availability to the chrome. */
	syncBusy(): void;
	/** Rebuild from the data update that arrived mid-batch, now the batch has ended. */
	flushDataUpdate(): void;
}

/**
 * The write gate every batch passes: config validation, one batch at a time,
 * progress publication, and the single-level undo slot. Extracted from the view
 * because it is the one cluster there with state of its own — nothing outside
 * reads `applying`, the slot or the deferred update — and the view is the hub
 * every projection increment has to add a line to.
 */
export class WriteGate {
	private applying = false;
	/**
	 * Inverses of the most recent effective batch, in write order — the single-level,
	 * session-only undo. Replaced only by a batch that actually changed something.
	 */
	private lastUndo: RestoreWrite[] | null = null;
	/** Keeps undo and redo coherent when a replay fails partway — see UndoRecovery. */
	private readonly recovery = new UndoRecovery();
	/** A data update that arrived mid-batch and is waiting for it to finish. */
	private pendingDataUpdate = false;
	/** Progress of the batch in flight; null when idle. Drives the toolbar indicator. */
	busy: BusyState | null = null;

	constructor(
		private readonly host: BacklogViewHost,
		private readonly hooks: WriteGateHooks,
	) {}

	/**
	 * Record a data update, answering whether it has to wait. Every file a batch
	 * touches comes back as its own data update, and rebuilding the model and every
	 * row for each one is the one thing that genuinely stalls this view — a backfill
	 * over a large backlog would do it hundreds of times, each render showing a
	 * half-applied tree. The refresh waits for the batch and then runs once, against
	 * the final state.
	 */
	deferUpdate(): boolean {
		if (!this.applying) return false;
		this.pendingDataUpdate = true;
		return true;
	}

	async applySafely(writes: ItemWrite[]): Promise<WriteOutcome | null> {
		if (writes.length === 0) return null;
		// Notes the Base excluded are context, and nothing may write to them: the
		// controls that could are withheld and the auto-type cascade stops at them.
		// If one still arrives, the batch is refused whole — dropping just that write
		// would apply the rest and leave the hierarchy half-updated.
		if (writes.some((w) => this.host.model?.byPath.get(w.file.path)?.outsideFilter === true)) {
			console.error('Product Backlog: refused a batch writing to a note outside the filter', writes);
			new Notice('That change would edit a note outside this base’s filter, so nothing was written.');
			return null;
		}
		return this.runExclusively(writes.length, (onProgress, onInverse) =>
			applyWrites(this.host.app, this.host.settings, writes, onProgress, onInverse),
		);
	}

	canUndo(): boolean {
		return this.lastUndo !== null && this.lastUndo.length > 0;
	}

	async undoLast(): Promise<boolean> {
		const restores = this.lastUndo;
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
		const ok = (await this.runExclusively(batch.length, replayRun(this.host.app, batch, tracker), restores)) !== null;
		// What the slot becomes is the recovery's question, not the gate's: a
		// completed replay rejoins any redo stranded by the failure it recovered
		// from, and one that failed partway holds its place with the unfinished
		// remainder, so the next undo finishes taking the change back.
		this.lastUndo = this.recovery.settle(ok, restores, batch, tracker, this.lastUndo);
		// The closing sync ran before this bookkeeping settled the slot — a consumed
		// retry re-arms the carried redo AFTER setBusy(null) disabled the button — so
		// publish the settled answer.
		this.hooks.syncBusy();
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
		const problems = configProblems(this.host.settings);
		if (problems.length > 0) {
			// Writing with e.g. parent and order on the same key would corrupt notes.
			new Notice(`Fix the view options first: ${problems[0]}`);
			return null;
		}
		if (this.applying) {
			new Notice('Still applying the previous change — try again in a moment.');
			return null;
		}
		this.applying = true;
		this.setBusy({ done: 0, total });
		const inverses: RestoreWrite[] = [];
		let installed = false;
		let completed = false;
		const onInverse = (inverse: RestoreWrite) => {
			if (!installed) {
				installed = true;
				this.lastUndo = inverses;
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
			if (replaying && completed && !installed && this.lastUndo === replaying) {
				this.lastUndo = null;
			}
			this.applying = false;
			this.setBusy(null);
			// Whatever landed while the batch ran gets one rebuild, now, against the
			// finished state. A failed batch takes this path too: the writes before the
			// failure are applied, and the tree has to show what is actually on disk.
			if (this.pendingDataUpdate) {
				this.pendingDataUpdate = false;
				this.hooks.flushDataUpdate();
			}
		}
	}

	/** Publish batch progress through the hook; the gate itself renders nothing. */
	private setBusy(state: BusyState | null): void {
		this.busy = state;
		this.hooks.syncBusy();
	}
}
