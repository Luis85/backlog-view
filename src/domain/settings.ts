import { defaultItemHandling, ItemHandling } from './itemHandling';
import { ALL_TYPES, DEFAULT_HOME_FOLDER, defaultTypeFolder } from './typeVocabulary';

/**
 * What a resolved configuration IS: the shape, the shipped defaults, and the few
 * questions answered from the fields alone — is this state done, what does a menu offer.
 *
 * Three modules were split out from here, each for a reason worth keeping apart from
 * this one. `typeVocabulary.ts` is below it and holds the fixed type names. Above it sit
 * `optionalProperties.ts` — the table of write targets, the half that grows a row per
 * feature — and `settingsResolve.ts`, the only place a `.base` file is read. This file
 * imports neither, which is what lets it stay a shape a test can write as a literal.
 */

/**
 * Resolved, ready-to-use configuration for one Product Backlog view.
 * All property keys are plain frontmatter keys (without the `note.` prefix).
 */
export interface BacklogSettings extends ItemHandling {
	parentKey: string;
	orderKey: string;
	typeKey: string;
	/**
	 * Only treat notes that belong to the work-item hierarchy as items: a supported
	 * type (one of `levels`) or a parent. When off, every note the base returns is an item.
	 */
	hierarchyOnly: boolean;
	/**
	 * Load the ancestors the Base's own filter left out, so a matching item keeps
	 * its place in the tree instead of rendering as a flat orphan.
	 */
	showOutsideParents: boolean;
	/** Parent notes are inferred from folder notes when no explicit parent link is set. */
	folderHierarchy: boolean;
	showCounts: boolean;
	/**
	 * Where new items go when their type has no folder of its own — the one general
	 * answer to "where does this plugin put things".
	 */
	homeFolder: string;
	/**
	 * Folder per item type, keyed by LOWERCASED type name. Each is its own option in
	 * the view options rather than a line of a mapping, so it is picked rather than
	 * typed. Takes precedence over `homeFolder`, but not over folder mode's "beside
	 * the parent" rule.
	 */
	typeFolders: Record<string, string>;
	/**
	 * Level name to use as the top of the tree, or '' to show the full hierarchy. The
	 * one field here that is NOT read from the `.base`: focus is working position, so it
	 * is stored beside the collapse state and injected by the view (`refreshFromData`).
	 * It rides in these settings anyway because it is an input to the model build, which
	 * is what this object is.
	 */
	focusLevel: string;
	/** Frontmatter key holding the workflow state, or '' when progress tracking is off. */
	stateKey: string;
	/**
	 * Frontmatter key holding the note's tags, or '' to render them as plain text.
	 * Editing is offered only while this property is one of the visible ones.
	 */
	tagsKey: string;
	/** State values (case-insensitive) that count as done. */
	doneValues: string[];
	/**
	 * WIP limit per column, keyed by LOWERCASED state value. Absent means unlimited,
	 * which is NOT a limit of zero. Done states never appear here whatever the `.base`
	 * holds: WIP is what sits between started and finished, and capping the archive is
	 * a different idea wearing the same word.
	 */
	wipLimits: Record<string, number>;
	/**
	 * The working agreement written on a column, keyed by LOWERCASED state value.
	 * Absent means none, and a column with none shows no affordance at all. Unlike a
	 * limit, a done column may carry one.
	 */
	columnPolicies: Record<string, string>;
	/**
	 * The colour a state was NAMED, keyed by LOWERCASED state value — one of
	 * {@link STATE_COLOR_NAMES}, never a free-typed value. Absent means no pick, and the
	 * state keeps the positional slot `paletteSlot` gives it. Both workflows share this
	 * one table: it is keyed by the value, so two workflows spelling a state the same way
	 * agree about its colour, which is what the reader would expect of one name.
	 */
	stateColors: Record<string, string>;
	/**
	 * Frontmatter key stamped with the date work started, or '' when start stamping
	 * is off. History is the one thing a board cannot reconstruct later, so this
	 * captures it as the transition happens — and captures nothing until it is named.
	 */
	startedDateKey: string;
	/** Frontmatter key stamped with the date work finished, or '' when off. */
	finishedDateKey: string;
	/**
	 * State values (case-insensitive) that count as work started. Empty means NOTHING
	 * does: every part of stamping is opt-in, and a workflow's first column is a
	 * backlog as often as it is a start — guessing would date work nobody began.
	 */
	startedStates: string[];
	/** Workflow states offered by the state menus, in order; [] falls back to observed values. */
	states: string[];
	/** Render items whose whole subtree is done; when off they hide (the quick filter overrides). */
	showCompleted: boolean;
	/** Frontmatter key holding the roadmap horizon, or '' when no bucket axis is configured. */
	horizonKey: string;
	/**
	 * Declared horizon values, in roadmap order. Ships prefilled with Now, Next,
	 * Later — a default vocabulary, not a fixed one — and clearing it unconfigures
	 * the bucket axis: a horizon axis with no values is a board without stages.
	 */
	horizonValues: string[];
	/**
	 * Declared resource names, in roadmap row order. Ships EMPTY, unlike
	 * `horizonValues`: nobody declares who exists, so the resources axis is configured
	 * by its assignee property and a date property alone, and this list only ever adds
	 * rows nothing has landed in yet. It never NARROWS what Set assignee offers — an
	 * observed name is a fact and no roster overrules it — but it does lead that menu's
	 * list wherever it opens, which it did not until 2026-08-14: naming a team here and
	 * being offered them on one projection only reads as the setting not working. Not
	 * `clearable`, because absence is the shipped state rather than a cleared default.
	 */
	resourceNames: string[];
	/**
	 * Frontmatter key holding the prerequisites this note waits for, or '' when the
	 * feature is unconfigured. A LIST key, unlike every other optional property here,
	 * which is why the read and the write both have their own shape.
	 */
	dependsOnKey: string;
	/** Frontmatter key holding the planned start date, or '' when unset. */
	startKey: string;
	/** Frontmatter key holding the planned target date, or '' when unset. */
	targetKey: string;
	/** Frontmatter key holding the Deliverable workflow's own state, or '' when unset. */
	deliverableStateKey: string;
	/** Deliverable workflow states offered by its board, in order; [] falls back to observed. */
	deliverableStates: string[];
	/** State values (case-insensitive) that count as done, for the Deliverable workflow. */
	deliverableDoneValues: string[];
	/** Frontmatter key holding the test workflow's own state, or '' when unset. */
	testStateKey: string;
	/** Test workflow states offered by a catalog row's Set state, in order; [] falls back to observed. */
	testStates: string[];
	/** State values (case-insensitive) that count as done, for the test workflow. */
	testDoneValues: string[];
	/** Frontmatter key holding the item's risk, or '' when no risk property is named. */
	riskKey: string;
	/**
	 * Declared risk levels, in the order the menu offers them. Ships prefilled with the
	 * numbered High/Normal/Low triple — a default vocabulary, not a fixed one — and
	 * clearing it withdraws the Set risk menu, which is the only thing the list feeds.
	 * The property stays backfillable either way: unlike the horizon's, a named risk
	 * property with no levels is still a property worth creating on a note.
	 */
	riskValues: string[];
	/**
	 * Frontmatter key holding who the item is assigned to, or '' when no assignee
	 * property is named. Its companion list is OPTIONAL where risk's and the horizon's
	 * are required — `resourceNames`, which the resources axis declares rows from and
	 * `assigneeChoices` offers wherever the row menu opens, joined to the names the
	 * RESULTS carry (`observedAssignees`) and to whatever the user types. So a named key
	 * alone is still enough to draw the chip and fill its menu, and a roster is a
	 * recommendation on top rather than the vocabulary.
	 */
	assigneeKey: string;
}

