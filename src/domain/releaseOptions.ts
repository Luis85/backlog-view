import { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { configReaders, vaultFolder } from './settingsResolve';
import { notePropsOnly } from './optionalProperties';
import { defaultTypeFolder, RELEASE_TYPE } from './typeVocabulary';
import { t } from '../i18n/t';

/**
 * What Bases shows in the release view's own options menu — this view's half of what
 * `viewOptions.ts` is for the backlog and `estimationOptions.ts` is for the estimation
 * table.
 *
 * EIGHT keys, and the three model mappings among them are the point. A separately
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
	/** Where `New release` files a note. A PATH, not a property key. */
	folder: string;
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
			{
				type: 'folder',
				key: 'releaseFolder',
				displayName: t('release.option.folder'),
				default: defaultTypeFolder(RELEASE_TYPE),
				placeholder: defaultTypeFolder(RELEASE_TYPE),
			},
		],
	};
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
		// about an explicit user action. `view/release/init.ts`'s `runReleaseInit` — the
		// view's own ✨ — binds this same option's suggested key when the reader presses
		// it, exactly as the backlog view's `runInit` binds its optional properties: a
		// button asked for is not a fallback taken behind the reader's back. This function
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
		// A PATH, not a property key: same reading `resolveFolders` gives every type
		// folder — trimmed and normalized by `vaultFolder`, clearable because the default
		// is a real value (`config.get` cannot tell "cleared" from "never set" otherwise).
		folder: clearable('releaseFolder', defaultTypeFolder(RELEASE_TYPE), () => vaultFolder(str('releaseFolder'))),
	};
}
