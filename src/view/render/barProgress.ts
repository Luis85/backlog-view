import { setTooltip } from 'obsidian';
import { RollupReport, rollupReport } from './columns';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { BarGeometry, MIN_BAR_PX } from '../../domain/timeline';

/**
 * How far along a dated row's subtree is, on the two surfaces a timeline row has:
 * a band inside the bar, and a count in the sticky lead cell.
 *
 * **The band is INSET inside the bar, never a wash over it**, and that is the whole
 * reason it is a band. A bar's own background is already carrying meaning three ways
 * in `styles/timeline.css` — `.pbl-bar-inferred` is `background: none` plus a dashed
 * border, `.pbl-bar-open-start` / `.pbl-bar-open-end` are gradients fading to
 * transparent, and their compound has a rule of its own. A child spanning the bar's
 * height would paint over every one of them, so at 100% done an open span would read
 * as stated and closed and an inference would read as a plan. Inset, no shape needs a
 * special case and none can be forgotten.
 *
 * **A track and a fill, in the tree's own two colours — never the bar's.** `.pbl-bar`
 * paints `background-color: var(--pbl-bar-color)`, so a band in that colour would be
 * invisible against an ordinary stated span at every percentage, which is the commonest
 * shape there is. `styles/columns.css` already solved this for the tree: a neutral
 * track (`--background-modifier-border`) with a green fill
 * (`rgb(var(--color-green-rgb))`). Copied rather than re-decided, so the band reads
 * against all eight state colours at once and looks like the progress this reader
 * already knows.
 *
 * **The count is not a consequence of the band.** With no workflow configured there is
 * no done to count, and `Progress on the bar` extension 1c still promises the tree's
 * descendant count in exactly that configuration — which a timeline row would never
 * show, since it calls `renderRollup` nowhere. So the count renders on its own terms
 * wherever the item has descendants: beside the band with a workflow, and as the whole
 * report without one.
 *
 * **Announced once, on the ROW, not only rendered in the lead cell.** The visible chip
 * sits inside the lead, and both bar rows and the lane context row already tooltip that
 * cell with the item's own title — which, in the real app, a tooltip may become an
 * `aria-label` for, and an `aria-label` REPLACES the cell's own text in the accessible
 * name, taking the count with it exactly as `stateNote` and `dependencyNote` already
 * have to plan around in `render/timeline.ts`. A `.pbl-sr-only` span on the row is that
 * same pattern applied here: the visible chip is not itself announced, so this is the
 * one place the fact is guaranteed reachable rather than a duplicate of it.
 *
 * `bar` is null where the shape takes no band — a milestone diamond, an
 * outside-window arrow are marks rather than spans (`markWidth` in `./barLabel.ts`
 * owns that distinction), a lane context row draws no `.pbl-bar` at all, and (see
 * `bandMount` below) a bar drawn at `MIN_BAR_PX` — too narrow for the two insets that
 * keep the band off the bar's own border and gradient to leave anything between them.
 * Those surfaces still get their count, so each reports what it can draw and claims
 * nothing it cannot.
 *
 * The words and the guard are `rollupReport`'s in `./columns.ts`, shared with the tree's
 * own renderer rather than restated here: one item cannot report its progress
 * differently per projection, which is what `Progress on the bar` guarantees, and two
 * copies of a string is how that comes apart.
 */
export function renderBarProgress(
	host: BacklogViewHost,
	mounts: { row: HTMLElement; bar: HTMLElement | null; lead: HTMLElement },
	item: BacklogItem,
): void {
	const report = rollupReport(host, item);
	// An empty label is the tree's leaf case, where it reserves an empty column for
	// alignment. A timeline row has no column to keep aligned, so it draws nothing.
	if (!report || !report.label) return;
	if (mounts.bar && report.ratio !== null) {
		const track = mounts.bar.createDiv({ cls: 'pbl-bar-progress' });
		track.createDiv({ cls: 'pbl-bar-progress-fill' }).setCssProps({
			'--pbl-progress': `${Math.round(report.ratio * 100)}%`,
		});
	}
	const label = mounts.lead.createSpan({ cls: 'pbl-bar-count', text: report.label });
	if (report.tooltip) setTooltip(label, report.tooltip);
	mounts.row.createSpan({ cls: 'pbl-sr-only', text: progressNote(report) });
}

/**
 * The words a row ANNOUNCES about its progress, or '' where there is nothing to say —
 * `rollupReport`'s long form, falling back to the face plus a noun where no workflow makes
 * a ratio (`8` alone announces a bare number).
 *
 * NOT exported since 2026-08-16. Its one outside caller was a marker's row, which carried an
 * explicit `aria-label` and folded these words into it because the label REPLACES the
 * content-derived name and took the span with it. A marker draws in the milestones' shared
 * row on both grid axes now and has no row at all, so nothing says its rollup — a stated
 * loss, recorded in [[Milestones out of the resource rows]] rather than kept as an export
 * with no consumer.
 */
function progressNote(report: RollupReport | null): string {
	if (!report || !report.label) return '';
	return report.tooltip;
}

/**
 * The `bar` argument `renderBarRow` hands `renderBarProgress`: the bar element
 * itself, or null for a shape that takes no band. Three of them, all marks rather
 * than ratio-bearing spans — a milestone diamond, an outside-window arrow, and (found
 * by review after this module shipped) a bar drawn at `MIN_BAR_PX`. The insets that
 * keep the band off an inferred border and an open end's gradient are 2px each, so a
 * floor-width bar has nothing left between them for a track to occupy. That inset
 * arithmetic is the whole rule: the guard is `<= MIN_BAR_PX`, which is exactly "the bar
 * is at the floor", and a bar one pixel wider draws its band like any other.
 *
 * `drawnWidthPx` is the width `renderBarRow` already computed for `--pbl-bar-width`
 * (`Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX)`) — read here rather than
 * recomputed, so the CSS and this decision can never disagree about how wide the bar
 * actually is.
 */
export function bandMount(
	el: HTMLElement,
	drawnWidthPx: number,
	geometry: Pick<BarGeometry, 'milestone' | 'outside'>,
): HTMLElement | null {
	return geometry.milestone || geometry.outside || drawnWidthPx <= MIN_BAR_PX ? null : el;
}
