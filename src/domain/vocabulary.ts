import { FieldReading, tagKey } from './noteFields';
import { BacklogSettings } from './settings';

/**
 * What vocabulary the RESULTS carry — the states, the tags and the horizons a menu
 * may offer, collected off the loaded items.
 *
 * All three obey one rule, which is why they live together rather than beside the
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
}

/**
 * The rule the three collectors below share, stated once: walk the loaded items,
 * **skip every context row** — an excluded note's value is not this base's
 * vocabulary — and keep the first casing of each distinct value, in the order the
 * walk met it. `key` is how identity is decided; the tags collector passes `tagKey`
 * rather than lowercasing again, because tag identity is that function's to define.
 */
function firstSeen(
	all: VocabularySource[],
	valuesOf: (item: VocabularySource) => string[],
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
 * First occurrence of every state value, sorted for the state menus: open states
 * alphabetically, done states after them. Deduped case-insensitively, keeping
 * the casing seen first.
 */
export function collectObservedStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	const values = firstSeen(all, (item) => (item.stateValue === null ? [] : [item.stateValue])).sort((a, b) =>
		a.localeCompare(b),
	);
	return [...values.filter((v) => !done.has(v.toLowerCase())), ...values.filter((v) => done.has(v.toLowerCase()))];
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
 * — a focus level, the quick filter, a finished subtree — can remove a value's first
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
