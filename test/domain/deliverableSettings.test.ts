import { describe, expect, it } from 'vitest';
import {
	configProblems,
	DEFAULT_DONE_VALUES,
	defaultSettings,
	resolvedDeliverableStateKey,
	resolveSettings,
} from '../../src/domain/settings';

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return {
		get: (key: string) => values[key],
		getAsPropertyId: (key: string) => {
			const v = values[key];
			return typeof v === 'string' && v.includes('.') ? v : null;
		},
	} as never;
}

describe('the Deliverable workflow', () => {
	it('gives the Deliverable workflow its own defaults', () => {
		const s = defaultSettings();
		expect(s.deliverableStateKey).toBe('');
		expect(s.deliverableStates).toEqual([]);
		expect(s.deliverableDoneValues).toEqual(DEFAULT_DONE_VALUES);
	});

	it('resolves the Deliverable state property independently of the requirements one', () => {
		const s = resolveSettings(
			fakeConfig({
				deliverableStateProperty: 'note.deliverableStatus',
				deliverableStateValues: 'Concept, Draft, Review, Published',
				deliverableDoneValues: 'Published',
				stateProperty: 'note.status',
			}),
		);
		expect(s.deliverableStateKey).toBe('deliverableStatus');
		expect(s.deliverableStates).toEqual(['Concept', 'Draft', 'Review', 'Published']);
		expect(s.deliverableDoneValues).toEqual(['Published']);
		expect(s.stateKey).toBe('status');
	});

	it('does not report a collision when the two workflows explicitly share one key', () => {
		// The human's own request: "I don't care if the properties are colliding as
		// they do not share the same workflow." Explicit sharing is exempted by name
		// (`STATE_KEY_SHARING_EXEMPT`), the same way fallback sharing already was.
		const s = resolveSettings(
			fakeConfig({ stateProperty: 'note.status', deliverableStateProperty: 'note.status' }),
		);
		expect(s.stateKey).toBe('status');
		expect(s.deliverableStateKey).toBe('status');
		expect(configProblems(s)).toEqual([]);
	});

	it('does NOT widen the exemption to state sharing a key with anything else', () => {
		// A width-guard on the exemption above: only the {state, deliverable state}
		// PAIR is exempt. State colliding with a third property (order, here) is
		// still exactly the mistake `configProblems` exists to catch — an exemption
		// keyed on "an entry named state" rather than on the pair would swallow this.
		const s = { ...defaultSettings(), stateKey: 'status', orderKey: 'status' };
		const problems = configProblems(s);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('order and state');
	});

	it('still reports a collision when a third property joins the exempt pair on one key', () => {
		// Exactly the pair is exempt, not "at least the pair": a third label sharing
		// the same key makes it a real collision again, naming all three.
		const s = { ...defaultSettings(), stateKey: 'status', deliverableStateKey: 'status', orderKey: 'status' };
		const problems = configProblems(s);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('order');
		expect(problems[0]).toContain('state');
		expect(problems[0]).toContain('deliverable state');
	});
});

describe('the Deliverable workflow falls back to the shared one', () => {
	it("reads and writes the requirements workflow's key when its own is unset", () => {
		const s = { ...defaultSettings(), stateKey: 'status' };
		expect(resolvedDeliverableStateKey(s)).toBe('status');
	});

	it('keeps its own key over the shared one once a Deliverable state property is configured', () => {
		const s = { ...defaultSettings(), stateKey: 'status', deliverableStateKey: 'deliverableStatus' };
		expect(resolvedDeliverableStateKey(s)).toBe('deliverableStatus');
	});

	it('resolves to no key at all when neither workflow has one configured', () => {
		expect(resolvedDeliverableStateKey(defaultSettings())).toBe('');
	});

	it('falls back to the shared workflow states when its own list is empty', () => {
		const s = resolveSettings(fakeConfig({ stateValues: 'New, Active, Done' }));
		expect(s.deliverableStates).toEqual(['New', 'Active', 'Done']);
	});

	it('keeps its own declared states over the shared list once configured', () => {
		const s = resolveSettings(
			fakeConfig({ stateValues: 'New, Active, Done', deliverableStateValues: 'Draft, Published' }),
		);
		expect(s.deliverableStates).toEqual(['Draft', 'Published']);
	});

	it('does NOT borrow the shared states when its own KEY is configured but its own states are not', () => {
		// A legitimate partial override: a Deliverable state property of its own, but no
		// declared vocabulary for it yet. The shared `states` belong to a DIFFERENT
		// property (`stateKey`) and must not leak in just because this list is empty —
		// the states' fallback has to ask the SAME question the key's fallback asks
		// (`resolvedDeliverableStateKey`: is the own key unset?), not "is this list empty?".
		const s = resolveSettings(
			fakeConfig({
				stateProperty: 'note.status',
				stateValues: 'New, Active, Done',
				deliverableStateProperty: 'note.deliverableStatus',
			}),
		);
		expect(s.deliverableStateKey).toBe('deliverableStatus');
		expect(s.deliverableStates).toEqual([]);
	});

	it('falls back to the shared (resolved) done values, not the hardcoded default, when its own are unset', () => {
		// The requirements workflow's OWN done values are customized here — resolving to
		// DEFAULT_DONE_VALUES instead would ignore that customization the moment the
		// Deliverable workflow shares the property.
		const s = resolveSettings(fakeConfig({ doneValues: 'Shipped, Retired' }));
		expect(s.deliverableDoneValues).toEqual(['Shipped', 'Retired']);
	});

	it('does NOT borrow the shared done values when its own KEY is configured but its own done values are not', () => {
		// The same partial-override shape as the states test above, for the sibling
		// field: an OWN, distinct Deliverable state property with no done values of its
		// own is a genuinely independent workflow — it must get the shipped default,
		// never the requirements workflow's customized (and unrelated) done values.
		const s = resolveSettings(
			fakeConfig({
				doneValues: 'Shipped, Retired',
				deliverableStateProperty: 'note.deliverableStatus',
			}),
		);
		expect(s.deliverableStateKey).toBe('deliverableStatus');
		expect(s.deliverableDoneValues).toEqual(DEFAULT_DONE_VALUES);
	});

	it('keeps its own done values over the shared list once configured', () => {
		const s = resolveSettings(fakeConfig({ doneValues: 'Shipped', deliverableDoneValues: 'Published' }));
		expect(s.deliverableDoneValues).toEqual(['Published']);
	});

	it('does not report a false collision when the Deliverable state falls back to the shared key', () => {
		// Sharing a key by fallback is intended; sharing one by explicit configuration
		// is the collision `configProblems` already reports (see the test above).
		const s = resolveSettings(fakeConfig({ stateProperty: 'note.status' }));
		expect(s.deliverableStateKey).toBe('');
		expect(resolvedDeliverableStateKey(s)).toBe('status');
		expect(configProblems(s)).toEqual([]);
	});
});

