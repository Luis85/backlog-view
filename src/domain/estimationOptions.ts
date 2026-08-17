import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { DEFAULT_DIMENSIONS, defaultDimension } from './defaultModel';
import { DEFAULT_POINT_RANGE, dimOption, resolveEstimationSettings } from './estimationSettings';
import { notePropsOnly } from './optionalProperties';

/**
 * What Bases shows in the estimation view's own options menu — this view's half of what
 * `viewOptions.ts` is for the backlog. Rubric sentences get no box here: they are stored
 * keys only, hand-editable in the `.base` this round (`docs/requirements/The scoring
 * model is configuration.md`'s "Where it lives" says so).
 */

/** The default range every dimension and the model's own output ship with, spelled from
 *  the same `DEFAULT_POINT_RANGE` `estimationSettings.ts` resolves an unparsed range to
 *  — one number pair rather than two, which used to differ if only one were ever edited. */
const DEFAULT_RANGE_TEXT = `${DEFAULT_POINT_RANGE[0]}-${DEFAULT_POINT_RANGE[1]}`;

export function getEstimationViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	// Config-aware, the WIP-boxes precedent (`viewOptions.ts`'s `progressGroup`): a
	// dimension group is offered for whichever ids are actually configured, not only the
	// shipped eight.
	const settings = resolveEstimationSettings(config);
	const ids = settings.model.dimensions.map((d) => d.id);
	return [modelGroup(), ...ids.map(dimensionGroup), scalesGroup()];
}

function modelGroup(): BasesAllOptions {
	const shippedIds = DEFAULT_DIMENSIONS.map((d) => d.id).join(', ');
	return {
		type: 'group',
		displayName: 'Model',
		items: [
			{
				type: 'text',
				key: 'dimensions',
				displayName: 'Dimensions (in order)',
				default: shippedIds,
				placeholder: shippedIds,
			},
			{
				type: 'text',
				key: 'outputRange',
				displayName: 'Output range',
				default: DEFAULT_RANGE_TEXT,
				placeholder: DEFAULT_RANGE_TEXT,
			},
			{
				type: 'property',
				key: 'valueProperty',
				displayName: 'Business value property',
				placeholder: 'business-value',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'stampProperty',
				displayName: 'Business value model stamp property',
				placeholder: 'business-value-model',
				filter: notePropsOnly,
			},
		],
	};
}

/** One dimension's group, driven by its id rather than its resolved weight — the shipped
 * weight is the option's `default`, never the CURRENT value, or a dimension already
 * overridden would show its override as though nothing had been chosen. */
function dimensionGroup(id: string): BasesAllOptions {
	const shipped = defaultDimension(id);
	const label = shipped?.label ?? id;
	const shippedWeight = shipped ? String(shipped.weight) : '';
	return {
		type: 'group',
		displayName: label,
		items: [
			{
				type: 'property',
				key: dimOption(id, 'property'),
				displayName: 'Property',
				placeholder: id,
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: dimOption(id, 'weight'),
				displayName: 'Weight',
				default: shippedWeight,
				placeholder: shippedWeight,
			},
			{
				type: 'text',
				key: dimOption(id, 'range'),
				displayName: 'Range',
				default: DEFAULT_RANGE_TEXT,
				placeholder: DEFAULT_RANGE_TEXT,
			},
			{
				type: 'toggle',
				key: dimOption(id, 'lessIsBetter'),
				displayName: 'Less is better',
				default: false,
			},
			{
				type: 'text',
				key: dimOption(id, 'label'),
				displayName: 'Label',
				default: label,
				placeholder: label,
			},
		],
	};
}

function scalesGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Scales',
		items: [
			{
				type: 'property',
				key: 'confidenceProperty',
				displayName: 'Confidence property',
				placeholder: 'confidence',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'effortProperty',
				displayName: 'Effort property',
				placeholder: 'effort',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'complexityProperty',
				displayName: 'Complexity property',
				placeholder: 'complexity',
				filter: notePropsOnly,
			},
		],
	};
}
