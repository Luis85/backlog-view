import { EstimationItem } from '../../domain/estimationItems';
import { ScaleName } from '../../domain/estimationSettings';
import { ScoringModel } from '../../domain/scoringModel';
import { computeTotal, stampValue, TotalResult } from '../../domain/weightedScore';
import { PropertySet, PropertyWrite } from '../../storage/propertyWrite';

/**
 * The one place an estimation write is planned — pure, so the checkmark question ("would
 * picking this write anything") is answerable without a gate, a vault or a DOM: `null`
 * means no, and `panel.ts` renders the held point from exactly that fact rather than a
 * comparison written beside it.
 */
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
 * ever a write, while `item.currency` already reads 'orphan' — rendering never plans
 * this on its own.
 */
export function planOrphanCleanup(model: ScoringModel, item: EstimationItem): PropertyWrite | null {
	if (item.currency !== 'orphan') return null;
	const sets = totalStampSets(model, item, null);
	return sets.length > 0 ? { file: item.file, sets } : null;
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
