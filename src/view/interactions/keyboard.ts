import { BacklogViewHost, BoardSnapshot } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { indent, moveWithinSiblings, outdent } from './structure';

/** Items currently rendered, top to bottom, honoring collapsed subtrees and the filter. */
function visibleItems(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	const visible: BacklogItem[] = [];
	const walk = (items: BacklogItem[]) => {
		for (const item of items) {
			if (host.isRowHidden(item)) continue;
			visible.push(item);
			if (item.children.length > 0 && !host.isCollapsed(item.file.path)) {
				walk(item.children);
			}
		}
	};
	walk(model.roots);
	return visible;
}

/** One keydown entry for the scroller: the projection decides which handler runs. */
export function handleProjectionKeydown(host: BacklogViewHost, evt: KeyboardEvent): void {
	if (host.projection === 'board') handleBoardKeydown(host, evt);
	else if (host.projection === 'roadmap') handleRoadmapKeydown(host, evt);
	else handleTreeKeydown(host, evt);
}

/**
 * Tree keyboard support: arrows navigate, Enter opens, and Alt+arrows mirror
 * the Azure DevOps backlog shortcuts (move within siblings, outdent, indent).
 */
function handleTreeKeydown(host: BacklogViewHost, evt: KeyboardEvent): void {
	// Keys bubbling out of a focused row control (the state chip) drive that
	// control alone — Enter there must not also open the selected item.
	if (evt.target !== evt.currentTarget) return;
	// Before everything model-shaped: undo needs no selection and no rows, and the
	// change being undone may be exactly what emptied the tree — the sole item
	// marked done under a filter that excludes done items.
	if ((evt.ctrlKey || evt.metaKey) && !evt.altKey && !evt.shiftKey && evt.key.toLowerCase() === 'z') {
		evt.preventDefault();
		void host.undoLast();
		return;
	}
	const model = host.model;
	if (!model || model.items.length === 0) return;
	if (handleFilterKey(host, evt)) return;
	const visible = visibleItems(host, model);
	if (visible.length === 0) return;

	// Resolve the selection from the visible list: an item hidden by a collapsed
	// ancestor or a focus-level change must not be opened or moved invisibly.
	const current = host.selectedPath
		? visible.find((item) => item.file.path === host.selectedPath) ?? null
		: null;
	if (evt.altKey) {
		if (current) handleStructureKey(host, current, evt);
		return;
	}
	handleNavigationKey(host, visible, current, evt);
}

/** `/` jumps to the filter box; Escape backs out of the filter, then the selection. */
function handleFilterKey(host: BacklogViewHost, evt: KeyboardEvent): boolean {
	if (evt.key === '/' && !evt.altKey && !evt.ctrlKey && !evt.metaKey) {
		evt.preventDefault();
		host.focusFilter();
		return true;
	}
	if (evt.key !== 'Escape') return false;
	if (host.filterText !== '') {
		evt.preventDefault();
		host.setFilter('');
	} else if (host.selectedPath !== null) {
		evt.preventDefault();
		host.clearSelection();
	}
	return true;
}

function handleStructureKey(host: BacklogViewHost, current: BacklogItem, evt: KeyboardEvent): void {
	switch (evt.key) {
		case 'ArrowUp':
			evt.preventDefault();
			moveWithinSiblings(host, current, -1);
			break;
		case 'ArrowDown':
			evt.preventDefault();
			moveWithinSiblings(host, current, 1);
			break;
		case 'ArrowLeft':
			evt.preventDefault();
			outdent(host, current);
			break;
		case 'ArrowRight':
			evt.preventDefault();
			indent(host, current);
			break;
	}
}

/** Arrow up/down and Home/End selection movement; true when the key was one of those. */
function handleSelectionKey(
	host: BacklogViewHost,
	visible: BacklogItem[],
	currentIdx: number,
	evt: KeyboardEvent,
): boolean {
	switch (evt.key) {
		case 'ArrowDown':
			host.selectItem(currentIdx === -1 ? visible[0] : visible[Math.min(currentIdx + 1, visible.length - 1)]);
			return true;
		case 'ArrowUp':
			host.selectItem(currentIdx === -1 ? visible[visible.length - 1] : visible[Math.max(currentIdx - 1, 0)]);
			return true;
		case 'Home':
			host.selectItem(visible[0]);
			return true;
		case 'End':
			host.selectItem(visible[visible.length - 1]);
			return true;
	}
	return false;
}

