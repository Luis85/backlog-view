// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';
import {
	DEFAULT_PROP_COLUMN_WIDTH,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
} from '../../src/storage/collapseStore';

useViewHarness();

const COLUMNS = { order: ['note.points', 'note.owner'] };

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, points: 5, owner: 'Sam' } });
	return vault;
}

/** The grip on column `index`, which is the one on that column's own header cell. */
function grip(containerEl: HTMLElement, index = 0): HTMLElement {
	const el = treeOf(containerEl).querySelectorAll<HTMLElement>('.pbl-col-grip')[index];
	if (!el) throw new Error(`no resize grip for column ${index}`);
	return el;
}

function pointer(type: string, clientX: number, pointerId = 1): PointerEvent {
	return new PointerEvent(type, { bubbles: true, clientX, pointerId, button: 0 });
}

/** What column `index` is currently DRAWN at, which is one declaration on the scroller. */
function drawn(containerEl: HTMLElement, index = 0): string {
	return treeOf(containerEl).style.getPropertyValue(`--pbl-prop-w-${index}`);
}

describe('the property-column resize grip', () => {
	it('carries a real separator role, named after its own column, and states its bounds', () => {
		const { containerEl } = makeView(fixture(), {}, COLUMNS);

		const el = grip(containerEl);
		expect(el.getAttribute('role')).toBe('separator');
		expect(el.getAttribute('aria-orientation')).toBe('vertical');
		expect(el.getAttribute('tabindex')).toBe('0');
		// The column's own display name: two grips are on screen whenever two columns are.
		expect(el.getAttribute('aria-label')).toBe('Resize the points column');
		expect(grip(containerEl, 1).getAttribute('aria-label')).toBe('Resize the owner column');
		expect(el.getAttribute('aria-valuemin')).toBe(String(MIN_PROP_COLUMN_WIDTH));
		expect(el.getAttribute('aria-valuemax')).toBe(String(MAX_PROP_COLUMN_WIDTH));
		expect(el.getAttribute('aria-valuenow')).toBe(String(DEFAULT_PROP_COLUMN_WIDTH));
	});

	describe('dragging', () => {
		it('resizes live without writing anything, and persists once on release', () => {
			const vault = fixture();
			const { view, containerEl, config } = makeView(vault, {}, COLUMNS);

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 40));
			// Live feedback only: the published width moves, nothing is stored, and neither
			// the `.base` nor a note is touched.
			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH + 40}px`);
			expect(el.getAttribute('aria-valuenow')).toBe(String(DEFAULT_PROP_COLUMN_WIDTH + 40));
			expect(view.colWidths['note.points']).toBeUndefined();
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);

			el.dispatchEvent(pointer('pointerup', 40));
			expect(view.colWidths['note.points']).toBe(DEFAULT_PROP_COLUMN_WIDTH + 40);
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);
		});

		it('moves only the column it belongs to', () => {
			const { view, containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl, 1);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 30));

			expect(view.colWidths['note.owner']).toBe(DEFAULT_PROP_COLUMN_WIDTH + 30);
			expect(view.colWidths['note.points']).toBeUndefined();
			expect(drawn(containerEl, 0)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);
			expect(drawn(containerEl, 1)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH + 30}px`);
		});

		it('clamps to what may be stored rather than accepting whatever the pointer names', () => {
			const { view, containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 5000));
			expect(view.colWidths['note.points']).toBe(MAX_PROP_COLUMN_WIDTH);

			const wide = grip(containerEl);
			wide.dispatchEvent(pointer('pointerdown', 0));
			wide.dispatchEvent(pointer('pointerup', -5000));
			expect(view.colWidths['note.points']).toBe(MIN_PROP_COLUMN_WIDTH);
		});

		it('takes back a cancelled gesture rather than saving where it was interrupted', () => {
			const { view, containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 60));
			el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));

			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);
			expect(view.colWidths['note.points']).toBeUndefined();
		});

		it('answers one contact only, so a second finger cannot commit the first one’s drag', () => {
			const { view, containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0, 1));
			// A second contact lands mid-gesture and is refused outright: its move and its
			// release both name a pointer this grip is not following.
			el.dispatchEvent(pointer('pointerdown', 100, 2));
			el.dispatchEvent(pointer('pointermove', 200, 2));
			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);
			el.dispatchEvent(pointer('pointerup', 200, 2));
			expect(view.colWidths['note.points']).toBeUndefined();

			// The first contact still owns it.
			el.dispatchEvent(pointer('pointerup', 20));
			expect(view.colWidths['note.points']).toBe(DEFAULT_PROP_COLUMN_WIDTH + 20);
		});

		it('draws the width it was released at, even when that width is stored already', () => {
			// A release carries its own position and needs no `pointermove` before it, so the
			// last width DRAWN is not necessarily the width being released at. Wander out and
			// come back: the pick has not changed and nothing should be stored — but the
			// column has to be back where it started on screen, and the separator has to be
			// announcing that, rather than keeping the excursion's width until some later
			// render happens to correct it. In `interactions/resizeDrag.ts`, so it holds for
			// the timeline's lead grip too.
			const { view, containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 80));
			el.dispatchEvent(pointer('pointerup', 0));

			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);
			expect(el.getAttribute('aria-valuenow')).toBe(String(DEFAULT_PROP_COLUMN_WIDTH));
			expect(view.colWidths['note.points']).toBeUndefined();
		});

		it('stores nothing for a gesture that changes no width', () => {
			// A tap, a drag that ends where it began, and a drag pushing further into a
			// bound the column already sits at. None of them is a new pick, and committing
			// one would spend a write on the width already on screen.
			const { view, containerEl } = makeView(fixture(), {}, { ...COLUMNS, widths: { 'note.points': MAX_PROP_COLUMN_WIDTH } });
			const el = grip(containerEl);

			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 0));
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 400));

			expect(view.colWidths['note.points']).toBe(MAX_PROP_COLUMN_WIDTH);
			// The grip is still the one the gesture started on: nothing re-rendered.
			expect(grip(containerEl)).toBe(el);
		});
	});

	describe('a right-to-left layout', () => {
		// The grip is pinned with `inset-inline-end`, so it moves to the column's LEFT edge
		// while `clientX` stays physical — the mismatch the register's own RTL note calls
		// its third group. Dragging the boundary outward has to widen the column either
		// way, and the arrow keys move it in the physical direction the separator pattern
		// says they do.
		const rtl = (): void => document.documentElement.setAttribute('dir', 'rtl');
		const ltr = (): void => document.documentElement.removeAttribute('dir');

		it('widens as the boundary is dragged outward, whichever way that is', () => {
			rtl();
			try {
				const { view, containerEl } = makeView(fixture(), {}, COLUMNS);
				const el = grip(containerEl);
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointermove', -40));
				// Outward here is to the LEFT, and the column follows live.
				expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH + 40}px`);
				el.dispatchEvent(pointer('pointerup', -40));
				expect(view.colWidths['note.points']).toBe(DEFAULT_PROP_COLUMN_WIDTH + 40);
			} finally {
				ltr();
			}
		});

		it('moves the boundary the way the arrow key points, not the way the column grows', () => {
			rtl();
			try {
				const { view, containerEl } = makeView(fixture(), {}, COLUMNS);
				grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
				expect(view.colWidths['note.points']).toBe(DEFAULT_PROP_COLUMN_WIDTH + 10);
			} finally {
				ltr();
			}
		});
	});

	describe('the keyboard', () => {
		it('steps the width with the arrow keys and resets it with Home', () => {
			const { view, containerEl } = makeView(fixture(), {}, COLUMNS);

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(view.colWidths['note.points']).toBe(DEFAULT_PROP_COLUMN_WIDTH + 10);
			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
			// A step that lands back ON the default stores nothing: absence IS the default,
			// so the entry goes rather than holding the number that means the same thing.
			expect(view.colWidths['note.points']).toBeUndefined();
			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
			// Back to the default, and stored as ABSENCE rather than as the default number.
			expect(view.colWidths['note.points']).toBeUndefined();
			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);
		});

		it('resets on a double click, which is the only reset a pointer has', () => {
			// `pointerdown` prevents default, so a mouse never focuses the strip: without
			// this, Home is a key the reader has to Tab onto the grip to press. The two taps
			// underneath commit nothing on their own, so this arrives on a column exactly
			// where it was.
			const { view, containerEl } = makeView(fixture(), {}, { ...COLUMNS, widths: { 'note.points': 210 } });

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 0));
			expect(view.colWidths['note.points']).toBe(210);

			el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
			expect(view.colWidths['note.points']).toBeUndefined();
			expect(drawn(containerEl)).toBe(`${DEFAULT_PROP_COLUMN_WIDTH}px`);
		});

		it('keeps focus on the grip across the render its own keypress caused', () => {
			// The write rebuilds the header and destroys the element pressed. Without the
			// restore, a reader stepping a column by repeated presses is dropped back to
			// the document body after the very first press.
			const { containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl, 1);
			el.focus();
			el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

			const replacement = grip(containerEl, 1);
			expect(replacement).not.toBe(el);
			expect(document.activeElement).toBe(replacement);
		});

		it('takes no focus from a pointer resize', () => {
			// `pointerdown` prevents default, so the strip is never focused by a mouse —
			// and refocusing regardless would hand a separator a focus the reader never
			// gave it, after which their next arrow key resizes a column instead of moving
			// the row selection.
			const { containerEl } = makeView(fixture(), {}, COLUMNS);

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 40));

			expect(document.activeElement).not.toBe(grip(containerEl));
		});

		it('leaves the tree its own keys', () => {
			// The grip is a real tab stop inside a pane whose rows are reached by arrow
			// keys. `handleTreeKeydown` ignores any event whose target is not the tree
			// itself, and that guard is the whole reason this deviation is affordable — so
			// it is checked here, at the grip: a key the grip does not claim bubbles out
			// and must still move no selection.
			const { containerEl, view } = makeView(fixture(), {}, COLUMNS);
			view.selectItem(view.model?.items[0] as never, false);
			const selected = view.selectedPath;

			const el = grip(containerEl);
			el.focus();
			el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

			expect(view.selectedPath).toBe(selected);
		});
	});

	it('drops a column the resized ones no longer leave room for, and gives it back', () => {
		const { view, containerEl } = makeView(fixture(), {}, COLUMNS);
		const tree = treeOf(containerEl);
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};
		const cells = () => rowByTitle(containerEl, 'Epic A').querySelectorAll('.pbl-prop').length;

		// A pane that holds two default columns and not two wide ones: what fits is summed
		// per column now, so widening ONE of them is enough to drop the other.
		paneWidth(700);
		expect(cells()).toBe(2);
		view.setColWidth('note.points', MAX_PROP_COLUMN_WIDTH);
		expect(cells()).toBe(1);
		view.setColWidth('note.points', null);
		expect(cells()).toBe(2);
	});

	it('keeps each width per saved view, restored from the store rather than the base', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { ...COLUMNS, base: 'Plan.base', viewName: 'Tree' });
		first.view.setColWidth('note.owner', 210);
		first.view.onunload();

		const reopened = makeView(vault, {}, { ...COLUMNS, base: 'Plan.base', viewName: 'Tree' });
		expect(reopened.view.colWidths['note.owner']).toBe(210);
		expect(reopened.config.setCalls).toEqual([]);

		// A different saved view of the same base keeps its own.
		const other = makeView(vault, {}, { ...COLUMNS, base: 'Plan.base', viewName: 'Board' });
		expect(other.view.colWidths['note.owner']).toBeUndefined();
	});
});
