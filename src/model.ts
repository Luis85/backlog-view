import { App, BasesEntry, TFile } from 'obsidian';
import { BacklogSettings } from './settings';

/** One node of the backlog tree, wrapping a BasesEntry. */
export interface BacklogItem {
	file: TFile;
	entry: BasesEntry;
	title: string;
	/** Raw value of the type property, if present. */
	typeName: string | null;
	/** Numeric rank among siblings; null when the property is missing. */
	order: number | null;
	/** Resolved vault path of the parent note, if the parent link resolves. */
	parentPath: string | null;
	/** True when the parent property holds any value at all. */
	hasParentValue: boolean;
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
	/** True when the state value matches one of the configured done values. */
	done: boolean;
	/** Number of descendants counting as done. */
	doneDescendants: number;
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
	/** All rendered items in depth-first (visual) order. */
	items: BacklogItem[];
	/** True when a focus level restricts the rendered tree. */
	focused: boolean;
}

export function buildModel(app: App, entries: BasesEntry[], settings: BacklogSettings): BacklogModel {
	const { all, byPath } = createItems(app, entries, settings);
	const roots = linkParents(all, byPath);
	breakCycles(all, roots);
	sortSiblingsDeep(roots);
	let items = assignAll(roots, settings);

	// A focus level re-roots the rendered tree at the topmost items of that level,
	// mirroring the per-level backlogs (Epics / Features / Stories) of Azure DevOps.
	const focusIdx = settings.focusLevel
		? settings.levels.findIndex((l) => l.toLowerCase() === settings.focusLevel.toLowerCase())
		: -1;
	if (focusIdx >= 0) {
		const focusRoots = collectFocusRoots(roots, focusIdx);
		items = assignVisualDepth(focusRoots);
		return { roots: focusRoots, realRoots: roots, byPath, items, focused: true };
	}
	return { roots, realRoots: roots, byPath, items, focused: false };
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

function createItems(
	app: App,
	entries: BasesEntry[],
	settings: BacklogSettings,
): { all: BacklogItem[]; byPath: Map<string, BacklogItem> } {
	const byPath = new Map<string, BacklogItem>();
	const all: BacklogItem[] = [];
	const doneValues = new Set(settings.doneValues.map((v) => v.toLowerCase()));

	for (const entry of entries) {
		const file = entry.file;
		// Only markdown files can carry the frontmatter properties this view manages.
		if (!file || file.extension !== 'md' || byPath.has(file.path)) continue;
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		const parentRef = resolveParent(app, file, settings.parentKey);
		const stateValue = settings.stateKey ? readString(fm?.[settings.stateKey]) : null;
		const item: BacklogItem = {
			file,
			entry,
			title: file.basename,
			typeName: readString(fm?.[settings.typeKey]),
			order: readNumber(fm?.[settings.orderKey]),
			parentPath: parentRef.path,
			hasParentValue: parentRef.hasValue,
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
			done: stateValue !== null && doneValues.has(stateValue.toLowerCase()),
			doneDescendants: 0,
		};
		byPath.set(file.path, item);
		all.push(item);
	}
	return { all, byPath };
}

/** Attach children to parents; anything unresolvable becomes a root. */
function linkParents(all: BacklogItem[], byPath: Map<string, BacklogItem>): BacklogItem[] {
	const roots: BacklogItem[] = [];
	for (const item of all) {
		const parent = item.parentPath ? byPath.get(item.parentPath) : undefined;
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
	for (const item of all) {
		if (visited.has(item)) continue;
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

/** Sort siblings by order (missing order sorts last), then by title. */
function sortSiblingsDeep(list: BacklogItem[]): void {
	list.sort(compareSiblings);
	for (const item of list) sortSiblingsDeep(item.children);
}

function compareSiblings(a: BacklogItem, b: BacklogItem): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	if (ao !== bo) return ao < bo ? -1 : 1;
	return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
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
			count += 1 + child.descendantCount;
			done += (child.done ? 1 : 0) + child.doneDescendants;
		}
		item.descendantCount = count;
		item.doneDescendants = done;
	};
	for (const root of renderedRoots) assign(root, 0);
	return items;
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

function resolveParent(app: App, file: TFile, parentKey: string): { path: string | null; hasValue: boolean } {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { path: null, hasValue: false };

	// Preferred: the parsed frontmatter link cache (handles wikilinks and aliases).
	for (const link of cache.frontmatterLinks ?? []) {
		if (link.key === parentKey || link.key.startsWith(parentKey + '.')) {
			const dest = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
			return { path: dest?.path ?? null, hasValue: true };
		}
	}

	// Fallback: raw frontmatter value, e.g. a plain note name without brackets.
	const raw: unknown = cache.frontmatter?.[parentKey];
	const rawValue: unknown = Array.isArray(raw) ? raw[0] : raw;
	if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
		return { path: null, hasValue: false };
	}
	const linkpath = linkpathFromRawValue(rawValue);
	if (linkpath.length === 0) return { path: null, hasValue: true };
	const dest = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
	return { path: dest?.path ?? null, hasValue: true };
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

function readNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}
