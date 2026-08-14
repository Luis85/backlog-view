// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { laneRoadmap, rowFor } from '../helpers/roadmap';
import { absenceVault } from '../helpers/resources';
import { addDays, formatCivil, MAX_TIMELINE_DAYS } from '../../src/domain/timeline';
import { readDate, todayStamp } from '../../src/domain/noteFields';

/** `clashCost`'s own construction, borrowed rather than re-derived — see its own test. */
const TODAY = readDate(todayStamp()).value;
if (TODAY === null) throw new Error('todayStamp() did not parse as a date');

useViewHarness();

/**
 * Where an absence MEETS the work it crosses: the shading behind a band's own bars, and the
 * mark a bar carries when it is scheduled over days its resource is away.
 *
 * Its own file rather than a block in `resourceAbsences.test.ts`, whose subject is one
 * stretch on screen and the three acts on it. What is different here is a fact about TWO
 * things at once — a bar and a stretch — which nothing in that file's vocabulary describes,
 * and which the feature's own user story is entirely about.
 */

/**
 * A vault whose window is CLAMPED, so a date in 2031 lies outside the drawn grid. The
 * window grows to hold every span it draws, so nothing short of `MAX_TIMELINE_DAYS` can
 * put one outside it — a 2031 stretch beside 2026 work gives a 1703-day window and lands
 * comfortably inside. The long span is `resourceAbsences.test.ts`'s own construction for
 * the same problem, borrowed rather than re-derived.
 */
function clampedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Long.md', {
		frontmatter: { type: 'Epic', order: 5, assignee: 'Alice', start: '2020-01-01', due: '2032-01-01' },
	});
	return vault;
}

describe('the days a band is unavailable, shaded across its work', () => {
	it('shades the same days across the band’s work rows, over the bars', () => {
		// The feature's own user story is "a row I am about to drop work into already shows
		// the days nobody should be scheduled across", and with the stretch on a line of its
		// own the collision was the hardest thing on the band to see. The named line above is
		// still where the title, the dates and the menu live; this is the same fact where the
		// collision happens.
		const { containerEl } = laneRoadmap(absenceVault());
		const mark = containerEl.querySelector<HTMLElement>('.pbl-absence');
		const work = rowFor(containerEl, 'Work');
		const washes = Array.from(work?.querySelectorAll<HTMLElement>('.pbl-absence-wash') ?? []);
		expect(washes).toHaveLength(1);

		// The same arithmetic as the mark, so the shading and the stretch cannot disagree
		// about which day is which.
		expect(washes[0].style.getPropertyValue('--pbl-bar-left')).toBe(mark?.style.getPropertyValue('--pbl-bar-left'));
		expect(washes[0].style.getPropertyValue('--pbl-bar-width')).toBe(mark?.style.getPropertyValue('--pbl-bar-width'));

		// OVER the bar, and by document order alone — no `z-index` anywhere, which is the
		// whole layer story (see `renderAbsenceWash`). AFTER the bar in the track it is in, so
		// the unavailable days tint the bar crossing them rather than being covered by it —
		// not necessarily the LAST child any more: `.pbl-days-lost` (`noteAbsenceClash`) can
		// land after it in the same track, and does not disturb this ordering since it sits
		// past the bar's own right edge rather than over it.
		const track = washes[0].parentElement;
		const children = Array.from(track?.children ?? []);
		const barIndex = children.findIndex((el) => el.classList.contains('pbl-bar'));
		expect(barIndex).toBeGreaterThanOrEqual(0);
		expect(children.indexOf(washes[0])).toBeGreaterThan(barIndex);
	});

	it('shades no line that makes no positional claim, and no band on the dated axis', () => {
		// Three exclusions, each with its own reason: the stretch's own row already carries
		// the mark; a context row draws no bar at all by recorded decision, so shading days
		// inside it would be its one positional statement; and the dated axis has no band to
		// be a member of.
		const vault = absenceVault();
		vault.addFile('Outside.md', { frontmatter: { type: 'Epic', order: 20, assignee: 'Alice' } });
		vault.addFile('Inside.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-02', due: '2026-08-03' },
			parentLink: 'Outside',
		});
		// The Base returns everything but `Outside`, which therefore loads as the context row
		// placing `Inside`, and the focus level is what puts such a row in the roadmap's row
		// set at all — `resourceLanes.test.ts`'s own context construction.
		const harness = laneRoadmap(vault, {}, { only: ['Work.md', 'Inside.md', 'Alice away.md'], focus: 'Epic' });
		expect(harness.containerEl.querySelector('.pbl-lane-context')).not.toBeNull();

		// The header's own track carries the stretches themselves now, so a wash there would
		// shade the days twice.
		expect(harness.containerEl.querySelector('.pbl-lane-head .pbl-absence-wash')).toBeNull();
		expect(harness.containerEl.querySelector('.pbl-lane-context .pbl-absence-wash')).toBeNull();
		// Not vacuous: the work row in that same band is shaded.
		expect(rowFor(harness.containerEl, 'Work')?.querySelector('.pbl-absence-wash')).not.toBeNull();

		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-absence-wash')).toHaveLength(0);
	});

	it('shades nothing for a stretch the window cannot reach', () => {
		// `barGeometry` CLAMPS, so a stretch lying wholly past an edge would shade days it
		// does not cover — `docs/bugs/An absence drew at the edge of a window it never
		// widened.md` reached from the other side. The MARK can say "past this edge" because
		// `.pbl-bar-outside` is a direction rather than a span; a shaded column of days has no
		// such vocabulary, so it draws nothing at all.
		const vault = clampedVault();
		vault.addFile('Alice away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		vault.addFile('Far away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2031-01-04', due: '2031-01-20' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(containerEl.querySelectorAll('.pbl-absence.pbl-bar-outside')).toHaveLength(1);
		// One wash for the in-window stretch, and none for the clamped one.
		expect(containerEl.querySelectorAll('.pbl-absence-wash')).toHaveLength(1);
	});
});

