import { Menu, MenuItem } from 'obsidian';
import type { MyWorkView } from './myWorkView';
import { t } from '../../i18n/t';
import { ScopeRow } from '../../domain/scopeRows';
import { BacklogItem } from '../../domain/model';
import { deliverablesWorkflow, ownWorkflowReading, stateKeyFor } from '../../domain/board';
import { inCatalog, isDeliverableType } from '../../domain/itemTypes';
import { menuValues, stateMenuValues } from '../../domain/settings';
import { sameValue, todayStamp } from '../../domain/noteFields';
import { computeDeliverableStateWrites, computeStateWrites, computeTestStateWrites, ItemWrite } from '../../domain/writePlan';
import { rowVocabulary } from '../projection';
import { showMenuForClick } from '../interactions/menu';

/**
 * The epic's definition of done for this Feature: an item can be acted on from the list,
 * through the same gate and the same context-row refusals as every other projection. The
 * smallest honest version of that is Set state from a row's own context menu — nothing
 * wider, and no second editing surface here.
 *
 * **The context-row rule, at the one place this surface could break it**: a context row
 * renders, it parents, and that is all — no Set state, and no action that would write to a
 * note the Base excluded. `applySafely`'s own `outsideFilter` refusal is the structural
 * backstop underneath this (it would refuse the whole batch anyway), and this guard is
 * what keeps the menu from OFFERING an action it would then have to refuse.
 *
 * **Dispatch is by the item's OWN workflow, not the view's single `stateKey`** — exactly
 * the rule `stateKeyFor`/`ownWorkflowReading` state for the backlog view's identical
 * menu: a Deliverable or a test-catalog row reads and writes through its own workflow's
 * property, never the requirements one, so a vault whose Deliverables carry a distinct
 * state property gets a menu that actually moves the row it is drawn on.
 */
export function showMyWorkRowMenu(view: MyWorkView, row: ScopeRow, evt: MouseEvent): void {
	const menu = new Menu();
	addOpenSection(menu, view, row.item);
	// Gated on the ROW's own effective key (`stateKeyFor`, over `view.planSettings`), never
	// `view.settings.stateKey`: that field is the REQUIREMENTS property alone, and Task 3b
	// made a Deliverable's or a test-catalog member's own state property bindable
	// independently of it — gating on the view's single key would withhold Set state from
	// a perfectly writable Deliverable row whenever the requirements property happens to be
	// cleared.
	if (!row.context && stateKeyFor(view.planSettings, row.item) !== '') addSetStateMenu(menu, view, row.item);
	showMenuForClick(menu, evt);
}

/** Open, and open in a new tab — the two entries every row offers regardless of the
 *  context-row rule: opening a note is never a write, so a context ancestor is a real
 *  note the reader may still want to read even though this menu offers no way to edit it. */
function addOpenSection(menu: Menu, view: MyWorkView, item: BacklogItem): void {
	menu.addItem((mi) =>
		mi
			.setTitle(t('mywork.menu.open'))
			.setIcon('file')
			.onClick(() => view.opener.openIn(view.openContext(), item, view.settings.openIn)),
	);
	menu.addItem((mi) =>
		mi
			.setTitle(t('mywork.menu.openTab'))
			.setIcon('file-plus')
			.onClick(() => view.opener.openIn(view.openContext(), item, 'tab')),
	);
}

/**
 * `setSubmenu` is missing from the published obsidian typings, not from the app —
 * `view/interactions/menu.ts`'s own `submenuOf` states the identical reason: submenus
 * predate the 1.12.0 this plugin requires, so the cast asserts what is always there
 * rather than guarding against its absence.
 */
function submenuOf(item: MenuItem): Menu {
	return (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();
}

/**
 * What Set state offers for THIS row — the same three-way workflow dispatch
 * `stateKeyFor`/`ownWorkflowReading` state, asked a third time about the VOCABULARY: a
 * Deliverable takes `deliverablesWorkflow`'s own values (the same resolution its board
 * draws columns from), a catalog row takes the test workflow's configured-or-observed
 * list, and everything else takes the requirements one — `stateMenuValues`, the same
 * reader the backlog view's own Set state menu uses. `rowVocabulary` scopes the observed
 * half to whichever population the row belongs to, so a status only a plan row carries
 * cannot mint a menu entry for a catalog row and vice versa.
 */
function stateChoicesFor(view: MyWorkView, item: BacklogItem): string[] {
	// `!`, not a null guard: `showMyWorkRowMenu` is only ever wired from a row this view's
	// own tree drew (`renderTree.ts`), and the tree is only ever drawn once `view.model` is
	// non-null (`draw()`'s own early returns) — the same `view.model!` `drawMyWorkTree`
	// reads for the identical reason.
	const model = view.model!;
	if (isDeliverableType(item.typeName)) return deliverablesWorkflow(model, view.planSettings).values;
	if (inCatalog(item)) {
		return menuValues(view.planSettings.testStates, view.planSettings.testDoneValues, rowVocabulary(model, item).observedStates);
	}
	return stateMenuValues(view.planSettings, rowVocabulary(model, item).observedStates);
}

/** The write one Set state pick means — the same three-way dispatch once more, now over
 *  the PLANNER: a Deliverable and a catalog row plan through their own workflow's function,
 *  with no date stamp (Scope, for both); everything else plans through `computeStateWrites`,
 *  which is what rides the started/finished stamp pair. */
function planStateWrite(view: MyWorkView, item: BacklogItem, state: string): ItemWrite[] {
	if (isDeliverableType(item.typeName)) return computeDeliverableStateWrites(item, state);
	if (inCatalog(item)) return computeTestStateWrites(item, state);
	return computeStateWrites(item, state, view.planSettings, todayStamp());
}

function addSetStateMenu(menu: Menu, view: MyWorkView, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle(t('mywork.menu.setState')).setIcon('circle-check');
		addStateEntries(view, submenuOf(mi), item);
	});
}

/**
 * Render Set state's offers, checking the one the item already holds.
 *
 * "Already holds" is asked of the PLAN — an entry is checked exactly when picking it
 * would write nothing — never by a comparison written beside the plan and expected to
 * agree with it: the two drift the moment a second property joins, which is exactly what
 * happened here once a Deliverable's own workflow arrived. A value comparison would have
 * to separately learn that a workflow with no reading yet reads as no value; asking the
 * plan needs no such second copy of the rule.
 */
function addStateEntries(view: MyWorkView, menu: Menu, item: BacklogItem): void {
	const values = stateChoicesFor(view, item);
	// The item's own unlisted value still earns an entry, so the current state always
	// renders checked — `stateChoices`'s own rule in the backlog view's identical menu.
	const current = ownWorkflowReading(item).value;
	const listed = current !== null && values.some((value) => sameValue(value, current));
	const offered = listed || current === null ? values : [...values, current];
	for (const state of offered) {
		menu.addItem((si) => {
			si.setTitle(state).onClick(() => void view.gate.applySafely(planStateWrite(view, item, state)));
			if (planStateWrite(view, item, state).length === 0) si.setChecked(true);
		});
	}
}
