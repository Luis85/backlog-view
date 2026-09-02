import { TFile } from 'obsidian';
import { DropTarget, isUnrankedContext } from './dropTargets';
import { BacklogItem, BacklogModel } from './model';
import { isReleaseType, PlacementEnd } from './itemTypes';
import { statedEnds } from './bars';
import { CivilDate, readDate, sameValue } from './noteFields';
import { daysBetween, formatCivil } from './timeline';
import { BacklogSettings, isDoneValue, isStartedValue } from './settings';
import { OptionalField } from './optionalProperties';
import { edgeRank, ORDER_SPACING, rankBetween, RankResult } from './rankArithmetic';
import { distinctlyRanked } from './rankOrder';

/**
 * What a change to the tree *would* write, worked out without touching anything.
 * Applying an `ItemWrite` is `storage/frontmatter.ts`'s job; deciding what should
 * be in one is this module's, which is why every function here is pure and every
 * ordering rule is testable without a vault.
 */

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

	/**
	 * **Fill only what the note leaves empty, decided at the WRITER** — the release join's
	 * rule and nobody else's ([ADR 0033](../../docs/adrs/0033-a-stale-rule-is-decided-at-the-writer.md)).
	 *
	 * A flag rather than a default, because `applyAxis` is shared with the horizon drag,
	 * the timeline resize and the iteration join, and the iteration join OVERWRITES on
	 * purpose ([[An iteration's timeframe schedules its items]] 2a). A rule learned as a
	 * habit there would retire that one without anyone editing the note that states it.
	 *
	 * Not an `AxisField`, so `axisEntries` (`storage/writeKeys.ts`) neither emits it as an
	 * entry nor lets it disturb `touchedKeys`: a flag is not a key, and a write the writer
	 * suppresses changes no value and so captures no inverse either.
	 */
	fillOnly?: boolean;
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
 * copies nothing else onto the item: not its parent, not its order, and not its state.
 *
 * **It carries two DATES and decides neither** ([[Joining a release dates the work]]). A
 * join rides both candidates on the same `ItemWrite` as the link — the release's own ship
 * date, and today — and states no rule about either: whether each lands is three questions
 * about the note as the batch reaches it (does it still hold that end, would writing it
 * reverse the span, is this pick still a join), and only the writer can ask them. An end
 * this function filtered out is an end the writer cannot reinstate, which is why filtering
 * here is the defect rather than the optimisation (ADR 0033).
 *
 * One `ItemWrite`, for `computeIterationWrites`' reason: two records naming one file
 * capture two inverses, and an undo could then return the link and keep the dates.
 *
 * `today` is an ARGUMENT because this module is pure domain and reads no clock — the
 * precedent `promptCreateItem` and `renderRoadmap` already set. Neither candidate is gated
 * on a key here either: `axisEntries` drops an unconfigured one, which is 4d's rule kept in
 * the one place that knows what is on disk.
 *
 * The release's date is `readSoleDate`'s answer, carried by the model as
 * `BacklogItem.releaseDate` — so a release stating none, or one nobody can read, carries
 * `undefined` rather than a `null` that would DELETE the item's own due (3b).
 */
