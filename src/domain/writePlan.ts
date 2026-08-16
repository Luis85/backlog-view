import { TFile } from 'obsidian';
import { DropTarget } from './dropTargets';
import { BacklogItem, BacklogModel } from './model';
import { childLevelIndex, PlacementEnd } from './itemTypes';
import { readDate, sameValue } from './noteFields';
import { hasHorizonAxis } from './roadmap';
import { stateKeyFor } from './board';
import { BacklogSettings, isDoneValue, isStartedValue } from './settings';
import {
	OPTIONAL_FIELDS,
	OptionalField,
	optionalKeyFor,
	resolvedDeliverableStateKey,
	resolvedTestStateKey,
} from './optionalProperties';

/**
 * What a change to the tree *would* write, worked out without touching anything.
 * Applying an `ItemWrite` is `storage/frontmatter.ts`'s job; deciding what should
 * be in one is this module's, which is why every function here is pure and every
 * ordering rule is testable without a vault.
 */

/** Spacing between freshly assigned order values, leaving room to drop items in between. */
export const ORDER_SPACING = 10;
/** Below this gap between neighbors, sibling orders get renumbered instead of subdivided. */
const MIN_GAP = 0.002;

/** A pending frontmatter update for a single file. Fields left undefined are not touched. */
export interface ItemWrite {
	file: TFile;
	/** New parent note, or null to make the item top-level (pinned in folder mode). */
	parent?: TFile | null;
	/**
	 * Remove the parent property entirely — in folder mode this hands the item
	 * back to folder-note inference instead of pinning it to the top level.
	 */
	removeParentKey?: boolean;
	order?: number;
	typeName?: string;
	/** New value for the state property; ignored when no state property is configured. */
	state?: string;
	/**
	 * Remove the state property entirely — the no-state column's drop. The mirror of
	 * `removeParentKey`: absence is a value here, never written as an empty string.
	 */
	removeStateKey?: boolean;
	/** New value for the Deliverable workflow's own state property. */
	deliverableState?: string;
	/** Remove the Deliverable state property entirely — its no-state column's drop. */
	removeDeliverableStateKey?: boolean;
	/** The test workflow's own state to set; absent means leave it alone. */
	testState?: string;
	/** Remove the test workflow's state key entirely — absence is what untriaged means. */
	removeTestStateKey?: boolean;
	/**
	 * Tags to add and remove (without '#'). A delta rather than the new list,
	 * because the row it came from can be a refresh behind the note: two removals
	 * in a row would otherwise both compute from the same stale list, and the
	 * second would put the first tag back.
	 */
	tags?: TagDelta;
	/**
	 * Date to stamp as the start, written ONLY if the property is empty. Write-once
	 * is the rule, not a caller's option: the earliest start has to survive rework,
	 * or the measure reports the last restart rather than the age of the work. The
	 * emptiness test belongs to the writer for the same reason the tag delta does —
	 * it is the live value that decides, and the row that planned this can be a
	 * refresh behind the note.
	 */
	startedDate?: string;
	/**
	 * The finish stamp for a write that MAY cross the done boundary: the date to
	 * stamp, and whether the state being written counts as done. Which way it crosses
	 * — or whether it crosses at all — is decided at the WRITE boundary against the
	 * live state, for the same reason the start's write-once test is: the row that
	 * planned this can be a refresh behind the note. Deciding here from the model's
	 * idea of the old state leaves a note that is already done, moved to a not-done
	 * state, still carrying the finish it no longer has.
	 */
	finish?: { date: string; toDone: boolean };
	/** The roadmap's placement properties; fields left out are not touched. */
	axis?: AxisWrite;
	/**
	 * The item's risk level, or **null to remove the key**. Absence is a value here as
	 * it is on both roadmap axes: a note with no risk property has not been judged, which
	 * is a different fact from any level it could carry — so clearing deletes the key
	 * rather than blanking it, and a blank would read as a level named nothing.
	 */
	risk?: string | null;
	/**
	 * The item's priority, or **null to remove the key** — the risk field's rule and its
	 * reason: nobody has ranked it is a fact, and a blank would read as a rung named
	 * nothing.
	 */
	priority?: string | null;
	/**
	 * Who the item is assigned to, or **null to remove the key** — the risk field's rule,
	 * for the same reason: nobody assigned is a fact about the item, and a blank name
	 * would read as someone called nothing.
	 */
	assignee?: string | null;
	/**
	 * Optional properties to CREATE, empty, where the note does not carry them — the
	 * backfill's whole vocabulary for "this feature needs a property and the note has
	 * none". Named by field rather than by key, like every other write here, so the
	 * writer resolves them and the rule that no key without a property behind it is
	 * ever written stays a property of the boundary.
	 *
	 * A stub is not a value: the note gains an editable, empty property and keeps the
	 * state, horizon and dates it had — which is none — so nothing moves.
	 */
	stubs?: OptionalField[];
	/** Prerequisites to add and remove. Ignored when no depends-on property is configured. */
	dependsOn?: DependsOnDelta;
}

