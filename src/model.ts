import { App, BasesEntry, CachedMetadata, TFile } from 'obsidian';
import { inferFolderParent, nearestFolderNote } from './folderNotes';
import { BacklogSettings } from './settings';

/** One node of the backlog tree, wrapping a BasesEntry. */
export interface BacklogItem {
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
	parent: BacklogItem | null;
	children: BacklogItem[];
	/** Visual depth in the rendered tree (0 for rendered roots, focused or not). */
	depth: number;
	/** Index into settings.levels; -1 when typeName doesn't match any configured level. */
	levelIndex: number;
	/**
	 * The ladder position this item occupies, chained down the parent levels.
	 * Equals levelIndex for known types; for unknown or missing types it is one
	 * below the parent's effective level. Children derive their level from this,
	 * never from tree depth, so custom types and focus re-rooting can't skew it.
	 */
	effectiveLevelIndex: number;
	/** True when the level was derived from the parent chain because typeName is missing. */
	impliedType: boolean;
	/** True when a parent value exists but doesn't resolve to an item in this view. */
	orphan: boolean;
	/** True when this item heads the rendered tree only because of the focus level. */
	focusRoot: boolean;
	descendantCount: number;
	/** Raw value of the state property, if progress tracking is configured. */
	stateValue: string | null;
	/** Tags on the note, without their leading '#'; empty when the key is unset. */
	tags: string[];
	/** True when the state value matches one of the configured done values. */
	done: boolean;
	/** Number of descendants counting as done. */
	doneDescendants: number;
	/** True when the item and every descendant are done — the unit hidden by "Show completed items". */
	subtreeDone: boolean;
}

export interface BacklogModel {
	/** Roots of the rendered tree — synthetic focus rows when a focus level is active. */
	roots: BacklogItem[];
	/**
	 * Roots of the full hierarchy, regardless of focus. Data operations (backfill,
	 * ranking parentless items) must use these; only rendering uses `roots`.
	 */
	realRoots: BacklogItem[];
	byPath: Map<string, BacklogItem>;
	/** All rendered rows in depth-first (visual) order — including context rows. */
	items: BacklogItem[];
	/**
	 * The rendered rows the Bases query actually returned. Anything describing *this
	 * base* — counts, the level breakdown, how much is hidden — must use this, or
	 * ancestors loaded only for context inflate the answer.
	 */
	results: BacklogItem[];
	/** True when a focus level restricts the rendered tree. */
	focused: boolean;
	/** Distinct state values in the result set: open states first, then done, both alphabetical. */
	observedStates: string[];
	/** Distinct tags in the result set, alphabetical — the vocabulary the tag menus offer. */
	observedTags: string[];
	/** Notes the base returned that are not backlog items (see `pruneOutsideHierarchy`). */
	ignoredCount: number;
}

export function buildModel(app: App, entries: BasesEntry[], settings: BacklogSettings): BacklogModel {
	const { all, byPath } = createItems(app, entries, settings);
	const roots = linkParents(all, byPath, settings);
	breakCycles(all, roots);
	const scoped = settings.hierarchyOnly ? pruneOutsideHierarchy(all, byPath, roots, settings) : all;
	const ignoredCount = all.length - scoped.length;
	const observedStates = collectObservedStates(scoped, settings);
	const observedTags = collectObservedTags(scoped);
	sortSiblingsDeep(roots);
	let items = assignAll(roots, settings);

	// A focus level re-roots the rendered tree at the topmost items of that level,
	// mirroring the per-level backlogs (Epics / Features / Stories) of Azure DevOps.
	const focusIdx = settings.focusLevel
		? settings.levels.findIndex((l) => l.toLowerCase() === settings.focusLevel.toLowerCase())
		: -1;
	const rest = { realRoots: roots, byPath, observedStates, observedTags, ignoredCount };
	const shown = (list: BacklogItem[]) => ({ items: list, results: list.filter((i) => !i.outsideFilter) });
	if (focusIdx >= 0) {
		const focusRoots = collectFocusRoots(roots, focusIdx);
		return { ...rest, ...shown(assignVisualDepth(focusRoots)), roots: focusRoots, focused: true };
	}
	return { ...rest, ...shown(items), roots, focused: false };
}

/** The level name to show on an item's badge. */
export function displayType(item: BacklogItem, settings: BacklogSettings): string {
	if (item.levelIndex >= 0) return settings.levels[item.levelIndex];
	return item.typeName ?? '';
}

