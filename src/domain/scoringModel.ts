/**
 * The scoring model's own shape and what makes one fit to score with — no vault, no DOM,
 * just the arithmetic contract `docs/requirements/The scoring model is configuration.md`
 * states: how a raw value on a dimension's own range becomes a weighted contribution, and
 * what has to be true before that sum means anything.
 */

import { t } from '../i18n/t';

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

/**
 * Nothing bound at all: the guided empty state's case, distinct from a broken model. Asked
 * of `boundKeys` rather than restated, so it is the same enumeration everything else here
 * reads — spelling it out missed the three scales, and a confidence-only view reported
 * that no model was configured (false) while hiding every problem the model did have.
 */
export function estimationUnconfigured(model: ScoringModel): boolean {
	return boundKeys(model).length === 0;
}

/**
 * Every key this model binds, with the name a problem would report it by — one
 * enumeration of the slots, so `boundKeys` and the collision report below cannot come to
 * disagree about what the model binds. The labels are plain lowercase nouns because
 * `settings.sharedKey` puts them inside a sentence, which is how `configProblems` spells
 * its own for the same message.
 */
function boundEntries(model: ScoringModel): { key: string; label: string }[] {
	return [
		// The label, lowercased: this entry lands INSIDE a sentence (`settings.sharedKey` joins
		// the list into one), which is why the three scales and the two pair slots below are
		// plain lowercase nouns. `SUGGESTED_KEYS` already spells `d.label.toLowerCase()` for the
		// same reason, so this is the existing shape rather than a new one.
		...model.dimensions.map((d) => ({ key: d.key, label: d.label.toLowerCase() })),
		{ key: model.confidence.key, label: 'confidence' },
		{ key: model.effort.key, label: 'effort' },
		{ key: model.complexity.key, label: 'complexity' },
		{ key: model.valueKey, label: 'business value' },
		{ key: model.stampKey, label: 'model stamp' },
	].filter((entry) => entry.key !== '');
}

/**
 * Every frontmatter key this model binds — '' (unbound) filtered out. `estimationItems.ts`
 * reads it to know which keys a note's OWN presence counts against
 * (`EstimationItem.ownKeys`); `view/estimation/init.ts` reads the identical list to know
 * what the guided empty state's setup action must stub. One function rather than two: a
 * private near-copy here (`modelKeys`) and the setup action's own were the same nine
 * lines, caught as a clone by `npm run analyze` the day the second one was written.
 */
export function boundKeys(model: ScoringModel): string[] {
	return boundEntries(model).map((entry) => entry.key);
}

/** One dimension's own problems: its range, its rubric coverage, its property, its weight —
 *  each named by the dimension's LABEL, which is what the options panel that produced the
 *  mistake calls it. `estimationSettings.ts` resolves the label as
 *  `read.text(dimOption(id, 'label')) || shipped?.label || id`, so it is never empty and the
 *  slug is never the only name available. Sentence-initial, so the shipped labels'
 *  capitalisation is already right. */
function dimensionProblems(d: ScoringDimension): string[] {
	const problems: string[] = [];
	if (!Number.isInteger(d.min) || !Number.isInteger(d.max) || d.min >= d.max)
		problems.push(`${d.label}: the range must be two whole numbers, low to high`);
	else if (d.rubric.length !== pointCount(d.min, d.max))
		problems.push(`${d.label}: ${pointCount(d.min, d.max)} points need ${pointCount(d.min, d.max)} rubric sentences, found ${d.rubric.length}`);
	if (d.key === '') problems.push(`${d.label}: no property is bound — bind one or remove the dimension`);
	if (!(d.weight > 0)) problems.push(`${d.label}: the weight must be a positive number`);
	return problems;
}

/**
 * The pair rule: a total with no stamp is an unattributed number, a stamp with no total
 * describes a model that wrote nothing — refuse until both are named, saying which of the
 * two is missing (`docs/requirements/Business value estimation.md`'s own sentence).
 *
 * Each key is asked about on its own, which is what makes NEITHER bound a refusal too.
 * Read as "exactly one of them" it passed a dimensions-only model as fit to score, and
 * that model wrote its total and its stamp under the empty key — the one shape of this
 * rule that corrupts a note rather than leaving a number unattributed.
 */
function pairProblems(model: ScoringModel): string[] {
	const problems: string[] = [];
	if (model.valueKey === '') problems.push('the business value property is not named (the total and its stamp are one pair)');
	if (model.stampKey === '') problems.push('the model stamp property is not named (the total and its stamp are one pair)');
	return problems;
}

/**
 * Two slots on one property — the backlog's `configProblems` refusal, over this model's
 * own slots. One key written twice in one batch means the second value overwrites the
 * first (the total silently replacing the score it was computed from) and two inverses
 * for one key in the undo slot.
 */
function collisionProblems(model: ScoringModel): string[] {
	const byKey = new Map<string, string[]>();
	for (const { key, label } of boundEntries(model)) byKey.set(key, [...(byKey.get(key) ?? []), label]);
	return [...byKey]
		.filter(([, labels]) => labels.length > 1)
		// The array, not a joined string: `t` joins it in the locale of the message it
		// lands in, exactly as `configProblems` hands this same key its own list.
		.map(([key, properties]) => t('settings.sharedKey', { properties, key }));
}

/**
 * Why this model computes nothing — each problem names its dimension, the
 * config-warning shape. Empty means the model is fit to score with.
 */
export function modelProblems(model: ScoringModel): string[] {
	const problems: string[] = [];
	if (model.dimensions.length === 0) problems.push('no dimensions are declared');
	problems.push(...pairProblems(model), ...collisionProblems(model));
	let weightSum = 0;
	for (const d of model.dimensions) {
		problems.push(...dimensionProblems(d));
		if (d.weight > 0) weightSum += d.weight;
	}
	if (problems.length === 0 && Math.abs(weightSum - 100) > 1e-9) {
		// The delta, not just the sum: eight weight boxes make a transient failure guaranteed,
		// and the view draws the problem block INSTEAD of the table — so the one number the
		// reader needs is how far off they are. Arithmetic already in hand.
		//
		// `toPrecision(3)` rather than `toFixed(2)`: fixed DECIMAL places round anything under
		// half of the last one to zero, so a genuine 0.001 short (99.999 total) printed as "0
		// short" while the block above still refused it for not being at 100 — the exact
		// failure the brief warned against for a bare `Math.round`, reproduced one decimal
		// place later and caught in review. SIGNIFICANT figures don't have that failure mode:
		// they track the value's own magnitude, so 3 of them keep 13 as 13, turn 0.001 into
		// 0.001, and cannot collapse a nonzero delta to the string "0". The one thing this does
		// NOT guarantee is a tidy decimal at every magnitude — a delta smaller than about 1e-6
		// prints in exponent notation (e.g. "1.00e-7"), which is uglier but still never a false
		// zero. `test/domain/scoringModel.test.ts`'s "never prints a false zero for a real
		// sub-1 delta" pins the 99.999 case this comment used to get wrong.
		const off = Number(Math.abs(100 - weightSum).toPrecision(3));
		problems.push(`the weights total ${weightSum}, not 100 (${off} ${weightSum < 100 ? 'short' : 'over'})`);
	}
	if (!Number.isInteger(model.outputMin) || !Number.isInteger(model.outputMax) || model.outputMin >= model.outputMax)
		problems.push('the output range must be two whole numbers, low to high');
	return problems;
}