export interface TagDelta {
	add?: string[];
	remove?: string[];
}

/**
 * A change to one note's prerequisite list — a DELTA, for the same reason `TagDelta` is
 * one and not a computed list: the menu row that planned it can be a refresh behind the
 * note, and two removals each computed from one stale list would put the first entry back.
 *
 * `add` is a link to write; `remove` names lines to drop rather than values to match, and
 * that difference is the whole of why this is not `TagDelta`:
 *
 * - `removePath` drops every live entry RESOLVING to that note — `[A, A]`, or `[[A]]`
 *   beside a bare `A`, are one dependency on screen and must go in one action.
 * - `removeRaw` drops every live entry whose text matches exactly. It is the only handle
 *   an entry that resolves to nothing has, and it is how a broken line is cleared.
 * - `removeKey` drops the property outright, which is what a list holding nothing
 *   nameable offers instead of a line.
 */
export interface DependsOnDelta {
	add?: TFile;
	removePath?: string;
	removeRaw?: string;
	removeKey?: boolean;
}

/**
 * A write to the roadmap's placement keys: the value to store, or **null to remove
 * the key**. Absence is a value on both axes — an item with no horizon is untriaged
 * and one with no dates is unscheduled — so removal is a first-class write here
 * rather than an empty string, exactly as `removeParentKey` is for the hierarchy. A
 * blank value would render as a bucket named nothing.
 *
 * The empty string is used once and deliberately, by the backfill: creating the key
 * without placing anything is the one thing that operation can honestly do.
 */
export interface AxisWrite {
	horizon?: string | null;
	start?: string | null;
	target?: string | null;

	/**
	 * The placement shape this plan was made under — which ends the item HAD when the
	 * plan was made. The writer compares it against the live one and refuses the batch
	 * where they disagree, because dates alone cannot say: a marker that became an
	 * ordinary item leaves a target-only request arriving at an ordinary item, which is
	 * exactly what a legitimate end-grip write looks like. A write states its
	 * expectation and the writer is where the expectation is checked — the same
	 * discipline as the restore's compare-and-swap. Absent on a horizon write, which
	 * has no shape to disagree about.
	 */
	ends?: PlacementEnd[];

	/**
	 * The dates this plan was computed FROM, for a gesture that is relative. A slide and
	 * an end drag mean "one day further than where this was", and the plan turns that
	 * into an absolute date using the span the render showed — so if another editor moved
	 * that end from the 10th to the 12th mid-drag, submitting the 11th walks their change
	 * backwards. The writer compares each stated expectation against the live value and
	 * refuses the batch whole where they differ, exactly as it does for `ends`.
	 *
	 * Refused rather than rebased onto the new value: "the preview is the contract, and
	 * release writes exactly the dates it showed" — rebasing would write the 13th, which
	 * is a date the preview never named. Nothing is written, the bar redraws where the
	 * note now says, and the next gesture is made against that.
	 *
	 * Absent where the gesture is absolute — a shelf drop, the date prompt — because
	 * those mean a date rather than a displacement and have no base to be stale.
	 */
	from?: Partial<Record<PlacementEnd, string | null>>;
}

