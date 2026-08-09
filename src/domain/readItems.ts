import { App, BasesEntry, TFile } from 'obsidian';
import { nearestFolderNote } from './folderNotes';
import {
	absentReading,
	CivilDate,
	FieldReading,
	LinkEntry,
	ownValue,
	ParentRef,
	readDate,
	readLinkList,
	readNumber,
	readPlacement,
	readString,
	readTags,
	resolveParent,
} from './noteFields';
import {
	BacklogSettings,
	OPTIONAL_FIELDS,
	OptionalField,
	optionalKeyFor,
	resolvedDeliverableStateKey,
} from './settings';

/**
 * Phase 1 of the model build: what each NOTE says about itself, before anything knows
 * what any other note says.
 *
 * Its own module because `model.ts` reached its 400-line budget, and this is the seam
 * that costs nothing to cross — it is the only phase whose output does not point back
 * at the phases after it. `RawItem` carries no parent, no children and no level, so
 * nothing here needs `LinkedItem` or `BacklogItem` and the dependency runs one way.
 * That is also why the seam is here rather than at the dependency pass or the cycle
 * break: either of those would have had `model.ts` import a module that imports
 * `BacklogItem` back, which is a cycle fallow is right to refuse.
 */

/**
 * Phase 1 — what one note says about itself: its file, its Bases row, and the values
 * read off its frontmatter. Nothing here depends on any other note, which is why
 * `addItem` can produce it in a single pass and why the vocabulary collectors take it.
 */
export interface RawItem {
	file: TFile;
	/** The Bases result row, or null for an ancestor loaded from outside the filter. */
	entry: BasesEntry | null;
	/**
	 * True when the Base's own filter did not return this note: it was pulled in
	 * from the metadata cache to keep the hierarchy above a match intact. Such a
	 * row is context only — its real siblings are unknown, so it cannot be ranked.
	 */
	outsideFilter: boolean;
	title: string;
	/** Raw value of the type property, if present. */
	typeName: string | null;
	/**
	 * The prerequisite entries this note declares, exactly as it spells them and in its
	 * own order — duplicates included, because the removal path matches on that text.
	 * Read here because `addItem` is the one place a note's cache is opened; what they
	 * MEAN is decided later, against the item set the model ends up keeping.
	 */
	dependsOnEntries: LinkEntry[];
	/** Numeric rank among siblings; null when the property is missing. */
	order: number | null;
	/**
	 * Position in the Bases query result, which arrives with the user's configured
	 * sort applied — the tie-break and fallback ordering for unranked items.
	 */
	entryIndex: number;
	/** Resolved vault path of the parent note, if the parent link resolves. */
	parentPath: string | null;
	/** True when the parent property holds any value at all. */
	hasParentValue: boolean;
	/**
	 * True when the note this item hangs from exists in the vault — its link target,
	 * or the folder note above it in folder mode — whether or not this view loaded it.
	 * Hierarchy membership must stay detectable even when the ancestor is not rendered.
	 */
	parentExists: boolean;
	/**
	 * True when the parent key is present but explicitly empty — in folder
	 * hierarchy mode this pins the item to the top level instead of re-inferring.
	 */
	explicitRoot: boolean;
	/** Raw value of the state property, if progress tracking is configured. */
	stateValue: string | null;
	/** Tags on the note, without their leading '#'; empty when the key is unset. */
	tags: string[];
	/** True when the state value matches one of the configured done values. */
	done: boolean;
	/** Raw value of the Deliverable workflow's own state property, if configured. */
	deliverableStateValue: string | null;
	/** True when the Deliverable state matches one of ITS OWN configured done values. */
	deliverableDone: boolean;
	/** The roadmap horizon this note declares, if a horizon property is configured. */
	horizon: FieldReading<string>;
	/** The planned start date the note states, if a start property is configured. */
	plannedStart: FieldReading<CivilDate>;
	/** The planned target date the note states, if a target property is configured. */
	plannedTarget: FieldReading<CivilDate>;
	/**
	 * The risk level the note declares, if a risk property is configured. A plain value
	 * rather than a `FieldReading`: risk is a label the user picked from their own list,
	 * so there is no reading for it to refuse — the shape `stateValue` has, for the same
	 * reason. Absence means nobody has judged it, which is a different fact from any level.
	 */
	riskValue: string | null;
	/**
	 * Which configured optional keys the note CARRIES — presence, not value, and the
	 * two are different questions here: an empty horizon reads as absent (untriaged)
	 * while the key is still on the note. Removal actions offer themselves on presence,
	 * so none of them can write nothing, and the backfill fills exactly its complement.
	 * False for a field whose property is unconfigured — there is no key to carry.
	 */
	ownKeys: Record<OptionalField, boolean>;
}
/**
 * What phase 1 produces. It is a separate type from the trees the later phases build
 * for the same reason the items are: a function that takes a `RawStore` cannot
 * accidentally walk a tree that has not been linked yet.
 */
export interface RawStore {
	all: RawItem[];
	byPath: Map<string, RawItem>;
}
export function createItems(app: App, entries: BasesEntry[], settings: BacklogSettings): RawStore {
	const store: RawStore = { all: [], byPath: new Map() };
	/** The notes these items hang from — seeds for loading the ancestors the filter cut. */
	const parents: TFile[] = [];

	for (const entry of entries) {
		const file = entry.file;
		// Only markdown files can carry the frontmatter properties this view manages.
		if (!file || file.extension !== 'md' || store.byPath.has(file.path)) continue;
		const parentFile = addItem(app, store, file, entry, settings);
		if (parentFile) parents.push(parentFile);
	}
	// Seeds are resolved either way (they carry `parentExists`); only the loading
	// of the ancestors themselves is optional.
	if (settings.showOutsideParents) loadOutsideParents(app, store, parents, settings);
	return store;
}

