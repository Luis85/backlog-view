import { TimelineBar } from '../../domain/bars';
import { BarGeometry, MIN_BAR_PX, TimelineScale, TimelineWindow } from '../../domain/timeline';

/**
 * The title beside a bar, and how wide the mark it has to clear actually DRAWS.
 *
 * Its own module because `timeline.ts` reached its 400-line budget and this is the
 * concern that separates cleanly — the same move `laneEntries` made into `lanes.ts`,
 * for the same reason. Nothing of the grid is imported here and nothing here is
 * imported by anything but the grid: a label's position is a function of the mark, the
 * scale and the window, and of nothing else the grid holds.
 *
 * `LABEL_RESERVE_PX` is read by `test/view/timelineBoxing.test.ts`, which refuses this
 * number and the label's CSS budget in `styles/timelineFurniture.css` drifting apart.
 */

/**
 * Room reserved for a title beside its bar, in PIXELS — matches the label's CSS
 * budget (max-width 144px + 2×8px padding). Short of this at the window's right
 * edge, the label flips to the bar's left rather than truncating against nothing.
 */
export const LABEL_RESERVE_PX = 160;

/** `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css` — see `markWidth`. */
const MILESTONE_MARK_PX = 12;
const OUTSIDE_MARK_PX = 10;

/**
 * How wide the mark actually DRAWS, which is what a label beside it has to clear.
 * `--pbl-bar-width` is not that number for two of the three shapes: `.pbl-bar-milestone`
 * is a 12px diamond and `.pbl-bar-outside` a 10px arrow whatever the span, so a
 * one-day milestone at quarter zoom measures 4px here and would have its title
 * painted across it. Same order of tests as `barClasses`, which is what decides
 * which shape is drawn — keep the two in step, and both in step with
 * `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css`.
 *
 * A WIDTH only: where that width starts is the caller's business, because the two
 * marks do not share an origin. `.pbl-bar-outside` sits at `--pbl-bar-left`, while
 * `.pbl-bar.pbl-bar-milestone` carries `translateX(-50%)` and is centred on it —
 * `markLeft` in `renderBarLabel` is where that difference is applied. The diamond's
 * 45° rotation puts its tips ~2.5px outside this box on each side; the label's own
 * 8px of padding is the clearance, so this stays the CSS width rather than a
 * bounding-box calculation nothing else in the file does.
 */
function markWidth(geometry: BarGeometry, scale: TimelineScale): number {
	if (geometry.outside) return OUTSIDE_MARK_PX;
	if (geometry.milestone) return MILESTONE_MARK_PX;
	return Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX);
}

/**
 * The title where the reader's eye already is — decoration only. The row's
 * accessible name carries the title and the bar's aria-label the dates, so this
 * is aria-hidden; pointer-events die in CSS so the grips never lose a hit.
 *
 * Returns the element it created, or `null` where it dropped the label instead — the
 * one other thing this file decides that a caller needs back. `drawBandCollision`
 * (`render/timeline.ts`) is that caller: the days-lost sentence lands INSIDE this same
 * label rather than beside the bar with its own position, so a bar too cramped for its
 * own title is too cramped for the sentence about it as well, by construction rather
 * than by a second width check repeating this one.
 */
export function renderBarLabel(
	track: HTMLElement,
	bar: TimelineBar,
	geometry: BarGeometry,
	scale: TimelineScale,
	window: TimelineWindow,
): HTMLElement | null {
	const left = geometry.startDay * scale.dayPx;
	const width = markWidth(geometry, scale);
	// The mark's own left edge, which is NOT `--pbl-bar-left` for the diamond: the
	// milestone rule in `styles/timeline.css` carries `translateX(-50%)`, so a 12px
	// diamond drawn at `left` occupies `[left - 6, left + 6]`. Placing the label from
	// `left` instead left the `after` label 6px further out than the reserve intends and
	// put the `before` label's right edge across the diamond's own left half. Both
	// offsets below take this edge, so what the label clears is the mark as DRAWN.
	const markLeft = geometry.milestone && !geometry.outside ? left - width / 2 : left;
	const trackWidth = window.days * scale.dayPx;
	const after = markLeft + width + LABEL_RESERVE_PX <= trackWidth;
	// Dropped whenever there is no room after the mark's right edge AND the mark begins
	// within the reserve of the track's own left edge, since flipping the label before
	// such a mark would put it off the track behind the sticky lead column. Three ways
	// to reach that, and `MAX_TIMELINE_DAYS` is required for none of them:
	//   - a bar clipped at BOTH window edges;
	//   - a bar clipped at the right alone that merely BEGINS within `LABEL_RESERVE_PX`
	//     of the left edge without being clipped there itself;
	//   - a SHORT TRACK, with no clipping anywhere in it. The reserve is a pixel budget
	//     while the track is days times `dayPx`, so a backlog whose dates sit near today
	//     pads out to ~92 days, which at quarter zoom (2px/day) is a 184px track — under
	//     one reserve plus the other. All that still labels there is the first ~12 days
	//     (room after) and anything starting past 160px (room before), and both of those
	//     lie in the padding months `timelineWindow` adds either side, where no bar of
	//     such a backlog begins. At that zoom the feature is effectively absent, which is
	//     what `timelineFurniture.test.ts` drives with one bar rather than claiming of
	//     every position on the track.
	// Nothing is lost by dropping it — the row's lead carries the same title, which is
	// what makes this decoration rather than content, and squeezing it over the bar would
	// only trade a hidden label for an unreadable one.
	if (!after && markLeft < LABEL_RESERVE_PX) return null;
	const label = track.createDiv({ cls: 'pbl-bar-label', attr: { 'aria-hidden': 'true' } });
	// The title's own child, not text on `label` directly: `label` is a flex row now, and
	// `drawBandCollision` appends `.pbl-days-lost` as a SECOND child of it — a title long
	// enough to fill the whole box would otherwise ellipsize the token itself off the end
	// of the line, since `text-overflow: ellipsis` truncates at the line's end regardless
	// of which content put it there. `.pbl-bar-label-title` carries `min-width: 0` (a flex
	// item's default `min-width: auto` refuses to shrink below its own content) plus the
	// ellipsis this element used to carry — `styles/timelineFurniture.css`.
	label.createSpan({ cls: 'pbl-bar-label-title', text: bar.item.title });
	if (after) {
		label.addClass('pbl-bar-label-after');
		label.setCssProps({ '--pbl-label-left': `${markLeft + width}px` });
	} else {
		label.addClass('pbl-bar-label-before');
		label.setCssProps({ '--pbl-label-right': `${trackWidth - markLeft}px` });
	}
	return label;
}
