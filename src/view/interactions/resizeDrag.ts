/**
 * A column-boundary resize gesture, pointer and keyboard: press, drag, release to keep, a
 * platform cancel that puts the boundary back, arrow keys that step the boundary and Home
 * that resets it. Shared by the two grips that have one —
 * the timeline's lead column (`interactions/timelineLeadResize.ts`) and the tree's
 * property columns (`interactions/columnResize.ts`).
 *
 * What differs between them is only what a MOVEMENT means: the lead grip clamps against
 * the pane it draws in, a property column clamps against what may be stored and mirrors
 * the delta in a right-to-left layout. That is the whole of `widthAt`, and it is why this
 * takes a function rather than bounds — the two do not share a range, and a helper
 * carrying the pane's availability would have one caller with nothing to pass for it.
 *
 * The keys go through that same function, which is not tidiness: a caller whose delta
 * needs a sign (right to left) or a clamp would otherwise apply it twice, in two places,
 * one of which is the one somebody forgets.
 *
 * Pointer events (not `mousedown`/`mousemove`/`mouseup`) with `setPointerCapture`: capture
 * re-targets every later event at the grip regardless of where the pointer physically is,
 * which is what lets a 6px strip survive a drag leaving it — and what makes the move and
 * release handlers belong on the grip rather than on `window`. This plugin is not
 * desktop-only (`manifest.json`), so a mouse-only grip could not be resized on a touch
 * device at all. jsdom implements the `PointerEvent` constructor but not capture itself,
 * so the two capture calls go through an optional chain: real browsers use them, tests
 * dispatch on the grip directly and never need them to do anything.
 */
export function wireResizeGrip(
	grip: HTMLElement,
	gesture: {
		/** The width a movement of this many pixels names, clamped — and mirrored, if the caller mirrors. */
		widthAt: (deltaX: number) => number;
		/** The width the gesture found, restored when the platform cancels it. */
		startWidth: number;
		/** Draw a width without storing it — the only thing a move does. */
		live: (width: number) => void;
		/** Keep a width, if it differs from the one already on screen. */
		commit: (width: number) => void;
		/** Home: an explicit return to the default, which is a commit whatever is on screen. */
		reset: () => void;
	},
): void {
	wireKeys(grip, gesture);
	// The pointer that owns the gesture in flight, or null between gestures. A boundary is
	// dragged by ONE contact: a second finger landing on the grip mid-drag used to install
	// a second set of handlers with its own origin, after which every move fed both and
	// either finger lifting committed — so the width kept could be the one the other
	// contact was aiming at. It is refused rather than tracked, because there is no second
	// thing here to drag.
	let activePointer: number | null = null;
	grip.addEventListener('pointerdown', (evt) => {
		if (evt.button !== 0 || activePointer !== null) return;
		activePointer = evt.pointerId;
		// Not text selection: a resize drag has to feel like one, not a text drag.
		evt.preventDefault();
		grip.setPointerCapture?.(evt.pointerId);
		const startX = evt.clientX;
		// Every callback answers only to the contact that started the gesture — capture
		// re-targets that pointer's events here, it does not stop another pointer's from
		// arriving.
		const mine = (e: PointerEvent): boolean => e.pointerId === activePointer;
		const onMove = (moveEvt: PointerEvent): void => {
			if (mine(moveEvt)) gesture.live(gesture.widthAt(moveEvt.clientX - startX));
		};
		const end = (endEvt: PointerEvent): void => {
			grip.removeEventListener('pointermove', onMove);
			grip.removeEventListener('pointerup', onUp);
			grip.removeEventListener('pointercancel', onCancel);
			grip.releasePointerCapture?.(endEvt.pointerId);
			activePointer = null;
		};
		const onUp = (upEvt: PointerEvent): void => {
			if (!mine(upEvt)) return;
			end(upEvt);
			// DRAWN before it is committed, and unconditionally — a release carries its own
			// position and needs no `pointermove` before it, so the last width drawn is not
			// necessarily the width being released at. A gesture that wanders out and comes
			// back commits nothing (rightly: the stored pick has not changed), and without
			// this line the column would keep the last move's width on screen, and the
			// separator would go on announcing it, until something else happened to
			// re-render. Free when the commit does render: it writes the same number back.
			const width = gesture.widthAt(upEvt.clientX - startX);
			gesture.live(width);
			gesture.commit(width);
		};
		// A cancel is the platform saying the gesture stopped being the user's — palm
		// rejection, an orientation change, another gesture taking it over. The width it
		// happened to reach is one nobody chose, so it is put BACK rather than saved:
		// `live` alone, never `commit`, which also leaves the store with no entry to take
		// away later. `touch-action: none` does not make this rare — that stops the
		// scroller stealing the pan, not the platform interrupting.
		const onCancel = (cancelEvt: PointerEvent): void => {
			if (!mine(cancelEvt)) return;
			end(cancelEvt);
			gesture.live(gesture.startWidth);
		};
		grip.addEventListener('pointermove', onMove);
		grip.addEventListener('pointerup', onUp);
		grip.addEventListener('pointercancel', onCancel);
	});
}

/**
 * Arrow keys step the boundary; Home puts it back. Both go through the caller's own
 * `widthAt`, so the keyboard and the pointer cannot disagree about which direction is
 * wider or where the bounds are.
 *
 * `preventDefault` on all three: the pane beneath scrolls on arrows and jumps to the top
 * on Home, and a resize that also scrolled the tree would move the row under the reader's
 * eyes while they sized a column.
 */
function wireKeys(
	grip: HTMLElement,
	gesture: { widthAt: (deltaX: number) => number; commit: (width: number) => void; reset: () => void },
): void {
	grip.addEventListener('keydown', (evt) => {
		if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
			evt.preventDefault();
			gesture.commit(gesture.widthAt(evt.key === 'ArrowRight' ? KEY_STEP_PX : -KEY_STEP_PX));
		} else if (evt.key === 'Home') {
			evt.preventDefault();
			gesture.reset();
		}
	});
}

/** How far one arrow-key press moves the boundary, in pixels. */
const KEY_STEP_PX = 10;
