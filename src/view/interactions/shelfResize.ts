import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { wireResizeGrip } from './resizeDrag';
import { MAX_SHELF_HEIGHT_PX, MIN_SHELF_HEIGHT_PX } from '../../storage/viewStateStore';

/**
 * Where the shelf's own height is published: one custom property on the shelf element, read
 * by BOTH the `height` and the `max-height` in `styles/roadmap.css` and `styles/board.css`.
 * The two declarations share it with different fallbacks, which is what makes a picked
 * number a real height and its absence the share of the pane the band has always taken.
 * Module-private —
 * `publishShelfHeight` below is the only way it reaches an element, which is what keeps
 * "set a height" and "take the declaration away" one decision rather than two spellings
 * at two call sites.
 *
 * The indirection is what makes a drag show anything, the column grip's reason exactly —
 * nothing re-renders mid-gesture, so the only way the band can follow the pointer is for
 * the declaration it already reads to change under it. It is set only once a height has
 * been PICKED: absent, the `var()` falls through to the share of the pane the stylesheet
 * gives it, which is the same "a default is written as nothing at all" rule the store
 * keeps one layer down.
 */
const SHELF_HEIGHT_VAR = '--pbl-shelf-h';

/**
 * Put a height on the band, or take the declaration away when there is none — the ONE
 * statement of how a stored pick reaches the DOM, shared by the render that draws the band
 * and by the gesture that ends without committing.
 *
 * Absence is a value here as it is in the store: with no pick the declaration is removed
 * rather than set to anything, so `styles/shelf.css`'s `var()` falls through to the share
 * of the pane the band has always taken. `removeProperty` because `setCssProps` only ever
 * sets — there is no Obsidian helper for taking one off, and an empty string would be a
 * second spelling of the same intent to keep in step.
 */
export function publishShelfHeight(shelfEl: HTMLElement, height: number | null): void {
	if (height === null) shelfEl.style.removeProperty(SHELF_HEIGHT_VAR);
	else shelfEl.setCssProps({ [SHELF_HEIGHT_VAR]: `${height}px` });
	// The CLASS travels with the value, from the one place that sets either. A picked height
	// has to survive the flex line it sits on, and on the dated axis alone the bands are
	// `flex: 0 1 auto` — so a stored 400 drew 222px in a 500px window and 102px in a 380px
	// one (measured), with the grip still starting its gesture from 400. The two other
	// surfaces are already `flex: 0 0 auto`; this makes the dated axis agree while a height
	// is in force, and leaves it shrinking exactly as before when none is. A class rather
	// than a second custom property because the stylesheet has to WIN a specificity contest
	// with the axis rule, which a bare `.pbl-shelf-sized` could not — see `styles/shelf.css`.
	shelfEl.toggleClass('pbl-shelf-sized', height !== null);
}

/**
 * A height clamped to what may be stored, which is also the range the separator
 * announces: a gesture can never draw or persist a number `readPrefs` would refuse on the
 * way back in, and `aria-valuenow` can never leave the range beside it.
 *
 * It is NOT clamped against the pane, unlike the timeline's lead column, and that is a
 * decision with a cost rather than an omission. The lead column had to be: a stored width
 * wider than the pane covered the whole grid and pinned its own grip off screen, so there
 * was no way back. A shelf taller than the pane squeezes the axis or the columns to their
 * own floor and the frame SCROLLS — the band rule's stated fallback (`styles/roadmap.css`)
 * — so the grip that undoes it is still reachable and nothing is unrecoverable. What is
 * bought by leaving it is that the stored pick is never written down to a narrow pane and
 * so comes back in full in a wide one, which is what `leadWidth` needed a measurement, a
 * second effective width and a `ResizeObserver` branch to arrange. What is paid is that a
 * reader CAN push the axis off screen at `MAX_SHELF_HEIGHT_PX` in a short pane, which 30%
 * alone could not do.
 */
function clampShelfHeight(height: number): number {
	return Math.min(Math.max(Math.round(height), MIN_SHELF_HEIGHT_PX), MAX_SHELF_HEIGHT_PX);
}

