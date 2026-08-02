import { Menu, MenuItem } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { inferFolderParent } from '../../domain/folderNotes';
import { BacklogItem } from '../../domain/model';
import { sameValue } from '../../domain/noteFields';
import { RoadmapModel, SHELF_LABEL } from '../../domain/roadmap';
import {
	computeHorizonDropWrites,
	computeStateDropWrites,
	computeTypeChanges,
	ItemWrite,
} from '../../domain/writePlan';
import { stateMenuValues } from '../../domain/settings';
import { canReorder, indent, moveToEdge, moveWithinSiblings, outdent, outdentTarget, visibleNeighbor } from './structure';
import { promptCreateItem } from './create';
import { ALL_TYPES } from '../../domain/settings';
import { addTagItems, tagsColumnVisible } from './tags';

/** Context menu for a backlog row (mouse path). */
export function showItemMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem, childTypes: string[]): void {
	evt.preventDefault();
	const menu = buildItemMenu(host, item, childTypes);
	menu?.showAtMouseEvent(evt);
}

/** Assemble the row menu; the caller decides where to show it. */
export function buildItemMenu(host: BacklogViewHost, item: BacklogItem, childTypes: string[]): Menu | null {
	const model = host.model;
	if (!model) return null;
	const menu = new Menu();

	// Creating a child writes a new note, not this one — the one mutation that is
	// still fair game on an ancestor the Base excluded. Everything that would edit
	// the row's own frontmatter is withheld: it is context, not a result.
	const editable = !item.outsideFilter;
	// One entry per type rather than one entry that then asks: a menu is already a list
	// of choices, so naming them here is a click shorter than a picker in the modal.
	for (const type of childTypes) {
		menu.addItem((mi) =>
			mi
				.setTitle(`New ${type}`)
				.setIcon('plus')
				.onClick(() => promptCreateItem(host, [type], item)),
		);
	}
	if (editable) {
		addSetTypeMenu(host, menu, item);
		if (host.settings.stateKey) addSetStateMenu(host, menu, item);
		// The roadmap's Set horizon is the drag's equal on the axis being drawn, so it
		// is offered exactly where buckets are: the non-pointer path to the same write.
		const buckets = renderedBuckets(host);
		if (buckets) addSetHorizonMenu(host, menu, item, buckets);
		if (tagsColumnVisible(host)) addEditTagsMenu(host, menu, item);
	}
	menu.addSeparator();

	// The move section is tree shape: every entry in it is defined by the row's
	// visible NEIGHBOURS, and a card has none — within-column order is derived, so
	// there is no rank to move within and no sibling to indent under.
	if (host.projection === 'tree') addMoveSection(host, menu, item);
	if (editable) addParentLinkSection(host, menu, item);
	menu.addSeparator();
	menu.addItem((mi) =>
		mi
			.setTitle('Open in new tab')
			.setIcon('file-plus')
			.onClick(() => host.openItemInNewTab(item)),
	);
	menu.addItem((mi) =>
		mi
			.setTitle('Open to the right')
			.setIcon('separator-vertical')
			.onClick(() => host.openItemToSide(item)),
	);

	host.app.workspace.trigger('file-menu', menu, item.file, PRODUCT_BACKLOG_VIEW_TYPE);
	return menu;
}

function addParentLinkSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (!item.parent && item.hasParentValue) {
		// Top-level item whose parent property points outside the view (or was
		// part of a cycle): remove the stale link. In folder mode the item then
		// returns to its folder position instead of being pinned to the top.
		menu.addItem((mi) =>
			mi
				.setTitle('Clear parent link')
				.setIcon('unlink')
				.onClick(() => void host.applySafely(removeParentWrites(host, item))),
		);
	} else if (host.settings.folderHierarchy && (item.hasParentValue || item.explicitRoot)) {
		// A link override or a top-level pin is hiding the folder position;
		// removing the property hands the item back to folder-note inference.
		menu.addItem((mi) =>
			mi
				.setTitle('Use folder position')
				.setIcon('folder')
				.onClick(() => void host.applySafely(removeParentWrites(host, item))),
		);
	}
}