/**
 * Compute the frontmatter writes for dropping `dragged` at the given target position.
 * Uses the gap between neighbor orders when possible; falls back to renumbering
 * the whole sibling group when orders are missing or too tightly packed.
 */
export function computeDropWrites(dragged: BacklogItem, target: DropTarget): ItemWrite[] {
	const { parent, siblings, insertIndex } = target;
	const parentField = computeParentField(dragged, parent);

	const order = computeInsertOrder(siblings, insertIndex);
	if (order !== null) {
		return [{ file: dragged.file, parent: parentField, order }];
	}
	// Renumbering rewrites every sibling, and the view never writes to a note the
	// Base excluded. Placing the item past the highest order we can see keeps the
	// drop working while touching only the note being moved. Callers refuse the
	// *positional* drops in such a group, so landing last is what was asked for.
	if (siblings.some((s) => s.outsideFilter)) {
		return [{ file: dragged.file, parent: parentField, order: afterHighestKnown(siblings) }];
	}
	return renumberWrites(dragged, siblings, insertIndex, parentField);
}

/** One spacing beyond the highest order in the group, ignoring siblings that have none. */
function afterHighestKnown(siblings: BacklogItem[]): number {
	let max = 0;
	for (const sibling of siblings) {
		if (sibling.order !== null && sibling.order > max) max = sibling.order;
	}
	return Math.floor(max) + ORDER_SPACING;
}

/** The parent frontmatter update, or undefined when the parent is unchanged. */
function computeParentField(dragged: BacklogItem, parent: BacklogItem | null): TFile | null | undefined {
	const oldParentPath = dragged.parent?.file.path ?? null;
	const newParentPath = parent?.file.path ?? null;
	// An item whose parent link points outside the view renders as a root while the
	// stale property is still set; placing it at the top level must clear that link,
	// otherwise it would re-nest as soon as the linked note enters the filter.
	const staleRootLink = parent === null && dragged.parent === null && dragged.hasParentValue;
	const parentChanged = oldParentPath !== newParentPath || staleRootLink;
	return parentChanged ? (parent ? parent.file : null) : undefined;
}

/**
 * Everything ONE state change writes: the target column's canonical value, byte for
 * byte — nothing transforms it on the way to disk — plus the date stamps that ride
 * it. Setting the state the item already holds (case-insensitively, the same matching
 * that placed it in its column) plans nothing, so the batch that follows cannot cost
 * the caller's undo slot; the no-state target removes the key rather than writing an
 * empty string.
 *
 * Every input that changes a state comes through here — a drop, Alt+arrow, both Set
 * state menus — because a stamp that rode only some of them would record a history
 * with holes in it, and which hole would depend on how the user happened to move the
 * card. `today` is passed in rather than read here so the planning stays pure.
 */
export function computeStateWrites(
	item: BacklogItem,
	state: string | null,
	settings: BacklogSettings,
	today: string,
): ItemWrite[] {
	if (sameValue(item.stateValue, state)) return [];
	const write: ItemWrite = state === null ? { file: item.file, removeStateKey: true } : { file: item.file, state };
	return [{ ...write, ...stampWrites(state, settings, today) }];
}

/**
 * Everything ONE Deliverable-workflow state change writes: the target column's
 * canonical value, or key removal for the no-state target. No stamp logic — the
 * Deliverables board carries no started/finished date stamps (Scope).
 */
export function computeDeliverableStateWrites(item: BacklogItem, state: string | null): ItemWrite[] {
	if (sameValue(item.deliverableStateValue, state)) return [];
	return [
		state === null ? { file: item.file, removeDeliverableStateKey: true } : { file: item.file, deliverableState: state },
	];
}

/**
 * Everything ONE test-workflow state change writes. No stamp logic, for the reason the
 * Deliverable's has none and one more here: this epic records no results, so a case's state
 * is what it IS rather than when it ran, and a started/finished date would be a claim about
 * a run.
 */
