import { BacklogViewHost } from './host';
import { ShelfCard } from '../domain/bars';

/**
 * Which shelf is on screen, what it holds, and whether it is shut.
 *
 * Three surfaces draw a band — the roadmap's two axes and the iteration board — and every
 * control above one has to act on the one in front of the reader. They read `host.roadmap`
 * directly until 2026-08-21, which answered null on a board: the pickers were withheld
 * there partly for that reason, and a control that HAD been drawn would have opened a menu
 * over an empty array.
 *
 * Its own module at the view's root rather than a function in `render/shelfControls.ts`,
 * because `interactions/menu.ts` needs it too and that file is already imported BY
 * `shelfControls.ts` — the obvious home would be a cycle. `childrenList.ts` and
 * `projection.ts` beside it are the same shape: something both directories reach.
 *
 * The two bands answer `collapsed` from different bits and neither may be guessed from the
 * other. The roadmap's is the view-state store's `shelfExpanded`; the iteration board's is a
 * COLUMN fold (`'backlog'`), which is the same mechanism its type groups already use and
 * which defaults to OPEN. That difference is the whole reason this returns the answer rather
 * than the snapshot.
 */
export interface ActiveShelf {
	/** The band's element for this render, or null where no band was drawn. */
	el: HTMLElement | null;
	/** Everything the band holds, before any narrowing — never what the filter leaves. */
	cards: ShelfCard[];
	/** Whether it is shut, from whichever bit shuts THIS band. */
	collapsed: boolean;
}

export function activeShelf(host: BacklogViewHost): ActiveShelf {
	const roadmap = host.roadmap;
	if (roadmap) {
		return { el: roadmap.shelfEl, cards: roadmap.roadmap.shelf, collapsed: host.shelfCollapsed };
	}
	const board = host.board;
	if (board?.shelfEl) {
		return { el: board.shelfEl, cards: board.shelf ?? [], collapsed: host.columnCollapsed('backlog', null, false) };
	}
	return { el: null, cards: [], collapsed: false };
}
