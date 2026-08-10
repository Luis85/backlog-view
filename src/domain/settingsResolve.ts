import { BasesViewConfig, normalizePath, parsePropertyId } from 'obsidian';
import { resolveItemHandling } from './itemHandling';
import { colorableStates, stateColor, stateColorKey } from './stateColors';
import {
	BacklogSettings,
	columnPolicyKey,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
	defaultSettings,
	nameTable,
	parseWipLimit,
	wipLimitKey,
} from './settings';
import { OPTIONAL_PROPERTIES, OptionalSettingsKey } from './optionalProperties';
import { ALL_TYPES, defaultTypeFolder, typeFolderKey } from './typeVocabulary';

/**
 * Reading a `.base` file's stored options into a `BacklogSettings`.
 *
 * The one module that touches `BasesViewConfig`, which is the seam: `settings.ts` says
 * what a configuration IS and can be reasoned about with a literal, while this says how
 * one is recovered from persisted user data — never set versus cleared, a list that falls
 * back to a shipped default, a folder path spelled the way the vault spells it, a key one
 * workflow may borrow from another. Those rules change for their own reasons and are
 * where nearly all the reading difficulty was.
 *
 * Everything here is downstream of both halves of the configuration: the shape, and the
 * optional-property table it resolves every optional key from.
 */

/** The readers `resolveFolders` borrows, so it can be its own function without repeating them. */
interface ConfigReaders {
	str: (key: string) => string;
	clearable: <T>(key: string, def: T, parse: () => T) => T;
}

/**
 * A user-typed folder path as the VAULT spells it: trimmed, stripped of the separators
 * either side, and normalized. One answer, because a folder setting is read by three
 * kinds of code that must agree — `storage/` creates the folder and puts files in it,
 * the creation prompt tells the user where a note will land, and the generated README
 * tells an editor outside Obsidian where to file one. A hand-edited or Windows-shaped
 * `work\backlog` normalized only at the write would have the document name a folder
 * this plugin never writes to.
 *
 * Both separators are stripped before the guard, since `normalizePath` answers `/` — the
 * vault root spelled as a folder that does not exist — for anything that normalizes away.
 */
export function vaultFolder(value: string): string {
	const trimmed = value.trim().replace(/^[\\/]+|[\\/]+$/g, '');
	return trimmed ? normalizePath(trimmed) : '';
}

/**
 * Where new items are filed, resolved together because the two answers depend on each
 * other: every type folder defaults to a subfolder of the home folder, so moving the
 * home folder moves each one that has not been picked by hand.
 */
function resolveFolders(
	read: ConfigReaders,
	types: string[],
	fallback: BacklogSettings,
): Pick<BacklogSettings, 'homeFolder' | 'typeFolders'> {
	const { str, clearable } = read;
	const homeFolder = clearable('homeFolder', fallback.homeFolder, () => vaultFolder(str('homeFolder')));
	return {
		homeFolder,
		// One option per type, so a folder is picked rather than typed into a mapping,
		// and each default sits under the resolved home folder — the value in the box is
		// the value that applies, and moving the home folder moves every untouched one.
		typeFolders: nameTable(types, (type) =>
			clearable(typeFolderKey(type), defaultTypeFolder(type, homeFolder), () =>
				vaultFolder(str(typeFolderKey(type))),
			) || null,
		),
	};
}

/**
 * The Deliverable workflow's three resolved fields, lifted out of `resolveSettings`.
 *
 * Extracted when merging `Idea` and `Deliverable` into one vocabulary pushed that function
 * past its 100-line budget. The seam is the honest one: these three are the only fields
 * whose value depends on ANOTHER of their own group — the key's fallback decides what the
 * two lists fall back to — so they are a unit wherever they are computed, and the budget
 * only made that visible.
 */
interface DeliverableWorkflowInputs {
	propKey: (key: string, def: string) => string;
	list: (key: string) => string[];
	dedupe: (values: string[]) => string[];
	fallback: BacklogSettings;
	/** The requirements workflow's own resolved vocabulary, which the two lists may fall back to. */
	states: string[];
	effectiveDoneValues: string[];
}

