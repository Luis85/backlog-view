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

interface WatchedNote {
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
	private watched: WatchedNote[] = [];

	/**
	 * A write is going out to this note; the next data pass answers for whether it
	 * still shows. Armed BEFORE the write, never after: the pass that answers can
	 * land inside the write's own await. A note moved twice before its refresh is
	 * answered for once, under the title it now carries.
	 */
	after(file: TFile, title: string): void {
		this.watched = this.watched.filter((note) => note.file.path !== file.path);
		this.watched.push({ file, title });
	}

	/** The write never landed, so there is nothing to answer for. */
	clear(file: TFile): void {
		this.watched = this.watched.filter((note) => note.file.path !== file.path);
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
		const notes = this.watched;
		this.watched = [];
		for (const note of notes) {
			const gone = verdict(note.file);
			if (gone) reportOne(note, gone, open);
		}
	}
}

function reportOne(note: WatchedNote, gone: Vanished, open: (file: TFile, evt: MouseEvent) => void): void {
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
