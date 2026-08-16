import { Menu, MenuItem } from 'obsidian';
import { hasPriorityLevels, hasRiskLevels, menuValues, stateMenuValues } from '../../domain/settings';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { inferFolderParent } from '../../domain/folderNotes';
import { childTypeChoices, inCatalog, isDeliverableType, keepsProjection } from '../../domain/itemTypes';

import { BacklogItem, BacklogModel } from '../../domain/model';
import { sameValue, todayStamp } from '../../domain/noteFields';
import { hasHorizonAxis } from '../../domain/roadmap';
import {
	computeDeliverableStateWrites,
	computeStateWrites,
	computeTestStateWrites,
	ItemWrite,
} from '../../domain/writePlan';
import { addAssigneeItems, addPriorityItems, addRiskItems } from './labels';
import { BoardModel, deliverablesWorkflow, ownWorkflowReading, stateKeyFor } from '../../domain/board';
import { ShelfCard } from '../../domain/bars';
import { organizeShelf, ShelfSort } from '../../domain/shelf';
import { canReorder, indent, moveToEdge, moveWithinSiblings, outdent, outdentTarget, visibleNeighbor } from './structure';
import { promptCreateItem } from './create';
import { addHorizonItems, canSchedule, carriesDates, promptSchedule, unschedule } from './plan';
import { addTagItems, tagsColumnVisible } from './tags';
import { addDependencyItems, dependenciesAvailable } from './dependencies';
import { matchesFor, menuChildren, cardedPaths } from '../childrenList';
import { offerableTypes, retypeChoices, rowVocabulary, treeShaped } from '../projection';

/**
 * Whichever board-shaped projection is active, or null off both — `host.board` is the
 * one snapshot field, non-null on exactly `'board'` and `'deliverables'`, so this needs
 * no `host.projection` branch of its own.
 */
function activeBoard(host: BacklogViewHost): BoardModel | null {
	return host.board?.board ?? null;
}

/** Whether `item` already carries this type — the comparison `Set type` checks by. */
function isCurrentType(item: BacklogItem, type: string): boolean {
	return item.typeName !== null && item.typeName.toLowerCase() === type.toLowerCase();
}

/**
 * The row menu for a click on the row — a `contextmenu` from a pointer, or a plain click
 * on the one BUTTON that opens it this way (the match count chip; the state chip's own
 * menu is `showStateMenu`/`chipMenu`, a separate path this function never sees).
 *
 * Through `showMenuForClick` for that second kind, and it is the rule rather than this
 * caller's precaution: a button's Enter or Space synthesizes a click at (0, 0), which
 * `showAtMouseEvent` reads as a position and honours, dropping the menu in the viewport
 * corner. A real pointer never reports that, so the pointer path is unchanged. It shipped
 * that way on the match count chip, whose menu is the ONLY route to the matches it counts
 * (`renderMatchCount`, `render/board.ts`) — so the corner was the whole of that
 * affordance's keyboard path.
 */
export function showItemMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem, childTypes: string[]): void {
	evt.preventDefault();
	const menu = buildItemMenu(host, item, childTypes);
	if (menu) showMenuForClick(menu, evt);
}

/** Assemble the row menu; the caller decides where to show it. */
function buildItemMenu(host: BacklogViewHost, item: BacklogItem, childTypes: string[]): Menu | null {
	const model = host.model;
	if (!model) return null;
	const menu = new Menu();

	// Creating a child writes a new note, not this one — the one mutation that is
	// still fair game on an ancestor the Base excluded. Everything that would edit
	// the row's own frontmatter is withheld: it is context, not a result.
	const editable = !item.outsideFilter;
	// One entry per type rather than one entry that then asks: a menu is already a list
	// of choices, so naming them here is a click shorter than a picker in the modal.
	// Intersected with what this projection may offer, because `childTypeChoices` answers
	// a question about the LADDER and this one is about the board on screen — found by
	// review: an Epic/Feature/PBI card on the requirements board still offered
	// `New Deliverable`, the same broken creation path the toolbar's own filter closes.
	for (const type of offerableTypes(host, childTypes)) {
		menu.addItem((mi) =>
			mi
				.setTitle(`New ${type}`)
				.setIcon('plus')
				.onClick(() => promptCreateItem(host, [type], item)),
		);
	}
	if (editable) addEditableSections(host, model, menu, item);
	menu.addSeparator();

	// The move section is tree shape: every entry in it is defined by the row's
	// visible NEIGHBOURS, and a card has none — within-column order is derived, so
	// there is no rank to move within and no sibling to indent under.
	if (treeShaped(host.projection)) addMoveSection(host, menu, item);
	if (editable) addParentLinkSection(host, menu, item);
	addMatchSection(host, menu, item);
	addChildrenSection(host, menu, item);
	addShelfSection(host, menu);
	menu.addSeparator();
	menu.addItem((mi) =>
		mi
			.setTitle('Open in new tab')
			.setIcon('file-plus')
			.onClick(() => host.openItemIn(item, 'tab')),
	);
	menu.addItem((mi) =>
		mi
			.setTitle('Open to the right')
			.setIcon('separator-vertical')
			.onClick(() => host.openItemIn(item, 'split')),
	);

	host.app.workspace.trigger('file-menu', menu, item.file, PRODUCT_BACKLOG_VIEW_TYPE);
	return menu;
}