export function computeReleaseWrites(
	item: BacklogItem,
	target: BacklogItem | null,
	settings: BacklogSettings,
	today: CivilDate,
): ItemWrite[] {
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
	if (settled) return [];
	const due = target.releaseDate.value;
	const axis: AxisWrite = { fillOnly: true, start: formatCivil(today), ...(due ? { target: formatCivil(due) } : {}) };
	return [{ file: item.file, release: target.file, axis }];
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
	// **An empty population with an anchor is not an empty population.** The peer-scoped
	// fallback's own population IS the peer list (`dropPlacement`), so a childless drop
	// target reaches here with `usable` empty and the destination row itself as anchor —
	// a row this population never held to begin with. Discarding it answered a constant
	// unrelated to the drop site, and because it was a constant, `rankTaken` found it
	// occupied on the very next such drop anywhere in the vault: the fallback worked once
	// per vault and refused `tied` from then on. Only the anchorless case is the first
	// rank in an empty backlog; an anchor still has something to be one spacing clear of,
	// via the one arithmetic `edgeRank` already is — and an anchor with no order of its
	// own has nothing to get clear of, which is the same `unranked` refusal the global
	// path answers for a null-order neighbour just below.
	if (usable.length === 0) {
		if (anchor === null) return { order: ORDER_SPACING };
		if (anchor.order === null) return { refusal: 'unranked' };
		return edgeRank(anchor.order, side);
	}
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
 *
 * **Not exported, and that is the rule ADR 0034 states rather than a tidy-up**: every
 * placement goes through `dropPlacement`, because a caller reaching this function
 * directly skips the dragged-row filter and the peer fallback — which is the shipped bug
 * the ADR records (`newItemOrder` made a legacy vault one a user could drag around and
 * not add to). An export only the test used re-opened that door; the test asks
 * `dropPlacement` with a null `dragged`, which is this function plus a fallback no
 * fixture there is tied enough to reach.
 */
function orderForTarget(ranked: BacklogItem[], target: DropTarget): RankResult {
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
 * against, and the register (ADR 0034) names it.
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
	if (!('refusal' in global) || global.refusal !== 'tied') return invisibleRank(global, dragged, target);
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
	if ('refusal' in peerScoped || !rankTaken(ranked, dragged, peerScoped.order)) return invisibleRank(peerScoped, dragged, target);
	return invisibleRank(global, dragged, target);
}

/**
 * A focus rank that no eye could see, turned into a refusal that says so.
 *
 * `inRankOrder` draws a focused list in TREE order whenever its rows are not all
 * distinctly ranked, so where that fallback will still hold AFTER the write, no number
 * written here can move anything: the rank would be correct, saved, and invisible, and a
 * gesture whose entire result is invisible reads as one that failed.
 *
 * **Asked of the PEERS, which is the list without the row being written, and that is the
 * whole of the rule.** Asked of the list INCLUDING the dragged row it refuses the
 * unmigrated vault the peer fallback exists to serve, and this was written that way
 * first: two focus rows tied at 5000 are not distinctly ranked, so the wider test refuses
 * — but writing one of them BREAKS the tie, the list becomes distinct, the fallback lifts
 * and the move is visible. That is the fallback working, not a defect. What cannot be
 * fixed by this write is a rank missing from some OTHER row, or a tie between two rows
 * this gesture does not touch; both leave the fallback holding whatever number lands
 * here. `test/view/focusedUnrankedContext.test.ts`'s three-input case is the fixture that
 * caught the wider version.
 *
 * **Asked of the ANSWER, never ahead of the arithmetic**, and that ordering is the whole
 * design. Every refusal the placement can already give — a spent gap, a tie, a neighbour
 * with no rank — names ONE remedy and names it precisely; this one has to name both,
 * because either fault produces the fallback. Asked first it would swallow those precise
 * sentences and send half their readers to the wrong command. It fires only where the
 * placement would otherwise SUCCEED, which is exactly the case nothing else catches.
 *
 * **`parentUnchanged` is what says this is a focus rank** — the flag exists for that
 * distinction (`src/domain/CLAUDE.md`), so no model has to be threaded in — and
 * `target.peers` plus the dragged row IS the list `inRankOrder` asks about, which is what
 * makes the two questions one question. Scoped there and no wider: an ordinary sibling
 * reorder is drawn by `compareSiblings`, which the fallback does not touch, so a tree
 * drag beside an unranked sibling still moves its row and is not refused here.
 */
function invisibleRank(placed: RankResult, dragged: BacklogItem | null, target: DropTarget): RankResult {
	if ('refusal' in placed) return placed;
	if (target.parentUnchanged !== true || dragged === null) return placed;
	return distinctlyRanked(target.peers) ? placed : { refusal: 'unseededList' };
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

