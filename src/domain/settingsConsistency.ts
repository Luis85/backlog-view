import { BacklogSettings } from './settings';
import { ReleaseSettings } from './releaseOptions';
import { t } from '../i18n/t';
import { ownedProperties, OwnedRole } from './optionalProperties';
import { colorableStates, stateColor } from './stateColors';

/**
 * Whether a `BacklogSettings` is one `resolveSettings` could have produced.
 *
 * Its own module because it asks a different question from the rest of `settings.ts`:
 * that file says what the settings ARE, this one says which combinations can exist. The
 * split was forced by the 400-line budget when `Idea` and `Deliverable` merged into one
 * vocabulary, and the seam was already there — nothing in `settings.ts` reads these, and
 * their only callers were `buildModel`'s guard and the test fixture builder.
 *
 * `configProblems` joined them later, for the same question asked of the other producer:
 * a fixture can express a configuration the resolver could not, and a `.base` file can
 * express one the WRITER must refuse — two properties pointed at one key. The first is
 * caught by a predicate over the resolved fields, the second by a report the view shows
 * and every write path is gated on; both are "is this combination coherent", and neither
 * is a fact about what a setting is.
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
	// `effectiveDoneValues` falls back to DEFAULT_DONE_VALUES, so it is never empty coming
	// out of the resolver.
	if (settings.doneValues.length === 0) return 'doneValues is empty';
	// Both secondary workflows (Deliverable, and the test catalog's added in Task 1) get the
	// same two guarantees from `resolveSecondaryWorkflow` — checked by one shared predicate
	// rather than four inline `if`s, which is what kept this function under its complexity
	// budget when the test workflow's pair joined the Deliverable pair already here.
	const deliverableProblem = secondaryWorkflowProblem(
		'deliverable',
		settings.deliverableStateKey,
		settings.deliverableDoneValues,
		settings.deliverableStates,
		settings.states,
	);
	if (deliverableProblem !== null) return deliverableProblem;
	const testProblem = secondaryWorkflowProblem('test', settings.testStateKey, settings.testDoneValues, settings.testStates, settings.states);
	if (testProblem !== null) return testProblem;

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
	const coloured = colourProblem(settings);
	if (coloured !== null) return coloured;
	const badPolicy = Object.entries(settings.columnPolicies).find(([, text]) => text.trim() !== text || text === '');
	if (badPolicy) return `columnPolicies sets ${badPolicy[0]} to ${JSON.stringify(badPolicy[1])}, which the resolver would trim or drop`;
	return null;
}

/**
 * The two guarantees `resolveSecondaryWorkflow` gives EVERY secondary workflow (Deliverable,
 * and the test catalog's added in Task 1): its done list is never empty (falls back to the
 * requirements workflow's effective one, or to the shipped default with an own key), and its
 * states list is empty only when its key is also falling back AND the requirements workflow
 * declared none of its own to copy — the one case the resolver would have COPIED `states`
 * into rather than leaving empty. `name` prefixes the message so a report says which
 * workflow — `'deliverable'` or `'test'` — matching the field it names (`${name}DoneValues`,
 * `${name}States`).
 *
 * Its own function for `settingsInconsistency`'s complexity budget: two workflows inline
 * would be four `if`s repeating the same shape, which is exactly what pushed the caller over
 * its limit when the test workflow's pair joined the Deliverable pair already there.
 */
function secondaryWorkflowProblem(name: string, key: string, doneValues: string[], states: string[], baseStates: string[]): string | null {
	if (doneValues.length === 0) return `${name}DoneValues is empty`;
	if (key === '' && states.length === 0 && baseStates.length > 0) {
		return `${name}States is empty while the key falls back to a configured states list`;
	}
	return null;
}

/**
 * The third per-state map, and the one that is NOT `named`: `stateColors` is built over
 * both vocabularies at once, because the colours are keyed by the state VALUE — so reusing
 * the limit and policy maps' predicate would reject a legitimately coloured Deliverable
 * state. Its allowed key set is `colorableStates`, the resolver's own list rather than a
 * second reading of it, which is what keeps the done states out of both at once.
 *
 * Key AND value, together, for the reason the two maps above already record twice: a key
 * rule with no value rule beside it is a rule someone reads as covering both. Here the
 * value goes straight into a custom property the bar and its legend swatch both paint
 * from, so a fixture holding one the resolver would have dropped asserts a colour no
 * picker could have produced. Asked of `stateColorValue` itself rather than of a second
 * copy of the rule: the resolver stores exactly what that function returns, so anything it
 * would not return unchanged — a capital, `#abc`, `rgb(...)`, surrounding space — is
 * unproducible.
 *
 * Its own function for `listProblem`'s reason — the complexity budget on the predicate above.
 */
