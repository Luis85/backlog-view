import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { wireResizeGrip } from './resizeDrag';
import { MAX_SHELF_HEIGHT_PX, MIN_SHELF_HEIGHT_PX } from '../../storage/viewStateStore';

/**
 * Where the shelf's own cap is published: one custom property on the shelf element, read
 * by `styles/shelf.css`'s `max-height`.
 *
 * The indirection is what makes a drag show anything, the column grip's reason exactly —
 * nothing re-renders mid-gesture, so the only way the band can follow the pointer is for
 * the declaration it already reads to change under it. It is set only once a height has
 * been PICKED: absent, the `var()` falls through to the share of the pane the stylesheet
 * gives it, which is the same "a default is written as nothing at all" rule the store
 * keeps one layer down.
 */
export const SHELF_HEIGHT_VAR = '--pbl-shelf-h';

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
 * **The one layout read.** With no stored pick the band's cap is a percentage the
 * stylesheet owns, so there is no number to announce or to drag from until it is
 * measured — `offsetHeight`, the border box `max-height` itself applies to. It is one
 * read on one element at the end of one render pass, the same shape and the same cost as
 * `render/roadmap.ts`'s own `treeEl.clientWidth`; what `src/view/CLAUDE.md` bans is a read
 * PER ROW and a read inside an input handler, and this is neither. An unmeasured pane
 * (jsdom, or Obsidian rendering before layout settles) reports 0 and clamps to the floor,
 * which is a grip that announces the smallest band it could produce rather than one that
 * announces nothing.
 */
export function renderShelfResize(host: BacklogViewHost, shelfEl: HTMLElement): void {
	const current = clampShelfHeight(host.shelfHeight ?? shelfEl.offsetHeight);
	const grip = shelfEl.createDiv({
		cls: 'pbl-shelf-grip',
		attr: {
			role: 'separator',
			'aria-orientation': 'horizontal',
			'aria-label': t('resize.shelf'),
			'aria-valuemin': String(MIN_SHELF_HEIGHT_PX),
			'aria-valuemax': String(MAX_SHELF_HEIGHT_PX),
			'aria-valuenow': String(current),
			tabindex: '0',
		},
	});
	setTooltip(grip, t('resize.gripTooltip'));
	if (refocus) grip.focus();
	wireResizeGrip(grip, {
		vertical: true,
		// Down is taller: the grip is at the band's FOOT, which is the edge that moves when
		// the shelf grows, so a positive `clientY` delta means more. No `widenSign` mirror
		// beside it — a pane may be given its own direction, and no writing mode this plugin
		// runs in turns the block axis upside down.
		sizeAt: (deltaY) => clampShelfHeight(current + deltaY),
		startSize: current,
		live: (height) => shelfEl.setCssProps({ [SHELF_HEIGHT_VAR]: `${height}px` }),
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
