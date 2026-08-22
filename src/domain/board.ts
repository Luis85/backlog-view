import { t } from '../i18n/t';
import { inCatalog, isDeliverableType, isIterationType, isMarkerType } from './itemTypes';
import { BacklogItem, BacklogModel, inPlan } from './model';
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
	 * Which of the iteration board's three buckets this column IS — absent on the product
	 * and Deliverables boards, where the state is the identity.
	 *
	 * A bucket is not its state, and the column has to say both. `state` is *what a drop
	 * writes*, which has two values (a string, or the key removal); a bucket needs an
	 * identity that survives having nothing to write at all. Two buckets with nothing to
	 * write both hold `state: null`, and `columnKey` lowercases `state ?? ''` — so without
	 * this field In progress and Resolved would be ONE fold, colliding with Open's
	 * legitimate key removal on top.
	 */
	bucket?: IterationBucket;
	/**
	 * Whether a card may be dropped here. Always true on the other two boards, where every
	 * column writes a state; false for an iteration bucket whose representative is
	 * `undefined`, so the refusal happens at the gesture rather than after it.
	 *
	 * Stored rather than re-asked of {@link bucketRepresentative} at each site only
	 * because the sites that need it — the fold key, the drop wiring, the `Set state`
	 * list — are in `view/` and would each have to thread `settings` to reach the rule. It
	 * is set by the same call that fills `state`, so the two cannot disagree.
	 */
	takesDrop: boolean;
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
	 * The agreed work-in-progress limit for this stage, or null for none. Never set on
	 * the no-state column or a done one — {@link BacklogSettings.wipLimits} is where
	 * that is decided, so nothing here has to remember it.
	 */
	limit: number | null;
	/** The working agreement written on this stage in the view options, or ''. */
	policy: string;
	/**
	 * True while any card in this column still carries unfinished work — the question a
	 * done column's fold default is decided on, so a column of finished subtrees can
	 * start shut and one holding a retained card cannot.
	 *
	 * Asked of the CANDIDATES rather than of `cards`, which is what lets a context card
	 * speak: it is placement and never population, so its own state says nothing here,
	 * while the results below it are what folding the column would take off the board.
	 * Every other card is asked through the same `visible` that builds `cards`, and this
	 * says only that — it claimed a population reading until the quick filter went
	 * (2026-08-17) and took the field behind it. Nothing is lost by the narrower one: a
	 * card `visible` drops for membership is not this projection's, and a card it drops
	 * for the completed toggle is `subtreeDone`, so `col.done` holds and every descendant
	 * is done — the line below could not have fired for it either way. {@link
	 * BoardColumn.held} is where the population reading is genuinely still needed.
	 *
	 * "Finished" is THIS column's verdict, never `item.subtreeDone`: that field is built on
	 * `item.done`, the requirements reading, which is the wrong workflow on the Deliverables
	 * board and on the catalog. See the comment at the assignment.
	 */
	openWork: boolean;
	/**
	 * Result cards this stage HOLDS, whatever is currently hidden inside it — the evidence
	 * the fold default needs beside {@link BoardColumn.openWork}, since settling is
	 * permanent and a default taken on an empty column is a default taken on no evidence.
	 * {@link overBy} reads it for its own version of the same rule.
	 *
	 * {@link BoardColumn.count} cannot serve: it is measured through the visibility rule,
	 * which carries the completed-items toggle, so with finished work hidden a done column
	 * full of finished work reports zero — and reads as a column with nothing in it rather
	 * than the one the fold is for. This is counted through `owned` instead, which asks
	 * only whether the card is this board's at all — a MEMBERSHIP question, and the whole
	 * of what this field means rests on the caller asking it as one. See
	 * {@link boardColumns} for what both readers report when it is asked as anything else.
	 */
	held: number;
}

export interface BoardModel {
	/** No-state first, then the workflow in configured order, then observed strays. */
	columns: BoardColumn[];
	/** Result cards across all columns — the column counts sum to this. */
	cardCount: number;
}

/** The three columns an iteration board narrows the product workflow into. */
export type IterationBucket = 'open' | 'inProgress' | 'resolved';

