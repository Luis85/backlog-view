import { setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { CivilDate } from '../../domain/noteFields';
import { MapCard, MapRow, ReleaseMap } from '../../domain/releaseMap';
import { ReleaseIndex } from '../../domain/releases';
import { BacklogSettings } from '../../domain/settings';
import { membershipCollision } from '../../domain/settingsConsistency';
import { barGeometry, BarGeometry, daysBetween, scaleFor, superCells, TimelineCell, timelineCells, TimelineWindow } from '../../domain/timeline';
import { centreOnToday } from '../render/projections';
import { renderGridLines } from '../render/timeline';
import { uniqueElementId } from '../selection';
import {
	bandLabel,
	drawAbsences,
	drawIndexActions,
	drawNote,
	drawProgressLine,
	drawStatus,
	drawUnresolved,
	drawVersion,
	drawWhen,
	overdueVisible,
	slipText,
} from './renderIndex';

/**
 * The index's Map tab (`docs/requirements/Every release on a map.md`): one row per dated
 * release under a month ruler, then the shelf, then the unresolved note.
 *
 * **It draws, and derives nothing.** Order, start, slip and shelf come from
 * `domain/releaseMap.ts`; every fact on a card is the list's own band part
 * (`renderIndex.ts`), so a card and a band cannot word one release differently.
 *
 * **Every element inside a row is a `<span>`**: the row is a `<button>`, whose content is
 * phrasing content only — `renderIndex.ts`'s `drawBand` states the rule.
 */

/** The map's one density: scale switching is out of scope, so `scaleFor`'s default is read once. */
const SCALE = scaleFor('month');

const px = (days: number): string => `${days * SCALE.dayPx}px`;

/** A card's width, published as `--pbl-relmap-card`. */
const CARD_PX = 280;
/** The space between a marker and its card, and past the card's end — `--pbl-relmap-gap`. */
const GAP_PX = 16;
/**
 * How many days the ruler and the grid run on past the window: enough to reach a gap past
 * a card drawn at the window's last day. The marks are still placed in the window alone.
 */
const GUTTER_DAYS = Math.ceil((GAP_PX + CARD_PX + GAP_PX) / SCALE.dayPx);

/** Where one date sits, clamped into the window — `barGeometry` asked of a point. */
const pointAt = (window: TimelineWindow, date: CivilDate): BarGeometry => barGeometry(window, { start: date, target: date });

/**
 * `arriving` is true when the map is the screen being CHANGED TO — the first mount, a tab
 * change, Back from a release — and false for a redraw of the map itself, whose place
 * `releaseView.render` keeps instead.
 */
export function renderMap(view: ReleaseView, map: ReleaseMap, index: ReleaseIndex, plan: BacklogSettings, arriving: boolean): void {
	drawIndexActions(view);
	const scroller = view.viewEl.createDiv({ cls: 'pbl-relmap-scroll' });
	const mapEl = scroller.createDiv({ cls: 'pbl-relmap' });
	const track: TimelineWindow = { start: map.window.start, days: map.window.days + GUTTER_DAYS };
	// `--pbl-tl-line` is what the reused `.pbl-today` reads for its width (`styles/timeline.css`).
	mapEl.setCssProps({
		'--pbl-relmap-track': px(track.days),
		'--pbl-relmap-card': `${CARD_PX}px`,
		'--pbl-relmap-gap': `${GAP_PX}px`,
		'--pbl-tl-line': `${SCALE.lineWidth}px`,
	});
	drawRuler(mapEl, map, track);
	const rowsEl = mapEl.createDiv({ cls: 'pbl-relmap-rows' });
	renderGridLines(rowsEl, track, SCALE, 0);
	const todayDay = pointAt(map.window, map.today).startDay;
	rowsEl.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } }).setCssProps({ '--pbl-today-left': px(todayDay) });
	const rowEls = map.rows.map((row) => drawRow(view, rowsEl, map.window, row));
	drawShelf(view, scroller, map.shelf);
	// The list's own note on unbound figures: an unbound target shelves every release in
	// flight, and an unbound released date ships none, and only this says why.
	drawAbsences(scroller, index.rows);
	drawUnresolved(scroller, index, membershipCollision(view.settings, plan));
	if (arriving) openAtToday(scroller, todayDay * SCALE.dayPx, map, rowEls);
}

