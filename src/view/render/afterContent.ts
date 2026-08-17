import { renderLegend } from './legend';
import { syncCollapseCtls, syncCountLabel } from './toolbar';
import { syncToolbarFit } from './toolbarFit';
import { BacklogViewHost } from '../host';

/**
 * Everything that has to run AFTER the content render, because every one of them reads
 * what that render just produced rather than what the settings say.
 *
 * One subject, and a list that only grows: `renderTreeContent` had accumulated four of
 * these plus the reasoning for each, which is the "render orchestration" seam
 * `docs/tasks/Split the view dispatch hub again.md` names. Gathering them here is what
 * makes "after the content, not in the toolbar pass" one decision instead of four
 * comments a reader has to notice agree.
 *
 * Every path that redraws CONTENT calls it — not only a full render. A filter re-renders
 * the content alone, and it can change every one of these: the count becomes "3 of 18",
 * the collapse controls go inert, the last bar drawing a colour can leave the grid (or the
 * first arrive), and all three change the row's width.
 */
export function syncAfterContent(host: BacklogViewHost, els: { toolbarEl: HTMLElement; legendEl: HTMLElement }): void {
	syncCountLabel(host, els.toolbarEl);
	// Beside `syncCountLabel` for the same reason: both read the frame that just drew.
	syncCollapseCtls(host, els.toolbarEl);
	// The legend keys what the grid drew, and `drawn` comes off the snapshot this pass
	// produced — never a predicate over the results, which cannot see what geometry a bar
	// ended up with.
	const drawn = host.roadmap?.drawn ?? {
		done: false,
		milestone: false,
		iteration: false,
		accent: false,
		absence: false,
		daysLost: false,
	};
	renderLegend(host, els.legendEl, host.roadmap?.palettes ?? [], drawn);
	// LAST, and after the content rather than with the toolbar: the row's width can have
	// changed because the projection zone was rebuilt, or the count label grew, or the
	// primary button is naming a different type — and the count is one of the things this
	// measures, so it has to have been written already.
	syncToolbarFit(els.toolbarEl);
}