export function computeTestStateWrites(item: BacklogItem, state: string | null): ItemWrite[] {
	if (sameValue(item.testStateValue, state)) return [];
	return [state === null ? { file: item.file, removeTestStateKey: true } : { file: item.file, testState: state }];
}

/**
 * The dates a state change stamps, as fields of the same write — one file, one
 * `processFrontMatter` call, so one undo takes the state and its dates back together.
 * A stamp is never a second write.
 */
function stampWrites(
	to: string | null,
	settings: BacklogSettings,
	today: string,
): Pick<ItemWrite, 'startedDate' | 'finish'> {
	const stamps: Pick<ItemWrite, 'startedDate' | 'finish'> = {};
	// Entering a started state offers the date; the writer keeps the earliest one. The
	// state being entered is what the user just picked, so it is never stale — unlike
	// the one being left, which is why only this half is decided here.
	if (settings.startedDateKey && isStartedValue(settings, to)) stamps.startedDate = today;
	// Both halves of the finish rule need the state being LEFT, and only the note
	// knows that for certain: whether this crosses in (stamp), crosses out (clear) or
	// is a done-to-done re-label (leave alone) is settled at the write boundary.
	if (settings.finishedDateKey) stamps.finish = { date: today, toDone: isDoneValue(settings, to) };
	return stamps;
}

/**
 * The write a horizon pick means: the chosen value into the note's own horizon
 * property, or its removal. Re-picking the value the item already holds plans
 * nothing — matched case-insensitively, the same matching that placed it in its
 * bucket — so a no-op cannot cost the caller's one undo.
 */
export function computeHorizonWrites(item: BacklogItem, value: string | null): ItemWrite[] {
	if (value === null) {
		// Nothing to take away: an item with no horizon key is already untriaged, and
		// a removal write there would consume an undo slot for a change nobody made.
		return item.ownKeys.horizon ? [{ file: item.file, axis: { horizon: null } }] : [];
	}
	if (sameValue(item.horizon.value, value)) return [];
	return [{ file: item.file, axis: { horizon: value } }];
}

/**
 * The write a risk pick means, by the horizon pick's two rules exactly: re-picking the
 * level the item already holds plans nothing — through `sameValue`, so the menu's
 * checkmark and this plan answer one question rather than two that must agree — and a
 * removal is offered only where there is a key to take away.
 *
 * Presence, not value, decides the removal (`ownKeys`), which is what makes the empty
 * stub the backfill leaves a real thing to clear rather than something already absent.
 */
export function computeRiskWrites(item: BacklogItem, value: string | null): ItemWrite[] {
	if (value === null) return item.ownKeys.risk ? [{ file: item.file, risk: null }] : [];
	if (sameValue(item.riskValue, value)) return [];
	return [{ file: item.file, risk: value }];
}

/**
 * The write a priority pick means — `computeRiskWrites`' two rules over the other declared
 * ladder, and the same reason they are two functions rather than one parameterised by
 * field: each reads its own `item` field by name, and a table lookup would trade three
 * legible lines for an indirection the compiler could no longer check as exhaustively.
 */
export function computePriorityWrites(item: BacklogItem, value: string | null): ItemWrite[] {
	if (value === null) return item.ownKeys.priority ? [{ file: item.file, priority: null }] : [];
	if (sameValue(item.priorityValue, value)) return [];
	return [{ file: item.file, priority: value }];
}

/**
 * The write an assignee pick means — `computeRiskWrites`' two rules, over the one field
 * whose vocabulary is observed rather than declared. That difference is entirely upstream:
 * what a menu may OFFER is a question about the base's results, while what a pick WRITES
 * is a question about this note, and the second one does not change because the first
 * has no configured list behind it.
 */
export function computeAssigneeWrites(item: BacklogItem, value: string | null): ItemWrite[] {
	if (value === null) return item.ownKeys.assignee ? [{ file: item.file, assignee: null }] : [];
	if (sameValue(item.assigneeValue, value)) return [];
	return [{ file: item.file, assignee: value }];
}

