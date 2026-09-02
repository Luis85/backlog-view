import { BacklogViewHost, BoardSnapshot, RoadmapSnapshot } from './host';
import { CardDragController } from './interactions/cardDrag';
import { DragDropController } from './interactions/dragDrop';
import { treeShaped } from './projection';
import { renderInputs, reusableColumns } from './rowSignature';
import { RowContext } from './render/columns';
import { syncAfterContent } from './render/afterContent';
import { captureScroll, renderProjectionContent, restoreScroll, ScrollAnchor, syncProjectionClasses } from './render/projections';
import { ResizePolicy } from './resize';
import { SelectionController } from './selection';
import { activeAxis } from '../domain/roadmap';

/**
 * The elements one render pass draws into — the same four the view itself owns,
 * handed down rather than reached through `this` so the pass can live outside the
 * class that holds them.
 */
export interface RenderPassEls {
	viewEl: HTMLElement;
	treeEl: HTMLElement;
	toolbarEl: HTMLElement;
	legendEl: HTMLElement;
}

/**
 * The controllers and per-pass inputs one render pass needs. `scroll` is the
 * PREVIOUS frame's anchor — the pass captures the old frame's offsets against it
 * and returns the new one in {@link RenderPassResult}, rather than reading or
 * writing the view's own field.
 */
export interface RenderPassDeps {
	selection: SelectionController;
	resize: ResizePolicy;
	dnd: DragDropController;
	cardDnd: CardDragController;
	rowCtx: () => RowContext;
	scroll: ScrollAnchor;
	/**
	 * The render inputs the PREVIOUS pass drew with, or null when nothing is on screen.
	 * Equal to this pass's own is the whole of what makes reuse legal at the pass level —
	 * see the reuse decision below.
	 */
	lastInputs: string | null;
	/**
	 * Publish the snapshots the content render just produced, at the point the view used
	 * to assign them — BEFORE the post-content work, which reads `host.roadmap`. The
	 * scroll capture earlier in the pass deliberately runs against the OLD snapshot.
	 */
	publish: (board: BoardSnapshot | null, roadmap: RoadmapSnapshot | null) => void;
}

/** What one render pass produced, for the caller to keep. */
export interface RenderPassResult {
	scroll: ScrollAnchor;
	/** True when the fit verdict changed and the caller owes a second, guarded pass. */
	refitNeeded: boolean;
	/** What this pass drew with, for the caller to hand back as `lastInputs` next time. */
	inputs: string;
}

/**
 * The content render pass: everything between capturing the old frame's scroll and
 * handing back what the pass produced. This is the render-orchestration seam
 * `docs/tasks/Split the view dispatch hub again.md` named — moved out of
 * `backlogView.ts` verbatim, comments included, because they are the only record
 * of why several of these steps sit where they do.
 *
 * `board` and `roadmap` are handed back through {@link RenderPassDeps.publish}
 * rather than written onto `host` — the interface exposes both as readonly — and
 * the ORDER that hook sits in is the load-bearing part: everything below it reads
 * the snapshots off the host again (the selection's column-stop lookup, and the
 * legend through `syncAfterContent`), while `captureScroll` above it wants the
 * frame being replaced. Returning them instead would put every one of those
 * readers ahead of the assignment, and `test/view/legend.test.ts` says so
 * loudly: 22 of its 37 fail with this hook moved to the end of the function,
 * because `syncAfterContent` then keys the swatches off the PREVIOUS snapshot —
 * null on a first roadmap render, so the legend collapses to `['Today']`.
 *
 * The guarded SECOND pass a changed fit verdict can ask for stays in the caller:
 * it recurses into the whole of `renderTreeContent`, filter sync included, which
 * is above this function on the call stack rather than inside it; here a changed
 * verdict is only ever reported as {@link RenderPassResult.refitNeeded}.
 */
