import { BacklogItem, BacklogModel } from './model';
import { ownWorkflowReading } from './board';
import { isMarkerType } from './itemTypes';

export interface ScopeRow {
	item: BacklogItem;
	/**
	 * Depth within THIS tree, not the backlog's: depth 0 is the topmost KEPT row, which is
	 * normally a CONTEXT ancestor rather than a member. Every row an ancestor chain passes
	 * through without keeping — a marker, an excluded row — costs a level, so the tree
	 * closes up around what it does not draw.
	 */
	depth: number;
	/** True for an ancestor drawn only to keep a member in its place. */
	context: boolean;
	/**
	 * Members at or below this row, and how many of them are done — the rollup the row
	 * draws, over THIS release's members rather than over the model's descendants.
	 *
	 * `item.descendantCount` and `item.doneDescendants` are the wrong pair for the same
	 * reason `item.subtreeDone` is: they count every non-marker descendant the BASE
	 * returned, consulting no membership, so a Feature with two members here and five
	 * items elsewhere would report `1/7` on a screen whose every other figure is over
	 * seven fewer notes.
	 *
	 * Zero on a row with no members below it, which is what makes a CONTEXT row's
	 * `memberTotal` the count of the members it is holding in place — and what keeps the
	 * row itself out of both numbers, since a context row is never counted anywhere on
	 * this screen. Each member's doneness is `ownWorkflowReading`'s, so a Deliverable
	 * answers by its own workflow.
	 */
	memberTotal: number;
	memberDone: number;
	/**
	 * Whether every MEMBER at or below this row is done — the predicate hiding uses, and
	 * deliberately not `item.subtreeDone`.
	 *
	 * That model field is `item.done && done === count` over every non-marker descendant
	 * the BASE returned, consulting no membership at all, so a done member whose only
	 * unfinished child belongs to another release (or to none) would never hide by it.
	 * This one asks the same question of this release's own population, which is the
	 * population every other figure on this screen is measured over.
	 *
	 * A CONTEXT row answers for its members alone: its own state is not this base's
	 * plan, so it can neither keep a finished subtree on screen nor take an unfinished
	 * one off it — the context-row rule, in the shape `assignAll` already keeps it.
	 */
	subtreeDone: boolean;
}

/**
 * Members, plus every ancestor that holds one in place — with two kinds walked THROUGH
 * rather than kept. A MARKER, because `descendantCount` scores one 0 and traverses it, so
 * a marker is never what holds a row in place. An `outsideFilter` ancestor, because it is
 * not in the results and the context-row rule says such a row is never a source of
 * anything derived from the results. Both skips CONTINUE the walk upward: an included
 * ancestor further up is still the member's rightful place.
 *
 * `isMember` is the whole of what varies between the screens that use this — a release's
 * membership property, or an item's assignee.
 */
export function scopeRows(model: BacklogModel, isMember: (item: BacklogItem) => boolean): ScopeRow[] {
	const members = new Set<string>();
	const keep = new Set<string>();
	for (const item of model.byPath.values()) {
		if (item.outsideFilter || !isMember(item)) continue;
		members.add(item.file.path);
		keep.add(item.file.path);
		for (let up = item.parent; up !== null; up = up.parent) {
			if (isMarkerType(up.typeName) || up.outsideFilter) continue;
			keep.add(up.file.path);
		}
	}

	// One pass, pre-order for `rows` (the tree's own drawing order) and post-order for the
	// rollup: a row's totals need every descendant visited, so the row is pushed on the way
	// DOWN and filled in on the way back UP. `rows` holds the object the recursion mutates.
	const rows: ScopeRow[] = [];
	const walk = (item: BacklogItem, depth: number): { total: number; done: number } => {
		const kept = keep.has(item.file.path);
		const mine = members.has(item.file.path);
		let row: ScopeRow | null = null;
		if (kept) {
			row = { item, depth, context: !mine, memberTotal: 0, memberDone: 0, subtreeDone: false };
			rows.push(row);
		}
		let belowTotal = 0;
		let belowDone = 0;
		for (const child of item.children) {
			const sub = walk(child, kept ? depth + 1 : depth);
			belowTotal += sub.total;
			belowDone += sub.done;
		}
		// A row reports what is BELOW it, never itself, so a leaf member draws no trivial 1/1.
		if (row) {
			row.memberTotal = belowTotal;
			row.memberDone = belowDone;
		}
		// Hiding asks the other question — is EVERY member at or below this row done, this
		// row's own membership included — so it reads these two rather than the pair above.
		const total = belowTotal + (mine ? 1 : 0);
		const done = belowDone + (mine && ownWorkflowReading(item).done ? 1 : 0);
		if (row) row.subtreeDone = total > 0 && done === total;
		return { total, done };
	};
	// From the model's REAL roots, so a focus level set on the backlog view cannot decide
	// what this tree contains.
	for (const root of model.realRoots) walk(root, 0);
	return rows;
}

