import { inCatalog, isDeliverableType } from './itemTypes';
import { BacklogItem, BacklogModel } from './model';
import { sameValue } from './noteFields';
import { BacklogSettings, menuValues, STATE_COLOR_SLOTS, stateMenuValues } from './settings';
import { resolvedDeliverableStateKey, resolvedTestStateKey } from './optionalProperties';
import { byName } from './typeVocabulary';
import { collectObservedStates } from './vocabulary';
import { isColorName } from './stateColors';

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
 * The requirements board's candidate roots under a focus — `model.roots` with each
 * excluded Deliverable replaced by its own topmost non-Deliverable descendants.
 *
 * `Deliverable` is in `EXTRA_TYPES`, so `collectFocusRoots` promotes one to a focus root
 * at the extra-type rung exactly as it promotes a Bug, and this board then excludes it.
 * Without this descent its requirement children are neither cards of their own nor rolled
 * into a parent card that is on screen — counted by the toolbar and represented by
 * nothing. Unfocused they each get a card, because the candidates are the results
 * themselves; this is that same answer under a focus, reached by the very descent
 * `collectFocusRoots` already makes for a root that does not match its filter.
 *
 * A CONTEXT Deliverable is kept rather than descended through: the board admits one as
 * placement (see `renderRequirementsBoard`'s predicate) and it renders whenever it has a
 * visible child, so its descendants already have a card to sit under. Descending would
 * card them beside the parent that is there to place them.
 */
export function requirementsFocusRoots(roots: BacklogItem[]): BacklogItem[] {
	const candidates: BacklogItem[] = [];
	const collect = (list: BacklogItem[]): void => {
		for (const item of list) {
			if (isDeliverableType(item.typeName) && !item.outsideFilter) collect(item.children);
			else candidates.push(item);
		}
	};
	collect(roots);
	return candidates;
}

/**
 * The key an item's state is read and written through. Three workflows now, and the two
 * secondary selectors are DISJOINT BY CONSTRUCTION rather than ordered: `isDeliverableType`
 * asks a type NAME and `inCatalog` asks the LADDER, and a `Deliverable` is an extra type
 * whose `ladderFor` answer is always `LEVELS`. No item can satisfy both, so this branch
 * needs no argument about which is tested first.
 *
 * The ladder and not a list of test type names, for the reason the whole catalog rests on:
 * a typeless child of a `Test suite` and a `Task` under a `Test case` are both catalog
 * members, and a predicate written as `isTestType(item.typeName)` gets both wrong while
 * passing every other fixture.
 */
export function stateKeyFor(settings: BacklogSettings, item: BacklogItem): string {
	if (isDeliverableType(item.typeName)) return resolvedDeliverableStateKey(settings);
	if (inCatalog(item)) return resolvedTestStateKey(settings);
	return settings.stateKey;
}

/** An item's state value and whether that value counts as done, from one workflow. */
export interface WorkflowReading {
	value: string | null;
	done: boolean;
}

/**
 * The same "an item's workflow follows its type, or its ladder" rule `stateKeyFor` states
 * for the KEY, stated once more for the VALUE. Before these two existed, the chip and the
 * menu each hand-wrote the same ternary — two copies of one rule is how they came to
 * disagree in the first place, and it is why a third workflow costs two edits HERE. It
 * costs more elsewhere: the vocabulary, the write planner, the option and the badge are
 * their own changes, and this sentence is about the selection alone.
 *
 * The pair is returned together so both halves come from ONE decision: a caller that needs
 * only the value still gets the value of the workflow whose done flag it would have got.
 * That does not stop a caller taking one half — `stateChoices` in `interactions/menu.ts`
 * legitimately reads `.value` alone — and doing so is not a sign the pairing was pointless.
 */
export function ownWorkflowReading(item: BacklogItem): WorkflowReading {
	if (isDeliverableType(item.typeName)) return { value: item.deliverableStateValue, done: item.deliverableDone };
	if (inCatalog(item)) return { value: item.testStateValue, done: item.testDone };
	return { value: item.stateValue, done: item.done };
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
 * The colour vocabularies a dated-axis bar can be keyed into, in the order their slots
 * are assigned — only the workflows that can actually key something, and only where they
 * are genuinely two vocabularies, so the list has two entries only where the base really
 * shows two.
 *
 * A palette is a VOCABULARY, not a property, and both halves of that matter:
 *
 * - **It can draw** when its RESOLVED key is non-empty. Without a key `domain/model.ts`
 *   sets that workflow's every state value to null, so no bar it tracks can carry a
 *   colour — and a vocabulary here that nothing can draw is the defect the legend's own
 *   rule names. Resolved, not raw: a falling-back Deliverable workflow reads the
 *   requirements property, which is a real property, so it draws.
 * - **It is a SECOND one** when the user DECLARED a second — its own property, or its own
 *   list of values or done values (`declaresOwnWorkflow`). Asked of the DECLARATIONS, not
 *   of the two computed lists: with no list configured each workflow falls back to its own
 *   OBSERVED states, and those populations are disjoint by construction
 *   (`requirementsWorkflow` excludes Deliverables), so comparing the computed lists splits
 *   one workflow in two in a base that declared nothing at all.
 *
 * With two: the label names each so one strip says which is which, and slots CONTINUE
 * across them rather than restarting — hence an ordered list plus an offset rather than
 * two independent vocabularies. Restarting would paint a Deliverable's first state the
 * same colour as a PBI's, and those are different facts. Four slots still wrap
 * (`STATE_COLOR_SLOTS`), so a long enough pair repeats.
 *
 * A lone one is unlabelled and starts at slot 0: nothing to tell it apart from, and no
 * earlier vocabulary to continue from. NEITHER able to draw returns an empty list, so a
 * caller has to say what it does with no vocabulary at all rather than be handed one that
 * silently keys nothing.
 */
export interface StatePalette {
	/** Names the workflow in the legend; empty when there is only one and nothing to tell apart. */
	label: string;
	values: string[];
	doneValues: string[];
	/** Where this palette's first value sits in the continuing slot sequence. */
	offset: number;
}

export function statePalettes(model: BacklogModel, settings: BacklogSettings): StatePalette[] {
	const drawable: StatePalette[] = [];
	if (settings.stateKey !== '') {
		drawable.push({
			label: 'Work',
			values: requirementsWorkflow(model, settings).values,
			doneValues: settings.doneValues,
			offset: 0,
		});
	}
	// `drawable.length === 0` is the requirements workflow having no key at all: whatever
	// was declared, there is no first vocabulary for this one to be the same AS.
	if (resolvedDeliverableStateKey(settings) !== '' && (drawable.length === 0 || declaresOwnWorkflow(settings))) {
		drawable.push({
			label: 'Deliverables',
			values: deliverablesWorkflow(model, settings).values,
			doneValues: settings.deliverableDoneValues,
			// Past everything already assigned — one statement rather than a second copy
			// of "the requirements list comes first", which is only true while it is here.
			offset: drawable.reduce((sum, palette) => sum + palette.values.length, 0),
		});
	}
	return drawable.length === 1 ? [{ ...drawable[0], label: '', offset: 0 }] : drawable;
}

/**
 * Whether the Deliverable settings declare a workflow of their own rather than following
 * the requirements one: its own property, its own states, or its own done values. Any of
 * the three is enough — two workflows agreeing on the states while disagreeing on which of
 * them is finished paint the same value differently, since done outranks a slot.
 */
function declaresOwnWorkflow(settings: BacklogSettings): boolean {
	const alike = (x: string[], y: string[]): boolean =>
		x.length === y.length && x.every((value, i) => sameValue(value, y[i]));
	return (
		settings.deliverableStateKey !== '' ||
		!alike(settings.deliverableStates, settings.states) ||
		!alike(settings.deliverableDoneValues, settings.doneValues)
	);
}

/**
 * The palette an ITEM is keyed into — its own workflow, the rule `stateKeyFor` and
 * `ownWorkflowReading` already state for the key and the value. Before this, a bar took
 * its colour from the requirements vocabulary whatever the item was, so a Deliverable
 * with its own workflow drew a colour naming a state it does not hold, and changing the
 * state that IS its own moved nothing on the grid.
 *
 * Undefined where no workflow has a key at all, which is a real configuration and not an
 * error: the caller decides what a bar with no vocabulary draws, rather than this handing
 * back an empty palette that would answer "no slot" while looking like a vocabulary.
 */
export function paletteFor(palettes: StatePalette[], item: BacklogItem): StatePalette | undefined {
	return palettes.length > 1 && isDeliverableType(item.typeName) ? palettes[1] : palettes[0];
}

/**
 * Which palette slot a state value's bar takes on the roadmap's dated axis: its index in
 * that palette's own vocabulary — the same list the workflow's columns and its Set state
 * menu use, so a bar and a menu entry can never disagree about a state's colour — shifted
 * by the palette's `offset` and wrapped modulo `STATE_COLOR_SLOTS` so a vocabulary longer
 * than the palette repeats rather than running out. No state, or a value outside the
 * vocabulary (an item's own unlisted value, most often), gets no slot: null, which is the
 * bar's plain accent colour rather than a guess.
 *
 * The bar asks this of `paletteFor(item)` and the legend asks it of each palette in turn,
 * which is the whole of why it takes a palette rather than settings: those two used to be
 * one vocabulary read twice, and a legend that keys a colour no bar draws — or misses one
 * every bar does — is the only failure this feature has ever had.
 */
export function paletteSlot(palette: StatePalette, state: string | null): number | null {
	const index = palette.values.findIndex((value) => sameValue(value, state));
	return index === -1 ? null : (palette.offset + index) % STATE_COLOR_SLOTS;
}

/**
 * How a state is PAINTED, wherever it is drawn: the class it takes, and the inline colour
 * that overrides it. Both facts from one function rather than two readers of
 * `settings.stateColors`, for the reason `paletteSlot` already gives — a legend that keys a
 * colour no bar draws is the only failure this feature has ever had, and a bar and its
 * swatch now carry TWO things that must agree rather than one.
 *
 * A stored NAME is a class (`styles/stateColors.css` paints it, so it follows the theme); a
 * stored HEX is an inline value, which overrides whatever the class set. Either way the
 * class is present, so a colour cleared in the picker falls back to the positional slot in
 * the same render rather than to the plain accent.
 *
 * Null where no slot exists, and the pick is asked only after one does. The order is
 * load-bearing rather than taste: the pick is per VALUE while the slot is per PALETTE, so a
 * Deliverable whose own state shares a name with a coloured requirements state would
 * otherwise paint a colour its own vocabulary never keyed, on a bar the legend has no
 * swatch for. Checked in `test/view/stateColors.test.ts`, which is the one case that fails
 * when these two lines are swapped.
 *
 * Done is not asked here and must not be: a done bar takes green by specificity in
 * `styles/timeline.css` and its swatch is keyed `pbl-legend-done` by the caller, so the two
 * agree without this knowing which states are finished. A pick on a done state is therefore
 * inert — stated in `docs/requirements/A colour per state.md`, not silently.
 */
export interface StatePaint {
	/** The class the mark wears: a named colour's own, else the positional slot's. */
	cls: string;
	/** A picked hex, applied inline over that class, or null to leave it standing. */
	color: string | null;
}

export function stateColorPaint(
	settings: BacklogSettings,
	palette: StatePalette,
	state: string | null,
): StatePaint | null {
	const slot = paletteSlot(palette, state);
	if (slot === null) return null;
	// `byName`, never a bare index: the key is a state VALUE, so `constructor` and
	// `toString` are configurations a user can have, and every one of them finds something
	// truthy on `Object.prototype`. `nameTable` builds this map null-prototype so the
	// resolver's own output is safe either way, but a hand-built fixture is a plain object
	// and the colour painted from this would then be a function's source text.
	const chosen = byName(settings.stateColors, state);
	if (chosen === undefined) return { cls: `pbl-state-${slot}`, color: null };
	return isColorName(chosen)
		? { cls: `pbl-state-c-${chosen}`, color: null }
		: { cls: `pbl-state-${slot}`, color: chosen };
}

/**
 * Done by THIS palette's own list, never `settings.doneValues`: the Deliverable workflow
 * declares its own, so asking the requirements list would paint a finished Deliverable
 * with a slot colour while its bar took the green override — the legend disagreeing with
 * the only thing it exists to explain.
 */
export function paletteDone(palette: StatePalette, state: string): boolean {
	return palette.doneValues.some((value) => sameValue(value, state));
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
 * The walk stops at two things. At anything already RENDERED: that card names what
 * hides under it, and a match announced by two cards is a match the user cannot count.
 * And at any row this projection does not DRAW — `drawn`, which the caller supplies,
 * because this module is pure and the answer is the view's (`view/childrenList.ts`
 * passes `!host.isRowHidden`, which is the disclosure's own predicate — `listedChildren`
 * asks exactly it. The ROLLUP stops at the same ladder edge by a different and narrower
 * test of its own (`inCatalog(child) || inCatalog(item)`, in `assignAll`), so the three
 * agree about a test boundary and nothing here says more than that). A row the screen
 * has no line to is not a route to
 * anything either, so that one stops the descent and not just the naming.
 *
 * `drawn` is where the ladder boundary is kept, and it is deliberately NOT kept in
 * `matched`. A `PBI` beneath a `Test case` is a plan member and a genuine match — that
 * is what promotes it to a root of the tree, and the same property is what keeps a
 * `Deliverable` nested under a test on its own board — so a rule of the form "a member
 * below a non-member is not a match" deletes a card that is on screen. What was wrong
 * was only the claim that such a row is beneath THIS card: on the Deliverables board
 * the `Test case` between the two is drawn nowhere, so nothing there relates them.
 * Fix a disagreement about "beneath" in the walk; never in the match set.
 */
export function hiddenMatches(
	item: BacklogItem,
	matched: (item: BacklogItem) => boolean,
	rendered: Set<string>,
	drawn: (item: BacklogItem) => boolean,
): BacklogItem[] {
	const found: BacklogItem[] = [];
	const walk = (parent: BacklogItem): void => {
		for (const child of parent.children) {
			if (!drawn(child) || rendered.has(child.file.path)) continue;
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
