import { setTooltip } from 'obsidian';
import { createCard } from './board';
import { RowContext } from './columns';
import { drawIcon } from './icons';
import { renderBadge, renderTitleText } from './rows';
import { TimelineRow } from '../../domain/bars';
import { BacklogItem } from '../../domain/model';
import { ResourceLane } from '../../domain/roadmap';

/**
 * WHAT the grid draws and in what order — `TimelineEntry` and the two axes' entry lists —
 * plus how the resources axis's own two additions are drawn: a header per resource, and
 * the bar-less row an excluded note gets inside one.
 *
 * Both halves live here rather than in `./timeline.ts`, for two reasons that point the
 * same way. The import has to run one direction only: the grid draws these rows, so the
 * grid imports this module, and the entry vocabulary it takes as a parameter cannot then
 * be declared over there. And `timeline.ts` is at its 400-line budget — an entry list the
 * resources axis made necessary belongs beside the rows that made it necessary.
 *
 * Everything else about the grid is the dated axis's and is untouched: the window, the day
 * header, the gridlines, the today line, the milestone lines, the dependency layer and the
 * drop overlay are all derived from the bars in the list handed over, which is what makes
 * rows cost no second grid.
 */

/**
 * One thing the grid draws, in draw order. The dated axis produces nothing but `row`
 * entries; the resources axis interleaves a `lane` header before each row's group, and a
 * `context` entry for a note the Base excluded that the row places but cannot position.
 *
 * An ENTRY list rather than a row list, because lanes then cost no second grid: the
 * window, the day header, the gridlines, the today line, the drop overlay and the
 * dependency layer are all derived from the bars in this list and are the same for both
 * axes. A second renderer over the same geometry is what would drift.
 */
export type TimelineEntry =
	| { kind: 'lane'; lane: ResourceLane }
	| { kind: 'row'; row: TimelineRow }
	| { kind: 'context'; item: BacklogItem };

/** The dated axis's own entries: every row, in order, and nothing else. */
export function barEntries(rows: TimelineRow[]): TimelineEntry[] {
	return rows.map((row): TimelineEntry => ({ kind: 'row', row }));
}

/**
 * The resources axis's entries: each row's header, then its bars, then any note the Base
 * excluded that the row places but cannot position — last, because such a note has no
 * position for anything to interleave it by.
 *
 * A row is FLAT: no chevron, no ancestry collapse. Membership is the note's own assignee,
 * so a parent and its child routinely sit in different rows, and the collapse bit is keyed
 * by PATH — an ancestry fold here would let one person's chevron hide another person's
 * bar. Which is why every row carries `hasChildren: false` rather than asking
 * `timelineRows`: there is no disclosure to compute, and so none to key.
 */
export function laneEntries(lanes: ResourceLane[]): TimelineEntry[] {
	const entries: TimelineEntry[] = [];
	for (const lane of lanes) {
		entries.push({ kind: 'lane', lane });
		for (const bar of lane.bars) {
			entries.push({ kind: 'row', row: { bar, hasChildren: false, collapsed: false } });
		}
		for (const item of lane.context) entries.push({ kind: 'context', item });
	}
	return entries;
}

/**
 * One resource's header row. The lead is `.pbl-timeline-lead` like every row's, so it
 * sticks and sizes off the one `--pbl-tl-lead` the grid publishes, and the empty track
 * carries the header's band across the day area.
 *
 * The count is RESULT bars, exactly as a bucket's count is: a context row placed here is
 * placement, not population.
 *
 * **The accessibility cost, stated rather than smoothed over.** This is a div among
 * `option` rows inside a pane that is a `listbox` while cards render, and it labels the
 * rows below it by nothing but proximity — a header cannot be their container, because
 * every row is positioned against one shared day grid. So the resource's name goes onto
 * each of its rows as well (`renderLaneRowDescription`) and this header claims no role of
 * its own. Same accepted deviation as the lead-resize grip's; how a screen reader
 * actually reads it is a live-vault check this harness cannot make.
 */
export function renderLaneHead(ctx: RowContext, content: HTMLElement, lane: ResourceLane): void {
	const head = content.createDiv({
		cls: 'pbl-lane-head' + (lane.declared ? '' : ' pbl-lane-undeclared'),
	});
	const lead = head.createDiv({ cls: 'pbl-timeline-lead' });
	lead.createSpan({ cls: 'pbl-lane-name', text: lane.name });
	lead.createSpan({ cls: 'pbl-lane-count', text: String(lane.bars.length) });
	if (!lane.declared) {
		const mark = lead.createSpan({ cls: 'pbl-lane-stray' });
		drawIcon(mark, 'circle-help');
		setTooltip(
			head,
			`"${lane.name}" is not one of the declared resources. Add it to "Resources (in order)" in the view options, or re-assign its items.`,
		);
	}
	head.createDiv({ cls: 'pbl-timeline-track' });
}

/**
 * A note the Base excluded, drawn in the row that places it. It renders, it says whose
 * row it is in, and that is all: no bar, own dates or inferred, because the dated axis
 * this one derives from never draws a context row's dates either — `deriveBars` routes
 * one to the context collection before `placeItem` is asked about it. So there is no
 * "what if it has no date" case to answer separately here.
 */
export function renderLaneContextRow(ctx: RowContext, content: HTMLElement, item: BacklogItem): HTMLElement {
	const row = createCard(ctx, content, item);
	row.addClass('pbl-timeline-row');
	row.addClass('pbl-lane-context');
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderBadge(ctx.host, lead, item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	renderTitleText(ctx.host, title, item.title);
	setTooltip(lead, item.title);
	row.createDiv({ cls: 'pbl-timeline-track' });
	return row;
}

/**
 * Whose row this is, on the row itself. A DESCRIPTION rather than a label: a label would
 * replace the content-derived accessible name and cost a reader the badge, the title and
 * the dates — `renderCardBody`'s outside-filter marker makes the same choice for the same
 * reason.
 */
export function renderLaneRowDescription(row: HTMLElement, name: string): void {
	row.setAttribute('aria-description', `Assigned to ${name}`);
}