/**
 * The rows the hide-done toggle leaves standing, in the same pre-order the walk produced.
 *
 * A finished subtree (`row.subtreeDone`) drops the ROW ITSELF and everything below it —
 * never just its children, which is what {@link visibleRows}' fold-hiding does instead and
 * why this is a separate pass rather than one more condition folded into that one: a
 * folded row stays on screen with its disclosure closed, while a done row is gone, and a
 * release whose every root is done must therefore leave NO rows at all — the fact
 * `renderScope.ts` reads to choose the all-done state over an empty tree.
 *
 * Off (`hideDone` false) returns `rows` unchanged, so a caller need not branch around it.
 */
export function rowsAfterHideDone(rows: ScopeRow[], hideDone: boolean): ScopeRow[] {
	if (!hideDone) return rows;
	let hiddenBelow: number | null = null;
	return rows.filter((row) => {
		if (hiddenBelow !== null && row.depth > hiddenBelow) return false;
		hiddenBelow = null;
		if (row.subtreeDone) {
			hiddenBelow = row.depth;
			return false;
		}
		return true;
	});
}

/**
 * The rows a fold set leaves on screen, in the same pre-order the walk produced.
 *
 * A row is hidden by an ANCESTOR being folded, never by its own state, so the test is
 * "is any open fold shallower than me still in force" — the same shape `siblingPlaces`
 * uses to close a sibling group, and for the same reason: `rows` carries its own depth
 * and nothing else says who a row's parent was.
 *
 * Composed with {@link rowsAfterHideDone} rather than folded into one combined predicate:
 * `drawScopeTree` needs the hide-done-only view to decide which rows still have a CHILD
 * (a parent whose children all hid draws as a leaf, whatever its own fold state), and the
 * hide-done+fold view for what actually draws — two questions, asked over the same rows in
 * sequence, never one comparison trying to answer both at once.
 */
export function visibleRows(rows: ScopeRow[], folded: ReadonlySet<string>): ScopeRow[] {
	let hiddenBelow: number | null = null;
	return rows.filter((row) => {
		if (hiddenBelow !== null && row.depth > hiddenBelow) return false;
		hiddenBelow = null;
		if (folded.has(row.item.file.path)) hiddenBelow = row.depth;
		return true;
	});
}

/**
 * Each row's position among its SIBLINGS at its own level, never its index in the flat row
 * list — which would announce a three-row scope as one list of three and defeat the point
 * of drawing a tree.
 *
 * `scope.rows` is a pre-order walk carrying its own depth, so a group of siblings is the
 * run of rows at one depth that no shallower row has interrupted: a row shallower than an
 * open group closes it, and the next row at that depth starts a new one under a new parent.
 * Each entry holds the group it joined, so `count` is read after the whole walk rather than
 * guessed while it is still growing.
 *
 * Run over the VISIBLE rows, not the full walk: a folded row's children are never drawn at
 * all, so the group and position a screen reader hears must be the ones actually on screen
 * — including a group that a fold has thinned to fewer members than the model holds.
 */
export function siblingPlaces(rows: ScopeRow[]): { row: ScopeRow; pos: number; count: number }[] {
	const open = new Map<number, number[]>();
	const joined = rows.map((row) => {
		// The group-closing line, and the whole rule lives in it: a row shallower than an open
		// group ends that group, so the next row at that depth starts a fresh one under a new
		// parent. Without it every row at one depth joins one group for the length of the
		// scope, and a second Epic's members are announced as `3 of 4` instead of `1 of 2`.
		for (const depth of [...open.keys()]) if (depth > row.depth) open.delete(depth);
		const group = open.get(row.depth) ?? [];
		open.set(row.depth, group);
		group.push(group.length + 1);
		return { row, pos: group.length, group };
	});
	return joined.map(({ row, pos, group }) => ({ row, pos, count: group.length }));
}

/**
 * Whether each row (by path) in the FULL walk has a child — the next row one level deeper
 * — computed once over the UNFOLDED list, so a folded parent keeps its disclosure. Reading
 * this off the fold set instead would make a leaf whose stale fold entry survived a rename
 * (or a subtree that emptied out from under it) answer as a parent with nothing left to
 * expand: {@link foldedPaths} answers "was this path ever folded", never "does it have
 * children now".
 */
export function childRows(rows: ScopeRow[]): Set<string> {
	const withKids = new Set<string>();
	for (let i = 0; i < rows.length - 1; i++) {
		if (rows[i + 1].depth > rows[i].depth) withKids.add(rows[i].item.file.path);
	}
	return withKids;
}
