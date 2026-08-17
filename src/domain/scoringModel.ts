/**
 * The scoring model's own shape and what makes one fit to score with — no vault, no DOM,
 * just the arithmetic contract `docs/requirements/The scoring model is configuration.md`
 * states: how a raw value on a dimension's own range becomes a weighted contribution, and
 * what has to be true before that sum means anything.
 */

export interface ScoringDimension {
	id: string;
	label: string;
	key: string; // key '' = no property bound
	min: number;
	max: number;
	weight: number;
	lessIsBetter: boolean;
	rubric: string[]; // one sentence per point, index 0 = min
}

export interface ScaleConfig {
	key: string;
	min: number;
	max: number;
	rubric: string[];
}

export interface ScoringModel {
	dimensions: ScoringDimension[];
	outputMin: number;
	outputMax: number;
	valueKey: string;
	stampKey: string;
	confidence: ScaleConfig;
	effort: ScaleConfig;
	complexity: ScaleConfig;
}

export function pointCount(min: number, max: number): number {
	return max - min + 1;
}

/** Nothing bound at all: the guided empty state's case, distinct from a broken model. */
export function estimationUnconfigured(model: ScoringModel): boolean {
	return model.valueKey === '' && model.stampKey === '' && model.dimensions.every((d) => d.key === '');
}

/** One dimension's own problems: its range, its rubric coverage, its property, its weight. */
function dimensionProblems(d: ScoringDimension): string[] {
	const problems: string[] = [];
	if (!Number.isInteger(d.min) || !Number.isInteger(d.max) || d.min >= d.max)
		problems.push(`${d.id}: the range must be two whole numbers, low to high`);
	else if (d.rubric.length !== pointCount(d.min, d.max))
		problems.push(`${d.id}: ${pointCount(d.min, d.max)} points need ${pointCount(d.min, d.max)} rubric sentences, found ${d.rubric.length}`);
	if (d.key === '') problems.push(`${d.id}: no property is bound — bind one or remove the dimension`);
	if (!(d.weight > 0)) problems.push(`${d.id}: the weight must be a positive number`);
	return problems;
}

/**
 * The pair rule: a total with no stamp is an unattributed number, a stamp with no total
 * describes a model that wrote nothing — refuse until both are named.
 */
function pairProblems(model: ScoringModel): string[] {
	const problems: string[] = [];
	if (model.valueKey !== '' && model.stampKey === '') problems.push('the model stamp property is not named (the total and its stamp are one pair)');
	if (model.stampKey !== '' && model.valueKey === '') problems.push('the business value property is not named (the total and its stamp are one pair)');
	return problems;
}

/**
 * Why this model computes nothing — each problem names its dimension, the
 * config-warning shape. Empty means the model is fit to score with.
 */
export function modelProblems(model: ScoringModel): string[] {
	const problems: string[] = [];
	if (model.dimensions.length === 0) problems.push('no dimensions are declared');
	problems.push(...pairProblems(model));
	let weightSum = 0;
	for (const d of model.dimensions) {
		problems.push(...dimensionProblems(d));
		if (d.weight > 0) weightSum += d.weight;
	}
	if (problems.length === 0 && Math.abs(weightSum - 100) > 1e-9)
		problems.push(`the weights total ${weightSum}, not 100`);
	if (!Number.isInteger(model.outputMin) || !Number.isInteger(model.outputMax) || model.outputMin >= model.outputMax)
		problems.push('the output range must be two whole numbers, low to high');
	return problems;
}
