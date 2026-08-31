import { Notice } from 'obsidian';
import { list, t } from '../../i18n/t';
import { keepsProjection } from '../../domain/itemTypes';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { DropTarget, focusPeers, isInvalidParent } from '../../domain/dropTargets';
import { configProblems } from '../../domain/settingsConsistency';
import { computeInitWrites, dropPlacement } from '../../domain/writePlan';

/**
 * Structural operations shared by the context menu and keyboard shortcuts.
 * All of them route through host.performDrop and reuse the drop-plan logic.
 */

/**
 * The item's sibling list and index within it, or null when it cannot be moved.
 *
 * `rankOnly` says which of the two kinds of move this context is for, and it is the
 * answer `withinSiblingsTarget` and `edgeTarget` turn into `DropTarget.parentUnchanged`
 * — see their own note. It cannot be re-derived from the values downstream: a focus
 * rank and an explicit top-level placement of the same row produce the same `parent`.
 */
function siblingContext(
	host: BacklogViewHost,
	item: BacklogItem,
): { fullList: BacklogItem[]; idx: number; rankOnly: boolean } | null {
	const model = host.model;
	// An ancestor from outside the filter has siblings the query never returned, so
	// ordering it against the loaded ones would be a guess.
	if (!model || item.outsideFilter) return null;
	// An ACTIVE focus row ranks among the rendered focus rows — the same destination
	// `dropTargets.ts`'s `siblingPosition` opened to the drag in Task 5, so Alt+arrow and
	// the move menu land the rank a drag would. Membership, not the `focusRoot` flag:
	// `projectionForest` sets that on any promoted root including with `model.focused`
	// false, and a promoted catalog row's real siblings are not on screen. Every other
	// promoted root keeps the refusal below.
	if (model.focused && model.roots.includes(item)) {
		// A context row with no order is never a ranking peer — `focusPeers` applies the
		// same predicate `anchoredOrder` skips it with when it is a candidate ANCHOR, to a
		// candidate PEER instead. It constrains nothing (there is no number to rank
		// against), so keeping it in this list only ever produced a command that wrote a
		// real order and left the draw unchanged: a null order sorts last regardless of
		// what the writable row's own order becomes. A RANKED context row stays — its order
		// is a real placement constraint, and dropping it here would jump a swap past a row
		// the population still has to be ranked against. The drag reads the SAME function,
		// which is what ended the disagreement between the two.
		const fullList = focusPeers(model);
		return { fullList, idx: fullList.indexOf(item), rankOnly: true };
	}
	if (item.focusRoot) return null;
	// The real root group, not the rendered forest — the same rule `siblingPosition`
	// keeps: an `order` is scoped to the notes sharing a parent, and a `Test suite` and an
	// `Epic` share the null one, so a move ranked against one projection's slice of it can
	// land on a number a hidden root already holds. A promoted root returned above.
	const fullList = item.parent ? item.parent.children : model.realRoots;
	const idx = fullList.indexOf(item);
	return idx === -1 ? null : { fullList, idx, rankOnly: false };
}

/**
 * The item as THIS model holds it. A context menu captures its row when it opens, and a
 * Bases refresh in between rebuilds every item as a new object — after which
 * `model.roots.includes`, `children.indexOf` and `ranked.indexOf` all miss, the placement
 * refuses `unranked`, and the pick does nothing at all with nothing said.
 *
 * Re-resolved by PATH here rather than by teaching `neighbourPair` to match on one: the
 * staleness is not a single lookup's. The peer list, the no-op comparison and the
 * planner's own "remove the dragged row from the population" filter all compare objects,
 * so one lookup made path-aware would leave the rest reading a model nobody is showing.
 * Called at the four entry points a captured handler reaches; the four PREDICATES beside
 * them are asked while the menu is being built, when the model is the current one.
 */
function liveItem(host: BacklogViewHost, item: BacklogItem): BacklogItem {
	return host.model?.byPath.get(item.file.path) ?? item;
}

/**
 * The nearest rendered sibling in the given direction, skipping rows hidden by
 * the completed-items toggle. Moves and menus target this item, so structural
 * commands never produce a visually inert change.
 */
