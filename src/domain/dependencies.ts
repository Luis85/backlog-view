import type { ShelfCard, TimelineBar } from './bars';
import { isMarkerType } from './itemTypes';
import { CivilDate, LinkEntry } from './noteFields';
import { daysBetween } from './timeline';

/**
 * Turning what notes SAY about prerequisites into what the model KNOWS: which edges
 * are real, which entries became none, and which picks would close a loop.
 *
 * The read happens in `noteFields.ts` and the raw entries ride on the item from the
 * phase that read the note. Everything here is graph work over the item set the model
 * kept, so it writes nothing, loads nothing, and asks the vault nothing.
 */

/** The shape this module needs of an item: identity, scope, and what the note said. */
export interface DependencyNode {
	path: string;
	/** A row the Base excluded. It may be NAMED by a result; its own list is not read. */
	outsideFilter: boolean;
	dependsOnEntries: LinkEntry[];
}

/** What resolution decided for one item. */
export interface DependencyResult<T> {
	/** Prerequisites that became real edges — collapsed, so one entry per note. */
	prerequisites: T[];
	/**
	 * The raw text of every entry that became NO edge: unresolvable, self-naming, or
	 * taking part in a cycle. Kept in the note's own order, duplicates included, because
	 * the removal path matches on this text and has to be able to name every line.
	 */
	broken: string[];
}

/**
 * Resolve every declared entry against the item set, and mark the ones that cannot be
 * an ordering.
 *
 * Broken is three cases and one algorithm. An entry is broken when it resolves to
 * nothing, when it names its own item, or when it takes part in a cycle — and the last
 * of those is why this runs Tarjan's strongly-connected components rather than a
 * back-edge walk. `Dependencies as a property` 4b requires **every** entry in a cycle to
 * be marked, and a back-edge DFS marks whichever entry its traversal happened to reach
 * second: a fact about the walk order, which moves between the two notes when the Base
 * re-sorts. An edge is broken exactly when both ends share a component, which is a
 * property of the graph and not of the visit order. A self-edge is a component of one
 * containing itself, so it needs no case of its own.
 */
export function resolveDependencies<T extends DependencyNode>(items: T[]): Map<string, DependencyResult<T>> {
	const candidates = declaredEdges(items);
	const component = stronglyConnected(items, candidates);
	const results = new Map<string, DependencyResult<T>>();
	for (const item of items) results.set(item.path, { prerequisites: [], broken: [] });
	for (const item of items) {
		const result = results.get(item.path);
		if (result) settle(item, candidates.get(item.path) ?? [], component, result);
	}
	return results;
}

/** One entry that resolved to an item, and the text it was written as. */
interface Candidate<T> {
	raw: string;
	from: T;
	/** Unresolvable entries carry no target: they are broken before any graph is built. */
	resolved: boolean;
}

/**
 * Every declared entry, paired with the item it names where one exists.
 *
 * An excluded note's own list is not read at all — it may be NAMED by a result, and may
 * not do the naming — and no note is loaded to make an entry resolve: the set is what
 * the model kept, so a name it never returned, or one the prune dropped, simply does
 * not resolve. Nothing here calls such an entry mistyped, because telling that from
 * out-of-base needs a lookup this layer deliberately does not make.
 */
function declaredEdges<T extends DependencyNode>(items: T[]): Map<string, Candidate<T>[]> {
	const byPath = new Map<string, T>();
	for (const item of items) byPath.set(item.path, item);
	const candidates = new Map<string, Candidate<T>[]>();
	for (const item of items) {
		if (item.outsideFilter) continue;
		const mine = item.dependsOnEntries.map((entry) => {
			const from = entry.file ? byPath.get(entry.file.path) : undefined;
			return from ? { raw: entry.raw, from, resolved: true } : { raw: entry.raw, from: item, resolved: false };
		});
		if (mine.length > 0) candidates.set(item.path, mine);
	}
	return candidates;
}

/**
 * Sort one item's entries into prerequisites and marks.
 *
 * Both ends in one component means the edge is part of a loop — including the loop of
 * length one, an item naming itself. Duplicates and differing spellings of one note are
 * one prerequisite; the raw entries stay whole on the item, because collapsing is a
 * statement about dependencies rather than about YAML.
 */
function settle<T extends DependencyNode>(
	item: T,
	mine: Candidate<T>[],
	component: Map<string, number>,
	result: DependencyResult<T>,
): void {
	const seen = new Set<string>();
	for (const candidate of mine) {
		if (!candidate.resolved || component.get(candidate.from.path) === component.get(item.path)) {
			result.broken.push(candidate.raw);
			continue;
		}
		if (seen.has(candidate.from.path)) continue;
		seen.add(candidate.from.path);
		result.prerequisites.push(candidate.from);
	}
}

