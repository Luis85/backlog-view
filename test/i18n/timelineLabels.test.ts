// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scaleFor, superCells, timelineCells, timelineWindow } from '../../src/domain/timeline';
import { setLocale, t } from '../../src/i18n/t';
import { resetLocale, withLocale } from '../helpers/locale';
import { cellLabels } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };

/**
 * Two known stretches of 2026 rather than whatever today is, and a month of padding at
 * each end is the window's own doing — `Jul`–`Sep` draws `Jun`…`Oct`.
 *
 * `SPRING` exists because German's short months and English's are the SAME three letters
 * for `Jun`, `Jul`, `Aug` and `Sep`: a summer window would have asserted a difference that
 * is not there. `Mär` and `Mai` are where the two languages part. Its window still runs to
 * October — `timelineWindow` always contains today, whatever the spans say.
 */
const SUMMER = [{ start: { year: 2026, month: 7, day: 1 }, target: { year: 2026, month: 9, day: 30 } }];
const SPRING = [{ start: { year: 2026, month: 3, day: 1 }, target: { year: 2026, month: 5, day: 31 } }];
const TODAY = { year: 2026, month: 8, day: 1 };

function windowOver(spans = SUMMER) {
	return timelineWindow(spans, TODAY);
}

/** The bottom tier — the cells the scale's own unit names. */
function cellsAt(zoom: 'week' | 'month' | 'quarter', spans = SUMMER): string[] {
	return timelineCells(windowOver(spans), scaleFor(zoom)).map((cell) => cell.label);
}

/** The coarse tier above them. */
function superAt(zoom: 'week' | 'month' | 'quarter', spans = SUMMER): string[] {
	return superCells(windowOver(spans), scaleFor(zoom)).map((cell) => cell.label);
}

function labelsAt(zoom: 'week' | 'month' | 'quarter'): string[] {
	return [...superAt(zoom), ...cellsAt(zoom)];
}

/**
 * The roadmap's dated axis, drawn — the same three header shapes as `labelsAt`, but
 * through the real view, because what this whole file is about is a label REACHING the
 * DOM. The domain half could be right while a renderer spelled its own.
 */
function drawnLabels(zoom: 'week' | 'month' | 'quarter'): string[] {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-09-20' } });
	const { view, containerEl } = makeView(vault, { ...DATE_AXIS }, { collapsed: true });
	view.setProjection('roadmap');
	view.setZoom(zoom);
	return cellLabels(containerEl);
}

/**
 * The header of the roadmap's dated axis, in the reader's own calendar — the last
 * criterion of [[Locale-aware sorting and formatting]], which PR #251 left `Active`
 * because `MONTH_LABELS` was a hard-coded `['Jan', 'Feb', …]` reaching the DOM.
 *
 * A month name is DATA PRESENTATION, so it follows the USER's requested locale through
 * `Intl` exactly as `compareText` and `formatNumber` do — never the catalog, and never a
 * twelve-key catalog list, which would make it grammar and freeze it at the languages
 * this plugin happens to ship.
 */