/**
 * A move on the resources axis, where a release answers TWO questions at once: which row
 * it landed in, and which day. Both halves are the existing planners' — this function
 * adds no rule of its own about either — and what it does is put them on ONE `ItemWrite`,
 * which is the whole point rather than an optimization.
 *
 * One record, because a gesture is one thing to take back. Two records naming the same
 * file would apply as two writes and capture two inverses, so an undo would return the
 * row and leave the dates, or the reverse — a state the user's single gesture cannot
 * describe and cannot reach again. It also makes "the row moved but the dates did not"
 * unreachable under a refusal: the gate refuses a batch whole, and this batch is one
 * write.
 *
 * Either half may be empty, and both routinely are: a vertical drag plans no dates, a
 * slide inside one row plans no assignee, and a gesture that expressed neither plans
 * nothing at all — which is what keeps the undo slot for the move before it.
 */
export function computeResourceMoveWrites(
	item: BacklogItem,
	name: string | null,
	schedule: ScheduleGesture | null,
): ItemWrite[] {
	const who = computeAssigneeWrites(item, name);
	const when = schedule ? computeScheduleWrites(item, schedule.plan, schedule.ends, schedule.from) : [];
	if (who.length === 0 && when.length === 0) return [];
	// Spread rather than assigned field by field: each planner owns which of its own
	// fields it names, and a list here would be a second statement of that going stale
	// the next time either grows one.
	return [{ ...(who[0] ?? { file: item.file }), ...(when[0] ?? {}) }];
}

/** What a schedule entry asks for: a date per end, null to unschedule that end. */
export interface SchedulePlan {
	start?: string | null;
	target?: string | null;
}

/**
 * A date gesture, whole — what it asks for plus the two expectations it was made under.
 * One object because the three travel together and always have: `performScheduleMove`
 * takes them as three parameters and has to say in a paragraph that neither of the last
 * two may be recomputed from the item. A caller that carries the group cannot drop half
 * of it, which is the failure that paragraph is guarding against.
 *
 * `ends` is the placement SHAPE the gesture was planned under and `from` the dates it was
 * measured from — both checked by the writer against what the note now holds, so a type
 * or a date that changed mid-drag refuses the batch rather than walking a concurrent edit
 * backwards. `from` is absent where the gesture is absolute and had no base to be stale.
 */
export interface ScheduleGesture {
	plan: SchedulePlan;
	ends: PlacementEnd[];
	from?: Partial<Record<PlacementEnd, string | null>>;
}

/**
 * The batch a schedule (or unschedule) means: one write naming the ends the plan
 * names. Both ends ride the SAME `ItemWrite`, so a span is one undo rather than two
 * halves of one that can be taken back separately.
 *
 * It decides nothing from the model, in either direction — not whether a date is
 * already stated, not whether a key is there to remove. Both are questions about what
 * the note holds RIGHT NOW, and the row that planned this can be a refresh behind it,
 * so both are the writer's (`storage/frontmatter.ts`). What this function does is
 * state what was asked for, plus the expectations it was asked under — the placement
 * shape, and for a relative gesture the dates it was measured from — so the writer can
 * check them against what the note actually holds.
 *
 * It stays type-agnostic deliberately: WHICH ends a plan may name is `placementEnds`
 * in `domain/itemTypes.ts`, asked by the caller. Pushing the narrowing in here would
 * put one type rule in two places.
 */
export function computeScheduleWrites(
	item: BacklogItem,
	plan: SchedulePlan,
	ends: PlacementEnd[],
	from?: Partial<Record<PlacementEnd, string | null>>,
): ItemWrite[] {
	const axis: AxisWrite = { ends, ...(from ? { from } : {}) };
	let planned = false;
	for (const field of ends) {
		const requested = plan[field];
		if (requested === undefined) continue;
		// The one backstop that stays: no date is ever guessed at, wherever the value
		// arrived from. It is a question about the REQUEST, not about the note.
		if (requested !== null && readDate(requested).value === null) continue;
		axis[field] = requested;
		planned = true;
	}
	return planned ? [{ file: item.file, axis }] : [];
}