/**
 * Everything that edits the row's OWN frontmatter, gathered because they share one
 * precondition and because `buildItemMenu` is at its cognitive-complexity budget —
 * each entry here is a guard of its own, and seven of them in the caller was what
 * pushed it over.
 *
 * The precondition is the context-row rule: a row the Base excluded renders and
 * parents, and that is all. `New <child>` stays behind in the caller for exactly that
 * reason — it writes a DIFFERENT note, the one mutation still fair game on an ancestor
 * the filter cut.
 */
function addEditableSections(host: BacklogViewHost, model: BacklogModel, menu: Menu, item: BacklogItem): void {
	addSetTypeMenu(host, menu, item);
	// Which key gates visibility has to be the SAME key `stateChoices`/`chooseState`
	// will actually use for this ITEM — not an OR of both keys. An OR would show Set
	// state the moment only `deliverableStateKey` is configured, while the rest of
	// the menu still read the (unconfigured) requirements `stateKey`: a menu offering
	// picks that write to an empty key, silently dropped by `applyWrites`' "never
	// write to an empty key" rule. For a Deliverable this is the RESOLVED key —
	// falling back to the shared `stateKey` exactly as the write path and the model's
	// own read do — so the menu offers Set state whenever a move would actually write.
	// `stateKeyFor` is the same function the row's state chip gates on
	// (`render/columns.ts`), so a chip drawn where this menu offers nothing — or the
	// reverse — is not a mistake either side can make alone.
	if (stateKeyFor(host.settings, item)) addSetStateMenu(host, menu, item);
	// Both halves or nothing: a property with no levels has nothing to offer and
	// levels with no property have nowhere to go, so the entry is absent rather
	// than inert — the state chip's rule, and the horizon's above.
	if (hasRiskLevels(host.settings)) addSetRiskMenu(host, menu, item);
	// The same pair, for the same reason — a ladder with no property has nowhere to go.
	if (hasPriorityLevels(host.settings)) addSetPriorityMenu(host, menu, item);
	// The KEY alone, unlike risk above: **New assignee...** is always in that submenu, so
	// a named property with nobody observed still opens onto something to pick. There is
	// no second half to be missing, which is why there is no `hasAssignees` beside
	// `hasRiskLevels` — a predicate that could only ever answer the same thing as this.
	if (host.settings.assigneeKey) addSetAssigneeMenu(host, menu, item);
	// Per axis, and absent rather than inert when one is not configured — the state
	// chip's own rule.
	if (hasHorizonAxis(host.settings)) addSetHorizonMenu(host, menu, item);
	// `canSchedule` rather than `hasDateAxis`: the two agree for work and diverge for
	// a milestone on a start-only vault, where the narrowed entry would open asking
	// for nothing at all.
	if (canSchedule(host.settings, item)) addScheduleItems(host, menu, item);
	if (tagsColumnVisible(host)) addEditTagsMenu(host, menu, item);
	// A prerequisite is a property of the note rather than of a projection, so the
	// entries are offered wherever an item renders — not only where one is drawn. The
	// gate no longer asks whether the key is BOUND, only whether one could be: the write
	// binds it ([[Bind a property by using it]]), so the entry is what names the property
	// rather than something the naming has to precede.
	if (dependenciesAvailable(host)) addDependencyItems(host, model, menu, item);
}

function addParentLinkSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	// Both entries reparent without producing a `DropTarget`: deleting the key hands the
	// note to folder inference, so in folder mode the landing place is a real parent and
	// the rule every drop and outdent keeps applies here too — a move may not change which
	// projection draws the row. The landing place is what the gate is asked about; the write
	// itself names no parent, since deleting the key is the whole of what either entry does.
	// Outside folder mode there is nothing to withhold: the note becomes a root, which is the
	// ladder an unresolved orphan is already answering.
	//
	// The cost is deliberate: a stale link on a note inside a `Test suite`'s folder now has
	// no menu entry to clear it, and repairing it means editing the note. The alternative
	// is the row leaving the screen it was cleared on, which is what extension 1c of
	// `Test suite and test case as a ladder of their own` refuses.
	const model = host.model;
	const landing = host.settings.folderHierarchy && model ? inferFolderParent(item, model.byPath) : null;
	if (!keepsProjection(item, landing)) return;
	if (!item.parent && item.hasParentValue) {
		// Top-level item whose parent property points outside the view (or was
		// part of a cycle): remove the stale link. In folder mode the item then
		// returns to its folder position instead of being pinned to the top.
		menu.addItem((mi) =>
			mi
				.setTitle('Clear parent link')
				.setIcon('unlink')
				.onClick(() => void host.applySafely([{ file: item.file, removeParentKey: true }])),
		);
	} else if (host.settings.folderHierarchy && (item.hasParentValue || item.explicitRoot)) {
		// A link override or a top-level pin is hiding the folder position;
		// removing the property hands the item back to folder-note inference.
		menu.addItem((mi) =>
			mi
				.setTitle('Use folder position')
				.setIcon('folder')
				.onClick(() => void host.applySafely([{ file: item.file, removeParentKey: true }])),
		);
	}
}

function addMoveSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	// Gate on rendered neighbors: with completed items hidden, a swap with a
	// hidden sibling would change nothing visibly. Null for a row that cannot move
	// at all — a focus root, or an ancestor loaded from outside the filter.
	const prev = visibleNeighbor(host, item, -1);
	const next = visibleNeighbor(host, item, 1);
	// Only *reordering* renumbers the item's own group, so only reordering needs
	// this. Indent and outdent land the item elsewhere and answer for their own
	// destination — hiding them here would make the menu offer less than Alt+arrow.
	const ranked = canReorder(host, item);

	if (ranked && prev) {
		menu.addItem((mi) =>
			mi.setTitle('Move up').setIcon('arrow-up').onClick(() => moveWithinSiblings(host, item, -1)),
		);
	}
	if (prev) {
		menu.addItem((mi) =>
			mi
				.setTitle(`Indent under "${prev.title}"`)
				.setIcon('indent-increase')
				.onClick(() => indent(host, item)),
		);
	}
	if (ranked && next) {
		menu.addItem((mi) =>
			mi.setTitle('Move down').setIcon('arrow-down').onClick(() => moveWithinSiblings(host, item, 1)),
		);
	}
	if (ranked && prev) {
		menu.addItem((mi) =>
			mi.setTitle('Move to top').setIcon('arrow-up-to-line').onClick(() => moveToEdge(host, item, 'top')),
		);
	}
	if (ranked && next) {
		menu.addItem((mi) =>
			mi
				.setTitle('Move to bottom')
				.setIcon('arrow-down-to-line')
				.onClick(() => moveToEdge(host, item, 'bottom')),
		);
	}
	if (outdentTarget(host, item)) {
		menu.addItem((mi) => mi.setTitle('Outdent').setIcon('indent-decrease').onClick(() => outdent(host, item)));
	}
}

/**
 * Show a menu for a click that may not have come from a pointer. Enter or Space on
 * a focused button synthesizes a click at (0, 0), and anchoring a menu there drops
 * it in the viewport corner instead of beside the control the user is standing on.
 * Every menu opened from a button goes through here.
 *
 * The BUTTON the user activated, not `evt.currentTarget`: the per-item chips are
 * delegated at the pane now (`wireChipEvents` in `render/rows.ts`), so `currentTarget`
 * is `treeEl` rather than the chip, and anchoring to it would drop the menu under the
 * whole tree instead of beside the control. A direct listener's `currentTarget` and
 * `target` resolve to the same button, so this needs no second code path for one.
 */
export function showMenuForClick(menu: Menu, evt: MouseEvent): void {
	const el = (evt.target instanceof Element ? evt.target.closest('button') : null) ?? evt.currentTarget;
	if (evt.clientX === 0 && evt.clientY === 0 && el instanceof HTMLElement) {
		const rect = el.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
		return;
	}
	menu.showAtMouseEvent(evt);
}

/**
 * Show a menu under an ELEMENT — the keyboard path for a row or a board column stop,
 * neither of which has a pointer to sit under. Falls back to the viewport corner when
 * there is no element to anchor to, and reports false when there was no menu to open at
 * all, so a caller that swallowed the key can give it back.
 *
 * Here rather than on the view, beside `showMenuForClick`: this module is where the
 * anchoring decision is made — the reason `showAtMouseEvent` is banned everywhere else by
 * lint — and a second `showAtPosition` sitting in `backlogView.ts` was the same decision
 * taken in a second place.
 *
 * The corner fallback is a ROW's, not deliberately a column's too: `colEls` and
 * `board.columns` are built by the same `.map()` over the same array (`renderBoard`), so
 * an index that resolves a column always resolves an element, and that branch stays
 * unreachable from `showColumnMenu` (`interactions/columnMenu.ts`).
 */
