import { Indicator, ScaleConfig, ScoringDimension, ScoringModel } from './scoringModel';
import { t } from '../i18n/t';

/**
 * The weighted total's own arithmetic and the stamp that says whether a written number
 * still matches it — `docs/requirements/The weighted score.md`'s rules, in code: a
 * partial profile renormalizes over what was answered, a value outside its dimension's
 * range clamps and is reported, and the total is rounded to two decimals exactly ONCE,
 * at the point of writing, so every later comparison rounds the same way rather than
 * drifting off a long unrounded number nobody chose.
 *
 * Nothing here reads a note or a vault — `estimationItems.ts` is what turns a note's
 * frontmatter into the `answers` map this module scores.
 */

export interface Coverage {
	answered: number;
	enabled: number;
}

/**
 * One answered dimension as the total actually counted it: the score AFTER the clamp and
 * after the direction, which is not the answer on the note whenever either applied.
 * Reported rather than left to be re-derived, because a decomposition beside the total is
 * only a decomposition if it lists the same values the sum used — the panel's own version
 * of this arithmetic printed the raw answer and disagreed with the number two lines below
 * it (`docs/requirements/Taking a total apart.md`).
 */
export interface Term {
	label: string;
	/** In the dimension's own units, so `label score × weight%` reads as one sentence. */
	score: number;
	weight: number;
}

export interface TotalResult {
	/** Rounded to two decimals — see `round2`. */
	total: number;
	coverage: Coverage;
	/** Dimension ids whose answer fell outside its own declared range. */
	clamped: string[];
	/** One per answered dimension, in the model's own order — see {@link Term}. */
	terms: Term[];
}

/** Two decimals, once — `docs/requirements/The scoring model is configuration.md` states why. */
export function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * One dimension's answer as the total COUNTS it: clamped to the declared range, direction
 * applied, and reported back in the dimension's own units.
 *
 * Extracted from `computeTotal` rather than restated, because the indicator's operands
 * must read a dimension exactly as the decomposition beside them reports it — a second
 * copy of this is a clone `npm run analyze` catches, and a second copy that DRIFTS is a
 * RICE whose reach disagrees with the reach two lines above it.
 */
function countAnswer(d: ScoringDimension, raw: number): { clamped: boolean; counted: number; score: number } {
	const value = Math.min(d.max, Math.max(d.min, raw));
	const proportion = (value - d.min) / (d.max - d.min);
	const counted = d.lessIsBetter ? 1 - proportion : proportion;
	return { clamped: value !== raw, counted, score: round2(d.min + counted * (d.max - d.min)) };
}

/**
 * The weighted mean, renormalized over the ANSWERED dimensions and mapped onto the
 * model's own output range. `null` for no answered dimension at all: renormalizing
 * over an empty set is not a value, so nothing is computed and nothing is written.
 *
 * Reached only once `modelProblems(model)` is empty (`estimationView.ts`'s gate), so
 * every dimension here already has a positive weight and an increasing whole-number
 * range — nothing below needs to guard against a zero weight sum or `max === min`.
 */
export function computeTotal(model: ScoringModel, answers: ReadonlyMap<string, number | null>): TotalResult | null {
	let weighted = 0;
	let weightSum = 0;
	let answered = 0;
	const clamped: string[] = [];
	const terms: Term[] = [];
	for (const d of model.dimensions) {
		const raw = answers.get(d.id);
		if (raw === null || raw === undefined) continue;
		answered++;
		const { clamped: outOfRange, counted, score } = countAnswer(d, raw);
		if (outOfRange) clamped.push(d.id);
		terms.push({ label: d.label, score, weight: d.weight });
		weighted += counted * d.weight;
		weightSum += d.weight;
	}
	if (answered === 0) return null;
	const proportion = weighted / weightSum; // renormalized: a full profile divides by 100 identically
	return {
		total: round2(model.outputMin + proportion * (model.outputMax - model.outputMin)),
		coverage: { answered, enabled: model.dimensions.length },
		clamped,
		terms,
	};
}