/** The order value for the insertion slot, or null when the group needs renumbering. */
function computeInsertOrder(siblings: BacklogItem[], insertIndex: number): number | null {
	const prev = insertIndex > 0 ? siblings[insertIndex - 1] : null;
	const next = insertIndex < siblings.length ? siblings[insertIndex] : null;
	if (!prev && !next) return ORDER_SPACING;
	if (prev && next) return orderBetween(prev.order, next.order);
	if (prev) return prev.order !== null ? Math.floor(prev.order) + ORDER_SPACING : null;
	return next !== null && next.order !== null ? roundOrder(Math.ceil(next.order) - ORDER_SPACING) : null;
}

/** Halfway between two ordered neighbors; null when a value is missing or the gap is spent. */
function orderBetween(prevOrder: number | null, nextOrder: number | null): number | null {
	if (prevOrder === null || nextOrder === null) return null;
	if (nextOrder - prevOrder <= MIN_GAP) return null;
	return roundOrder(prevOrder + (nextOrder - prevOrder) / 2);
}

/** Renumber the whole sibling group, including the dragged item at its new position. */
function renumberWrites(
	dragged: BacklogItem,
	siblings: BacklogItem[],
	insertIndex: number,
	parentField: TFile | null | undefined,
): ItemWrite[] {
	const sequence = [...siblings];
	sequence.splice(insertIndex, 0, dragged);
	const writes: ItemWrite[] = [];
	sequence.forEach((item, i) => {
		const slot = (i + 1) * ORDER_SPACING;
		if (item === dragged) {
			writes.push({ file: item.file, parent: parentField, order: slot });
		} else if (item.order !== slot) {
			writes.push({ file: item.file, order: slot });
		}
	});
	return writes;
}

/**
 * The configured optional keys this note does not carry. Creating the key empty is
 * the whole of what a backfill can honestly do for these: the property becomes
 * visible and editable in Obsidian's own property editor, while the item keeps the
 * state, the horizon and the dates it had — none — so pressing the button moves
 * nothing on the board or the roadmap, the same promise it already makes about the
 * tree. Writing a state or a placement instead would invent a plan, which on a
 * roadmap is indistinguishable from a decision.
 */

/** Each workflow-state field's own resolved key — `state`'s never falls back to be one. */
const WORKFLOW_STATE_KEY: Partial<Record<OptionalField, (settings: BacklogSettings) => string>> = {
	state: (settings) => settings.stateKey,
	deliverableState: resolvedDeliverableStateKey,
	testState: resolvedTestStateKey,
};

function missingKeyStubs(item: BacklogItem, settings: BacklogSettings): OptionalField[] {
	const stubs: OptionalField[] = [];
	for (const field of OPTIONAL_FIELDS) {
		// A workflow-state field is stubbed only when its own resolved key IS the key
		// `stateKeyFor` says THIS item's workflow reads — asked by KEY EQUALITY, not by
		// re-deriving the item's category, so a secondary key left unset (falling back to
		// `settings.stateKey`, the shipped default) still gets `state` stubbed rather than
		// skipped. Two fields legitimately CAN resolve to one key — `configProblems` exempts
		// exactly these three labels from its collision report — and both then pass; that is
		// harmless rather than narrowed further, because two mechanisms downstream turn the
		// duplicate names into one property created once. `applyInto`
		// (`src/storage/frontmatter.ts`) creates a key only while the live note lacks it, and
		// `touchedKeys` (`src/storage/writeKeys.ts`) dedupes the key list the inverse is
		// captured from, so the undo cannot read the second copy as a restore conflict.
		// `stubKeys` does NEITHER — it names one raw key per field, duplicates included.
		const ownKey = WORKFLOW_STATE_KEY[field];
		if (ownKey && ownKey(settings) !== stateKeyFor(settings, item)) continue;
		// A named horizon property with no values is an UNCONFIGURED bucket axis — the
		// axis the roadmap declines to draw and the menu declines to set. Creating its
		// key here would be the one write left on an axis nothing else acknowledges,
		// which is the incoherence `hasHorizonAxis` exists to prevent. The other fields
		// need no such test: a key of '' is exactly what unconfigured means for them.
		if (field === 'horizon' && !hasHorizonAxis(settings)) continue;
		// Prerequisites are never stubbed, and this is a second early return rather than
		// a widening of the one above: the reason is its own. An empty state or an empty
		// date is a slot on this note the user is invited to fill; an empty prerequisite
		// list is a claim about a RELATIONSHIP that does not exist, made on every note at
		// once. It is also exactly the state `Linking two items` requires a removal never
		// to leave behind, so backfilling one would have ✨ create what a remove must
		// clean up.
		if (field === 'dependsOn') continue;
		if (optionalKeyFor(settings, field) === '' || item.ownKeys[field]) continue;
		stubs.push(field);
	}
	return stubs;
}