function colourProblem(settings: BacklogSettings): string | null {
	const colourable = new Set(colorableStates(settings).map((state) => state.toLowerCase()));
	const strayColour = Object.keys(settings.stateColors).find((key) => !colourable.has(key));
	if (strayColour !== undefined) return `stateColors names ${strayColour}, which is not a colourable state`;
	const badColour = Object.entries(settings.stateColors).find(([, name]) => stateColor(name) !== name);
	if (badColour) {
		return `stateColors sets ${badColour[0]} to ${JSON.stringify(badColour[1])}, which stateColor would discard`;
	}
	return null;
}

/**
 * The list-shaped fields, against what `list()` and `dedupe()` guarantee between them —
 * and they do NOT guarantee the same set, which is the whole reason this reads as two
 * loops rather than one.
 *
 * `list()` splits, trims and drops empties, and EVERY list goes through it. `dedupe()`
 * runs case-insensitively over the VOCABULARIES only; the three done lists take
 * `list()` alone, so a repeat there is a configuration a user can actually set and
 * rejecting it would refuse a real vault. Checking the narrower set against the wider
 * rule was this predicate's recurring mistake, so the two spans are written out.
 *
 * **The list below is the one thing here that can silently go short**, and it did: the
 * prose said "the five vocabularies" while the array held six, and `riskValues` — deduped
 * since the day it shipped — was in neither. A missing entry fails open, so nothing
 * reports it; the way to re-derive the set is to grep `dedupe(` in `settingsResolve.ts`
 * and read off which SETTINGS FIELD each result lands in, rather than to trust this
 * sentence. Counted that way on 2026-08-16 when `priorityValues` arrived: eight fields,
 * seven `dedupe(` call sites (the workflow states resolve through one shared helper).
 *
 * Its own function to keep `settingsInconsistency` inside its complexity budget.
 */
