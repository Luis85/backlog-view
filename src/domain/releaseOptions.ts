import { BasesAllOptions, BasesOptions, BasesPropertyOption, BasesViewConfig } from 'obsidian';
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
	/**
	 * On the RELEASE note: what it is for, in the reader's own words. A PROPERTY and not
	 * the note body, which is the register's standing answer for every other kind here
	 * ([[Milestones as their own type]]: "The description is the note body… No new
	 * field"). Asked for as a property by the author on 2026-08-29 and recorded as a
	 * reversal for releases alone: a release is the one kind this plugin both CREATES and
	 * REPORTS on without opening — the index and the scope header draw its fields, and a
	 * body they would have to read the file to show is a body neither can draw.
	 */
	descriptionKey: string;
	/**
	 * The member's own effort estimate, read as a NUMBER. Three readers share it — the
	 * estimated-effort sum, the completed-effort sum and the unestimated count — which is
	 * why it is one key and not three: they are one predicate asked three ways.
	 *
	 * Suggested `effort`, which is `estimationOptions.ts`'s own key for the same concept,
	 * so a vault pressing ✨ in both views lands on one property rather than two.
	 */
	estimateKey: string;
	/** The release note's own declared capacity, in {@link ReleaseSettings.capacityUnit}. */
	capacityKey: string;
	/** The unit BOTH halves of the comparison are in, and the effort figures beside them. */
	capacityUnit: string;
	/** The member's prerequisites. What CLEARS one is this view's own `stateKey` and its
	 *  done values — see `releaseReadiness.ts` for why that is not a sixth option. */
	dependsOnKey: string;
	riskKey: string;
	/** Which risk values are critical. A vocabulary is the vault's own, so there is no
	 *  default: an empty list means the criterion is unconfigured, not that nothing is
	 *  critical. */
	criticalRiskValues: string[];
	/** Which values count as addressed. Same rule, same absence of a default. */
	addressedRiskValues: string[];
	/**
	 * The statuses this vault declares for a release, in the order they were written —
	 * `BacklogSettings.states`' own shape for the plan's workflow, and empty when nobody
	 * has declared any, which is not the same as "no statuses exist": `Set status` unions
	 * this with what the releases in the base actually carry.
	 */
	statusValues: string[];
	/**
	 * Which of this vault's release statuses mean ALREADY OUT. Empty is unconfigured
	 * rather than "none" — the action is absent either way, and the distinction is only
	 * ever read as "say which option to bind".
	 */
	releasedValues: string[];
	/**
	 * The ONE value `Mark as released` writes. A list is not a choice: a view that picked
	 * from `releasedValues` would write a different status depending on how somebody
	 * ordered it.
	 */
	releasedTransition: string;
	/** Where `Generate release notes` files its output. A PATH, not a property key, and
	 *  with no default: the action does not choose a folder on the reader's behalf. */
	notesFolder: string;
	/** Where `New release` files a note. A PATH, not a property key. */
	folder: string;
	/** Where a scope row's click opens its note — this view's OWN option, never the
	 *  backlog resolver's: see {@link resolveReleaseSettings}'s own comment for why a
	 *  second resolver reading this boundary is the defect rather than the fix. */
	openIn: OpenTarget;
}

export function getReleaseViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	return [modelGroup(), releaseGroup(config)];
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

