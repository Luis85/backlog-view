/**
 * Building a `BacklogSettings` for a test, without being able to build one the plugin
 * could never hold.
 *
 * `resolveSettings` is where the relationships BETWEEN fields live — the Deliverable
 * lists follow a falling-back key while they are empty, the tags key yields to the four
 * that outrank it, neither done list is ever empty. A `settingsWith({ ... })`
 * literal carries the fields and none of that, so it can express a vault nobody could
 * configure. That stays invisible until some function reads a RELATIONSHIP rather than a
 * field, and then the fixture asserts behaviour for a configuration that cannot occur —
 * in both directions: a passing test proving nothing, and a failing test blaming correct
 * code. See `docs/issues/A hand-built fixture can model a state the producer cannot
 * produce.md`.
 *
 * Two constructors, and which to reach for is decided by what the test is about:
 *
 * - `settingsFrom` takes VIEW OPTIONS and runs the real resolver, so the fixture is one a
 *   user could actually set. Prefer it whenever the test is about resolved behaviour.
 * - `settingsWith` takes settings fields directly, for the many tests that want to name
 *   the two fields they care about without knowing which option produces them. It is the
 *   same spread it replaces, with the result CHECKED — so an override that breaks a
 *   relationship fails at the fixture, naming it, rather than somewhere downstream later.
 *
 * A literal spread is banned in `test/**` by `no-restricted-syntax` (`eslint.config.mjs`)
 * so this stays the way in rather than the way most people happen to use.
 */
import { BacklogSettings, defaultSettings, resolveSettings, settingsInconsistency } from '../../src/domain/settings';
import { FakeViewConfig } from './vault';

/** Settings as the real resolver produces them from a view's options. */
export function settingsFrom(options: Record<string, unknown> = {}): BacklogSettings {
	return resolveSettings(new FakeViewConfig(options) as never);
}

/**
 * The defaults with fields overridden — and then the resolver's own derivations applied,
 * so what comes out is what a user could actually have configured.
 *
 * DERIVING rather than rejecting is the point. A caller naming `states` is saying "this
 * base has these workflow states", and the resolver's answer to that includes copying them
 * to the Deliverable workflow while its key falls back; making every call site restate
 * that would be asking each of them to remember the rule this helper exists to hold. The
 * hazard is fixtures that cannot exist, and a fixture that is corrected into existence
 * cannot be one.
 *
 * The assertion stays behind the derivations as the backstop: it fires on a relationship
 * this helper does not know how to derive, which is the honest failure — better a fixture
 * that refuses to build than one that quietly models a vault nobody could have.
 */
export function settingsWith(over: Partial<BacklogSettings> = {}): BacklogSettings {
	// The one place the spread is right: this function IS the thing the rule points at,
	// and it is about to apply the derivations the rule exists to protect.
	// eslint-disable-next-line no-restricted-syntax
	const settings = { ...defaultSettings(), ...over };
	// `resolveSettings`' own rule: the Deliverable lists follow the requirements ones while
	// its key falls back and nothing of its own was declared. Asked of `over` rather than of
	// the merged object, because "the caller said nothing" and "the caller said []" are
	// different statements and only the first one follows.
	if (settings.deliverableStateKey === '') {
		if (over.deliverableStates === undefined) settings.deliverableStates = settings.states;
		if (over.deliverableDoneValues === undefined) settings.deliverableDoneValues = settings.doneValues;
	}
	// `clearablePropKey`'s yielding rule, applied rather than restated at call sites.
	const taken = [settings.parentKey, settings.orderKey, settings.typeKey, settings.stateKey];
	if (settings.tagsKey !== '' && taken.includes(settings.tagsKey)) settings.tagsKey = '';
	const wrong = settingsInconsistency(settings);
	if (wrong !== null) {
		throw new Error(
			`this fixture is not one resolveSettings could produce: ${wrong}. ` +
				'Build it with settingsFrom(options) instead, or teach settingsWith the derivation.',
		);
	}
	return settings;
}
