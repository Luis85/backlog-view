import { TFile } from 'obsidian';
import { DropTarget } from './dropTargets';
import { BacklogItem, BacklogModel } from './model';
import { childLevelIndex, isReleaseType, mayHoldField, PlacementEnd, schemaEnds } from './itemTypes';
import { statedEnds } from './bars';
import { readDate, sameValue } from './noteFields';
import { daysBetween, formatCivil } from './timeline';
import { hasHorizonAxis } from './roadmap';
import { stateKeyFor } from './board';
import { focusKey } from './rankOrder';
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
export const ORDER_SPACING = 1000;
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
	 * Who the item is assigned to — a FILE, never a serialized string, and **null to
	 * remove the key**. The writer spells the link itself, path-aware like the parent's,
	 * the iteration's and the release's (`wikilinkTo`), because a link built from a
	 * basename here would resolve to whichever of two same-named `Resource` notes
	 * Obsidian picks. `undefined` leaves the key alone.
	 */
	assignee?: TFile | null;
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
	/**
	 * The iteration this item belongs to — a FILE, never a serialized string, and
	 * **null to remove the key**. The writer spells the link itself, path-aware like the
	 * parent's (`wikilinkTo`), because a link built from a basename here would resolve to
	 * whichever of two same-named notes Obsidian picks. `undefined` leaves the key alone.
	 */
	iteration?: TFile | null;
	/**
	 * What an iteration is FOR, in one line, or **null to remove the key**. A plain
	 * string on the Iteration note — `risk`'s rule exactly, so it is written through the
	 * same label list in `storage/frontmatter.ts` rather than a function of its own. The
	 * assignee shared that list too until 2026-08-28, when it became a link and joined
	 * `iteration`/`release` in `applyLinks` instead. `undefined` leaves the key alone.
	 */
	iterationGoal?: string | null;
	/**
	 * The release this item ships in — a FILE, never a serialized string, and
	 * **null to remove the key**. The writer spells the link itself, path-aware like the
	 * parent's and the iteration's (`wikilinkTo`). `undefined` leaves the key alone.
	 */
	release?: TFile | null;
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
 * The parent frontmatter update, or undefined when the parent is unchanged.
 *
 * `target.parentUnchanged` is asked FIRST and short-circuits everything below it — a
 * focus rank restates `dragged`'s own current parent rather than deciding one, and when
 * that parent is `null` (an unresolved link) it is otherwise indistinguishable from an
 * EXPLICIT top-level placement, which is the one case the stale-link clearing below
 * exists for. Without this check a focused reorder of a row with an unresolved parent
 * link would delete the property on every move: `parent === null`, `dragged.parent ===
 * null` and `dragged.hasParentValue` all read exactly as they do for a genuine drop onto
 * the root group, and the two cannot be told apart from the values alone.
 */
