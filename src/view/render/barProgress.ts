import { setTooltip } from 'obsidian';
import { rollupReport } from './columns';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';

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
 * owns that distinction), and a lane context row draws no `.pbl-bar` at all. Those
 * surfaces still get their count, so each reports what it can draw and claims nothing
 * it cannot.
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
	mounts.row.createSpan({ cls: 'pbl-sr-only', text: report.tooltip || `${report.label} items` });
}
