import { isDeliverableType } from './itemTypes';
import { BacklogItem, BacklogModel } from './model';
import { BacklogSettings, byName, menuValues, resolvedDeliverableStateKey, stateMenuValues } from './settings';
import { collectObservedStates } from './vocabulary';

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
	/**
	 * What `count` would be with the quick filter cleared — equal to it when no filter
	 * is active. A filtered header says "3 of 12" because a column is a stage of the
	 * workflow, not a search result: narrowing the cards must never make a stage look
	 * emptier than the work actually in it.
	 */
	fullCount: number;
	/**
	 * The agreed work-in-progress limit for this stage, or null for none. Never set on
	 * the no-state column or a done one — {@link BacklogSettings.wipLimits} is where
	 * that is decided, so nothing here has to remember it.
	 */
	limit: number | null;
	/** The working agreement written on this stage in the view options, or ''. */
	policy: string;
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
 * What a board's columns are drawn from: how to read a card's state, the configured
 * list (or its observed fallback), the raw observed values (for the stray-column pass,
 * which needs them even once a workflow IS configured), the done values, and the
 * per-state WIP limits/policies — `{}` for a workflow that carries neither.
 */
export interface Workflow {
	stateOf(item: BacklogItem): string | null;
	values: string[];
	observedValues: string[];
	doneValues: string[];
	wipLimits: Record<string, number>;
	columnPolicies: Record<string, string>;
}

/**
 * The requirements board's workflow — `boardColumns`' original, only caller until now.
 *
 * ONE observed vocabulary, feeding both passes that can mint a column: the configured
 * list's fallback (`stateMenuValues`, when no workflow is declared) and the stray pass
 * that runs even once one is. It is collected here rather than taken from
 * `model.observedStates`, which counts every result — Deliverables are managed on their
 * own board (`renderRequirementsBoard`) and never become a card here, so a value only
 * one of them carries must not open a column nothing can ever land in. Both halves, not
 * one: scoping the strays alone still let the fallback draw the Deliverable-only column,
 * which is the same defect through the other door.
 *
 * It is the FOCUSED population, since `model.results` is what a focus narrows. With a
 * declared workflow that changes nothing — the columns are the declaration. Without
 * one, the board draws the states its own visible work actually holds, which is the
 * only vocabulary it could offer honestly: an unfocused list would draw columns for
 * work this board is not showing.
 *
 * Stated in this factory rather than spread-and-overridden at the call site, so the
 * domain tests exercise the same workflow the view builds instead of one the view then
 * replaces a field of.
 */
export function requirementsWorkflow(model: BacklogModel, settings: BacklogSettings): Workflow {
	const observed = collectObservedStates(
		model.results.filter((item) => !isDeliverableType(item.typeName)),
		settings,
	);
	return {
		stateOf: (item) => item.stateValue,
		values: stateMenuValues(settings, observed),
		observedValues: observed,
		doneValues: settings.doneValues,
		wipLimits: settings.wipLimits,
		columnPolicies: settings.columnPolicies,
	};
}

/**
 * The frontmatter key THIS item's state lives under — the resolved Deliverable key for
 * a Deliverable, the requirements `stateKey` for everything else, and `''` when the
 * workflow that tracks it has no key configured at all.
 *
 * The same "an item's workflow follows its TYPE" rule the chip and the menu both
 * render from, stated once so they cannot gate on different keys: a chip drawn where
 * the menu offers nothing, or a menu offering picks that write to an empty key, are
 * the two halves of one disagreement. `''` is what makes "no key, no affordance" a
 * single test rather than a per-surface one.
 */
export function stateKeyFor(settings: BacklogSettings, item: BacklogItem): string {
	return isDeliverableType(item.typeName) ? resolvedDeliverableStateKey(settings) : settings.stateKey;
}

