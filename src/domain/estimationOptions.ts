import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { DEFAULT_DIMENSIONS, defaultDimension } from './defaultModel';
import { DEFAULT_POINT_RANGE, dimOption, resolveEstimationSettings } from './estimationSettings';
import { notePropsOnly } from './optionalProperties';
import type { ScoringDimension } from './scoringModel';
import { t } from '../i18n/t';

/**
 * What Bases shows in the estimation view's own options menu — this view's half of what
 * `viewOptions.ts` is for the backlog. Rubric sentences get no box here: they are stored
 * keys only, hand-editable in the `.base` this round (`docs/requirements/The scoring
 * model is configuration.md`'s "Where it lives" says so).
 *
 * **Text and data sit on adjacent lines of the same object literal** here exactly as they
 * do in `viewOptions.ts`, and the split is the same: a `displayName` is text and comes
 * from `t()`; a `key`, a `default` and a `placeholder` are read back by
 * `resolveEstimationSettings` or adopted by the backfill, so they are spelled here. Every
 * placeholder in this file is of the data kind — a frontmatter key a picker suggests, or a
 * box's own default mirrored so clearing it falls back to the string on screen.
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
	return [modelGroup(), ...settings.model.dimensions.map(dimensionGroup), scalesGroup()];
}

function modelGroup(): BasesAllOptions {
	const shippedIds = DEFAULT_DIMENSIONS.map((d) => d.id).join(', ');
	return {
		type: 'group',
		displayName: t('estimation.option.model'),
		items: [
			{
				type: 'text',
				key: 'dimensions',
				displayName: t('estimation.option.dimensions'),
				default: shippedIds,
				placeholder: shippedIds,
			},
			{
				type: 'text',
				key: 'outputRange',
				displayName: t('estimation.option.outputRange'),
				default: DEFAULT_RANGE_TEXT,
				placeholder: DEFAULT_RANGE_TEXT,
			},
			{
				// Not a scoring key, and the one option here that decides what this view
				// does NOT show: a `Resource` is a person, never something to score, and
				// this names the property its type is read from. Offered rather than left
				// at the shipped `type`, because a vault that keeps item types under `kind`
				// would otherwise get the refusal only by hand-editing the `.base` — the
				// option is per VIEW in Bases, so the backlog view's own pick cannot answer
				// for this one.
				type: 'property',
				key: 'typeProperty',
				displayName: 'Type property',
				placeholder: 'type',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'valueProperty',
				displayName: t('estimation.option.valueProperty'),
				placeholder: 'business-value',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'stampProperty',
				displayName: t('estimation.option.stampProperty'),
				placeholder: 'business-value-model',
				filter: notePropsOnly,
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
				displayName: t('estimation.option.property'),
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
				displayName: t('estimation.option.weight'),
				default: shippedWeight,
				placeholder: shippedWeight,
			},
			{
				type: 'text',
				key: dimOption(id, 'range'),
				displayName: t('estimation.option.range'),
				default: DEFAULT_RANGE_TEXT,
				placeholder: DEFAULT_RANGE_TEXT,
			},
			{
				type: 'toggle',
				key: dimOption(id, 'lessIsBetter'),
				displayName: t('estimation.option.lessIsBetter'),
				default: false,
			},
			{
				type: 'text',
				key: dimOption(id, 'label'),
				displayName: t('estimation.option.label'),
				default: shippedLabel,
				placeholder: shippedLabel,
			},
		],
	};
}

function scalesGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('estimation.option.scales'),
		items: [
			{
				type: 'property',
				key: 'confidenceProperty',
				displayName: t('estimation.option.confidenceProperty'),
				placeholder: 'confidence',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'effortProperty',
				displayName: t('estimation.option.effortProperty'),
				placeholder: 'effort',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'complexityProperty',
				displayName: t('estimation.option.complexityProperty'),
				placeholder: 'complexity',
				filter: notePropsOnly,
			},
		],
	};
}
