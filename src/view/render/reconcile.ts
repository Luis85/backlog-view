import { BacklogItem } from '../../domain/model';
import { projectionPopulation } from '../projection';
import { rowSignature } from '../rowSignature';
import {
	renderAllDoneState,
	renderEmptyState,
} from './emptyStates';
import { buildRow } from './rows';
import { columnWidth, columnWidthVar } from '../interactions/columnResize';
import {
	INDENT_PER_DEPTH,
	metaColWidth,
	renderColumnHeader,
	rollupChars,
	RowContext,
} from './columns';

/**
 * The reconcile walk: what a render pass does to the rows already on screen (ADR 0029).
 *
 * A data update DIFFS the tree rather than emptying it — {@link renderTree} places one
 * sibling group after another, and a row whose signature is unchanged is MOVED into place
 * instead of rebuilt, carrying its child group with it. `render/rows.ts` says what a row
 * IS; this file says which of them survive, where each one goes, and what is forgotten
 * when one does not. The dependency runs one way: the walk calls {@link buildRow}, never
 * the reverse.
 *
 * Its rules are held by the comments beside the lines they govern rather than by any
 * type — that a claimed row also needs its `ctx.rows` entry, that the empty states fire
 * after the reuse decision and before anything prunes, that a row's group is read off the
 * previous element before anything moves. `test/view/rowReuse.test.ts` is what drives
 * them.
 */
/** Render the tree content (or the empty state) into the tree element. */
export function renderTree(ctx: RowContext, treeEl: HTMLElement): void {
	const model = ctx.host.model;
	if (!model) return;
	// THIS projection's population, read here rather than below because the widths carry a
	// reservation off it — `model.items` holds every item the model kept, so on the plan it
	// includes catalog members that draw no row here and could reserve a width for a label
	// nothing on screen has.
	const population = projectionPopulation(ctx.host.projection, model);
	// Column widths are the same for every row, so they live on the scroller and
	// are inherited — including by the subtrees a targeted refresh re-renders, and by
	// the grip that writes one of them straight back mid-drag.
	// Geometry lives in one place: columnFit budgets with these numbers and the
	// stylesheet lays out with them, so the two cannot drift apart.
	// The lane's width is the one the FIT budgets with, from the same function, so the
	// stylesheet and `columnFit` cannot describe different geometry (Codex, PR #153).
	const chars = rollupChars(ctx.host, population.items);
	const widths: Record<string, string> = {
		'--pbl-meta-col': `${metaColWidth(chars)}px`,
		'--pbl-indent': `${INDENT_PER_DEPTH}px`,
	};
	// The rollup label's reservation, which is the one geometry here that the DATA decides
	// rather than the stylesheet: see `rollupReservation`. Published on the same element as
	// the widths and for the same reason — one declaration per tree, inherited by every row
	// and by the subtrees a targeted refresh re-renders.
	if (chars > 0) widths['--pbl-rollup-label'] = `${chars}ch`;
	for (const [index, column] of ctx.columns.entries()) {
		widths[columnWidthVar(index)] = `${columnWidth(ctx.host, column.prop)}px`;
	}
	// REMOVED rather than left unset, and this is the one declaration here that needs it:
	// the tree element is built once in the constructor and only emptied per render, so
	// its inline style outlives every pass, and `setCssProps` writes the keys it is given
	// without clearing the ones it is not. A view whose state property is cleared while
	// counts stay on goes from a reservation to none — and the stale one would keep the
	// lane widened for rows that no longer draw a bar, taking the width off the title.
	// Absent is also the only honest spelling of "none": an empty value would make
	// `var(--pbl-rollup-label, 28px)` substitute nothing rather than fall back, and a
	// concrete `28px` here would be a second opinion about a default the stylesheet owns.
	// (Codex, PR #153.)
	//
	// It outlives a RECONCILE pass for the same reason it outlives an emptied one: the
	// reuse path does not clear the element either.
	if (chars === 0) treeEl.style.removeProperty('--pbl-rollup-label');
	treeEl.setCssProps(widths);
	// Both decisions below used to read
	// the shared arrays, which hold every item the model kept: a base returning twelve
	// test notes and no plan work would be told "All 12 items are done and hidden", with a
	// Show completed items button that reveals nothing — because nothing is completed and
	// nothing is hidden by completion. A control offering to reveal what it cannot show.
	//
	// "Is there anything here" is asked of the RESULTS and not of the items, which is the
	// same distinction one line further down rather than a second rule: a context row is
	// placement, never population. A base returning one `PBI` whose excluded parent is a
	// `Test case` gives the catalog exactly one item — that context row — and it is hidden,
	// since the only child it places is a plan row. Counting it as population walked past
	// this branch into "All 0 items are done and hidden", offering a completed toggle in a
	// projection that hides nothing by completion at all.
	if (population.results.length === 0) {
		emptyTree(ctx, treeEl);
		renderEmptyState(ctx.host, treeEl);
		return;
	}
	// Whether any row will render is knowable before rendering one: renderForest draws
	// a row per root isRowHidden lets through. Asking first keeps the header — which is
	// not a row — from having to be built and then thrown away again.
	if (!population.roots.some((root) => !ctx.host.isRowHidden(root))) {
		emptyTree(ctx, treeEl);
		renderAllDoneState(ctx.host, treeEl, population.results.length);
		return;
	}
	// Left alone when it is already there. Everything this header draws from — the columns,
	// their widths, the rollup predicate, the fit verdict — is in the fingerprint that
	// decided this pass may reuse, so an existing header is correct for the same reason the
	// rows are, and a pass that may NOT reuse emptied the tree above, so there is none and
	// one is built. Found by direct traversal rather than a query: `treeEl.querySelector` is
	// banned (`TREE_SCAN` in `eslint.config.mjs`) for walking every rendered row, and the
	// header is one step away — it is the tree's first element child by construction.
	const first = treeEl.firstElementChild;
	const header =
		first instanceof HTMLElement && first.hasClass('pbl-cols')
			? first
			: renderColumnHeader(ctx, treeEl);
	// The walk starts AFTER the header, so its prune can never reach a node that is not a
	// row and that the index cannot see.
	renderForest(
		ctx,
		treeEl,
		population.roots,
		header ? header.nextElementSibling : treeEl.firstElementChild,
	);
}

