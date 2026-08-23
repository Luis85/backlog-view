// `OPTIONAL_FIELDS` and `PROPERTY_TABLE` (`src/domain/optionalProperties.ts`) are the one
// vocabulary of write targets beyond `parent`/`order`/`type`: what a field is called,
// which key it suggests, where its configured key lands, and which of those keys a base
// with nothing set yet may adopt for itself. Moved out of `test/domain/settings.test.ts`
// (2026-08-23, alongside `release` joining the table) — these describe blocks are about
// the table itself rather than about resolving one view's configuration, and the move is
// what kept that file under its own line budget.
import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { defaultSettings } from '../../src/domain/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { configProblems } from '../../src/domain/settingsConsistency';
import {
	adoptableProperties,
	OPTIONAL_FIELDS,
	OPTIONAL_PROPERTIES,
	optionalKeyFor,
	optionalProperty,
} from '../../src/domain/optionalProperties';

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

describe('the optional-property table', () => {
	it('offers a release property, suggested beside the other optional ones', () => {
		expect(OPTIONAL_FIELDS).toContain('release');
		// The suggested name is DATA — it is what a vault writes, not text somebody reads.
		expect(optionalProperty('release').suggested).toBe('release');
	});

	it('reads its fields in declaration order, which is the order everything states them in', () => {
		// The pickers, the wording of a collision report and the backfill's stubs all
		// walk this list, so its order is user-visible rather than incidental.
		expect(OPTIONAL_PROPERTIES.map((property) => property.field)).toEqual([
			'state',
			'startedDate',
			'finishedDate',
			'horizon',
			'start',
			'target',
			'risk',
			'priority',
			'assignee',
			'deliverableState',
			'testState',
			'dependsOn',
			'iteration',
			'iterationGoal',
			'release',
		]);
		expect(OPTIONAL_FIELDS.map(optionalProperty)).toEqual(OPTIONAL_PROPERTIES);
	});
});

describe('optionalKeyFor', () => {
	it('maps each field to the property it is stored under', () => {
		const settings = settingsWith({ stateKey: 'status',
			startedDateKey: 'started',
			finishedDateKey: 'finished',
			horizonKey: 'horizon',
			startKey: 'start',
			targetKey: 'due',
			riskKey: 'risk',
			priorityKey: 'priority',
			assigneeKey: 'assignee',
			deliverableStateKey: 'deliverableStatus',
			testStateKey: 'testStatus',
			dependsOnKey: 'dependsOn',
			iterationKey: 'sprint',
			iterationGoalKey: 'goal',
		});
		// Every field of the table, so a switch that fell through would be caught here
		// rather than by whichever feature happened to read the wrong key. `release` is
		// left unconfigured here — this task adds the field, not the view option that
		// would bind it — so it reads as the unconfigured '' below rather than a name.
		expect(OPTIONAL_FIELDS.map((field) => optionalKeyFor(settings, field))).toEqual([
			'status',
			'started',
			'finished',
			'horizon',
			'start',
			'due',
			'risk',
			'priority',
			'assignee',
			'deliverableStatus',
			'testStatus',
			'dependsOn',
			'sprint',
			'goal',
			'',
		]);
		// Unconfigured is '', which every caller reads as "no key to write". Spelled as a
		// literal list rather than `OPTIONAL_FIELDS.map(() => '')`: a generated expectation
		// would agree with any table at all, including one whose new field defaulted to a
		// key. The count is part of the claim, so the list grows with the table.
		expect(OPTIONAL_FIELDS.map((field) => optionalKeyFor(defaultSettings(), field))).toEqual([
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
		]);
	});
});

describe('adoptableProperties', () => {
	it('offers the shipped key for every optional property nobody has named', () => {
		const config = fakeConfig({});

		// Thirteen, not fifteen: `deliverableState` and `testState` both suggest the SAME key
		// `state` does ('status'), and `state` is declared first, so its own adoption
		// claims 'status' before the loop ever reaches either of them — the existing
		// "don't suggest an already-taken key" guard (below) skips both, leaving the
		// Deliverable and test workflows to fall back to the shared `stateKey` rather
		// than binding a second, explicit property to the same value.
		expect(adoptableProperties(config, resolveSettings(config)).map((p) => p.suggested)).toEqual([
			'status',
			'started',
			'finished',
			'horizon',
			'start',
			'due',
			'risk',
			'priority',
			'assignee',
			'dependsOn',
			'iteration',
			'goal',
			'release',
		]);
	});

	it('leaves a property the user has already set alone', () => {
		const config = fakeConfig({ stateProperty: 'note.workflow' });

		const adoptable = adoptableProperties(config, resolveSettings(config));

		expect(adoptable.map((p) => p.option)).not.toContain('stateProperty');
		expect(adoptable.map((p) => p.option)).toContain('horizonProperty');
	});

	it('does not revive a property the user CLEARED', () => {
		// Cleared and never-set read the same to `getAsPropertyId`, which is why this
		// asks the config: turning the state property off is a decision, and an action
		// that quietly turned it back on would be overruling the user rather than
		// helping them.
		const config = fakeConfig({ horizonProperty: '' });

		expect(adoptableProperties(config, resolveSettings(config)).map((p) => p.option)).not.toContain(
			'horizonProperty',
		);
	});

	it('skips a suggestion whose key another property already owns', () => {
		// Adopting it would report as a collision and block every write in the view —
		// a worse state than the unconfigured feature it was meant to enable.
		const config = fakeConfig({ parentProperty: 'note.status' });

		const settings = resolveSettings(config);
		expect(adoptableProperties(config, settings).map((p) => p.suggested)).not.toContain('status');
		expect(configProblems(settings)).toEqual([]);
	});
});
