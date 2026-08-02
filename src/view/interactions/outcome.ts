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
 * pass that follows the write still shows the note. That also makes the answer cover
 * both ways a note can leave: the filter dropping it, and "Show completed items"
 * swallowing one that the same write finished.
 */

/** How long the report stays up. Longer than a plain notice: it carries an action. */
const REPORT_MS = 10000;

interface WatchedNote {
	file: TFile;
	/** Captured with the note, because by report time the item may be gone. */
	title: string;
}

export class OutcomeWatch {
	private watched: WatchedNote | null = null;

	/** A write landed on this note; the next data pass answers for whether it still shows. */
	after(file: TFile, title: string): void {
		this.watched = { file, title };
	}

	/**
	 * Answer for the watched note, once. Says so when it is no longer on screen and
	 * offers the way back to it; clears the watch either way, so one write is
	 * answered for exactly once and a later pass cannot re-report it.
	 *
	 * Call this from the DATA pass, never from every render: a re-render the user
	 * caused — typing in the quick filter — can hide the note for a reason that is
	 * not this write, and reporting that would blame the write for the filter.
	 */
	report(shown: (file: TFile) => boolean, open: (file: TFile, evt: MouseEvent) => void): void {
		const note = this.watched;
		if (!note) return;
		this.watched = null;
		if (shown(note.file)) return;
		const notice = new Notice(`"${note.title}" no longer matches this base’s filter, so it left the view.`, REPORT_MS);
		// `messageEl` rather than the deprecated `noticeEl`: an action inside the
		// message is the whole point — a report that a note vanished, with no way to
		// reach it, leaves the user worse off than the silence it replaced.
		const link = notice.messageEl.createEl('a', { cls: 'pbl-notice-open', text: 'Open the note' });
		link.addEventListener('click', (evt) => {
			notice.hide();
			open(note.file, evt);
		});
	}
}
