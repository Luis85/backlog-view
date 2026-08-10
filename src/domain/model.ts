import { App, BasesEntry } from 'obsidian';
import { inferFolderParent } from './folderNotes';
import { DependencyNode, resolveDependencies } from './dependencies';
import { createItems, RawItem, RawStore } from './readItems';
import {
	childLevelIndex,
	EXTRA_TYPE_RANK,
	focusTarget,
	isDeliverableType,
	isExtraType,
	isMarkerType,
} from './itemTypes';
import {
	CivilDate,
} from './noteFields';
import { ALL_TYPES, BacklogSettings, LEVELS } from './settings';
import { assertResolvedSettings } from './settingsConsistency';
import { earliest, latest, reversedSpan } from './timeline';
import {
	collectObservedAssignees,
	collectObservedDeliverableStates,
	collectObservedHorizons,
	collectObservedStates,
	collectObservedTags,
} from './vocabulary';

/**
 * The model is built in three phases, and each has its own type. A field exists only
 * once the phase that owns it has run, so a function's parameter type says which
 * fields are real yet and the compiler enforces it — where this used to be 10
 * placeholder values and a paragraph of prose asking readers to remember.
 *
 * `RawItem` → `LinkedItem` → `BacklogItem`, each extending the one before. Consumers
 * outside this module only ever meet `BacklogItem`, so nothing downstream changes.
 */

/**
 * Phase 2 — the tree exists: parent links resolved against the loaded set, folder
 * inference applied, cycles broken. Everything about *shape*, nothing yet about
 * position: an item knows its parent but not how deep it sits or what level it is.
 */
interface LinkedItem extends RawItem {
	parent: LinkedItem | null;
	children: LinkedItem[];
	/** True when a parent value exists but doesn't resolve to an item in this view. */
	orphan: boolean;
}

/**
 * Phase 3 — everything derived from an item's position in the finished tree: levels,
 * visual depth, and the rollups counted back up from the leaves. This is the only
 * phase anything outside `model.ts` ever sees.
 */
export interface BacklogItem extends LinkedItem {
	parent: BacklogItem | null;
	children: BacklogItem[];
	/** Visual depth in the rendered tree (0 for rendered roots, focused or not). */
	depth: number;
	/** Index into `LEVELS`; -1 when typeName does not name a rung. */
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
	/** True when this item heads the rendered tree only because of the focus level. */
	focusRoot: boolean;
	descendantCount: number;
	/** Number of descendants counting as done. */
	doneDescendants: number;
	/** True when the item and every descendant are done — the unit hidden by "Show completed items". */
	subtreeDone: boolean;
	/**
	 * Earliest start and latest target stated by a RESULT below this item — the
	 * evidence a dateless parent's bar is inferred from, never a value written
	 * anywhere. Null when nothing below states a date of that kind. Gathered by
	 * the same walk and the same exclusion as the progress counts: a context
	 * row's own dates are not this base's plan, though the results beneath it are.
	 */
	descendantStart: CivilDate | null;
	descendantTarget: CivilDate | null;
	/**
	 * The items this one waits for, collapsed to one per note. Assigned by a pass after
	 * `assignAll` — the last phase, because an entry may only resolve against the set
	 * the model KEEPS, which the scope prune decides. Empty when the key is
	 * unconfigured, which is not a special case but the truth: no note declares one.
	 */
	prerequisites: BacklogItem[];
	/** Raw text of every declared entry that became no edge — see `dependencies.ts`. */
	brokenPrerequisites: string[];
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
	/**
	 * Every Deliverable-typed result in the base, regardless of any active focus level —
	 * the Deliverables board's own population. Unlike `results`, which a focus level
	 * re-roots to one subtree (`collectFocusRoots`), this is read off the whole,
	 * unfocused tree, so no OTHER type being focused elsewhere can narrow it. Excludes
	 * `outsideFilter` items, same as `results`.
	 */
	deliverableResults: BacklogItem[];
	/** True when a focus level restricts the rendered tree. */
	focused: boolean;
	/** Distinct state values in the result set: open states first, then done, both alphabetical. */
	observedStates: string[];
	/** Distinct horizon values in the result set, in first-seen order — the buckets it mints. */
	observedHorizons: string[];
	/** Distinct tags in the result set, alphabetical — the vocabulary the tag menus offer. */
	observedTags: string[];
	/** Distinct assignees in the result set, alphabetical — the whole list Set assignee offers. */
	observedAssignees: string[];
	/** Distinct Deliverable-workflow state values, scoped to Deliverable items. */
	observedDeliverableStates: string[];
	/** Notes the base returned that are not backlog items (see `pruneOutsideHierarchy`). */
	ignoredCount: number;
}