/**
 * An 8-hex fingerprint over every canonical arithmetic input — each dimension's range,
 * weight, direction and rubric text, plus the output range — so it moves whenever a
 * saved model would score the SAME answers differently.
 *
 * Confidence, effort and complexity are deliberately absent: they never enter the
 * total's arithmetic, so a change to either must not make a correctly current stamp
 * read as foreign.
 *
 * FNV-1a rather than a cryptographic hash: nothing here defends against a forged
 * stamp, only against a note that has quietly outlived the model that scored it, and
 * 32 bits of a well-mixed hash is far more collision resistance than that question needs.
 */
export function modelFingerprint(model: ScoringModel): string {
	return fnv1a(
		JSON.stringify({
			formula: 'weighted-mean-v1',
			output: [model.outputMin, model.outputMax],
			dimensions: model.dimensions.map((d) => [d.id, d.key, d.min, d.max, d.weight, d.lessIsBetter, d.rubric]),
		}),
	);
}

function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

/** What gets written beside the total: how much of the model answered it, and which model. */
export function stampValue(model: ScoringModel, coverage: Coverage): string {
	return `${coverage.answered}/${coverage.enabled} ${modelFingerprint(model)}`;
}

export interface ParsedStamp {
	answered: number;
	enabled: number;
	fingerprint: string;
}

/** `null` for anything not shaped like a stamp this module wrote — a hand-typed value included. */
export function parseStamp(raw: string): ParsedStamp | null {
	const match = /^(\d+)\/(\d+)\s+([0-9a-f]{8})$/.exec(raw);
	if (!match) return null;
	return { answered: Number(match[1]), enabled: Number(match[2]), fingerprint: match[3] };
}

/**
 * Whether a STORED total can be trusted. `none` and `orphan` are about there being
 * nothing, or nothing left, to judge; `handwritten` and `foreign` are about a stamp
 * that cannot vouch for the number beside it; `stale` is a stamp that vouches for a
 * different note than the one on disk now — by coverage, by the number itself, or by
 * there being no number left beside it at all.
 */
export type Currency = 'current' | 'stale' | 'foreign' | 'handwritten' | 'orphan' | 'none';

/**
 * `fingerprint` is `modelFingerprint(model)`, already computed — optional so every
 * existing caller keeps working unchanged, but `estimationItems.ts` passes its own
 * build's fingerprint once rather than paying for this per item: the model is the same
 * for every item in one build, so recomputing it in a loop was pure loop-invariant cost.
 */
export function currencyOf(
	model: ScoringModel,
	item: { storedTotal: number | null; storedStamp: string | null; result: TotalResult | null },
	fingerprint?: string,
): Currency {
	// Currency describes the STORED total; with nothing stored AND no stamp either, there is
	// nothing to judge. A stamp standing alone is not that case: it describes a total that is
	// not there, which the pair rule (`docs/requirements/Business value estimation.md`) calls a
	// model that wrote nothing, and returning 'none' for it hid the inconsistency from the
	// table and put it out of reach of every action — the note kept the stray key forever.
	// WHICH failure it is depends on the answers, not on the stamp: with none, there is
	// nothing left to judge and the cleanup removes the stamp on its own (`totalStampSets`
	// writes only the keys the note actually carries); with answers still on the note, the
	// total is recomputable and the restamp puts it back, which is the action that fits.
	if (item.storedTotal === null) {
		if (item.storedStamp === null) return 'none';
		return item.result === null ? 'orphan' : 'stale';
	}
	// THE STAMP IS ASKED BEFORE THE INPUTS, and the order is the rule rather than a
	// preference. `computeTotal` returns null at `answered === 0`, so "nobody has answered
	// a dimension" and "the answers behind this total were deleted" both arrive here as
	// `result === null` — and only the stamp tells them apart. Asked the other way round,
	// a number typed into the property editor by hand read as `orphan`, and the panel
	// offered the cleanup that deletes it (`docs/requirements/Business value
	// estimation.md`: "an absent one means it was written by hand or by something else").
	if (item.storedStamp === null) return 'handwritten';
	// A STAMPED total whose inputs are gone is an orphan — reported, removed only by action.
	if (item.result === null) return 'orphan';
	const parsed = parseStamp(item.storedStamp);
	if (!parsed || parsed.fingerprint !== (fingerprint ?? modelFingerprint(model))) return 'foreign';
	if (parsed.answered !== item.result.coverage.answered || parsed.enabled !== item.result.coverage.enabled) return 'stale';
	if (item.result.total !== round2(item.storedTotal)) return 'stale';
	return 'current';
}