/**
 * Removing the parent property re-homes the item (folder position or top
 * level); with autoType on it must retype like any other reparenting move.
 */
function removeParentWrites(host: BacklogViewHost, item: BacklogItem): ItemWrite[] {
	const writes: ItemWrite[] = [{ file: item.file, removeParentKey: true }];
	const model = host.model;
	if (!host.settings.autoType || !model) return writes;

	const landingParent = host.settings.folderHierarchy ? inferFolderParent(item, model.byPath) : null;
	const { typeField, cascade } = computeTypeChanges(item, landingParent, host.settings, true);
	if (typeField !== undefined) writes[0].typeName = typeField;
	writes.push(...cascade);
	return writes;
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
 */
export function showMenuForClick(menu: Menu, evt: MouseEvent): void {
	const el = evt.currentTarget;
	if (evt.clientX === 0 && evt.clientY === 0 && el instanceof HTMLElement) {
		const rect = el.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
		return;
	}
	menu.showAtMouseEvent(evt);
}

/** State menu for the row's state chip. */
export function showStateMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void {
	evt.preventDefault();
	evt.stopPropagation();
	const menu = new Menu();
	addStateItems(host, menu, item);
	showMenuForClick(menu, evt);
}

/** Tag picker for the row's add-tag button. */
export function showTagMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void {
	// Like the state chip: the click belongs to the control, not to the row it sits on.
	evt.preventDefault();
	evt.stopPropagation();
	const menu = new Menu();
	addTagItems(host, menu, item);
	showMenuForClick(menu, evt);
}

/**
 * One offer in a Set menu: the value it writes (null removes the key) and the name
 * it wears. Shared by Set state and Set horizon, because they are the same offer
 * over different properties — one shape means the checkmark, the removal entry and
 * the "names what is on screen" rule are each decided once.
 */
interface ValueChoice {
	value: string | null;
	label: string;
}

/**
 * What Set state offers. In the tree: the configured or observed values, plus the
 * item's own when it is in neither, so the current state can always render checked.
 *
 * On the board: the board's own COLUMNS, read off the board rather than rebuilt —
 * the configured states, the observed out-of-workflow values, and the no-state
 * entry whose write removes the key. That is what makes the menu the drag's equal:
 * every target a drop can reach the menu offers, and no target the menu offers is
 * missing from the board. `stateMenuValues` alone cannot supply that list — it
 * returns only the configured states when a list is set, and knows no no-state —
 * and a second list built from the same inputs would be a second vocabulary to
 * keep in step. The labels come from the columns too, so the entry a user picks is
 * named exactly as the column they can see.
 */
function stateChoices(host: BacklogViewHost, item: BacklogItem): ValueChoice[] {
	const board = host.projection === 'board' ? host.board?.board : null;
	if (board) return board.columns.map((col) => ({ value: col.state, label: col.label }));
	const values = stateMenuValues(host.settings, host.model?.observedStates ?? []);
	const current = item.stateValue;
	const listed = current !== null && values.some((v) => sameValue(v, current));
	const all = listed || current === null ? values : [...values, current];
	return all.map((state) => ({ value: state, label: state }));
}

/**
 * What Set horizon offers: the roadmap's own BUCKETS, read off the render for the
 * reason the board's Set state reads its columns — every target a drop can reach,
 * the menu offers, by construction rather than by two lists agreeing — plus the
 * shelf, whose write removes the key. Declared and minted buckets alike, since
 * observed vocabulary is writable vocabulary; a context row contributes to neither,
 * because it never minted a bucket in the first place.
 */
function horizonChoices(roadmap: RoadmapModel): ValueChoice[] {
	return [
		{ value: null, label: SHELF_LABEL },
		...roadmap.buckets.map((bucket) => ({ value: bucket.value, label: bucket.value })),
	];
}

/**
 * The write a Set state entry means. On the board the menu is the drag's equal, so
 * it takes the drag's own path — the same planned write, the same gate, the same
 * announcement — and that path is also the only one that can express the no-state
 * entry, which the tree's list never offers.
 */
function chooseState(host: BacklogViewHost, item: BacklogItem, choice: ValueChoice): Promise<boolean> {
	if (host.projection === 'board' || choice.value === null) return host.performBoardMove(item, choice.value);
	return host.applySafely([{ file: item.file, state: choice.value }]);
}

/**
 * Render one Set menu's offers, checking the one the item already holds.
 *
 * "Already holds" is asked of the PLAN — an entry is checked exactly when picking
 * it would write nothing — rather than by a comparison written beside the plan and
 * expected to agree with it. Those two drifted the moment a second property joined:
 * a horizon the reader refuses reads as no value, so comparing values checked
 * `Unplaced` on a note whose key still held something, offering as current an
 * action that removes a key and spends the undo slot. One question, asked once, and
 * a checkmark can no longer disagree with what picking it does.
 */
function addValueItems(
	menu: Menu,
	choices: ValueChoice[],
	plan: (choice: ValueChoice) => ItemWrite[],
	pick: (choice: ValueChoice) => void,
): void {
	for (const choice of choices) {
		menu.addItem((si) => {
			si.setTitle(choice.label).onClick(() => pick(choice));
			if (plan(choice).length === 0) si.setChecked(true);
		});
	}
}

function addStateItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	addValueItems(
		menu,
		stateChoices(host, item),
		(choice) => computeStateDropWrites(item, choice.value),
		(choice) => void chooseState(host, item, choice),
	);
}

