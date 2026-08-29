import { TFile } from 'obsidian';
import { EstimationItem } from './estimationItems';
import { ScaleName } from './estimationSettings';
import { ScoringModel } from './scoringModel';
import { computeTotal, stampValue, TotalResult } from './weightedScore';

/**
 * The one place an estimation write is planned — pure, so the checkmark question ("would
 * picking this write anything") is answerable without a gate, a vault or a DOM: `null`
 * means no, and `panel.ts` renders the held point from exactly that fact rather than a
 * comparison written beside it.
 *
 * A domain module rather than a view one (ADR 0030's own footnote on this file's former
 * home, `view/estimation/scoring.ts`: "one dependency short of the split this ADR already
 * defers" — the one dependency was `PropertySet`/`PropertyWrite`, declared beside their
 * consumer in `storage/propertyWrite.ts` rather than beside the planners that produce
 * them). Both types moved here with the planners, the same "a type belongs with the code
 * that produces it" rule `domain/dropTargets.ts` states for `DropTarget`/`DropZone` —
 * `storage/propertyWrite.ts` now imports them rather than declaring them, and reads no
 * differently for it.
 */

/** One key to set. `value: null` REMOVES the key; `ifMissing` writes only when the
 *  live note lacks the key already — never overwriting an answer that is there. */
export interface PropertySet {
	key: string;
	value: unknown;
	ifMissing?: boolean;
	/**
	 * The raw value this set expects to find on the live note. When present and the live
	 * value differs, `applyPropertyWrites` refuses the WHOLE write — every set of it —
	 * rather than dropping this one: a batch whose fields have to land together is not
	 * improved by landing half of it.
	 *
	 * `applyRestores`' compare-and-swap, asked of a forward write. It exists because the
	 * live TYPE check beside it is not enough: a note can keep its type while the very
	 * field being written moves under an open dialog.
	 */
	expects?: unknown;
}

export interface PropertyWrite {
	file: TFile;
	sets: PropertySet[];
	/**
	 * The type the note must STILL be for this write to land — checked against the live
	 * frontmatter by `applyPropertyWrites`, which refuses the file (loudly) when it is not.
	 *
	 * It exists because a plan is made from a model that can be a refresh behind, and the
	 * window between a menu opening and its pick is one nothing upstream can see: a release
	 * retyped to a `PBI` in that window took the release view's status write onto a work
	 * item's own workflow state, which is the common configuration rather than an exotic one
	 * — both spell `status` (found by review, PR #211). The same rule `mayHoldField` states
	 * at the other writer: ask the LIVE type, because a retype between the plan and the write
	 * is a window nothing here can see.
	 *
	 * Optional, and the estimation view's own planners leave it unset: every row it writes is
	 * a Base result of whatever type the reader is estimating, and its one type-shaped
	 * refusal (a note that became a `Resource`) is unconditional at the writer.
	 */
	requiresType?: string;
}

export function planScoreWrite(
	model: ScoringModel,
	item: EstimationItem,
	dimensionId: string,
	value: number | null,
): PropertyWrite | null {
	const dimension = model.dimensions.find((d) => d.id === dimensionId);
	if (!dimension) return null;
	if (writesNothing(item, dimension.key, item.answers.get(dimensionId) ?? null, value)) return null;
	const next = new Map(item.answers);
	next.set(dimensionId, value);
	const sets: PropertySet[] = [{ key: dimension.key, value }, ...totalStampSets(model, item, computeTotal(model, next))];
	return { file: item.file, sets };
}

/** Confidence, effort and complexity never enter the total's arithmetic, so a scale
 *  pick touches only its own key — never the total, never the stamp. */
export function planScaleWrite(
	model: ScoringModel,
	item: EstimationItem,
	scale: ScaleName,
	value: number | null,
): PropertyWrite | null {
	const config = model[scale];
	if (config.key === '') return null;
	if (writesNothing(item, config.key, item[scale], value)) return null;
	return { file: item.file, sets: [{ key: config.key, value }] };
}