export function showMenuAtElement(menu: Menu | null, el: HTMLElement | null): boolean {
	if (!menu) return false;
	const rect = el?.getBoundingClientRect();
	menu.showAtPosition(rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 });
	return true;
}

/**
 * The row context menu, opened at the item's own row — the keyboard path (Menu key /
 * Shift+F10) and the whole of `BacklogViewHost.showContextMenuFor`, kept here as one
 * delegation on the view so `BacklogViewHost` still resolves to that one class.
 */
export function showContextMenu(host: BacklogViewHost, item: BacklogItem, rowEl: HTMLElement | null): void {
	showMenuAtElement(buildItemMenu(host, item, childTypeChoices(item)), rowEl);
}

/**
 * A per-row control's own menu. Each of the four below opens exactly what the row menu's
 * matching section offers — one builder per property, never a second list — so a chip and
 * the context menu cannot disagree about what is offered or which entry is current.
 *
 * The click belongs to the control, not to the row it sits on — but the guard for that is
 * `fromRowControl` in `render/rows.ts`, asked by `wireRowEvents` before `wireChipEvents`
 * ever runs, not `stopPropagation` here: both are delegated listeners on `treeEl` now, so
 * this one firing does not stop a sibling listener on the same element that already ran.
 * `stopPropagation` still matters for what sits ABOVE `treeEl` — nothing there should see
 * a chip's click either — but it is not what keeps the row from also activating.
 */
function chipMenu(
	host: BacklogViewHost,
	evt: MouseEvent,
	item: BacklogItem,
	add: (host: BacklogViewHost, menu: Menu, item: BacklogItem) => void,
): void {
	evt.preventDefault();
	evt.stopPropagation();
	const menu = new Menu();
	add(host, menu, item);
	showMenuForClick(menu, evt);
}

/** State menu for the row's state chip. */
export const showStateMenu = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void =>
	chipMenu(host, evt, item, addStateItems);

/** Horizon menu for the row's horizon chip — the same list the row menu's Set horizon offers. */
export const showHorizonMenu = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void =>
	chipMenu(host, evt, item, addHorizonItems);

/** Risk menu for the row's risk chip — the same list the row menu's Set risk offers. */
export const showRiskMenu = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void =>
	chipMenu(host, evt, item, addRiskItems);

/** Priority menu for the row's priority chip — the same list Set priority offers. */
export const showPriorityMenu = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void =>
	chipMenu(host, evt, item, addPriorityItems);

/** Assignee menu for the row's assignee chip — the same list Set assignee offers. */
export const showAssigneeMenu = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void =>
	chipMenu(host, evt, item, addAssigneeItems);

/** Tag picker for the row's add-tag button. */
export const showTagMenu = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void =>
	chipMenu(host, evt, item, addTagItems);

/**
 * The matches hiding under this card, as menu entries.
 *
 * The board is one tab stop by design, so the match links on a card face carry
 * `tabindex="-1"` — and the menu is their keyboard path, exactly as it is for the
 * tree's add button and state chip. Without it those links would be pointer-only, and
 * a match that only a mouse can reach is the very failure the card face exists to
 * prevent: found, counted in the rollup, and impossible to get to. Offered whether or
 * not the card itself matched, for the same reason the face names them: a match below
 * a matching card is a second result, and it has no card of its own to be reached by.
 *
 * `matchesFor` — the same walk the faces use, asked of whichever projection drew this
 * item and subtracting what THIS menu will itself list. That subtraction is
 * `menuChildren`, not `listedChildren`: the two came apart when the per-child entries
 * were narrowed to the unreachable ones, so a child the menu is not naming can still be
 * named as a match here, and one it is naming is named once. Both directions have been
 * broken here within two days — a walk without the subtraction offered a note twice, and
 * a subtraction of the wider set would drop a match silently. What each surface DRAWS
 * differs; what counts as saying a thing twice does not.
 */
function addMatchSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (!host.isFiltering()) return;
	const matches = matchesFor(host, item);
	if (matches.length === 0) return;
	menu.addSeparator();
	for (const match of matches) {
		menu.addItem((mi) =>
			mi
				.setTitle(`Open match "${match.title}"`)
				.setIcon('search')
				.onClick((evt) => host.openItem(match, evt)),
		);
	}
}