/**
 * The grip along the open shelf's foot: drag it to say how much of the pane the band may
 * take before it scrolls, double click or press Home to hand that back to the stylesheet.
 *
 * A real tab stop, `role="separator"`, `aria-orientation="horizontal"` — the terms the
 * two column grips already earn and for their reasons (`src/view/CLAUDE.md`, "A resize
 * grip is a real tab stop wherever it appears"): it is chrome fixed to the band's own
 * frame, it never renders among the cards, and both pane key handlers ignore any event
 * whose target is not the pane itself, so its arrows stay its own. It is the FOURTH
 * control to earn a stop inside a composite and so pays that accepted ARIA deviation a
 * fourth time — a focusable non-`option` inside the roadmap's `listbox`, a focusable
 * non-`treeitem` never (the tree draws no shelf).
 *
 * `vertical` is the whole of what makes it a different gesture from those two: it reads
 * `clientY` and claims ArrowUp/ArrowDown, and everything else — the single-contact rule,
 * the platform cancel putting the band back, the refusal to commit a height equal to the
 * one the gesture found — is `wireResizeGrip`'s and is therefore the same code the column
 * grips are checked through.
 *
 * **What is stored is a HEIGHT, not a maximum**, and that is the decision the rest of this
 * module rests on. A picked band is exactly as tall as it was dragged to: it scrolls when
 * the cards need more and shows space when they need less, which is what every resizable
 * panel does and what a reader asks for by dragging an edge to a place. Until a height is
 * picked nothing is stored and the stylesheet's own share of the pane is in force, so the
 * default is unchanged and no band reserves room nobody asked for.
 *
 * It replaced a `max-height`, and the replacement is a deletion rather than an addition
 * (Codex, PR #183, five findings in this file). Under a cap the band drew `min(content,
 * cap)`, and every one of those findings was that expression: an origin that disagreed with
 * the edge a reader could touch, a downward drag with no visible effect, an uncommitted
 * gesture publishing a measurement as a cap, and a growth committed invisibly over a larger
 * stored number. None of them can be posed against a height — the edge, the stored value and
 * `aria-valuenow` are one number.
 */
/**
 * The height a gesture starts from — and, at render, the height the separator announces.
 *
 * **A picked height IS the band's height**, so the stored number is the answer and no
 * measurement is needed for it: `styles/roadmap.css` sets `height` from the same custom
 * property it sets `max-height` from, and the band is exactly that tall whatever the cards
 * need. That is the whole reason the store holds a height rather than a cap, and it is what
 * collapsed a family of defects into nothing — an origin that could disagree with the edge,
 * a downward drag with no visible effect, a growth committed invisibly over a larger stored
 * number. All three were consequences of `min(content, cap)` and none of them can be posed
 * against a height.
 *
 * An UNPICKED band still has to be measured, and only there: with no stored value the
 * stylesheet's own share of the pane is in force and the band is content-sized, so the edge
 * a reader grabs is `offsetHeight` — the border box both declarations apply to, and every
 * box here is `border-box`. An unmeasured pane (jsdom, or Obsidian rendering before layout
 * settles) reports 0 and clamps to the floor, which is the smallest band a gesture could
 * produce rather than no answer at all.
 *
 * One read on one element, at the render and once more per gesture. What
 * `src/view/CLAUDE.md` bans is a read PER ROW and a read inside a `pointermove` stream;
 * this is neither, and it is now skipped entirely once a height has been picked.
 */
function gestureOrigin(host: BacklogViewHost, shelfEl: HTMLElement): number {
	return host.shelfHeight ?? clampShelfHeight(shelfEl.offsetHeight);
}

/**
 * @param below Whether the band sits BELOW the axis it competes with — the grid axes, where
 * the shelf renders after the timeline (`render/roadmap.ts`). The grip belongs on the edge
 * the two share, so there it goes to the band's TOP and a drag UP is what makes the shelf
 * taller. Everywhere else the shelf leads and the grip stays at its foot. One flag, read
 * twice and nowhere else: where the strip is put in the band, and which sign a movement
 * carries.
 */
