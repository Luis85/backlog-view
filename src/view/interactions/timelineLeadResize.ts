import { setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { MAX_TIMELINE_LEAD_PX, MIN_TIMELINE_LEAD_PX } from '../../storage/collapseStore';

/**
 * The lead column's own drag handle, mounted in the timeline HEADER
 * (`render/timeline.ts`'s `renderCellHeader`) — a user asked for this specifically,
 * choosing a resize over a bigger constant, because a title's real budget is
 * `TIMELINE_LEAD_PX` minus the badge, its padding and its gap, and no single number
 * fits every vault's titles.
 *
 * Not `CardDragController`: that controller's whole shape is a `BacklogItem` picked
 * up and dropped somewhere (`cardDrag.ts`'s own preamble), and a column boundary is
 * neither a card nor a drop target. Plain mouse events keep the same delta-then-clamp
 * shape `timelineDrag.ts`'s holds already use, without forcing a fake item through
 * machinery built for one — and jsdom has no working `PointerEvent`/pointer-capture
 * (the same reason `test/helpers/dnd.ts` fakes drag gestures with `MouseEvent`s
 * instead of the real `DragEvent`), so `mousedown`/`mousemove`/`mouseup` on `window`
 * is also the one shape both a browser and this repo's tests can drive.
 *
 * `tabindex="0"` — a REAL tab stop — where every other control inside this
 * one-tab-stop pane (`src/view/CLAUDE.md`'s Controls section) is `tabindex="-1"`
 * reached from a menu, because those compete with the roving arrow-key CARD
 * selection the pane owns. This does not: it is chrome fixed to the grid's own
 * geometry, not a card, and it never renders among cards to begin with. Once it
 * holds focus, `handleRoadmapKeydown`'s own guard (`evt.target !== evt.currentTarget`
 * in `interactions/keyboard.ts`) already leaves its own keys alone — the same escape
 * hatch the shelf's promoted-to-real-tab-stop controls rely on when the pane has no
 * cards at all — so giving this one a real stop costs the composite nothing and there
 * is no menu a continuous "hold the arrow key" gesture would fit inside anyway.
 */
export function renderLeadResize(
	host: BacklogViewHost,
	leadEl: HTMLElement,
	content: HTMLElement,
	current: number,
	defaultWidth: number,
): void {
	const grip = leadEl.createDiv({
		cls: 'pbl-timeline-lead-grip',
		attr: {
			role: 'separator',
			'aria-orientation': 'vertical',
			'aria-label': 'Resize the title column',
			'aria-valuemin': String(MIN_TIMELINE_LEAD_PX),
			'aria-valuemax': String(MAX_TIMELINE_LEAD_PX),
			'aria-valuenow': String(current),
			tabindex: '0',
		},
	});
	setTooltip(grip, 'Drag to resize, or focus and use the arrow keys (Home resets it)');

	// Live feedback is the CSS custom property alone — nothing re-renders mid-gesture,
	// which is also why the today line, the milestone lines and the gridlines (each a
	// number baked into an element's own inline style at the LAST render) do not chase
	// the column during an active drag: they catch up in one pass when `commit` below
	// re-renders at the settled width. ponytail: redoing that arithmetic every
	// `mousemove` would track them live too, for a mismatch that self-heals the instant
	// the pointer releases.
	const live = (width: number): void => {
		content.setCssProps({ '--pbl-tl-lead': `${width}px` });
		grip.setAttribute('aria-valuenow', String(width));
	};

	// Persisted once, here — never from `live` — so a drag's `mousemove` stream and a
	// held arrow key both cost one write to the collapse store, not one per pixel or
	// per repeat event. `defaultWidth` back to `null` is `density`'s own rule: the
	// default needs no stored entry, so dragging back to it clears the pick rather than
	// writing the number that means the same thing.
	const commit = (width: number): void => {
		host.setLeadWidth(width === defaultWidth ? null : width);
		// The write above re-renders the whole projection, destroying THIS element —
		// the shelf header's own controls hit the identical wall (`shelfControls.ts`'s
		// `refocus`), and the fix is the same: find the replacement and refocus it, or
		// a keyboard user resizing by repeated presses is dropped back to the document
		// body after the very first one.
		host.roadmap?.scroller?.querySelector<HTMLElement>('.pbl-timeline-lead-grip')?.focus();
	};

	grip.addEventListener('mousedown', (evt) => {
		if (evt.button !== 0) return;
		// Not text selection: a resize drag has to feel like one, not a text drag.
		evt.preventDefault();
		const startX = evt.clientX;
		const startWidth = host.leadWidth ?? defaultWidth;
		const onMove = (moveEvt: MouseEvent): void => live(clampLeadWidth(startWidth + (moveEvt.clientX - startX)));
		const onUp = (upEvt: MouseEvent): void => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			commit(clampLeadWidth(startWidth + (upEvt.clientX - startX)));
		};
		// On `window`, not the grip: the gesture has to keep tracking once the pointer
		// leaves a 6px strip, the ordinary way a browser drag-resize is built.
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	});

	grip.addEventListener('keydown', (evt) => {
		if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
			evt.preventDefault();
			const step = evt.key === 'ArrowRight' ? KEY_STEP_PX : -KEY_STEP_PX;
			commit(clampLeadWidth((host.leadWidth ?? defaultWidth) + step));
		} else if (evt.key === 'Home') {
			evt.preventDefault();
			commit(defaultWidth);
		}
	});
}

/** How far one arrow-key press moves the column, in pixels. */
const KEY_STEP_PX = 10;

function clampLeadWidth(px: number): number {
	return Math.min(MAX_TIMELINE_LEAD_PX, Math.max(MIN_TIMELINE_LEAD_PX, px));
}
