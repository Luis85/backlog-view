import { inCatalog, isDeliverableType } from './itemTypes';
import { FieldReading, LinkEntry, tagKey } from './noteFields';
import { assigneeName } from './readItems';
import { BacklogSettings } from './settings';

/**
 * What vocabulary the RESULTS carry — the states, the tags, the horizons and the
 * assignees a menu may offer, collected off the loaded items.
 *
 * All of them obey one rule, which is why they live together rather than beside the
 * code that consumes each: **a note the Base excluded contributes nothing.** Its
 * value is not this base's vocabulary, and offering it would make a value assignable
 * to results because some ancestor nobody can act on happened to use it. Stated once
 * here, each collector is a line of it rather than three chances to forget.
 *
 * The shape below is structural on purpose: these run over the model's own private
 * phase types, and naming the three fields they read keeps that phase private while
 * saying exactly what a vocabulary depends on.
 */
interface VocabularySource {
	outsideFilter: boolean;
	stateValue: string | null;
	tags: string[];
	horizon: FieldReading<string>;
	typeName: string | null;
	deliverableStateValue: string | null;
	assigneeEntry: LinkEntry | null;
}

/**
 * The catalog's own state collector needs `ladder` for its membership test. Narrower
 * than `VocabularySource` rather than widening it: `collectObservedDeliverableStates`
 * deliberately runs off the LINKED phase, before `ladder` exists, and a field every
 * collector must carry would break that call site for a field only one of them reads.
 */
interface CatalogVocabularySource extends VocabularySource {
	ladder: string[];
	testStateValue: string | null;
}

/**
 * The rule the six collectors below share, stated once: walk the loaded items,
 * **skip every context row** — an excluded note's value is not this base's
 * vocabulary — and keep the first casing of each distinct value, in the order the
 * walk met it. `key` is how identity is decided; the tags collector passes `tagKey`
 * rather than lowercasing again, because tag identity is that function's to define.
 */
function firstSeen<T extends VocabularySource>(
	all: T[],
	valuesOf: (item: T) => string[],
	key: (value: string) => string = (value) => value.toLowerCase(),
): string[] {
	const seen = new Map<string, string>();
	for (const item of all) {
		if (item.outsideFilter) continue;
		for (const value of valuesOf(item)) {
			if (!seen.has(key(value))) seen.set(key(value), value);
		}
	}
	return [...seen.values()];
}

/**
 * The sort every workflow's state menu shares: alphabetical, then open states before
 * the workflow's own done values — so a second (or third) workflow calls this with its
 * own done list instead of copying the sort-and-partition beside it.
 */
function sortOpenThenDone(values: string[], doneValues: string[]): string[] {
	const done = new Set(doneValues.map((v) => v.toLowerCase()));
	const sorted = values.sort((a, b) => a.localeCompare(b));
	return [...sorted.filter((v) => !done.has(v.toLowerCase())), ...sorted.filter((v) => done.has(v.toLowerCase()))];
}

/**
 * First occurrence of every state value, sorted for the state menus: open states
 * alphabetically, done states after them. Deduped case-insensitively, keeping
 * the casing seen first.
 */
export function collectObservedStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const values = firstSeen(all, (item) => (item.stateValue === null ? [] : [item.stateValue]));
	return sortOpenThenDone(values, settings.doneValues);
}

/**
 * Every assignee the results name, alphabetical and deduped case-insensitively in the
 * casing seen first — the tags collector's shape, for the tags collector's reason: this
 * is the WHOLE vocabulary the menu offers, since the assignee property has no declared
 * list behind it. A name nobody in the base carries is still reachable by typing it,
 * which is why nothing here has to guess at one.
 */
export function collectObservedAssignees(all: VocabularySource[]): string[] {
	return firstSeen(all, (item) => {
		const name = assigneeName(item);
		return name === null ? [] : [name];
	}).sort((a, b) => a.localeCompare(b));
}

/** Every tag the results carry, alphabetical and deduped case-insensitively. */
export function collectObservedTags(all: VocabularySource[]): string[] {
	return firstSeen(all, (item) => item.tags, tagKey).sort((a, b) => a.localeCompare(b));
}

/**
 * The horizon values the results carry, deduped case-insensitively in the casing seen
 * first — and in the order the results stand in the FINISHED tree rather than sorted,
 * because that is the walk the roadmap mints its buckets from. Take it from the
 * unsorted load order instead and a base whose own sort disagrees with the sibling
 * ranks yields a menu listing the buckets in an order the axis contradicts.
 *
 * That agreement is exact while the roadmap draws every result, and only then. Hiding
 * — a focus level, a finished subtree — can remove a value's first
 * carrier and leave the axis minting its bucket later than this list met it, and the
 * view-level ones are not knowable here at all. So this is the base order, not a
 * promise: the menu takes its order from the buckets it can see when there are any
 * (`interactions/plan.ts`), and this list stays the whole vocabulary regardless of
 * what is hidden — one that shrank when a filter narrowed would make the reachable
 * targets depend on what is on screen.
 */
export function collectObservedHorizons(all: VocabularySource[]): string[] {
	return firstSeen(all, (item) => (item.horizon.value === null ? [] : [item.horizon.value]));
}

/**
 * First occurrence of every Deliverable workflow state value, sorted the same way
 * `collectObservedStates` sorts its own: open states alphabetically, then done ones.
 * Scoped to `Deliverable`-typed items BEFORE the first-seen walk — not a blind copy of
 * `collectObservedStates`, which would mint a stray column from a non-Deliverable
 * item's coincidental value in the same key.
 */
export function collectObservedDeliverableStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const deliverables = all.filter((item) => isDeliverableType(item.typeName));
	const values = firstSeen(deliverables, (item) =>
		item.deliverableStateValue === null ? [] : [item.deliverableStateValue],
	);
	return sortOpenThenDone(values, settings.deliverableDoneValues);
}

/**
 * First occurrence of every TEST workflow state value, sorted the way the other two sort
 * their own: open states alphabetically, then done ones.
 *
 * Scoped by `inCatalog` BEFORE the first-seen walk, exactly as the Deliverable collector
 * scopes by type and for a reason that bites harder here — the test key is SHARED with the
 * requirements property by default, so without the filter every plan row's ordinary status
 * would join the catalog's vocabulary. Redundant for the one caller that has it today,
 * whose population is catalog members and context rows and nothing else, and still where
 * the correctness lives: a collector is correct over the list it is handed or it is correct
 * by luck.
 */
export function collectObservedTestStates(all: CatalogVocabularySource[], settings: BacklogSettings): string[] {
	const tests = all.filter((item) => inCatalog(item));
	const values = firstSeen(tests, (item) => (item.testStateValue === null ? [] : [item.testStateValue]));
	return sortOpenThenDone(values, settings.testDoneValues);
}