/**
 * The label each bucket wears, in the order the board draws them. Exported because the
 * MOVE announcement names its two ends from it: the labels belong to this view rather
 * than to the vault, so reading them here says exactly what the column header says,
 * without the announcement having to find a column that may have been rebuilt under it.
 *
 * A FUNCTION, never a `Record` of `t()` results — see `noStateLabel` below for the load
 * order that makes that a rule rather than a style. The BUCKET is the data half and stays
 * an id: `bucketOf` answers one of these three names and every branch dispatches on it.
 */
export function bucketLabel(bucket: IterationBucket): string {
	return t(BUCKET_KEYS[bucket]);
}
const BUCKET_KEYS = {
	open: 'board.bucketOpen',
	inProgress: 'board.bucketInProgress',
	resolved: 'board.bucketResolved',
} as const;

/**
 * Which of the three columns a product state reads into. The precedence is stated once,
 * here, because a value read by two membership tests is a value two call sites will
 * eventually disagree about: RESOLVED wins, and the product's own done values are folded
 * into it whether or not `iterationResolvedStates` names them — an item the product calls
 * finished can never be drawn as still in progress.
 *
 * No state at all reads as Open. A note nobody has moved has not been started, which is
 * the same reading the product board's no-state column already carries.
 */
export function bucketOf(state: string | null, settings: BacklogSettings): IterationBucket {
	if (state === null) return 'open';
	if (settings.iterationResolvedStates.some((v) => sameValue(v, state))) return 'resolved';
	if (settings.doneValues.some((v) => sameValue(v, state))) return 'resolved';
	if (settings.iterationOpenStates.some((v) => sameValue(v, state))) return 'open';
	return 'inProgress';
}

/**
 * What a drop on a bucket writes: the first state THE BUCKET RULE ITSELF places there.
 *
 * Asked of the reading and never of the list, which is the whole rule.
 * `iterationOpenStates` can legitimately name a state the precedence above routes to
 * Resolved, and writing it would land the card in a column it was not dropped on — the
 * board appearing to disobey the gesture, which is worse than a refusal. Only Open can
 * break it today; the rule is general because the next configuration to expose it is the
 * one nobody thought of.
 *
 * Three answers, and the third is not an error: a state to write, `null` for Open's key
 * removal, and `undefined` for a bucket that takes NO DROP. Open alone can fall back to
 * the removal, because removing the state key is what "not started" MEANS — while a
 * middle or a finished column with nothing to write has no such equivalent, and offering
 * one would clear a state in the name of setting it.
 */
export function bucketRepresentative(bucket: IterationBucket, settings: BacklogSettings): string | null | undefined {
	const from = (list: string[]): string | undefined => list.find((v) => bucketOf(v, settings) === bucket);
	if (bucket === 'open') return from(settings.iterationOpenStates) ?? null;
	if (bucket === 'resolved') return from(settings.iterationResolvedStates) ?? from(settings.doneValues);
	// The declared product vocabulary, which is the only list that can hold a middle
	// state: In progress is defined by what the two outer lists do NOT name, so it has no
	// list of its own to read.
	return from(settings.states);
}

/** The label of the leading column for items without the state property. */
/** See `shelfLabel` in `./roadmap` for why this is a function and not a `const`. */
export function noStateLabel(): string {
	return t('placement.noState');
}
/**
 * Its label when a real state claims the natural name: state values are the
 * user's own strings, so a workflow can legitimately contain one called
 * "No state" — and two identically named columns with opposite drop semantics
 * (remove the key vs write that string) would make targeting a coin toss. The
 * synthetic column yields, because the real one's name is user data and this
 * one's is not. (A vocabulary containing both strings at once is a collision
 * this cannot untangle, accepted as vanishingly unlikely.)
 */