function listProblem(settings: BacklogSettings): string | null {
	const vocabularies = [
		'states',
		'deliverableStates',
		'testStates',
		'startedStates',
		'horizonValues',
		'riskValues',
		'priorityValues',
	] as const;
	for (const field of [...vocabularies, 'doneValues', 'deliverableDoneValues', 'testDoneValues'] as const) {
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

/**
 * The roles `configProblems` lets share ONE key: the three workflow states, explicitly
 * configured to the same property. Sharing by FALLBACK is already legitimate and never
 * reaches this map (`ownedProperties` reads the raw keys, so an unbound one resolves to
 * ''); this is the same "they can use the same status property" idea asked for explicitly.
 * The workflows keep independent vocabularies either way, so the usual reason a shared key
 * is a mistake — one property silently overwriting the other's meaning — never applies.
 *
 * A SET rather than a pair, and that is the correction rather than a generalisation for its
 * own sake: written as "exactly these two roles and no more" it reported a collision the
 * moment a third workflow defaulted to the same key — blocking every write in the view, on
 * the shipped configuration. Scoped to workflow states only: one more role of any other
 * kind (order, tags, an axis key) reports as a collision again, these named in it like any
 * other clash.
 */
const WORKFLOW_STATE_ROLES = new Set<OwnedRole>(['state', 'deliverableState', 'testState']);

/**
 * Configuration mistakes that would corrupt writes (e.g. parent and order stored
 * under the same frontmatter key). The view surfaces these instead of guessing.
 *
 * Each problem is a FRAGMENT, not a sentence: `config.fixFirst` and `config.fixAll` are
 * what put one in a sentence, so a reader that names several does not read as a run of
 * full stops. No caller may join them — the list goes to `t` whole, for the reason the
 * roles do one line down.
 */
export function configProblems(settings: BacklogSettings): string[] {
	const problems: string[] = [];
	const keys = new Map<string, OwnedRole[]>();
	for (const { role, key } of ownedProperties(settings)) {
		if (!key) continue;
		const users = keys.get(key) ?? [];
		users.push(role);
		keys.set(key, users);
	}
	for (const [key, users] of keys) {
		if (users.every((role) => WORKFLOW_STATE_ROLES.has(role))) continue;
		if (users.length > 1) {
			// The array, not a joined string: `t` joins it in the locale of the message it
			// lands in, which this call site cannot know — the message may have fallen back
			// to English while the active catalog is another language.
			problems.push(t('settings.sharedKey', { properties: users.map((role) => t(`property.${role}`)), key }));
		}
	}
	return problems;
}

/**
 * The RELEASE view's own collision report — `configProblems` above asked of the other
 * settings shape, and the same question: is this combination one a writer may act on.
 *
 * **Over the keys read and written on the RELEASE NOTE, and no others.** Those are the
 * ones whose collision corrupts the note this view writes, and READ counts: the released
 * date, the parent and the order are never written by this view and are all read of a
 * release, so a status landing on one of them is still this view breaking its own screen. a status aimed at the type key
 * takes `Release` off the note the moment somebody picks one, and it is then a release no
 * reader can find (`isReleaseType` and `membershipTarget` both key off the type). The
 * ITEM-side keys — the membership property, the state property — are deliberately absent,
 * which is what keeps the one sharing this view is built around legal: the release's own
 * status and an item's workflow state may name one property, because they are read of
 * different notes (`SHARED_STATUS_OPTIONS`, `domain/releaseOptions.ts`). That is the same
 * exemption `WORKFLOW_STATE_ROLES` makes above, arrived at by narrowing the population
 * rather than by skipping a group.
 *
 * **Two callers, one statement.** `createRelease` (`storage/createNote.ts`) throws on a
 * non-empty list — it is the last line before `vault.create`, and a caller that ignored
 * this would write a corrupt note — and the release view's `WriteGate` refuses every edit
 * while it is non-empty, which is what a `.base` typed by hand needs: ✨ cannot produce
 * this state (`adoptableReleaseKeys` refuses), and a property picker can. The edit path
 * bypassed the creator's guard entirely until this function existed (found by review,
 * PR #211): picking `Planned` with the status and the type on one key rewrote
 * `type: Release` to `type: Planned` and the release vanished from its own view.
 *
 * Fragments, never sentences, for `configProblems`' own reason: `config.fixFirst` is what
 * closes one.
 */
type ReleaseNoteRole =
	| 'type'
	| 'parent'
	| 'order'
	| 'releaseVersion'
	| 'releaseTarget'
	| 'releaseStatus'
	| 'releasedDate'
	| 'releaseDescription';

export function releaseNoteProblems(settings: ReleaseSettings): string[] {
	// A UNION rather than `string`, `OwnedRole`'s own reason one function up: `t` derives
	// its keys from the catalog by template literal type, so a role that names no
	// `property.*` entry is a build error rather than a message rendered as its own key.
	const owned: { role: ReleaseNoteRole; key: string }[] = [
		{ role: 'type', key: settings.typeKey },
		// The two MODEL mappings, added 2026-08-29 after review pointed out that the set left
		// them out while `releaseIndex` reads both on a release note (PR #211). They are read
		// rather than written here, which is exactly the released date's own reason for being
		// in the list: `rank` sorts the index by `item.order`, so a status written onto the
		// order key replaces a release's rank with a word and moves it to the tail — and the
		// parent key is what seats a release in the tree at all (`loadOutsideParents` is not
		// type-gated), so a status written there hangs the release off whatever it names.
		{ role: 'parent', key: settings.parentKey },
		{ role: 'order', key: settings.orderKey },
		{ role: 'releaseVersion', key: settings.versionKey },
		{ role: 'releaseTarget', key: settings.targetDateKey },
		{ role: 'releaseStatus', key: settings.statusKey },
		{ role: 'releasedDate', key: settings.releasedDateKey },
		{ role: 'releaseDescription', key: settings.descriptionKey },
	];
	const keys = new Map<string, ReleaseNoteRole[]>();
	for (const { role, key } of owned) {
		if (!key) continue;
		keys.set(key, [...(keys.get(key) ?? []), role]);
	}
	const problems: string[] = [];
	for (const [key, users] of keys) {
		if (users.length < 2) continue;
		// The array, not a joined string — `configProblems`' own note on why.
		problems.push(t('settings.sharedKey', { properties: users.map((role) => t(`property.${role}`)), key }));
	}
	return problems;
}
