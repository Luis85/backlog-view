import { BacklogViewHost, DrawnColors } from '../host';
import { paletteDone, stateColorPaint, StatePalette } from '../../domain/board';
import { activeAxis, drawsGrid } from '../../domain/roadmap';

/**
 * A colour key for the dated axis's bars, rendered under the toolbar and outside the
 * timeline scroller so it never scrolls away — gated exactly like `renderTimelineControls`
 * (`toolbar.ts`), because a legend for an axis that is not drawn would key nothing.
 *
 * Presentational only: `aria-hidden`, no tab stop, no pointer handler. It restates
 * colour and nothing else — every fact a swatch stands for is already reachable without
 * it: a state and its done-ness from the hidden words `stateNote` puts in each timeline
 * row (never the tree's chip, which this projection does not render), a milestone from
 * its own row's accessible name, and today from being today — not from the line's own
 * tooltip, which hangs on an `aria-hidden` div and so carries nothing to the audience
 * this paragraph is about.
 * That is what makes withholding it from assistive tech and the tab order correct rather
 * than a gap — and it was a gap until those words existed: a bar's state lived in its
 * colour alone.
 *
 * `palettes` is a parameter, not built off `host.model` here: the view calls this only
 * after its own `if (!this.model) return` in `render()`, so a second null check on this
 * path would guard nothing reachable — the caller already holds the model these
 * vocabularies come from, and hands the SAME list to `renderTimeline`. One list, two
 * readers: a legend built from its own copy is a legend free to disagree with the grid.
 *
 * `drawn` is likewise reported by the render rather than recomputed here — see
 * `TimelineRender.drawn`. A predicate over `model.results` alone cannot see what the
 * grid actually drew: `model.results` includes items with no bar at all (unscheduled on
 * the shelf, or hidden by "Show completed items", which
 * hides done subtrees specifically), so it can call a colour keyed that nothing visible
 * draws — the done swatch keying green with every done item off screen, or the
 * milestone swatch keying cyan for a base with no milestone at all, are both that same
 * mistake. And a predicate over `results` alone still cannot see precedence within what
 * IS on screen, which is what let a marker dated outside the capped window (drawing the
 * plain accent under `.pbl-bar-outside`) go unkeyed.
 */
export function renderLegend(
	host: BacklogViewHost,
	legendEl: HTMLElement,
	palettes: StatePalette[],
	drawn: DrawnColors,
): void {
	legendEl.empty();
	// Whichever axis draws BARS, not the plain dated one: the resources axis draws the
	// same bars grouped into rows, so a swatch keys exactly what it keys there.
	const axis = host.projection === 'roadmap' ? activeAxis(host.settings, host.axisPick) : null;
	const onDatedAxis = axis !== null && drawsGrid(axis);
	// The class itself is the gate, not a hidden variant of it: a rule that hid an
	// always-present `.pbl-legend` empty box would still leave the box in the layout
	// and in `querySelector('.pbl-legend')`'s answer to "is a legend here".
	legendEl.toggleClass('pbl-legend', onDatedAxis);
	if (!onDatedAxis) {
		legendEl.removeAttribute('aria-hidden');
		return;
	}
	legendEl.setAttribute('aria-hidden', 'true');
	// A swatch exists only where a bar can draw the thing it keys — the general rule behind
	// every state-colour bug this feature has had (the done swatch keying its slot instead
	// of green, the milestone swatch keying cyan while the diamond drew its state slot, and
	// a lone Deliverable workflow headed as if a second one existed). `renderStateSwatches`
	// holds that rule for the vocabularies; the two below hold it for the furniture.
	renderStateSwatches(host, legendEl, palettes, drawn);
	addSwatch(legendEl, 'pbl-legend-today', 'Today');
	// Milestone (and/or Iteration) is likewise the render's own report (`drawn.milestone` /
	// `drawn.iteration`): a base with no marker in the window draws no cyan mark at all, and
	// a swatch left unconditional here is defect 2 of this pass — the same rule failing the
	// same way as `Other` did. The caption names what actually drew, `markerLaneCaption`'s
	// own rule one element over, never the fixed "Milestone" word this swatch used to carry
	// regardless of which marker type a vault actually has.
	if (drawn.milestone || drawn.iteration) {
		const caption =
			drawn.milestone && drawn.iteration ? 'Milestone · Iteration' : drawn.iteration ? 'Iteration' : 'Milestone';
		addSwatch(legendEl, 'pbl-legend-milestone', caption);
	}
	// The hatch, on the same rule and reported the same way: `drawn.absence` is the render's
	// own word for "a stretch drew here", so this appears exactly where the mark does — on
	// the resources axis, and stays lit through a fold, since a collapsed band's header
	// keeps drawing its own stretches (2026-08-14).
	if (drawn.absence) addSwatch(legendEl, 'pbl-legend-absence', 'Unavailable');
	// The days-lost swatch keys the TOKEN, not the crossing: `drawn.daysLost` is whether
	// `drawBandCollision` actually appended `.pbl-days-lost` (`DrawnColors.daysLost`'s own
	// doc), so a row that crosses a stretch but whose title label was DROPPED —
	// `renderBarLabel`'s own reserve-and-flip decision, not a width check of this
	// feature's own — leaves this unlit even though that row's lead swatch still shows.
	// Never a predicate over `roadmap.lanes` either, for `drawn.absence`'s own reason: a
	// fold or a filter taking the token off screen must take the key with it.
	if (drawn.daysLost) addSwatch(legendEl, 'pbl-legend-days-lost', 'Days lost');
}

