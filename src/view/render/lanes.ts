import { setTooltip } from 'obsidian';
import { createCard } from './board';
import { RowContext } from './columns';
import { drawIcon } from './icons';
import { renderBadge, renderTitleText } from './rows';
import { newItemType, promptCreateItem } from '../interactions/create';
import { Absence } from '../../domain/absences';
import { TimelineRow } from '../../domain/bars';
import { BacklogItem } from '../../domain/model';
import { ResourceLane } from '../../domain/roadmap';
import { barGeometry, formatCivil, MIN_BAR_PX, TimelineScale, TimelineWindow } from '../../domain/timeline';

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
	| { kind: 'absence'; absence: Absence }
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
		// Absences lead the band: an unavailable stretch is a fact about the ROW, and the
		// work in it reads against that rather than the other way round. One entry each —
		// two overlapping stretches are two lines, never packed into one (4a), because a
		// packing rule is a second geometry to keep in step with the one the bars use.
		for (const absence of lane.absences) entries.push({ kind: 'absence', absence });
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
 *
 * Returns the element, so the caller can wire it: this module draws a row's header and
 * has no opinion about what dropping on one should write. Not being a container is what
 * makes that the caller's problem per ELEMENT rather than once per band.
 */
export function renderLaneHead(ctx: RowContext, content: HTMLElement, lane: ResourceLane): HTMLElement {
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
	renderLaneNew(ctx, lead, lane);
	head.createDiv({ cls: 'pbl-timeline-track' });
	return head;
}

/**
 * Create straight into this row. The New flow runs exactly as the toolbar's — the same
 * config gate, the same type folders, the same type it would offer — with this row's
 * resource written inside the one `createBacklogItem` call, so a note never sits in a row
 * its own frontmatter does not claim.
 *
 * Unlike a bucket's, that write does not DRAW the card in the row: creation supplies no
 * date, so the note is unplaceable the moment it is read back and shelves on the same
 * refresh. `createFromPrompt` says so in its Notice rather than letting a click on a
 * specific row silently produce a card somewhere else.
 *
 * `tabindex="-1"` like the bucket's and the tree's: the pane is one tab stop and a row is
 * not a keyboard stop of its own. The capability is not lost, only the shortcut — the
 * toolbar's New button is an ordinary tab stop, and Set assignee names any resource from
 * the row menu. Closing that gap properly means row stops, which is
 * `docs/requirements/Keyboard and menu on the roadmap.md`'s work.
 */
function renderLaneNew(ctx: RowContext, lead: HTMLElement, lane: ResourceLane): void {
	const host = ctx.host;
	const model = host.model;
	if (!model) return;
	const type = newItemType(host.settings, model);
	const btn = lead.createEl('button', {
		cls: 'clickable-icon pbl-lane-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': `New ${type} for ${lane.name}` },
	});
	drawIcon(btn, 'plus');
	setTooltip(btn, `New ${type} for "${lane.name}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { assignee: lane.name }));
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
 * One unavailable stretch, drawn where a bar would be drawn and by the same arithmetic —
 * `barGeometry` against the same window, so a stretch and the work it crosses cannot
 * disagree about which day is which.
 *
 * NOT a card: `createCard` gives a `BacklogItem` its selection, its context styling and
 * its place in the pane's roving walk, and an absence is none of those things — it is not
 * in `roadmap.cards`, cannot be selected, and has no note-opening activation. What it has
 * is a title, a range, and (from Task 6) a context menu to delete it.
 *
 * The dates go in the row's own accessible name rather than on the mark: the mark is a
 * plain div, where ARIA prohibits a name, and a reader who cannot see the stretch needs
 * to be told which days it covers — which no neighbouring element says for it. Whose row
 * it is in is `renderLaneRowDescription`'s, exactly as it is for every other row of the
 * band.
 */
export function renderLaneAbsence(
	content: HTMLElement,
	absence: Absence,
	ruler: { window: TimelineWindow; scale: TimelineScale },
): HTMLElement {
	const { window, scale } = ruler;
	const row = content.createDiv({ cls: 'pbl-timeline-row pbl-absence-row' });
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	drawIcon(lead.createSpan({ cls: 'pbl-absence-icon', attr: { 'aria-hidden': 'true' } }), 'user-x');
	const title = lead.createDiv({ cls: 'pbl-card-title', text: absence.title });
	setTooltip(title, absence.title);
	const track = row.createDiv({ cls: 'pbl-timeline-track' });
	const geometry = barGeometry(window, { start: absence.start, target: absence.target });
	const mark = track.createDiv({ cls: 'pbl-absence' });
	mark.setCssProps({
		'--pbl-bar-left': `${geometry.startDay * scale.dayPx}px`,
		'--pbl-bar-width': `${Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = `${formatCivil(absence.start)} → ${formatCivil(absence.target)}`;
	setTooltip(mark, dates);
	row.setAttribute('aria-label', `${absence.title} — unavailable ${dates}`);
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