function handleNavigationKey(
	host: BacklogViewHost,
	visible: BacklogItem[],
	current: BacklogItem | null,
	evt: KeyboardEvent,
): void {
	const currentIdx = current ? visible.indexOf(current) : -1;
	if (handleSelectionKey(host, visible, currentIdx, evt)) {
		evt.preventDefault();
		return;
	}
	switch (evt.key) {
		case 'ArrowLeft':
		case 'ArrowRight':
			if (current) handleExpandCollapseKey(host, current, evt);
			break;
		case 'Enter':
			if (!current) break;
			evt.preventDefault();
			host.openItem(current, evt);
			break;
		case 'ContextMenu':
		case 'F10':
			if (!current || (evt.key === 'F10' && !evt.shiftKey)) break;
			evt.preventDefault();
			host.showContextMenuFor(current);
			break;
	}
}

/** Left collapses or jumps to the parent; right expands or jumps to the first child. */
function handleExpandCollapseKey(host: BacklogViewHost, current: BacklogItem, evt: KeyboardEvent): void {
	evt.preventDefault();
	// Same predicate as rendering: a parent whose children are all hidden is a
	// leaf here too — collapsing it would invisibly mutate persisted state.
	const hasChildren = current.children.some((child) => !host.isRowHidden(child));
	const collapsed = host.isCollapsed(current.file.path);
	// While filtering, collapse state is overridden and mutating it would be
	// invisible — navigation still works, state changes wait for a clear filter.
	const filtering = host.isFiltering();

	if (evt.key === 'ArrowLeft') {
		if (!filtering && hasChildren && !collapsed) collapseKeepingSelection(host, current, true);
		else if (current.parent && !current.focusRoot) host.selectItem(current.parent);
	} else if (!filtering && hasChildren && collapsed) {
		collapseKeepingSelection(host, current, false);
	} else if (hasChildren) {
		// The first child may be hidden (filter or completed items); jump to the first rendered one.
		const firstVisible = current.children.find((child) => !host.isRowHidden(child));
		if (firstVisible) host.selectItem(firstVisible);
	}
}

function collapseKeepingSelection(host: BacklogViewHost, item: BacklogItem, collapsed: boolean): void {
	host.setCollapsed(item.file.path, collapsed);
	host.refreshSubtree(item);
	host.selectItem(item);
}

// ------------------------------------------------------------------- board

/** Where the board selection currently rests: a card in a column, or a column alone. */
interface BoardPosition {
	col: number;
	/** Index into the column's cards; -1 when the column itself is selected. */
	card: number;
}

/**
 * Board keyboard support — the same one-tab-stop model as the tree: arrows move
 * the selection across cards and columns, Home and End reach the edges, Enter
 * opens, `/` reaches the filter, Ctrl/Cmd+Z undoes. A column with no card is
 * still a stop, so an empty board is fully drivable. The move shortcuts and the
 * card menu are the next increment's work, alongside the board's Set state.
 */
function handleBoardKeydown(host: BacklogViewHost, evt: KeyboardEvent): void {
	if (cardChromeHandled(host, evt)) return;
	const snapshot = host.board;
	if (!snapshot || snapshot.board.columns.length === 0) return;
	const pos = boardPosition(host, snapshot);
	const next = nextBoardPosition(snapshot, pos, evt.key);
	if (next) {
		evt.preventDefault();
		const card = snapshot.board.columns[next.col].cards[next.card];
		if (card) host.selectItem(card);
		else host.selectBoardColumn(next.col);
		return;
	}
	const current = pos && pos.card >= 0 ? snapshot.board.columns[pos.col].cards[pos.card] : null;
	if (evt.key === 'Enter' && current) {
		evt.preventDefault();
		host.openItem(current, evt);
	}
}

/**
 * The guard both card projections share: keys bubbling out of a focused control
 * drive that control alone, the chrome keys run first, and navigation is
 * unmodified keys only — Alt+arrows are the deferred MOVE shortcuts, and a
 * modified arrow that silently moved the selection instead of a card would teach
 * the wrong reflex; other chords are not these handlers' to swallow.
 */
function cardChromeHandled(host: BacklogViewHost, evt: KeyboardEvent): boolean {
	if (evt.target !== evt.currentTarget) return true;
	if (handleBoardChromeKey(host, evt)) return true;
	return evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey;
}