/**
 * Read one note into an item and register it. Returns the note this item would hang
 * from if the Base's filter had returned it — see `outsideParentSeed`.
 */
function addItem(
	app: App,
	store: RawStore,
	file: TFile,
	entry: BasesEntry | null,
	settings: BacklogSettings,
): TFile | null {
	// One cache lookup per note: the model is rebuilt on every vault change.
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter;
	const parentRef = resolveParent(app, file, cache, settings.parentKey);
	// Resolved even when the ancestors are not being loaded: the scope test below
	// still has to see that this note is anchored in the hierarchy.
	const seed = outsideParentSeed(app, file, parentRef, settings);
	const stateValue = settings.stateKey ? readString(ownValue(fm, settings.stateKey)) : null;
	const doneValues = settings.doneValues.map((v) => v.toLowerCase());
	// Reads through the resolved (fallback-aware) key, never the raw `deliverableStateKey`
	// — see `resolvedDeliverableStateKey`'s own comment for why the raw field stays
	// unresolved in `BacklogSettings` itself.
	const deliverableStateKey = resolvedDeliverableStateKey(settings);
	const deliverableStateValue = deliverableStateKey ? readString(ownValue(fm, deliverableStateKey)) : null;
	const deliverableDoneValues = settings.deliverableDoneValues.map((v) => v.toLowerCase());
	// Every field this note can answer for itself, and no others: the ten that used to
	// be initialised here as placeholders now belong to the phases that compute them.
	const item: RawItem = {
		file,
		entry,
		outsideFilter: entry === null,
		title: file.basename,
		typeName: readString(ownValue(fm, settings.typeKey)),
		order: readNumber(ownValue(fm, settings.orderKey)),
		entryIndex: store.all.length,
		parentPath: parentRef.file?.path ?? null,
		hasParentValue: parentRef.hasValue,
		parentExists: seed !== null,
		explicitRoot: parentRef.explicitRoot,
		stateValue,
		tags: settings.tagsKey ? readTags(ownValue(fm, settings.tagsKey)) : [],
		done: stateValue !== null && doneValues.includes(stateValue.toLowerCase()),
		deliverableStateValue,
		deliverableDone:
			deliverableStateValue !== null && deliverableDoneValues.includes(deliverableStateValue.toLowerCase()),
		horizon: readGated(settings.horizonKey, fm, readPlacement),
		plannedStart: readGated(settings.startKey, fm, readDate),
		plannedTarget: readGated(settings.targetKey, fm, readDate),
		riskValue: settings.riskKey ? readString(ownValue(fm, settings.riskKey)) : null,
		ownKeys: readOwnKeys(fm, settings),
		dependsOnEntries: readLinkList(app, file, cache, settings.dependsOnKey),
	};
	store.byPath.set(file.path, item);
	store.all.push(item);
	return seed;
}

/**
 * A roadmap field read gated on its key being configured: an unconfigured field is
 * simply absent, never invalid — there is nothing to refuse.
 */
function readGated<T>(
	key: string,
	fm: Record<string, unknown> | undefined,
	read: (value: unknown) => FieldReading<T>,
): FieldReading<T> {
	return key ? read(ownValue(fm, key)) : absentReading();
}

/**
 * Which configured optional keys the note has, asked of the frontmatter directly: a
 * reader answers what a value MEANS, and an empty horizon means untriaged whether
 * or not the key is there. Own properties only — every note inherits `constructor`
 * and `toString`, and a base whose horizon property is named one of those would
 * report a gap as filled on every note in the vault.
 */
function readOwnKeys(
	fm: Record<string, unknown> | undefined,
	settings: BacklogSettings,
): Record<OptionalField, boolean> {
	const present = {} as Record<OptionalField, boolean>;
	for (const field of OPTIONAL_FIELDS) {
		const key = optionalKeyFor(settings, field);
		present[field] = key !== '' && ownValue(fm, key) !== undefined;
	}
	return present;
}

/**
 * The note an item hangs from, resolved the way `linkParents` will resolve it but
 * against the whole vault instead of the result set: the explicit parent link, or —
 * in folder mode, with no explicit link — the nearest folder note. Seeding the walk
 * with the same precedence is what makes a filtered *folder* hierarchy work: the
 * folder note inference looks for later must be in `byPath` by then.
 *
 * Always resolved, even when `showOutsideParents` is off and nothing will be loaded:
 * it is also the evidence that a note belongs to the hierarchy, and dropping a Base
 * result because its anchor happens to be hidden would be worse than not showing it.
 */
function outsideParentSeed(app: App, file: TFile, ref: ParentRef, settings: BacklogSettings): TFile | null {
	if (ref.file) return ref.file;
	if (!settings.folderHierarchy || ref.hasValue || ref.explicitRoot) return null;
	return nearestFolderNote(app, file.path);
}

/**
 * Pull in the ancestors the Base's own query left out. A base filtered to one
 * level, one state or one tag returns work items whose parents are not in the
 * result set — without them every match renders as a flat orphan and the tree
 * this view exists to show collapses into a list. The ancestors come from the
 * metadata cache and are marked `outsideFilter`: context, not results.
 */
function loadOutsideParents(app: App, store: RawStore, parents: TFile[], settings: BacklogSettings): void {
	const queue = [...parents];
	while (queue.length > 0) {
		const file = queue.pop();
		// Already known — a result row, or an ancestor another branch loaded. This
		// is also what terminates a parent cycle among notes outside the filter.
		if (!file || file.extension !== 'md' || store.byPath.has(file.path)) continue;
		const next = addItem(app, store, file, null, settings);
		if (next) queue.push(next);
	}
}