/** What one item brings to an indicator — exactly the subset of `EstimationItem` that
 *  exists while the item is being built, so `estimationItems.ts` passes the fields it has
 *  rather than a second shape assembled for this. */
export interface IndicatorInputs {
	answers: ReadonlyMap<string, number | null>;
	confidence: number | null;
	effort: number | null;
	complexity: number | null;
	result: TotalResult | null;
}

/**
 * Which of the three ways an operand can block a figure. Carried rather than collapsed,
 * because the three are REPAIRED differently and a reader is looking at this to fix it:
 * an unanswered operand wants a score on the note, a nonpositive divisor wants the value
 * the note already holds corrected, and an unknown id wants the operands box edited. One
 * message for all three would be wrong about two of them — the currency chip's own rule,
 * which spends a distinct word on each failure rather than a shared one.
 */
export type IndicatorBlock = 'unanswered' | 'unknown' | 'nonpositive';

/** A figure, or the ONE operand that blocked it and why. */
export interface IndicatorFigure {
	value: number | null;
	blockedBy: { operand: string; reason: IndicatorBlock } | null;
}

/** What the arithmetic uses, what the note holds, and what to call it when either is
 *  missing. `stored` is null wherever the operand has no stored source at all (`value`,
 *  `adjustedValue`) — the divisor's own check skips those. */
interface ResolvedOperand {
	label: string;
	value: number | null;
	stored: number | null;
	/** False only for an id nothing answers to — a typo in the box, or a dimension since
	 *  removed. Distinct from `value === null`, which is an operand this item has not
	 *  answered, because the two are repaired in different places. */
	known: boolean;
}

function operandLabel(model: ScoringModel, id: string): string {
	switch (id) {
		case 'confidence':
			return t('estimation.panel.confidence');
		case 'effort':
			return t('estimation.panel.effort');
		case 'complexity':
			return t('estimation.panel.complexity');
		case 'ease':
			return t('estimation.operand.ease');
		case 'value':
			return t('estimation.operand.value');
		case 'adjustedValue':
			return t('estimation.operand.adjustedValue');
		default:
			// The dimension's own label, or the id itself where nothing answers to it: an
			// operand naming nothing is reported per item rather than as a model problem,
			// because a model problem replaces the whole table and blocks every write over a
			// figure that persists nothing.
			return model.dimensions.find((d) => d.id === id)?.label ?? id;
	}
}

/** A scale answer, CLAMPED to its declared range — the number the panel row above it
 *  reports. Raw would invert a ranking: a stored confidence of `-2` makes a product fall
 *  as its other operands rise. */
function scaleOperand(scale: ScaleConfig, held: number | null, label: string): ResolvedOperand {
	if (held === null) return { label, value: null, stored: null, known: true };
	return { label, value: Math.min(scale.max, Math.max(scale.min, held)), stored: held, known: true };
}