/**
 * Level index a child of `parent` should get: one below the parent's effective
 * level, clamped to the deepest configured level. Top-level items get level 0.
 */
export function childLevelIndex(parent: BacklogItem | null, levels: string[]): number {
	if (!parent) return 0;
	return Math.min(parent.effectiveLevelIndex + 1, levels.length - 1);
}

// ------------------------------------------------------------- build phases

interface ItemStore {
	all: BacklogItem[];
	byPath: Map<string, BacklogItem>;
}

function createItems(app: App, entries: BasesEntry[], settings: BacklogSettings): ItemStore {
	const store: ItemStore = { all: [], byPath: new Map() };
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
	store: ItemStore,
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
	const stateValue = settings.stateKey ? readString(fm?.[settings.stateKey]) : null;
	const doneValues = settings.doneValues.map((v) => v.toLowerCase());
	const item: BacklogItem = {
		file,
		entry,
		outsideFilter: entry === null,
		title: file.basename,
		typeName: readString(fm?.[settings.typeKey]),
		order: readNumber(fm?.[settings.orderKey]),
		entryIndex: store.all.length,
		parentPath: parentRef.file?.path ?? null,
		hasParentValue: parentRef.hasValue,
		parentExists: seed !== null,
		explicitRoot: parentRef.explicitRoot,
		parent: null,
		children: [],
		depth: 0,
		levelIndex: 0,
		effectiveLevelIndex: 0,
		impliedType: false,
		orphan: false,
		focusRoot: false,
		descendantCount: 0,
		stateValue,
		tags: settings.tagsKey ? readTags(fm?.[settings.tagsKey]) : [],
		done: stateValue !== null && doneValues.includes(stateValue.toLowerCase()),
		doneDescendants: 0,
		subtreeDone: false,
	};
	store.byPath.set(file.path, item);
	store.all.push(item);
	return seed;
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
function outsideParentSeed(
	app: App,
	file: TFile,
	ref: ParentRef,
	settings: BacklogSettings,
): TFile | null {
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
function loadOutsideParents(app: App, store: ItemStore, parents: TFile[], settings: BacklogSettings): void {
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

/** Attach children to parents; anything unresolvable becomes a root. */
function linkParents(all: BacklogItem[], byPath: Map<string, BacklogItem>, settings: BacklogSettings): BacklogItem[] {
	const roots: BacklogItem[] = [];
	for (const item of all) {
		let parent = item.parentPath ? byPath.get(item.parentPath) : undefined;
		// Folder mode: notes without an explicit parent link attach to the nearest
		// ancestor folder note, unless an empty parent key pins them to the top.
		if (!parent && settings.folderHierarchy && !item.hasParentValue && !item.explicitRoot) {
			parent = inferFolderParent(item, byPath) ?? undefined;
		}
		if (parent && parent !== item) {
			item.parent = parent;
			parent.children.push(item);
		} else {
			item.orphan = item.hasParentValue;
			roots.push(item);
		}
	}
	return roots;
}

/** Any item not reachable from a root is part of a parent cycle — re-root it. */
function breakCycles(all: BacklogItem[], roots: BacklogItem[]): void {
	const visited = new Set<BacklogItem>();
	const markSubtree = (start: BacklogItem) => {
		const stack = [start];
		while (stack.length > 0) {
			const cur = stack.pop() as BacklogItem;
			if (visited.has(cur)) continue;
			visited.add(cur);
			for (const child of cur.children) stack.push(child);
		}
	};
	for (const root of roots) markSubtree(root);
	for (const unreachable of all) {
		if (visited.has(unreachable)) continue;
		// Cut the link that actually closes the loop, not whatever hangs below it:
		// an item is unreachable as soon as any ancestor is in a cycle, and
		// re-rooting the item itself would strand a healthy parent link.
		const item = cycleEntry(unreachable);
		if (item.parent) {
			const siblings = item.parent.children;
			const idx = siblings.indexOf(item);
			if (idx >= 0) siblings.splice(idx, 1);
			item.parent = null;
		}
		item.orphan = true;
		roots.push(item);
		markSubtree(item);
	}
}

/**
 * Drop the notes that are not backlog items. A base scoped with `file.inFolder(...)`
 * returns everything living there — meeting notes, references, a README — and without
 * this they would render as untyped top-level items and be typed by the backfill.
 *
 * A note belongs to the backlog when it declares a *supported* type (one of the
 * configured levels) or has a parent, explicit or folder-inferred, resolvable or not.
 * The test runs per root subtree, not per note: one participant keeps the whole
 * component, so untyped children of a typed item stay, and so does an untyped (or
 * custom-typed) container that holds typed ones. Returns the surviving items;
 * `roots` and `byPath` are pruned in place.
 */
function pruneOutsideHierarchy(
	all: BacklogItem[],
	byPath: Map<string, BacklogItem>,
	roots: BacklogItem[],
	settings: BacklogSettings,
): BacklogItem[] {
	const levels = new Set(settings.levels.map((l) => l.toLowerCase()));
	const belongs = (item: BacklogItem): boolean =>
		item.parent !== null ||
		item.hasParentValue ||
		item.explicitRoot ||
		// The anchor may be a folder note the filter excluded and the options chose
		// not to load; the note is still part of the hierarchy either way.
		item.parentExists ||
		(item.typeName !== null && levels.has(item.typeName.toLowerCase()));
	const subtreeBelongs = (item: BacklogItem): boolean => belongs(item) || item.children.some(subtreeBelongs);

	const dropped = new Set<BacklogItem>();
	for (let i = roots.length - 1; i >= 0; i--) {
		const root = roots[i];
		if (subtreeBelongs(root)) continue;
		roots.splice(i, 1);
		const stack = [root];
		while (stack.length > 0) {
			const cur = stack.pop() as BacklogItem;
			dropped.add(cur);
			byPath.delete(cur.file.path);
			for (const child of cur.children) stack.push(child);
		}
	}
	return dropped.size > 0 ? all.filter((item) => !dropped.has(item)) : all;
}

/** Walking up from an unreachable item always ends on the cycle that stranded it. */
function cycleEntry(start: BacklogItem): BacklogItem {
	const seen = new Set<BacklogItem>();
	let cur = start;
	while (cur.parent && !seen.has(cur)) {
		seen.add(cur);
		cur = cur.parent;
	}
	return cur;
}

/**
 * Sort siblings by order; items without an order sort last, in the sequence the
 * Bases query delivered them — which honors the sort the user configured in the
 * Bases toolbar (file name by default).
 */
function sortSiblingsDeep(list: BacklogItem[]): void {
	list.sort(compareSiblings);
	for (const item of list) sortSiblingsDeep(item.children);
}

function compareSiblings(a: BacklogItem, b: BacklogItem): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	if (ao !== bo) return ao < bo ? -1 : 1;
	return a.entryIndex - b.entryIndex;
}

/** Assign visual depth, semantic level and rollup counts over the full tree. */
function assignAll(renderedRoots: BacklogItem[], settings: BacklogSettings): BacklogItem[] {
	const items: BacklogItem[] = [];
	const assign = (item: BacklogItem, depth: number) => {
		item.depth = depth;
		computeLevel(item, settings);
		items.push(item);
		let count = 0;
		let done = 0;
		for (const child of item.children) {
			assign(child, depth + 1);
			// Traverse *through* a context row to the results below it, but never count
			// it: rollups describe what the Base returned, and an excluded note's own
			// state must not skew a progress bar or keep a finished subtree on screen.
			const self = child.outsideFilter ? 0 : 1;
			count += self + child.descendantCount;
			done += (child.done ? self : 0) + child.doneDescendants;
		}
		item.descendantCount = count;
		item.doneDescendants = done;
		item.subtreeDone = item.done && done === count;
	};
	for (const root of renderedRoots) assign(root, 0);
	return items;
}

/**
 * First occurrence of every state value, sorted for the state menus: open states
 * alphabetically, done states after them. Deduped case-insensitively, keeping
 * the casing seen first.
 */
function collectObservedStates(all: BacklogItem[], settings: BacklogSettings): string[] {
	const seen = new Map<string, string>();
	for (const item of all) {
		// Ancestors from outside the filter are not part of this base's vocabulary:
		// offering their states would make values assignable that the results never use.
		if (item.outsideFilter) continue;
		if (item.stateValue !== null && !seen.has(item.stateValue.toLowerCase())) {
			seen.set(item.stateValue.toLowerCase(), item.stateValue);
		}
	}
	const done = new Set(settings.doneValues.map((v) => v.toLowerCase()));
	const values = [...seen.values()].sort((a, b) => a.localeCompare(b));
	return [...values.filter((v) => !done.has(v.toLowerCase())), ...values.filter((v) => done.has(v.toLowerCase()))];
}

/**
 * Every tag the results carry, alphabetical and deduped case-insensitively. Like
 * the state vocabulary this skips notes the Base excluded: an excluded parent's
 * tags are not this base's vocabulary and must not become assignable to results.
 */
function collectObservedTags(all: BacklogItem[]): string[] {
	const seen = new Map<string, string>();
	for (const item of all) {
		if (item.outsideFilter) continue;
		for (const tag of item.tags) {
			if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
		}
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Focused rendering re-roots the tree visually; effective levels stay untouched. */
function assignVisualDepth(renderedRoots: BacklogItem[]): BacklogItem[] {
	const items: BacklogItem[] = [];
	const assign = (item: BacklogItem, depth: number) => {
		item.depth = depth;
		items.push(item);
		for (const child of item.children) assign(child, depth + 1);
	};
	for (const root of renderedRoots) assign(root, 0);
	return items;
}

/** The topmost items whose level matches the focus level; nested matches stay children. */
function collectFocusRoots(roots: BacklogItem[], focusIdx: number): BacklogItem[] {
	const focusRoots: BacklogItem[] = [];
	const collect = (list: BacklogItem[]) => {
		for (const item of list) {
			if (item.levelIndex === focusIdx) {
				item.focusRoot = true;
				focusRoots.push(item);
			} else {
				collect(item.children);
			}
		}
	};
	collect(roots);
	return focusRoots;
}

function computeLevel(item: BacklogItem, settings: BacklogSettings): void {
	// The parent is processed first (pre-order), so its effective level is resolved.
	const childSlot = childLevelIndex(item.parent, settings.levels);
	if (item.typeName !== null) {
		const name = item.typeName.toLowerCase();
		const idx = settings.levels.findIndex((l) => l.toLowerCase() === name);
		item.levelIndex = idx;
		// Unknown types occupy the slot below their parent so their children
		// continue the ladder correctly (Feature > Bugfix > implied Task).
		item.effectiveLevelIndex = idx >= 0 ? idx : childSlot;
		item.impliedType = false;
	} else {
		item.levelIndex = childSlot;
		item.effectiveLevelIndex = childSlot;
		item.impliedType = true;
	}
}

// ----------------------------------------------------------- frontmatter IO

interface ParentRef {
	/** The note the parent property resolves to, regardless of the Base's filter. */
	file: TFile | null;
	hasValue: boolean;
	/** Parent key present but empty — an explicit "top level" marker in folder mode. */
	explicitRoot: boolean;
}

function resolveParent(app: App, file: TFile, cache: CachedMetadata | null, parentKey: string): ParentRef {
	if (!cache) return { file: null, hasValue: false, explicitRoot: false };

	// Preferred: the parsed frontmatter link cache (handles wikilinks and aliases).
	for (const link of cache.frontmatterLinks ?? []) {
		if (link.key === parentKey || link.key.startsWith(parentKey + '.')) {
			const dest = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
			return { file: dest ?? null, hasValue: true, explicitRoot: false };
		}
	}

	// Fallback: raw frontmatter value, e.g. a plain note name without brackets.
	const fm = cache.frontmatter;
	const raw: unknown = fm?.[parentKey];
	const rawValue: unknown = Array.isArray(raw) ? raw[0] : raw;
	if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
		const keyPresent = !!fm && parentKey in fm;
		return { file: null, hasValue: false, explicitRoot: keyPresent };
	}
	const linkpath = linkpathFromRawValue(rawValue);
	if (linkpath.length === 0) return { file: null, hasValue: true, explicitRoot: false };
	const dest = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
	return { file: dest ?? null, hasValue: true, explicitRoot: false };
}

/** Strip wikilink brackets, aliases and heading refs from a raw parent value. */
function linkpathFromRawValue(rawValue: string): string {
	let linkpath = rawValue.trim();
	const wiki = linkpath.match(/^\[\[([^\]]+)\]\]$/);
	if (wiki) linkpath = wiki[1];
	return linkpath.split('|')[0].split('#')[0].trim();
}

function readString(value: unknown): string | null {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (Array.isArray(value)) return value.length > 0 ? readString(value[0]) : null;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return null;
}

/**
 * Frontmatter tags, in either shape Obsidian accepts: a YAML list, or one string
 * holding several tags separated by commas or spaces. The leading '#' is optional
 * in frontmatter, so it is stripped here and re-added only for display.
 */
function readTags(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : [value];
	const tags: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== 'string') continue;
		for (const part of entry.split(/[,\s]+/)) {
			const tag = part.trim().replace(/^#+/, '');
			if (tag.length > 0 && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
		}
	}
	return tags;
}

function readNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}
