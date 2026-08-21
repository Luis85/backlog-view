/**
 * A boundary resize gesture, pointer and keyboard: press, drag, release to keep, a
 * platform cancel that puts the boundary back, arrow keys that step the boundary, and Home
 * or a double click that resets it. Shared by the three grips that have one —
 * the timeline's lead column (`interactions/timelineLeadResize.ts`), the tree's
 * property columns (`interactions/columnResize.ts`) and the shelf's own foot
 * (`interactions/shelfResize.ts`).
 *
 * What differs between them is only what a MOVEMENT means: the lead grip clamps against
 * the pane it draws in, a property column clamps against what may be stored and mirrors
 * the delta in a right-to-left layout, the shelf clamps against its storable height. That
 * is the whole of `sizeAt`, and it is why this takes a function rather than bounds — the
 * three do not share a range, and a helper carrying the pane's availability would have two
 * callers with nothing to pass for it.
 *
 * `sizeAt` rather than a name saying WIDTH, and `vertical` beside it, because the shelf's
 * grip moves a HEIGHT: a boundary is a boundary, and the only thing this module needs to
 * know about the axis is which client coordinate carries the movement and which arrow keys
 * claim it. Nothing else here reads the axis — the sign, the bounds and the meaning of
 * "more" are all the caller's `sizeAt`, exactly as they already were.
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
		/** The size a movement of this many pixels names, clamped — and mirrored, if the caller mirrors. */
		sizeAt: (delta: number) => number;
		/**
		 * The size the gesture found — both what a platform cancel puts back, and what
		 * `keep` compares against, which are the same number by construction.
		 */
		startSize: number;
		/** Draw a size without storing it — the only thing a move does. */
		live: (size: number) => void;
		/** Keep a size. Reached only through `keep` below, so never one already on screen. */
		commit: (size: number) => void;
		/** An explicit return to the default, which is a commit whatever is on screen. */
		reset: () => void;
		/**
		 * Put the boundary back as the STORE has it, for a gesture that ends without
		 * committing — a tap, a drag that returns to where it began, a platform cancel.
		 *
		 * Only a caller whose `startSize` is a MEASUREMENT needs this, which today is the
		 * shelf's alone: the two column grips take their origin from the stored width, so
		 * redrawing that origin already restores exactly what was there and they pass
		 * nothing. The shelf's band is a `max-height` and draws `min(content, cap)`, so its
		 * origin is the drawn height and can be far below the cap the store holds —
		 * redrawing the origin there PUBLISHES a cap nobody committed, and nothing renders
		 * it away (Codex, PR #183).
		 */
		restore?: () => void;
		/**
		 * Which axis this boundary moves along: absent or false for a vertical separator
		 * dragged left and right (both column grips), true for a horizontal one dragged up
		 * and down (the shelf's foot). It picks the client coordinate the delta is measured
		 * on and the arrow pair the grip claims, and NOTHING else — a grip that claimed both
		 * pairs would swallow the arrow key the pane beneath it uses to move the selection.
		 */
		vertical?: boolean;
	},
): void {
	// Drawing a width and ANNOUNCING it are one act, done here rather than by each caller's
	// own `live`: `aria-valuenow` is the only thing a screen reader has to go on, and a
	// version of this that lived beside each gesture is a version that can be half-written.
	const show = (size: number): void => {
		gesture.live(size);
		grip.setAttribute('aria-valuenow', String(size));
	};
	// Commit only a width that DIFFERS from the one the gesture found. Asked here, once,
	// rather than by each grip in its own way — three separate versions of this question
	// have now been wrong. It is not "did the pointer move": at a bound a real drag (or
	// ArrowRight at the ceiling) produces a delta whose clamped target is the width already
	// drawn, and committing that writes the CLAMP back over a wider stored pick, losing a
	// choice made in a wider pane for good. What matters is only what would change.
	// `reset` deliberately does not come through here: it clears the pick whatever is on
	// screen, so pressing Home on a column already at the default still means "the default".
	const keep = (size: number): void => {
		if (size !== gesture.startSize) gesture.commit(size);
		// A gesture that changed nothing has to leave the boundary as it FOUND it, which is
		// not always the size it started from — see `restore`. Absent, this is a no-op and
		// the drawn origin stands, which is what the column grips want.
		else gesture.restore?.();
	};
	// The one place the axis is read for the KEYS. `at` below is the same reading for the
	// pointer, and both are handed the caller's own `sizeAt` — so a grip cannot end up
	// stepping on one axis and dragging on the other.
	const vertical = gesture.vertical ?? false;
	wireKeys(grip, { sizeAt: gesture.sizeAt, keep, reset: gesture.reset, vertical });
	/** Where along this grip's own axis a pointer event sits. */
	const at = (evt: PointerEvent): number => (vertical ? evt.clientY : evt.clientX);
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
		const start = at(evt);
		// Every callback answers only to the contact that started the gesture — capture
		// re-targets that pointer's events here, it does not stop another pointer's from
		// arriving.
		const mine = (e: PointerEvent): boolean => e.pointerId === activePointer;
		const onMove = (moveEvt: PointerEvent): void => {
			if (mine(moveEvt)) show(gesture.sizeAt(at(moveEvt) - start));
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
			const size = gesture.sizeAt(at(upEvt) - start);
			show(size);
			keep(size);
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
			show(gesture.startSize);
			// A cancel commits nothing by definition, so it takes the same restore a no-op
			// release does — `show` above has just drawn the origin, and for a caller whose
			// origin is a measurement that is not what was there.
			gesture.restore?.();
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
 * `sizeAt`, so the keyboard and the pointer cannot disagree about which direction is
 * bigger or where the bounds are.
 *
 * ONE pair per grip, picked by the axis it moves along: a vertical separator claims
 * Left/Right and a horizontal one Up/Down. Every key it does not claim bubbles, which is
 * what leaves the pane beneath free to move its selection — and is exactly what
 * `test/view/columnResize.test.ts` checks at the forbidden thing rather than by listing
 * the keys.
 *
 * `preventDefault` on the two it claims and on Home: the pane beneath scrolls on arrows and
 * jumps to the top on Home, and a resize that also scrolled the tree would move the row
 * under the reader's eyes while they sized a column.
 */
function wireKeys(
	grip: HTMLElement,
	gesture: { sizeAt: (delta: number) => number; keep: (size: number) => void; reset: () => void; vertical: boolean },
): void {
	const [less, more] = gesture.vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
	grip.addEventListener('keydown', (evt) => {
		if (evt.key === less || evt.key === more) {
			evt.preventDefault();
			gesture.keep(gesture.sizeAt(evt.key === more ? KEY_STEP_PX : -KEY_STEP_PX));
		} else if (evt.key === 'Home') {
			evt.preventDefault();
			gesture.reset();
		}
	});
}

/** How far one arrow-key press moves the boundary, in pixels. */
const KEY_STEP_PX = 10;
