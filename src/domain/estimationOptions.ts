import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { DEFAULT_DIMENSIONS, defaultDimension } from './defaultModel';
import { DEFAULT_POINT_RANGE, dimOption, resolveEstimationSettings } from './estimationSettings';
import { defaultItemHandling, openTargetOptions } from './itemHandling';
import { notePropsOnly } from './optionalProperties';
import type { ScoringDimension } from './scoringModel';

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
	return [modelGroup(), ...settings.model.dimensions.map(dimensionGroup), scalesGroup(), indicatorGroup()];
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
			{
				type: 'dropdown',
				key: 'openIn',
				displayName: 'Open in',
				options: openTargetOptions(),
				default: defaultItemHandling('split').openIn,
			},
		],
	};
}

/** One dimension's group. Every BOX's `default` and `placeholder` is the SHIPPED value,
 * never the CURRENT one, or a dimension already overridden would show its override as
 * though nothing had been chosen — which is why `shipped` is still read here beside the
 * resolved `d`.
 *
 * The group's HEADING is the exception, and it is not an exception to that rule: a heading
 * is not a candidate value. It names which dimension the boxes belong to, so it takes the
 * RESOLVED label — the same words the panel row inside it shows. Headed by
 * `defaultDimension(id)?.label ?? id`, a dimension outside the shipped eight was headed by
 * its slug and an overridden one by the shipped word while its own Label box held the
 * override. */
function dimensionGroup(d: ScoringDimension): BasesAllOptions {
	const { id } = d;
	const shipped = defaultDimension(id);
	const shippedLabel = shipped?.label ?? id;
	const shippedWeight = shipped ? String(shipped.weight) : '';
	return {
		type: 'group',
		displayName: d.label,
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
				// The rule at the box that produces the mistake, before it is made. The refusal
				// itself stays and is register-backed (`Configuring the estimation model`
				// extension 3b): at a sum of 87 a full profile divides by 87 and the model stops
				// being the one `The scoring model is configuration` specifies. A live running
				// total is REFUSED — `BasesOption` is `{ type, displayName, shouldHide? }`, so it
				// would be a new control, which is a feature.
				displayName: 'Weight (% of 100)',
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
				default: shippedLabel,
				placeholder: shippedLabel,
			},
		],
	};
}

/** The indicator's three boxes. Text, not a property picker: an operand is an id from this
 *  model's own vocabulary, never a frontmatter key. Editing one is what "editable
 *  afterwards" means — swapping an operand or dropping the divisor is an edit to a box, so
 *  no new control type is needed. */
function indicatorGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Indicator',
		items: [
			{
				type: 'text',
				key: 'indicatorLabel',
				displayName: 'Name',
				placeholder: 'RICE',
			},
			{
				type: 'text',
				key: 'indicatorOperands',
				displayName: 'Operands (multiplied, in order)',
				default: 'adjustedValue',
				placeholder: 'adjustedValue',
			},
			{
				type: 'text',
				key: 'indicatorDivisor',
				displayName: 'Divisor',
				default: 'effort',
				placeholder: 'effort',
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