/**
 * Whether this base has a state column at all: EITHER workflow having a key is enough,
 * because a vault that configures only the Deliverable one still has Deliverable rows
 * with a state to show. Rows whose own workflow has no key render an empty cell — every
 * configured column renders on every row, or the columns after it shift per row.
 */
export function hasStateColumn(settings: BacklogSettings): boolean {
	return settings.stateKey !== '' || settings.deliverableStateKey !== '';
}

/**
 * The Deliverables board's own workflow — no WIP limits or column policies (Scope).
 * `values`' fallback is the same rule `stateMenuValues` already states for the
 * requirements workflow, applied to the Deliverable one's own configured/observed pair.
 */
export function deliverablesWorkflow(model: BacklogModel, settings: BacklogSettings): Workflow {
	return {
		stateOf: (item) => item.deliverableStateValue,
		values: menuValues(settings.deliverableStates, settings.deliverableDoneValues, model.observedDeliverableStates),
		observedValues: model.observedDeliverableStates,
		doneValues: settings.deliverableDoneValues,
		wipLimits: {},
		columnPolicies: {},
	};
}

/**
 * Project the model onto columns. `visible` is the view's own row-visibility rule
 * (quick filter, hidden completed subtrees, the context-placement test) passed in
 * whole, so the board and the tree cannot disagree about what is hidden — one
 * predicate answers for both projections.
 *
 * `candidates` is which items become cards — the caller's question, not this
 * function's: unfocused, every result is a card; focused, the rendered roots are —
 * results as live cards, and a focus-level item outside the filter as an inert
 * context card that still places its results ({@link BoardColumn.cards}).
 */