export function visibleNeighbor(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): BacklogItem | null {
	const ctx = siblingContext(host, item);
	if (!ctx) return null;
	for (let i = ctx.idx + delta; i >= 0 && i < ctx.fullList.length; i += delta) {
		if (!host.isRowHidden(ctx.fullList[i])) return ctx.fullList[i];
	}
	return null;
}

/**
 * The target `moveWithinSiblings` would land on for this delta, or null when there
 * is no visible neighbor to swap with. Shared with `canReorder` so offering the
 * command and performing it can never disagree about the destination.
 */
function withinSiblingsTarget(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): DropTarget | null {
	const ctx = siblingContext(host, item);
	const neighbor = visibleNeighbor(host, item, delta);
	if (!ctx || !neighbor) return null;
	// Land on the far side of the visible neighbor; order math still runs over the
	// full sibling list, so hidden rows in between are simply skipped past.
	const peers = ctx.fullList.filter((s) => s !== item);
	const insertIndex = delta === -1 ? peers.indexOf(neighbor) : peers.indexOf(neighbor) + 1;
	// `parentUnchanged` comes from the CONTEXT, never from the value. `item.parent` is a
	// restatement under focus (rank the row, leave its parentage alone) and a real
	// placement otherwise — which must still clear a stale link — and the two spell the
	// same `null` for a row whose link does not resolve. `DROP_TARGET_RESTATEMENT` reads
	// only the `dragged.parent` spelling and so cannot see this one; its own comment says
	// exactly that, and this is the case it names.
	return { parent: item.parent, peers, insertIndex, parentUnchanged: ctx.rankOnly };
}

/**
 * The target `moveToEdge` would land on, or null when the item is already there. A
 * SEPARATE target from the adjacent swap's, which is the whole reason this function
 * exists: `insertIndex` 0 and `peers.length` anchor on the first and last peer, never
 * on the neighbour one slot away, so the two commands can be answered differently by
 * the same population. Children ranked 20/30/40 with any other note at 20 is the
 * reachable case — the swap succeeds and the edge move refuses.
 */
function edgeTarget(host: BacklogViewHost, item: BacklogItem, edge: 'top' | 'bottom'): DropTarget | null {
	const ctx = siblingContext(host, item);
	if (!ctx || ctx.idx === (edge === 'top' ? 0 : ctx.fullList.length - 1)) return null;
	const peers = ctx.fullList.filter((s) => s !== item);
	// Same `parentUnchanged` reasoning as `withinSiblingsTarget`, and it has to be the
	// same: the two commands differ in where they land, never in whether a landing is a
	// rank or a relocation.
	return { parent: item.parent, peers, insertIndex: edge === 'top' ? 0 : peers.length, parentUnchanged: ctx.rankOnly };
}

/**
 * Whether that placement would actually write something. Asked of the SAME plan
 * `computeDropWrites` would make — a rank is a midpoint in the global population, so a
 * spent gap or an unranked neighbour refuses silently, and an offered command that does
 * nothing is what this repo refuses ahead of a withheld one. Each command asks it of
 * its OWN target: one answer covering both would offer a Move to top that is inert
 * because the adjacent swap happened to work.
 */
function plans(host: BacklogViewHost, item: BacklogItem, target: DropTarget | null): boolean {
	const model = host.model;
	if (!model || !target) return false;
	return !('refusal' in dropPlacement(item, target, model.ranked));
}

/** True when reordering `item` one slot in the given direction would write something. */
export function canReorder(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): boolean {
	return plans(host, item, withinSiblingsTarget(host, item, delta));
}

/** True when sending `item` to that end of its own group would write something. */
export function canMoveToEdge(host: BacklogViewHost, item: BacklogItem, edge: 'top' | 'bottom'): boolean {
	return plans(host, item, edgeTarget(host, item, edge));
}

export function moveWithinSiblings(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): void {
	const live = liveItem(host, item);
	const target = withinSiblingsTarget(host, live, delta);
	if (!target) return;
	void host.performDrop(live, target);
}

