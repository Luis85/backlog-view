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
 * Every path that redraws CONTENT calls it — not only a full render — and the caller does
 * not have to work out which of the four its own change touches. The content-only paths
 * are the shelf's four picks (its disclosure, its sort, its type filter and its search), a
 * band fold on the resources axis, and a column fold on either board; `ViewStateController`
 * is where they are, each on `renderTreeContent`. Two of the four move on them today:
 * they change which cards and rows drew a disclosure, so the collapse controls go inert or
 * come back, and they change which bars are left on the grid, so the last bar drawing a
 * colour can leave the legend or the first arrive. The count and the fit do not move on
 * those paths — they are here because this is also the full render's post-content step,
 * and because a seventh content-only path must not have to prove which two it may skip.
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