/**
 * The gaps in one item's properties, or null when it has none. `nextOrder` is asked
 * only when the rank is the gap, so an item that needs no order does not consume a
 * slot in its sibling group.
 */
function initWriteFor(item: BacklogItem, settings: BacklogSettings, nextOrder: () => number): ItemWrite | null {
	const write: ItemWrite = { file: item.file };
	let needed = false;
	if (item.order === null) {
		write.order = nextOrder();
		needed = true;
	}
	// An unresolved parent link means the item's real level is unknowable — don't
	// write a type derived from its provisional top-level position.
	const levelUnknown = item.parent === null && item.hasParentValue;
	if (item.typeName === null && !levelUnknown) {
		// The item's OWN ladder, which for a typeless note is the one it chains from its
		// parent. This is the half of the implied type that cannot be undone by looking
		// away: left on `LEVELS`, a typeless child of a `Test suite` would be badged a
		// `Feature` and then have `Feature` WRITTEN to it, moving the note out of the
		// catalog and into the plan — permanently, and without anyone asking.
		write.typeName = item.ladder[childLevelIndex(item.parent, item.ladder)];
		needed = true;
	}
	const stubs = missingKeyStubs(item, settings);
	if (stubs.length > 0) {
		write.stubs = stubs;
		needed = true;
	}
	return needed ? write : null;
}

/**
 * Fill in missing order, type and optional properties across the whole hierarchy
 * without touching values that already exist. Walks the real tree, so a focused view
 * still backfills hidden ancestors and branches outside the focus level.
 */
export function computeInitWrites(model: BacklogModel, settings: BacklogSettings): ItemWrite[] {
	const writes: ItemWrite[] = [];
	const visit = (siblings: BacklogItem[]) => {
		// Deliberately reads context siblings' orders too. They are *rendered*, so a
		// rank that ignored them would place a backfilled item above a row the user
		// can see — a backfill that fills in blanks must not reorder the tree. Not
		// writing to them is the rule; not looking at them would break this. The drop
		// and creation paths (afterHighestKnown, endOfSiblingsOrder) do the same.
		let maxOrder = 0;
		for (const item of siblings) {
			if (item.order !== null && item.order > maxOrder) maxOrder = item.order;
		}
		for (const item of siblings) {
			// Ancestors pulled in from outside the filter are context, not results —
			// the backfill must not write properties into notes the base excluded.
			if (item.outsideFilter) {
				visit(item.children);
				continue;
			}
			const write = initWriteFor(item, settings, () => (maxOrder = Math.floor(maxOrder) + ORDER_SPACING));
			if (write) writes.push(write);
			visit(item.children);
		}
	};
	visit(model.realRoots);
	return writes;
}


/** Orders are fractional ranks; four decimals is well past the gap that triggers renumbering. */
function roundOrder(value: number): number {
	return Math.round(value * 10000) / 10000;
}