/**
 * Whether a pick would write nothing — the checkmark question, and the one rule both
 * planners above ask rather than each spelling a comparison of its own.
 *
 * A re-pick asks the VALUE. A clear asks the KEY, and that is the correction: the value
 * is what a reader made of the note, and a stub (`''`, which is exactly what the guided
 * setup action writes onto every result) and a typed word both read as no answer — so
 * comparing values made every Clear the setup action leaves behind a no-op, and left a
 * hand-typed `soon` with no way off the note but the editor. Presence is what the panel
 * DRAWS the control on (`item.ownKeys`), so asking presence here is what keeps "an
 * offered action always writes something" true in both directions.
 */
function writesNothing(item: EstimationItem, key: string, held: number | null, value: number | null): boolean {
	return value === null ? !item.ownKeys.has(key) : held === value;
}

/**
 * Removes a stored total and stamp with no live inputs behind them. Offered, and only
 * ever a write, while `item.currency` already reads 'orphan'; rendering never plans
 * this on its own.
 */
export function planOrphanCleanup(model: ScoringModel, item: EstimationItem): PropertyWrite | null {
	if (item.currency !== 'orphan') return null;
	const sets = totalStampSets(model, item, null);
	return sets.length > 0 ? { file: item.file, sets } : null;
}

/**
 * Rewrites a stored total and stamp from the answers currently on the note — the action
 * the two currencies that report a stamp problem never had.
 *
 * `writesNothing` asks `held === value`, so re-picking the score a note already holds
 * plans nothing and restamps nothing: the only route out of a `stale` total was to change a
 * score to a value the reader did not mean and then change it back. This is that route,
 * named.
 *
 * Each refusal has its own reason, though ONE guard enforces all four — which is why
 * deleting it turns three of the four refusal tests red rather than four, the fourth
 * (`orphan`) being caught by the second guard below. `current` has nothing to fix;
 * `handwritten` is a person's own number and no action offered beside a render pass may
 * overwrite it (see `currencyOf`, which asks the stamp before the inputs for that reason);
 * `orphan` has no `result` to restamp FROM, which is what `planOrphanCleanup` is for; and
 * `none` has no stored total at all.
 */
export function planRestamp(model: ScoringModel, item: EstimationItem): PropertyWrite | null {
	if (item.currency !== 'stale' && item.currency !== 'foreign') return null;
	// UNREACHABLE from a note — both those currencies already imply a result, since
	// `currencyOf` reads a stamped total with none as `orphan` and an unstamped one as
	// `handwritten`. NOT a type narrowing: `totalStampSets` takes `TotalResult | null` and
	// this function compiles without this line. What it refuses is the OPPOSITE write —
	// with no result, `totalStampSets` takes its REMOVAL path, so a restamp would delete
	// the total and stamp it was asked to refresh, which is `planOrphanCleanup`'s write
	// arriving from the wrong action.
	if (item.result === null) return null;
	// No `sets.length > 0` guard, unlike `planOrphanCleanup`: that one can plan an empty
	// removal, while `totalStampSets` given a result always returns the pair — a guard here
	// would be a refusal no input can reach.
	return { file: item.file, sets: totalStampSets(model, item, item.result) };
}

/**
 * The total+stamp pair a score change leaves behind: a fresh pair when something is
 * still answered, or their removal when nothing is — and the removal only when the note
 * actually carries the key, so a note that never had a total is not handed a delete for
 * one (`applyPropertyWrites` would no-op it anyway, but the plan should not claim a
 * write that changes nothing either).
 */
function totalStampSets(model: ScoringModel, item: EstimationItem, result: TotalResult | null): PropertySet[] {
	if (result) {
		return [
			{ key: model.valueKey, value: result.total },
			{ key: model.stampKey, value: stampValue(model, result.coverage) },
		];
	}
	const sets: PropertySet[] = [];
	if (item.ownKeys.has(model.valueKey)) sets.push({ key: model.valueKey, value: null });
	if (item.ownKeys.has(model.stampKey)) sets.push({ key: model.stampKey, value: null });
	return sets;
}