describe('the dated axis names its cells in the reader’s locale', () => {
	/**
	 * **The check that holds for a call site nobody listed.** Every label the header draws
	 * is asked to be in the locale's own vocabulary, rather than each site being driven by
	 * name: Japanese writes every calendar part in `年月日` and shares not one letter with
	 * English, so a label still spelled from an array — at a site this file forgot, or at
	 * one added later — cannot pass. That matters more here than a list would, because the
	 * shape it guards is invisible to lint: `` `${day} ${MONTH[m]}` `` is a template whose
	 * first quasi is EMPTY, which `UI_TEXT_LITERAL`, `UI_TEXT_PROPERTY` and `TEXT_TERNARY`
	 * all read past. Nothing but reading the rendered string back finds one.
	 *
	 * `Q1` and a bare year are the two deliberate exceptions and are named as notation —
	 * see `cellLabel` and `superLabel` in `src/domain/timeline.ts`.
	 */
	const JAPANESE = /^(Q[1-4]|\d{4}|[\d年月日]+)$/;

	it('draws nothing but the locale’s own calendar vocabulary, at every zoom', () => {
		withLocale('ja', () => {
			for (const zoom of ['week', 'month', 'quarter'] as const) {
				expect(labelsAt(zoom), zoom).toSatisfy((labels: string[]) => labels.every((l) => JAPANESE.test(l)));
				expect(drawnLabels(zoom), `${zoom} drawn`).toSatisfy(
					(labels: string[]) => labels.length > 0 && labels.every((l) => JAPANESE.test(l)),
				);
			}
		});
	});

	/**
	 * The two locales the split is visible in. German has no catalog here, so the messages
	 * stay English while the calendar does not — which is the whole "grammar follows the
	 * catalog, data follows the user" rule, asserted rather than described.
	 */
	it('follows the requested locale even where the catalog falls back to English', () => {
		const spring = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
		expect(withLocale('en', () => cellsAt('month', SPRING))).toEqual(spring);
		withLocale('de-DE', () => {
			expect(cellsAt('month', SPRING)).toEqual(['Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep']);
			expect(superAt('week', SPRING)[0]).toBe('Feb. 2026');
			// No German catalog ships, so the sentences fall back to English while the
			// calendar does not: grammar follows the CATALOG, data follows the USER.
			expect(t('emptyState.noItems')).toBe('No backlog items');
		});
	});

	it('writes the day and the month in the order the locale writes them', () => {
		// `en` puts the month first and `en-GB` the day: an order no caller can produce by
		// pasting a day beside a month name, which is why the whole label goes to `Intl`.
		expect(withLocale('en', () => cellsAt('week')[0])).toBe('Jun 1');
		expect(withLocale('en-GB', () => cellsAt('week')[0])).toBe('1 Jun');
	});

	it('spells the English header the way it always did, apart from that order', () => {
		withLocale('en', () => {
			expect(labelsAt('month')).toEqual(['2026', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
			expect(labelsAt('quarter')).toEqual(['2026', 'Q2', 'Q3', 'Q4']);
			expect(superAt('week')).toEqual(['Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026']);
		});
	});
});

/**
 * The two ways an `Intl.DateTimeFormat` goes wrong that no locale assertion above would
 * catch: the zone it reads the instant in, and how often it is built.
 */
describe('what the calendar formatters are pinned to', () => {
	/**
	 * The zone is RESTORED, never deleted — CI has a `zone` leg that runs this whole suite
	 * under `TZ=Pacific/Kiritimati`, and a `delete` here would hand every test after this
	 * file the runner's UTC while the leg went on reporting that it had run east of the
	 * date line.
	 */
	const hostZone = process.env.TZ;

	afterEach(() => {
		if (hostZone === undefined) delete process.env.TZ;
		else process.env.TZ = hostZone;
		resetLocale();
	});

	/**
	 * A civil date is a year/month/day triple with no zone in it, so it is handed to `Intl`
	 * as `Date.UTC` and must be READ back as UTC. Without `timeZone: 'UTC'` the formatter
	 * takes the host's zone, and every reader west of Greenwich sees the cell that starts
	 * on the 1st of August headed `Jul` — a header naming the wrong month for half the
	 * planet, and green in a CI box that runs in UTC.
	 *
	 * Node re-reads `process.env.TZ` per `Intl` construction, so `setLocale` rebuilds the
	 * formatters in the zone this sets.
	 */
	it('reads a civil date in UTC, not in the host’s zone', () => {
		for (const zone of ['Pacific/Niue', 'Pacific/Kiritimati']) {
			process.env.TZ = zone;
			setLocale('en');
			expect(cellsAt('month'), zone).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
		}
	});

	/**
	 * The grid this header labels is Gregorian — `domain/timeline.ts` steps Gregorian
	 * months and knows no other calendar — so the labels must be too, whatever calendar the
	 * locale prefers. Persian is the worked example: unpinned, `fa-IR` names August 2026
	 * `مرداد ۱۴۰۵`, a Persian month over a cell that spans a Gregorian one, and a year tier
	 * three digits away from every date in the notes. The DIGITS are the locale's and stay
	 * that way — a numbering system is data presentation, which is the whole point here.
	 */
	it('labels a Gregorian grid in the Gregorian calendar, whatever the locale prefers', () => {
		withLocale('fa-IR', () => {
			expect(superAt('week')[1]).toContain('۲۰۲۶');
			expect(superAt('month')).toEqual(['۲۰۲۶']);
			// The Persian year the same instant falls in, which no cell may name.
			expect(labelsAt('month').join(' ')).not.toContain('۱۴۰۵');
		});
	});

	/**
	 * The restore above, checked rather than described — under CI's `zone` leg, where
	 * `hostZone` is `Pacific/Kiritimati` rather than undefined. Ordered last, so it reads
	 * what the zone test's own `afterEach` left behind. Locally, in UTC, it passes either
	 * way; run this file with `TZ=Pacific/Kiritimati` to watch it fail on a `delete`.
	 */
	it('leaves the host zone exactly as it found it', () => {
		expect(process.env.TZ).toBe(hostZone);
	});

	/**
	 * Asserted at the forbidden thing rather than by reasoning about the call sites: the
	 * header draws a cell per week across the whole window, and a formatter built per cell
	 * is the render-path cost `compareText`'s own comment refuses. One per style per
	 * `setLocale`, in `activate`.
	 */
	it('builds no formatter while drawing a header', () => {
		setLocale('en');
		const spy = vi.spyOn(Intl, 'DateTimeFormat');
		try {
			const window = timelineWindow([{ start: { year: 2026, month: 1, day: 1 }, target: { year: 2027, month: 12, day: 31 } }], TODAY);
			expect(timelineCells(window, scaleFor('week')).length).toBeGreaterThan(50);
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});
});
