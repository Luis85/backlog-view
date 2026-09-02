import { BacklogItem, BacklogModel } from './model';
import { childLevelIndex, mayHoldField, schemaEnds } from './itemTypes';
import { hasHorizonAxis } from './roadmap';
import { stateKeyFor } from './board';
import { focusKey } from './rankOrder';
import { BacklogSettings } from './settings';
import {
	OPTIONAL_FIELDS,
	OptionalField,
	optionalKeyFor,
	resolvedDeliverableStateKey,
	resolvedTestStateKey,
} from './optionalProperties';
import { rankBetween } from './rankArithmetic';
import { ItemWrite } from './writePlan';

/**
 * The ✨ backfill's plan: what the whole tree is MISSING, worked out without touching
 * anything.
 *
 * Beside `writePlan.ts` rather than in it for the rule ADR 0033 already states about
 * `rankSpread.ts` — every plan there places ONE row against its neighbours, and this is a
 * whole-tree pass. It shares that file's `ItemWrite` because a type belongs with the code
 * that produces it, and the rank arithmetic every placement shares (`rankArithmetic.ts`)
 * because the number a blank is filled with and the number a drop takes must be the one
 * answer.
 */

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
 * - Below: only rows that could share a FOCUS list with the blank (`focusKey`) bound the
 *   ceiling. A row at another level is never `inRankOrder`'s peer, but it CAN be
 *   `compareSiblings`' peer by sharing the blank's parent — and that is not a hole in the
 *   bound: a ranked sibling always sorts before an unranked one, so no sibling ever
 *   supplies a ceiling from later in the walk, ranked or not. Only a same-focus-key row can
 *   do that. `Epic A(1000) > blank Feature` drawn before `Epic B(2000) > an Epic ranked 10`
 *   is the shape: the 10 is drawn later and below the floor, the two rows can never appear
 *   in one FOCUS list, and the blank was skipped. That is worst on exactly the
 *   heterogeneous legacy vault this action exists to migrate. **Being left blank is a
 *   different question, and it is NOT scoped to `focusKey` alone**: a refusal poisons the
 *   blank's sibling group too (`isPoisoned`), because a `compareSiblings` peer at another
 *   level — sharing a parent rather than a focus key — draws adjacent to it just the same
 *   and would otherwise be ranked ahead of it once the sibling itself stayed blank.
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
	// **A refusal poisons the rest of the walk in both populations two blanks can share.**
	// A blank left blank sorts LAST, so a later blank that takes a number ranks itself
	// ahead of the row just refused and MOVES it — and "later blank" means one compared
	// against it by EITHER `inRankOrder` (same focus key) or `compareSiblings` (same
	// parent): `X(100), A, B` with an Epic `A1(50)` inside `A` drew `X, B, A` is the
	// focus-key shape; a `Feature` and a `Bug` under one Epic, sharing a parent but not a
	// key, is the sibling-group shape. Both are tracked, in one set: a focus key is a
	// small integer and a sibling group is a `BacklogItem` reference (or `null` for the
	// root group), and the two are never `SameValueZero`-equal to each other, so `.has`
	// on either shape answers only its own question.
	const poisoned = new Set<number | BacklogItem | null>();
	const nextOrder = (item: BacklogItem): number | null => {
		while (above < occupied.length && occupied[above] <= (floor ?? -Infinity)) above++;
		const placed = rankBetween(floor, lowerOf(ceiling, occupied[above] ?? null));
		if ('refusal' in placed) {
			unplaceable++;
			poisoned.add(focusKey(item)).add(item.parent);
			return null;
		}
		floor = placed.order;
		return placed.order;
	};
	for (let i = 0; i < drawn.length; i++) {
		const item = drawn[i];
		// An unranked context row constrains nothing and is skipped here for the same reason
		// `anchoredOrder` skips it as an anchor.
		if (item.order !== null) floor = Math.max(item.order, floor ?? item.order);
		// Ancestors pulled in from outside the filter are context, not results — the
		// backfill must not write properties into notes the base excluded.
		if (item.outsideFilter) continue;
		// A poisoned key OR a poisoned sibling group is spelled as a ceiling BELOW
		// everything, which is the truth of it: there is no room above a row that was left
		// with no number at all, in either population it could be compared in. Both arms of
		// `rankBetween` refuse it — `midpoint` is not strictly between, and `edgeRank`
		// cannot get under `-Infinity` — so the row is counted and left blank like the one
		// that poisoned it.
		ceiling = isPoisoned(poisoned, item) ? -Infinity : ceilings[i];
		const write = initWriteFor(item, settings, () => nextOrder(item));
		if (write) writes.push(write);
	}
	return { writes, unplaceable };
}

/** The smaller of two ranks, either of which may be absent. */
function lowerOf(a: number | null, b: number | null): number | null {
	if (a === null) return b;
	return b === null ? a : Math.min(a, b);
}

/**
 * Whether a blank is disqualified from the placement it is about to be asked for — its
 * own focus key already refused (the `inRankOrder` population), or its sibling group
 * already refused (the `compareSiblings` population). A separate function rather than
 * the condition spelled inline in `computeInitWrites`, so the OR is scored on its own
 * rather than adding to that walk's own complexity budget.
 */
function isPoisoned(poisoned: Set<number | BacklogItem | null>, item: BacklogItem): boolean {
	return poisoned.has(focusKey(item)) || poisoned.has(item.parent);
}
