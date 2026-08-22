import { resolveEstimationSettings } from '../../src/domain/estimationSettings';
import { ScoringModel } from '../../src/domain/scoringModel';
import { FakeViewConfig } from './vault';

/**
 * The shipped default model's config values, fully bound: every dimension property plus
 * the value and stamp properties named, nothing else configured — merged with `overrides`
 * so a test can tweak one option (a weight, a range) while keeping every OTHER dimension
 * valid. Without that merge, a fixture naming only the one option under test leaves every
 * dimension unbound, and `modelProblems`' weight-total check never reaches: it fires only
 * once every per-dimension problem is already clean.
 */
export function configuredValues(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		valueProperty: 'note.business-value',
		stampProperty: 'note.business-value-model',
		'dimProperty.strategic-alignment': 'note.strategic-alignment',
		'dimProperty.customer-value': 'note.customer-value',
		'dimProperty.business-impact': 'note.business-impact',
		'dimProperty.reach': 'note.reach',
		'dimProperty.risk-reduction': 'note.risk-reduction',
		'dimProperty.compliance': 'note.compliance',
		'dimProperty.time-criticality': 'note.time-criticality',
		'dimProperty.enablement': 'note.enablement',
		...overrides,
	};
}

/**
 * The shipped default model, fully bound. Shared by the domain suite and the view suite
 * so both argue from the same "everything is fine" shape — see
 * `test/domain/scoringModel.test.ts` and `test/view/estimation/states.test.ts`.
 */
export function configured(overrides: Record<string, unknown> = {}): ScoringModel {
	return resolveEstimationSettings(new FakeViewConfig(configuredValues(overrides))).model;
}
