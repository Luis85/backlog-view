/**
 * A column-boundary resize gesture, pointer and keyboard: press, drag, release to keep, a
 * platform cancel that puts the boundary back, arrow keys that step the boundary, and Home
 * or a double click that resets it. Shared by the two grips that have one —
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
		/**
		 * The width the gesture found — both what a platform cancel puts back, and what
		 * `keep` compares against, which are the same number by construction.
		 */
		startWidth: number;
		/** Draw a width without storing it — the only thing a move does. */
		live: (width: number) => void;
		/** Keep a width. Reached only through `keep` below, so never one already on screen. */
		commit: (width: number) => void;
		/** An explicit return to the default, which is a commit whatever is on screen. */
		reset: () => void;
	},
): void {
	// Drawing a width and ANNOUNCING it are one act, done here rather than by each caller's
	// own `live`: `aria-valuenow` is the only thing a screen reader has to go on, and a
	// version of this that lived beside each gesture is a version that can be half-written.
	const show = (width: number): void => {
		gesture.live(width);
		grip.setAttribute('aria-valuenow', String(width));
	};
	// Commit only a width that DIFFERS from the one the gesture found. Asked here, once,
	// rather than by each grip in its own way — three separate versions of this question
	// have now been wrong. It is not "did the pointer move": at a bound a real drag (or
	// ArrowRight at the ceiling) produces a delta whose clamped target is the width already
	// drawn, and committing that writes the CLAMP back over a wider stored pick, losing a
	// choice made in a wider pane for good. What matters is only what would change.
	// `reset` deliberately does not come through here: it clears the pick whatever is on
	// screen, so pressing Home on a column already at the default still means "the default".
	const keep = (width: number): void => {
		if (width !== gesture.startWidth) gesture.commit(width);
	};
	wireKeys(grip, { widthAt: gesture.widthAt, keep, reset: gesture.reset });
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
			if (mine(moveEvt)) show(gesture.widthAt(moveEvt.clientX - startX));
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
			show(width);
			keep(width);
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
			show(gesture.startWidth);
		};
		grip.addEventListener('pointermove', onMove);
		grip.addEventListener('pointerup', onUp);
		grip.addEventListener('pointercancel', onCancel);
	});
	// Double click on the boundary is what every column of every table has meant by "put
	// this back" for thirty years, and it is the only reset a POINTER has: `pointerdown`
	// prevents default, so the grip never takes focus from a mouse and Home is a key the
	// reader would first have to Tab to the strip to press. The two taps under it commit
	// nothing on their own — a gesture that changes no width is refused by `keep` — so
	// this arrives on a boundary still exactly where it was.
	grip.addEventListener('dblclick', (evt) => {
		evt.preventDefault();
		gesture.reset();
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
	gesture: { widthAt: (deltaX: number) => number; keep: (width: number) => void; reset: () => void },
): void {
	grip.addEventListener('keydown', (evt) => {
		if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
			evt.preventDefault();
			gesture.keep(gesture.widthAt(evt.key === 'ArrowRight' ? KEY_STEP_PX : -KEY_STEP_PX));
		} else if (evt.key === 'Home') {
			evt.preventDefault();
			gesture.reset();
		}
	});
}

/** How far one arrow-key press moves the boundary, in pixels. */
const KEY_STEP_PX = 10;