/**
 * Open where the plan is NOW: today centred sideways, as the roadmap opens
 * (`centreOnToday`, with no lead column), and one row scrolled up to where the first row
 * sits — the earliest release painted overdue (`overdueVisible`, the list's own
 * condition), else the first release not yet past, else the last row. Two layout reads,
 * once per arrival and never on a redraw.
 */
function openAtToday(scroller: HTMLElement, todayPx: number, map: ReleaseMap, rowEls: HTMLElement[]): void {
	scroller.scrollLeft = centreOnToday(todayPx, scroller.clientWidth, 0);
	if (rowEls.length === 0) return;
	// Rows are in end order and an overdue row ends at its past target, so the first is the earliest.
	const overdue = map.rows.findIndex((row) => overdueVisible(row.release));
	const next = map.rows.findIndex((row) => daysBetween(map.today, row.end) >= 0);
	const target = rowEls[[overdue, next].find((i) => i !== -1) ?? rowEls.length - 1];
	scroller.scrollTop = target.offsetTop - rowEls[0].offsetTop;
}

/**
 * Years over months across the whole `track`, and today's label hanging BELOW the ruler so
 * it never covers a month.
 */
function drawRuler(mapEl: HTMLElement, map: ReleaseMap, track: TimelineWindow): void {
	const ruler = mapEl.createDiv({ cls: 'pbl-relmap-ruler', attr: { 'aria-hidden': 'true' } });
	const tiers: Array<[TimelineCell[], string]> = [
		[superCells(track, SCALE), 'pbl-relmap-cell pbl-relmap-cell-year'],
		[timelineCells(track, SCALE), 'pbl-relmap-cell'],
	];
	for (const [cells, cls] of tiers) {
		const tier = ruler.createDiv({ cls: 'pbl-relmap-tier' });
		for (const cell of cells) tier.createDiv({ cls, text: cell.label }).setCssProps({ '--pbl-relmap-cell-w': px(cell.days) });
	}
	const label = ruler.createDiv({ cls: 'pbl-relmap-today-label', text: t('legend.today') });
	label.setCssProps({ '--pbl-relmap-x': px(pointAt(map.window, map.today).startDay) });
}

function drawRow(view: ReleaseView, rowsEl: HTMLElement, window: TimelineWindow, row: MapRow): HTMLElement {
	const end = pointAt(window, row.end);
	const derived = row.start === null ? [] : [t('release.map.derivedStart')];
	const rowEl = rowsEl.createEl('button', {
		cls: 'pbl-relmap-row',
		attr: { type: 'button', 'data-path': row.release.path, 'aria-label': bandLabel(row.release, derived) },
	});
	rowEl.toggleClass('pbl-relmap-shipped', row.release.shipped);
	// The list's own refusal: an unbound or unreadable released date paints nothing red.
	rowEl.toggleClass('pbl-rel-overdue', overdueVisible(row.release));
	rowEl.toggleClass('pbl-relmap-clipped', end.outside);
	if (row.start !== null) drawLead(rowEl, barGeometry(window, { start: row.start, target: row.end }));
	if (row.slipTarget !== null) drawSlip(rowEl, pointAt(window, row.slipTarget).startDay, end.startDay, row.release.slip ?? 0);
	rowEl.createSpan({ cls: 'pbl-relmap-marker' }).setCssProps({ '--pbl-relmap-x': px(end.startDay) });
	const slot = rowEl.createSpan({ cls: 'pbl-relmap-slot' });
	slot.setCssProps({ '--pbl-relmap-x': px(end.startDay) });
	drawCard(rowEl, slot, row);
	rowEl.addEventListener('click', () => view.pick(row.release.path));
	return rowEl;
}

