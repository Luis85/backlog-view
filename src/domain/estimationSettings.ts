import { BasesViewConfig } from 'obsidian';
import { configReaders } from './settingsResolve';
import { DEFAULT_DIMENSIONS, DEFAULT_SCALE_RUBRICS, defaultDimension } from './defaultModel';
import { OpenTarget, resolveItemHandling } from './itemHandling';
import { Indicator, ScaleConfig, ScoringDimension, ScoringModel } from './scoringModel';

/**
 * Reading the estimation view's own options into a `ScoringModel` — this view's half of
 * what `settingsResolve.ts` is for the backlog, over the same `configReaders` closures so
 * "never set" and "cleared" mean the same thing in both `.base` schemas.
 */

export interface EstimationSettings {
	model: ScoringModel;
	/** BESIDE the model, never inside it: an indicator persists nothing, so nothing that
	 *  fingerprints or writes the total can reach it (`scoringModel.ts`'s own note). */
	indicator: Indicator;
	/** Where opening the note being scored lands — `resolveItemHandling`'s own vocabulary,
	 *  defaulted to `split` rather than the backlog's `active` (see `resolveEstimationSettings`). */
	openIn: OpenTarget;
}

export type DimField = 'property' | 'weight' | 'range' | 'lessIsBetter' | 'label';
export type ScaleName = 'confidence' | 'effort' | 'complexity';

const capitalize = (field: string): string => field.charAt(0).toUpperCase() + field.slice(1);

/** The option key one dimension field is stored under — persisted, so the capitalization is load-bearing. */
export function dimOption(id: string, field: DimField): string {
	return `dim${capitalize(field)}.${id}`;
}

/** The option key one dimension's rubric sentence for a given point is stored under. */
export function dimRubricOption(id: string, point: number): string {
	return `dimRubric.${id}.${point}`;
}

/** The option key one of the three fixed scales' rubric sentence for a given point is stored under. */
export function scaleRubricOption(scale: ScaleName, point: number): string {
	return `scaleRubric.${scale}.${point}`;
}

/** The fixed scales' own range, and the fallback for a dimension's unparsed one — shared
 *  with `estimationOptions.ts` so the shipped range text shown in the view options is
 *  spelled from this pair rather than as an independent `'1-5'` literal. */
export const DEFAULT_POINT_RANGE: [number, number] = [1, 5];

/**
 * `min-max`, both whole numbers. Unparseable text keeps the fallback; a WRONG range
 * (5-1) resolves as stated and is refused by `modelProblems`, which is where refusals
 * speak — never silently here.
 */
function parseRange(text: string, fallback: [number, number]): [number, number] {
	const match = /^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/.exec(text);
	return match ? [Number(match[1]), Number(match[2])] : fallback;
}

type Readers = ReturnType<typeof configReaders>;

/** The shipped indicator — exactly what `panel.ts` hardcoded before this: the
 *  confidence-adjusted value over effort. An existing saved view's number does not move. */
const DEFAULT_INDICATOR: Indicator = { label: '', operands: ['adjustedValue'], divisor: 'effort' };

/**
 * `clearable` for both lists, and that is the whole rule: an option whose default is a
 * REAL value has to tell "never set" from "cleared", or a reader can never turn the
 * indicator off — and turning it off is how the seventh column goes away again.
 */
function resolveIndicator(read: Readers): Indicator {
	return {
		// Trimmed for the same reason the divisor is: the header draws it with a plain
		// `indicator.label || …`, so a whitespace-only name would be truthy and suppress the
		// generic `Indicator` fallback — a blank, blank-named column.
		label: read.text('indicatorLabel').trim(),
		operands: read.clearable('indicatorOperands', DEFAULT_INDICATOR.operands, () => read.list('indicatorOperands')),
		// Trimmed to match: `list` trims every operand id, so an untrimmed divisor would
		// disagree with the same vocabulary over a hand-edited or pasted space — read as an
		// unknown name when padded, and as un-clearable when whitespace-only (`|| null` never
		// fires on a truthy blank string).
		divisor: read.clearable('indicatorDivisor', DEFAULT_INDICATOR.divisor, () => read.text('indicatorDivisor').trim() || null),
	};
}

/**
 * One dimension's rubric, point by point: an override, else the shipped sentence at that
 * ABSOLUTE point (index `point - 1`, so widening a range never renumbers the points it
 * already had meanings for), else nothing — a missing point is omitted rather than
 * invented, which is what lets `modelProblems`' plain length check name the gap.
 */
function resolveDimRubric(read: Readers, id: string, min: number, max: number, shipped: { rubric: string[] } | null): string[] {
	const rubric: string[] = [];
	for (let point = min; point <= max; point++) {
		const override = read.text(dimRubricOption(id, point));
		if (override !== '') {
			rubric.push(override);
			continue;
		}
		const index = point - 1;
		if (shipped && index >= 0 && index < shipped.rubric.length) rubric.push(shipped.rubric[index]);
	}
	return rubric;
}

function resolveDimension(read: Readers, id: string): ScoringDimension {
	const shipped = defaultDimension(id);
	const [min, max] = parseRange(read.text(dimOption(id, 'range')), DEFAULT_POINT_RANGE);
	const weightText = read.text(dimOption(id, 'weight'));
	// Set: the typed number, whatever it is. Unset: the shipped weight, or 0 for an id
	// with no shipped row at all — `modelProblems` refuses either non-positive result.
	const weight = weightText !== '' ? Number(weightText) : (shipped?.weight ?? 0);
	const label = read.text(dimOption(id, 'label')) || shipped?.label || id;
	return {
		id,
		label,
		key: read.propKey(dimOption(id, 'property'), ''),
		min,
		max,
		weight,
		lessIsBetter: read.bool(dimOption(id, 'lessIsBetter'), false),
		rubric: resolveDimRubric(read, id, min, max, shipped),
	};
}

/** A fixed 1–5 scale (confidence, effort, complexity): only its property and its rubric sentences are configurable this round. */
function resolveScale(read: Readers, scale: ScaleName, optionKey: string): ScaleConfig {
	const [min, max] = DEFAULT_POINT_RANGE;
	const rubric = DEFAULT_SCALE_RUBRICS[scale].map((shippedSentence, i) => {
		const override = read.text(scaleRubricOption(scale, i + 1));
		return override !== '' ? override : shippedSentence;
	});
	return { key: read.propKey(optionKey, ''), min, max, rubric };
}

export function resolveEstimationSettings(config: BasesViewConfig): EstimationSettings {
	const read = configReaders(config);
	const ids = read.dedupe(read.clearable('dimensions', DEFAULT_DIMENSIONS.map((d) => d.id), () => read.list('dimensions')));
	const [outputMin, outputMax] = parseRange(read.text('outputRange'), DEFAULT_POINT_RANGE);
	return {
		model: {
			dimensions: ids.map((id) => resolveDimension(read, id)),
			outputMin,
			outputMax,
			valueKey: read.propKey('valueProperty', ''),
			stampKey: read.propKey('stampProperty', ''),
			confidence: resolveScale(read, 'confidence', 'confidenceProperty'),
			effort: resolveScale(read, 'effort', 'effortProperty'),
			complexity: resolveScale(read, 'complexity', 'complexityProperty'),
		},
		indicator: resolveIndicator(read),
		// `split` rather than `active`: this view is the surface being scored on.
		openIn: resolveItemHandling(config, 'split').openIn,
	};
}
