import { setTooltip } from 'obsidian';
import { ReleaseMark, TimelineBar } from '../../domain/bars';
import { drawsAsPoint, isIterationType } from '../../domain/itemTypes';
import { CivilDate } from '../../domain/noteFields';
import { barGeometry, daysBetween, formatCivil, TimelineScale, TimelineWindow } from '../../domain/timeline';
import { RELEASE_TYPE } from '../../domain/typeVocabulary';
import { t } from '../../i18n/t';

/**
 * The grid's full-height marks that come from the PLAN rather than from the reader: a line
 * down every row per milestone date, and — since 2026-08-29 — one per release date, each
 * with its name in the header band.
 *
 * TWO marks and one positioner. They are drawn by two functions because their SOURCES have
 * nothing in common — the milestones' lines are computed from the bars this grid drew, and
 * a release has neither a bar nor a row — and they share `drawDayLines`, because where a
 * mark sits on this grid is one answer for both and two copies of it drift by a pixel.
 *
 * Its own module because `render/timeline.ts` is at the 400-line budget and this is the
 * piece with the least to do with the rest of it — the grid draws rows, and this draws
 * across all of them from a list of dates. Same move `render/barLabel.ts` and
 * `render/lanes.ts` already made, for the same reason.
 */

/**
 * A line down the whole plan per milestone DATE, behind the bars — a diamond says *when*,
 * a line says *what is on either side of it*, which is the question a deadline is actually
 * asked. The today line is the same shape, drawn once across the grid from a single date,
 * so this is a second instance of something that works rather than a drawing layer.
 *
 * Grouped by day, not by item: two lines a pixel apart read as one and quietly misreport
 * the count, so two milestones on a date are one line naming both. A milestone outside the
 * window draws none — `outside` says so, and a line at the edge would claim a date the
 * milestone does not have. Nothing here is focusable and nothing is written: the line is
 * decoration of a row, and every fact it shows is in that row's accessible name.
 *
 * **The loop asks `drawsAsPoint`, not `isMarkerType`.** The two used to agree, because
 * `Milestone` was the only marker — an Iteration with bar mode on is a marker that draws
 * no line at all, its dates already stated by the bar itself, so admitting it here would
 * claim a boundary the reader turned off. `isMarkerType` still decides which row an item
 * lives in ([[Milestones out of the resource rows]]); this asks only whether that item
 * draws as a POINT.
 *
 * **The return is per TYPE, not one boolean.** The caller seeds `DrawnColors` with it
 * before the diamond's own report runs (`renderTimeline`): the line stays cyan even where
 * a marker's DIAMOND is repainted green by the done override, so a grid whose only marker
 * is a done Milestone still has to key cyan for a fact the diamond no longer reports. One
 * boolean answered that while every marker meant "Milestone"; asked of a mixed or
 * Iteration-only grid it would seed `drawn.milestone` true from an Iteration's own line —
 * the caption's content-aware rule broken here instead of at `markerLaneCaption`. Split so
 * the seed can never claim a colour for a type that drew no line of its own.
 */
export function renderMilestoneLines(
	mounts: { grid: HTMLElement; headerTrack: HTMLElement },
	window: TimelineWindow,
	bars: TimelineBar[],
	today: CivilDate,
	// `scale` and `leadWidth` are both "how a day converts to a pixel here"; `iterationBars`
	// joins them here rather than as a sixth parameter, for the same five-parameter budget.
	ruler: { scale: TimelineScale; leadWidth: number; iterationBars: boolean },
): { milestone: boolean; iteration: boolean; days: Set<number> } {
	const { grid, headerTrack } = mounts;
	const { scale, leadWidth, iterationBars } = ruler;
	// Insertion order is bar order, which is row order — so a shared line names its
	// milestones the way the rows read.
	const byDay = new Map<number, string[]>();
	let milestone = false;
	let iteration = false;
	for (const bar of bars) {
		if (!drawsAsPoint(bar.item.typeName, iterationBars)) continue;
		const geometry = barGeometry(window, bar.span);
		if (geometry.outside) continue;
		byDay.set(geometry.startDay, [...(byDay.get(geometry.startDay) ?? []), bar.item.title]);
		if (isIterationType(bar.item.typeName)) iteration = true;
		else milestone = true;
	}
	drawDayLines({ grid, headerTrack }, byDay, new Set([daysBetween(window.start, today)]), {
		scale,
		leadWidth,
		line: 'pbl-milestone-line',
		label: 'pbl-milestone-label',
		name: (names) => names.join(' · '),
	});
	// The DAYS this pass took, so the release pass can step aside from them exactly as both
	// step aside from today — see `renderReleaseLines`' own `taken`.
	return { milestone, iteration, days: new Set(byDay.keys()) };
}