/**
 * Folding the children this card is showing, offered where a pointer is not available.
 * Each card projection is one tab stop, so the disclosure is a `tabindex="-1"` button and
 * this is its keyboard path — the same answer the tree gives for the add button and the
 * state chip.
 *
 * The toggle, and then `Open child "…"` for the children with **no card of their own**.
 * That per-child list used to be unconditional, was removed on request (2026-08-14)
 * because a menu growing a row per child pushed everything else in it off the bottom on
 * exactly the items with the most of everything, and came back the next day narrowed:
 * "nothing is lost from the keyboard by that" was a claim, and it was wrong under a
 * FOCUS. Unfocused, every result has a card of its own on both card projections and this
 * list is empty — which is the state the clutter was reported in. Focused, the cards are
 * the focus level's alone, and a child appears only as a `tabindex="-1"` entry on its
 * parent's face, so these entries are the whole keyboard path to it. `menuChildren` is
 * that narrowing plus this section's own gate, stated once in `childrenList.ts` so
 * `matchesFor` can subtract exactly what this loop adds; `cardedPaths` is what each
 * projection answers it with. (Codex, PR #137, pointing at the roadmap half of it.)
 *
 * The gate is `cardChildrenShown`, filled by the render, and not the projection: a card
 * whose children have all hidden draws no disclosure and a dated-axis timeline row draws
 * one over its own kind of list (the rows below it, rather than a list on its face), and
 * the axis cannot separate those either, since it also draws a shelf of real cards.
 * Reading what the render drew also survives the entry point: the menu key arrives
 * through `showContextMenuFor`, which calls `buildItemMenu` directly and never touches
 * the render's wiring, so a flag threaded through that wiring would miss exactly the case
 * this section exists for.
 *
 * `cardChildrenShown` names the path, never which KIND of disclosure drew it — a card's
 * own scope and a dated-axis bar's are separate bits now (`CARD_SCOPE` vs `TIMELINE_SCOPE`
 * / the tree's), so this asks `host.roadmap`'s own bars, the one register that is never a
 * card, and reads/writes through whichever host pair the on-screen control actually uses.
 * A second opinion here would be exactly what let a card's toggle and this entry disagree.
 *
 * The toggle leads, because on the timeline it is the whole feature: that chevron hides
 * ROWS, and the entries below open notes rather than standing in for it. It is withheld
 * while the quick filter runs, exactly as the disclosure itself goes `disabled` there and
 * for the same reason — both `isCollapsed` and `isCardCollapsed` report false while it
 * runs, so the write would look inert and then take effect once the filter cleared.
 */
function addChildrenSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (!host.cardChildrenShown.has(item.file.path)) return;
	const isBar = (host.roadmap?.roadmap.bars ?? []).some((bar) => bar.item.file.path === item.file.path);
	menu.addSeparator();
	const collapsed = isBar ? host.isCollapsed(item.file.path) : host.isCardCollapsed(item.file.path);
	if (!host.isFiltering()) {
		menu.addItem((mi) =>
			mi
				.setTitle(collapsed ? 'Show children' : 'Hide children')
				.setIcon(collapsed ? 'chevron-right' : 'chevron-down')
				.onClick(() => {
					if (isBar) host.setCollapsed(item.file.path, !collapsed);
					else host.setCardCollapsed(item.file.path, !collapsed);
					host.render();
				}),
		);
	}
	for (const child of menuChildren(host, item, cardedPaths(host))) {
		menu.addItem((mi) =>
			mi
				.setTitle(`Open child "${child.title}"`)
				.setIcon('corner-down-right')
				.onClick((evt) => host.openItem(child, evt)),
		);
	}
}

/**
 * One offer in Set state: the state it writes (null removes the key) and the name it
 * wears. The two differ on the board, where the entry is named for the COLUMN rather
 * than for its own value, so "No state" reads as a place instead of as a silence.
 */
interface StateChoice {
	state: string | null;
	label: string;
}

/**
 * What Set state offers. In the tree: the configured or observed values, plus the
 * item's own when it is in neither, so the current state can always render checked.
 *
 * On either board-shaped projection: `activeBoard`'s own COLUMNS, read off the board
 * rather than rebuilt — the configured states, the observed out-of-workflow values,
 * and the no-state entry whose write removes the key. That is what makes the menu
 * the drag's equal: every target a drop can reach the menu offers, and no target the
 * menu offers is missing from the board. `stateMenuValues` alone cannot supply that
 * list — it returns only the configured states when a list is set, and knows no
 * no-state — and a second list built from the same inputs would be a second
 * vocabulary to keep in step. The labels come from the columns too, so the entry a
 * user picks is named exactly as the column they can see.
 *
 * Off a board, WHICH list is the item's TYPE's question — never the projection's, or the
 * tree would offer a Deliverable the requirements workflow's values and write them to
 * the requirements key. A Deliverable takes `deliverablesWorkflow`'s own `values`, the
 * same resolution its board draws columns from rather than a third opinion assembled
 * here, so the tree offers it the states it will actually be written into. A catalog row
 * (asked of the LADDER, `inCatalog`, never a type name) takes its own workflow's the same
 * way, through `deliverableOrTestValues`.
 */

