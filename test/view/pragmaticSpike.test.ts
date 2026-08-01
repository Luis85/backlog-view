// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { installObsidianDom } from '../helpers/dom';
import { dragEvent, fakeDataTransfer } from '../helpers/dnd';

installObsidianDom();

/**
 * SPIKE, kept as the standing proof — can the jsdom harness drive
 * pragmatic-drag-and-drop's element adapter the way it drives the tree's own
 * listeners (synthetic dragstart/dragover/drop with a supplied dataTransfer)?
 * It can, which is why the board's write paths get the same real-interaction
 * coverage the tree's have and no seam exists between the tests and the engine.
 * Isolated from the board deliberately: if a library upgrade breaks jsdom
 * compatibility, this file names the problem before a board test muddies it.
 * Outcome recorded in docs/issues/Pragmatic drag and drop for the board.md.
 */
describe('pragmatic-drag-and-drop element adapter under jsdom', () => {
	it('fires drop targets and monitors from synthetic drag events', () => {
		const card = document.body.createDiv();
		const column = document.body.createDiv();

		const seen: string[] = [];
		const cleanups = [
			draggable({
				element: card,
				getInitialData: () => ({ path: 'Card.md' }),
				onDragStart: () => seen.push('dragstart'),
			}),
			dropTargetForElements({
				element: column,
				getData: () => ({ state: 'Active' }),
				onDragEnter: () => seen.push('enter'),
				onDrop: ({ source, self }) => seen.push(`drop:${String(source.data.path)}→${String(self.data.state)}`),
			}),
			monitorForElements({
				onDrop: () => seen.push('monitor-drop'),
			}),
		];

		const dt = fakeDataTransfer();
		card.dispatchEvent(dragEvent('dragstart', dt));
		column.dispatchEvent(dragEvent('dragenter', dt, { clientX: 100, clientY: 150 }));
		column.dispatchEvent(dragEvent('dragover', dt, { clientX: 100, clientY: 150 }));
		column.dispatchEvent(dragEvent('drop', dt, { clientX: 100, clientY: 150 }));

		expect(seen).toContain('dragstart');
		expect(seen).toContain('enter');
		expect(seen).toContain('drop:Card.md→Active');
		expect(seen).toContain('monitor-drop');

		for (const cleanup of cleanups) cleanup();
	});
});