/** The keys that are not navigation: undo, the column-stop Escape, and the filter pair. */
function handleBoardChromeKey(host: BacklogViewHost, evt: KeyboardEvent): boolean {
	if ((evt.ctrlKey || evt.metaKey) && !evt.altKey && !evt.shiftKey && evt.key.toLowerCase() === 'z') {
		evt.preventDefault();
		void host.undoLast();
		return true;
	}
	// Escape backs out of the column stop the tree does not have, then the filter path.
	if (evt.key === 'Escape' && host.filterText === '' && host.selectedBoardColumn !== null) {
		evt.preventDefault();
		host.selectBoardColumn(null);
		return true;
	}
	return handleFilterKey(host, evt);
}

// ------------------------------------------------------------------- roadmap

/**
 * Roadmap keyboard support — the same one-tab-stop model, over the rendered
 * cards in reading order: axis, then shelf, then context. Arrows in either pair
 * step the selection (buckets and the shelf lay out sideways, the timeline
 * stacks, so both pairs work everywhere), Home and End reach the edges, Enter
 * opens, `/` reaches the filter, Ctrl/Cmd+Z undoes. The lift-move-drop gestures
 * are the scheduling feature's work, beside the writes they commit.
 */
function handleRoadmapKeydown(host: BacklogViewHost, evt: KeyboardEvent): void {
	if (cardChromeHandled(host, evt)) return;
	const cards = host.roadmap?.cards ?? [];
	if (cards.length === 0) return;
	const currentIdx = host.selectedPath ? cards.findIndex((c) => c.file.path === host.selectedPath) : -1;
	const next = nextRoadmapIndex(cards.length, currentIdx, evt.key);
	if (next !== null) {
		evt.preventDefault();
		host.selectItem(cards[next]);
		return;
	}
	if (evt.key === 'Enter' && currentIdx >= 0) {
		evt.preventDefault();
		host.openItem(cards[currentIdx], evt);
	}
}

/** The card a navigation key moves to, or null for a key that is not navigation. */
function nextRoadmapIndex(count: number, currentIdx: number, key: string): number | null {
	const last = count - 1;
	switch (key) {
		case 'Home':
			return 0;
		case 'End':
			return last;
		case 'ArrowDown':
		case 'ArrowRight':
			return currentIdx === -1 ? 0 : Math.min(currentIdx + 1, last);
		case 'ArrowUp':
		case 'ArrowLeft':
			return currentIdx === -1 ? last : Math.max(currentIdx - 1, 0);
	}
	return null;
}

function boardPosition(host: BacklogViewHost, snapshot: BoardSnapshot): BoardPosition | null {
	if (host.selectedPath !== null) {
		const columns = snapshot.board.columns;
		for (let col = 0; col < columns.length; col++) {
			const card = columns[col].cards.findIndex((c) => c.file.path === host.selectedPath);
			if (card >= 0) return { col, card };
		}
	}
	if (host.selectedBoardColumn !== null) {
		return { col: Math.min(host.selectedBoardColumn, snapshot.board.columns.length - 1), card: -1 };
	}
	return null;
}

/** The position a navigation key moves to, or null for a key that is not navigation. */
function nextBoardPosition(snapshot: BoardSnapshot, pos: BoardPosition | null, key: string): BoardPosition | null {
	const columns = snapshot.board.columns;
	const last = columns.length - 1;
	// Entering the board from nothing: the edges — and an edge is a CARD edge, so
	// entering from the end means the column's last card, not its first.
	const entry = (col: number, fromEnd = false): BoardPosition => {
		const count = columns[col].cards.length;
		return { col, card: count > 0 ? (fromEnd ? count - 1 : 0) : -1 };
	};
	switch (key) {
		case 'Home':
			return entry(0);
		case 'End':
			return entry(last, true);
		case 'ArrowDown': {
			if (!pos) return entry(0);
			const max = columns[pos.col].cards.length - 1;
			return { col: pos.col, card: Math.min(pos.card + 1, max) };
		}
		case 'ArrowUp': {
			if (!pos) return entry(last, true);
			// From the first card the column itself is the stop above, and from the
			// column stop there is nowhere further up.
			return { col: pos.col, card: Math.max(pos.card - 1, -1) };
		}
		case 'ArrowLeft':
		case 'ArrowRight': {
			if (!pos) return entry(key === 'ArrowRight' ? 0 : last);
			const col = Math.min(Math.max(pos.col + (key === 'ArrowRight' ? 1 : -1), 0), last);
			if (col === pos.col) return pos;
			// Keep the vertical position where the neighbor column allows it.
			return { col, card: Math.min(pos.card, columns[col].cards.length - 1) };
		}
	}
	return null;
}