/**
 * A secondary workflow's own offered values, or null when this row is on neither. Both are
 * `menuValues` over that workflow's declared list, its done values and its own observed
 * vocabulary — the requirements list would be a third opinion about a property it is not
 * even read through.
 */
function deliverableOrTestValues(host: BacklogViewHost, item: BacklogItem, model: BacklogModel | null): string[] | null {
	if (!model) return null;
	if (isDeliverableType(item.typeName)) return deliverablesWorkflow(model, host.settings).values;
	if (!inCatalog(item)) return null;
	return menuValues(host.settings.testStates, host.settings.testDoneValues, rowVocabulary(model, item).observedStates);
}

function stateChoices(host: BacklogViewHost, item: BacklogItem): StateChoice[] {
	const board = activeBoard(host);
	if (board) return board.columns.map((col) => ({ state: col.state, label: col.label }));
	const model = host.model;
	const values =
		deliverableOrTestValues(host, item, model) ??
		stateMenuValues(host.settings, model ? rowVocabulary(model, item).observedStates : []);
	const current = ownWorkflowReading(item).value;
	const listed = current !== null && values.some((v) => sameValue(v, current));
	const all = listed || current === null ? values : [...values, current];
	return all.map((state) => ({ state, label: state }));
}

/**
 * The write a Set state entry means. On either board-shaped projection the menu is
 * the drag's equal, so it takes that projection's own move method — the same planned
 * write, the same gate, the same announcement — which is also the only path that can
 * express the no-state entry, never offered by the tree's list.
 * The item's TYPE picks the move method FIRST, before either projection test: a
 * Deliverable's pick must land on `performDeliverablesBoardMove` wherever it was made,
 * and a no-state pick must not fall through to the requirements move just because both
 * workflows share `choice.state === null`.
 */
function chooseState(host: BacklogViewHost, item: BacklogItem, choice: StateChoice): Promise<unknown> {
	if (isDeliverableType(item.typeName)) return host.performDeliverablesBoardMove(item, choice.state);
	// A catalog row has no board to move on, so its pick plans through the test
	// workflow's own function rather than either board move method.
	if (inCatalog(item)) return host.applySafely(computeTestStateWrites(item, choice.state));
	if (host.projection === 'board' || choice.state === null) return host.performBoardMove(item, choice.state);
	// The tree's own Set state plans through the same function the board's moves do, so
	// the date stamps ride it too: a history with holes in it, where which hole depends
	// on whether the user was looking at the tree or the board, is worse than none.
	return host.applySafely(computeStateWrites(item, choice.state, host.settings, todayStamp()));
}

/**
 * What a pick on THIS row would write — the same two predicates `stateKeyFor` and
 * `ownWorkflowReading` select a key and a reading with, asked a third time about the
 * PLANNER, which is the selection those two do not make. `chooseState` keeps its own
 * branching because it picks a move METHOD rather than a planner: two of its three
 * answers are host methods that announce, and only the last is a plan handed to the gate.
 */
function stateWrites(host: BacklogViewHost, item: BacklogItem, state: string | null): ItemWrite[] {
	if (isDeliverableType(item.typeName)) return computeDeliverableStateWrites(item, state);
	return inCatalog(item) ? computeTestStateWrites(item, state) : computeStateWrites(item, state, host.settings, todayStamp());
}

/**
 * Render Set state's offers, checking the one the item already holds.
 *
 * "Already holds" is asked of the PLAN — an entry is checked exactly when picking
 * it would write nothing — rather than by a comparison written beside the plan and
 * expected to agree with it. Those two drift the moment either side learns a case
 * the other has not: an entry checked as current whose pick still writes spends the
 * undo slot on a change nobody asked for. One question, asked once, of whichever
 * workflow's planner this projection actually writes through — a value comparison
 * here would have to separately learn that a horizon (or a second workflow) the
 * reader refuses reads as no value, which is exactly the drift the rule exists to
 * rule out. `addHorizonItems` in `plan.ts` follows the same rule against its own
 * planner.
 */
function addStateItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	for (const choice of stateChoices(host, item)) {
		menu.addItem((si) => {
			si.setTitle(choice.label).onClick(() => void chooseState(host, item, choice));
			if (stateWrites(host, item, choice.state).length === 0) si.setChecked(true);
		});
	}
	// The way back OFF a test state, as the foot this menu already uses for a removal —
	// Clear horizon, Unschedule, and the two label menus in `labels.ts`. Only the catalog
	// needs one: every other workflow reaches its no-state target through a board COLUMN
	// (`stateChoices` reads `activeBoard`'s own columns, and `col.state === null` is the
	// only thing in that list that removes a key), and the catalog is tree-shaped with no
	// board — so without this entry `computeTestStateWrites(item, null)` was reachable from
	// nothing on screen and a test state could be set and never removed. It is drawn on both
	// surfaces at once because this is the one builder behind the chip and `Set state`.
	//
	// Offered exactly when picking it would WRITE something, asked of the same planner the
	// pick runs — so no offered action can write nothing, and the gate cannot drift from the
	// plan. The neighbours state that rule as `item.ownKeys` presence instead, and that
	// spelling is unavailable here: `readOwnKeys` fills that record through `optionalKeyFor`,
	// which answers the RAW `testStateKey`, while this workflow reads the resolved one
	// (`resolvedTestStateKey`, through `stateKeyFor`) — so on the shipped default, where the
	// tests share the plan's own `status`, `ownKeys.testState` is false on every note that
	// carries a state.
	//
	// What asking the plan costs is everything presence and value disagree about: a key
	// holding any value `readString` refuses — blank, whitespace, YAML null, an empty list,
	// a mapping — reads as no value here and is offered no clear, and only editing the note
	// takes it off. The plugin MANUFACTURES that state rather than waiting for one: `✨
	// Assign missing properties` stubs a missing key as `''` (`applyInto` in
	// `storage/frontmatter.ts`, over `missingKeyStubs`), which on a distinct
	// `testStateProperty` is every catalog member. It is a residue rather than a reason to
	// switch gates — the presence gate is absent on the shipped default, where nothing is
	// stubbed because the key falls back — but it is not an edge case somebody has to build.
	const clear: StateChoice = { state: null, label: 'Clear test state' };
	if (!inCatalog(item) || computeTestStateWrites(item, clear.state).length === 0) return;
	menu.addSeparator();
	menu.addItem((si) => si.setTitle(clear.label).setIcon('eraser').onClick(() => void chooseState(host, item, clear)));
}

/**
 * `setSubmenu` is missing from the published obsidian typings, not from the app:
 * submenus predate the 1.12.0 this plugin requires, so the cast asserts what is
 * always there rather than guarding against its absence.
 */
const SHELF_SORTS: { value: ShelfSort; label: string }[] = [
	{ value: 'tree', label: 'Sibling order' },
	{ value: 'title', label: 'Title (A to Z)' },
	{ value: 'modified', label: 'Last modified' },
];

/**
 * The shelf's display picks as menu items. ONE builder serves both surfaces — the
 * shelf header's own pickers and the keyboard path below — for the reason the horizon
 * chip and its menu share one: two builders offering the same choices are one edit from
 * disagreeing about what is offered or which entry is checked.
 *
 * `after` is where the two surfaces legitimately differ, and the only place they may.
 * A pick rebuilds the pane and destroys the button its menu was opened from; a menu
 * opened from the shelf's HEADER has to give focus back to that header's replacement,
 * while one opened from a CARD leaves focus where the card left it. Passing the
 * difference in keeps a single builder rather than forking it over one line.
 */
export function addShelfSortItems(host: BacklogViewHost, menu: Menu, after?: () => void): void {
	for (const { value, label } of SHELF_SORTS) {
		menu.addItem((mi) =>
			mi
				.setTitle(label)
				.setChecked(host.shelfSort === value)
				.onClick(() => {
					host.setShelfSort(value);
					after?.();
				}),
		);
	}
}

/**
 * One entry per type ON the shelf, from the UNFILTERED grouping: hiding a type must
 * never remove its own way back, so the list a hidden type is restored from cannot be
 * narrowed by the hiding.
 */
export function addShelfTypeItems(host: BacklogViewHost, menu: Menu, shelf: ShelfCard[], after?: () => void): void {
	for (const group of organizeShelf(shelf, 'tree', new Set())) {
		menu.addItem((mi) =>
			mi
				.setTitle(`${group.type} (${group.cards.length})`)
				.setChecked(!host.shelfHiddenTypes.has(group.type))
				.onClick(() => {
					const hidden = new Set(host.shelfHiddenTypes);
					if (hidden.has(group.type)) hidden.delete(group.type);
					else hidden.add(group.type);
					host.setShelfHiddenTypes(hidden);
					after?.();
				}),
		);
	}
}

