import { BasesViewConfig, normalizePath, parsePropertyId } from 'obsidian';
import { resolveItemHandling } from './itemHandling';
import { colorableStates, stateColor, stateColorKey } from './stateColors';
import {
	BacklogSettings,
	columnPolicyKey,
	defaultSettings,
	nameTable,
	parseWipLimit,
	resolveIterationDays,
	wipLimitKey,
} from './settings';
import { OPTIONAL_PROPERTIES, OptionalSettingsKey } from './optionalProperties';
import { ABSENCE_TYPE, ALL_TYPES, defaultTypeFolder, typeFolderKey } from './typeVocabulary';

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
 * One SECONDARY workflow's three resolved fields — the Deliverable's, and the test
 * catalog's. Every argument in the comments below was written for the Deliverable and is
 * true of the test workflow word for word with `test` substituted, so this is one function
 * called twice — against `DELIVERABLE_NAMES` and `TEST_NAMES` below — rather than two
 * copies of a fallback ladder that took a bug to get right. A third secondary workflow is
 * a third names constant and a third call.
 *
 * The seam is the honest one: these three are the only fields whose value depends on
 * ANOTHER of their own group — the key's fallback decides what the two lists fall back to
 * — so they are a unit wherever they are computed.
 */
interface SecondaryWorkflowInputs {
	propKey: (key: string, def: string) => string;
	list: (key: string) => string[];
	dedupe: (values: string[]) => string[];
	fallback: BacklogSettings;
	/** The requirements workflow's own resolved vocabulary, which the two lists may fall back to. */
	states: string[];
	effectiveDoneValues: string[];
}

/** Which option keys and which fallback fields this secondary workflow reads. */
interface SecondaryWorkflowNames {
	property: string;
	stateValues: string;
	doneValues: string;
	fallbackKey: 'deliverableStateKey' | 'testStateKey';
	fallbackDoneValues: 'deliverableDoneValues' | 'testDoneValues';
}

interface SecondaryWorkflow {
	key: string;
	states: string[];
	doneValues: string[];
}

/**
 * The two workflows' option names, module-level rather than written inline at each call
 * site — a persisted option id (`deliverableStateProperty`, `testStateProperty`) has to
 * stay literal and greppable (`viewOptions.ts` spells these the same way), which rules out
 * building the id from a shared prefix; naming the whole row once here is the alternative
 * that keeps `resolveSettings` to one line per workflow.
 */
const DELIVERABLE_NAMES: SecondaryWorkflowNames = {
	property: 'deliverableStateProperty',
	stateValues: 'deliverableStateValues',
	doneValues: 'deliverableDoneValues',
	fallbackKey: 'deliverableStateKey',
	fallbackDoneValues: 'deliverableDoneValues',
};
const TEST_NAMES: SecondaryWorkflowNames = {
	property: 'testStateProperty',
	stateValues: 'testStateValues',
	doneValues: 'testDoneValues',
	fallbackKey: 'testStateKey',
	fallbackDoneValues: 'testDoneValues',
};

