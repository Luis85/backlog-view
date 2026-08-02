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
 * First occurrence of every state value, sorted for the state menus: open states
 * alphabetically, done states after them. Deduped case-insensitively, keeping
 * the casing seen first.
 */
export function collectObservedStates(all: VocabularySource[], settings: BacklogSettings): string[] {
	const seen = new Map<string, string>();
	for (const item of all) {
		if (item.outsideFilter) continue;
		if (item.stateValue !== null && !seen.has(item.stateValue.toLowerCase())) {
			seen.set(item.stateValue.toLowerCase(), item.stateValue);
		}
	}
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	const values = [...seen.values()].sort((a, b) => a.localeCompare(b));
	return [...values.filter((v) => !done.has(v.toLowerCase())), ...values.filter((v) => done.has(v.toLowerCase()))];
}

/** Every tag the results carry, alphabetical and deduped case-insensitively. */
export function collectObservedTags(all: VocabularySource[]): string[] {
	const seen = new Map<string, string>();
	for (const item of all) {
		if (item.outsideFilter) continue;
		for (const tag of item.tags) {
			if (!seen.has(tagKey(tag))) seen.set(tagKey(tag), tag);
		}
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b));
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
	const seen = new Map<string, string>();
	for (const item of all) {
		if (item.outsideFilter) continue;
		const value = item.horizon.value;
		if (value !== null && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
	}
	return [...seen.values()];
}