describe('the mark a bar carries for crossing one', () => {
	it('marks the bar it crosses, in words as well as in shading', () => {
		// The wash tells this in colour alone, which WCAG 1.4.1 refuses and which a screen
		// reader gets nothing of — so the row carries the sentence, and the lead carries the
		// glyph a sighted reader can scan a column of. The dependency conflict's own shape.
		const { containerEl } = laneRoadmap(absenceVault());
		const work = rowFor(containerEl, 'Work');
		const said = Array.from(work?.querySelectorAll<HTMLElement>('.pbl-sr-only') ?? [])
			.map((span) => span.textContent ?? '')
			.filter((text) => text.startsWith('Crosses'));

		expect(said).toEqual(['Crosses an absence: Alice away 2026-08-04 → 2026-08-06']);
		const flag = work?.querySelector<HTMLElement>('.pbl-timeline-lead .pbl-away-flag');
		expect(flag).not.toBeNull();
		expect(flag?.dataset.tooltip).toBe('Crosses an absence: Alice away 2026-08-04 → 2026-08-06');
	});

	it('leaves a bar that clears the stretch unmarked', () => {
		const vault = absenceVault();
		vault.addFile('Clear.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-07', due: '2026-08-09' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(rowFor(containerEl, 'Clear')?.querySelector('.pbl-away-flag')).toBeNull();
		expect(rowFor(containerEl, 'Work')?.querySelector('.pbl-away-flag')).not.toBeNull();
	});

	it('marks a crossing the drawn window cannot show', () => {
		// Computed from DATES, not geometry — the dependency conflict's rule read again: the
		// row is where the fact lives, so a mark derived from the window would come and go
		// with the reader's scroll position and the zoom. `Long` is what clamps the window,
		// the same construction the wash's own outside-window test uses.
		const vault = clampedVault();
		vault.addFile('Far work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2031-01-01', due: '2031-01-31' },
		});
		vault.addFile('Near work.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Far away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2031-01-04', due: '2031-01-20' },
		});
		const { containerEl } = laneRoadmap(vault);

		// The stretch itself is clamped out of the window and shades nothing …
		expect(containerEl.querySelectorAll('.pbl-absence-wash')).toHaveLength(0);
		// … and its row still says the crossing.
		expect(rowFor(containerEl, 'Far work')?.querySelector('.pbl-away-flag')).not.toBeNull();
		expect(rowFor(containerEl, 'Near work')?.querySelector('.pbl-away-flag')).toBeNull();
	});
});