function resolveOperand(model: ScoringModel, inputs: IndicatorInputs, id: string): ResolvedOperand {
	const label = operandLabel(model, id);
	if (id === 'confidence') return scaleOperand(model.confidence, inputs.confidence, label);
	if (id === 'effort') return scaleOperand(model.effort, inputs.effort, label);
	if (id === 'complexity') return scaleOperand(model.complexity, inputs.complexity, label);
	if (id === 'ease') {
		// The effort scale reversed on its OWN range — `lessIsBetter` reaching a scale, not
		// `1 ÷ effort`, which is a different ranking wearing the name.
		const effort = scaleOperand(model.effort, inputs.effort, label);
		const value = effort.value === null ? null : model.effort.min + model.effort.max - effort.value;
		return { label, value, stored: effort.stored, known: true };
	}
	if (id === 'value') return { label, value: inputs.result?.total ?? null, stored: null, known: true };
	if (id === 'adjustedValue') {
		if (inputs.result === null || inputs.confidence === null) return { label, value: null, stored: null, known: true };
		const confidence = scaleOperand(model.confidence, inputs.confidence, label).value as number;
		// Rounded HERE, before it is multiplied or divided — `renderDerived`'s own order, and
		// keeping it is what makes "no in-range item's number moves" true rather than nearly
		// true: at a total of 1.01, confidence 3, effort 2, rounding first gives 0.31 and
		// rounding only the final figure gives 0.30.
		return { label, value: round2((inputs.result.total * confidence) / model.confidence.max), stored: null, known: true };
	}
	const dimension = model.dimensions.find((d) => d.id === id);
	if (!dimension) return { label, value: null, stored: null, known: false };
	const raw = inputs.answers.get(dimension.id);
	if (raw === null || raw === undefined) return { label, value: null, stored: null, known: true };
	return { label, value: countAnswer(dimension, raw).score, stored: raw, known: true };
}

/**
 * The indicator for one item: the product of its operands over its divisor, or the name
 * of the operand that blocked it — and `null` for an indicator with no operands at all,
 * which is no indicator rather than a product of one (a product of nothing is 1, which
 * would draw a column of constant ones under a blank header).
 */
export function computeIndicator(model: ScoringModel, indicator: Indicator, inputs: IndicatorInputs): IndicatorFigure | null {
	if (indicator.operands.length === 0) return null;
	let product = 1;
	for (const id of indicator.operands) {
		const operand = resolveOperand(model, inputs, id);
		if (operand.value === null) return { value: null, blockedBy: blockOf(operand) };
		product *= operand.value;
	}
	if (indicator.divisor === null) return { value: round2(product), blockedBy: null };
	const divisor = resolveOperand(model, inputs, indicator.divisor);
	// Refused at BOTH ends of the same resolution: what the note HOLDS, because a scale's
	// minimum is normally 1 and the clamp would repair exactly the case this refuses; and
	// what the model MAKES of it, because a `lessIsBetter` dimension over `0-10` answered at
	// its top resolves to 0 and would divide to Infinity while the stored value looks fine.
	if (divisor.value === null) return { value: null, blockedBy: blockOf(divisor) };
	if (divisor.value <= 0 || (divisor.stored !== null && divisor.stored <= 0)) {
		return { value: null, blockedBy: { operand: divisor.label, reason: 'nonpositive' } };
	}
	return { value: round2(product / divisor.value), blockedBy: null };
}

/** An operand with no value: unknown where nothing answers to the id, unanswered otherwise. */
function blockOf(operand: ResolvedOperand): { operand: string; reason: IndicatorBlock } {
	return { operand: operand.label, reason: operand.known ? 'unanswered' : 'unknown' };
}

/** `Reach × Business impact × Confidence ÷ Effort` — every NAME from the catalog; the two
 *  symbols are not words and are the same in every locale this ships in, so nothing here
 *  is a sentence built out of translated fragments. */
export function indicatorFormula(model: ScoringModel, indicator: Indicator): string {
	const product = indicator.operands.map((id) => operandLabel(model, id)).join(' × ');
	return indicator.divisor === null ? product : `${product} ÷ ${operandLabel(model, indicator.divisor)}`;
}
