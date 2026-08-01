/**
 * Synthetic drag events for pragmatic-drag-and-drop under jsdom. The element
 * adapter listens for the browser's native drag events; jsdom has no DragEvent or
 * DataTransfer, so these build MouseEvents carrying the minimum DataTransfer
 * surface the adapter touches — the same substitution the tree's drag tests make,
 * proven against the adapter by `test/view/pragmaticSpike.test.ts`.
 */

export interface FakeDataTransfer {
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

export function fakeDataTransfer(): FakeDataTransfer {
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

export function dragEvent(type: string, dataTransfer: FakeDataTransfer, init: MouseEventInit = {}): MouseEvent {
	const evt = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
	Object.defineProperty(evt, 'dataTransfer', { value: dataTransfer });
	return evt;
}

/** Drag a board card onto a column, the whole gesture: start, enter, over, drop. */
export function boardDrag(card: HTMLElement, column: HTMLElement): void {
	const dt = fakeDataTransfer();
	card.dispatchEvent(dragEvent('dragstart', dt));
	column.dispatchEvent(dragEvent('dragenter', dt, { clientX: 10, clientY: 10 }));
	column.dispatchEvent(dragEvent('dragover', dt, { clientX: 10, clientY: 10 }));
	column.dispatchEvent(dragEvent('drop', dt, { clientX: 10, clientY: 10 }));
}