/**
 * Tarjan's SCC over the candidate edges, returning each item's component id.
 *
 * Iterative rather than recursive: the graph is user data, and a long chain of
 * prerequisites would otherwise be a stack overflow in the middle of a model build.
 *
 * Every node is numbered on discovery, and the walk's bookkeeping is held in ARRAYS
 * indexed by that number rather than in maps keyed by path. That is not a speed
 * argument: `Map.get` returns `T | undefined`, so every read would carry a `?? 0` arm
 * that cannot be reached — the node is numbered before anything reads it — and an
 * unreachable arm is a line no test can cover and no reader can rule out.
 */
interface TarjanState {
	/** Discovery number per node, -1 until reached. */
	index: number[];
	low: number[];
	onStack: boolean[];
	stack: number[];
	component: number[];
	next: number;
	components: number;
}

/** A node and how far through its edges the walk has got. */
interface Frame {
	id: number;
	edge: number;
}

function stronglyConnected<T extends DependencyNode>(
	items: T[],
	candidates: Map<string, Candidate<T>[]>,
): Map<string, number> {
	const ids = new Map<string, number>();
	items.forEach((item, id) => ids.set(item.path, id));
	// Edges as ids, resolved once, so the walk never touches a string.
	// Only entries that RESOLVED are edges. An unresolvable one is already broken and
	// carries its own item as a placeholder target, so admitting it here would put a
	// self-loop in the graph that means nothing.
	const edges = items.map((item) =>
		(candidates.get(item.path) ?? []).filter((edge) => edge.resolved).map((edge) => ids.get(edge.from.path) ?? -1),
	);
	const state: TarjanState = {
		index: items.map(() => -1),
		low: items.map(() => -1),
		onStack: items.map(() => false),
		stack: [],
		component: items.map(() => -1),
		next: 0,
		components: 0,
	};
	for (let id = 0; id < items.length; id += 1) {
		if (state.index[id] === -1) walkFrom(id, state, edges);
	}
	const byPath = new Map<string, number>();
	items.forEach((item, id) => byPath.set(item.path, state.component[id]));
	return byPath;
}

/** One depth-first walk, from a node nothing has reached yet. */
function walkFrom(root: number, state: TarjanState, edges: number[][]): void {
	const frames: Frame[] = [{ id: root, edge: 0 }];
	discover(root, state);
	while (frames.length > 0) {
		const frame = frames[frames.length - 1];
		const outgoing = edges[frame.id];
		if (frame.edge < outgoing.length) {
			const target = outgoing[frame.edge];
			frame.edge += 1;
			descend(frame, target, state, frames);
			continue;
		}
		// Every edge walked: this node closes a component if it is the root of one.
		frames.pop();
		if (state.low[frame.id] === state.index[frame.id]) closeComponent(frame.id, state);
		const parent = frames[frames.length - 1];
		if (parent) state.low[parent.id] = Math.min(state.low[parent.id], state.low[frame.id]);
	}
}

/** Number a node the walk has just reached, and put it on the component stack. */
function discover(id: number, state: TarjanState): void {
	state.index[id] = state.next;
	state.low[id] = state.next;
	state.next += 1;
	state.stack.push(id);
	state.onStack[id] = true;
}

/** Take one edge: descend into an unseen node, or note a link back into this component. */
function descend(frame: Frame, target: number, state: TarjanState, frames: Frame[]): void {
	if (state.index[target] === -1) {
		discover(target, state);
		frames.push({ id: target, edge: 0 });
		return;
	}
	if (state.onStack[target]) state.low[frame.id] = Math.min(state.low[frame.id], state.index[target]);
}

/** Pop the stack down to `root`, giving every node popped one component id. */
function closeComponent(root: number, state: TarjanState): void {
	const id = state.components;
	state.components += 1;
	// Spliced from the root's own position rather than popped until it turns up: the
	// root is on the stack by construction, so a pop-until-found loop would carry an
	// undefined arm nothing can reach.
	//
	// `lastIndexOf`, not `indexOf`, and the difference is the cost: everything above the
	// root belongs to the root's own component (anything discovered later that did not
	// was removed by its own closure), so a backwards scan stops at the component
	// boundary rather than walking the ancestors below it. Each node is scanned once
	// across the whole run — a singleton root is the last element and is found in one
	// step, which is the shape a long acyclic chain has.
	for (const member of state.stack.splice(state.stack.lastIndexOf(root))) {
		state.onStack[member] = false;
		state.component[member] = id;
	}
}