function computeParentField(dragged: BacklogItem, target: DropTarget): TFile | null | undefined {
	if (target.parentUnchanged) return undefined;
	const parent = target.parent;
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
	// A `RELEASE` is placed on no axis of the backlog roadmap, so nothing may write it one
	// — and this is the site every input lands on, the drag, the key and both menus alike,
	// so the refusal is stated once here rather than at each of them. The horizon key is
	// the BACKLOG view's own mapping; a release's placement belongs to
	// [[A release on the dated axis]] and to the key it has not been given yet. The offer
	// is withheld to match (`canPlaceHorizon`), because a menu whose every entry plans
	// nothing would read as every bucket checked at once.
	if (isReleaseType(item.typeName)) return [];
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
 * The write an assignee pick means — `computeIterationWrites`' two rules over the one
 * link property that is a PERSON. Compared by PATH, never by the raw text: two spellings
 * of one note are one resource, and a link that resolved to nothing has no path and is
 * therefore never "already there" for any target.
 *
 * A removal is asked of PRESENCE (`ownKeys`), never of the parsed entry, for
 * `computeIterationWrites`' stated reason: a hand-edited `assignee: ''` reads as no entry
 * while the key still visibly holds something, and asking the entry would tick Clear on a
 * note the reader can see is not empty.
 */
export function computeAssigneeWrites(item: BacklogItem, target: TFile | null): ItemWrite[] {
	if (target === null) return item.ownKeys.assignee ? [{ file: item.file, assignee: null }] : [];
	if (item.assigneeEntry?.file?.path === target.path) return [];
	return [{ file: item.file, assignee: target }];
}

/**
 * Everything ONE iteration change writes: the link, and the timeframe that comes with
 * it — joining a sprint is joining its dates.
 *
 * `target` is the iteration's ITEM, not its `TFile`: the write takes `.file` for the
 * link, but the dates are the iteration's own `start` and `target` READINGS, which live
 * on `BacklogItem` because that is where `readItems.ts` parses them — a `TFile` is a path
 * and a name and nothing else. This module is pure domain, so it cannot look either up
 * itself; the caller already holds the item, because the menu that calls this built its
 * entries from the model.
 *
 * **One write on one file, not three.** The dates ride the same `ItemWrite` as the link,
 * through the `AxisWrite` that already keeps the two rules they need — an unconfigured key
 * is dropped and a null deletes (`axisEntries` in `storage/writeKeys.ts`, already captured
 * for undo) — so the link and the schedule apply and undo together. Two records naming one
 * file would capture two inverses, and an undo could then return the link and keep the
 * dates: a state the single pick cannot describe.
 *
 * An unconfigured iteration key plans nothing — absence is a value.
 *
 * Emptiness still means "this pick would change nothing", so a fully-agreeing re-pick
 * returns `[]` rather than a write the applier happens to no-op. What the MENU asks of
 * this output is narrower now — see `addIterationItems`.
 */
export function computeIterationWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[] {
	if (!settings.iterationKey) return [];
	// A None pick is asked of PRESENCE (`ownKeys`), never of the PARSED entry — the same
	// split `computeAssigneeWrites`/`computeRiskWrites` make. `readLinkList` refuses a
	// non-string or an empty value outright, so a hand-edited `iteration: ''` or
	// `iteration: 12` reads as `iterationEntry === null` while the key still visibly
	// holds something on the note; asking the parsed entry here would tick the menu's
	// None checkmark on a note the reader can see is not empty, and picking it would
	// then write nothing. `ownKeys.iteration` answers "is there a key to remove", which
	// is the question a removal is actually asking.
	//
	// It plans the removal and NOTHING ELSE: leaving a sprint is not a reschedule, so the
	// item keeps whatever plan it had. Deleting two date keys on the way out is a decision
	// nobody made.
	if (target === null) return item.ownKeys.iteration ? [{ file: item.file, iteration: null }] : [];
	// Compared by PATH, never by the raw text: two spellings of one note are one
	// iteration. A link that resolved to nothing has no path and is therefore never
	// "already there" for any target.
	const linkChanges = item.iterationEntry?.file?.path !== target.file.path;
	// **This axis write states no `ends`, deliberately — so the writer's reversed-span
	// guard does not run on it.** `refusesAxis` (`storage/frontmatter.ts`) returns false
	// outright without them, which means joining a START-ONLY iteration can leave
	// `start > target` on the note, and the roadmap then shelves that card as a reversed
	// span. That outcome is the accepted one, not a missed guard:
	//
	// - REFUSING the batch would contradict the rule above it — the iteration's dates
	//   overwrite whatever the item held — and would make a legitimate join fail because
	//   of a date the join is not touching.
	// - ADJUSTING the item's target to make the pair coherent is exactly the decision the
	//   `undefined`-never-`null` rule exists to forbid: the sprint states no target, so
	//   nothing here knows what the item's should become.
	//
	// An item whose dates have become incoherent should be VISIBLE as incoherent, and the
	// shelf with its reason is how this view already says so. `ends` belongs to a gesture
	// that grips an end and can be made stale by a type change mid-drag; this is a pick on
	// a row `canSetIteration` has already refused for a marker, so there is no shape to
	// disagree about either.
	const axis = timeframeOf(item, target);
	if (!linkChanges && axis === undefined) return [];
	return [{ file: item.file, ...(linkChanges ? { iteration: target.file } : {}), ...(axis ? { axis } : {}) }];
}

/**
 * One item's release membership, planned.
 *
 * An unconfigured key plans nothing — absence is a value.
 *
 * Emptiness means "this pick would change nothing", because the MENU's checkmark is asked
 * of this output. A re-pick that agrees returns `[]` rather than a write the applier
 * happens to no-op, which would spend the undo slot on nothing.
 *
 * **No `timeframeOf`, deliberately** — unlike joining an iteration, joining a release
 * copies nothing else onto the item: not its parent, not its order, not its state, and no
 * dates. The plan writes the membership key and nothing beside it.
 */
export function computeReleaseWrites(item: BacklogItem, target: BacklogItem | null, settings: BacklogSettings): ItemWrite[] {
	if (!settings.releaseKey) return [];
	// A None pick is asked of PRESENCE (`ownKeys`), never of the PARSED entry — the split
	// `computeIterationWrites` states above. A hand-edited `release: ''` reads as no entry
	// while the key still visibly holds something, so asking the entry would tick the None
	// checkmark on a note the reader can see is not empty.
	if (target === null) return item.ownKeys.release ? [{ file: item.file, release: null }] : [];
	// By PATH, never by the raw text: two spellings of one note are one release, and a
	// link that resolved to nothing has no path and is therefore never "already there".
	//
	// **And by CARDINALITY beside it**, which `releaseEntry` alone cannot answer: it is the
	// FIRST entry, so a hand-written `release: [R, E]` reads as R while `membershipTarget`
	// (`releases.ts`) refuses the pair outright — the release view calling the note
	// unresolved while this plan called a pick of R a no-op, which ticked R as current and
	// left the note unrepairable from the menu. That is the two-ends disagreement
	// [[Setting an item's release]] 1f forbids. A pick writes nothing only where the note
	// already names EXACTLY ONE release and it is the target; every other shape is rewritten
	// to the one value a membership is.
	const settled = !item.releaseMultiple && item.releaseEntry?.file?.path === target.file.path;
	return settled ? [] : [{ file: item.file, release: target.file }];
}

/**
 * The join a PULL plans: the same link-and-timeframe write above, for the note a board
 * scope names — and nothing at all where there is nothing to join.
 *
 * It exists so the caller holds no `byPath` lookup of its own. A view resolving the scope
 * before planning would carry two "cannot happen" arms (no model, no scope) that nothing
 * on screen can reach and no test can drive honestly; here both are arguments, and the
 * three refusals are one function a domain test drives in every direction.
 *
 * Nothing to join, in order: the board is on no iteration scope (`scope === null`, the
 * product and Deliverables boards), no model has been built yet, the scope names a note
 * the model does not hold, or the item is already in that iteration — which is asked by
 * PATH, so two spellings of one link are one iteration, exactly as `inIteration` asks it.
 * The last one is what makes an ordinary bucket move plan no join.
 */
export function computeIterationJoinWrites(
	item: BacklogItem,
	model: BacklogModel | null,
	scope: string | null,
	settings: BacklogSettings,
): ItemWrite[] {
	const target = scope === null ? undefined : model?.byPath.get(scope);
	if (target === undefined || item.iterationEntry?.file?.path === target.file.path) return [];
	return computeIterationWrites(item, target, settings);
}

/**
 * Editing the iteration NOTE itself: its two dates and its goal, in one batch on one file.
 *
 * **It re-stamps no member.** An iteration's dates are copied onto an item when it JOINS
 * (`computeIterationWrites`), and that is a commitment made at that moment — a cascade
 * here would silently reschedule work somebody had since moved, on a screen showing none
 * of it. The batch names one file, and `test/view/iterationDialog.test.ts` asserts the
 * count rather than the contents, because a cascade would still produce a correct-looking
 * batch for the note itself.
 *
 * A `null` goal REMOVES the key, which is the edit path's own case: clearing a goal that
 * was set is exactly what extension 3a says removing the key means. The create path has
 * no use for that distinction and passes `undefined`.
 */
export function computeIterationNoteWrites(
	item: BacklogItem,
	edit: { axis: AxisWrite; goal: string | null | undefined },
): ItemWrite[] {
	const write: ItemWrite = { file: item.file };
	// Absence is a value here as everywhere: an unconfigured key is dropped by
	// `axisEntries` and by `applyLabels`, so this states what was CONFIRMED and lets the
	// writer decide what it may put on disk.
	if (edit.axis.start !== undefined || edit.axis.target !== undefined) write.axis = edit.axis;
	if (edit.goal !== undefined) write.iterationGoal = edit.goal;
	return [write];
}

/**
 * The iteration's timeframe as the ends this write has to state, or undefined where it
 * has to state none. Three rules, and each is a separate decision:
 *
 * - The iteration's dates OVERWRITE the item's. No merge and no fill-only-what-is-empty:
 *   a sprint's dates are the item's dates once it is in the sprint, so a card committed
 *   to a band must not keep the one it came from.
 * - An end the ITERATION does not carry is left alone — `undefined`, never `null`, which
 *   in an `AxisWrite` is a REMOVAL and would delete the item's own date because the
 *   sprint has none.
 * - An end the item already states is absent from the plan, compared as a CIVIL date the
 *   way every other comparison of these values is: `2026-9-7` and `2026-09-07T09:00` both
 *   spell the day the sprint starts, and rewriting either would spend an undo slot on a
 *   spelling.
 *
 * It asks the READINGS rather than the settings, which is what keeps an unconfigured
 * start or target key out of the plan without a second gate: `readGated` already answers
 * absence for a key no property names, so neither side of the comparison can exist.
 *
 * Which is worth stating plainly, because the caller is handed a `BacklogSettings` and
 * this function applies no gate from it: the readings were built by the model, under the
 * settings the MODEL was built with. Those are the same settings at the one caller —
 * `addIterationItems` passes `host.settings`, the same object `host.model` was built from
 * — and a caller that passed a different one would get a plan gated by the model's keys
 * rather than by the ones it named. There is no such caller, and this paragraph is why
 * one should not be added without a key gate here.
 */
function timeframeOf(item: BacklogItem, target: BacklogItem): AxisWrite | undefined {
	const wanted = statedEnds(target);
	const held = statedEnds(item);
	const axis: AxisWrite = {};
	let planned = false;
	for (const end of ['start', 'target'] as const) {
		const date = wanted[end].value;
		if (date === null) continue;
		const own = held[end].value;
		if (own !== null && daysBetween(date, own) === 0) continue;
		axis[end] = formatCivil(date);
		planned = true;
	}
	return planned ? axis : undefined;
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
	target: TFile | null,
	schedule: ScheduleGesture | null,
): ItemWrite[] {
	const who = computeAssigneeWrites(item, target);
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

/**
 * Why a placement produced no number. Each names its own remedy at the notice, and the
 * three are genuinely different advice: `gapSpent` sends the user to Respace, `unranked`
 * to the backfill, and `tied` to Seed — a tie is the sibling-scoped scheme showing through,
 * the backfill only fills blanks, and respacing a range that holds two equal numbers cannot
 * separate them. `tied` reaches a notice only when the peer fallback fails to answer —
 * refusing itself, or producing a number another row already holds; when it answers a free
 * one, `dropPlacement` returns that rank and nothing is said.
 *
 * **One case where no remedy named here can work**: when the row holding the number is one
 * the Base EXCLUDED, no write path may ever move it, so nothing changes at that site. The
 * refusal is still right — see `rankTaken` for why the alternative is worse — and this
 * refusal cannot tell the two apart from here, because it carries a reason and never a row.
 * What keeps the sentence honest is that the command it names reports its own dead end:
 * Seed and Respace both answer `rank.wedged` over exactly the rows squeezed against a rank
 * this base cannot write, so the user is sent one step further rather than in a circle.
 *
 * `parentGone` is the odd one: no function in this module produces it. A creation's
 * destination is re-resolved by PATH under a modal prompt (`view/interactions/create.ts`),
 * and a parent that has been deleted meanwhile is a placement that refuses for a reason
 * the arithmetic never sees. It is a member here rather than a fourth thing beside
 * `RankResult` so that every caller keeps ONE shape to test and `refusalKey` stays the
 * single place a refusal becomes a sentence.
 */
export type RankRefusal = 'gapSpent' | 'parentGone' | 'tied' | 'unranked';
export type RankResult = { order: number } | { refusal: RankRefusal };

/**
 * The catalog key that names each refusal's remedy. A `switch` and not a ternary, so
 * adding a fifth refusal is a compile error rather than a wrong message: a two-way
 * ternary was still routing everything that was not `gapSpent` to the backfill advice
 * when the third member landed, which would tell a user whose parent had been deleted
 * to initialize their ranks.
 *
 * Keys and not sentences, which is also what keeps this out of `TEXT_TERNARY`'s way:
 * only `t()` reaches the catalog.
 */
export function refusalKey(refusal: RankRefusal): 'rank.gapSpent' | 'rank.parentGone' | 'rank.tied' | 'rank.unranked' {
	switch (refusal) {
		case 'gapSpent':
			return 'rank.gapSpent';
		case 'parentGone':
			return 'rank.parentGone';
		case 'tied':
			return 'rank.tied';
		case 'unranked':
			return 'rank.unranked';
	}
}

/**
 * The rank for a placement, stated ONCE for every placement there is.
 *
 * A placement decides an anchor row and a side; the number comes from the anchor's
 * neighbours in the globally rank-sorted population — never from the peer group, and
 * never from forest traversal. After one cross-parent move DFS preorder is no longer
 * global order, so "the next row in the forest" can hold a LOWER rank than the last
 * peer, and a midpoint of an inverted pair is not a near miss.
 *
 * `ranked` must not contain the item being placed, or it becomes its own neighbour.
 */
export function anchoredOrder(
	ranked: BacklogItem[],
	anchor: BacklogItem | null,
	side: 'before' | 'after',
): RankResult {
	// **An unranked CONTEXT row is skipped, not refused.** It can never be given a
	// rank — `computeInitWrites` skips `outsideFilter` rows and `spreadAround` filters
	// them, both correctly, because the view may not write to a note the Base excluded
	// — so refusing beside one is a permanent block behind advice that cannot work:
	// `rank.unranked` tells the user to run the backfill, and the backfill is one of
	// the two things that will not touch it. Constraining nothing, it is ignored here.
	//
	// An unranked WRITABLE row still refuses. The backfill CAN rank that one, so the
	// advice is actionable and the refusal is a prompt rather than a dead end. The two
	// look identical at the `order === null` test and must not be treated alike.
	const usable = ranked.filter((item) => !(item.outsideFilter && item.order === null));
	// The anchor itself can be one: a context parent is a legal destination for
	// `New <child>`. There is no positional information in a rankless row, so the
	// child goes to the end rather than nowhere.
	if (isUnrankedContext(anchor)) return anchoredOrder(usable, null, 'after');
	if (usable.length === 0) return { order: ORDER_SPACING };
	const pair = neighbourPair(usable, anchor, side);
	if (pair === null) return { refusal: 'unranked' };
	const { prev, next } = pair;
	// **A neighbour that EXISTS without a rank is a refusal, not an open end.** `rankBetween`
	// reads null as "nothing that side", and the two are different facts about the vault:
	// one is the edge of the population, the other is a row whose rank nobody has written.
	if ((prev !== null && prev.order === null) || (next !== null && next.order === null)) {
		return { refusal: 'unranked' };
	}
	return rankBetween(prev?.order ?? null, next?.order ?? null);
}

/**
 * The rank between two numbers, either of which may be absent — **the one arithmetic**, so
 * that the placement a drop takes and the rank the backfill fills a blank with cannot
 * disagree. `anchoredOrder` reaches it with the neighbours it found by identity in the
 * ranked population; `computeInitWrites` reaches it with the bounds it is walking between.
 *
 * Null means "no neighbour that side", which is why both-null answers `ORDER_SPACING`:
 * the first rank in an empty population has nothing to be between.
 */
function rankBetween(prev: number | null, next: number | null): RankResult {
	if (prev === null) return next === null ? { order: ORDER_SPACING } : edgeRank(next, 'before');
	if (next === null) return edgeRank(prev, 'after');
	return midpoint(prev, next);
}

/**
 * The rank between two neighbours, or `gapSpent` when there is no room left for one.
 *
 * The question is asked of the ROUNDED value and of nothing else: "is the gap wide
 * enough" is a different question, and at large magnitudes the two disagree. IEEE-754
 * spacing near 1e12 is about 0.00012, wider than the six decimals `roundOrder` keeps, so
 * a gap of 0.0001 clears any fixed minimum and still rounds the midpoint back onto
 * `prev`. That writes a DUPLICATE rank, and two equal ranks fail `inRankOrder`'s
 * distinctness test — the whole focused view drops back to tree order for a reason the
 * user is never shown. A hand-edited `order` that large is reachable frontmatter, not a
 * hypothetical.
 *
 * One rule rather than a minimum gap beside it: a second test can only ever disagree
 * with this one, and a magnitude-dependent epsilon is that second test wearing a
 * formula. Strictly between both ends is exactly what the caller needs and all it needs.
 */
function midpoint(prev: number, next: number): RankResult {
	// **An exact tie is a different refusal from a spent gap**, and the difference is the
	// only reliable signal that a vault's ranks are still sibling-scoped. Two rows holding
	// the SAME number is what that scheme produces — every first child carries its
	// parent's value — and it is visible right here, at the drop site, without asking
	// anything about the rest of the vault. Every whole-population test of "is this vault
	// migrated" has the same hole: one stray null or one unrelated tie, anywhere, flips it
	// for a subtree that is perfectly seeded. A neighbourhood question has no such hole.
	if (prev === next) return { refusal: 'tied' };
	const mid = roundOrder(prev + (next - prev) / 2);
	return mid > prev && mid < next ? { order: mid } : { refusal: 'gapSpent' };
}

/**
 * One spacing clear of the population's own first or last row, or `gapSpent` when the
 * arithmetic cannot get clear of it.
 *
 * The check is the same one `midpoint` makes, for the same reason and in the one other
 * place a rank is computed: above about 1e19 the IEEE-754 unit exceeds `ORDER_SPACING`,
 * so `Math.floor(order) + 1000` IS `order` and the append writes the anchor's own rank —
 * a duplicate, which then fails the distinctness test that decides whether a focused view
 * may be sorted by rank at all. The prepend has the mirror problem at large negative
 * magnitudes. Both branches call this rather than spelling the expression, so the two
 * places that produce a rank both refuse an unusable one and a third cannot appear
 * without the check.
 */
function edgeRank(neighbour: number, side: 'before' | 'after'): RankResult {
	const order = Math.floor(neighbour) + (side === 'after' ? ORDER_SPACING : -ORDER_SPACING);
	const clear = side === 'after' ? order > neighbour : order < neighbour;
	return clear ? { order } : { refusal: 'gapSpent' };
}

/**
 * A context row with nothing to rank from — see `anchoredOrder`'s own comment. Exported
 * for `siblingContext` (`view/interactions/structure.ts`), which asks the same question
 * of a focused peer rather than of an anchor: the row is on screen, but it can never be
 * GIVEN a rank, so it constrains nothing and must not be offered as one to swap past.
 */
export function isUnrankedContext(anchor: BacklogItem | null): boolean {
	return anchor !== null && anchor.outsideFilter && anchor.order === null;
}

/**
 * The anchor's neighbours in `ranked` for the given side, or null when the anchor
 * is not in the population at all.
 */
function neighbourPair(
	ranked: BacklogItem[],
	anchor: BacklogItem | null,
	side: 'before' | 'after',
): { prev: BacklogItem | null; next: BacklogItem | null } | null {
	if (anchor === null) {
		// No anchor means an edge of the whole population.
		return side === 'after' ? { prev: ranked[ranked.length - 1], next: null } : { prev: null, next: ranked[0] };
	}
	const idx = ranked.indexOf(anchor);
	if (idx === -1) return null;
	return side === 'before'
		? { prev: ranked[idx - 1] ?? null, next: anchor }
		: { prev: anchor, next: ranked[idx + 1] ?? null };
}

/**
 * The anchor a target implies: the last peer, or the destination row itself when
 * there is none. An empty peer group is the commonest placement there is — the first
 * child of a parent, a drop inside a leaf — which is why the anchor is stated over the
 * DESTINATION rather than over the peers.
 */
export function orderForTarget(ranked: BacklogItem[], target: DropTarget): RankResult {
	const { peers, insertIndex, parent } = target;
	if (peers.length === 0) return anchoredOrder(ranked, parent, 'after');
	if (insertIndex === 0) return anchoredOrder(ranked, peers[0], 'before');
	return anchoredOrder(ranked, peers[insertIndex - 1], 'after');
}

/**
 * The frontmatter writes for dropping `dragged` at the given target.
 *
 * Always ONE note: the rank is a midpoint in the global population, so no group is
 * ever renumbered. An empty result means the placement refused — a spent gap or an
 * unranked neighbour — and the caller says which.
 */
export function computeDropWrites(dragged: BacklogItem, target: DropTarget, ranked: BacklogItem[]): ItemWrite[] {
	const placed = dropPlacement(dragged, target, ranked);
	if ('refusal' in placed) return [];
	return [{ file: dragged.file, parent: computeParentField(dragged, target), order: placed.order }];
}

/**
 * The placement a MOVE OR A CREATION would take — the planner's own answer, exported so
 * the caller that names a remedy asks the SAME question rather than a similar one.
 *
 * The dragged row is removed from the population before its neighbours are found, or
 * it becomes its own neighbour. That filter must not be written twice: a caller that
 * diagnosed against the unfiltered array could see a number where the planner refused
 * — a drop that does nothing and shows no remedy — which is why the diagnosis goes
 * through here instead of calling `orderForTarget` beside it.
 *
 * **`dragged` is null for a creation**, which is the whole reason it is nullable: the
 * note does not exist yet, so there is no row to take out of the population and none to
 * exclude from the collision check. Everything else a placement is — the global answer,
 * the tie fallback, the check that the fallback's number is free — is the same question
 * for a note being born as for one being moved, and it must be, or a legacy vault can be
 * dragged around and not added to. That asymmetry shipped once: `newItemOrder` called
 * `orderForTarget` directly and got no fallback, so on a sibling-scoped vault a reorder
 * worked and a `New <child>` beside it refused.
 *
 * The name still says `drop` because a drop is the placement everything else is measured
 * against, and the register (ADR 0032) names it.
 */
export function dropPlacement(dragged: BacklogItem | null, target: DropTarget, ranked: BacklogItem[]): RankResult {
	const global = orderForTarget(
		ranked.filter((item) => item !== dragged),
		target,
	);
	// **An unmigrated vault falls back to ranking among the peers alone**, which is
	// exactly the sibling-scoped arithmetic this change replaces. Measured, not
	// supposed: with legacy ranks (Epic A 10, A1 10, A2 20) moving A2 before A1 sees
	// Epic A and A1 as its global neighbours and refuses — so every existing vault would
	// lose ordinary tree reordering, the plugin's core gesture, with no migration
	// available until the Seed command ships several tasks later.
	//
	// **Gated on the TIE, which is a fact about the drop site — never on the refusal, and
	// never on a question asked of the whole population.** Both of the wider gates were
	// built here and both were wrong, in ways worth keeping written down:
	//
	// - Gated on "the global placement refused", the fallback answers over a `gapSpent`
	//   that is CORRECT on a seeded vault, substituting a number from the peer bounds
	//   alone — which is exactly where any non-peer row between those bounds already
	//   sits. Being between the peer bounds is what makes that collision possible, not
	//   what prevents it.
	// - Gated on "the population is not distinctly ranked", one unrelated row defeats it
	//   from either direction: a single freshly created note with no `order` yet, or one
	//   legacy tie in some other corner of the vault, re-opens the fallback for a subtree
	//   that is perfectly seeded. Every whole-population predicate has that shape of hole,
	//   which is why narrowing it was abandoned rather than repaired.
	//
	// A tie has neither problem. Two neighbours holding the SAME number is what the
	// sibling-scoped scheme produces and what nothing else does, and it is read at the
	// two rows the placement actually landed between. A spent gap stays a spent gap and
	// keeps its own remedy; a missing rank stays `unranked` and keeps the backfill.
	//
	// Self-limiting: once every row around the drop holds a distinct rank there is no tie
	// to switch on, and the refusal this used to swallow is reported instead.
	if (!('refusal' in global) || global.refusal !== 'tied') return global;
	const peerScoped = orderForTarget(
		target.peers.filter((item) => item !== dragged),
		target,
	);
	// **The ANSWER is checked, not only the entry.** Every gate above is about whether the
	// sibling-scoped arithmetic is the right KIND for this vault, and none of them can say
	// whether the number it produces is free: both shapes it can return — a midpoint
	// between two peers, an edge rank one spacing past the outermost one — are functions of
	// the PEER values alone, while the rows sitting between or beside those peers are by
	// definition not peers. Two ways it collides, both measured: a non-peer already ranked
	// between the peer bounds is exactly where a peer midpoint lands, and on a legacy vault
	// every group is anchored on the same small numbers, so a drop in one group and a drop
	// in another compute the same edge rank.
	//
	// Refused rather than nudged onto a free value. Refusing keeps the arithmetic the one
	// line ADR 0008 already specifies, it costs nothing on the case this fallback exists
	// for — the first drop in each group answers a number nobody holds — and the remedy the
	// `tied` refusal names is Seed, which is precisely what a vault dense enough to
	// collide here needs — the backfill only fills blanks, and respacing a range holding two
	// equal numbers cannot separate them.
	if ('refusal' in peerScoped || !rankTaken(ranked, dragged, peerScoped.order)) return peerScoped;
	return global;
}

/**
 * Whether some OTHER row already holds this rank.
 *
 * One exclusion, and it is load-bearing: the dragged row itself, or a drop landing where
 * the item already is would refuse for a collision with nobody. A creation passes null —
 * a note that does not exist holds no rank, so there is nothing to exclude.
 *
 * **A context row DOES occupy its rank**, and that is not the same question the read side
 * answers. `distinctlyRanked` skips `outsideFilter` rows because one can never be GIVEN a
 * rank — a fact about the backfill's reach. Occupancy is a fact about the NUMBER: it is
 * taken regardless of who is allowed to write it. Being stricter here than the read side's
 * definition is right, because the two are answering different questions.
 *
 * Both answers are a dead end, so the question is which. Accepting WRITES the collision:
 * every later placement at that site refuses `tied` forever, and the duplicate is latent —
 * if the excluded note's filter membership flips (a `hide done` filter switched off, the
 * note edited back into the results) two writable rows hold the number and the focused view
 * drops to tree order with nothing said. Refusing merely declines one gesture, which the
 * user recovers from by dropping elsewhere. Stated no wider than measured: a
 * writable/context tie does NOT break focused ordering today, since `inRankOrder` reads
 * distinctness off the writable rows alone — the harm accepting causes is the permanent
 * local refusal plus that latent duplicate, not an immediate drop to tree order.
 */
function rankTaken(ranked: BacklogItem[], dragged: BacklogItem | null, order: number): boolean {
	return ranked.some((item) => item !== dragged && item.order === order);
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

/**
 * True when `field` is a date END this item's TYPE does not have — the third carve-out
 * `missingKeyStubs` makes on one rule: do not create a property that means nothing on the
 * note it lands on. Extracted rather than written inline beside the other two, because the
 * loop it guards is at its cognitive budget and a compound condition inside it breached
 * that budget rather than review.
 *
 * One type reaches it: a `Milestone`, which is a point and was being handed the START key
 * ✨ created for it — the one the generated README tells the reader this view will never
 * place a milestone by. Its target is still stubbed, because that one it can fill.
 *
 * Reached through `schemaEnds`, which is where "which date properties this type's note
 * carries" is stated, so the backfill cannot drift from the writer and the controls.
 *
 * `schemaEnds` and NOT `placementEnds`: an `Iteration` is drawn at one date or two
 * depending on a display option, and carries both either way. Asking the placement
 * question here made ✨ withhold the start key an iteration's own editor writes.
 */
function missingEnd(field: OptionalField, item: BacklogItem): boolean {
	if (field !== 'start' && field !== 'target') return false;
	return !schemaEnds(item.typeName).includes(field);
}

/**
 * True for a field this backfill NEVER stubs, whatever note it is looking at — as against
 * the three carve-outs below, each of which asks something about the item.
 *
 * Three returns rather than one condition, because the three reasons are unrelated and
 * two rules that agree today are still two rules. Extracted out of `missingKeyStubs`'s
 * loop, mirroring `missingEnd`: three refusals, each with its own distinct reason,
 * gathered into one predicate rather than written inline three separate times.
 */
function neverStubbed(field: OptionalField): boolean {
	// An empty state or an empty date is a slot on this note the user is invited to fill;
	// an empty prerequisite list is a claim about a RELATIONSHIP that does not exist, made
	// on every note at once. It is also exactly the state `Linking two items` requires a
	// removal never to leave behind, so backfilling one would have ✨ create what a remove
	// must clean up.
	if (field === 'dependsOn') return true;
	// A goal belongs to one type. `✨` stubs an empty key on every note that lacks one,
	// which is honest for a state or a date and dishonest here: a `goal` on every PBI,
	// Feature and Task in the vault is a property that means nothing on the note it lands
	// on.
	if (field === 'iterationGoal') return true;
	// An empty release is not an empty slot. `membershipTarget` (`domain/releases.ts`)
	// reads a present-but-blank value as an UNRESOLVED membership rather than as "names
	// none", so stubbing one here would have ✨ report every work item in the vault as a
	// broken membership on the release index — the screen this property exists to populate.
	if (field === 'release') return true;
	return false;
}

function missingKeyStubs(item: BacklogItem, settings: BacklogSettings): OptionalField[] {
	const stubs: OptionalField[] = [];
	// The vocabulary NARROWED to what this note's type may hold, before any question about
	// gaps: a key the type refuses is not a gap in it. Stated here rather than as a fourth
	// early return below because it is not a rule about a field — it asks `mayHoldField`
	// (`domain/itemTypes.ts`), which is where the rule lives for every door a planning key
	// reaches a note through. Without it, ✨ writes the backlog roadmap's own horizon and
	// both date keys onto a `Release`, the type this branch spends its diff declaring
	// unplaceable — empty, which is pollution rather than placement, and still not "not
	// written". The writer drops them too (`withHoldableStubs`, `storage/frontmatter.ts`),
	// because a retype between this plan and that callback is a window nothing here sees.
	const holdable = OPTIONAL_FIELDS.filter((field) => mayHoldField(item.typeName, field, settings));
	for (const field of holdable) {
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
		if (neverStubbed(field)) continue;
		// Joined to the two general refusals rather than given a guard of its own — a rule
		// specific to one field belongs in `neverStubbed` instead. Every clause here is a
		// reason not to stub, and `missingEnd` carries its own.
		if (missingEnd(field, item) || optionalKeyFor(settings, field) === '' || item.ownKeys[field]) continue;
		stubs.push(field);
	}
	return stubs;
}

/**
 * The gaps in one item's properties, or null when it has none. `nextOrder` is asked
 * only when the rank is the gap, so an item that needs no order does not spend a
 * number from the population-wide sequence — and it may answer null, which leaves the
 * rank a gap rather than filling it with a number the sequence could not clear.
 */
function initWriteFor(item: BacklogItem, settings: BacklogSettings, nextOrder: () => number | null): ItemWrite | null {
	const write: ItemWrite = { file: item.file };
	let needed = false;
	if (item.order === null) {
		const order = nextOrder();
		// A refused rank is not a refused WRITE: the type and the stubs are unaffected by
		// how big somebody's `order` is, and withholding them too would be a second failure
		// caused by the first.
		if (order !== null) {
			write.order = order;
			needed = true;
		}
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
 *
 * **What it guarantees about ORDER, and the scope is deliberate.** Every rank it hands out
 * is strictly ABOVE every rank drawn over the blank and strictly BELOW every rank drawn
 * under it *that the blank could be ordered against*, so filling a blank never moves that
 * blank. That covers both places this plugin orders rows by `order` — sibling order in the
 * tree (`compareSiblings`) and a focus level (`inRankOrder`) — and it covers them because
 * the bound is read off the DRAWN sequence rather than off the rank sequence. Nothing else
 * needs covering: a board column and a roadmap bucket sort by the Base's own `entryIndex`,
 * so no rank this writes can move a card in one.
 *
 * **Bounded against the rows it can COLLIDE with, not against every row drawn later**, and
 * the two halves of the guarantee reach that differently:
 *
 * - Above: the floor is the running maximum over everything drawn so far, so a rank clears
 *   every earlier one whether or not the two are ever compared. Left global deliberately —
 *   it is also what keeps every rank handed out increasing along the walk and landing in a
 *   gap no existing rank occupies, and a narrower floor buys a lower number at the price of
 *   both. The sibling half of the guarantee needs nothing else: an unranked row sorts LAST
 *   in its group (`compareSiblings`), so every ranked sibling is drawn before the blank and
 *   is already under the floor.
 * - Below: only rows that could share a focus list with the blank (`focusKey`) constrain
 *   it. A row at another level is never `inRankOrder`'s peer and never `compareSiblings`',
 *   so nothing requires the blank to rank below it — and bounding against it refused whole
 *   vaults for nothing. `Epic A(1000) > blank Feature` drawn before `Epic B(2000) > an Epic
 *   ranked 10` is the shape: the 10 is drawn later and below the floor, the two rows can
 *   never appear in one list, and the blank was skipped. That is worst on exactly the
 *   heterogeneous legacy vault this action exists to migrate.
 * - Below, second bound: the smallest rank in the vault ABOVE the floor, whatever level it
 *   is at. Not part of the guarantee — it is what keeps the value in a free gap, so the
 *   backfill can never mint the duplicate rank that `dropPlacement` reads as a legacy
 *   sibling-scoped vault. A rank at or under the floor needs no bound of its own, since
 *   every value handed out is strictly above the floor and cannot land on one.
 *
 * **When no such rank exists the blank keeps none**, which is the same fail-closed rule
 * the other two places a rank is produced already keep. It is reachable and ordinary: a
 * row drawn later under a different parent can hold a LOWER rank than the row drawn
 * before this one, and then no number is both above the first and below the second.
 *
 * **That refusal is COUNTED and returned, which is why this answers a plan rather than an
 * array.** Reduced to a null inside the walk it left the caller unable to tell "nothing was
 * missing" from "a rank was missing and could not be filled", and `runInit` reported the
 * first — `All items already have the properties this view writes`, said over a note whose
 * rank is still blank. A false statement rather than a gap, so the number of blanks left
 * that way comes out with the writes and the action names `Seed ranks from the hierarchy`,
 * the one pass not bounded by what is drawn around the row.
 *
 * What it does NOT promise is that a projection looks the same afterwards, and that is the
 * whole reason `Seed ranks from the hierarchy` (`domain/rankSpread.ts`) exists: a focused
 * list renders in tree order while any of its rows is unranked and in rank order once none
 * is, so two EXISTING ranks that already contradict the drawn order flip when the list
 * becomes sortable. No pass that only fills blanks can prevent that; Seed rewrites every
 * rank and can. Both the guarantee and the residual are pinned in
 * `test/view/backfillFocusOrder.test.ts`.
 */
export function computeInitWrites(model: BacklogModel, settings: BacklogSettings): { writes: ItemWrite[]; unplaceable: number } {
	const writes: ItemWrite[] = [];
	// Counted where the refusal happens rather than re-derived afterwards: `nextOrder` is
	// asked exactly once per blank rank, so a second pass would be a second idea of which
	// rows are blank.
	let unplaceable = 0;
	// The DRAWN sequence — DFS preorder over the real tree, context rows included, because
	// one is on screen and a rank that ignored it would move a row the user can see.
	const drawn: BacklogItem[] = [];
	const collect = (siblings: BacklogItem[]) => {
		for (const item of siblings) {
			drawn.push(item);
			collect(item.children);
		}
	};
	collect(model.realRoots);
	// `ceilings[i]` is the SMALLEST rank drawn after position i BY A ROW THAT COULD BE
	// ORDERED AGAINST IT — the value a blank there must stay below to keep its place.
	// **Read off what is drawn LATER, not off the next rank above the floor**, and that
	// distinction is the whole of the fix this replaced: the two agree while a subtree's
	// ranks run upward with the screen, and part company exactly when a later-drawn row
	// under a DIFFERENT parent holds a lower rank. Every fixture that missed this bug
	// stayed inside one increasing run. One backward pass, keeping the lowest rank seen
	// per focus key, because the answer for a row is a suffix minimum over its own key.
	const ceilings: (number | null)[] = new Array<number | null>(drawn.length).fill(null);
	const lowestLater = new Map<number, number>();
	for (let i = drawn.length - 1; i >= 0; i--) {
		const key = focusKey(drawn[i]);
		ceilings[i] = lowestLater.get(key) ?? null;
		const order = drawn[i].order;
		if (order !== null) lowestLater.set(key, Math.min(order, lowestLater.get(key) ?? Infinity));
	}
	// Every rank in the vault, ascending. `above` walks it forwards only, which is sound
	// because the floor never falls; what it skips are the ranks at or under the floor,
	// which no value handed out can land on anyway.
	const occupied = model.ranked.map((item) => item.order).filter((order): order is number => order !== null);
	let above = 0;
	// The HIGHEST rank drawn above the current row — a real one, or one this walk has just
	// handed out. The highest and not the last: a subtree can end on a row ranked below its
	// own parent, and a blank after it must clear everything above it. Being a running
	// maximum also makes the values handed out increase along the walk, so two blanks never
	// invert each other, and — with `occupied` below — every value lands in a gap no
	// existing rank occupies: above every rank drawn earlier, below the next one above it.
	let floor: number | null = null;
	let ceiling: number | null = null;
	const nextOrder = (): number | null => {
		while (above < occupied.length && occupied[above] <= (floor ?? -Infinity)) above++;
		const placed = rankBetween(floor, lowerOf(ceiling, occupied[above] ?? null));
		if ('refusal' in placed) {
			unplaceable++;
			return null;
		}
		floor = placed.order;
		return placed.order;
	};
	for (let i = 0; i < drawn.length; i++) {
		const item = drawn[i];
		// An unranked context row constrains nothing and is skipped here for the same reason
		// `anchoredOrder` skips it as an anchor.
		if (item.order !== null && (floor === null || item.order > floor)) floor = item.order;
		// Ancestors pulled in from outside the filter are context, not results — the
		// backfill must not write properties into notes the base excluded.
		if (item.outsideFilter) continue;
		ceiling = ceilings[i];
		const write = initWriteFor(item, settings, nextOrder);
		if (write) writes.push(write);
	}
	return { writes, unplaceable };
}

/** The smaller of two ranks, either of which may be absent. */
function lowerOf(a: number | null, b: number | null): number | null {
	if (a === null) return b;
	return b === null ? a : Math.min(a, b);
}


/** Orders are fractional ranks, kept to six decimals — the grid `midpoint` refuses against.
 *  Exported for `rankSpread.ts`: the whole-population rewrites land on the same grid, and
 *  a second definition of it is a second answer to what a rank may be. */
export function roundOrder(value: number): number {
	return Math.round(value * 1000000) / 1000000;
}
