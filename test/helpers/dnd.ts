/**
 * Synthetic drag events for pragmatic-drag-and-drop under jsdom. The element
 * adapter listens for the browser's native drag events; jsdom has no DragEvent or
 * DataTransfer, so these build MouseEvents carrying the minimum DataTransfer
 * surface the adapter touches — the same substitution the tree's drag tests make.
 * `cardDrag` below is the only caller; nothing outside this file needs the pieces.
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
 * Drag a card onto a drop region, the whole gesture: start, enter, over, drop.
 * One helper for the board's columns and the roadmap's buckets and shelf — the
 * gesture is the same one, wired by the same controller.
 */
export function cardDrag(card: HTMLElement, region: HTMLElement): void {
	const dt = fakeDataTransfer();
	card.dispatchEvent(dragEvent('dragstart', dt));
	region.dispatchEvent(dragEvent('dragenter', dt, { clientX: 10, clientY: 10 }));
	region.dispatchEvent(dragEvent('dragover', dt, { clientX: 10, clientY: 10 }));
	region.dispatchEvent(dragEvent('drop', dt, { clientX: 10, clientY: 10 }));
}

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