/** Set horizon's offers, taking the drag's own path exactly as Set state does. */
function addHorizonItems(host: BacklogViewHost, menu: Menu, item: BacklogItem, roadmap: RoadmapModel): void {
	addValueItems(
		menu,
		horizonChoices(roadmap),
		(choice) => computeHorizonDropWrites(item, choice.value),
		(choice) => void host.performHorizonMove(item, choice.value),
	);
}

/**
 * `setSubmenu` is missing from the published obsidian typings, not from the app:
 * submenus predate the 1.10.2 this plugin requires, so the cast asserts what is
 * always there rather than guarding against its absence.
 */
function submenuOf(item: MenuItem): Menu {
	return (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();
}

function addSetStateMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set state').setIcon('circle-check');
		addStateItems(host, submenuOf(mi), item);
	});
}

/**
 * The buckets this menu can offer, or null when there are none on screen to name.
 * Gated on the RENDERED roadmap rather than on the horizon property alone: the
 * offers are the rendered buckets, so on the timeline — or in any projection that
 * is not the roadmap — there is no vocabulary to speak in, and an entry naming
 * buckets nothing shows would be the menu describing a different screen.
 */
function renderedBuckets(host: BacklogViewHost): RoadmapModel | null {
	const roadmap = host.projection === 'roadmap' ? host.roadmap?.roadmap : null;
	return roadmap && roadmap.axis === 'horizons' ? roadmap : null;
}

function addSetHorizonMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem, roadmap: RoadmapModel): void {
	menu.addItem((mi) => {
		mi.setTitle('Set horizon').setIcon('map');
		addHorizonItems(host, submenuOf(mi), item, roadmap);
	});
}

/** Tag editing on the keyboard path — the same list the row's + button offers. */
function addEditTagsMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Edit tags').setIcon('tags');
		addTagItems(host, submenuOf(mi), item);
	});
}

function addSetTypeMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const apply = (level: string) => {
		void host.applySafely([{ file: item.file, typeName: level }]);
	};
	menu.addItem((mi) => {
		mi.setTitle('Set type').setIcon('tag');
		const submenu = submenuOf(mi);
		for (const level of ALL_TYPES) {
			submenu.addItem((si) => {
				si.setTitle(level).onClick(() => apply(level));
				if (item.typeName !== null && item.typeName.toLowerCase() === level.toLowerCase()) {
					si.setChecked(true);
				}
			});
		}
	});
}
