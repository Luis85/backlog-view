import { DependencyArrow } from '../../domain/dependencies';
import { BacklogItem } from '../../domain/model';
import { dependencyAnchor, TimelineScale, TimelineWindow } from '../../domain/timeline';

/**
 * The dated axis's dependency layer: the arrows drawn between two bars, and the words a
 * row says about what it waits for.
 *
 * Beside `timeline.ts` rather than inside it because that file reached its 400-line
 * budget, and this is the seam that costs nothing to cross: everything here is about
 * ONE edge — where it lands and how it reads — while everything left behind is about
 * the grid the edges are drawn over. `dependencyNote` travels with them for the reason
 * it exists at all: it is shared verbatim with the shelf card, which draws no grid.
 */

/** The line's own thickness, and the floor every segment's length is held to — so two
 *  bars on one row (1f) or ends too close to route between still leave a mark rather
 *  than a zero-sized element. */
const ARROW_LINE_PX = 1.5;
/** How far a run leaves the prerequisite's finish before it turns. */
const ELBOW_PX = 10;
/** The horizontal run into the dependent's start, which carries the head. */
const ENTER_PX = 10;
/** Where the doubling-back lane sits when both ends are on ONE row. */
const LANE_DROP_PX = 12;

/** Shared by every row with no conflicting prerequisite, so a caller allocates nothing for the common case. */
/**
 * One arrow per drawable dependency edge, from the prerequisite's end to the
 * dependent's start — `Arrows between bars`' main flow. `dependencyArrows` has
 * already decided WHICH pairs have two bars to draw between (1a-1d); this asks only
 * where, and only of the edges its own window can still see — `dependencyAnchor`
 * returns null for an edge lying wholly outside the drawn window (1a's other half,
 * a render-time fact the domain layer never asked), and that edge draws nothing.
 *
 * The X axis is the grid's own day arithmetic, the established idiom. The Y axis is
 * not: two different items' rows have no day-based answer, so it is read off the ROWS
 * THEMSELVES once they exist, in the same coordinate space `content` positions
 * everything else in — a guessed row height is exactly the kind of baseline
 * `test/CLAUDE.md`'s card-children episode warns against, and jsdom cannot check
 * either one (every `getBoundingClientRect` here is zeros; a real vault is what
 * confirms the picture, `docs/requirements/Smoke test the roadmap.md`).
 *
 * One element per edge (4a), never one per pair of rows the window happens to draw —
 * asked once, over `dependencyArrows`' own list, never a walk of `bars` squared.
 * Nothing here is focusable and nothing is written. The arrow's OWN conflict styling
 * is asked of `.conflict` exactly as `dependencyArrows` computed it, never re-derived
 * here — but the dependent's ROW is no longer marked from this loop: `renderBarRow`
 * marks it from `conflictedPrereqs`, the same map this function's own `arrows` came
 * from, so the row states the conflict whether or not this loop found room to draw
 * it (concern 2 of `Arrows between bars`' Task 3 — a mark this loop applied only
 * survived the window; the row's own class must not).
 */
export function renderDependencyArrows(
	mounts: { layer: HTMLElement; content: HTMLElement; tracks: Map<string, HTMLElement> },
	window: TimelineWindow,
	arrows: DependencyArrow[],
	ruler: { scale: TimelineScale; leadWidth: number },
): void {
	if (arrows.length === 0) return;
	const { layer, content, tracks } = mounts;
	const { scale, leadWidth } = ruler;
	const contentTop = content.getBoundingClientRect().top;
	// Every rect this layer needs is read here, before any arrow element exists — the
	// write pass below only creates elements, never reads a rect, so the browser never
	// has to recalculate style+layout mid-loop for a DOM this same loop just mutated.
	const specs: { conflict: boolean; anchor: { fromDay: number; toDay: number }; fromRect: DOMRect; toRect: DOMRect }[] =
		[];
	for (const arrow of arrows) {
		const anchor = dependencyAnchor(window, arrow.from.span, arrow.to.span);
		const fromRow = tracks.get(arrow.from.item.file.path)?.parentElement;
		const toRow = tracks.get(arrow.to.item.file.path)?.parentElement;
		if (!anchor || !fromRow || !toRow) continue;
		specs.push({
			conflict: arrow.conflict,
			anchor,
			fromRect: fromRow.getBoundingClientRect(),
			toRect: toRow.getBoundingClientRect(),
		});
	}
	for (const spec of specs) {
		drawArrow(layer, spec.conflict, { scale, leadWidth, contentTop }, spec.anchor, [spec.fromRect, spec.toRect]);
	}
}

export const NO_CONFLICTS: ReadonlySet<string> = new Set();

