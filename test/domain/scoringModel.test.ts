import { describe, expect, it } from 'vitest';
import { boundKeys, modelProblems, estimationUnconfigured, pointCount, ScaleConfig, ScoringDimension, ScoringModel } from '../../src/domain/scoringModel';
import { dimRubricOption, resolveEstimationSettings, scaleRubricOption } from '../../src/domain/estimationSettings';
import { SUGGESTED_KEYS } from '../../src/domain/defaultModel';
import { FakeViewConfig } from '../helpers/vault';
import { configured, configuredValues } from '../helpers/estimationModel';

/** A five-point dimension fixture with every `ScoringDimension` field filled — this suite
 *  asserts `modelProblems` against a hand-built model, below `resolveEstimationSettings`,
 *  so nothing here can lean on ITS fallbacks (a shipped label, a shipped weight) to paper
 *  over a field this helper forgot to set. */
function dimension(id: string): ScoringDimension {
	return { id, label: id, key: `note.${id}`, min: 1, max: 5, weight: 10, lessIsBetter: false, rubric: ['a', 'b', 'c', 'd', 'e'] };
}

function scale(key: string): ScaleConfig {
	return { key, min: 1, max: 5, rubric: ['a', 'b', 'c', 'd', 'e'] };
}

/** A valid, empty-dimensions `ScoringModel` fixture — `configured()` in `estimationModel.ts`
 *  builds the shipped model through the resolver; this one is for a test asserting
 *  `modelProblems` directly against a shape it built by hand. */
function modelWith(overrides: Partial<ScoringModel> = {}): ScoringModel {
	return {
		dimensions: [],
		outputMin: 1,
		outputMax: 100,
		valueKey: 'note.value',
		stampKey: 'note.stamp',
		confidence: scale('note.confidence'),
		effort: scale('note.effort'),
		complexity: scale('note.complexity'),
		...overrides,
	};
}

describe('the scoring model configuration', () => {
	it('resolves the shipped default model: eight dimensions, weights totalling 100, five rubric sentences each', () => {
		const model = configured();
		expect(model.dimensions.map((d) => d.id)).toEqual([
			'strategic-alignment', 'customer-value', 'business-impact', 'reach',
			'risk-reduction', 'compliance', 'time-criticality', 'enablement',
		]);
		expect(model.dimensions.reduce((sum, d) => sum + d.weight, 0)).toBe(100);
		for (const d of model.dimensions) expect(d.rubric).toHaveLength(5);
		expect(modelProblems(model, 'type')).toEqual([]);
	});
	it('a fresh view is unconfigured, not broken', () => {
		const model = resolveEstimationSettings(new FakeViewConfig({})).model;
		expect(estimationUnconfigured(model)).toBe(true);
	});
	it('refuses a zero or negative weight, naming the dimension', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimWeight.reach': '0', 'dimWeight.compliance': '20' }));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/reach/i);
	});
	it('refuses weights that do not total 100', () => {
		// Every other dimension stays bound and valid — otherwise the unbound-property
		// problems win the `modelProblems` gate before the weight total is ever checked
		// (see `configuredValues`).
		const s = resolveEstimationSettings(new FakeViewConfig(configuredValues({ 'dimWeight.enablement': '10' })));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/100/);
	});
	it('refuses a range that is not increasing whole integers, naming the dimension', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRange.reach': '5-1' }));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/reach/i);
	});
	it('a widened range reports the points with no rubric sentence rather than inventing one', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimRange.reach': '1-7' }));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/reach/i);
	});
	it('the total and its stamp are one pair: exactly one bound names the missing other', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ valueProperty: 'note.business-value' }));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/stamp/i);
	});
	it('the pair rule holds in the other direction too: a stamp with no total', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ stampProperty: 'note.business-value-model' }));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/business value property/i);
	});
	it('refuses a model with dimensions bound and NEITHER of the pair, naming both', () => {
		// The epic's own sentence: scoring is offered only where both are bound, and the
		// view refuses until both are named. Neither bound is not "no opinion" — with
		// something else bound this is a model that would score and write its total
		// nowhere, and the keys it would write under are ''.
		const { valueProperty: _v, stampProperty: _s, ...dimensionsOnly } = configuredValues();
		const problems = modelProblems(resolveEstimationSettings(new FakeViewConfig(dimensionsOnly)).model);
		expect(problems.join(' ')).toMatch(/business value property/i);
		expect(problems.join(' ')).toMatch(/stamp/i);
	});
	it('refuses one property bound to two slots, naming both', () => {
		// One key, two writes in one batch: the total silently overwrites the score, and
		// the undo slot holds two inverses for the same key. `configProblems` refuses the
		// backlog's own collisions for the same reason.
		const s = resolveEstimationSettings(new FakeViewConfig(configuredValues({ 'dimProperty.reach': 'note.business-value' })));
		const problems = modelProblems(s.model, 'type').join(' ');
		expect(problems).toMatch(/reach/i);
		expect(problems).toMatch(/business value/i);
		expect(problems).toMatch(/business-value/);
	});
	it('an emptied dimensions list is declared, not defaulted — no dimensions at all', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ dimensions: '' }));
		expect(modelProblems(s.model, 'type')).toContain('no dimensions are declared');
	});
	it('refuses an output range that is not increasing whole integers', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ outputRange: '5-1' }));
		expect(modelProblems(s.model, 'type').join(' ')).toMatch(/output range/i);
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