/**
 * Every item that already waits on `path`, directly or through a chain — including
 * `path` itself, since naming yourself is the loop of length one.
 *
 * This is the legality question the picker asks, and it is asked ONCE per menu rather
 * than once per candidate. Naming `c` as a prerequisite of `item` creates the edge
 * `c → item`, which closes a loop exactly when a path already runs from `item` to `c`;
 * so the illegal candidates are precisely the items reachable forward from `item`, and
 * a picker filters against this set instead of running a search per row. Asking per
 * candidate would walk the graph n times to answer n questions with one shape.
 */
export function dependentsClosure(path: string, prerequisites: Map<string, string[]>): Set<string> {
	// The edge set read backwards, built once: prerequisite path → the items naming it.
	const dependents = new Map<string, string[]>();
	for (const [dependent, list] of prerequisites) {
		for (const prerequisite of list) {
			const existing = dependents.get(prerequisite);
			if (existing) existing.push(dependent);
			else dependents.set(prerequisite, [dependent]);
		}
	}
	const reached = new Set<string>([path]);
	// A cursor rather than a pop-until-empty loop, for the reason above: the queue grows
	// as it is walked, and indexing it states that without an unreachable undefined arm.
	const queue = [path];
	for (let at = 0; at < queue.length; at += 1) {
		for (const dependent of dependents.get(queue[at]) ?? []) {
			if (reached.has(dependent)) continue;
			reached.add(dependent);
			queue.push(dependent);
		}
	}
	return reached;
}

/** One drawable edge: the prerequisite's bar, the dependent's bar, and whether it conflicts. */
export interface DependencyArrow {
	from: TimelineBar;
	to: TimelineBar;
	conflict: boolean;
}

/**
 * What `dependencyArrows` returns: the edges with two bars to draw between (main flow
 * 1-2), and — separately — WHICH of each dependent's own prerequisites conflict, keyed
 * by the dependent's own path. `conflicts` covers two populations that cannot share one
 * arrow shape — an arrow needs a `to` bar and a SHELVED dependent (2b) has none, only a
 * stated date instead of it — but they answer the identical question main flow step 3
 * asks of either kind of row: not merely THAT a prerequisite conflicts, but WHICH one,
 * at the same resolution the picture has rather than a boolean rounding it down to a
 * quarter of itself. Nothing here decides HOW that is shown; a caller reads `conflicts`
 * to mark a row or a card, exactly as it reads `arrows` to draw a line.
 */
