/**
 * The pointer half of a column-boundary resize: press, drag, release to keep, and a
 * platform cancel that puts the boundary back. Shared by the two grips that have one —
 * the timeline's lead column (`interactions/timelineLeadResize.ts`) and the tree's
 * property columns (`interactions/columnResize.ts`).
 *
 * What differs between them is only what a pointer position MEANS: the lead grip clamps
 * against the pane it draws in, a property column clamps against what may be stored. That
 * is the whole of `widthAt`, and it is why this takes a function rather than bounds — the
 * two do not share a range, and a helper carrying the pane's availability would have one
 * caller with nothing to pass for it.
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
export function wireResizeDrag(
	grip: HTMLElement,
	gesture: {
		/** The width the pointer names, this far from where the gesture started, clamped. */
		widthAt: (deltaX: number) => number;
		/** The width the gesture found, restored when the platform cancels it. */
		startWidth: number;
		/** Draw a width without storing it — the only thing a move does. */
		live: (width: number) => void;
		/** Keep a width, if it differs from the one already on screen. */
		commit: (width: number) => void;
	},
): void {
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
			gesture.commit(gesture.widthAt(upEvt.clientX - startX));
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