export function moveToEdge(host: BacklogViewHost, item: BacklogItem, edge: 'top' | 'bottom'): void {
	const live = liveItem(host, item);
	const target = edgeTarget(host, live, edge);
	if (target) void host.performDrop(live, target);
}

/**
 * Where outdenting would put the item — right after its parent among the parent's
 * siblings — or null when that is unavailable. Exported so the menu can offer the
 * command on exactly the rows where it works.
 */
export function outdentTarget(host: BacklogViewHost, item: BacklogItem): DropTarget | null {
	const model = host.model;
	const parent = item.parent;
	if (!model || !parent || item.focusRoot || item.outsideFilter) return null;
	const grandparent = parent.parent;
	// Root-level outdents rank among the real top level, not the focus rows.
	const fullList = grandparent ? grandparent.children : model.realRoots;
	const peers = fullList.filter((s) => s !== item);
	// The grandparent may be on the other ladder — `Epic → Test case → Task` is the
	// reachable shape, since the case is drawn in the catalog as a promoted root and its
	// task is an ordinary child. Refused at the TARGET, not at the write: this function is
	// what the menu asks to decide whether to OFFER the command, and an offered command
	// that does nothing is what this repo refuses ahead of a withheld one.
	if (!keepsProjection(item, grandparent)) return null;
	const target: DropTarget = { parent: grandparent, peers, insertIndex: peers.indexOf(parent) + 1 };
	// Same reasoning as `canReorder`: ask the write path's own question rather than a
	// second, weaker opinion about it, so Outdent never offers a rank the global
	// population would refuse (a spent gap, an unranked neighbour).
	return plans(host, item, target) ? target : null;
}

/** Make the item a sibling of its parent, placed right after it. */
export function outdent(host: BacklogViewHost, item: BacklogItem): void {
	const live = liveItem(host, item);
	const target = outdentTarget(host, live);
	if (target) void host.performDrop(live, target);
}

/**
 * Where indenting would put the item — last among the previous visible sibling's children
 * — or null when that is unavailable. An append, so a partially loaded destination is
 * fine: last is last either way.
 *
 * Exported for the same reason `outdentTarget` is, and it was the one structural command
 * without it: an append still has to be RANKED, and the row after the new parent's last
 * child in the global population can be unranked or a spacing away, so the placement
 * refuses. Gated on the previous sibling alone, the menu offered `Indent under X`, wrote
 * nothing and said nothing — the same defect `Move to top` and `Move to bottom` were fixed
 * for, in the command that fix did not reach.
 */
export function indentTarget(
	host: BacklogViewHost,
	item: BacklogItem,
	newParent: BacklogItem | null = visibleNeighbor(host, item, -1),
): DropTarget | null {
	// Its own refusal, not one inherited from `siblingContext` — that function answers for
	// active focus rows now, so `visibleNeighbor` hands back a focus PEER and this would
	// offer `Indent under X` across the synthetic row. Ranking there is this feature;
	// reparenting there is a question about parentage that nothing here answers. Stated at
	// the TARGET rather than in `indent`, because the target is what the menu asks before
	// offering the entry, and an offered command that does nothing is what this repo
	// refuses ahead of a withheld one.
	if (item.focusRoot) return null;
	if (!newParent) return null;
	// A destination handed in was resolved by PATH, so the vault may have put it anywhere
	// since the menu named it — including under the item itself, which the previous
	// visible sibling could never be. The neighbour `visibleNeighbor` computes passes this
	// for free; a re-resolved one is the reason it is asked at all.
	if (isInvalidParent(newParent, item)) return null;
	const peers = newParent.children.filter((s) => s !== item);
	const target: DropTarget = { parent: newParent, peers, insertIndex: peers.length };
	return plans(host, item, target) ? target : null;
}