function resolveDeliverableWorkflow(
	inputs: DeliverableWorkflowInputs,
): { deliverableStateKey: string; deliverableStates: string[]; deliverableDoneValues: string[] } {
	const { propKey, list, dedupe, fallback, states, effectiveDoneValues } = inputs;
	// The KEY's own fallback condition, named ONCE and consulted by every Deliverable-
	// workflow field below: the returned `deliverableStateKey` directly, and
	// `deliverableStates`/`deliverableDoneValues` as the gate BEHIND each list's own
	// emptiness check — a populated list wins first, and this only picks WHICH fallback
	// an empty one takes — not three expressions that happen to agree today. Resolved
	// here, before either list, because both need it. See `resolvedDeliverableStateKey`,
	// which states the identical condition (`settings.deliverableStateKey === ''`) for
	// every READER outside this function; this is that condition's one computation
	// inside it — `deliverableStateKeyOwn` IS what becomes `settings.deliverableStateKey`
	// below, so the two cannot drift into asking different questions.
	const deliverableStateKeyOwn = propKey('deliverableStateProperty', fallback.deliverableStateKey);
	const deliverableKeyFallsBack = deliverableStateKeyOwn === '';
	// Falls back to the requirements workflow's own EFFECTIVE done values ONLY when the
	// KEY is also falling back: "Deliverables don't need their own dedicated status
	// property; they can use the same one" applies here too, so a vault that customized
	// `doneValues` must not have that customization ignored while the Deliverable
	// workflow shares its property. An OWN, distinct key with no done values of its own
	// is a genuinely independent workflow and gets the shipped default
	// (`fallback.deliverableDoneValues`) instead — never an unrelated property's
	// customized list, exactly as before this workflow could share anything. Unlike the
	// state KEY (`resolvedDeliverableStateKey`), a value list carries no collision risk,
	// so there is no reason for every reader to re-resolve this fallback; both this and
	// `deliverableStates` below are baked in HERE, eagerly, gated on the SAME condition.
	const deliverableDoneValuesRaw = list('deliverableDoneValues');
	const effectiveDeliverableDoneValues = deliverableDoneValuesRaw.length > 0
		? deliverableDoneValuesRaw
		: deliverableKeyFallsBack ? effectiveDoneValues : fallback.deliverableDoneValues;
	// Same rule, over the declared vocabulary rather than the done values: falls back to
	// the shared workflow's OWN declared states ONLY when the KEY is also falling back —
	// a Deliverable state property configured on its OWN distinct key, with no declared
	// states of its own yet, must not borrow a vocabulary that belongs to a DIFFERENT
	// property. Own key configured: this list still falls through to ITS OWN observed
	// values (`menuValues`) when left empty, exactly as `states` does for the
	// requirements workflow — never to `states`, which is not read through that key.
	const deliverableStatesRaw = dedupe(list('deliverableStateValues'));
	return {
		deliverableStateKey: deliverableStateKeyOwn,
		deliverableStates: deliverableKeyFallsBack && deliverableStatesRaw.length === 0 ? states : deliverableStatesRaw,
		deliverableDoneValues: effectiveDeliverableDoneValues,
	};
}