/**
 * The shelf's controls, reachable without a pointer. Its header buttons are
 * `tabindex="-1"` like every control in the one-tab-stop pane, so this menu is their
 * keyboard path — the same answer the board's hidden-match links give, and for the same
 * reason stated there: without it the shelf's sort and filter would be pointer-only and
 * the feature would fail at its own purpose. `syncShelfTabStops` covers the one case this
 * cannot, where no card renders and there is no menu to open.
 *
 * The collapse toggle is NOT here. It was, until it was removed on request to shorten
 * this menu (2026-08-15): the shelf's own header carries the disclosure, which is where a
 * reader working through unplaced work is already looking, and the menu is a longer list
 * for every card on screen. The keyboard path moved with it rather than going — the
 * disclosure is a real tab stop now, in every state, which is what makes removing this
 * entry a decluttering rather than a pointer-only shelf. See
 * [[Drop the shelf's toggle from the card menu]].
 *
 * On the roadmap only, and only while the shelf holds something — an entry for a region
 * that is not on screen is the defect in the other direction.
 */
function addShelfSection(host: BacklogViewHost, menu: Menu): void {
	if (host.projection !== 'roadmap') return;
	const shelf = host.roadmap?.roadmap.shelf ?? [];
	if (shelf.length === 0) return;
	// Nothing to order or narrow while the cards are shut away — the header withholds the
	// same two pickers for the same reason.
	if (host.shelfCollapsed) return;
	menu.addSeparator();
	menu.addItem((mi) => {
		mi.setTitle('Sort unplaced').setIcon('arrow-up-down');
		addShelfSortItems(host, submenuOf(mi));
	});
	menu.addItem((mi) => {
		mi.setTitle('Filter unplaced by type').setIcon('list-filter');
		addShelfTypeItems(host, submenuOf(mi), shelf);
	});
}

function submenuOf(item: MenuItem): Menu {
	return (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();
}

function addSetStateMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set state').setIcon('circle-check');
		addStateItems(host, submenuOf(mi), item);
	});
}

function addSetRiskMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set risk').setIcon('shield-alert');
		addRiskItems(host, submenuOf(mi), item);
	});
}

function addSetPriorityMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set priority').setIcon('flag');
		addPriorityItems(host, submenuOf(mi), item);
	});
}

function addSetAssigneeMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set assignee').setIcon('user');
		addAssigneeItems(host, submenuOf(mi), item);
	});
}

/**
 * The roadmap's placement properties, from the row: the horizons as a submenu (its
 * foot clears the key), the dates as an entry that opens the schedule prompt. The
 * writes themselves live in `interactions/plan.ts` — this file decides what a row is
 * offered, not what a placement means.
 */
function addSetHorizonMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set horizon').setIcon('signpost');
		addHorizonItems(host, submenuOf(mi), item);
	});
}

function addScheduleItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) =>
		mi
			.setTitle('Schedule')
			.setIcon('calendar-range')
			.onClick(() => promptSchedule(host, item)),
	);
	// Like Clear horizon: offered only while there is something to remove.
	if (!carriesDates(item)) return;
	menu.addItem((mi) =>
		mi
			.setTitle('Unschedule')
			.setIcon('calendar-off')
			.onClick(() => void unschedule(host, item)),
	);
}

/** Tag editing on the keyboard path — the same list the row's + button offers. */
function addEditTagsMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Edit tags').setIcon('tags');
		addTagItems(host, submenuOf(mi), item);
	});
}

function addSetTypeMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	// PER ROW, not per projection: `Set type` is the one caller whose answer depends on
	// where the row would END UP, which is a question about its parent as well as its new
	// type. See `offerableTypes` for the two rows a projection-wide list gets wrong in
	// opposite directions.
	const choices = retypeChoices(host, item);
	// Absent rather than inert, the same rule the entries themselves follow: on the
	// Deliverables board the only offerable type is the one every card already carries,
	// so the submenu would hold a single entry, already checked, whose pick writes
	// nothing. A menu whose every option is a no-op is not a menu.
	if (!choices.some((type) => !isCurrentType(item, type))) return;
	const apply = (level: string) => {
		void host.applySafely([{ file: item.file, typeName: level }]);
	};
	menu.addItem((mi) => {
		mi.setTitle('Set type').setIcon('tag');
		const submenu = submenuOf(mi);
		for (const level of choices) {
			submenu.addItem((si) => {
				si.setTitle(level).onClick(() => apply(level));
				if (isCurrentType(item, level)) si.setChecked(true);
			});
		}
	});
}