/**
 * Every RENDERED dependent's row states what it waits for, whether or not an arrow was
 * drawn — `Arrows between bars` main flow step 3, extensions 1a/1b/1d/2b. Shared
 * verbatim by a dated row (`renderRowFacts`, below) and a shelved card
 * (`render/shelf.ts`'s `renderShelfCard`), which 1b names as the same kind of row: one
 * function is what keeps the two from drifting into different phrasings of one fact.
 *
 * Two lists, both read straight off the model rather than anything an arrow layer drew:
 * `item.prerequisites`, marking the conflicting ones from `conflicted` (1a — a
 * prerequisite with no bar at all is still named here, simply never a member of
 * `conflicted`, because nothing was derived for it to compare — main flow step 2's own
 * rule, read from the other side), and `item.brokenPrerequisites` (1d — an entry that
 * never became an edge at all, so its raw text is its only identity, the same text
 * `Remove dependency…` matches on; deduped the way that menu already groups repeats of
 * one line). '' where the item waits for nothing at all, so callers can skip the span
 * (and the marker's aria-label join) with a plain truthiness check.
 */
export function dependencyNote(item: BacklogItem, conflicted: ReadonlySet<string>): string {
	const named = item.prerequisites.map((p) => (conflicted.has(p.file.path) ? `${p.title} (conflict)` : p.title));
	const broken = [...new Set(item.brokenPrerequisites)].map((raw) => `${raw} (broken)`);
	const all = [...named, ...broken];
	return all.length === 0 ? '' : `Waits for ${all.join(', ')}`;
}

/**
 * One arrow per edge, routed the way a Gantt chart routes one: **axis-aligned elbows**
 * out of the prerequisite's finish and into the dependent's start, never a diagonal.
 * The rects are already read (by `renderDependencyArrows`, before any arrow exists)
 * rather than taken from the rows here, so this function is pure write: no
 * `getBoundingClientRect` call of its own to interleave with the elements it creates.
 *
 * Two routes, and which one applies is a fact about the dates rather than a style
 * choice. When the dependent starts far enough after the prerequisite finishes there is
 * room to turn once: out along the finish's row, down (or up) at a column just short of
 * the start, then in. When it does not — the overlap that IS the conflict, and the
 * reason a backward link exists at all — the run has to double back, so it drops out of
 * the finish, crosses the lane BETWEEN the two rows rather than through either of them,
 * and comes back in from the left. Both end the same way: a short horizontal run into
 * the start with the head on it, so an arrow always ARRIVES pointing right, whichever
 * direction it travelled.
 */
function drawArrow(
	layer: HTMLElement,
	conflict: boolean,
	ruler: { scale: TimelineScale; leadWidth: number; contentTop: number },
	anchor: { fromDay: number; toDay: number },
	rects: [DOMRect, DOMRect],
): void {
	const { scale, leadWidth, contentTop } = ruler;
	const [fromRect, toRect] = rects;
	const fromX = leadWidth + anchor.fromDay * scale.dayPx;
	const toX = leadWidth + anchor.toDay * scale.dayPx;
	const fromY = Math.round(fromRect.top - contentTop + fromRect.height / 2);
	const toY = Math.round(toRect.top - contentTop + toRect.height / 2);
	const seg = (x: number, y: number, w: number, h: number): void => {
		const el = layer.createDiv({ cls: `pbl-dep-seg${conflict ? ' pbl-dep-conflict' : ''}` });
		el.setCssProps({
			'--pbl-seg-left': `${Math.round(Math.min(x, x + w))}px`,
			'--pbl-seg-top': `${Math.round(Math.min(y, y + h))}px`,
			'--pbl-seg-width': `${Math.max(Math.abs(w), ARROW_LINE_PX)}px`,
			'--pbl-seg-height': `${Math.max(Math.abs(h), ARROW_LINE_PX)}px`,
		});
	};
	if (toX - fromX >= ELBOW_PX + ENTER_PX) {
		// Room to turn once: out, across, in.
		const turn = toX - ENTER_PX;
		seg(fromX, fromY, turn - fromX, 0);
		seg(turn, fromY, 0, toY - fromY);
		seg(turn, toY, ENTER_PX, 0);
	} else {
		// The overlap case. The lane is BETWEEN the rows — halfway to the dependent, and
		// a fixed drop when the two share one row, which is the only way `toY === fromY`
		// can happen here and the one case a midpoint would route straight back through
		// the bar it came from.
		const lane = toY === fromY ? fromY + LANE_DROP_PX : Math.round((fromY + toY) / 2);
		const out = fromX + ELBOW_PX;
		const back = toX - ENTER_PX;
		seg(fromX, fromY, ELBOW_PX, 0);
		seg(out, fromY, 0, lane - fromY);
		seg(back, lane, out - back, 0);
		seg(back, lane, 0, toY - lane);
		seg(back, toY, ENTER_PX, 0);
	}
	const head = layer.createDiv({ cls: `pbl-dep-head${conflict ? ' pbl-dep-conflict' : ''}` });
	head.setCssProps({ '--pbl-seg-left': `${Math.round(toX)}px`, '--pbl-seg-top': `${toY}px` });
}
