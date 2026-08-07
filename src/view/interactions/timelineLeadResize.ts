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
 * neither a card nor a drop target. Pointer events (not `mousedown`/`mousemove`/
 * `mouseup`) keep the same delta-then-clamp shape `timelineDrag.ts`'s holds already
 * use, without forcing a fake item through machinery built for one — and this plugin
 * is not desktop-only (`manifest.json`), so a mouse-only grip cannot be resized on a
 * touch device at all. `setPointerCapture` on the grip itself is what lets the stream
 * survive the pointer leaving a 6px strip: capture re-targets every later event at the
 * capturing element regardless of where the pointer physically is, which is also why
 * the move/up handlers live on the GRIP rather than `window` now — capture makes the
 * window-level net this used to need redundant. jsdom implements the `PointerEvent`
 * constructor but not capture itself, so `setPointerCapture`/`releasePointerCapture`
 * are called through an optional chain: real browsers use them, tests dispatch
 * directly on the grip and never need them to do anything.
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

	grip.addEventListener('pointerdown', (evt) => {
		if (evt.button !== 0) return;
		// Not text selection: a resize drag has to feel like one, not a text drag.
		evt.preventDefault();
		grip.setPointerCapture?.(evt.pointerId);
		const startX = evt.clientX;
		const startWidth = host.leadWidth ?? defaultWidth;
		const onMove = (moveEvt: PointerEvent): void => live(clampLeadWidth(startWidth + (moveEvt.clientX - startX)));
		const end = (evt: PointerEvent): void => {
			grip.removeEventListener('pointermove', onMove);
			grip.removeEventListener('pointerup', onUp);
			grip.removeEventListener('pointercancel', onCancel);
			grip.releasePointerCapture?.(evt.pointerId);
		};
		const onUp = (upEvt: PointerEvent): void => {
			end(upEvt);
			commit(clampLeadWidth(startWidth + (upEvt.clientX - startX)));
		};
		// A cancel is the platform saying the gesture stopped being the user's — palm
		// rejection, an orientation change, another gesture taking it over. The width it
		// happened to reach is one nobody chose, so it is put BACK rather than saved:
		// `live` alone, never `commit`, which also leaves the store with no entry to
		// take away later. `touch-action: none` does not make this rare — that stops the
		// scroller stealing the pan, not the platform interrupting.
		const onCancel = (cancelEvt: PointerEvent): void => {
			end(cancelEvt);
			live(startWidth);
		};
		// On the grip itself, riding pointer capture — not `window`: capture keeps the
		// stream targeted here even once the pointer leaves the 6px strip, so there is
		// nothing left for a window-level net to catch.
		grip.addEventListener('pointermove', onMove);
		grip.addEventListener('pointerup', onUp);
		grip.addEventListener('pointercancel', onCancel);
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
