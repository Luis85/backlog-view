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
	readFirstLinkEntry,
	readLinkList,
	readNumber,
	readPlacement,
	readSoleDate,
	readString,
	readTags,
	resolveParent,
} from './noteFields';
import { BacklogSettings } from './settings';
import {
	OPTIONAL_FIELDS,
	OptionalField,
	optionalKeyFor,
	resolvedDeliverableStateKey,
	resolvedTestStateKey,
} from './optionalProperties';
import { isAbsenceType, isMarkerType, isReleaseType, isResourceType } from './itemTypes';
import { Absence, readAbsence } from './absences';

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

/** A `Resource` note the base returned — never an item, and the whole of the roster. */
export interface ResourceNote {
	file: TFile;
	/** The note's own basename, which is the person's name. */
	title: string;
}

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
	/** The test workflow's own state value, or null when its key is unset or absent. */
	testStateValue: string | null;
	/** True when the test state matches one of ITS OWN configured done values. */
	testDone: boolean;
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
	 * The priority the note declares, if a priority property is configured. `riskValue`'s
	 * shape and rule exactly — a label off the user's own ladder, with absence meaning
	 * nobody has ranked it, which is a different fact from the lowest rung.
	 */
	priorityValue: string | null;
	/**
	 * Who the note says it is assigned to — the `raw`/`file` pair `readLinkList` returns,
	 * `iterationEntry`'s shape and its reason: unresolved is not unset. A link naming a
	 * deleted note, or a plain name left over from before resources were notes, has a
	 * `raw` and no `file`; reading that as "nobody" would leave the reader with a value
	 * on the note and nothing in the view to clear.
	 */
	assigneeEntry: LinkEntry | null;
	/**
	 * What the note's own iteration is FOR, in one line, if an iteration goal property is
	 * configured. `riskValue`'s reason exactly: a plain string with no reading to refuse,
	 * and no goal is a fact about the note rather than a missing one. Meaningful only on
	 * an `Iteration` note — nothing narrows the read to that type, the same "read on every
	 * item, no membership question here" choice `deliverableStateValue` already makes.
	 */
	iterationGoalValue: string | null;
	/**
	 * The iteration this note is in, if an iteration property is configured — the
	 * `raw`/`file` pair `readLinkList` returns, not collapsed to one. Unresolved is not
	 * unset: a link naming a deleted note has a `raw` and no `file`, and reading that as
	 * "no value" would tick `None` as the current iteration while the frontmatter still
	 * visibly holds a link, leaving nothing for the reader to clear. Null only when no
	 * key is configured or the note carries nothing under it.
	 */
	iterationEntry: LinkEntry | null;
	/**
	 * The release this note names, read the way `iterationEntry` is — the first link, or
	 * null where the key is unbound or the note carries nothing under it. Parsed here
	 * rather than at plan time so the planner can compare by PATH: two spellings of one
	 * release note are one release.
	 */
	releaseEntry: LinkEntry | null;
	/**
	 * Whether the note names MORE than one release — cardinality, never a second reading of
	 * which release it is in. `membershipTarget` (`releases.ts`) refuses a two-valued key
	 * outright ([[The scope of a release as a tree]] 1c: membership is one value), so the
	 * planner has to be able to tell `[R]` from `[R, E]`: they collapse to one
	 * `releaseEntry` and only the second is a note the reader needs the menu to repair.
	 *
	 * Counted off the RAW property, which is the same thing `membershipTarget` counts —
	 * its SLOTS. `releaseEntry`'s own reader drops a blank entry and a non-string one
	 * before returning, so counting parsed entries made `[R, '']` a settled membership
	 * here and an unresolved one there: the same two-ends disagreement, one layer down
	 * from where it was first closed. A ONE-element list is a plain membership at both
	 * ends — `readString` unwraps it — so only a length above one is multiple.
	 */
	releaseMultiple: boolean;
	/**
	 * The date a `Release` note says it ships on, read off the ROADMAP's own release-date
	 * key — the marker overlay's whole input ([[A release on the dated axis]]). Absent for
	 * every other type, and absent rather than invalid when the option is cleared: there is
	 * nothing to refuse where no key is named. Invalid is a release whose date nobody can
	 * read, which draws no marker and is a different fact from a release that states none.
	 */
	releaseDate: FieldReading<CivilDate>;
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
	/**
	 * The notes diverted before they could become items — see `addItem`. Beside the items
	 * rather than among them, and carried straight onto the model: nothing that walks the
	 * tree, ranks siblings or counts a rollup ever meets one.
	 */
	absences: Absence[];
	/**
	 * The `Resource` notes diverted before they could become items — `absences`' own
	 * shape and its own reason. Beside the items rather than among them: nothing that
	 * walks the tree, ranks siblings, counts a rollup or draws a projection may meet one.
	 */
	resources: ResourceNote[];
}
export function createItems(app: App, entries: BasesEntry[], settings: BacklogSettings): RawStore {
	const store: RawStore = { all: [], byPath: new Map(), absences: [], resources: [] };
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
 * How many SLOTS a property holds, asked of the RAW frontmatter value — the same count
 * `membershipTarget` (`releases.ts`) takes of a membership, and the reason it is taken
 * here rather than off the parsed entries beside it: `readLinkList` drops a blank slot and
 * any slot that is not a string before returning, so `release: [R, '']` is ONE entry there
 * and two values in the reader. A list of one is not multiple at either end — `readString`
 * unwraps it — so only a length above one answers true.
 */
function namesMultiple(raw: unknown): boolean {
	return Array.isArray(raw) && raw.length > 1;
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
	// Read on every item rather than only on catalog members, exactly as the Deliverable's
	// is read on every item rather than only on Deliverables: this is a plain key read, and
	// the membership question belongs where the workflow is CHOSEN. It cannot be asked here
	// at all — a `RawItem` has no `ladder` yet, since `assignAll` is what puts one on it.
	const testStateKey = resolvedTestStateKey(settings);
	const testStateValue = testStateKey ? readString(ownValue(fm, testStateKey)) : null;
	const testDoneValues = settings.testDoneValues.map((v) => v.toLowerCase());
	// Hoisted out of the literal below because the dependency read now asks it too.
	const typeName = readString(ownValue(fm, settings.typeKey));
	// Recognized in order to be REFUSED, and refused here rather than by the scope prune:
	// `pruneOutsideHierarchy` runs only while `hierarchyOnly` is on, so a vault with it off
	// — where every note a folder-scoped Base returns becomes an item — would keep this one
	// as a real-looking task. That is the one inversion this whole feature exists to
	// prevent, so the gate is unconditional and sits before a `RawItem` exists at all.
	//
	// Read HERE rather than by a second pass over the same entries: `addItem` is the only
	// `getFileCache` call site `buildModel` reaches, and `test/domain/modelCost.test.ts` pins one
	// read per note loaded, so a second reader would either double that count or have to
	// read through `BasesEntry.getValue()`. The cache is open on this line.
	if (isAbsenceType(typeName)) return divertAbsence(store, entry, readAbsence(app, file, cache, settings));
	// **A RESOURCE is refused here too, and this one line is the whole of "a person is not
	// in the backlog".** Beside the absence gate rather than filtered per projection: the
	// tree, both boards, both roadmap axes, the shelf, the toolbar's count and every menu
	// that offers a type all read `BacklogItem`s, so refusing before one exists leaves
	// nothing for any of them to remember. A filter per view is the shape where the next
	// projection forgets — which is exactly what the context-row rule was written about.
	//
	// Diverted rather than discarded, out of line in `divertResource`: the note is KEPT on
	// `RawStore.resources` — `docs/requirements/Rows from the Resource notes.md` is what
	// will read that roster once a consumer exists — so it comes from the base's own
	// results without a second read path into the vault.
	if (isResourceType(typeName)) return divertResource(store, file, entry);
	// Read as a LIST rather than through `readFirstLinkEntry`, because the release is the
	// one such field whose CARDINALITY is a fact about the note: `membershipTarget` refuses
	// two values, so the planner needs `[R, E]` told from `[R]`.
	const release = readLinkList(app, file, cache, settings.releaseKey);
	// Every field this note can answer for itself, and no others: the ten that used to
	// be initialised here as placeholders now belong to the phases that compute them.
	const item: RawItem = {
		file,
		entry,
		outsideFilter: entry === null,
		title: file.basename,
		typeName,
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
		testStateValue,
		testDone: testStateValue !== null && testDoneValues.includes(testStateValue.toLowerCase()),
		horizon: readGated(settings.horizonKey, fm, readPlacement),
		plannedStart: readGated(settings.startKey, fm, readDate),
		plannedTarget: readGated(settings.targetKey, fm, readDate),
		riskValue: readLabel(settings.riskKey, fm),
		priorityValue: readLabel(settings.priorityKey, fm),
		assigneeEntry: readFirstLinkEntry(app, file, cache, settings.assigneeKey),
		iterationGoalValue: readLabel(settings.iterationGoalKey, fm),
		ownKeys: readOwnKeys(fm, settings),
		iterationEntry: readFirstLinkEntry(app, file, cache, settings.iterationKey),
		releaseEntry: release[0] ?? null,
		releaseMultiple: namesMultiple(ownValue(fm, settings.releaseKey)),
		// Read for a `Release` and for nothing else, which is a rule about the TYPE and not
		// an optimisation: this key is the date a RELEASE ships on, so the same key on a PBI
		// is that PBI's own property and means nothing to the roadmap's marker overlay. The
		// option ships a real default (`viewOptions.ts`), so without this gate every note in
		// the vault would carry a reading nothing may use.
		releaseDate: readReleaseDate(typeName, settings, fm),
		// NOT read for a context row, which is the same test `outsideFilter` is made of
		// two lines up. An excluded note may be NAMED by a result and may never do the
		// naming, and until now that rule was kept only downstream, by `declaredEdges`
		// skipping the item — so the list was read, resolved link by link through the
		// metadata cache on every model rebuild, and then thrown away. Stating it here
		// puts the rule at the forbidden thing rather than at one of the places that
		// would otherwise have to remember it, and takes the work with it.
		//
		// NOT read for a MARKER either, and for a reason about the type rather than about
		// the filter: a milestone is a point in time, so it waits for nothing. It may
		// still be WAITED FOR — that is the other note's declaration and this list is not
		// it — which is why the rule sits on the reading of a marker's own entries rather
		// than on whether a marker may be named. Stated here so it holds for every
		// consequence at once: no edges out, no conflict ever computed for it, nothing in
		// `declaredMap`, and no candidate list to offer.
		dependsOnEntries:
			entry === null || isMarkerType(typeName) ? [] : readLinkList(app, file, cache, settings.dependsOnKey),
	};
	store.byPath.set(file.path, item);
	store.all.push(item);
	return seed;
}

/**
 * Keep what an absence says and produce no item — the body of `addItem`'s one early
 * return, out of line so that function stays under its complexity budget.
 *
 * Always null, which is `addItem`'s own "no ancestor to seed": an absence has no parent,
 * so it can never pull one in and `loadOutsideParents` must never be handed one. A note
 * whose range this axis cannot trust keeps nothing at all — the divert is the TYPE's and
 * unconditional, while what is kept is `readAbsence`'s question.
 *
 * A note the Base never RETURNED keeps nothing either, and that is the context-row rule
 * rather than a rule of this axis: an `outsideFilter` note is never a source of anything
 * derived from the results, counts included. One can still arrive here — a result naming an
 * absence as its parent, or sitting under one as a folder note, pulls it in through
 * `loadOutsideParents` — and until 2026-08-14 it minted a band, drew a stretch and was
 * counted on the header. The check is on the KEEPING rather than on that path, so a future
 * caller handing this function an entry-less note is refused too — which is also why
 * `absence` is read at the call site and handed in already resolved rather than reread
 * here: the read is unconditional (`readAbsence`'s own concern), only the KEEP is gated,
 * and folding both into one function would have pushed this past the five-parameter
 * budget the moment `readAbsence` needed the app and the cache too.
 */
function divertAbsence(store: RawStore, entry: BasesEntry | null, absence: Absence | null): null {
	if (entry !== null && absence) store.absences.push(absence);
	return null;
}

/**
 * Keep who a resource IS and produce no item — `divertAbsence`'s shape, out of line so
 * `addItem` stays under its complexity budget.
 *
 * Always null, which is `addItem`'s own "no ancestor to seed": a resource has no parent,
 * so it can never pull one in and `loadOutsideParents` must never be handed one.
 *
 * A note the base never RETURNED keeps nothing, and that is the context-row rule rather
 * than a rule of this roster: an `outsideFilter` note is never a source of anything
 * derived from the results. One can still arrive here — a result naming a resource as its
 * parent pulls it in through `loadOutsideParents` — and a row, a menu entry or a drop
 * target minted from it would be a target the user cannot act on.
 */
function divertResource(store: RawStore, file: TFile, entry: BasesEntry | null): null {
	if (entry !== null) store.resources.push({ file, title: file.basename });
	return null;
}

/**
 * A `Release` note's own target date, for the roadmap's marker overlay — read for a
 * `Release` and for nothing else, which is a rule about the TYPE and not an optimisation:
 * this key is the date a RELEASE ships on, so the same key on a PBI is that PBI's own
 * property and means nothing to the overlay. The option ships a real default
 * (`viewOptions.ts`), so without this gate every note in the vault would carry a reading
 * nothing may use.
 *
 * Read with `readSoleDate` rather than the tolerant `readDate` the placement axes share: a
 * release states ONE date, and the index refuses a list of them (`domain/releases.ts`), so
 * reading the same key tolerantly here drew a marker on the first entry of a list the other
 * view was calling unreadable — one note and two answers (found by review, PR #211).
 *
 * Its own function rather than a ternary in `addItem`, which is at its complexity budget:
 * a read whose gate is a type belongs beside `readGated` either way.
 */
function readReleaseDate(
	typeName: string | null,
	settings: BacklogSettings,
	fm: Record<string, unknown> | undefined,
): FieldReading<CivilDate> {
	return isReleaseType(typeName) ? readGated(settings.releaseDateKey, fm, readSoleDate) : absentReading();
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
 * A LABEL field read on the same gate, and the reason it is not `readGated<string>`: a
 * label is a plain value the user picked or typed, so there is no reading for it to
 * refuse and an unconfigured key is simply nothing. `readString` throughout, the tolerant
 * reader the state uses — a label written as a one-item list or a number is the value it
 * looks like.
 */
function readLabel(key: string, fm: Record<string, unknown> | undefined): string | null {
	return key ? readString(ownValue(fm, key)) : null;
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

/**
 * The name to SHOW for an item's assignee: the resolved note's own title, so a rename
 * reaches every item that names them, else the raw text for a value that resolves to
 * nothing, else nobody.
 *
 * A function rather than a field because it is presentation derived from the entry, and a
 * second stored copy is one refresh away from disagreeing with the link it came from.
 */
export function assigneeName(item: { assigneeEntry: LinkEntry | null }): string | null {
	return item.assigneeEntry === null ? null : (item.assigneeEntry.file?.basename ?? item.assigneeEntry.raw);
}

/**
 * One NOTE a caller may point a reader at: the note, and the name to draw for it. The two
 * are separate fields because they can differ — see {@link namedTargets} — and the value
 * behind an entry is always the note, never its label.
 */
export interface NamedTarget<T> {
	item: T;
	label: string;
}

/**
 * Candidates, named apart only where two of them collide: the basename, and the whole
 * path (minus the extension) for the notes that share one.
 *
 * Only where they collide, because qualifying every entry to separate a rare pair makes
 * the ordinary case unreadable — and a write is unaffected either way, since a plan
 * carries the FILE and a wikilink is spelled from the editing note's own path, never
 * from this label.
 *
 * One function for every surface that names a resource to the reader — `Set iteration`,
 * `Set release`, the absence dialog, the roadmap's lane headers and the assignee chip —
 * rather than the same disambiguation copied at each one. Domain rather than `view/`
 * because `BacklogModel.resourceLabels` (`model.ts`) is now a caller too: the map that
 * answers the assignee chip's question in O(1) is built by running this ONCE per model,
 * which a view-layer function could not be asked to do for a domain field. Generic over
 * the two fields disambiguation actually reads, not `BacklogItem`, so a plain
 * `ResourceNote` qualifies without a cast.
 */
export function namedTargets<T extends { title: string; file: TFile }>(found: T[]): NamedTarget<T>[] {
	const seen = new Map<string, number>();
	for (const target of found) seen.set(target.title, (seen.get(target.title) ?? 0) + 1);
	return found.map((target) => ({
		item: target,
		label:
			(seen.get(target.title) ?? 0) > 1
				? target.file.path.slice(0, -(target.file.extension.length + 1))
				: target.title,
	}));
}

/** No model yet, so no resource has a label — the one instance `resourceLabelsOf` ever needs. */
const EMPTY_RESOURCE_LABELS: ReadonlyMap<string, string> = new Map();

/**
 * The resource-label index a caller has to ask, with no model yet read as empty — one
 * function rather than the same `model?.resourceLabels ?? new Map()` written at every
 * call site. A chip or a row is drawn from an ITEM, and an item exists only once a model
 * has been built, so the null side is dead on arrival in practice — the question this
 * codebase's coverage rule asks first, before writing a test for an unreachable branch.
 * The shared empty instance is deliberate too: a fresh `Map()` per call would be one more
 * allocation on the exact per-row path {@link assigneeBroken} exists to keep out of.
 */
export function resourceLabelsOf(model: { resourceLabels: ReadonlyMap<string, string> } | null): ReadonlyMap<string, string> {
	return model?.resourceLabels ?? EMPTY_RESOURCE_LABELS;
}

/**
 * Whether this item's assignee names something the given index does not carry — roster
 * MEMBERSHIP, never link resolution. A link that resolves to an ordinary note, or to a
 * `Resource` note the base's own filter excluded, both name nobody the roadmap or a menu
 * will ever offer, so both must read as broken here exactly alike: answering from
 * resolution alone would draw either as a valid assignment while every other surface
 * treats it as nobody.
 *
 * Takes the LABEL INDEX (`BacklogModel.resourceLabels`, via {@link resourceLabelsOf}), not
 * the roster array `namedTargets` built it from: a `Map.has` is the O(1) membership test
 * `rowSignature` and the chip need on every row, where a `.some` over the whole roster
 * would be a second superlinear pass this codebase's row-cost rule refuses (review, PR
 * #207 fix round 1 — `src/domain/CLAUDE.md`'s cost section, and
 * `docs/requirements/A row costs its content, not its wiring.md`).
 */
export function assigneeBroken(item: { assigneeEntry: LinkEntry | null }, labels: ReadonlyMap<string, string>): boolean {
	if (item.assigneeEntry === null) return false;
	const path = item.assigneeEntry.file?.path;
	return path === undefined || !labels.has(path);
}