describe('unconfigured is "this model binds nothing", one definition', () => {
	it('a scale-only binding is a CONFIGURED model with problems, not an untouched one', () => {
		// A confidence property and nothing else: the guided empty state would say no model
		// is configured, which is false, and would hide every problem the model does have.
		const model = resolveEstimationSettings(new FakeViewConfig({ confidenceProperty: 'note.confidence' })).model;
		expect(boundKeys(model)).toEqual(['confidence']);
		expect(estimationUnconfigured(model)).toBe(false);
		expect(modelProblems(model, 'type').length).toBeGreaterThan(0);
	});
});

describe('a hand-edited option is read as the .base spells it', () => {
	it('a numeric weight is the weight, not a silent fall back to the shipped one', () => {
		// `dimWeight.reach: 30` unquoted is YAML for the NUMBER 30. Read as a string it is
		// nothing, and the shipped 10 applied behind the user's back — a model scoring by
		// weights the view options are not showing.
		const s = resolveEstimationSettings(new FakeViewConfig(configuredValues({ 'dimWeight.reach': 30 })));
		expect(s.model.dimensions.find((d) => d.id === 'reach')?.weight).toBe(30);
	});
	it('a numeric label and rubric sentence read as their own digits', () => {
		const s = resolveEstimationSettings(new FakeViewConfig({ 'dimLabel.reach': 2026, 'dimRubric.reach.3': 42 }));
		const reach = s.model.dimensions.find((d) => d.id === 'reach');
		expect(reach?.label).toBe('2026');
		expect(reach?.rubric[2]).toBe('42');
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

describe('a dimension is named the way the panel names it', () => {
	it('names each problem by the label, never by the slug', () => {
		// The existing assertions above match on /reach/i, which passes for the id AND the
		// label — so this is a NEW assertion naming the label exactly, not a tightening of
		// one that would have passed either way.
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 0 }] });
		expect(modelProblems(model, 'type')).toContain('Reach: the weight must be a positive number');
	});

	it('names an OVERRIDDEN label by the override', () => {
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Blast radius', weight: 0 }] });
		expect(modelProblems(model, 'type').join(' ')).toContain('Blast radius');
		expect(modelProblems(model, 'type').join(' ')).not.toContain('reach:');
	});

	it('states how far off the weights are, because that is the number to type', () => {
		// There are eight weight boxes and the view draws the problem block INSTEAD of the
		// table, so editing one is a guaranteed transient failure state whose only feedback is
		// the whole view disappearing. The delta is arithmetic already in hand.
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 87 }] });
		expect(modelProblems(model, 'type')).toContain('the weights total 87, not 100 (13 short)');
	});

	it('says over rather than short when the weights exceed 100', () => {
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 110 }] });
		expect(modelProblems(model, 'type')).toContain('the weights total 110, not 100 (10 over)');
	});

	it('never prints a false zero for a real sub-1 delta — significant figures, not decimal places', () => {
		// `toFixed(2)` rounds anything under 0.005 to "0.00", which would tell the reader they
		// are zero short of 100 while the block above refuses them for not being at 100 — the
		// exact failure the brief warned against for `Math.round`, reproduced one decimal
		// place later. `toPrecision` keeps significant figures regardless of magnitude, so
		// 0.001 prints as 0.001 rather than 0.
		const model = modelWith({ dimensions: [{ ...dimension('reach'), label: 'Reach', weight: 99.999 }] });
		expect(modelProblems(model, 'type')).toContain('the weights total 99.999, not 100 (0.001 short)');
	});

	it('refuses a type property that collides with a scoring key', () => {
		// The type key is deliberately OUTSIDE `model` — `modelFingerprint` hashes that
		// object to decide whether a stored total can still be trusted, and a key unrelated
		// to the score must not be able to invalidate one. That is exactly why it was
		// invisible to this check: point it at a dimension's property and the config passed,
		// and the next score pick wrote a number over the note's own type — misclassifying
		// it, or taking it out of the backlog entirely.
		const model = modelWith({ dimensions: [{ ...dimension('reach'), key: 'note.kind' }] });
		expect(modelProblems(model, 'note.kind').join(' ')).toMatch(/type/);
		// And an UNBOUND type key collides with nothing, like every other unnamed key here.
		// Asserted against the collision sentence rather than an empty list: this fixture's
		// one dimension weighs 10, so the weights problem is present either way and says
		// nothing about the subject.
		expect(modelProblems(model, '').join(' ')).not.toMatch(/type/);
	});

	it('puts a dimension inside the collision sentence in lowercase', () => {
		// `settings.sharedKey` joins the list into ONE sentence, which is why the three scales
		// and the two pair slots beside it are plain lowercase nouns. `SUGGESTED_KEYS` already
		// spells `d.label.toLowerCase()` for the same reason.
		//
		// The fixture's id (`reach`) and label (`Blast radius`) differ by more than case ON
		// PURPOSE: a label that differs from its id only by capitalisation (`Reach` vs
		// `reach`) cannot tell "read the id" from "read the label, lowercased" apart — both
		// readings produce the string `reach`. `Blast radius` is what the id-reading old
		// `boundEntries` would still spell as `reach`, so only the label-reading spells
		// `blast radius`.
		const model = modelWith({
			dimensions: [{ ...dimension('reach'), label: 'Blast radius', key: 'note.shared' }],
			confidence: { key: 'note.shared', min: 1, max: 5, rubric: [] },
		});
		expect(modelProblems(model, 'type').join(' ')).toContain('blast radius');
		expect(modelProblems(model, 'type').join(' ')).not.toContain('reach');
	});
});