/** Read the persisted view config into a BacklogSettings, applying defaults for anything unset. */
export function resolveSettings(config: BasesViewConfig): BacklogSettings {
	const fallback = defaultSettings();

	const propKey = (key: string, def: string): string => {
		try {
			const pid = config.getAsPropertyId(key);
			if (pid) {
				const parsed = parsePropertyId(pid);
				if (parsed.type === 'note' && parsed.name) return parsed.name;
			}
		} catch {
			// fall through to default
		}
		return def;
	};
	/**
	 * Like `propKey`, but only for an option whose default is a real key: clearing
	 * it in the view options has to mean "off", and only an option that was never
	 * touched falls back. Without the distinction the tags property could never be
	 * turned off — `getAsPropertyId` reports cleared and unset the same way.
	 */
	const clearablePropKey = (key: string, def: string): string => {
		// Set to something: honor it, and treat anything unusable (cleared, or a
		// property this view cannot write, like file.tags) as off.
		return config.get(key) === undefined ? def : propKey(key, '');
	};
	/**
	 * An option whose default is a REAL value has to tell "never set" from "cleared",
	 * or it can never be turned off — the same distinction `clearablePropKey` draws for
	 * property ids, and now shared by the home folder, the extra types and the type
	 * folders rather than spelled out three times.
	 */
	const clearable = <T>(key: string, def: T, parse: () => T): T => (config.get(key) === undefined ? def : parse());
	const str = (key: string): string => {
		const v = config.get(key);
		return typeof v === 'string' ? v : '';
	};
	const bool = (key: string, def: boolean): boolean => {
		const v = config.get(key);
		return typeof v === 'boolean' ? v : def;
	};
	// A slider stores a number, but a hand-edited .base file can hold anything;
	// clamp so a stray value cannot collapse the columns to nothing.
	const width = (key: string, def: number): number => {
		const v = config.get(key);
		const n = typeof v === 'number' ? v : Number.parseFloat(typeof v === 'string' ? v : '');
		if (!Number.isFinite(n)) return def;
		return Math.min(Math.max(Math.round(n), MIN_PROP_COLUMN_WIDTH), MAX_PROP_COLUMN_WIDTH);
	};
	const list = (key: string): string[] =>
		str(key)
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	// Duplicate states would render as duplicate menu entries — drop them silently.
	const dedupe = (values: string[]): string[] => {
		const seen = new Set<string>();
		return values.filter((v) => {
			const key = v.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};

	const doneValues = list('doneValues');
	// The EFFECTIVE list, not the raw config value: `doneValues` below falls back to
	// DEFAULT_DONE_VALUES when nobody sets it, and every other "is this state done"
	// reader (model.ts, board.ts, backlogReadme.ts) goes through that resolved field —
	// so the exclusion set has to be built from the same list it is returned as, or a
	// `.base` that relies on the defaults grants `Done` a limit the rest of the app
	// says it cannot have.
	const effectiveDoneValues = doneValues.length > 0 ? doneValues : fallback.doneValues;
	const states = dedupe(list('stateValues'));
	const deliverable = resolveDeliverableWorkflow({ propKey, list, dedupe, fallback, states, effectiveDoneValues });
	const doneSet = new Set(effectiveDoneValues.map((v) => v.toLowerCase()));
	// Limits are refused for done states HERE rather than only in the schema, so a key
	// left in the `.base` by re-marking a state as done cannot revive its limit.
	const limitedStates = states.filter((s) => !doneSet.has(s.toLowerCase()));
	const folders = resolveFolders({ str, clearable }, ALL_TYPES, fallback);
	// Every optional property's key, read from the ONE table that already names both the
	// option and the field it lands in — rather than a line per property restating that
	// pairing a second time. The lines this replaces were correct, but they were a copy
	// of `PROPERTY_TABLE` that nothing checked: a row whose `settingsKey` and hand-written
	// destination disagreed would have bound the picker to one field and read another.
	// `deliverableStateKey` is resolved here too and then OVERWRITTEN by `...deliverable`
	// below, which is the only optional key with a fallback of its own to apply.
	const keyEntries = OPTIONAL_PROPERTIES.map((p) => [p.settingsKey, propKey(p.option, fallback[p.settingsKey])]);
	const optionalKeys = Object.fromEntries(keyEntries) as Pick<BacklogSettings, OptionalSettingsKey>;
	const tagsKey = (): string => {
		const key = clearablePropKey('tagsProperty', fallback.tagsKey);
		const taken = [
			propKey('parentProperty', fallback.parentKey),
			propKey('orderProperty', fallback.orderKey),
			propKey('typeProperty', fallback.typeKey),
			propKey('stateProperty', fallback.stateKey),
		];
		return taken.includes(key) ? '' : key;
	};

	return {
		parentKey: propKey('parentProperty', fallback.parentKey),
		orderKey: propKey('orderProperty', fallback.orderKey),
		typeKey: propKey('typeProperty', fallback.typeKey),
		hierarchyOnly: bool('hierarchyOnly', fallback.hierarchyOnly),
		showOutsideParents: bool('showOutsideParents', fallback.showOutsideParents),
		folderHierarchy: bool('inferFolderHierarchy', fallback.folderHierarchy),
		autoType: bool('autoAssignType', fallback.autoType),
		showCounts: bool('showCounts', fallback.showCounts),
		...folders,
		// UI state, not configuration: the view overwrites this with the stored pick.
		focusLevel: fallback.focusLevel,
		...optionalKeys,
		tagsKey: tagsKey(),
		propColumnWidth: width('propertyColumnWidth', fallback.propColumnWidth),
		doneValues: effectiveDoneValues,
		wipLimits: nameTable(limitedStates, (s) => parseWipLimit(str(wipLimitKey(s)))),
		columnPolicies: nameTable(states, (s) => str(columnPolicyKey(s)).trim() || null),
		// Both vocabularies, one table — see `BacklogSettings.stateColors`.
		stateColors: nameTable(colorableStates(states, deliverable.deliverableStates), (s) => stateColor(str(stateColorKey(s)))),
		// The two stamp keys main resolved by hand here now arrive with every other
		// optional key in `...optionalKeys` above, read off `PROPERTY_TABLE` itself.
		startedStates: dedupe(list('startedStates')),
		states,
		showCompleted: bool('showCompleted', fallback.showCompleted),
		// A real default that must stay clearable: an emptied list means "no bucket
		// axis", and only an option never touched falls back to Now, Next, Later.
		horizonValues: clearable('horizonValues', fallback.horizonValues, () => dedupe(list('horizonValues'))),
		...deliverable,
		// Clearable for the horizon values' reason: a real default that has to be
		// switchable off, and an emptied list means "no levels" rather than the three
		// this plugin shipped.
		riskValues: clearable('riskValues', fallback.riskValues, () => dedupe(list('riskValues'))),
		...resolveItemHandling(config),
	};
}
