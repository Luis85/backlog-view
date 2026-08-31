import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { configReaders } from './settingsResolve';
import { notePropsOnly } from './optionalProperties';
import { DEFAULT_DONE_VALUES } from './settings';
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
				placeholder: 'assignee',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'stateProperty',
				displayName: t('option.stateProperty'),
				placeholder: 'state',
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: 'doneValues',
				displayName: t('option.doneValues'),
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
	return {
		parentKey: propKey('parentProperty', 'parent'),
		orderKey: propKey('orderProperty', 'order'),
		typeKey: propKey('typeProperty', 'type'),
		// Clearable: turning a property off is a decision this view must not overrule, and
		// an unbound assignee is the state the first empty state exists for.
		assigneeKey: clearablePropKey('assigneeProperty', 'assignee'),
		stateKey: clearablePropKey('stateProperty', 'state'),
		doneValues: doneValues.length > 0 ? doneValues : DEFAULT_DONE_VALUES,
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
