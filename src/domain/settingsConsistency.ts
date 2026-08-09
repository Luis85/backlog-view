import { BacklogSettings } from './settings';

/**
 * Whether a `BacklogSettings` is one `resolveSettings` could have produced.
 *
 * Its own module because it asks a different question from the rest of `settings.ts`:
 * that file says what the settings ARE, this one says which combinations can exist. The
 * split was forced by the 400-line budget when `Idea` and `Deliverable` merged into one
 * vocabulary, and the seam was already there — nothing in `settings.ts` reads these, and
 * their only callers are `buildModel`'s guard and the test fixture builder.
 */

/**
 * The relationships `resolveSettings` ESTABLISHES between fields, stated as a predicate so
 * a `BacklogSettings` that could not have come from it can be recognised. Returns the
 * broken one by name, or null.
 *
 * This exists because a test fixture is the one producer that skips the resolver. A
 * `{ ...defaultSettings(), stateKey: 'status', states: [...] }` literal carries the fields
 * and none of the rules, so it can express a vault nobody could configure — and that is
 * invisible until some function starts reading a RELATIONSHIP rather than a field, at
 * which point the fixture asserts behaviour for a configuration that cannot occur, in
 * both directions: a passing test proving nothing, and a failing test blaming correct
 * code. Four expectations in `test/domain/statePalettes.test.ts` were exactly that (see
 * `docs/issues/A hand-built fixture can model a state the producer cannot produce.md`).
 *
 * The list is the resolver's own guarantees, and it is the whole of what is checkable
 * here: these are relationships between VALUES, so no type can hold them.
 */
export function settingsInconsistency(settings: BacklogSettings): string | null {
	// `effectiveDoneValues` falls back to DEFAULT_DONE_VALUES, and the Deliverable list
	// falls back to that in turn, so neither is ever empty coming out of the resolver.
	if (settings.doneValues.length === 0) return 'doneValues is empty';
	if (settings.deliverableDoneValues.length === 0) return 'deliverableDoneValues is empty';
	// The one that bit. With the Deliverable key falling back and no list of its own
	// declared, the resolver COPIES `states` — so an empty Deliverable list beside a
	// populated requirements one is a state it cannot emit.
	if (settings.deliverableStateKey === '' && settings.deliverableStates.length === 0 && settings.states.length > 0) {
		return 'deliverableStates is empty while the key falls back to a configured states list';
	}

	// `clearablePropKey`'s yielding rule: the tags key resolves to '' rather than
	// colliding with one of the four properties that outrank it.
	const taken = [settings.parentKey, settings.orderKey, settings.typeKey, settings.stateKey];
	if (settings.tagsKey !== '' && taken.includes(settings.tagsKey)) return 'tagsKey collides with a key that outranks it';
	// Both per-state maps are built by `nameTable` over the CONFIGURED states, lowercased —
	// so a key naming a state the workflow does not have is one the resolver would have
	// dropped. Limits go further and exclude the done ones: WIP is what sits between started
	// and finished, and capping the archive is a different idea wearing the same word.
	const named = new Set(settings.states.map((state) => state.toLowerCase()));
	const done = new Set(settings.doneValues.map((value) => value.toLowerCase()));
	const stray = (table: Record<string, unknown>, allowed: (key: string) => boolean): string | null =>
		Object.keys(table).find((key) => !allowed(key)) ?? null;
	const strayLimit = stray(settings.wipLimits, (key) => named.has(key) && !done.has(key));
	if (strayLimit !== null) return `wipLimits names ${strayLimit}, which is not a non-done configured state`;
	const strayPolicy = stray(settings.columnPolicies, (key) => named.has(key));
	if (strayPolicy !== null) return `columnPolicies names ${strayPolicy}, which is not a configured state`;
	// Values, not only keys: `parseWipLimit` admits integers of 1 or more and `nameTable`
	// drops whatever it refuses, so a limit of 0 is a cell the resolver would have left
	// empty; the policy map drops an empty string the same way (`|| null`). Raised in
	// review as half a job, correctly — a key rule that ignores the value beside it is a
	// rule someone will read as covering both.
	const badLimit = Object.entries(settings.wipLimits).find(([, n]) => !Number.isInteger(n) || n < 1);
	if (badLimit) return `wipLimits sets ${badLimit[0]} to ${badLimit[1]}, which parseWipLimit would discard`;
	// `str(...).trim()` and then `|| null`, so a policy is stored trimmed or not at all —
	// surrounding whitespace is as unproducible as an empty string. Review caught the first
	// version rejecting only the empty case, which is the same half-a-job shape twice.
	const listed = listProblem(settings);
	if (listed !== null) return listed;
	const badPolicy = Object.entries(settings.columnPolicies).find(([, text]) => text.trim() !== text || text === '');
	if (badPolicy) return `columnPolicies sets ${badPolicy[0]} to ${JSON.stringify(badPolicy[1])}, which the resolver would trim or drop`;
	return null;
}

/**
 * The list-shaped fields, against what `list()` and `dedupe()` guarantee between them —
 * and they do NOT guarantee the same set, which is the whole reason this reads as two
 * loops rather than one.
 *
 * `list()` splits, trims and drops empties, and EVERY list goes through it. `dedupe()`
 * runs case-insensitively over the four VOCABULARIES only; the two done lists take
 * `list()` alone, so a repeat there is a configuration a user can actually set and
 * rejecting it would refuse a real vault. Checking the narrower set against the wider
 * rule was this predicate's recurring mistake, so the two spans are written out.
 *
 * Its own function to keep `settingsInconsistency` inside its complexity budget.
 */
function listProblem(settings: BacklogSettings): string | null {
	const vocabularies = ['states', 'deliverableStates', 'startedStates', 'horizonValues'] as const;
	for (const field of [...vocabularies, 'doneValues', 'deliverableDoneValues'] as const) {
		const untrimmed = settings[field].find((value) => value.trim() !== value || value === '');
		if (untrimmed !== undefined) {
			return `${field} holds ${JSON.stringify(untrimmed)}, which list() would have trimmed or dropped`;
		}
	}
	for (const field of vocabularies) {
		const repeat = settings[field].find((v, i, all) => all.findIndex((o) => o.toLowerCase() === v.toLowerCase()) !== i);
		if (repeat !== undefined) return `${field} repeats ${JSON.stringify(repeat)}, which dedupe() would have dropped`;
	}
	return null;
}

/**
 * The check on the CATEGORY, at the widest choke point a settings object passes through
 * (`buildModel`) rather than at the fixtures someone thought to look at — so it holds for
 * tests nobody has written yet.
 *
 * It throws rather than reporting, and unconditionally rather than under a dev flag,
 * because in production it is unreachable: `resolveSettings` is the only producer, its
 * one spread in `view/backlogView.ts` touches none of these fields, and
 * `test/domain/settings.test.ts` checks that claim across a spread of configurations
 * rather than leaving it as an argument. What it costs there is four comparisons on a
 * path that already sorts.
 *
 * Scope, stated to the check and not past it: this catches a bad fixture in any test that
 * builds a MODEL, and not one in a test that only calls a pure settings function. Nothing
 * intercepts a `BacklogSettings` literal itself — there is no seam to put one on.
 */
export function assertResolvedSettings(settings: BacklogSettings): void {
	const wrong = settingsInconsistency(settings);
	if (wrong === null) return;
	throw new Error(
		`settings that resolveSettings could not have produced: ${wrong}. Build the fixture ` +
			'through resolveSettings (see test/domain/statePalettes.test.ts) rather than spreading defaultSettings().',
	);
}