/**
 * The same overlay for RELEASES ([[A release on the dated axis]]) — a line down every row
 * at each release's own date, its name in the header band, drawn in its own colour so it is
 * never read as a milestone.
 *
 * Its own function beside `renderMilestoneLines` rather than a sixth parameter of it, and
 * the split is what the two actually are: the milestones' lines are computed from the BARS
 * this grid drew, and a release has no bar and no row at all — it comes from
 * `RoadmapModel.releaseMarks`, which `buildRoadmap` reads off `model.releases`. Sharing
 * `drawDayLines` below is what keeps the two marks positioned identically without either
 * one owning the other's source.
 *
 * Grouped by day for `renderMilestoneLines`' own reason: two lines a pixel apart read as
 * one and quietly misreport the count, so two releases on one date are one line naming
 * both. Insertion order is `releaseMarks`' order, which is model order — the stable order
 * extension 3a asks for.
 *
 * A mark outside the window draws nothing: `barGeometry` says `outside`, and a line at the
 * edge would claim a date the release does not have. That is the same treatment a
 * milestone gets, and it is why the caller widens the window for these marks before this
 * runs (`renderTimeline`) rather than after.
 */
export function renderReleaseLines(
	mounts: { grid: HTMLElement; headerTrack: HTMLElement },
	window: TimelineWindow,
	marks: ReleaseMark[],
	today: CivilDate,
	ruler: { scale: TimelineScale; leadWidth: number; taken: Set<number> },
): boolean {
	const byDay = new Map<number, { names: string[]; date: CivilDate }>();
	for (const mark of marks) {
		const geometry = barGeometry(window, { start: mark.date, target: mark.date });
		if (geometry.outside) continue;
		// The date is carried beside the names rather than looked up again: a day OFFSET is
		// what the grid places by and a calendar date is what the sentence below has to say,
		// and every mark landing on one offset is on one date by construction.
		const held = byDay.get(geometry.startDay);
		byDay.set(geometry.startDay, { names: [...(held?.names ?? []), mark.item.title], date: mark.date });
	}
	const names = new Map([...byDay].map(([day, group]) => [day, group.names] as const));
	announceReleases(mounts.grid, byDay);
	drawDayLines(mounts, names, new Set([daysBetween(window.start, today), ...ruler.taken]), {
		...ruler,
		line: 'pbl-release-line',
		label: 'pbl-release-label',
		// The one place a release mark says out loud that it IS a release: the line and the
		// label are told apart by colour, which is no answer at all for a reader who cannot
		// see it or who has two cyan-ish themes. `RELEASE_TYPE` is DATA — the name matched in
		// frontmatter — so it is a parameter to the sentence and never catalog text itself,
		// the same rule the legend's own marker caption keeps.
		name: (group) => t('timeline.releaseLine', { type: RELEASE_TYPE, names: group }),
	});
	return byDay.size > 0;
}

/**
 * The same marks as a SENTENCE, visually hidden, one per date — because a release is the
 * one mark on this grid with no row of its own to carry it.
 *
 * That is the whole reason this exists for releases and not for milestones. A milestone's
 * line is decoration and says so (`aria-hidden`), which is honest there:
 * [[A milestone line across the plan]] 4a puts the milestone's name and date in its ROW's
 * accessible name, so nothing about it is available only by seeing the mark. A release is
 * not a row on this roadmap at all ([[A release on the dated axis]]), so the line, the
 * header label and the legend swatch — all three `aria-hidden` — were its ONLY
 * representation, and a reader using a screen reader was told nothing about it whatsoever
 * (found by review, PR #211).
 *
 * Mounted on the GRID rather than in the header band, whose tiers are `aria-hidden` as a
 * whole (`renderCellHeader`) because they are a calendar of decorative cells. That makes
 * this a div among `option` rows in a pane that is a `listbox` while cards render — the
 * same accepted deviation `renderLaneHead` states and for the same reason, that a mark
 * spanning every row cannot be a child of one of them. How a screen reader actually reads
 * it is a live-vault check this harness cannot make.
 */
function announceReleases(grid: HTMLElement, byDay: Map<number, { names: string[]; date: CivilDate }>): void {
	for (const [, group] of byDay) {
		grid.createSpan({
			cls: 'pbl-sr-only',
			// The DATE in words, which the visible label leaves to the mark's position — the
			// one fact a reader who cannot see the grid has no other way to get.
			text: t('timeline.releaseMark', { type: RELEASE_TYPE, names: group.names, date: formatCivil(group.date) }),
		});
	}
}

