import { BasesPropertyId, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { wireResizeGrip } from './resizeDrag';
import {
	DEFAULT_PROP_COLUMN_WIDTH,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
} from '../../storage/collapseStore';

/**
 * The width one property column draws at: its reader's own stored pick, or the default
 * until they resize it. Asked by everything that needs a number — the fit ladder, the
 * header and the grip below — so the budget and the layout cannot name different widths.
 *
 * Here rather than in `render/columns.ts` beside its callers, for the reason
 * `effectiveLeadWidth` sits in `timelineLeadResize.ts` rather than in `render/timeline.ts`:
 * the gesture is what decides a width, so the answer belongs with it — and a render module
 * that owned it would have to import this one back, which is a cycle rather than a
 * preference (`npm run analyze` fails on it).
 *
 * A plain record lookup, so it stays out of `RowContext`: what that snapshot exists to
 * keep off the per-row path is the Bases CONFIG calls, which cost a great deal more than
 * reading a key.
 */
export function columnWidth(host: BacklogViewHost, prop: BasesPropertyId): number {
	return host.colWidths[prop] ?? DEFAULT_PROP_COLUMN_WIDTH;
}

/**
 * Where column `index`'s width is published: one custom property per column on the tree
 * element, inherited by the header cell and by that column's cell on every row.
 *
 * That indirection is what makes a drag show anything. Nothing re-renders mid-gesture
 * (the lead column's rule, for the lead column's reason), so the only way every row can
 * follow the pointer is for all of their cells to read ONE declaration — and a width
 * written onto each cell would need every row walked to change it, which is the scan
 * `src/view/CLAUDE.md` bans outright.
 */
export function columnWidthVar(index: number): string {
	return `--pbl-prop-w-${index}`;
}

/**
 * One property column's drag handle, mounted on its own header cell
 * (`render/columns.ts`'s `renderColumnHeader`). The tree's columns are fixed-width so
 * values line up down a column, and no one number fits every vault: a title property
 * wants far more room than a risk chip, and both used to take one slider's word for it.
 *
 * The gesture is the timeline lead column's, and now literally so — pointer and keyboard
 * both are `wireResizeGrip` (`interactions/resizeDrag.ts`), shared by both grips. What
 * stays here is what this boundary MEANS: which width is being moved, what bounds it, and
 * what a commit does to the store.
 *
 * `tabindex="0"` — a real tab stop inside a pane whose rows are reached by arrow keys —
 * for the reason the lead grip has one: it is chrome fixed to the header's geometry, it
 * never renders among rows, and `handleTreeKeydown` ignores any event whose target is not
 * the tree itself (`interactions/keyboard.ts`), so a focused grip keeps its own arrow keys
 * and the row selection stays where it was. There is no menu a continuous "hold the arrow
 * key" gesture would fit inside either, which is what the per-row controls use instead.
 */
export function renderColumnResize(
	host: BacklogViewHost,
	cell: HTMLElement,
	// The element the widths are published on — `renderTree`'s own scroller. Passed rather
	// than walked up to from the cell: the publisher and the reader of `columnWidthVar` are
	// then the same element by construction.
	treeEl: HTMLElement,
	// `widen` is which way this boundary grows — see {@link widenSign}, which the caller
	// asks ONCE for the whole strip.
	column: { prop: BasesPropertyId; label: string; index: number; widen: number },
): void {
	const { prop, label, index, widen } = column;
	const current = columnWidth(host, prop);
	const grip = cell.createDiv({
		cls: 'pbl-col-grip',
		attr: {
			role: 'separator',
			'aria-orientation': 'vertical',
			// The column's own display name, not "this column": two grips are on screen
			// whenever two columns are, and a reader tabbing onto one has nothing else to
			// tell them apart by.
			'aria-label': `Resize the ${label} column`,
			// The storable bounds, unqualified by the pane — unlike the lead column, whose
			// range narrows with the room it has. A property column too wide for the pane is
			// DROPPED by the fit ladder rather than covering what it labels, so there is no
			// width here that draws differently from the one announced.
			'aria-valuemin': String(MIN_PROP_COLUMN_WIDTH),
			'aria-valuemax': String(MAX_PROP_COLUMN_WIDTH),
			'aria-valuenow': String(current),
			tabindex: '0',
		},
	});
	setTooltip(grip, 'Drag to resize, or double click to reset. Focus it for the arrow keys and Home');

	// Live feedback is the published custom property alone — the header cell and this
	// column's cell on every row all read it, so one declaration moves the whole column
	// and nothing re-renders while the pointer is down. Announcing the width is
	// `wireResizeGrip`'s, not this function's: the two halves of showing one cannot be
	// half-written if only one place writes them.
	const live = (width: number): void => {
		treeEl.setCssProps({ [columnWidthVar(index)]: `${width}px` });
	};

	const commit = (width: number): void => {
		// Asked BEFORE the write, which re-renders the header and destroys this element:
		// focus is restored only to a grip that actually held it. A pointer gesture never
		// does — `pointerdown` calls `preventDefault()`, so the strip is never focused by a
		// mouse — and refocusing regardless would hand a separator a focus the reader had
		// not given it, after which their next arrow key resizes a column instead of moving
		// the row selection.
		//
		// The GRIP's own document, not the global one: a view in an Obsidian pop-out window
		// draws into that window's document while `document` stays the main window's, so
		// the comparison would be false for every reader in a pop-out and a keyboard resize
		// would drop focus after its first step. The jsdom harness has one document and
		// cannot tell the two spellings apart, so what the suite checks is the main-window
		// behaviour — see [[The view reads the main window's document]] for the five other
		// places in `view/` that still ask the global.
		if (grip.ownerDocument.activeElement === grip) refocusIndex = index;
		host.setColWidth(prop, width === DEFAULT_PROP_COLUMN_WIDTH ? null : width);
		// Cleared right here rather than by the render: `setColWidth` renders synchronously,
		// so the only pass that may claim this focus is the one it just ran — and a pass
		// that dropped the column (a width the pane can no longer hold) draws no grip to
		// claim it at all.
		refocusIndex = null;
	};

	if (refocusIndex === index) grip.focus();
	wireResizeGrip(grip, {
		widthAt: (deltaX) => clampColumnWidth(current + widen * deltaX),
		// Also what the gesture will not commit back: `wireResizeGrip` refuses a width
		// equal to this one, which is what makes ArrowRight at the ceiling, ArrowLeft at
		// the floor and a drag that ends where it began all cost nothing — no write, no
		// render, and no undoing of a focus the reader still has.
		startWidth: current,
		live,
		commit,
		reset: () => commit(DEFAULT_PROP_COLUMN_WIDTH),
	});
}

/**
 * The column whose grip must take focus when the header is next drawn, or null between
 * commits. Module state rather than a member, because the two ends of it are one
 * synchronous call apart: `commit` sets it, the render it triggers reads it, and `commit`
 * clears it before returning. A keyboard reader stepping a column by repeated presses is
 * otherwise dropped back to the document body after the very first press — the wall the
 * shelf's own controls hit, and the lead grip after them.
 */
let refocusIndex: number | null = null;

/**
 * Which way a boundary in this strip widens: +1 left to right, -1 right to left. The grip
 * is pinned with `inset-inline-end`, so in a right-to-left layout it sits at the column's
 * LEFT edge and a drag toward the left is what makes the column bigger — while `clientX`
 * stays physical whichever way the text runs. That mismatch is the hazard
 * `docs/requirements/Nothing pins a physical side.md` names as its third group: a logical
 * CSS edge whose offset TypeScript goes on computing physically. One sign covers the
 * pointer and both arrow keys, and it agrees with the separator pattern either way —
 * Arrow Right moves the boundary physically right, which widens the column in one
 * direction and narrows it in the other.
 *
 * Asked of the header STRIP rather than of the document: a pane can be given its own
 * direction, and the answer that matters is the one where the grips actually are. Asked
 * once per render for all of them — `direction` is inherited, so every cell in the strip
 * answers the same, and `getComputedStyle` is a forced style flush that has no business
 * running once per column, let alone inside a `pointermove` stream (the shape of cost
 * `src/view/CLAUDE.md` bans). The direction cannot change while a finger is down without
 * a render in between. An element not yet in a document (the harness builds one that way)
 * has no computed style to read and is treated as left to right, which is what it draws as.
 */
export function widenSign(strip: HTMLElement): number {
	// `ownerDocument.defaultView`, not Obsidian's own `el.win`: the jsdom harness
	// implements the first and not the second, and a reader that answers "left to right"
	// because the property it asks for is missing would take this whole rule out of every
	// test while looking like it held.
	return strip.ownerDocument.defaultView?.getComputedStyle(strip).direction === 'rtl' ? -1 : 1;
}

/**
 * A width clamped to what may be stored, which is also the range the separator announces:
 * a gesture can never draw or persist a number `readColWidths` would refuse on the way
 * back in, and `aria-valuenow` can never leave the range beside it.
 */
function clampColumnWidth(width: number): number {
	return Math.min(Math.max(Math.round(width), MIN_PROP_COLUMN_WIDTH), MAX_PROP_COLUMN_WIDTH);
}
