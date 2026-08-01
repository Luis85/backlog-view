import { BacklogItem, BacklogModel } from './model';
import { BacklogSettings, stateMenuValues } from './settings';

/**
 * Deriving the board from the model and the settings: which columns exist, which
 * items are cards, and which column each card sits in. Pure — the DOM the board
 * renders and the writes a drop plans live elsewhere; this module only answers
 * questions, so every rule here is testable without a board existing.
 *
 * The columns are the workflow the view options define (`stateValues` in order,
 * `doneValues` marking the finish) — there is no second column configuration, so
 * the board can never offer a vocabulary the state menus do not.
 */

export interface BoardColumn {
	/**
	 * The canonical state string this column stands for — what a drop writes, byte
	 * for byte. Null for the leading no-state column, whose drop removes the key.
	 */
	state: string | null;
	label: string;
	/** True when the state counts as done — the column is styled as finished. */
	done: boolean;
	/**
	 * True for a column minted from an observed value the configured workflow does
	 * not name. Appended after the configured columns and visibly outside the
	 * workflow: a nudge to adopt the state or re-state the items, never a dropped card.
	 */
	outsideWorkflow: boolean;
	/**
	 * The cards, in the order the Base's own sort delivers (`entryIndex`) — within a
	 * column order is derived, never stored. Context cards (`outsideFilter`) are
	 * interleaved where their first placed result would sort.
	 */
	cards: BacklogItem[];
	/** Result cards only. A context card is placement, not population. */
	count: number;
}

export interface BoardModel {
	/** No-state first, then the workflow in configured order, then observed strays. */
	columns: BoardColumn[];
	/** Result cards across all columns — the column counts sum to this. */
	cardCount: number;
}

/** The label of the leading column for items without the state property. */
export const NO_STATE_LABEL = 'No state';
/**
 * Its label when a real state claims the natural name: state values are the
 * user's own strings, so a workflow can legitimately contain one called
 * "No state" — and two identically named columns with opposite drop semantics
 * (remove the key vs write that string) would make targeting a coin toss. The
 * synthetic column yields, because the real one's name is user data and this
 * one's is not. (A vocabulary containing both strings at once is a collision
 * this cannot untangle, accepted as vanishingly unlikely.)
 */
export const NO_STATE_COLLISION_LABEL = 'Unset';

/**
 * Project the model onto columns. `visible` is the view's own row-visibility rule
 * (quick filter, hidden completed subtrees, the context-placement test) passed in
 * whole, so the board and the tree cannot disagree about what is hidden — one
 * predicate answers for both projections.
 *
 * Which items become cards is the focus level's question: unfocused, every result
 * is a card; focused, the rendered roots are — results as live cards, and a
 * focus-level item outside the filter as an inert context card that still places
 * its results ({@link BoardColumn.cards}).
 */
export function boardColumns(
	model: BacklogModel,
	settings: BacklogSettings,
	visible: (item: BacklogItem) => boolean,
): BoardModel {
	// The same fallback the state menus use, so with no configured list the board
	// still draws the observed workflow rather than nothing.
	const workflow = stateMenuValues(settings, model.observedStates);
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	const column = (state: string, outsideWorkflow: boolean): BoardColumn => ({
		state,
		label: state,
		done: done.has(state.toLowerCase()),
		outsideWorkflow,
		cards: [],
		count: 0,
	});
	const noState: BoardColumn = { state: null, label: NO_STATE_LABEL, done: false, outsideWorkflow: false, cards: [], count: 0 };
	const columns = [noState, ...workflow.map((s) => column(s, false))];
	const byValue = new Map<string, BoardColumn>();
	for (const col of columns) {
		if (col.state !== null) byValue.set(col.state.toLowerCase(), col);
	}
	// A stray value still gets a column — losing a result to an unmapped status is
	// the routine failure of every surveyed board. Minted from the observed states
	// (results only, in their menu order), so an excluded note's value never mints one.
	for (const value of model.observedStates) {
		if (byValue.has(value.toLowerCase())) continue;
		const col = column(value, true);
		byValue.set(value.toLowerCase(), col);
		columns.push(col);
	}
	if (byValue.has(NO_STATE_LABEL.toLowerCase())) noState.label = NO_STATE_COLLISION_LABEL;

	const cards = (model.focused ? model.roots : model.results).filter(visible);
	const sortIndex = new Map<BacklogItem, number>();
	for (const card of cards) {
		// State-to-column matching is case-insensitive, exactly as doneValues matching
		// already is. A context card whose state names no column gathers under
		// no-state rather than minting one.
		const col = card.stateValue !== null ? byValue.get(card.stateValue.toLowerCase()) : undefined;
		(col ?? noState).cards.push(card);
		sortIndex.set(card, card.outsideFilter ? firstPlacedIndex(card, visible) : card.entryIndex);
	}
	let cardCount = 0;
	for (const col of columns) {
		col.cards.sort((a, b) => (sortIndex.get(a) ?? 0) - (sortIndex.get(b) ?? 0) || a.entryIndex - b.entryIndex);
		col.count = col.cards.reduce((n, card) => n + (card.outsideFilter ? 0 : 1), 0);
		cardCount += col.count;
	}
	return { columns, cardCount };
}

/**
 * Where a context card sorts: the earliest `entryIndex` among the visible results
 * it places — the only ordering consistent with existing only to place them. Its
 * own `entryIndex` is a load position, not a sort position: ancestors are loaded
 * after every result and would all sink to the bottom.
 */
function firstPlacedIndex(item: BacklogItem, visible: (item: BacklogItem) => boolean): number {
	let min = Number.POSITIVE_INFINITY;
	for (const child of item.children) {
		if (!visible(child)) continue;
		if (!child.outsideFilter) min = Math.min(min, child.entryIndex);
		min = Math.min(min, firstPlacedIndex(child, visible));
	}
	return min;
}
