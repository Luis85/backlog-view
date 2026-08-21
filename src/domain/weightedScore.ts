import { ScoringModel } from './scoringModel';

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
		const value = Math.min(d.max, Math.max(d.min, raw));
		if (value !== raw) clamped.push(d.id);
		const proportion = (value - d.min) / (d.max - d.min);
		const counted = d.lessIsBetter ? 1 - proportion : proportion;
		// The same proportion, back in the dimension's own units — reported rather than
		// the raw answer, because that is the number this sum used.
		terms.push({ label: d.label, score: round2(d.min + counted * (d.max - d.min)), weight: d.weight });
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
 * different note than the one on disk now, by coverage or by the number itself.
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
	// Currency describes the STORED total; with nothing stored there is nothing to judge.
	if (item.storedTotal === null) return 'none';
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