/**
 * Nest the item under `namedParentPath`, or — when no path is named — under its previous
 * visible sibling, at the end of that row's children.
 *
 * **Re-resolving a command's SUBJECT without re-resolving its TARGET makes the label and
 * the action disagree.** A command whose title names a specific note must re-resolve THAT
 * note by path and refuse if it is no longer a valid destination; it may never silently
 * compute a fresh one. `liveItem` re-resolving the subject is what made this a wrong
 * structural write rather than a harmless refusal: before it, a stale item failed every
 * lookup and the move did nothing, and afterwards the subject is faithfully re-resolved
 * and the write lands — against a destination recomputed from whatever the row's previous
 * visible neighbour happens to be NOW. A Bases refresh between opening the menu and
 * clicking is all it takes to reparent the note under a row the menu never named.
 *
 * The keyboard passes no path, deliberately: Alt+Right draws no label and promises no
 * note, so the neighbour at the moment of the press IS what the user asked for.
 */
export function indent(host: BacklogViewHost, item: BacklogItem, namedParentPath?: string): void {
	const live = liveItem(host, item);
	const named = namedParentPath === undefined ? undefined : host.model?.byPath.get(namedParentPath);
	if (namedParentPath !== undefined && !named) return;
	const target = indentTarget(host, live, named);
	if (target) void host.performDrop(live, target);
}

/**
 * Set this view's properties up: bind the suggested key for every optional property
 * the options do not name yet, then backfill the properties this view writes — type,
 * order, and an empty key for each optional property a note lacks — across the tree,
 * without overwriting anything that already has a value.
 *
 * The two halves are one action because neither is any use alone. A key nothing
 * names cannot be created on a note, and a property no note carries is one Obsidian's
 * own picker cannot offer — which is the loop this button exists to break: the
 * features that need a property to work were unreachable without hand-editing a note
 * first, and then binding it by hand as well.
 */
export async function runInit(host: BacklogViewHost): Promise<void> {
	// The config gate covers the frontmatter batch below, and it has to cover the
	// options this action writes too: binding properties into a view whose keys
	// already collide would change the configuration and then refuse every write.
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return;
	}
	// Binding first: an unnamed property has no key for the backfill to fill in, and
	// the plan below is made against what this adopts.
	const adopted = host.adoptDefaultProperties();
	const model = host.model;
	if (!model) return;
	const { writes, unplaceable } = computeInitWrites(model, host.settings);
	// applySafely reports its own notices when blocked or failing, and `written` is how far
	// the batch actually got: a note that no longer fits stops `applyWrites` where it
	// stands, so `writes.length` here would claim a backfill that half happened.
	const outcome = writes.length > 0 ? await host.applySafely(writes) : null;
	const done: string[] = [];
	// The property KEYS are joined by `list()` like the fragments below: they are data, so
	// the names pass through untranslated while the joining follows the catalog's grammar.
	if (adopted.length > 0)
		done.push(t('init.adopted', { properties: adopted.map((property) => property.suggested) }));
	if (outcome !== null && outcome.written > 0) done.push(t('init.updatedItems', { count: outcome.written }));
	// Half the loop this action exists to close is outside it: a bound property draws no
	// column until the base SHOWS it, and `BasesViewConfig` exposes no way to set the
	// order from here. Naming the menu is the whole fix.
	//
	// Two WHOLE sentences rather than one frame with that clause appended — the shape
	// `emptyState.noAxisBody` and its half-set sibling already use, and the reason is the
	// same: a locale that leads with the follow-up has no way into a middle assembled
	// here. The summary inside them is still fragments joined by `list()`, which is
	// grammar and follows the catalog's locale.
	const summary = list(done);
	if (done.length > 0)
		new Notice(adopted.length > 0 ? t('init.outcomeWithColumns', { summary }) : t('init.outcome', { summary }));
	// A blank rank no number fits is reported whatever else happened, and it is what
	// `init.nothingToDo` must not be said over: that sentence claims every property is
	// present, and this one is not.
	if (unplaceable > 0) new Notice(t('init.ranksSkipped', { count: unplaceable }));
	// Nothing bound and nothing to write is the one case with no outcome to report;
	// a failed batch has already reported itself.
	else if (done.length === 0 && writes.length === 0) new Notice(t('init.nothingToDo'));
}
