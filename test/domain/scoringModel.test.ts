import { describe, expect, it } from 'vitest';
import { boundKeys, modelProblems, estimationUnconfigured, pointCount } from '../../src/domain/scoringModel';
import { dimRubricOption, resolveEstimationSettings, scaleRubricOption } from '../../src/domain/estimationSettings';
import { SUGGESTED_KEYS } from '../../src/domain/defaultModel';
import { FakeViewConfig } from '../helpers/vault';
import { configured, configuredValues } from '../helpers/estimationModel';

describe('the scoring model configuration', () => {
	it('resolves the shipped default model: eight dimensions, weights totalling 100, five rubric sentences each', () => {
		const model = configured();
		expect(model.dimensions.map((d) => d.id)).toEqual([
			'strategic-alignment', 'customer-value', 'business-impact', 'reach',
			'risk-reduction', 'compliance', 'time-criticality', 'enablement',
		]);
		expect(model.dimensions.reduce((sum, d) => sum + d.weight, 0)).toBe(100);
		for (const d of model.dimensions) expect(d.rubric).toHaveLength(5);
		expect(modelProblems(model)).toEqual([]);
	});
	it('a fresh view is unconfigured, not broken', () => {
		const model = resolveEstimationSettings(new FakeViewConfig({})).model;
		expect(estimationUnconfigured(model)).toBe(true);
	});
	it('refuses a zero or negative weight, naming the dimension', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimWeight.reach': '0', 'dimWeight.compliance': '20' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/reach/i);
	});
	it('refuses weights that do not total 100', () => {
		// Every other dimension stays bound and valid — otherwise the unbound-property
		// problems win the `modelProblems` gate before the weight total is ever checked
		// (see `configuredValues`).
		const s = resolveEstimationSettings(new FakeViewConfig(configuredValues({ 'dimWeight.enablement': '10' })));
		expect(modelProblems(s.model).join(' ')).toMatch(/100/);
	});
	it('refuses a range that is not increasing whole integers, naming the dimension', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRange.reach': '5-1' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/reach/i);
	});
	it('a widened range reports the points with no rubric sentence rather than inventing one', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRange.reach': '1-7' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/reach/i);
	});
	it('the total and its stamp are one pair: exactly one bound names the missing other', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ valueProperty: 'note.business-value' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/stamp/i);
	});
	it('the pair rule holds in the other direction too: a stamp with no total', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ stampProperty: 'note.business-value-model' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/business value property/i);
	});
	it('an emptied dimensions list is declared, not defaulted — no dimensions at all', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ dimensions: '' }));
		expect(modelProblems(s.model)).toContain('no dimensions are declared');
	});
	it('refuses an output range that is not increasing whole integers', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ outputRange: '5-1' }));
		expect(modelProblems(s.model).join(' ')).toMatch(/output range/i);
	});
});

describe('boundKeys', () => {
	it('lists every dimension, scale, value and stamp key the model binds, unbound ("") filtered out', () => {
		expect(boundKeys(configured())).toEqual([
			'strategic-alignment', 'customer-value', 'business-impact', 'reach',
			'risk-reduction', 'compliance', 'time-criticality', 'enablement',
			'business-value', 'business-value-model',
		]);
	});
	it('an unbound model binds nothing', () => {
		expect(boundKeys(resolveEstimationSettings(new FakeViewConfig({})).model)).toEqual([]);
	});
});

describe('a dimension outside the shipped eight has no shipped default to fall back to', () => {
	it('an unknown id in a custom dimensions list gets weight 0 and its own id as its label', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ dimensions: 'my-custom-dimension' }));
		const [d] = s.model.dimensions;
		expect(d.id).toBe('my-custom-dimension');
		expect(d.label).toBe('my-custom-dimension');
		expect(d.weight).toBe(0);
		// No shipped sentence exists for it either, at any point in its default range.
		expect(d.rubric).toEqual([]);
	});
});

describe('an explicit override wins over the shipped rubric and label', () => {
	it('a dimLabel override replaces the shipped label', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimLabel.reach': 'Market reach' }));
		expect(s.model.dimensions.find((d) => d.id === 'reach')?.label).toBe('Market reach');
	});
	it('a dimRubric override replaces the shipped sentence at that point', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRubric.reach.3': 'Half the org' }));
		expect(s.model.dimensions.find((d) => d.id === 'reach')?.rubric[2]).toBe('Half the org');
	});
	it('a scaleRubric override replaces the shipped sentence for that scale and point', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'scaleRubric.confidence.1': 'A hunch' }));
		expect(s.model.confidence.rubric[0]).toBe('A hunch');
	});
});

describe('the option-key format is a persisted contract', () => {
	it('a range names exactly its own point count', () => {
		expect(pointCount(1, 5)).toBe(5);
		expect(pointCount(1, 7)).toBe(7);
	});
	it('a dimension rubric key names the dimension and the point', () => {
		expect(dimRubricOption('reach', 3)).toBe('dimRubric.reach.3');
	});
	it('a scale rubric key names the scale and the point', () => {
		expect(scaleRubricOption('confidence', 2)).toBe('scaleRubric.confidence.2');
	});
	it('SUGGESTED_KEYS covers the eight dimensions plus confidence, effort, complexity, value and stamp', () => {
		expect(SUGGESTED_KEYS).toHaveLength(13);
		const options = SUGGESTED_KEYS.map((s) => s.option);
		expect(options).toContain('dimProperty.reach');
		expect(options).toContain('confidenceProperty');
		expect(options).toContain('effortProperty');
		expect(options).toContain('complexityProperty');
		expect(options).toContain('valueProperty');
		expect(options).toContain('stampProperty');
	});
});