export function renderShelfResize(host: BacklogViewHost, shelfEl: HTMLElement, below: boolean): void {
	const grip = shelfEl.createDiv({
		cls: 'pbl-shelf-grip',
		attr: {
			role: 'separator',
			'aria-orientation': 'horizontal',
			'aria-label': t('resize.shelf'),
			'aria-valuemin': String(MIN_SHELF_HEIGHT_PX),
			'aria-valuemax': String(MAX_SHELF_HEIGHT_PX),
			tabindex: '0',
		},
	});
	// **Set after the strip is in the band, never before it**, for the case where this is a
	// measurement: the strip is itself a flex item whose negative start margin cancels the
	// GAP above it and not its own height, so it adds 8px to a content-sized band — measured
	// in the harness at 236px against 228px with it taken out and put back.
	//
	// Once a height is PICKED this is the stored number and cannot drift: the band is that
	// tall whatever its cards do. Only an unpicked band is content-sized, and only there can
	// this attribute age between renders — an in-place redraw such as `renderCardChildren`'s
	// own `draw` changes the band without rebuilding the grip. `wireResizeGrip` refreshes it
	// when a gesture takes hold, so what is left is a reader who only listens, on a band
	// nobody has sized yet, hearing the last render's number. Recorded rather than closed.
	grip.setAttribute('aria-valuenow', String(gestureOrigin(host, shelfEl)));
	// Moved in the DOM rather than by `order`, so the tab stop is where the strip is drawn:
	// a grip a reader sees above the header but reaches after every card is the reordering
	// `styles/shelf.css` states outright must not happen on this band. The class travels with
	// it for the same reason `pbl-shelf-sized` travels with the height — one place decides.
	if (below) shelfEl.prepend(grip);
	setTooltip(grip, t('resize.gripTooltip'));
	if (refocus) grip.focus();
	wireResizeGrip(grip, {
		vertical: true,
		// Down is taller at the band's FOOT and shorter at its TOP: the grip is on the edge
		// that moves when the shelf grows, and which edge that is decides the sign. Both
		// directions move it now — under a maximum the downward one did nothing on a band
		// shorter than its cap. The KEYS come through here too (`wireResizeGrip`), so
		// ArrowUp/ArrowDown move the separator the way the pointer does without a second
		// statement of it. No `widenSign` mirror beside it: a pane may be given its own
		// direction, and no writing mode this plugin runs in turns the block axis upside down.
		sizeAt: (deltaY, from) => clampShelfHeight(below ? from - deltaY : from + deltaY),
		// Read per gesture, and for one case only: an UNPICKED band is content-sized, so its
		// edge moves under redraws that rebuild no grip (`renderCardChildren`'s own `draw`).
		// Once a height is picked the stored number IS the edge and this is a lookup — which
		// is what the two column grips have always had, and what the cap could never give.
		origin: () => gestureOrigin(host, shelfEl),
		live: (height) => publishShelfHeight(shelfEl, height),
		// What a gesture that commits nothing leaves behind, and it still matters for the
		// unpicked band alone: `live` has just drawn the origin, which there is a MEASUREMENT,
		// and publishing it would turn a band the stylesheet was sizing into one pinned at
		// whatever height it happened to have. With a height already picked the origin is that
		// height and this writes the same number back.
		restore: () => publishShelfHeight(shelfEl, host.shelfHeight),
		commit: (height) => commit(host, grip, height),
		// An explicit hand-back to the stylesheet's own share of the pane, which is what
		// absence means here — never `MIN`/`MAX` and never the measured number, or Home would
		// store the very percentage it is trying to stop overriding.
		reset: () => commit(host, grip, null),
	});
}

/**
 * Store a height and put focus back where the reader left it.
 *
 * The write re-renders the pane and destroys this grip, so whether it HELD focus is asked
 * before the write and honoured by the pass that write triggers — the column grip's own
 * mechanism, and for its reason: a keyboard reader stepping the band by repeated presses
 * is otherwise dropped to the document body after the very first press. A pointer gesture
 * never held focus (`pointerdown` prevents default), so nothing is refocused that the
 * reader did not focus themselves.
 *
 * The GRIP's own document, not the global one: a view in an Obsidian pop-out window draws
 * into that window's document while `document` stays the main window's, so the comparison
 * would be false for every reader in a pop-out. See [[The view reads the main window's
 * document]].
 */
function commit(host: BacklogViewHost, grip: HTMLElement, height: number | null): void {
	refocus = grip.ownerDocument.activeElement === grip;
	host.setShelfHeight(height);
	// Cleared right here rather than by the render: `setShelfHeight` renders synchronously,
	// so the only pass that may claim this focus is the one it just ran — and a pass that
	// drew no shelf at all (the last card scheduled away) draws no grip to claim it.
	refocus = false;
}

/**
 * Whether the shelf's grip must take focus when the band is next drawn. Module state
 * rather than a member, because the two ends of it are one synchronous call apart —
 * `commit` sets it, the render it triggers reads it, and `commit` clears it before
 * returning. Exactly `columnResize.ts`'s `refocusIndex`, for a control there is only ever
 * one of.
 */
let refocus = false;