export function boardColumns(
	workflow: Workflow,
	candidates: BacklogItem[],
	visible: (item: BacklogItem) => boolean,
	population: (item: BacklogItem) => boolean = visible,
): BoardModel {
	const { columns, byValue, noState } = workflowColumns(workflow);
	// State-to-column matching is case-insensitive, exactly as doneValues matching
	// already is. A card whose state names no column gathers under no-state rather
	// than minting one — only an OBSERVED result value mints a column, above.
	const columnFor = (card: BacklogItem): BoardColumn => {
		const state = workflow.stateOf(card);
		return (state !== null ? byValue.get(state.toLowerCase()) : undefined) ?? noState;
	};

	const cards = candidates.filter(visible);
	const sortIndex = new Map<BacklogItem, number>();
	for (const card of cards) {
		columnFor(card).cards.push(card);
		sortIndex.set(card, card.outsideFilter ? firstPlacedIndex(card, visible) : card.entryIndex);
	}
	// The population each filtered count is "of": the same candidates through the same
	// placement, with only the filter lifted. Results only, exactly as `count` is.
	for (const card of candidates) {
		if (!card.outsideFilter && population(card)) columnFor(card).fullCount += 1;
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
 * How many cards this column holds beyond what was agreed — 0 at the limit, under it,
 * or with no limit at all. Reads {@link BoardColumn.fullCount}, never `count`: a filter
 * that made an over-limit column look under its limit would turn a search into a lie
 * about the work.
 *
 * Nothing that PLANS a write imports this. A limit never refuses a move, and a planner
 * that cannot see a limit cannot consult one.
 */
export function overBy(col: BoardColumn): number {
	return col.limit === null ? 0 : Math.max(0, col.fullCount - col.limit);
}

/**
 * The columns themselves, before any card is placed: no-state first, then the
 * configured workflow in order, then a column per observed value the workflow does
 * not name. `byValue` is the case-insensitive index the placement uses.
 */
function workflowColumns(
	workflow: Workflow,
): { columns: BoardColumn[]; byValue: Map<string, BoardColumn>; noState: BoardColumn } {
	const done = new Set(workflow.doneValues.map((v) => v.toLowerCase()));
	const column = (state: string | null, outsideWorkflow: boolean): BoardColumn => ({
		state,
		label: state ?? NO_STATE_LABEL,
		done: state !== null && done.has(state.toLowerCase()),
		outsideWorkflow,
		cards: [],
		count: 0,
		fullCount: 0,
		// `byName`, never a bare index: a state value is user data, and a workflow may
		// legitimately contain a state called `constructor`.
		limit: byName(workflow.wipLimits, state) ?? null,
		policy: byName(workflow.columnPolicies, state) ?? '',
	});
	const noState = column(null, false);
	const columns = [noState, ...workflow.values.map((s) => column(s, false))];
	const byValue = new Map<string, BoardColumn>();
	for (const col of columns) {
		if (col.state !== null) byValue.set(col.state.toLowerCase(), col);
	}
	// A stray value still gets a column — losing a result to an unmapped status is
	// the routine failure of every surveyed board. Minted from the observed states
	// (results only, in their menu order), so an excluded note's value never mints one.
	for (const value of workflow.observedValues) {
		if (byValue.has(value.toLowerCase())) continue;
		const col = column(value, true);
		byValue.set(value.toLowerCase(), col);
		columns.push(col);
	}
	if (byValue.has(NO_STATE_LABEL.toLowerCase())) noState.label = NO_STATE_COLLISION_LABEL;
	return { columns, byValue, noState };
}

/** Every path with a card of its own — the "already on screen" test `hiddenMatches` takes. */
export function cardPaths(board: BoardModel): Set<string> {
	return new Set(board.columns.flatMap((col) => col.cards.map((card) => card.file.path)));
}

/**
 * The matches hiding under a card: items in its subtree that the quick filter matched
 * and that no card of their own puts on screen. A focused board shows one card per
 * focus-level item, so a match three levels down has nothing to click — found,
 * counted in the rollup, and unreachable. Naming them on the card is what makes the
 * search's own result something the user can get to.
 *
 * The walk stops at anything already rendered: that card names what hides under it,
 * and a match announced by two cards is a match the user cannot count.
 */
export function hiddenMatches(
	item: BacklogItem,
	matched: (item: BacklogItem) => boolean,
	rendered: Set<string>,
): BacklogItem[] {
	const found: BacklogItem[] = [];
	const walk = (parent: BacklogItem): void => {
		for (const child of parent.children) {
			if (rendered.has(child.file.path)) continue;
			if (matched(child)) found.push(child);
			walk(child);
		}
	};
	walk(item);
	return found;
}

/**
 * What to call the column a state value sits in — by the same case-insensitive
 * match that placed the cards, and with the same fallback: a value naming no
 * column gathers under no-state, so a message about it has to say no-state too.
 * Anything that names a column out loud (a move announcement, a menu entry) reads
 * it from here rather than from the raw string, or it would name a column the user
 * cannot see.
 */
export function columnLabelFor(board: BoardModel, state: string | null): string {
	// Columns always lead with the no-state column — `boardColumns` builds it first.
	const noState = board.columns[0]?.label ?? NO_STATE_LABEL;
	if (state === null) return noState;
	return board.columns.find((col) => col.state?.toLowerCase() === state.toLowerCase())?.label ?? noState;
}

/**
 * Where a context card sorts: the earliest `entryIndex` among the visible results
 * it places — the only ordering consistent with existing only to place them. Its
 * own `entryIndex` is a load position, not a sort position: ancestors are loaded
 * after every result and would all sink to the bottom. Exported for the roadmap's
 * buckets, which sort context cards by the same rule so the same focused items
 * cannot appear in a different order per projection.
 */
export function firstPlacedIndex(item: BacklogItem, visible: (item: BacklogItem) => boolean): number {
	let min = Number.POSITIVE_INFINITY;
	for (const child of item.children) {
		if (!visible(child)) continue;
		if (!child.outsideFilter) min = Math.min(min, child.entryIndex);
		min = Math.min(min, firstPlacedIndex(child, visible));
	}
	return min;
}
