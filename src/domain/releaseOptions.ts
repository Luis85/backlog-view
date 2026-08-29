import { BasesAllOptions, BasesPropertyOption, BasesViewConfig } from 'obsidian';
import { configReaders, vaultFolder } from './settingsResolve';
import { notePropsOnly } from './optionalProperties';
import { defaultTypeFolder, RELEASE_TYPE } from './typeVocabulary';
import { DEFAULT_DONE_VALUES } from './settings';
import { defaultItemHandling, openTargetOptions, OpenTarget, resolveItemHandling } from './itemHandling';
import { t } from '../i18n/t';

/**
 * What Bases shows in the release view's own options menu — this view's half of what
 * `viewOptions.ts` is for the backlog and `estimationOptions.ts` is for the estimation
 * table.
 *
 * ELEVEN keys, and the three model mappings among them are the point. A separately
 * registered view inherits no binding from the backlog view, and this one reads a type to
 * find releases at all, a parent to build the scope tree, and an order to rank the index.
 * The estimation view declares none of the three because `buildEstimationModel` reads Base
 * results FLAT — no hierarchy, no types, no ranking — so it is a precedent for one options
 * file per view and for nothing beyond that.
 *
 * Each of the three model mappings defaults to the same suggestion the backlog view
 * offers: sharing a suggestion is not sharing a setting, and the two may legitimately be
 * pointed at different properties.
 */
export interface ReleaseSettings {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	/** On the ITEM: which release it names. */
	membershipKey: string;
	/** On the RELEASE note. */
	versionKey: string;
	targetDateKey: string;
	statusKey: string;
	/** On the RELEASE note, beside `versionKey`: when it actually shipped. */
	releasedDateKey: string;
	/** Where `New release` files a note. A PATH, not a property key. */
	folder: string;
	/** Where a scope row's click opens its note — this view's OWN option, never the
	 *  backlog resolver's: see {@link resolveReleaseSettings}'s own comment for why a
	 *  second resolver reading this boundary is the defect rather than the fix. */
	openIn: OpenTarget;
}

export function getReleaseViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [modelGroup(), releaseGroup()];
}

function modelGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('release.option.group.model'),
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

function releaseGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: t('release.option.group.release'),
		items: [
			{
				type: 'property',
				key: 'membershipProperty',
				displayName: t('release.option.membership'),
				placeholder: 'release',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'versionProperty',
				displayName: t('release.option.version'),
				placeholder: 'version',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'targetDateProperty',
				displayName: t('release.option.targetDate'),
				placeholder: 'target-date',
				filter: notePropsOnly,
			},
			{
				type: 'property',
				key: 'releaseStatusProperty',
				displayName: t('release.option.status'),
				placeholder: 'status',
				filter: notePropsOnly,
			},
			// `stateProperty` and `doneValues` deliberately do NOT join `ReleaseSettings` below.
			// `resolveSettings` already reads these two exact option keys onto `BacklogSettings`
			// as `stateKey` and `doneValues`, and `releaseView.ts`'s `buildModel` call already
			// spreads `resolveSettings(this.config)` — so declaring the options here is the
			// whole of the plumbing. Adding a second field for either onto `ReleaseSettings`
			// would be two readers of one config key that can disagree.
			{
				type: 'property',
				key: 'stateProperty',
				displayName: t('release.option.state'),
				placeholder: 'status',
				filter: notePropsOnly,
			},
			{
				type: 'text',
				key: 'doneValues',
				displayName: t('release.option.doneValues'),
				default: DEFAULT_DONE_VALUES.join(', '),
				placeholder: DEFAULT_DONE_VALUES.join(', '),
			},
			// The identical pattern, for the Deliverable workflow's OWN state: the progress
			// gate reads whichever workflows a release's members actually span
			// (`ownWorkflowReading`, `domain/board.ts`), so a release holding only
			// Deliverables needs `deliverableStateKey` bound rather than `stateKey`.
			// `resolveSettings` already reads exactly these two option keys — through
			// `resolveSecondaryWorkflow`/`DELIVERABLE_NAMES` in `settingsResolve.ts` — onto
			// `BacklogSettings.deliverableStateKey` / `deliverableDoneValues`, and `buildModel`
			// reads that same `BacklogSettings`, so declaring the options here is again the
			// whole of the plumbing: before this pair joined the menu, a Deliverables-only
			// release could show progress only via a hand-edited `.base` or one that started
			// life as a backlog view, never through this view's own options panel.
			// `deliverableStateValues` (the ordered vocabulary) is deliberately left
			// undeclared, matching this view's own choice not to offer `stateValues` for the
			// primary workflow either: the release view exposes a property and its done-values
			// cut, never the declared list, for either workflow.
			{
				type: 'property',
				key: 'deliverableStateProperty',
				displayName: t('option.deliverableStateProperty'),
				placeholder: 'status',
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
				key: 'releasedDateProperty',
				displayName: t('release.option.releasedDate'),
				placeholder: 'released',
				filter: notePropsOnly,
			},
			{
				type: 'folder',
				key: 'releaseFolder',
				displayName: t('release.option.folder'),
				default: defaultTypeFolder(RELEASE_TYPE),
				placeholder: defaultTypeFolder(RELEASE_TYPE),
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

/**
 * The options that may legitimately name ONE property, so a key held by any of them does
 * not stop {@link declaredPropertyKeys}' own reader handing it to another of them.
 *
 * `configProblems` (`domain/settingsConsistency.ts`) already carries exactly this
 * exemption for the backlog view's own collision report — "skips the workflow-state roles
 * that may legitimately share a key" — and this is that same ruling for this view's
 * options, one of which is not a workflow state at all. The RELEASE's own status and an
 * ITEM's workflow state are read of different notes by different readers (`releaseIndex`
 * opens a release note, `buildModel` reads every row's state), and the vault this plugin
 * creates spells both `status`: `docs/releases/*` carry one and every PBI under them
 * carries the other.
 *
 * That is not a matter of taste for ✨. Seeding one flat "already taken" set from every
 * declared option made the ordinary vault unreachable — whichever of the two was offered
 * first took `status` and the other was left unbound — and for `stateProperty` unbound
 * means `ReleaseRow.done` is unconfigured for every release: no band shows progress, no
 * scope row shows a rollup, the hide-done toggle is withheld and the summary strip says so
 * instead of measuring. Half this view, missing after a press that reported success.
 *
 * Every OTHER pairing stays refused, `typeProperty` included: an option outside this list
 * holding `status` still blocks both of the two, which is the corruption PR #203 found (a
 * release created with a status and no type) kept rather than traded away.
 */
export const SHARED_STATUS_OPTIONS = ['stateProperty', 'deliverableStateProperty', 'releaseStatusProperty'];

/**
 * Every frontmatter key the DECLARED property options currently resolve to — read off the
 * declaration, so an option added to either group joins this set without anybody
 * remembering to add it. `options` narrows it to the option ids named, which is how
 * {@link SHARED_STATUS_OPTIONS}' own exemption is subtracted from the whole.
 *
 * It exists for `runReleaseInit`'s "never hand out a key another of this view's options
 * already names", and it is derived rather than listed because a LIST is what that rule
 * has now failed three times (PR #203, then twice in this increment). The last of the
 * three is why it is not simply `Object.entries(resolveReleaseSettings(config))`:
 * `stateProperty` is declared here and deliberately resolves onto `BacklogSettings`
 * instead, so it is on no field of `ReleaseSettings` and a sweep over that object cannot
 * see it — while `stateProperty: note.status` with `releaseStatusProperty` untouched is
 * exactly the collision the rule is about.
 *
 * `clearablePropKey` with the option's own `default:` reproduces what `resolveSettings`
 * and `resolveReleaseSettings` each read for these keys: the three model mappings ship a
 * real default and take it when nobody has touched them, and every other property option
 * defaults to nothing, where `clearablePropKey` and `propKey` answer identically.
 */
export function declaredPropertyKeys(config: BasesViewConfig, options?: string[]): string[] {
	const { clearablePropKey } = configReaders(config);
	return getReleaseViewOptions(config)
		.flatMap((entry) => (entry.type === 'group' ? entry.items : [entry]))
		.filter((option): option is BasesPropertyOption => option.type === 'property')
		.filter((option) => options === undefined || options.includes(option.key))
		.map((option) => clearablePropKey(option.key, (option.default ?? '').replace(/^note\./, '')));
}

export function resolveReleaseSettings(config: BasesViewConfig): ReleaseSettings {
	// `clearablePropKey`, NOT `propKey`, for the three mappings that ship a real default.
	// `propKey` returns its fallback whenever `getAsPropertyId` gives nothing usable, and
	// `getAsPropertyId` reports "cleared" and "never set" identically — so with `propKey`
	// a type property the user deliberately cleared resolves back to `type`, the
	// "No type property is mapped" state is unreachable, and the view test that binds
	// `{ typeProperty: '' }` can never pass. `clearablePropKey` draws exactly that
	// distinction (`config.get(key) === undefined ? def : propKey(key, '')`) and exists
	// for this: unset takes the suggestion, cleared means off.
	const { clearablePropKey, propKey, str, clearable } = configReaders(config);
	return {
		parentKey: clearablePropKey('parentProperty', 'parent'),
		orderKey: clearablePropKey('orderProperty', 'order'),
		typeKey: clearablePropKey('typeProperty', 'type'),
		// No fallback: absence is a value, and a suggestion is not a binding. A membership
		// key nobody bound must read as unconfigured rather than as `release`, or the view
		// would report a scope from a property the user never named.
		//
		// That rule is about this RESOLVER's own silent read, on every data update, never
		// about an explicit user action. `view/release/init.ts`'s `runReleaseInit` binds this
		// same option's suggested key as a STEP of the `New release` press, and — since Task
		// 1 of [[Creating a release from the release view]] — of the standalone ✨ too
		// (`view/release/initControl.ts`). What both share is the distinction that matters
		// here and not the control that reaches it: a binding the reader's own
		// press asked for is not a fallback taken behind their back. This function
		// itself still never defaults `membershipProperty` to `release` — a config that
		// changed that would fail `test/domain/releaseOptions.test.ts`'s "resolves each
		// key, and leaves an unconfigured one empty".
		membershipKey: propKey('membershipProperty', ''),
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — like `releaseKey` in `settingsResolve.ts`, a
		// `clearablePropKey` switch here would buy nothing but a second name for the same
		// function.
		versionKey: propKey('versionProperty', ''),
		targetDateKey: propKey('targetDateProperty', ''),
		statusKey: propKey('releaseStatusProperty', ''),
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — the reason already stated above for `versionKey`.
		releasedDateKey: propKey('releasedDateProperty', ''),
		// A PATH, not a property key: same reading `resolveFolders` gives every type
		// folder — trimmed and normalized by `vaultFolder`, clearable because the default
		// is a real value (`config.get` cannot tell "cleared" from "never set" otherwise).
		folder: clearable('releaseFolder', defaultTypeFolder(RELEASE_TYPE), () => vaultFolder(str('releaseFolder'))),
		// This view's OWN reading of `openIn` — never `resolveSettings(this.config).openIn`
		// in `releaseView.ts`, for the reason stated where the click is handled: that
		// resolver reads through `propKey`, which cannot tell a cleared option from an
		// unset one, so two resolvers disagreeing at this boundary is the same defect as
		// one view reading another's configuration.
		openIn: resolveItemHandling(config, 'split').openIn,
	};
}
