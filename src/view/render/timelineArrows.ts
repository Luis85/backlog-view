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

/**
 * The floor a drawn arrow's length is held to, so two bars on one row (1f) or ends too
 * close to route between still leave a mark rather than a zero-width element.
 */
const MIN_ARROW_PX = 4;

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
	mounts: { content: HTMLElement; tracks: Map<string, HTMLElement> },
	window: TimelineWindow,
	arrows: DependencyArrow[],
	ruler: { scale: TimelineScale; leadWidth: number },
): void {
	if (arrows.length === 0) return;
	const { content, tracks } = mounts;
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
		drawArrow(content, spec.conflict, { scale, leadWidth, contentTop }, spec.anchor, [spec.fromRect, spec.toRect]);
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
 * One arrow element, positioned from the day axis and the two rows' own rects — the
 * rects are already read (by `renderDependencyArrows`, before any arrow exists) rather
 * than taken from the rows here, so this function is pure write: no `getBoundingClientRect`
 * call of its own to interleave with the elements the loop around it is creating.
 */
function drawArrow(
	content: HTMLElement,
	conflict: boolean,
	ruler: { scale: TimelineScale; leadWidth: number; contentTop: number },
	anchor: { fromDay: number; toDay: number },
	rects: [DOMRect, DOMRect],
): void {
	const { scale, leadWidth, contentTop } = ruler;
	const [fromRect, toRect] = rects;
	const fromX = leadWidth + anchor.fromDay * scale.dayPx;
	const toX = leadWidth + anchor.toDay * scale.dayPx;
	const fromY = fromRect.top - contentTop + fromRect.height / 2;
	const toY = toRect.top - contentTop + toRect.height / 2;
	const length = Math.max(Math.hypot(toX - fromX, toY - fromY), MIN_ARROW_PX);
	const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;
	const el = content.createDiv({
		cls: `pbl-dependency-arrow${conflict ? ' pbl-dependency-arrow-conflict' : ''}`,
		attr: { 'aria-hidden': 'true' },
	});
	el.setCssProps({
		'--pbl-arrow-left': `${fromX}px`,
		'--pbl-arrow-top': `${fromY}px`,
		'--pbl-arrow-width': `${length}px`,
		'--pbl-arrow-angle': `${angle}deg`,
	});
}