/**
 * Drop everything on screen, for a branch that will render no rows.
 *
 * The three empty states above fire AFTER the reuse decision and BEFORE anything prunes: a
 * data update that empties the tree leaves the shared inputs identical and the index
 * non-empty, so reuse is chosen and the message would be appended UNDER the rows it says
 * are gone. Marking the last open item done is an ordinary write, not a corner.
 */
function emptyTree(ctx: RowContext, treeEl: HTMLElement): void {
	treeEl.empty();
	ctx.host.clearRowIndex();
}

/**
 * Re-render one row's child group in place. Expanding and collapsing is the most
 * frequent interaction in a large backlog; rebuilding the whole tree for it would
 * cost hundreds of rows of DOM work to change one subtree.
 */
export function refreshRowChildren(
	ctx: RowContext,
	item: BacklogItem,
	row: HTMLElement,
): void {
	const collapsed = ctx.host.isCollapsed(item.file.path);
	const hasChildren = item.children.some((c) => !ctx.host.isRowHidden(c));
	row
		.querySelector('.pbl-chevron')
		?.classList.toggle('pbl-expanded', hasChildren && !collapsed);
	if (hasChildren) row.setAttribute('aria-expanded', String(!collapsed));

	const existing = groupAfter(row);
	if (existing) {
		forgetElement(ctx, existing);
		existing.detach();
	}
	const parentEl = row.parentElement;
	if (!hasChildren || collapsed || !parentEl) return;
	// createDiv appends to the container; move the group up to sit after its row.
	const childrenEl = childGroupEl(parentEl, item, null);
	parentEl.insertBefore(childrenEl, row.nextSibling);
	renderForest(ctx, childrenEl, item.children);
}

