/**
 * Synthetic drag events for pragmatic-drag-and-drop under jsdom. The element
 * adapter listens for the browser's native drag events; jsdom has no DragEvent or
 * DataTransfer, so these build MouseEvents carrying the minimum DataTransfer
 * surface the adapter touches — the same substitution the tree's drag tests make.
 * `cardDrag` and `startCardDrag` below are the only callers; nothing outside this
 * file needs the pieces.
 */
import { vi } from 'vitest';

interface FakeDataTransfer {
	setData: (type: string, value: string) => void;
	getData: (type: string) => string;
	clearData: () => void;
	setDragImage: () => void;
	readonly types: string[];
	items: unknown[];
	files: unknown[];
	effectAllowed: string;
	dropEffect: string;
}

function fakeDataTransfer(): FakeDataTransfer {
	const store = new Map<string, string>();
	return {
		setData: (type: string, value: string) => void store.set(type, value),
		getData: (type: string) => store.get(type) ?? '',
		clearData: () => store.clear(),
		setDragImage: () => {},
		get types() {
			return Array.from(store.keys());
		},
		items: [],
		files: [],
		effectAllowed: 'all',
		dropEffect: 'none',
	};
}

function dragEvent(type: string, dataTransfer: FakeDataTransfer, init: MouseEventInit = {}): MouseEvent {
	const evt = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
	Object.defineProperty(evt, 'dataTransfer', { value: dataTransfer });
	return evt;
}

/**
 * Pick a card up and hand back the rest of the gesture, so a test can change the
 * world between the two halves — a Bases update mid-drag is a real thing, and the
 * drop that follows it is the one that has to resolve the dragged path again.
 */
export function startCardDrag(card: HTMLElement): (region: HTMLElement) => void {
	const dt = fakeDataTransfer();
	card.dispatchEvent(dragEvent('dragstart', dt));
	return (region: HTMLElement) => {
		region.dispatchEvent(dragEvent('dragenter', dt, { clientX: 10, clientY: 10 }));
		region.dispatchEvent(dragEvent('dragover', dt, { clientX: 10, clientY: 10 }));
		region.dispatchEvent(dragEvent('drop', dt, { clientX: 10, clientY: 10 }));
	};
}

/**
 * Drag a card onto a drop region, the whole gesture: start, enter, over, drop.
 * One helper for the board's columns and the roadmap's buckets and shelf — the
 * gesture is the same one, wired by the same controller.
 */
export function cardDrag(card: HTMLElement, region: HTMLElement): void {
	startCardDrag(card)(region);
}

/**
 * Put the timeline at a nonzero viewport offset AND a nonzero scroll. jsdom computes
 * no layout, so both have to be stubbed — and both have to be nonzero, because a
 * fixture at the origin passes whether or not the pointer is converted at all.
 */
export function pannedGrid(
	containerEl: HTMLElement,
	{ rectLeft, scrollLeft }: { rectLeft: number; scrollLeft: number },
): (gridOffset: number) => number {
	const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
	const overlay = containerEl.querySelector<HTMLElement>('.pbl-timeline-drop');
	if (!scroller || !overlay) throw new Error('the timeline is not rendered');
	scroller.scrollLeft = scrollLeft;
	Object.defineProperty(scroller, 'clientWidth', { value: 600, configurable: true });
	// The overlay starts PAST the sticky lead column, so that exclusion is structural
	// rather than a constant kept in step with the CSS — and the rect moves with the
	// scroll, exactly as a real one does, which is why a placing read adds no scroll
	// term. `rectLeft` is where the overlay's left edge sits UNSCROLLED; panning right
	// by `scrollLeft` carries it that far left.
	const left = rectLeft - scrollLeft;
	overlay.getBoundingClientRect = () =>
		({ left, right: 4000, top: 0, bottom: 400, width: 4000, height: 400, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
	// The viewport X of a given GRID OFFSET, computed from this helper's own inputs and
	// never by reading the stubbed rect back. A test that asked the rect would mirror
	// whatever the implementation does with it, including getting the sign wrong; stating
	// the geometry from first principles is what makes the conversion falsifiable.
	return (gridOffset) => left + gridOffset;
}

export function overlayOf(containerEl: HTMLElement): HTMLElement {
	const overlay = containerEl.querySelector<HTMLElement>('.pbl-timeline-drop');
	if (!overlay) throw new Error('no drop overlay');
	return overlay;
}

/**
 * A positional drag: start at `from`, move over the target at `clientX`, drop there.
 *
 * `from` is the coordinate the DRAG STARTED at, which the adapter reports as
 * `location.initial.input.clientX` and a delta read is measured against. It defaults to
 * the drop point — a gesture that expressed no movement — so a PLACING test, which reads
 * the pointer absolutely and has no origin, can leave it out. A MOVING test must set it,
 * or it is asserting against a zero delta whatever the implementation does.
 */
export function gridDrag(source: HTMLElement, target: HTMLElement, at: { clientX: number; from?: number }): void {
	const gesture = gridDrag.start(source, { clientX: at.from ?? at.clientX });
	gesture.over(target, at);
	gesture.drop(target, at);
}

gridDrag.start = (source: HTMLElement, origin: { clientX: number } = { clientX: 0 }) => {
	const dt = fakeDataTransfer();
	// The origin rides the dragstart, which is where the real adapter takes
	// `location.initial` from.
	source.dispatchEvent(dragEvent('dragstart', dt, origin));
	return {
		over: (target: HTMLElement, at: { clientX: number }) => {
			target.dispatchEvent(dragEvent('dragenter', dt, { ...at, clientY: 20 }));
			target.dispatchEvent(dragEvent('dragover', dt, { ...at, clientY: 20 }));
		},
		leave: (target: HTMLElement) => target.dispatchEvent(dragEvent('dragleave', dt, { clientX: 0, clientY: 0 })),
		drop: (target: HTMLElement, at: { clientX: number }) => target.dispatchEvent(dragEvent('drop', dt, { ...at, clientY: 20 })),
		/**
		 * End a gesture that never drops — a hover-only test that only asserts a
		 * preview. Pragmatic keeps a drag "active" globally (with auto-scroll's own
		 * animation-frame loop running) until a `dragend`, whatever else has happened
		 * to it; a test that leaves one hanging bleeds a live rAF loop into whichever
		 * test runs next, where it throws on a jsdom API auto-scroll needs
		 * (`elementsFromPoint`) that this harness never stubs.
		 */
		cancel: () => source.dispatchEvent(dragEvent('dragend', dt)),
	};
};

/**
 * What the view last announced. The live region is the drag library's shared
 * `role="status"` node — one node for every card move, whichever projection and
 * whichever input made it — updated on a timer so a focus change cannot interrupt
 * it, so reading it means driving fake timers past that delay. `useViewHarness`
 * clears the region between tests, or a stale announcement would answer for the
 * next one.
 */
export async function announced(): Promise<string> {
	await vi.advanceTimersByTimeAsync(1100);
	// A DIRECT child of body: the library appends its region there, while the
	// toolbar's busy indicator carries `role="status"` too and lives inside the view.
	return document.body.querySelector(':scope > [role="status"]')?.textContent ?? '';
}