/** The derived start: faded, dashed, and named as derived — never a date a note holds. */
function drawLead(rowEl: HTMLElement, lead: BarGeometry): void {
	const el = rowEl.createSpan({ cls: 'pbl-relmap-lead' });
	el.setCssProps({ '--pbl-relmap-x': px(lead.startDay), '--pbl-relmap-w': px(lead.spanDays - 1) });
	setTooltip(el, t('release.map.derivedStart'));
}

/**
 * A tick at the target, and a stub from it to the released date — forward when late, back
 * when early. The stub's tooltip is the list's own slip sentence (`slipText`).
 */
function drawSlip(rowEl: HTMLElement, tickDay: number, endDay: number, slip: number): void {
	const late = slip > 0;
	rowEl.createSpan({ cls: 'pbl-relmap-tick' }).setCssProps({ '--pbl-relmap-x': px(tickDay) });
	// Two toggles, not a ternary inside a template: `TEXT_TERNARY` in `eslint.config.mjs`
	// refuses that shape whatever the strings are, and says to use `addClass` instead.
	const stub = rowEl.createSpan({ cls: 'pbl-relmap-slip' });
	stub.toggleClass('pbl-relmap-late', late);
	stub.toggleClass('pbl-relmap-early', !late);
	stub.setCssProps({ '--pbl-relmap-x': px(Math.min(tickDay, endDay)), '--pbl-relmap-w': px(Math.abs(endDay - tickDay)) });
	setTooltip(stub, slipText(slip));
}

/**
 * Line 1: name, version, status. Line 2: the date figure, its note, the progress. Then the
 * headline, which `rowEl` names as its description: the row's `aria-label` replaces its
 * content, so without `aria-describedby` a screen reader never hears the scope.
 */
function drawCard(rowEl: HTMLElement, parent: HTMLElement, card: MapCard): void {
	const cardEl = parent.createSpan({ cls: 'pbl-relmap-card' });
	const line1 = cardEl.createSpan({ cls: 'pbl-relmap-line' });
	line1.createSpan({ cls: 'pbl-relmap-name', text: card.release.name });
	drawVersion(line1, card.release);
	drawStatus(line1, card.release);
	const line2 = cardEl.createSpan({ cls: 'pbl-relmap-line pbl-relmap-facts' });
	drawWhen(line2, card.release);
	drawNote(line2, card.release);
	// One nowrap box, so the bar and its count never wrap apart.
	drawProgressLine(line2.createSpan({ cls: 'pbl-relmap-progress' }), card.release);
	if (card.headline.length === 0) return;
	// Minted per row: the id resolves across the document, which can hold two maps in split panes.
	const scopeEl = cardEl.createSpan({ cls: 'pbl-relmap-scope', attr: { id: uniqueElementId('pbl-relmap-scope') } });
	rowEl.setAttribute('aria-describedby', scopeEl.id);
	for (const title of card.headline) scopeEl.createSpan({ cls: 'pbl-relmap-scope-item', text: title });
	if (card.more > 0) scopeEl.createSpan({ cls: 'pbl-relmap-more', text: t('release.map.more', { count: card.more }) });
}

/** Drawn only when it holds something: an empty "Not scheduled (0)" is a heading over nothing. */
function drawShelf(view: ReleaseView, scroller: HTMLElement, shelf: MapCard[]): void {
	if (shelf.length === 0) return;
	const shelfEl = scroller.createDiv({ cls: 'pbl-relmap-shelf' });
	const label = t('release.map.shelf');
	shelfEl.createEl('h2', { cls: 'pbl-rel-group', text: t('release.index.group.count', { label, count: shelf.length }) });
	const cardsEl = shelfEl.createDiv({ cls: 'pbl-relmap-shelf-cards' });
	for (const card of shelf) {
		const btn = cardsEl.createEl('button', {
			cls: 'pbl-relmap-row pbl-relmap-shelf-row',
			attr: { type: 'button', 'data-path': card.release.path, 'aria-label': bandLabel(card.release) },
		});
		drawCard(btn, btn, card);
		btn.addEventListener('click', () => view.pick(card.release.path));
	}
}