/**
 * Drop a detached element's rows from the index and from the signatures — reached from the
 * DOM rather than from the model, because at the moment something is pruned the model no
 * longer describes what is on screen.
 *
 * A ROW holds no rows: its child group is its SIBLING, so a row answers for its own path
 * and stops. Anything else — a `.pbl-children` group — is walked, which is what makes this
 * exact where a walk of the model's child edges was not. A non-member's subtree can hold a
 * member this projection renders as a promoted ROOT, whose row is somewhere else entirely
 * and is not being detached; deleting that row's entry while its DOM stays on screen breaks
 * everything that reaches a row by lookup (selection cannot mark or announce it, a
 * keyboard-opened menu loses its anchor). Asking the detached DOM cannot make that mistake:
 * it forgets exactly what it removed.
 *
 * Both maps, never one — because they have one lifetime, not because a stray signature is
 * itself dangerous: a claim also needs the `ctx.rows` entry the line above deletes, so a
 * signature left behind alone is inert. Deleting it here is what keeps the pair readable as
 * one fact rather than two that happen to agree.
 */
function forgetElement(ctx: RowContext, el: Element): void {
	const path = el.getAttribute('data-path');
	if (path) {
		ctx.rows.delete(path);
		ctx.sigs.delete(path);
		return;
	}
	for (const child of Array.from(el.children)) forgetElement(ctx, child);
}

/**
 * Render a sibling group, skipping hidden items so aria positions stay true.
 *
 * The walk CLAIMS rather than builds where it can: an element whose path is indexed and
 * whose signature is unchanged is moved into place instead of rebuilt. With an empty index
 * and an empty container this is exactly a build, which is why there is one path here and
 * not two. `start` is where the walk begins — the tree passes the node after its header, so
 * the prune below can never reach it.
 */
function renderForest(
	ctx: RowContext,
	containerEl: HTMLElement,
	siblings: BacklogItem[],
	start?: Element | null,
): void {
	const visible = siblings.filter((item) => !ctx.host.isRowHidden(item));
	// ELEMENTS, never child nodes: everything a render puts in one of these containers is a
	// row or a child group, so the two walks are the same walk — and this one needs no
	// per-node narrowing to reach a path or a subtree.
	let cursor: Element | null =
		start === undefined ? containerEl.firstElementChild : start;
	visible.forEach((item, i) => {
		cursor = renderItem(
			ctx,
			containerEl,
			item,
			{ pos: i + 1, count: visible.length },
			cursor,
		);
	});
	// Everything left after the last claimed node is a row this pass did not draw.
	while (cursor) {
		const next: Element | null = cursor.nextElementSibling;
		forgetElement(ctx, cursor);
		cursor.detach();
		cursor = next;
	}
}

/**
 * Draw ONE item at the cursor and return the node the walk should look at next.
 *
 * The row and its child group are one structural unit, and the group is the row's NEXT
 * SIBLING rather than its descendant (`childGroupEl` builds it in the container, and
 * `refreshRowChildren` reaches it by `row.nextElementSibling`). So they move together, are
 * replaced together and are detached together.
 */