export function noStateCollisionLabel(): string {
	return t('placement.noStateCollision');
}

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
			label: t('legend.workflowRequirements'),
			values: requirementsWorkflow(model, settings).values,
			doneValues: settings.doneValues,
			offset: 0,
		});
	}
	// `drawable.length === 0` is the requirements workflow having no key at all: whatever
	// was declared, there is no first vocabulary for this one to be the same AS.
	if (resolvedDeliverableStateKey(settings) !== '' && (drawable.length === 0 || declaresOwnWorkflow(settings))) {
		drawable.push({
			label: t('legend.workflowDeliverables'),
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
 * The three per-column tallies, in one walk: what the stage HOLDS, what it counts, and
 * whether any of it is unfinished. One pass because they come from one question asked of
 * each card — three passes would be three chances to disagree about who is in the column.
 *
 * Split out of {@link boardColumns}, which was over its cognitive-complexity budget once
 * the context branch and `held` joined it. The predicates ride in an object so this stays
 * inside `max-params`.
 */
function tallyColumns(
	candidates: BacklogItem[],
	columnFor: (card: BacklogItem) => BoardColumn,
	asks: { visible: (item: BacklogItem) => boolean; owned: (item: BacklogItem) => boolean },
): void {
	for (const card of candidates) {
		const col = columnFor(card);
		// A context card joins no count — placement, not population — and its OWN state is
		// not this base's verdict on anything, the context-row rule. What IS the Base's is
		// everything below it, and under a focus this card can be the only thing standing
		// for those rows: fold its column away and the results it places leave the board
		// with it, silently and with no advisory, because the board does hold a card. So
		// the rollup speaks here and the card does not. Found by review (Codex, PR #140).
		//
		// Asked BEFORE `population`, and that order is the fix for the second half of the
		// same report: the predicate is about RESULTS and rejects a context card for
		// reasons that have nothing to do with the rows below it — the requirements board
		// rejects every Deliverable, including the context ones its own `visible`
		// deliberately admits as cards. Gating on it skipped exactly those.
		if (card.outsideFilter) {
			if (card.doneDescendants !== card.descendantCount) col.openWork = true;
			continue;
		}
		// What the stage HOLDS, whatever is hidden inside it. Counted through `owned` and
		// never through the visibility rule, because the completed toggle lives in that
		// one: with finished work hidden, a done column of finished work reports no cards
		// and reads as empty — so a fold default guarding on it would refuse to fire in
		// exactly the configuration the fold exists for. Found by review (Codex, PR #140).
		if (asks.owned(card)) col.held += 1;
		if (!asks.visible(card)) continue;
		// Asked here rather than of `col.cards` on purpose — see `BoardColumn.openWork`.
		//
		// And asked of the COLUMN rather than of `card.subtreeDone`, which is a different
		// mistake with the same shape: `item.done` is the REQUIREMENTS reading, so a
		// Deliverable finished in its own workflow reports open work unless its
		// requirements status happens to agree, and the fold default never fires on that
		// board at all. `ownWorkflowReading` is this codebase's answer to that question and
		// `col.done` is the same answer arrived at more cheaply — the card is in this column
		// because `workflow.stateOf` put it there, so the column IS the active workflow's
		// verdict on it and the two cannot drift. The descendants keep the rollup's own
		// reading, exactly as `subtreeDone` does.
		if (!col.done || card.doneDescendants !== card.descendantCount) col.openWork = true;
	}
}

/**
 * Project the model onto columns. `visible` is the view's own row-visibility rule
 * (hidden completed subtrees, the context-placement test) passed in
 * whole, so the board and the tree cannot disagree about what is hidden — one
 * predicate answers for both projections.
 *
 * `candidates` is which items become cards — the caller's question, not this
 * function's: unfocused, every result is a card; focused, the rendered roots are —
 * results as live cards, and a focus-level item outside the filter as an inert
 * context card that still places its results ({@link BoardColumn.cards}).
 *
 * **`owned` is a MEMBERSHIP question — is this card this board's at all — and never a
 * type test or a second reading of `visible`.** Both wrong answers have shipped. Defaulted
 * to `visible` it makes {@link BoardColumn.held} a second name for {@link BoardColumn.count},
 * so a done column whose finished work the completed toggle has hidden reports nothing held
 * and the fold default stops firing in exactly the configuration it was written for. Asked
 * as a type alone it over-counts, and over-counting is not free either: both readers of
 * `held` then speak for a row the board never draws — {@link overBy} invents an over-limit
 * warning, and the fold default settles a column permanently shut on evidence nobody can
 * see (2026-08-17, `renderRequirementsBoard`, whose focused candidates come from
 * `requirementsFocusRoots` and are not membership-filtered).
 *
 * So the default is a FALLBACK for a caller whose candidates are already its own population
 * — every one of them is this board's — and not a shape to fall into where they are not.
 * All three callers in `view/` pass their own.
 */
export function boardColumns(
	workflow: Workflow,
	candidates: BacklogItem[],
	visible: (item: BacklogItem) => boolean,
	owned: (item: BacklogItem) => boolean = () => true,
): BoardModel {
	const { columns, byValue, noState } = workflowColumns(workflow);
	// State-to-column matching is case-insensitive, exactly as doneValues matching
	// already is. A card whose state names no column gathers under no-state rather
	// than minting one — only an OBSERVED result value mints a column, above.
	const columnFor = (card: BacklogItem): BoardColumn => {
		const state = workflow.stateOf(card);
		return (state !== null ? byValue.get(state.toLowerCase()) : undefined) ?? noState;
	};

	return fillColumns(columns, columnFor, candidates, { visible, owned });
}

/**
 * The iteration board's three columns over the population it is handed.
 *
 * The state key is read DIRECTLY (`settings.stateKey`) rather than through
 * `stateKeyFor`, and that is the decision this board rests on: `stateKeyFor` dispatches
 * on the item, so a `Deliverable` would answer with the Deliverables key and one board
 * would be drawing two vocabularies. An iteration holds whatever kind of work was
 * committed to the fortnight, and the whole point of narrowing the PRODUCT workflow is
 * that there is one of it.
 *
 * BOTH predicates default to "everything counts", which is the shape a domain test wants;
 * the view passes the completed toggle exactly as it does for the other two boards. Never
 * `owned = visible` — see {@link boardColumns} for the one value that default may not take.
 */
export function iterationBuckets(
	population: BacklogItem[],
	settings: BacklogSettings,
	visible: (item: BacklogItem) => boolean = () => true,
	owned: (item: BacklogItem) => boolean = () => true,
): BoardModel {
	const column = (bucket: IterationBucket): BoardColumn => {
		const representative = bucketRepresentative(bucket, settings);
		return {
			// `undefined` is not a state and must never be stored as one: a bucket with
			// nothing to write holds `null` and says so through `takesDrop`.
			state: representative ?? null,
			label: bucketLabel(bucket),
			done: bucket === 'resolved',
			bucket,
			takesDrop: representative !== undefined,
			// Fixed three, so every value has a home and nothing is ever outside the
			// workflow. A limit and a policy are per STATE and a bucket is not one —
			// three columns over five states have no agreement to state.
			outsideWorkflow: false,
			cards: [],
			count: 0,
			limit: null,
			policy: '',
			openWork: false,
			held: 0,
		};
	};
	// A RECORD over the three rather than a map with a fallback: `bucketOf` answers one of
	// exactly these names, so the lookup is total and the compiler is what says so — a
	// `?? columns[0]` beside it would be an unreachable branch pretending to be a guard.
	const byBucket: Record<IterationBucket, BoardColumn> = {
		open: column('open'),
		inProgress: column('inProgress'),
		resolved: column('resolved'),
	};
	const columns = [byBucket.open, byBucket.inProgress, byBucket.resolved];
	// With no state property there is no state to read, so every card reads as Open — the
	// same answer a note with no state key gets, arrived at one level up.
	const columnFor = (card: BacklogItem): BoardColumn =>
		byBucket[bucketOf(settings.stateKey ? card.stateValue : null, settings)];
	return fillColumns(columns, columnFor, population, { visible, owned });
}

/**
 * The work an iteration board can still pull in: the results that name no iteration at
 * all and are not finished in their own workflow.
 *
 * Three refusals, and they are `inIteration`'s own read the other way round — a marker is
 * not work, a catalog member has a projection of its own, and an `Iteration` is the box
 * rather than what goes in it — so the shelf can never offer a card the board would then
 * refuse to draw. A context row is refused with them: the shelf is a statement about the
 * RESULTS, exactly as the roadmap's is.
 *
 * **In NO iteration, never "not in this one".** Work committed to another fortnight is
 * committed; offering it here would make a pull from the shelf a silent removal from
 * somebody else's sprint.
 *
 * Finished work is left out through `ownWorkflowReading`, never `item.done`: a
 * `Deliverable` finished in its own workflow is finished, and the requirements reading
 * would keep it on the shelf for a `status` it does not hold.
 */
export function iterationCandidates(model: BacklogModel): BacklogItem[] {
	return model.results.filter(
		(item) =>
			!item.outsideFilter &&
			!isMarkerType(item.typeName) &&
			inPlan(item) &&
			!committedToIteration(model, item) &&
			!ownWorkflowReading(item).done,
	);
}

/**
 * Whether this item's `iteration` link is a COMMITMENT — which is a narrower question
 * than whether the link resolves, and the difference is work that would otherwise be
 * plannable nowhere at all.
 *
 * A link naming a note the model holds that is **not** an `Iteration` reads as
 * uncommitted here. Such an item is on no board — `inIteration` matches by the scope's
 * path, and a scope may only be an `Iteration` — so treating the link as a commitment
 * hid it from the one surface that could reassign it, with no way for a reader to find
 * it but the note itself. A broken link already read this way; this puts the resolved
 * but wrong one beside it. Found by review (Codex, PR #182).
 *
 * A note the MODEL does not hold is a commitment all the same, and that asymmetry is
 * deliberate: nothing here can say what type an unloaded note is, and calling every
 * unreadable target malformed would put a whole vault's committed work on the shelf of
 * any base whose filter leaves the other sprints out.
 *
 * What it does NOT do is say so on the card. A malformed link draws as ordinary
 * untriaged work, and the reason belongs beside the roadmap shelf's own — see
 * `docs/requirements/Pulling work into an iteration.md` extension 2d.
 */
function committedToIteration(model: BacklogModel, item: BacklogItem): boolean {
	const path = item.iterationEntry?.file?.path;
	if (path === undefined) return false;
	const target = model.byPath.get(path);
	return target === undefined || isIterationType(target.typeName);
}

/**
 * Placing the cards, ordering them and counting them — everything a board does once its
 * columns exist and something has said which column a card belongs to.
 *
 * Shared by the two builders rather than written twice, because none of it is about
 * WHERE the columns came from: the requirements board matches a state against a
 * vocabulary and the iteration board reads one into a bucket, and both then owe the
 * reader the same sort, the same context-card exclusion and the same counts.
 */
function fillColumns(
	columns: BoardColumn[],
	columnFor: (card: BacklogItem) => BoardColumn,
	candidates: BacklogItem[],
	asks: {
		visible: (item: BacklogItem) => boolean;
		owned: (item: BacklogItem) => boolean;
	},
): BoardModel {
	const cards = candidates.filter(asks.visible);
	const sortIndex = new Map<BacklogItem, number>();
	for (const card of cards) {
		columnFor(card).cards.push(card);
		sortIndex.set(card, card.outsideFilter ? firstPlacedIndex(card, asks.visible) : card.entryIndex);
	}
	tallyColumns(candidates, columnFor, asks);
	let cardCount = 0;
	for (const col of columns) {
		col.cards.sort((a, b) => (sortIndex.get(a) ?? 0) - (sortIndex.get(b) ?? 0) || a.entryIndex - b.entryIndex);
		col.count = col.cards.reduce((n, card) => n + (card.outsideFilter ? 0 : 1), 0);
		cardCount += col.count;
	}
	return { columns, cardCount };
}

/**
 * The empty no-state column, which draws as a bare 44px drop strip rather than as a
 * column: clearing a state by drag has to stay possible without a permanently empty stage
 * taking a stage's room.
 *
 * Asked by two surfaces and therefore stated in one place. It decides what the header
 * DRAWS — no count, and no disclosure, since there is nothing in it to fold — and what
 * that column's menu OFFERS, and the two coming apart is exactly how the strip came to
 * carry a Collapse action with no control on screen for it (found by review, PR #140).
 *
 */
export function emptyNoState(col: BoardColumn): boolean {
	// **No BUCKET is ever this column**, whatever its representative comes out as, and
	// that refusal is about the other board rather than about a write. The strip is what a
	// column with no NAME of its own shrinks to; the iteration board's three are named
	// stages drawn structurally — "a stage of the workflow with nothing in it is a stage
	// with nothing in it" ([[A board scoped to one iteration]] 4d) — so Open collapsing to
	// a nameless 44px box is one of three promised columns going missing. It is the
	// DEFAULT configuration that reaches it: with `iterationOpenStates` unset, Open's
	// representative is the key removal (4f), which is a `state: null` that takes a drop,
	// so every other term here was already true of an empty Open.
	//
	// `takesDrop` stays, for the case it was added for: an unwritable bucket carries the
	// same null and would otherwise shrink to a box offering the one thing it cannot do.
	// Both terms are now covered by the bucket refusal; neither is removed, because each
	// states a rule about a different half of `state === null`.
	if (col.bucket !== undefined) return false;
	// ONE reading of empty. `count` was `fullCount` here — a population genuinely
	// independent of the drawn cards — and `fullCount` went with the quick filter
	// (2026-08-17), leaving a term `cards.length === 0` already forces: `count` is a reduce
	// over `cards`.
	//
	// `held` is not the replacement, and only one thing here can be said about it
	// STRUCTURALLY: a card in this column carries no state, so it cannot be `item.done`, so
	// it is never `subtreeDone` and the completed toggle can never be what hid it. That is a
	// claim about the toggle and nothing else — `held` is measured apart from `visible`
	// WHOLE, and membership is the other half of it, so which of the two is larger here is a
	// question about the caller's predicate rather than about this column. The strip does not
	// turn on that question: it is what a stage with no name of its own and nothing to SHOW
	// shrinks to, and the cards are what it shows.
	return col.state === null && col.takesDrop && col.cards.length === 0;
}

/**
 * How many cards this column holds beyond what was agreed — 0 at the limit, under it,
 * or with no limit at all.
 *
 * Read off {@link BoardColumn.held}: the signal is about what the stage HOLDS, so nothing
 * the reader is hiding inside it may make an over-limit column look under its limit
 * (`docs/requirements/WIP limits.md` — the purpose the whole note is written to, its
 * extension 4a being about the quick filter, which no longer exists). It read `fullCount`
 * for that reason until the filter took that field with it (2026-08-17) and left this on
 * `count`.
 *
 * **`held` is only that population while `owned` asks MEMBERSHIP**, which is the rule
 * stated at {@link boardColumns} and the one this depended on before it was true: with a
 * type-only `owned`, a focused board held rows it never draws and this reported a column
 * drawing two cards under a limit of two as one over.
 * `test/view/columnAgreements.test.ts` is the check, and it checks THAT rather than this
 * reading — with `owned` asking membership, both new tests pass with `count` here too. So
 * the reading is the requirement's rule, not a difference the suite can currently show; the
 * honest form of that is "no test here reaches it", which is a statement about this suite
 * and not about a vault.
 *
 * Nothing that PLANS a write imports this. A limit never refuses a move, and a planner
 * that cannot see a limit cannot consult one.
 */
export function overBy(col: BoardColumn): number {
	return col.limit === null ? 0 : Math.max(0, col.held - col.limit);
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
		label: state ?? noStateLabel(),
		done: state !== null && done.has(state.toLowerCase()),
		// Every column of a state-matched board takes a drop: it exists because a state
		// names it, and that state is what the drop writes.
		takesDrop: true,
		outsideWorkflow,
		cards: [],
		count: 0,
		// `byName`, never a bare index: a state value is user data, and a workflow may
		// legitimately contain a state called `constructor`.
		limit: byName(workflow.wipLimits, state) ?? null,
		policy: byName(workflow.columnPolicies, state) ?? '',
		openWork: false,
		held: 0,
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
	if (byValue.has(noStateLabel().toLowerCase())) noState.label = noStateCollisionLabel();
	return { columns, byValue, noState };
}

/**
 * What a column is FOLDED by — the bucket where there is one, the state everywhere else.
 *
 * One statement rather than the expression written at each site, because the render read
 * it one way and both CONTROLS read it another: an Open bucket represented by `New`
 * rendered from the `open` key while its own disclosure and its menu entry toggled `new`,
 * so the control appeared not to work, and two buckets with nothing to write collided on
 * the null besides. Found by review (Codex, PR #154).
 */
export function columnFoldValue(col: BoardColumn): string | null {
	return col.bucket ?? col.state;
}

/** Every path with a card of its own — the "already on screen" test the card menu takes. */
export function cardPaths(board: BoardModel): Set<string> {
	return new Set(board.columns.flatMap((col) => col.cards.map((card) => card.file.path)));
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
	const noState = board.columns[0]?.label ?? noStateLabel();
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