/**
 * The state half of the key — every workflow's vocabulary, then the two swatches that
 * exist only because the GRID drew a colour the vocabularies do not account for. Its own
 * function because `renderLegend` is the gate and the furniture: this is the part that
 * grows with the number of workflows, and it had already taken the whole strip's
 * complexity budget with it at two.
 */
function renderStateSwatches(
	host: BacklogViewHost,
	legendEl: HTMLElement,
	palettes: StatePalette[],
	drawn: DrawnColors,
): void {
	// Nothing configured, nothing keyed: `statePalettes` returns only the workflows that
	// HAVE a key, so an empty list IS "no bar on this grid can carry a state colour" —
	// which is the same question `renderLegend` used to ask a second time of
	// `settings.stateKey`, and asking it twice is how the lone-Deliverable base came to
	// draw a section headed "Deliverables" with nothing to tell it apart from.
	if (palettes.length === 0) return;
	let anyDone = false;
	for (const palette of palettes) {
		// One section per workflow, each headed by its name — empty, and so undrawn, where
		// it is the only one and there is nothing to tell apart. Presentational: that a
		// Deliverable is tracked by its own states is already in `stateNote`'s hidden words.
		//
		// The heading and its swatches go in a BOX of their own, because the strip wraps and
		// a flat row wraps between any two items: seen in the harness at 560px, the
		// "Deliverables" heading ended one line while its swatches carried onto the next,
		// leaving a row of colours belonging to nothing. A lone unlabelled palette gets no
		// box — there is no group to hold together, and the single-workflow strip stays the
		// markup it has always been.
		const section = palette.label ? legendEl.createDiv({ cls: 'pbl-legend-section' }) : legendEl;
		if (palette.label) section.createSpan({ cls: 'pbl-legend-group', text: palette.label });
		// Written this way round on purpose: `renderPaletteSwatches(...) || anyDone` calls it
		// first, where `anyDone || renderPaletteSwatches(...)` would stop drawing swatches
		// the moment an earlier workflow had a done state.
		anyDone = renderPaletteSwatches(host, section, palette) || anyDone;
	}
	// Done is decided by `doneValues`, INDEPENDENTLY of the menu vocabulary, so an item can
	// be done while its value is not in any configured list: its bar goes green and the loop
	// above keyed no green. Asked of `drawn.done` — the render's own report of whether a bar
	// actually took the override — rather than of `results`: a done item with no bar at all
	// (shelved, filtered out, or hidden by "Show completed items") must not put a green
	// swatch beside a grid drawing none. ONE swatch for both workflows: green means finished
	// on either, and the grid draws one green — named by the first done value any drawn
	// palette declares.
	if (!anyDone && drawn.done) {
		addSwatch(legendEl, 'pbl-legend-done', palettes.flatMap((palette) => palette.doneValues)[0] ?? 'Done');
	}
	// The rule's other direction: a bar that draws the plain accent — no slot, no done
	// override, no milestone cyan — is a colour on the grid the key does not explain.
	// `drawn.accent` is the RENDER's own report of that fact (see its doc on
	// `TimelineRender`), never a predicate rebuilt here over `results`: that copy of
	// `barClasses`'s precedence is exactly what missed a marker outside the window drawing
	// the accent under `.pbl-bar-outside` instead of its own cyan.
	if (drawn.accent) addSwatch(legendEl, 'pbl-legend-other', 'Other');
}

/**
 * One workflow's own swatches, and whether any of its states is done — which the caller
 * needs, because the fallback green swatch exists exactly when NO vocabulary keyed one.
 *
 * The same list, the same index, the same offset and modulo `paletteSlot` applies to a
 * bar — through `stateColorClass`, so a colour the user NAMED for a state replaces its
 * slot here exactly as it does on the bar. One mapping, as it has always been.
 *
 * Except for done, which is the one state whose bar does NOT draw its slot: a done row's
 * bar is overridden to green in `timeline.css`, deliberately, because green for finished
 * is a meaning the user already reads. A swatch wearing the slot class would key pink for
 * a bar that draws green — a legend disagreeing with the only thing it exists to explain.
 * So the swatch asks the same question the override does, against THIS palette's own done
 * list rather than the requirements one, or a finished Deliverable would be keyed by
 * neither. A named colour on a done state changes nothing on either side.
 */
function renderPaletteSwatches(host: BacklogViewHost, section: HTMLElement, palette: StatePalette): boolean {
	let anyDone = false;
	for (const state of palette.values) {
		const done = paletteDone(palette, state);
		anyDone ||= done;
		// The swatch asks `stateColorPaint`, the very function the bar asks — one answer, so
		// the strip cannot key a colour the grid does not draw, whether that colour came from
		// a name or from the picker. `state` came out of `palette.values`, so the paint is
		// never null here; the guard is the compiler's, not a case.
		const paint = stateColorPaint(host.settings, palette, state);
		if (done) addSwatch(section, 'pbl-legend-done', state);
		else if (paint) addSwatch(section, paint.cls, state, paint.color);
	}
	return anyDone;
}

function addSwatch(legendEl: HTMLElement, swatchCls: string, label: string, color?: string | null): void {
	const item = legendEl.createDiv({ cls: 'pbl-legend-item' });
	const swatch = item.createSpan({ cls: `pbl-legend-swatch ${swatchCls}` });
	// The bar's own token, set the same way on the same rule — see `renderBarRow`.
	if (color) swatch.setCssProps({ '--pbl-state-color': color });
	item.createSpan({ cls: 'pbl-legend-label', text: label });
}