export function buildModel(app: App, entries: BasesEntry[], settings: BacklogSettings): BacklogModel {
	assertResolvedSettings(settings);
	const linked = linkAll(createItems(app, entries, settings), settings);
	breakCycles(linked);
	const ignoredCount = settings.hierarchyOnly ? pruneOutsideHierarchy(linked, settings) : 0;
	// Read off the linked phase: neither vocabulary depends on position, and taking
	// them here keeps them off the tree walk below.
	const observedStates = collectObservedStates(linked.all, settings);
	const observedTags = collectObservedTags(linked.all);
	const observedAssignees = collectObservedAssignees(linked.all);
	const observedDeliverableStates = collectObservedDeliverableStates(linked.all, settings);
	sortSiblingsDeep(linked.roots);
	const { roots, byPath, items } = assignAll(linked, settings);
	// The one vocabulary that is ORDERED rather than sorted, so it is taken from the
	// finished tree instead of the load order: the roadmap mints a bucket per new
	// value as it walks its rows, which are these items filtered — so reading them in
	// the same sequence is what keeps the menu from naming the buckets in an order
	// the axis then contradicts.
	const observedHorizons = collectObservedHorizons(items);
	assignDependencies(items);

	// A focus level re-roots the rendered tree at the topmost items of that level,
	// mirroring the per-level backlogs (Epics / Features / Stories) of Azure DevOps.
	const focus = focusTarget(settings);
	const focusIdx = focus ? LEVELS.findIndex((l) => l.toLowerCase() === focus.toLowerCase()) : -1;
	// A focus naming an EXTRA type re-roots at that type by name: it has no rung to
	// match, and "show me the bugs" is the same question as "show me the PBIs".
	const focusExtra = focusIdx < 0 && focus ? focus.toLowerCase() : '';
	const rest = {
		realRoots: roots,
		byPath,
		observedStates,
		observedTags,
		observedAssignees,
		observedHorizons,
		observedDeliverableStates,
		// Read off `items` — the whole tree `assignAll` just built, before either branch
		// below narrows anything to a focus subtree. See `BacklogModel.deliverableResults`.
		deliverableResults: items.filter((item) => !item.outsideFilter && isDeliverableType(item.typeName)),
		ignoredCount,
	};
	const shown = (list: BacklogItem[]) => ({ items: list, results: list.filter((i) => !i.outsideFilter) });
	if (focusIdx >= 0 || focusExtra) {
		const focusRoots = collectFocusRoots(roots, focusIdx, focusExtra, settings);
		return { ...rest, ...shown(assignVisualDepth(focusRoots)), roots: focusRoots, focused: true };
	}
	return { ...rest, ...shown(items), roots, focused: false };
}

/**
 * Resolve declared prerequisites into edges, once the item set is final.
 *
 * Runs after `assignAll` — and therefore after the scope prune — so an entry resolves
 * against the notes the model KEEPS. The two fields it fills are the last to land on a
 * `BacklogItem`, which is why they are assigned here rather than promoted: nothing about
 * an item's place in the tree depends on them, so no earlier phase can be waiting.
 *
 * Nothing else about any item changes. The tree's shape is identical with the property
 * configured and without it, which is the invariant the tests state from the rule.
 */
function assignDependencies(items: BacklogItem[]): void {
	const resolved = resolveDependencies(items.map(dependencyNode));
	for (const item of items) {
		const result = resolved.get(item.file.path);
		item.prerequisites = (result?.prerequisites ?? []).map((node) => node.item);
		item.brokenPrerequisites = result?.broken ?? [];
	}
}

/** The item as `dependencies.ts` needs it, carrying itself back for the result. */
function dependencyNode(item: BacklogItem): DependencyNode & { item: BacklogItem } {
	return {
		path: item.file.path,
		outsideFilter: item.outsideFilter,
		dependsOnEntries: item.dependsOnEntries,
		item,
	};
}

// ------------------------------------------------------------- build phases

interface LinkedTree {
	all: LinkedItem[];
	byPath: Map<string, LinkedItem>;
	roots: LinkedItem[];
}