describe('what a bar SAYS it costs to cross an absence', () => {
	it('says how many of a bar’s days the stretch takes', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const row = rowFor(containerEl, 'Work');

		// `Work` runs 1–10 August and Alice is away 4–6: three days.
		expect(row?.querySelector('.pbl-days-lost')?.textContent).toBe('3 days lost to absence');
	});

	it('says so differently when the stretch covers the bar whole', () => {
		const vault = new FakeVault();
		vault.addFile('Short.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		vault.addFile('Alice away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-01', due: '2026-08-20' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(rowFor(containerEl, 'Short')?.querySelector('.pbl-days-lost')?.textContent).toBe('all 3 days lost');
	});

	it('keeps the sentence reachable even where the visible label is dropped', () => {
		// The toolbar's own rule: shed the visible thing, never the reachable one. There is no
		// width check of this feature's own any more — the cost lands INSIDE the bar's title
		// label (`renderBarLabel`), so it is dropped exactly where the title is: a near-term
		// backlog at quarter zoom, `timelineFurniture.test.ts`'s own "draws no bar label at all
		// on a track shorter than twice the reserve" construction, reused here rather than
		// re-derived. The `.pbl-sr-only` sentence in `noteAbsenceClash` is written
		// unconditionally either way, so nothing is lost with the visible half.
		const harness = laneRoadmap(absenceVault());
		harness.view.setZoom('quarter');
		const row = rowFor(harness.containerEl, 'Work');

		expect(row?.querySelector('.pbl-bar-label')).toBeNull();
		expect(row?.querySelector('.pbl-days-lost')).toBeNull();
		expect(row?.querySelector('.pbl-sr-only')?.textContent).toContain('Crosses an absence');
	});

	it('says a PARTIAL cost for a bar clipped at the window edge, never "all" of the wrong length', () => {
		// `barGeometry.spanDays` is the VISIBLE width, clamped into the drawn window;
		// `daysLost` counts real calendar days off the note's own span. A bar clipped at the
		// window's edge draws a narrow sliver whose clamped width can be smaller than the
		// days actually lost — comparing `lost` against THAT number said "all" of a
		// decades-long plan for losing a handful of days near the edge, which is exactly the
		// shape that forced deriving "all" from `row.bar.span` directly instead of from
		// `geometry`.
		const vault = clampedVault();
		const windowStart = addDays(TODAY, -Math.floor(MAX_TIMELINE_DAYS / 2));
		// `Ancient` states a real span from 2000 to just inside the clamped window's own
		// left edge, so its CLAMPED visible width is a couple of days while its REAL span is
		// decades. The absence sits at that same edge, entirely within `Ancient`'s real span,
		// so it crosses regardless of where the window is actually drawn.
		vault.addFile('Ancient.md', {
			frontmatter: {
				type: 'Epic',
				order: 10,
				assignee: 'Alice',
				start: '2000-01-01',
				due: formatCivil(addDays(windowStart, 1)),
			},
		});
		vault.addFile('Edge away.md', {
			frontmatter: {
				type: 'Absence',
				assignee: 'Alice',
				start: formatCivil(addDays(windowStart, -2)),
				due: formatCivil(addDays(windowStart, 1)),
			},
		});
		const { containerEl } = laneRoadmap(vault);

		const said = rowFor(containerEl, 'Ancient')?.querySelector('.pbl-days-lost')?.textContent ?? '';
		expect(said, 'a sliver of a decades-long plan is not "all" of it').not.toMatch(/^all /);
		expect(said).toMatch(/^\d+ days lost to absence$/);
	});

	it('says a milestone falls on an away day rather than counting its days', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, assignee: 'Alice', due: '2026-08-05' },
		});
		vault.addFile('Alice away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(rowFor(containerEl, 'Ship')?.querySelector('.pbl-days-lost')?.textContent).toBe(
			'· falls on an away day',
		);
	});
});