function releaseGroup(config: BasesViewConfig): BasesAllOptions {
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
			// The vocabulary `Set status` offers, declared rather than detected — the shape
			// `stateValues` has for the plan's own workflow, and with the same absence of a
			// default: these are the reader's words for their own process, and shipping three
			// would put this plugin's guess in every vault's `.base` the first time somebody
			// opened the options panel. Empty is not "no statuses": the menu unions this with
			// the values the releases in the base already carry (`releaseStatusChoices`), so a
			// vault that declares nothing still picks from what it has written.
			{
				type: 'text',
				key: 'releaseStatusValues',
				displayName: t('release.option.statusValues'),
				placeholder: t('release.option.statusValuesHint'),
			},
			...closingOptionItems(config),
			// What a release is FOR, in the reader's own words, on the release note itself.
			// A property rather than the note body — see `ReleaseSettings.descriptionKey` for
			// the standing decision this reverses and why it is reversed for this type alone.
			{
				type: 'property',
				key: 'descriptionProperty',
				displayName: t('release.option.description'),
				placeholder: 'description',
				filter: notePropsOnly,
			},
			...readinessOptionItems(),
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

/** The declared released values, read straight off the config for the dropdown that
 *  offers them — the same text `resolveReleaseSettings` turns into `releasedValues`.
 *  Exported since 2026-08-30 for ✨'s own second reader (`view/release/init.ts`): the
 *  transition it binds must be one of these, and re-splitting the same string beside it
 *  is the two-readers-disagreeing hazard this codebase states at every model boundary. */
export function releasedValuesOf(config: BasesViewConfig): string[] {
	const raw = config.get('releasedStatusValues');
	return typeof raw === 'string' ? raw.split(',').map((v) => v.trim()).filter((v) => v !== '') : [];
}

/** The five readiness options — split out of {@link releaseGroup} for the line-count lint
 *  budget, the same reason {@link closingOptionItems} is its own function. */
function readinessOptionItems(): BasesOptions[] {
	return [
		{
			type: 'property',
			key: 'estimateProperty',
			displayName: t('release.option.estimate'),
			placeholder: 'effort',
			filter: notePropsOnly,
		},
		{
			type: 'property',
			key: 'capacityProperty',
			displayName: t('release.option.capacity'),
			placeholder: 'capacity',
			filter: notePropsOnly,
		},
		{
			// A TEXT box, not a property: the unit is one string for the whole view. Two
			// properties would let a release disagree with its neighbour about the unit
			// while the comparison added them up, and `40 points` in one field is a string
			// nothing can sum.
			type: 'text',
			key: 'capacityUnit',
			displayName: t('release.option.capacityUnit'),
			placeholder: 'points',
		},
		{
			type: 'property',
			key: 'dependsOnProperty',
			displayName: t('release.option.dependsOn'),
			placeholder: 'dependsOn',
			filter: notePropsOnly,
		},
		{
			type: 'property',
			key: 'riskProperty',
			displayName: t('release.option.risk'),
			placeholder: 'risk',
			filter: notePropsOnly,
		},
		// No `default:` on either list, for `releaseStatusValues`' own reason: these are
		// the reader's words for their own process, and shipping a guess would put it in
		// every vault's `.base` the first time the options panel was opened. Empty means
		// unconfigured, which is what the criterion reports.
		{
			type: 'text',
			key: 'criticalRiskValues',
			displayName: t('release.option.criticalRiskValues'),
			placeholder: t('release.option.criticalRiskValuesHint'),
		},
		{
			type: 'text',
			key: 'addressedRiskValues',
			displayName: t('release.option.addressedRiskValues'),
			placeholder: t('release.option.addressedRiskValuesHint'),
		},
	];
}

/** The three closing options — split out of {@link releaseGroup} to keep that function
 *  under the line-count lint budget, not because they are a separate concern. */
function closingOptionItems(config: BasesViewConfig): BasesOptions[] {
	return [
		{
			type: 'text',
			key: 'releasedStatusValues',
			displayName: t('release.option.releasedValues'),
			placeholder: t('release.option.releasedValuesHint'),
		},
		{
			// A DROPDOWN over the list above, which is what `getReleaseViewOptions`'
			// config parameter is for: it makes "the transition value is one of the
			// released values" structural at the point of entry. It does not make it
			// TRUE — a hand-edited `.base` stores what it likes, which is why Task 2
			// adds the read-back check as well.
			type: 'dropdown',
			key: 'releasedTransitionValue',
			displayName: t('release.option.transitionValue'),
			options: Object.fromEntries(releasedValuesOf(config).map((value) => [value, value])),
		},
		{
			type: 'folder',
			key: 'releaseNotesFolder',
			displayName: t('release.option.notesFolder'),
			placeholder: 'docs/release-notes',
		},
	];
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
 * remembering to add it. `include` narrows it to the options it answers for — which is how
 * {@link SHARED_STATUS_OPTIONS}' own exemption asks for the keys held by every OTHER
 * option, the only set that may block one of the shared three.
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
export function declaredPropertyKeys(config: BasesViewConfig, include?: (optionKey: string) => boolean): string[] {
	const { clearablePropKey } = configReaders(config);
	return getReleaseViewOptions(config)
		.flatMap((entry) => (entry.type === 'group' ? entry.items : [entry]))
		.filter((option): option is BasesPropertyOption => option.type === 'property')
		.filter((option) => include === undefined || include(option.key))
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
	const { clearablePropKey, propKey, str, clearable, list, dedupe } = configReaders(config);
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
		// `propKey` and `list`, the same readings their siblings take: the description's
		// default is '' like every other unbound property here, and an empty status list is
		// exactly what an untouched box means — there is no real default for either to be
		// cleared BACK to, which is what `clearable` exists for.
		descriptionKey: propKey('descriptionProperty', ''),
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — the reason already stated above for `versionKey`.
		estimateKey: propKey('estimateProperty', ''),
		// `propKey`, not `clearablePropKey`: their default is `''`, so the two resolve the
		// same value for every input — the reason already stated above for `versionKey`.
		capacityKey: propKey('capacityProperty', ''),
		// Trimmed: the value is drawn into a sentence beside two numbers, and a padded unit
		// reads as a spacing bug rather than as data.
		capacityUnit: str('capacityUnit').trim(),
		dependsOnKey: propKey('dependsOnProperty', ''),
		riskKey: propKey('riskProperty', ''),
		// `dedupe` for both: a vault listing `High, high` means one value, and a criterion
		// counting it twice would report a denominator nobody can reconcile.
		criticalRiskValues: dedupe(list('criticalRiskValues')),
		addressedRiskValues: dedupe(list('addressedRiskValues')),
		statusValues: dedupe(list('releaseStatusValues')),
		releasedValues: list('releasedStatusValues'),
		// TRIMMED, and not for tidiness: every reader of this value compares it against
		// `releasedValues`, which `list` has already trimmed item by item. So a `.base`
		// holding ` Released` matched nothing — `releaseNoteProblems` reported a mismatch
		// and `closeOffer` withheld BOTH closing actions over two halves the options screen
		// shows as agreeing. The dropdown offers `releasedValuesOf`, which is trimmed, so
		// padding only ever arrives by a hand edit — the case `text`'s own docblock says
		// these readers are tolerant for.
		releasedTransition: str('releasedTransitionValue').trim(),
		notesFolder: str('releaseNotesFolder'),
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