interface BacklogTree {
	all: BacklogItem[];
	byPath: Map<string, BacklogItem>;
	roots: BacklogItem[];
}

/**
 * Phase 2. Attach children to parents; anything unresolvable becomes a root.
 *
 * The promotion is an assertion followed immediately by the loop that makes it true.
 * That is the price of an object graph with cycles in it — an item's parent points
 * back at the item — which cannot be rebuilt phase by phase without rebuilding every
 * reference to every item, so the fields are added to the objects that already exist.
 * The cost is paid exactly twice in this file, here and in `assignAll`, and both times
 * the very next statement assigns every field the new type claims.
 */
function linkAll(store: RawStore, settings: BacklogSettings): LinkedTree {
	const all = store.all as LinkedItem[];
	for (const item of all) {
		item.parent = null;
		item.children = [];
		item.orphan = false;
	}
	const byPath = store.byPath as Map<string, LinkedItem>;

	const roots: LinkedItem[] = [];
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
	return { all, byPath, roots };
}

/** Any item not reachable from a root is part of a parent cycle — re-root it. */
function breakCycles({ all, roots }: LinkedTree): void {
	const visited = new Set<LinkedItem>();
	const markSubtree = (start: LinkedItem) => {
		const stack = [start];
		while (stack.length > 0) {
			const cur = stack.pop() as LinkedItem;
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
 * custom-typed) container that holds typed ones.
 *
 * The tree is pruned in place — `all`, `roots` and `byPath` all lose the dropped notes,
 * so what survives here is exactly what the next phase promotes. Returns how many were
 * dropped, for the toolbar's advisory.
 */
function pruneOutsideHierarchy(tree: LinkedTree, settings: BacklogSettings): number {
	const { byPath, roots } = tree;
	// Every DECLARED type, not just the ladder: an extra type is a work item by the same
	// argument a level is, and counting only levels drops a parentless Bug out of the
	// model entirely — the note vanishing from the view moments after being typed.
	const supported = new Set(ALL_TYPES.map((t) => t.toLowerCase()));
	const belongs = (item: LinkedItem): boolean =>
		item.parent !== null ||
		item.hasParentValue ||
		item.explicitRoot ||
		// The anchor may be a folder note the filter excluded and the options chose
		// not to load; the note is still part of the hierarchy either way.
		item.parentExists ||
		(item.typeName !== null && supported.has(item.typeName.toLowerCase()));
	const subtreeBelongs = (item: LinkedItem): boolean => belongs(item) || item.children.some(subtreeBelongs);

	const dropped = new Set<LinkedItem>();
	for (let i = roots.length - 1; i >= 0; i--) {
		const root = roots[i];
		if (subtreeBelongs(root)) continue;
		roots.splice(i, 1);
		const stack = [root];
		while (stack.length > 0) {
			const cur = stack.pop() as LinkedItem;
			dropped.add(cur);
			byPath.delete(cur.file.path);
			for (const child of cur.children) stack.push(child);
		}
	}
	if (dropped.size > 0) tree.all = tree.all.filter((item) => !dropped.has(item));
	return dropped.size;
}

/** Walking up from an unreachable item always ends on the cycle that stranded it. */
function cycleEntry(start: LinkedItem): LinkedItem {
	const seen = new Set<LinkedItem>();
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
function sortSiblingsDeep(list: LinkedItem[]): void {
	list.sort(compareSiblings);
	for (const item of list) sortSiblingsDeep(item.children);
}

function compareSiblings(a: RawItem, b: RawItem): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	if (ao !== bo) return ao < bo ? -1 : 1;
	return a.entryIndex - b.entryIndex;
}

/**
 * Phase 3. Assign visual depth, semantic level and rollup counts over the full tree,
 * promoting every item as it is reached. The walk covers the whole tree — `breakCycles`
 * guarantees every item is reachable from a root, and pruning removes whole root
 * subtrees — so nothing is left behind holding the earlier type.
 *
 * The second and last promotion; see `linkAll` for why an assertion is the price of a
 * cyclic graph. Each item's fields are assigned before the walk moves on, and the
 * counts come back as return values rather than being read off the children, so a
 * rollup cannot accidentally read a field the recursion has not filled in yet.
 */
function assignAll(tree: LinkedTree, settings: BacklogSettings): BacklogTree & { items: BacklogItem[] } {
	const promoted = tree as BacklogTree;
	const items: BacklogItem[] = [];
	const assign = (linked: LinkedItem, depth: number): Rollup => {
		const item = linked as BacklogItem;
		item.depth = depth;
		computeLevel(item, settings);
		item.focusRoot = false;
		items.push(item);
		let count = 0;
		let done = 0;
		let start: CivilDate | null = null;
		let target: CivilDate | null = null;
		for (const child of item.children) {
			const sub = assign(child, depth + 1);
			// Traverse *through* a context row to the results below it, but never count
			// it: rollups describe what the Base returned, and an excluded note's own
			// state must not skew a progress bar or keep a finished subtree on screen.
			//
			// A MARKER is the second exception, and it is stated here rather than at a
			// call site precisely so it holds for every quantity this walk gathers — the
			// counts, and the date evidence below. A marker is not work: it is neither a
			// unit of progress nor evidence of when work happens, so a release date filed
			// under an epic must not become that epic's inferred end. Its own subtree is
			// traversed exactly as a context row's is.
			const self = child.outsideFilter || isMarkerType(child.typeName) ? 0 : 1;
			count += self + sub.count;
			done += (child.done ? self : 0) + sub.done;
			// Dates gather under the same exclusion, for the same reason: an excluded
			// note's dates are not this base's plan, so they stretch nothing — while
			// the results beneath it still reach their ancestors. `FieldReading.value`
			// is null for an absent key AND for a value the reader refuses, so an
			// unparseable date is not evidence without a branch saying so.
			//
			// A REVERSED pair needs that branch: both ends parse, so both would fold
			// in, and a lone broken child would hand its ancestor crossed evidence
			// that `inferSpan` reads as two single-ended children bracketing the work
			// — one typo drawn as a confident span while the child itself sits on the
			// shelf naming the error. The pair is refused; the subtree below it is not.
			if (self === 1 && !reversedSpan(child.plannedStart.value, child.plannedTarget.value)) {
				start = earliest(start, child.plannedStart.value);
				target = latest(target, child.plannedTarget.value);
			}
			start = earliest(start, sub.start);
			target = latest(target, sub.target);
		}
		item.descendantCount = count;
		item.doneDescendants = done;
		item.subtreeDone = item.done && done === count;
		item.descendantStart = start;
		item.descendantTarget = target;
		return { count, done, start, target };
	};
	for (const root of promoted.roots) assign(root, 0);
	return { ...promoted, items };
}

/** What a subtree contributes to its parent's counts and to its span. */
interface Rollup {
	count: number;
	done: number;
	start: CivilDate | null;
	target: CivilDate | null;
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
function collectFocusRoots(
	roots: BacklogItem[],
	focusIdx: number,
	focusExtra: string,
	settings: BacklogSettings,
): BacklogItem[] {
	const focusRoots: BacklogItem[] = [];
	// An extra type has no levelIndex but does occupy a rung, so focusing that RUNG has
	// to show it — otherwise a Bug simply vanishes from a focused view rather than
	// ranking beside the level it sits level with. Focusing the type by NAME shows only
	// that type.
	const extraFocused = focusIdx >= 0 && EXTRA_TYPE_RANK === focusIdx;
	const matches = (item: BacklogItem): boolean => {
		if (focusExtra) return item.typeName?.toLowerCase() === focusExtra;
		return item.levelIndex === focusIdx || (extraFocused && isExtraType(item.typeName));
	};
	const collect = (list: BacklogItem[]) => {
		for (const item of list) {
			if (matches(item)) {
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
	const childSlot = childLevelIndex(item.parent);
	if (item.typeName !== null) {
		const name = item.typeName.toLowerCase();
		const idx = LEVELS.findIndex((l) => l.toLowerCase() === name);
		item.levelIndex = idx;
		// A declared extra type holds the deepest level wherever it hangs, so its rung is
		// its own rather than one below its parent's — that pinning is what separates a
		// Bug (Tasks under it, under an Epic or a PBI alike) from an unknown custom type,
		// which occupies the slot below its parent so its children continue the ladder
		// correctly (Feature > Bugfix > implied Task).
		const offLadder = isExtraType(item.typeName) ? EXTRA_TYPE_RANK : childSlot;
		item.effectiveLevelIndex = idx >= 0 ? idx : offLadder;
		item.impliedType = false;
	} else {
		item.levelIndex = childSlot;
		item.effectiveLevelIndex = childSlot;
		item.impliedType = true;
	}
}