export function renderPass(host: BacklogViewHost, els: RenderPassEls, deps: RenderPassDeps): RenderPassResult {
	const projection = host.projection;
	syncProjectionClasses(els.viewEl, projection, projection === 'roadmap' ? activeAxis(host.settings, host.axisPick) : null);
	// The keyboard instructions belong to the board and are rebuilt with it below;
	// dropped here so the attribute never outlives the element it points at — a
	// dangling `aria-describedby` is read as no description at all.
	els.treeEl.removeAttribute('aria-describedby');
	deps.dnd.onRenderStart();
	deps.cardDnd.onRenderStart();
	// Captured from the OLD frame, before its DOM goes: on the dated axis the pane
	// is not the scroll box, and reading it here would capture zeros.
	let scroll = captureScroll(els.treeEl, host.roadmap, deps.scroll);
	// Whether the row walk below may KEEP the elements already on screen (ADR 0029).
	// Everything a row draws that is not its own note lives in one string — see
	// `renderInputs` — so a settings change, a filter change, a projection switch and a
	// column that is not frontmatter-backed all land here rather than in a per-row term
	// somebody has to remember to add. The index is the view's own collection, reached
	// through `rowCtx` (which hands back the live one, not a copy) because this pass has no
	// fields of its own; empty, there is nothing to keep and the walk is an ordinary build.
	const inputs = renderInputs(host);
	const reuse =
		treeShaped(projection) &&
		inputs === deps.lastInputs &&
		reusableColumns(host.columns) &&
		deps.rowCtx().rows.size > 0;
	// Cleared TOGETHER and only here: an index that survived a render it did not draw would
	// answer for rows that are gone, a signature index that did would claim them, and a
	// disclosure set that did would speak for a screen that is gone.
	if (!reuse) {
		els.treeEl.empty();
		host.clearRowIndex();
	}
	if (!treeShaped(projection)) {
		// The column ladder is the tree's: a narrow-pane verdict from tree mode must not
		// strip cells off cards, and — since the rows read the verdict rather than a class
		// (`renderRollup`, `render/columns.ts`) — must not take their rollup away either.
		// Clearing it is what does both, and it runs BEFORE the content renders.
		host.setColumnFit(null);
	}
	const content = renderProjectionContent(projection, deps.rowCtx(), els.treeEl, deps.cardDnd);
	// Everything below reads these back off the host, so they are published here —
	// where the view used to assign them — rather than handed back at the end.
	deps.publish(content.board, content.roadmap);
	els.treeEl.setAttribute('role', content.role);
	els.treeEl.setAttribute('aria-label', content.label);
	// Column stops are board state: without a board on screen a held stop would point
	// at a projection that no longer exists, so it is released; with one, it is clamped
	// to the columns left, the way the card selection is carried.
	//
	// BEFORE `restoreScroll`, and that order is behaviour: `selectBoardColumn` ends in an
	// unconditional `scrollIntoView` on the column it lands on, so whichever of these two
	// runs last decides where the pane sits. The restored anchor has to win, or a board
	// panned away from a held column stop snaps back on every refresh — the pan captured
	// at the top of this pass and then thrown away.
	deps.selection.resyncBoardColumn(content.board?.colEls.length ?? null);
	// Both offsets belong to the content that made them — restored, corrected,
	// reset or replaced by the anchor policy `restoreScroll` states beside the
	// fork that decides what was drawn.
	scroll = restoreScroll(els.treeEl, scroll, content.roadmap, projection);
	// The selection may have been inside the subtree this pass just replaced. Column
	// stops are reapplied first (above), so a held one is left alone here —
	// see `SelectionController.resyncAfterRender`.
	deps.selection.resyncAfterRender();
	// Unconditional, because it holds four things and two of them (the legend) are
	// the roadmap's — see `syncAfterContent`, which holds all four and their reasons.
	syncAfterContent(host, { toolbarEl: els.toolbarEl, legendEl: els.legendEl });
	// The fit ladder is the tree's alone; every other projection reports no verdict
	// change and leaves the caller's guarded second pass untaken.
	const refitNeeded = treeShaped(projection) && deps.resize.refit();
	return { scroll, refitNeeded, inputs };
}