function resolveSecondaryWorkflow(inputs: SecondaryWorkflowInputs, names: SecondaryWorkflowNames): SecondaryWorkflow {
	const { propKey, list, dedupe, fallback, states, effectiveDoneValues } = inputs;
	// The KEY's own fallback condition, named ONCE and consulted by both lists below: as
	// the returned key directly, and as the gate BEHIND each list's own emptiness check —
	// a populated list wins first, and this only picks WHICH fallback an empty one takes.
	// See `resolvedDeliverableStateKey` / `resolvedTestStateKey`, which state the identical
	// condition for every READER outside this function.
	const own = propKey(names.property, fallback[names.fallbackKey]);
	const fallsBack = own === '';
	// Falls back to the requirements workflow's own EFFECTIVE done values ONLY when the KEY
	// is also falling back: a vault that customized `doneValues` must not have that ignored
	// while this workflow shares its property. An OWN, distinct key with no done values of
	// its own is a genuinely independent workflow and gets the shipped default instead —
	// never an unrelated property's customized list.
	const doneRaw = list(names.doneValues);
	const doneValues = doneRaw.length > 0 ? doneRaw : fallsBack ? effectiveDoneValues : fallback[names.fallbackDoneValues];
	// Same rule over the declared vocabulary: falls back to the shared workflow's OWN
	// declared states ONLY when the KEY is also falling back — a state property configured
	// on its OWN distinct key, with no declared states yet, must not borrow a vocabulary
	// that belongs to a DIFFERENT property.
	const statesRaw = dedupe(list(names.stateValues));
	return { key: own, states: fallsBack && statesRaw.length === 0 ? states : statesRaw, doneValues };
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
	const secondary = { propKey, list, dedupe, fallback, states, effectiveDoneValues };
	const deliverable = resolveSecondaryWorkflow(secondary, DELIVERABLE_NAMES);
	const test = resolveSecondaryWorkflow(secondary, TEST_NAMES);
	const doneSet = new Set(effectiveDoneValues.map((v) => v.toLowerCase()));
	// The two vocabularies with their own done lists beside them: a done state is not
	// colourable, and which states are done is a per-workflow declaration.
	const colourable = { states, doneValues: effectiveDoneValues, deliverableStates: deliverable.states, deliverableDoneValues: deliverable.doneValues };
	// Limits are refused for done states HERE rather than only in the schema, so a key
	// left in the `.base` by re-marking a state as done cannot revive its limit.
	const limitedStates = states.filter((s) => !doneSet.has(s.toLowerCase()));
	// `ALL_TYPES` plus the one declared name that is deliberately not in it. Passed as a
	// local array rather than by widening the vocabulary: `resolveFolders` already takes
	// the types it should resolve, so this reuses the whole per-type shape — the option
	// key, the clearable read, the home-folder fallback — without any consumer of
	// `ALL_TYPES` seeing an extra entry it would then have to exclude.
	const folders = resolveFolders({ str, clearable }, [...ALL_TYPES, ABSENCE_TYPE], fallback);
	// Every optional property's key, read from the ONE table that already names both the
	// option and the field it lands in — rather than a line per property restating that
	// pairing a second time. The lines this replaces were correct, but they were a copy
	// of `PROPERTY_TABLE` that nothing checked: a row whose `settingsKey` and hand-written
	// destination disagreed would have bound the picker to one field and read another.
	// `deliverableStateKey` and `testStateKey` are resolved here too and then OVERWRITTEN by
	// the explicit fields below: they are the two optional keys with a fallback of their own.
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
		iterationsOnTimeline: bool('iterationsOnTimeline', fallback.iterationsOnTimeline),
		iterationBars: bool('iterationBars', fallback.iterationBars),
		showOutsideParents: bool('showOutsideParents', fallback.showOutsideParents),
		folderHierarchy: bool('inferFolderHierarchy', fallback.folderHierarchy),
		showCounts: bool('showCounts', fallback.showCounts),
		...folders,
		// UI state, not configuration: the view overwrites this with the stored pick.
		focusLevel: fallback.focusLevel,
		...optionalKeys,
		tagsKey: tagsKey(),
		doneValues: effectiveDoneValues,
		wipLimits: nameTable(limitedStates, (s) => parseWipLimit(str(wipLimitKey(s)))),
		columnPolicies: nameTable(states, (s) => str(columnPolicyKey(s)).trim() || null),
		// Both vocabularies, one table — see `BacklogSettings.stateColors`.
		// Requirements and Deliverable states only. The TEST workflow deliberately has no
		// colour boxes (product decision, 2026-08-10), so its states are not colourable and
		// must not join this table — `colorableStates` takes the four fields it takes. The
		// done values go with them because a done state is not colourable either.
		stateColors: nameTable(colorableStates(colourable), (s) => stateColor(str(stateColorKey(s)))),
		// The two stamp keys main resolved by hand here now arrive with every other
		// optional key in `...optionalKeys` above, read off `PROPERTY_TABLE` itself.
		startedStates: dedupe(list('startedStates')),
		states,
		showCompleted: bool('showCompleted', fallback.showCompleted),
		// A real default that must stay clearable: an emptied list means "no bucket
		// axis", and only an option never touched falls back to Now, Next, Later.
		horizonValues: clearable('horizonValues', fallback.horizonValues, () => dedupe(list('horizonValues'))),
		// No `clearable`: that exists to tell "never set" from "cleared" for a REAL
		// default, and this one has none — see `BacklogSettings.resourceNames`.
		resourceNames: dedupe(list('resourceNames')),
		deliverableStateKey: deliverable.key,
		deliverableStates: deliverable.states,
		deliverableDoneValues: deliverable.doneValues,
		testStateKey: test.key,
		testStates: test.states,
		testDoneValues: test.doneValues,
		// Clearable for the horizon values' reason: a real default that has to be
		// switchable off, and an emptied list means "no levels" rather than the three
		// this plugin shipped.
		riskValues: clearable('riskValues', fallback.riskValues, () => dedupe(list('riskValues'))),
		// The same clearable default, for the same reason: an emptied ladder means "no
		// levels", not the MoSCoW four this plugin shipped.
		priorityValues: clearable('priorityValues', fallback.priorityValues, () => dedupe(list('priorityValues'))),
		// No `clearable` on either list: their default is EMPTY, so "never set" and
		// "cleared" mean the same thing here and there is nothing for the distinction to
		// protect. Deduped like every other state vocabulary — the same value named in one
		// list twice is one bucket rule, not two.
		iterationOpenStates: dedupe(list('iterationOpenStates')),
		iterationResolvedStates: dedupe(list('iterationResolvedStates')),
		iterationLengthDays: resolveIterationDays(str('iterationLengthDays')),
		...resolveItemHandling(config),
	};
}
