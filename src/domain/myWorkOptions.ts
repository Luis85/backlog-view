import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { configReaders, DELIVERABLE_NAMES, resolveSecondaryWorkflow, TEST_NAMES } from './settingsResolve';
import { notePropsOnly, optionalProperty } from './optionalProperties';
import { DEFAULT_DONE_VALUES, defaultSettings } from './settings';
import { defaultItemHandling, openTargetOptions, OpenTarget, resolveItemHandling } from './itemHandling';
import { t } from '../i18n/t';

/**
 * What Bases shows in the my-work view's own options menu — this view's half of what
 * `viewOptions.ts` is for the backlog and `releaseOptions.ts` is for the release scope.
 *
 * A separately registered view inherits no binding from the backlog view: this one reads
 * a type, a parent and an order to build the tree at all, an assignee to know whose work
 * it is, and a state property to know what is done. Each of the three model mappings
 * defaults to the same suggestion the backlog view offers — sharing a suggestion is not
 * sharing a setting, and the two may legitimately be pointed at different properties.
 *
 * The started/finished stamp pair and the started-states vocabulary join this bag for a
 * reason beyond the tree itself: this view's own write path (Task 9) stamps a state
 * transition the same way the backlog view does, so a note marked done from this sidebar
 * must get the same frontmatter as one marked done from the backlog view. That is vault
 * DATA, not merely a UI difference, which is why it is worth the three extra keys rather
 * than leaving them unresolved and letting the write path stamp nothing.
 */
export interface MyWorkSettings {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	assigneeKey: string;
	stateKey: string;
	doneValues: string[];
	/**
	 * The Deliverable and test workflows' own state keys and done-value lists —
	 * `ownWorkflowReading` (`board.ts`) reads a Deliverable or a catalog member's
	 * done-ness through these, never through `stateKey`, and the membership predicate
	 * (`assignedWork.ts`) admits both kinds of row into this view's tree. Resolved through
	 * the identical `resolveSecondaryWorkflow` the backlog view's own `resolveSettings`
	 * calls, over these SAME option keys, so an unbound one falls back to `stateKey` the
	 * one way that fallback is stated anywhere (`resolvedDeliverableStateKey` /
	 * `resolvedTestStateKey` in `optionalProperties.ts`, read by the model that consumes
	 * these fields).
	 */
	deliverableStateKey: string;
	deliverableDoneValues: string[];
	testStateKey: string;
	testDoneValues: string[];
	/** The two stamp keys — see the class doc above for why this view binds them at all. */
	startedDateKey: string;
	finishedDateKey: string;
	/** Which of this view's states count as started, in `BacklogSettings.startedStates`' own shape. */
	startedStates: string[];
	/** Where a scope row's click opens its note — this view's OWN option, read through
	 *  `resolveItemHandling` directly rather than through the backlog resolver, the same
	 *  reason `resolveReleaseSettings.openIn` gives: a second resolver reading this
	 *  boundary is the defect rather than the fix. */
	openIn: OpenTarget;
}

export function getMyWorkViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	return [modelGroup(), workGroup()];
}

function modelGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('mywork.option.group.model'),
		items: [
			{
				type: 'property',
				key: 'typeProperty',
				displayName: t('option.typeProperty'),
				default: 'note.type',
				placeholder: 'type',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'parentProperty',
				displayName: t('option.parentProperty'),
				default: 'note.parent',
				placeholder: 'parent',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'orderProperty',
				displayName: t('option.orderProperty'),
				default: 'note.order',
				placeholder: 'order',
				filter: notePropsOnly,
			},
		],
	};
}

function workGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('mywork.option.group.work'),
		items: [
			{
				type: 'property',
				key: 'assigneeProperty',
				displayName: t('option.assigneeProperty'),
				// Sourced from the same table `viewOptions.ts` reads for the backlog view's
				// own picker, so the two suggestions cannot drift apart the way the state
				// property's did (see the resolver's own comment below).
				placeholder: optionalProperty('assignee').suggested,
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'stateProperty',
				displayName: t('option.stateProperty'),
				placeholder: optionalProperty('state').suggested,
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: 'doneValues',
				displayName: t('option.doneValues'),
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
			// The two secondary workflows the tree's own membership predicate admits rows
			// from (`assignedWork.ts`): a Deliverable and a test-catalog member read their
			// done-ness through THESE, never through `stateProperty` above. Suggestion and
			// option id both come from `optionalProperty`/`DELIVERABLE_NAMES`/`TEST_NAMES`
			// rather than a re-typed literal, the same rule `stateProperty`'s own comment
			// states below.
			{
				type: 'property',
				key: 'deliverableStateProperty',
				displayName: t('option.deliverableStateProperty'),
				placeholder: optionalProperty('deliverableState').suggested,
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: 'deliverableDoneValues',
				displayName: t('option.deliverableDoneValues'),
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
			{
				type: 'property',
				key: 'testStateProperty',
				displayName: t('option.testStateProperty'),
				placeholder: optionalProperty('testState').suggested,
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: 'testDoneValues',
				displayName: t('option.testDoneValues'),
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
			{
				type: 'text',
				key: 'startedStates',
				displayName: t('option.startedStates'),
				default: '',
				placeholder: t('option.startedStatesHint'),
			},
			{
				type: 'property',
				key: 'startedDateProperty',
				displayName: t('option.startedDateProperty'),
				placeholder: 'started',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'finishedDateProperty',
				displayName: t('option.finishedDateProperty'),
				placeholder: 'finished',
				filter: notePropsOnly,
			},
			{
				key: 'openIn',
				displayName: t('option.openIn'),
				type: 'dropdown',
				default: defaultItemHandling('split').openIn,
				options: openTargetOptions(),
			},
		],
	};
}

export function resolveMyWorkSettings(config: BasesViewConfig): MyWorkSettings {
	const { propKey, clearablePropKey, list, dedupe } = configReaders(config);
	const doneValues = list('doneValues');
	const effectiveDoneValues = doneValues.length > 0 ? doneValues : DEFAULT_DONE_VALUES;
	// The identical function `resolveSettings` calls for the backlog view, over this
	// view's OWN `deliverableStateProperty` / `testStateProperty` options — see the
	// `MyWorkSettings` field doc above for why sharing the function is what keeps the two
	// views' fallback rule from drifting apart. `fallback: defaultSettings()` for the same
	// reason `resolveSettings` passes it: the "nothing configured at all" answer
	// (`''` / the shipped done values) is a fact about `BacklogSettings`, not about either
	// view. `states: []`, because this bag offers no state-vocabulary option for either
	// workflow — a `Set state` menu is a later task's, not this one's — so the fallback
	// vocabulary `resolveSecondaryWorkflow` would copy from is always empty here and its
	// `states` return is unused.
	const secondary = { propKey, list, dedupe, fallback: defaultSettings(), states: [], effectiveDoneValues };
	const deliverable = resolveSecondaryWorkflow(secondary, DELIVERABLE_NAMES);
	const test = resolveSecondaryWorkflow(secondary, TEST_NAMES);
	return {
		// `clearablePropKey`, not `propKey`, for all three: each ships a real default
		// (`parent`/`order`/`type`), so `propKey` alone could never tell a reader's
		// deliberate "off" from a box nobody has touched — the same distinction
		// `resolveReleaseSettings` draws for its own three model mappings, and the one
		// this view's own options screen promises (a cleared mapping shows as disabled,
		// so it must resolve as disabled).
		parentKey: clearablePropKey('parentProperty', 'parent'),
		orderKey: clearablePropKey('orderProperty', 'order'),
		typeKey: clearablePropKey('typeProperty', 'type'),
		// Clearable: turning a property off is a decision this view must not overrule, and
		// an unbound assignee is the state the first empty state exists for.
		assigneeKey: clearablePropKey('assigneeProperty', optionalProperty('assignee').suggested),
		// Sourced from `PROPERTY_TABLE` via `optionalProperty`, not re-typed: the backlog
		// view's own suggestion for this field is `status` (`optionalProperty('state')`),
		// never the field's own name — a hard-coded `'state'` here bound this view's
		// untouched box to a frontmatter key the backlog view never reads, so a stock
		// vault (whose items carry `status`) would show every finished item as open.
		stateKey: clearablePropKey('stateProperty', optionalProperty('state').suggested),
		doneValues: effectiveDoneValues,
		deliverableStateKey: deliverable.key,
		deliverableDoneValues: deliverable.doneValues,
		testStateKey: test.key,
		testDoneValues: test.doneValues,
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — the reading `resolveReleaseSettings` gives every
		// release-own key whose default is empty (`versionKey`, `targetDateKey`, …). No
		// fallback: absence is a value, and `storage/frontmatter.ts` already reads an empty
		// `startedDateKey`/`finishedDateKey` as "do not stamp this note" for the backlog
		// view, which is the same reading this view's write path (Task 9) needs.
		startedDateKey: propKey('startedDateProperty', ''),
		finishedDateKey: propKey('finishedDateProperty', ''),
		startedStates: dedupe(list('startedStates')),
		// `'split'`, never the bare default — `releaseOptions.ts` and `estimationSettings.ts`
		// both pass it, and this view needs it most. `resolveItemHandling`'s own fallback is
		// `'active'`, which `OpenController` opens with `getLeaf(false)`: the active leaf,
		// replaced. That is the one thing this Feature exists not to do (a sidebar tree that
		// evicts the note the reader is on), so the dropdown's own `default` above states the
		// same value rather than leaving the box blank while the resolver falls back to it.
		openIn: resolveItemHandling(config, 'split').openIn,
	};
}