/**
 * One line per DAY, down the grid, with its label in the header band — the positioning both
 * marks share, stated once. Everything that differs between them (which classes, what the
 * label says) is `mark`; everything that is about the GRID (the nudge past today, the two
 * origins) is here.
 */
function drawDayLines(
	mounts: { grid: HTMLElement; headerTrack: HTMLElement },
	byDay: Map<number, string[]>,
	occupied: Set<number>,
	mark: { scale: TimelineScale; leadWidth: number; line: string; label: string; name: (names: string[]) => string },
): void {
	const { grid, headerTrack } = mounts;
	const { scale, leadWidth } = mark;
	for (const [day, names] of byDay) {
		// Today keeps its position and its place on top: it is the one mark on this grid
		// that is the reader's own, and no plan may hide *now*. The milestone's line is
		// what gives way, drawn beside it inside the same day cell — room the grid has,
		// since a day is wider than either mark.
		// A sub-day offset, so it is the SCALE's line width and never a constant: two
		// fixed pixels at two pixels per day is a whole day's displacement, putting the
		// line and its label in the day after the one they belong to. `dayPx >= 2 *
		// lineWidth` is what guarantees the step still fits inside the day it steps in.
		//
		// `occupied` is every day a mark ALREADY stands on — today's for both passes, plus
		// the milestones' own days for the release pass (found by review, PR #211: a release
		// and a milestone on one date drew two lines at one x, the later one painting over
		// the earlier). ONE step and never two: three marks on one day put the release beside
		// today's step and over the milestone's, which is the accepted limit rather than a
		// second displacement that would leave the day it belongs to.
		const nudge = occupied.has(day) ? scale.lineWidth : 0;
		const line = grid.createDiv({ cls: mark.line, attr: { 'aria-hidden': 'true' } });
		line.setCssProps({ '--pbl-milestone-left': `${leadWidth + day * scale.dayPx + nudge}px` });
		// The label sits in the header band, and the full name stays in the tooltip:
		// horizontal space is the scarce resource in an Obsidian pane, so the line survives
		// the narrowing and the text is what gives way.
		//
		// **The COARSE tier, never the cell tier**, which is the one thing about this label
		// that was chosen rather than inherited. It is an opaque box `max-width: 140px` wide,
		// so whatever tier it lands in, it covers that tier's own labels from its date
		// rightward — and the cell tier carries one label per WEEK, so a milestone truncated
		// the date it sits on every single time (seen in a vault: `28 Sep` reading as `28 S`
		// under `Ship the roadmap epic`). The coarse tier carries one label per month or year,
		// so the same 140px usually covers nothing at all, and when it does the casualty is a
		// month name the tier below still spells out in days. That is a strictly smaller loss,
		// bought by moving one mount point — no extra header row, which
		// `docs/issues/Nearby milestone labels cover each other.md` weighs and declines for
		// crowding the sticky band.
		//
		// Same variable, different origin: the line is positioned in the grid, which
		// includes the sticky lead column, and the label inside the track, which does not.
		const label = mark.name(names);
		// A label ALREADY at this day is joined rather than covered. Nudging the box would
		// not have helped: it is an opaque 140px, so two of them 2px apart still hide one
		// name — and the one that loses is whichever pass ran first, which is the milestone's
		// (found by review, PR #211). Joined with the same ` · ` a shared day already uses
		// between two milestones, so one date reads as one label naming everything on it. It
		// keeps the FIRST pass's colour, which is the honest half of the compromise: the
		// strip says a milestone is there and the words say a release is too.
		const held = headerTrack.querySelector<HTMLElement>(`[data-pbl-day="${day}"]`);
		if (held !== null) {
			// `join`, not a template with `?? ''`: `textContent` is typed nullable and cannot be
			// null on a div this function itself created with text, so a fallback would be a
			// branch nothing can ever take — and an unreachable branch is a claim no check can
			// reach either. `Array.join` coerces the same way the fallback would.
			const joined = [held.textContent, label].join(' · ');
			held.setText(joined);
			setTooltip(held, joined);
			continue;
		}
		const labelEl = headerTrack.createDiv({ cls: mark.label, text: label, attr: { 'data-pbl-day': String(day) } });
		labelEl.setCssProps({ '--pbl-milestone-left': `${day * scale.dayPx + nudge}px` });
		setTooltip(labelEl, label);
	}
}