function renderItem(
	ctx: RowContext,
	containerEl: HTMLElement,
	item: BacklogItem,
	place: { pos: number; count: number },
	cursor: Element | null,
): Element | null {
	const host = ctx.host;
	const path = item.file.path;
	// A row whose children are all hidden renders as a leaf: a chevron expanding
	// into an empty group would be a lie (its progress bar tells the story).
	const hasChildren = item.children.some((c) => !host.isRowHidden(c));
	const collapsed = host.isCollapsed(path);
	const sig = rowSignature(host, item, place);
	const previous = ctx.rows.get(path) ?? null;
	// Read off the PREVIOUS element and before anything moves: a row that travels leaves its
	// group behind unless the group is carried with it. Whether the group should exist AT
	// ALL is asked of the item further down, never of what happened to the row.
	const group = groupAfter(previous);
	// A null signature is a row that could not be signed (its note is not in the metadata
	// cache yet); an absent one is a row whose signature was withheld for what it DREW.
	// Different reasons, one consequence, stated once here: nothing recorded, so nothing to
	// match, so never claimed.
	let after = cursor;
	let row =
		previous !== null && sig !== null && ctx.sigs.get(path) === sig
			? previous
			: null;
	let drewOthers = false;
	if (!row) {
		if (previous) after = dropReplaced(previous, cursor);
		row = buildRow(ctx, containerEl, item, { hasChildren, collapsed, place });
		drewOthers = drewOtherNotes(row);
	}
	if (row !== after) containerEl.insertBefore(row, after);
	ctx.rows.set(path, row);
	if (sig === null || drewOthers) ctx.sigs.delete(path);
	else ctx.sigs.set(path, sig);
	// Asked of the ITEM — any visible child, and not collapsed — and answered the same way
	// whether the row was kept, replaced or built. "A replaced row keeps its group" is wrong
	// in both directions: `Collapse all` flips the collapse bit, so the signature changes and
	// the row is REPLACED while its group has to go, and expanding an already-indexed row is
	// the mirror — the row is not new and needs a group it does not have.
	if (hasChildren && !collapsed) {
		const childrenEl = childGroupEl(containerEl, item, group);
		containerEl.insertBefore(childrenEl, row.nextSibling);
		renderForest(ctx, childrenEl, item.children);
		return childrenEl.nextElementSibling;
	}
	if (group) {
		forgetElement(ctx, group);
		group.detach();
	}
	return row.nextElementSibling;
}

/**
 * Take a row that is about to be replaced off the screen, and hand back the node the
 * walk's cursor should point at now.
 *
 * Detached HERE rather than left to the prune at the end of the sibling walk: the prune
 * forgets every path it detaches, and by then this path names the row that replaced it.
 */
function dropReplaced(
	previous: HTMLElement,
	cursor: Element | null,
): Element | null {
	const after = previous === cursor ? cursor.nextElementSibling : cursor;
	previous.detach();
	return after;
}

/**
 * Did this row draw content belonging to ANOTHER note?
 *
 * `reusableColumns` asks where a value comes FROM and cannot ask what it renders INTO: a
 * `note.related` holding `[[Other note]]` draws a link whose text is the target's, and an
 * embed draws that note's content outright. Rename or edit the other note and this row's
 * own frontmatter — and so its signature — is identical. Predicting which values do that
 * means reimplementing Bases' renderer in a predicate, so the rendered DOM is asked instead.
 *
 * Asked of the whole ROW rather than cell by cell: one query per built row instead of one
 * per column, and nothing else a row draws is an anchor, an embed or an image, so the two
 * give the same answer. Were that ever to change, the error is a REFUSED reuse — one wasted
 * row build, the direction every judgement in ADR 0029 takes.
 */
function drewOtherNotes(row: HTMLElement): boolean {
	return row.querySelector('a, .internal-embed, img') !== null;
}

/** A row's child group, which is its next SIBLING; null where it has none. */
function groupAfter(row: HTMLElement | null): HTMLElement | null {
	const next = row?.nextElementSibling ?? null;
	return next instanceof HTMLElement && next.hasClass('pbl-children')
		? next
		: null;
}
/**
 * The child group of a row — claimed where one survived, created where none did. Its
 * indent guide aligns under the parent's chevron column.
 *
 * `--pbl-depth` is written on BOTH arms rather than at creation alone, and that is the
 * whole reason the two arms live in one function: a group is an element with state too.
 * Reparent an expanded item to a different depth and its row rebuilds — `depth` is a
 * signature term — while a group merely reused would keep the old indent guide.
 */
function childGroupEl(
	containerEl: HTMLElement,
	item: BacklogItem,
	existing: HTMLElement | null,
): HTMLElement {
	const childrenEl =
		existing ??
		containerEl.createDiv({ cls: 'pbl-children', attr: { role: 'group' } });
	childrenEl.setCssProps({ '--pbl-depth': String(item.depth) });
	return childrenEl;
}
