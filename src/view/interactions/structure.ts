import { Notice } from 'obsidian';
import { list, t } from '../../i18n/t';
import { keepsProjection } from '../../domain/itemTypes';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { DropTarget } from '../../domain/dropTargets';
import { configProblems } from '../../domain/settingsConsistency';
import { computeInitWrites, dropPlacement } from '../../domain/writePlan';

/**
 * Structural operations shared by the context menu and keyboard shortcuts.
 * All of them route through host.performDrop and reuse the drop-plan logic.
 */

/** The item's sibling list and index within it, or null when it cannot be moved. */
function siblingContext(host: BacklogViewHost, item: BacklogItem): { fullList: BacklogItem[]; idx: number } | null {
	const model = host.model;
	// Focus roots share no ranking THROUGH THIS PATH — Alt+arrow and the move/outdent
	// menu, which this function serves. The drag path is no longer the same claim:
	// `dropTargets.ts`'s `siblingPosition` ranks two focus rows against each other
	// (Task 5); a keyboard/menu equivalent is Task 6's, not built here. An ancestor
	// from outside the filter has siblings the query never returned, so ordering it
	// against the loaded ones would be a guess.
	if (!model || item.focusRoot || item.outsideFilter) return null;
	// The real root group, not the rendered forest — the same rule `siblingPosition`
	// keeps: an `order` is scoped to the notes sharing a parent, and a `Test suite` and an
	// `Epic` share the null one, so a move ranked against one projection's slice of it can
	// land on a number a hidden root already holds. A promoted root returned above.
	const fullList = item.parent ? item.parent.children : model.realRoots;
	const idx = fullList.indexOf(item);
	return idx === -1 ? null : { fullList, idx };
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
	return { parent: item.parent, peers, insertIndex };
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
	return { parent: item.parent, peers, insertIndex: edge === 'top' ? 0 : peers.length };
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
	const target = withinSiblingsTarget(host, item, delta);
	if (!target) return;
	void host.performDrop(item, target);
}

export function moveToEdge(host: BacklogViewHost, item: BacklogItem, edge: 'top' | 'bottom'): void {
	const target = edgeTarget(host, item, edge);
	if (target) void host.performDrop(item, target);
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
	const target = outdentTarget(host, item);
	if (target) void host.performDrop(item, target);
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
export function indentTarget(host: BacklogViewHost, item: BacklogItem): DropTarget | null {
	const newParent = visibleNeighbor(host, item, -1);
	if (!newParent) return null;
	const peers = newParent.children.filter((s) => s !== item);
	const target: DropTarget = { parent: newParent, peers, insertIndex: peers.length };
	return plans(host, item, target) ? target : null;
}

/** Nest the item under its previous visible sibling, at the end of its children. */
export function indent(host: BacklogViewHost, item: BacklogItem): void {
	const target = indentTarget(host, item);
	if (target) void host.performDrop(item, target);
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
	const writes = computeInitWrites(model, host.settings);
	// applySafely reports its own notices when blocked or failing — only claim
	// success for the writes when the whole batch actually went through.
	const applied = writes.length > 0 && (await host.applySafely(writes)) !== null;
	const done: string[] = [];
	// The property KEYS are joined by `list()` like the fragments below: they are data, so
	// the names pass through untranslated while the joining follows the catalog's grammar.
	if (adopted.length > 0)
		done.push(t('init.adopted', { properties: adopted.map((property) => property.suggested) }));
	if (applied) done.push(t('init.updatedItems', { count: writes.length }));
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
	// Nothing bound and nothing to write is the one case with no outcome to report;
	// a failed batch has already reported itself.
	else if (writes.length === 0) new Notice(t('init.nothingToDo'));
}
