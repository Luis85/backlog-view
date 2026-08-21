import { setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { wireResizeGrip } from './resizeDrag';
import { MAX_TIMELINE_LEAD_PX, MIN_TIMELINE_LEAD_PX } from '../../storage/viewStateStore';
import { t } from '../../i18n/t';

/**
 * The lead column's own drag handle, mounted in the timeline HEADER
 * (`render/timeline.ts`'s `renderCellHeader`) — a user asked for this specifically,
 * choosing a resize over a bigger constant, because a title's real budget is
 * `TIMELINE_LEAD_PX` minus the badge, its padding and its gap, and no single number
 * fits every vault's titles.
 *
 * Not `CardDragController`: that controller's whole shape is a `BacklogItem` picked
 * up and dropped somewhere (`cardDrag.ts`'s own preamble), and a column boundary is
 * neither a card nor a drop target. The gesture itself is `wireResizeGrip`
 * (`interactions/resizeDrag.ts`) — the delta-then-clamp shape `timelineDrag.ts`'s holds
 * already use, without forcing a fake item through machinery built for one — and it is
 * shared with the tree's property-column grip (`interactions/columnResize.ts`), which
 * arrived as a copy of it. What stays here is what this boundary MEANS: the pane's own
 * clamp, and what a commit does to the store.
 *
 * `tabindex="0"` — a REAL tab stop — where every other control inside this
 * one-tab-stop pane (`src/view/CLAUDE.md`'s Controls section) is `tabindex="-1"`
 * reached from a menu, because those compete with the roving arrow-key CARD
 * selection the pane owns. This does not: it is chrome fixed to the grid's own
 * geometry, not a card, and it never renders among cards to begin with. Once it
 * holds focus, `handleRoadmapKeydown`'s own guard (`evt.target !== evt.currentTarget`
 * in `interactions/keyboard.ts`) leaves its own keys alone — the same escape hatch
 * the shelf's promoted-to-real-tab-stop controls rely on when the pane has no cards
 * at all — so giving this one a real stop costs the composite nothing and there is
 * no menu a continuous "hold the arrow key" gesture would fit inside anyway. That
 * guard is what the whole deviation rests on, so it is checked HERE, at the grip:
 * `test/view/timelineLeadResize.test.ts` dispatches an ArrowDown — a key this grip
 * does not claim, so it bubbles to the pane — at the focused grip and asserts the
 * card selection does not move.
 */
export function renderLeadResize(
	host: BacklogViewHost,
	leadEl: HTMLElement,
	content: HTMLElement,
	// Grouped rather than five parameters: `current` is the EFFECTIVE width this render
	// drew (already clamped to `available`, see `effectiveLeadWidth`), and `available` is
	// threaded through only so `aria-valuemax` can say what the pane can actually give —
	// see below.
	lead: { current: number; defaultWidth: number; available: number },
): void {
	const { current, defaultWidth, available } = lead;
	const grip = leadEl.createDiv({
		cls: 'pbl-timeline-lead-grip',
		attr: {
			role: 'separator',
			'aria-orientation': 'vertical',
			'aria-label': t('resize.leadColumn'),
			// BOTH ends come from the pane, not just the ceiling. A reader dragging past
			// the ceiling would see nothing move, because the render clamps it straight
			// back; and below `MIN_TIMELINE_LEAD_PX + MIN_DAY_TRACK_PX` the pane cannot
			// even give the storable minimum, so announcing it would put valuemin above
			// valuemax. `leadBoundsFor` is the same range `effectiveLeadWidth` clamps
			// into, so what is announced and what is drawn cannot name different limits.
			'aria-valuemin': String(leadBoundsFor(available).min),
			'aria-valuemax': String(leadBoundsFor(available).max),
			'aria-valuenow': String(current),
			tabindex: '0',
		},
	});
	setTooltip(grip, t('resize.gripTooltip'));

	// Live feedback is the CSS custom property alone — nothing re-renders mid-gesture,
	// and that splits the frame in two while the gesture lasts. Everything laid out AFTER
	// the sticky lead reads `--pbl-tl-lead` and so DOES track it: the header's date
	// tiers, every row's track and therefore every bar, the weekend layer and the drop
	// overlay. What stays put is the three marks positioned absolutely with `leadWidth`
	// already added into the number, baked into an element's own inline style at the LAST
	// render — the gridlines, the today line and the milestone lines.
	// ponytail: so the accepted cost is not a few stray marks, it is the whole grid out
	// of register — for the length of the drag every bar sits on the wrong gridline and
	// today's mark is off by the gesture's delta. Taken because `commit` below re-renders
	// at the settled width and it is gone the instant the pointer releases; redoing that
	// arithmetic on every `pointermove` is the upgrade path.
	// Announcing the width is `wireResizeGrip`'s, not this function's — see its own note.
	const live = (width: number): void => {
		content.setCssProps({ '--pbl-tl-lead': `${width}px` });
	};

	// Persisted once, here — never from `live` — so a drag's `mousemove` stream and a
	// held arrow key both cost one write to the view-state store, not one per pixel or
	// per repeat event. `defaultWidth` back to `null` is `density`'s own rule: the
	// default needs no stored entry, so dragging back to it clears the pick rather than
	// writing the number that means the same thing. A width equal to the one on screen
	// never reaches here at all — `wireResizeGrip` refuses it against `startSize` below.
	const commit = (width: number): void => {
		// Asked BEFORE the write below, which destroys this element and with it the
		// answer: focus is restored only to a grip that actually held it. A pointer
		// gesture never does — `pointerdown` calls `preventDefault()`, so the mouse
		// never focuses the strip — and refocusing unconditionally handed the separator
		// a focus the user had not given it, after which their next arrow key resized
		// the column instead of moving the card selection (`handleRoadmapKeydown`
		// bails on any event whose target is not the pane itself — the guard checked
		// at the grip in the "leaves the pane its own keys" test). "A pointer resize
		// takes no focus" in the same suite is what holds this half.
		// The grip's OWN document — see `interactions/columnResize.ts`'s own note: in a
		// pop-out window the global one belongs to the main window and this is never true.
		const held = grip.ownerDocument.activeElement === grip;
		host.setLeadWidth(width === defaultWidth ? null : width);
		// The write above re-renders the whole projection, destroying THIS element —
		// the shelf header's own controls hit the identical wall (`shelfControls.ts`'s
		// `refocus`), and the fix is the same: find the replacement and refocus it, or
		// a keyboard user resizing by repeated presses is dropped back to the document
		// body after the very first one.
		if (held) host.roadmap?.scroller?.querySelector<HTMLElement>('.pbl-timeline-lead-grip')?.focus();
	};

	wireResizeGrip(grip, {
		// The gesture's baseline is where the grip VISUALLY is — `current`, the effective
		// width this render drew — never `host.leadWidth` directly: on a pane too narrow for
		// the stored pick those two disagree, and starting from the stored one would jump
		// the column the instant the pointer moved a single pixel.
		sizeAt: (deltaX, from) => effectiveLeadWidth(from + deltaX, available),
		// Also the width the gesture will not commit back — at a pane boundary a drag or an
		// arrow key clamps straight onto it, and writing that clamp back over a wider stored
		// pick loses a choice made in a wider pane for good.
		// A constant, the property column's reason exactly: this origin is the stored width
		// and only a render moves it.
		origin: () => current,
		live,
		commit,
		reset: () => commit(defaultWidth),
	});
}

/**
 * Room reserved for the day track when the pane is too narrow to also hold the
 * stored lead width — enough that a sliver of grid always survives, never the whole
 * width the opaque lead column. Its own constant, not `MIN_TIMELINE_LEAD_PX`: that one
 * bounds what may be STORED, this one bounds what the lead may DRAW at, and the two
 * answer different questions the moment a pane is narrower than the sum of both.
 */
export const MIN_DAY_TRACK_PX = 80;

/**
 * A lead width clamped into what the pane can honour — ONE answer to two questions,
 * because they were the same expression over the same `leadBoundsFor` range under two
 * names.
 *
 * The RENDER asks it of the stored pick, and draws the result: a stored 480 in a 300px
 * pane draws narrower here without being rewritten, so it comes back in full the moment
 * the pane widens again, the same rule `density` and the axis pick already keep.
 * `renderTimeline` resolves this ONCE and threads the result everywhere the CSS width and
 * the TS arithmetic — the today line, the milestone lines, the gridlines — have to agree;
 * see its own comment for what happens when they don't (commit 791e1da).
 *
 * A GESTURE asks it of the width the pointer or the arrow key names, so the interaction
 * honours exactly the range the separator announces: dragging past it moved
 * `aria-valuenow` past the `aria-valuemax` beside it, covered the day track the clamp
 * reserves, and persisted a number the very next render threw away. Neither use narrows
 * what is STORED — a pick made in a wider pane is clamped for display, and bounds what a
 * reader can newly ASK for here, which in a narrow pane is all they can express anyway.
 *
 * **A measurement of 0 or less means "not measured", not "clamp to the minimum".**
 * jsdom reports `clientWidth` as 0 and Obsidian itself renders before layout settles,
 * so a clamp that fired on an unmeasured pane would shrink the column for every reader
 * rather than only the one actually looking at a narrow split. Falling through to the
 * stored width in that case is what keeps the two apart.
 */
export function effectiveLeadWidth(stored: number, availablePx: number): number {
	const { min, max } = leadBoundsFor(availablePx);
	return Math.min(Math.max(stored, min), max);
}

/**
 * The range the pane can actually honour, which is what the separator has to ANNOUNCE
 * as well as draw within. Below `MIN_TIMELINE_LEAD_PX + MIN_DAY_TRACK_PX` the pane
 * cannot give both, and the storable minimum stops being a floor the pane can reach: a
 * 200px pane can spare 120px for the column, so reporting `aria-valuemin` 160 against
 * an `aria-valuemax` of 120 hands assistive tech a backwards range — invalid exactly in
 * the narrow case the clamp exists for. Both ends therefore come from the pane.
 *
 * The `availablePx / 2` term decides nothing above `2 * MIN_DAY_TRACK_PX`: the plain
 * subtraction is the larger of the two from there on, so this does NOT stop a lead wider
 * than the grid it labels — a 200px pane gives 120px of column over an 80px track, which
 * is the worked example above. It binds only at the narrow end, and what it buys there is
 * that the column stays worth drawing: the subtraction leaves a sliver just under 160px
 * and zero or less at or below `MIN_DAY_TRACK_PX` itself — no titles at all — so half the
 * pane stands in, and `paneMax` never goes negative.
 *
 * An unmeasured pane (0 or less) reports the storable bounds unchanged, for the reason
 * `effectiveLeadWidth` falls through: not measured is not narrow.
 */
export function leadBoundsFor(availablePx: number): { min: number; max: number } {
	if (availablePx <= 0) return { min: MIN_TIMELINE_LEAD_PX, max: MAX_TIMELINE_LEAD_PX };
	const paneMax = Math.max(Math.min(MIN_TIMELINE_LEAD_PX, Math.floor(availablePx / 2)), availablePx - MIN_DAY_TRACK_PX);
	return { min: Math.min(MIN_TIMELINE_LEAD_PX, paneMax), max: Math.min(MAX_TIMELINE_LEAD_PX, paneMax) };
}