/**
 * The persisted option key for one state's WIP limit. Shared by the schema that
 * declares the option and the resolver that reads it back, for the reason
 * {@link typeFolderKey} gives: a key spelled twice is a key that can differ, and this
 * one is user data in a `.base` file.
 */
export function wipLimitKey(state: string): string {
	return `wipLimit.${state.toLowerCase()}`;
}

/**
 * The persisted option key for one state's column policy.
 */
export function columnPolicyKey(state: string): string {
	return `columnPolicy.${state.toLowerCase()}`;
}

/**
 * A WIP limit as read from a hand-editable `.base`: a whole number of one or more, or
 * null for no limit. Everything else — empty, blank, zero, negative, fractional,
 * non-numeric — is no limit, because an unset limit is not a limit of zero and a
 * column pinned permanently over its limit says nothing at all.
 */
export function parseWipLimit(raw: string): number | null {
	const n = Number(raw.trim());
	return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * A table keyed by lowercased name, skipping every name the reader has no value for.
 * Null-prototype, because the names are user data: a type or a state called
 * `constructor` must be a plain key rather than a collision with something inherited
 * off `Object`. Read it back with {@link byName}, never with a bare index.
 *
 * The reader defaults to one that is never called, which is what an EMPTY table needs and
 * all three in {@link defaultSettings} use — a fresh `() => null` per call site would put
 * one more uncovered function in the coverage floor every time a per-state table arrived.
 */
export function nameTable<T>(names: string[], read: (name: string) => T | null = () => null): Record<string, T> {
	const table: Record<string, T> = Object.create(null) as Record<string, T>;
	for (const name of names) {
		const value = read(name);
		if (value !== null) table[name.toLowerCase()] = value;
	}
	return table;
}
export const DEFAULT_DONE_VALUES = ['Done', 'Closed', 'Completed', 'Removed'];
/**
 * The shipped horizon vocabulary — the canonical Now-Next-Later triple. A default
 * the user edits freely, never a fixed list: the values are the user's own
 * placements, exactly as the workflow states are.
 */
export const DEFAULT_HORIZON_VALUES = ['Now', 'Next', 'Later'];
/**
 * The shipped risk vocabulary. Numbered because risk is read as a ranking far more
 * often than as a label, and a list that sorts the way it reads costs nothing to
 * write down. A default the user edits freely, never a fixed list.
 */
export const DEFAULT_RISK_VALUES = ['1 - High', '2 - Normal', '3 - Low'];

export function defaultSettings(): BacklogSettings {
	return {
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		hierarchyOnly: true,
		showOutsideParents: true,
		folderHierarchy: false,
		showCounts: true,
		homeFolder: DEFAULT_HOME_FOLDER,
		typeFolders: nameTable(ALL_TYPES, (t) => defaultTypeFolder(t) || null),
		focusLevel: '',
		stateKey: '',
		tagsKey: 'tags',
		doneValues: [...DEFAULT_DONE_VALUES],
		wipLimits: nameTable<number>([]),
		columnPolicies: nameTable<string>([]),
		stateColors: nameTable<string>([]),
		startedDateKey: '',
		finishedDateKey: '',
		startedStates: [],
		states: [],
		showCompleted: true,
		horizonKey: '',
		horizonValues: [...DEFAULT_HORIZON_VALUES],
		resourceNames: [],
		dependsOnKey: '',
		startKey: '',
		targetKey: '',
		deliverableStateKey: '',
		deliverableStates: [],
		deliverableDoneValues: [...DEFAULT_DONE_VALUES],
		testStateKey: '',
		testStates: [],
		testDoneValues: [...DEFAULT_DONE_VALUES],
		riskKey: '',
		riskValues: [...DEFAULT_RISK_VALUES],
		assigneeKey: '',
		...defaultItemHandling(),
	};
}

/**
 * The values a workflow's menus offer: the configured list when set, else the observed
 * values — with a done value appended so marking something done is always one click
 * away. The pure rule behind `stateMenuValues`, extracted so a second workflow
 * (the Deliverables board's) can share it without reading `BacklogSettings` directly.
 */
export function menuValues(configured: string[], doneValues: string[], observed: string[]): string[] {
	if (configured.length > 0) return configured;
	const done = new Set(doneValues.map((v) => v.toLowerCase()));
	if (observed.some((v) => done.has(v.toLowerCase()))) return observed;
	return doneValues.length > 0 ? [...observed, doneValues[0]] : observed;
}

/**
 * The states offered by the state menus: the configured list when set, else the
 * values observed in the backlog — with a done state appended so marking an item
 * done is always one click away. Menus append the item's own unlisted value on
 * top of this, so the current state can always render checked.
 */
export function stateMenuValues(settings: BacklogSettings, observedStates: string[]): string[] {
	return menuValues(settings.states, settings.doneValues, observedStates);
}

/**
 * Palette slots the roadmap's dated axis rotates a state's bar colour through — see
 * `paletteSlot` (`domain/board.ts`). Four, not eight, because FOUR palette colours
 * already mean something fixed on this grid and a slot that repeated one would key two
 * things at once: red is the today line's, cyan the milestone line's, green the done rule's
 * (`styles/timeline.css`), and PURPLE is Obsidian's default `--interactive-accent` —
 * what `.pbl-bar` falls back to for an item with no slot and what `.pbl-legend-other`
 * keys as `Other`. Purple was a slot until the legend drew it twice in one strip.
 *
 * The accent is the one of the four that cannot be fully reserved: it is a user
 * setting, so a reader who picks one of the remaining slot colours reopens the
 * collision against that slot instead. Dropping purple removes the collision every
 * DEFAULT install has, which is the only one a constant here can reach.
 */
export const STATE_COLOR_SLOTS = 4;

/**
 * Whether a state value counts as done, by the same case-insensitive match the model
 * and the board's columns already use. Takes a VALUE rather than an item because the
 * stamps ask it of a state being written, which no item holds yet.
 */
export function isDoneValue(settings: BacklogSettings, state: string | null): boolean {
	return state !== null && settings.doneValues.some((v) => v.toLowerCase() === state.toLowerCase());
}

/**
 * Whether a state value counts as work started. Nothing does until the states are
 * named: a first column is a backlog as often as it is a start, and a date is worse
 * than no date when it says work began that nobody began.
 */
export function isStartedValue(settings: BacklogSettings, state: string | null): boolean {
	return state !== null && settings.startedStates.some((v) => v.toLowerCase() === state.toLowerCase());
}

/**
 * The horizons Set horizon offers: the declared vocabulary, plus every value the
 * RESULTS actually carry that it does not name — which is exactly the bucket list
 * the roadmap draws, in the order it draws it (declared first, then each minted
 * bucket in the order it was first seen). Union rather than the state menu's
 * either/or, because the two questions differ: an undeclared state is a state the
 * board shows in a stray column, while an undeclared horizon is a bucket a drag can
 * already drop into — so a row menu offering only the declared list could not reach
 * a target the roadmap can. Menus append the item's own unlisted value on top of
 * this, so the current horizon always renders checked.
 */
export function horizonMenuValues(settings: BacklogSettings, observedHorizons: string[]): string[] {
	return mergedValues(settings.horizonValues, observedHorizons);
}

/**
 * One vocabulary out of several sources, in the order they are given, with the FIRST
 * spelling of a name winning and matches made case-insensitively — `sameValue`'s rule
 * applied to a list rather than to a pair.
 *
 * Two menus ask it and they ask it of different sources, which is why it takes lists
 * rather than a settings object: the horizon's is declared then observed, the assignee's
 * is drawn then declared then observed. What they share is that a declared value is a
 * recommendation and an observed one is a fact, and neither may hide the other or turn up
 * twice in two casings.
 */
export function mergedValues(...lists: readonly string[][]): string[] {
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const list of lists) {
		for (const value of list) {
			const key = value.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			merged.push(value);
		}
	}
	return merged;
}

/**
 * Whether risk is configured enough to be SET from the view: a property to write and a
 * vocabulary to offer. One predicate, so the menu and the options cannot drift — the
 * shape `hasHorizonAxis` has, in this layer rather than the roadmap's because risk feeds
 * no projection.
 *
 * It deliberately does NOT gate the backfill. An unconfigured bucket axis skips its stub
 * because writing that key would be the one write on an axis nothing else acknowledges;
 * risk has no axis to be incoherent with, so a named property with no declared levels is
 * still a property worth creating on a note — which is what the ✨ button is for.
 */
export function hasRiskLevels(settings: BacklogSettings): boolean {
	return settings.riskKey !== '' && settings.riskValues.length > 0;
}
