import { setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { KEY_ATTR } from './toolbarControls';
import { syncToolbarFit } from './toolbarFit';

/** Type-to-filter box; matches keep their ancestors and subtrees visible. */
export function renderFilterBox(host: BacklogViewHost, barEl: HTMLElement): void {
	const filterEl = barEl.createDiv({ cls: 'pbl-filter' });
	setIcon(filterEl.createSpan({ cls: 'pbl-filter-icon' }), 'search');
	setTooltip(filterEl, 'Filter items — press / in the tree');
	const input = filterEl.createEl('input', {
		cls: 'pbl-filter-input',
		attr: { type: 'text', placeholder: 'Filter items', 'aria-label': 'Filter items', [KEY_ATTR]: 'filter' },
	});
	input.value = host.filterText;
	// `setFilter` re-renders the tree and syncs this box's active state, which is what
	// makes clearing a THIRD input to `revealFilter` rather than a focus call of its own.
	// At a collapsing rung an input the user typed into is visible only through
	// `pbl-filter-active`; emptying it strips that class synchronously, the rung hides the
	// still-focused input, and the `input.focus()` that used to follow would focus a
	// `display: none` element — no effect, no error, focus on the body. Establishing the
	// open flag as part of clearing is also exactly what the design asks for: a cleared
	// filter stays open until it is blurred.
	const clear = () => {
		host.setFilter('');
		revealFilter(barEl);
	};
	filterEl.toggleClass('pbl-filter-active', input.value !== '');
	input.addEventListener('input', () => host.setFilter(input.value));
	input.addEventListener('keydown', (evt) => {
		if (evt.key === 'Escape' && input.value !== '') {
			evt.preventDefault();
			evt.stopPropagation();
			clear();
		}
	});
	const clearBtn = filterEl.createEl('button', {
		cls: 'pbl-filter-clear clickable-icon',
		attr: { type: 'button', 'aria-label': 'Clear filter', [KEY_ATTR]: 'filter-clear' },
	});
	setIcon(clearBtn, 'x');
	setTooltip(clearBtn, 'Clear filter');
	clearBtn.addEventListener('click', clear);
	// Below the step that collapses it, the input is not rendered-and-hidden but
	// display:none, so this button is the control — and it carries the name.
	const reveal = filterEl.createEl('button', {
		cls: 'pbl-filter-reveal clickable-icon',
		attr: { type: 'button', 'aria-label': 'Filter items', [KEY_ATTR]: 'filter-reveal' },
	});
	setIcon(reveal, 'search');
	setTooltip(reveal, 'Filter items');
	reveal.addEventListener('click', () => revealFilter(barEl));
	// THE rule, enforced once: a filter that has focus is never collapsed. Four bugs of
	// one shape were fixed at four call sites before this listener existed — `/`, the
	// clear button, Escape, and finally typing the last character back out, which reaches
	// `setFilter` directly and so could never be fixed by anything `clear()` did. Setting
	// the flag where focus ARRIVES means every path inherits it without knowing about it,
	// including the next one nobody has thought of. No refit is needed here: the flag only
	// changes what is drawn below the rung that collapses this input, and `revealFilter`
	// is what reaches focus from there — it has already refitted before focusing.
	input.addEventListener('focus', () => barEl.addClass('pbl-filter-open'));
	input.addEventListener('blur', () => {
		// A filter someone is still using is never taken away: only an EMPTY input
		// collapses back. The flag is read and cleared on the toolbar, where
		// `revealFilter` put it and where it survives a rebuild.
		if (input.value !== '' || !barEl.hasClass('pbl-filter-open')) return;
		barEl.removeClass('pbl-filter-open');
		syncToolbarFit(barEl);
	});
}

/**
 * The filter can be cleared from outside the toolbar (Escape in the tree, the
 * no-match state); keep the input and its clear affordance in sync. It does NOT
 * touch the collapse controls — `syncCollapseCtls` is their sole writer, called
 * after the content render along with `syncCountLabel`, and a filter change
 * reaches it the same way any other content re-render does.
 */
export function syncFilterUi(host: BacklogViewHost, barEl: HTMLElement): void {
	const input = barEl.querySelector<HTMLInputElement>('.pbl-filter-input');
	if (input && input.value !== host.filterText) input.value = host.filterText;
	input?.closest('.pbl-filter')?.classList.toggle('pbl-filter-active', host.filterText !== '');
	// The release the focus listener in `renderFilterBox` needs. Blur alone cannot be it:
	// blur keeps a non-empty filter open on purpose, so a filter emptied LATER from
	// somewhere else — Escape in the tree does exactly that, with focus in the tree —
	// would leave the flag set on a filter that is neither used nor focused, and the row
	// would carry an empty input at every narrow width until someone clicked into it.
	// Here rather than beside the flag's two writers because this is the function whose
	// whole job is re-deriving this box from `host.filterText`, and it already owns the
	// other class that answers the same question. Callers that clear and then re-open —
	// `clear()`, the no-match empty state — run `revealFilter` AFTER `setFilter`, so they
	// set the flag back on the far side of this.
	if (host.filterText === '' && document.activeElement !== input) barEl.removeClass('pbl-filter-open');
}

/**
 * Open the collapsed filter and focus it. ONE function because there are three inputs:
 * the reveal button's own click, the clear path (Escape and the clear button), and
 * `focusFilter()` — which is what `/` in the tree and the no-match empty state both call.
 * Below the step that collapses it, that method's `.pbl-filter-input` is `display: none`,
 * and `focus()` on a display:none element does nothing at all, silently — so the
 * documented keyboard path to the filter would die at exactly the pane widths where the
 * filter is hardest to reach.
 *
 * The refit is before the focus, and it is here rather than in the click handler for the
 * same reason the function is shared: the input takes ~130px back on a row already
 * measured as full, and no render follows either caller.
 */
export function revealFilter(barEl: HTMLElement): void {
	// On the TOOLBAR, not on the `.pbl-filter` box — the same element `data-pbl-fit`
	// lives on, for the same reason. `renderToolbar` calls `barEl.empty()`, so a class
	// on the box is destroyed by any full render while the fit attribute beside it
	// survives: an empty filter revealed by `/` would come back from a data refresh
	// with the rung still hiding it, and `refocusByKey` would then "restore" focus to a
	// `display: none` input, which silently focuses nothing. The non-empty case is
	// already safe without this — `renderFilterBox` re-derives `pbl-filter-active` from
	// the input's value on every render — so this is the empty-but-revealed state
	// alone, and it is exactly the one nothing else re-derives.
	barEl.addClass('pbl-filter-open');
	syncToolbarFit(barEl);
	// `preventScroll`, because the refit above is not a promise that the input ended up
	// on screen — a pane narrow enough still clips past the last rung, and the default
	// focus behaviour scrolls every scrollable ancestor to reveal the target. The bar
	// itself is `overflow: clip` and cannot scroll, so this is about what is above it.
	barEl.querySelector<HTMLInputElement>('.pbl-filter-input')?.focus({ preventScroll: true });
}