export interface DependencyArrows {
	arrows: DependencyArrow[];
	/** Dependent path → the prerequisite paths that conflict with it — a dated row's own
	 *  edges (main flow step 2) and a shelved card's (2b) in the one map, since both are
	 *  "the dependent's row" under 1b and neither needs a shape the other lacks. */
	conflicts: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Which prerequisite edges have two ends to draw between and which of those contradict
 * their own dates (main flow steps 1-2), plus which SHELVED dependents contradict a
 * prerequisite by the start they state (2b) — [[Arrows between bars]].
 *
 * Bars answer drawability on their own: an end that is shelved, hidden, collapsed or
 * filtered out of the passed set simply has no bar here, and that alone is why it draws
 * no arrow (1a, 1b) — nothing here re-derives placement. Nothing special is needed for 1c
 * either: `deriveBars` routes an `outsideFilter` row to context before any span is
 * computed for it, so such a row never has a bar in the passed set either — the same
 * membership test that answers 1a/1b already answers 1c. A `brokenPrerequisites` entry is
 * likewise never re-examined: `resolveDependencies` already kept it out of
 * `prerequisites` (1d), so walking that list is the whole answer — and it never conflicts
 * either, for the same reason: an entry that resolved to nothing, or to a self-reference
 * or a cyclic edge, is not a date to be late against.
 *
 * A shelved dependent has no bar, so its half of the question needs the shelf as a second
 * input — the register's own answer once the plan that first read 2b backwards was
 * corrected: shelving is a verdict on the whole span, judged over BOTH ends, while a
 * conflict rests on the one end the dependent states. `shelvedConflicts` asks that
 * question of `card.item.plannedStart` directly — the same field `bars.ts`'s
 * `statedEnds`/`placeItem` read to decide bar or shelf in the first place, reached
 * without importing `bars.ts` itself, which would close `bars.ts → model.ts →
 * dependencies.ts → bars.ts` — rather than re-deriving anything about the placement.
 */
export function dependencyArrows(bars: TimelineBar[], shelf: ShelfCard[]): DependencyArrows {
	const byPath = new Map<string, TimelineBar>();
	for (const bar of bars) byPath.set(bar.item.file.path, bar);
	const arrows: DependencyArrow[] = [];
	const conflictedPrereqs = new Map<string, Set<string>>();
	for (const to of bars) {
		for (const prerequisite of to.item.prerequisites) {
			const from = byPath.get(prerequisite.file.path);
			if (!from) continue;
			const conflict = conflicts(from, to);
			arrows.push({ from, to, conflict });
			if (conflict) addConflict(conflictedPrereqs, to.item.file.path, from.item.file.path);
		}
	}
	for (const card of shelf) {
		for (const prerequisite of shelvedConflicts(card, byPath)) {
			addConflict(conflictedPrereqs, card.item.file.path, prerequisite);
		}
	}
	return { arrows, conflicts: conflictedPrereqs };
}

/** Record that `dependent` conflicts with `prerequisite`, minting the set on first use. */
function addConflict(conflicts: Map<string, Set<string>>, dependent: string, prerequisite: string): void {
	const set = conflicts.get(dependent);
	if (set) set.add(prerequisite);
	else conflicts.set(dependent, new Set([prerequisite]));
}

/**
 * `dependent.start <= prerequisite.end`, on or before — an end is inclusive, so a
 * dependent starting the same day occupies a day its prerequisite is still running
 * ([[Bars from two dates]]'s own `clampedEnd - clampedStart + 1`).
 *
 * Judged per END, not per item, and only on a date the note itself states: an end this
 * projection INFERRED (rolled up from a subtree) or never derived at all (absent — the
 * open end a dateless bar leaves) suppresses the comparison on that side alone, so a
 * prerequisite with a stated target and an inferred start still conflicts (2a). A
 * milestone needs no case of its own — `placeMarker` already reduced it to its target at
 * both ends before either bar reached this function (1e).
 */
function conflicts(from: TimelineBar, to: TimelineBar): boolean {
	const dependentStart = statedDate(to.span.start, to.inferredStart);
	return dependentStart !== null && runsPast(from, dependentStart);
}

/**
 * 2b: a SHELVED dependent is judged by the start it states, never by the fact that it
 * shelved — shelving is a verdict drawn over both ends, a conflict over one of them. No
 * readable stated start (no dates at all, or a start the reader refuses) is "unplanned",
 * not "late", and is exempt regardless of why the item shelved. A stated, readable start
 * is compared against a dated prerequisite's own end by the identical inclusive rule
 * `conflicts` uses — the same contradiction between two written dates 2a is about, simply
 * missing an arrow to draw it with.
 *
 * Never asked of a MARKER: `placeItem` reduces one to its target before any span rule
 * runs (1e), so a stray start on a milestone note is not a date this projection uses,
 * however its shelf reason is spelled — `item.plannedStart` would still read it off the
 * note, since a `BacklogItem` field knows nothing of its own type, so the exclusion has
 * to be made here. Read off `card.item.plannedStart` directly rather than through
 * `bars.ts`'s `statedEnds`: that import would close `bars.ts → model.ts →
 * dependencies.ts → bars.ts`, and the field it wraps is already on `BacklogItem`.
 *
 * Returns every prerequisite path that runs past the stated start, not merely whether
 * one does: a shelved dependent waiting on several things is judged per prerequisite,
 * exactly as a dated one is by `conflicts` — the note forbids a coarser verdict than
 * the picture, and a flat `.some()` here was that verdict.
 */
function shelvedConflicts(card: ShelfCard, byPath: Map<string, TimelineBar>): string[] {
	if (isMarkerType(card.item.typeName)) return [];
	const start = card.item.plannedStart;
	if (start.invalid || start.value === null) return [];
	const stated = start.value;
	return card.item.prerequisites
		.filter((prerequisite) => {
			const from = byPath.get(prerequisite.file.path);
			return from !== undefined && runsPast(from, stated);
		})
		.map((prerequisite) => prerequisite.file.path);
}

/** True when a prerequisite bar's own stated end runs on or past `start` — the inclusive
 *  comparison main flow step 2 states, shared by an ordinary edge (2a) and a shelved
 *  dependent's stated start (2b): one rule, asked with two different "other" ends. */
function runsPast(from: TimelineBar, start: CivilDate): boolean {
	const prerequisiteEnd = statedDate(from.span.target, from.inferredEnd);
	return prerequisiteEnd !== null && daysBetween(start, prerequisiteEnd) >= 0;
}

/** A bar's own end, or null when it is inferred or simply not there. */
function statedDate(value: CivilDate | null, inferred: boolean): CivilDate | null {
	return inferred ? null : value;
}
