import { BasesViewConfig } from 'obsidian';
import { configReaders } from './settingsResolve';
import { DEFAULT_DIMENSIONS, DEFAULT_SCALE_RUBRICS, defaultDimension } from './defaultModel';
import { ScaleConfig, ScoringDimension, ScoringModel } from './scoringModel';

/**
 * Reading the estimation view's own options into a `ScoringModel` — this view's half of
 * what `settingsResolve.ts` is for the backlog, over the same `configReaders` closures so
 * "never set" and "cleared" mean the same thing in both `.base` schemas.
 */

export interface EstimationSettings {
	model: ScoringModel;
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

const DEFAULT_POINT_RANGE: [number, number] = [1, 5];

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

/**
 * One dimension's rubric, point by point: an override, else the shipped sentence at that
 * ABSOLUTE point (index `point - 1`, so widening a range never renumbers the points it
 * already had meanings for), else nothing — a missing point is omitted rather than
 * invented, which is what lets `modelProblems`' plain length check name the gap.
 */
function resolveDimRubric(read: Readers, id: string, min: number, max: number, shipped: { rubric: string[] } | null): string[] {
	const rubric: string[] = [];
	for (let point = min; point <= max; point++) {
		const override = read.str(dimRubricOption(id, point));
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
	const [min, max] = parseRange(read.str(dimOption(id, 'range')), DEFAULT_POINT_RANGE);
	const weightText = read.str(dimOption(id, 'weight'));
	// Set: the typed number, whatever it is. Unset: the shipped weight, or 0 for an id
	// with no shipped row at all — `modelProblems` refuses either non-positive result.
	const weight = weightText !== '' ? Number(weightText) : (shipped?.weight ?? 0);
	const label = read.str(dimOption(id, 'label')) || shipped?.label || id;
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
		const override = read.str(scaleRubricOption(scale, i + 1));
		return override !== '' ? override : shippedSentence;
	});
	return { key: read.propKey(optionKey, ''), min, max, rubric };
}

export function resolveEstimationSettings(config: BasesViewConfig): EstimationSettings {
	const read = configReaders(config);
	const ids = read.dedupe(read.clearable('dimensions', DEFAULT_DIMENSIONS.map((d) => d.id), () => read.list('dimensions')));
	const [outputMin, outputMax] = parseRange(read.str('outputRange'), DEFAULT_POINT_RANGE);
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
	};
}
