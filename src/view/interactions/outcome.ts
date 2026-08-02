import { Notice, TFile } from 'obsidian';

/**
 * What became of a note a write just changed.
 *
 * A Base can filter on the very property a move writes — `status != Done` beside a
 * Done column, a base scoped to one horizon — so a perfectly legitimate write can
 * take its own note out of the view. The write stands: it is exactly what the user
 * asked for, and undo still takes it back, its authorization captured while the note
 * was a result. What must not happen is the note vanishing without a word.
 *
 * Compatibility is detected by OUTCOME, never predicted. A Bases filter is opaque to
 * this view — there is nothing to consult — so the only honest test is whether the
 * pass that follows the write still shows the note.
 */

/** How long the report stays up. Longer than a plain notice: it carries an action. */
const REPORT_MS = 10000;

/**
 * Why a watched note is no longer on screen. Two ways out, and they are not the same
 * message: the Base rejected it, or the same write finished it while completed items
 * are hidden. The caller knows which — this module must not guess, because a report
 * naming the wrong cause sends the reader to fix the wrong thing.
 */
export type Vanished = 'filtered' | 'completed';

/**
 * One write waiting on the pass that answers for it. Identity is the token: the
 * caller holds the object it armed and hands it back, so resolving a write can
 * never resolve a DIFFERENT write to the same note — which is what a path-keyed
 * handle did, dropping an outstanding first move when a second one failed.
 */
export interface Watch {
	file: TFile;
	/** Captured with the note, because by report time the item may be gone. */
	title: string;
}

export class OutcomeWatch {
	/**
	 * Every write still waiting on the pass that answers for it — a list, not a slot.
	 * A move whose refresh has not arrived yet does not stop the user making another,
	 * and a slot would drop the first one's answer on the floor: the note it moved
	 * could then leave a filtered Base in silence, which is the whole failure this
	 * class exists to prevent. Drained entirely by every data pass, and each entry is
	 * a file reference and a string, so it needs no cap — one that dropped the oldest
	 * would lose exactly what this is keeping.
	 */
	private watched: Watch[] = [];

	/**
	 * A write is going out to this note; the next data pass answers for whether it
	 * still shows. Armed BEFORE the write, never after: the pass that answers can
	 * land inside the write's own await. Returns the handle the caller resolves it
	 * with once the write is done.
	 */
	after(file: TFile, title: string): Watch {
		const watch: Watch = { file, title };
		this.watched.push(watch);
		return watch;
	}

	/** The write never landed, so there is nothing to answer for — this one only. */
	dropped(watch: Watch): void {
		this.watched = this.watched.filter((note) => note !== watch);
	}

	/**
	 * The write landed. Any EARLIER watch on the same note is superseded: the note
	 * now holds this write's value, so whether the previous one would have taken it
	 * off screen is a question about a state that no longer exists.
	 *
	 * Superseding happens HERE and not at arming time. Arming replaced the earlier
	 * watch outright, so a second move that then failed at the write left the first
	 * — which had landed, and whose refresh was still coming — with nothing watching
	 * it at all.
	 */
	landed(watch: Watch): void {
		const upto = this.watched.indexOf(watch);
		if (upto < 0) return;
		this.watched = this.watched.filter(
			(note, index) => note === watch || index > upto || note.file.path !== watch.file.path,
		);
	}

	/**
	 * Answer for every note still waiting, once each. Says so when one is no longer on
	 * screen and offers the way back to it; drains the list either way, so a write is
	 * answered for exactly once and a later pass cannot re-report it.
	 *
	 * Call this from the DATA pass, never from every render: a re-render the user
	 * caused — typing in the quick filter — can hide a note for a reason that is not
	 * this write, and reporting that would blame the write for the filter.
	 */
	report(verdict: (file: TFile) => Vanished | null, open: (file: TFile, evt: MouseEvent) => void): void {
		// Only the NEWEST watch on a note answers for it. A note has one current state,
		// so an earlier write's watch cannot be asking a live question about it — and
		// letting it try produced two notices about one card, since both watches saw
		// the same "gone". The earlier ones are HELD rather than resolved: a newer
		// write that then fails is dropped, and the watch it superseded has to still be
		// there to take over. `landed` is what finally removes them, once the write
		// they were superseded by is on disk.
		const newest = new Map<string, Watch>();
		for (const note of this.watched) newest.set(note.file.path, note);

		const resolved = new Set<Watch>();
		let answering = 0;
		for (const note of this.watched) {
			if (newest.get(note.file.path) !== note) continue;
			const gone = verdict(note.file);
			// Gone is final wherever it is seen: a result set that has stopped
			// returning a note is not going to start again on this write's account.
			if (gone) {
				reportOne(note, gone, open);
				resolved.add(note);
			} else if (answering === 0) {
				// "Still shown" is only trustworthy for the OLDEST write still waiting.
				// Writes are serialized and each produces one response, so the responses
				// arrive in order: the first pass after a move is the PREVIOUS move's,
				// computed before this one's value reached disk, and it lists this note
				// only because it has not looked since. Retiring on it would mark a move
				// answered that nothing has answered — the silence this class exists to
				// prevent, one step further along than the single slot it replaced.
				//
				// Bounded by construction: the first answering watch always resolves, so
				// every pass shortens the list while it is non-empty.
				//
				// KNOWN LIMIT, and it is the assumption in the paragraph above: that
				// every pass belongs to a queued write. Passes also arrive from an edit
				// in another pane, a rename, any vault change, and one of those landing
				// between a move and its own response retires the move's watch on a
				// result set that predates it. The move then leaves the base silently.
				//
				// It is left rather than patched because the correlation that would
				// close it does not exist here. Checking that the note now carries what
				// the write wrote proves the METADATA CACHE has seen it, which is
				// upstream of the Bases query and true of a stale result set too;
				// nothing in a result set says which write it was computed after.
				// Recorded, with the two ways out, in
				// `docs/issues/The outcome report was built from one sentence.md`.
				resolved.add(note);
			}
			answering++;
		}
		this.watched = this.watched.filter((note) => !resolved.has(note));
	}
}

function reportOne(note: Watch, gone: Vanished, open: (file: TFile, evt: MouseEvent) => void): void {
	const why =
		gone === 'completed'
			? `"${note.title}" is finished, and completed items are hidden, so it left the view.`
			: `"${note.title}" no longer matches this base’s filter, so it left the view.`;
	const notice = new Notice(why, REPORT_MS);
	// `messageEl` rather than the deprecated `noticeEl`: an action inside the message
	// is the whole point — a report that a note vanished, with no way to reach it,
	// leaves the user worse off than the silence it replaced.
	//
	// A real `<button>`, not a bare `<a>`: an anchor with no `href` is not focusable,
	// so the way back would be pointer-only — and the user most likely to lose a card
	// they can no longer see is the one driving by keyboard. A notice is ordinary UI
	// outside the tree's single-tab-stop model, so the element type follows the
	// toolbar's rule rather than the row's.
	const action = notice.messageEl.createEl('button', {
		cls: 'pbl-notice-open',
		text: 'Open the note',
		attr: { type: 'button' },
	});
	action.addEventListener('click', (evt) => {
		notice.hide();
		open(note.file, evt);
	});
}
