import { setIcon, setTooltip } from 'obsidian';
import type { MyWorkView } from './myWorkView';
import { t } from '../../i18n/t';
import { ownWorkflowReading, stateKeyFor } from '../../domain/board';
import { assignedRows, nextAssigned, pickedResource } from '../../domain/assignedWork';
import { childRows, rowsAfterHideDone, ScopeRow, siblingPlaces, visibleRows } from '../../domain/scopeRows';
import { MyWorkSettings } from '../../domain/myWorkOptions';
import { displayType } from '../../domain/itemTypes';
import { badgeStyleFor } from '../render/badges';
import { drawIcon } from '../render/icons';
import { guidanceShell } from '../render/emptyStates';
import { foldedPaths, scopeFlag, toggleFold } from '../scopeFolds';
import { TreeDraw, wireScopeKeys } from '../scopeKeys';
import { MYWORK_FOLD } from '../../storage/foldKeys';
import { uniqueElementId } from '../selection';
import { showMyWorkRowMenu } from './rowMenu';

/**
 * One person's tree — Task 1's row shape and transforms, Task 2's membership and "what is
 * next", Task 5's shared fold set, Task 7's shared keyboard, drawn the way
 * `view/release/scopeTree.ts` draws the release scope's own rows: hide-done first, fold
 * second, `childRows` over the hide-done list, `siblingPlaces` over the visible one.
 * Nothing here writes a note — a fold touches localStorage through the view-state store
 * and a click opens a note through `OpenController`, neither of which this view's own
 * write rule refuses.
 *
 * `TreeDraw` itself lives in `view/scopeKeys.ts`, not here — the shape this module builds
 * and hands to `wireScopeKeys` below, moved out to the module both trees' draws feed so
 * neither tree module has to import the other and `scopeKeys.ts` need import neither back
 * (the same DAG `view/release/scopeTree.ts`'s own header states for its half of it).
 */

/**
 * Whether ANY workflow this tree could draw a row for has a configured state key —
 * requirements, Deliverable or test, asked of the SETTINGS rather than of one row's own
 * kind. Task 3b made the Deliverable and test keys bindable independently of the
 * requirements one, so a vault with `stateProperty` cleared and `deliverableStateProperty`
 * set is a supported configuration whose Deliverable rows read their done-ness perfectly
 * well — gating on `stateKey` alone would call that configuration blind.
 *
 * `hidesDone`'s own question, and ONLY `hidesDone`'s (fix round 1, finding 1): a row whose
 * doneness is unknowable is not KNOWN done, so a GLOBAL "is anything readable" gate is the
 * right question for whether hiding may act at all. The Next marker asks a narrower,
 * PER-ROW question instead — see `drawMyWorkTree`'s own filter, below.
 *
 * Exported for `view/mywork/toolbar.ts` (Task 8): the toolbar's own hide-done control is
 * withheld on this SAME question — `view/release/scopeToolbar.ts`'s own
 * `release.done.unconfigured` gate, asked here of the settings rather than of a row.
 */
export function anyWorkflowConfigured(settings: MyWorkSettings): boolean {
	return settings.stateKey !== '' || settings.deliverableStateKey !== '' || settings.testStateKey !== '';
}

/**
 * This view's own gate on the stored hide-done preference — the stored flag AND a
 * configured key, `effectiveHideDone`'s own rule (`view/release/scopeTree.ts`) asked of
 * this view's question: a control that could hide rows with nothing left on screen to
 * bring them back is worse than no control. Exported for `view/mywork/toolbar.ts` (Task
 * 8), its one other caller: the toolbar's hide-done control reads its ON/OFF state
 * through this SAME function rather than a second copy of the rule.
 */
export function hidesDone(view: MyWorkView): boolean {
	return scopeFlag(view, 'myWorkHideDone') && anyWorkflowConfigured(view.settings);
}

export function drawMyWorkTree(view: MyWorkView, parentEl: HTMLElement): TreeDraw | null {
	const person = pickedResource(view.model!, view.pickedPerson!)!;
	const all = assignedRows(view.model!, view.pickedPerson!);
	const folded = foldedPaths(view, MYWORK_FOLD, view.pickedPerson!);
	// Hide-done first, fold second: `withKids` has to answer "does this row still have a
	// child" AFTER a finished subtree has gone, or a parent whose children all hid keeps a
	// disclosure over a subtree that is not there.
	const afterHide = rowsAfterHideDone(all, hidesDone(view));
	const withKids = childRows(afterHide);
	const visible = visibleRows(afterHide, folded);
	// **A picked person with nothing is a SUPPORTED state, not a broken one.** The roster
	// lists declared people, and [[My work]] requires that somebody with nothing assigned
	// yet still appears in it — so this is reachable on the first click of a working vault,
	// and an empty `role="tree"` would answer it with a blank pane and a stray tab stop.
	//
	// Two causes, two sentences, because the second one is the reader's own doing and is
	// undone by a control already on screen: nothing is assigned, or hide-done took the
	// last row. Drawn INSTEAD of the tree and before it exists — the toolbar is already up
	// (`render()` draws it for every state that has a roster), so the way out stays in
	// reach. A folded-away row is NOT a third case: the parent it folded into is still
	// drawn, so `visible` is only empty when `afterHide` is.
	if (afterHide.length === 0) {
		const done = all.length > 0;
		guidanceShell(
			parentEl,
			done ? 'check-check' : 'coffee',
			done ? t('mywork.empty.allDone.title') : t('mywork.empty.noWork.title'),
			done ? t('mywork.empty.allDone.hint') : t('mywork.empty.noWork.hint'),
		);
		return null;
	}
	const treeEl = parentEl.createDiv({
		cls: 'pbl-tree pbl-mw-tree',
		attr: { role: 'tree', 'aria-label': person.title, tabindex: '0' },
	});
	// Over the hide-done list rather than the visible one: what to do next does not change
	// because somebody folded the row above it.
	//
	// Filtered PER CANDIDATE by `stateKeyFor`, never gated by `anyWorkflowConfigured`
	// (fix round 1, finding 1): that global question is right for `hidesDone` above — a row
	// whose doneness is unknowable is not KNOWN done, so leaving it visible is correct — and
	// wrong here, because Next is a POSITIVE claim about ONE row. A requirements PBI ordered
	// before a bound-workflow test item, with `stateProperty` cleared, would otherwise read
	// through an empty key (`ownWorkflowReading` reporting it not-done — indistinguishable
	// from genuinely unfinished) and get marked Next while the tree cannot tell. Filtering
	// out a candidate whose own effective key is empty BEFORE asking `nextAssigned` lets the
	// search fall through to the next member in plan order instead, and — since a tree with
	// every key unbound filters every row — it also covers the "no key anywhere" case
	// `anyWorkflowConfigured` used to gate, with no separate check needed for it here.
	const next = nextAssigned(afterHide.filter((row) => stateKeyFor(view.planSettings, row.item) !== ''));
	// Built WHILE drawing rather than queried back out of the DOM — `src/view/CLAUDE.md`'s
	// `TREE_SCAN` bans that scan, and the keyboard looks a row up on every arrow key.
	const rowEls = new Map<string, HTMLElement>();
	for (const { row, pos, count } of siblingPlaces(visible)) {
		rowEls.set(
			row.item.file.path,
			drawRow(view, treeEl, row, {
				pos,
				count,
				hasKids: withKids.has(row.item.file.path),
				open: !folded.has(row.item.file.path),
				next: row === next,
			}),
		);
	}
	const draw: TreeDraw = { treeEl, rows: visible, kids: withKids, rowEls, folded };
	// The keyboard, wired as the last step — `renderScope.ts`'s own second step, for the
	// identical reason: this module already holds the draw, so the tree's own roving
	// selection is wired here rather than `wireScopeKeys` (`view/scopeKeys.ts`) importing
	// this module back. `MYWORK_FOLD` and the picked person's own path are this tree's
	// `scope`, the way `RELEASE_FOLD` and the open release's path are the other tree's.
	wireScopeKeys(view, treeEl, { prefix: MYWORK_FOLD, path: view.pickedPerson! }, draw);
	// Task 9's own write: one delegated listener on the pane, the release scope's own
	// `wireScopeCreate` shape — resolve the row from the event's target rather than a
	// per-row listener, and build the menu through `showMyWorkRowMenu`, which is the one
	// place the context-row rule (no Set state on a context row) and the workflow dispatch
	// (Deliverable / test / requirements) are stated.
	//
	// `evt.target` is asserted rather than tested — `scopeCreate.ts`'s own reason: this
	// listener is on `treeEl`, so a dispatched event always reports an element under it,
	// and an `instanceof` guard here would be the unreachable branch that module's own
	// header already argues against.
	treeEl.addEventListener('contextmenu', (evt) => {
		const rowEl = (evt.target as Element).closest('.pbl-row');
		const row = visible.find((r) => rowEls.get(r.item.file.path) === rowEl);
		if (!row) return;
		evt.preventDefault();
		showMyWorkRowMenu(view, row, evt);
	});
	return draw;
}

/** A row's place in its sibling group, its own fold state, and whether it is what is
 *  next — one bag rather than five positional arguments. */
interface RowPlace {
	pos: number;
	count: number;
	hasKids: boolean;
	open: boolean;
	next: boolean;
}

function drawRow(view: MyWorkView, treeEl: HTMLElement, row: ScopeRow, place: RowPlace): HTMLElement {
	const rowEl = treeEl.createDiv({
		cls: 'pbl-row' + (row.context ? ' pbl-mw-context' : ''),
		attr: {
			role: 'treeitem',
			// From 1, over the SCOPE's own depth, which re-roots at this person's tree: a
			// member drawn at top level is level 1 here even where the backlog would call it
			// level 3 — correct, because the tree being announced is this screen's.
			'aria-level': String(row.depth + 1),
			'aria-posinset': String(place.pos),
			'aria-setsize': String(place.count),
			'data-path': row.item.file.path,
			// Minted per view instance: `aria-activedescendant` resolves a DOCUMENT id, and
			// two saved views can sit in split panes over one note.
			id: uniqueElementId('pbl-mw-row'),
		},
	});
	// `aria-selected` is NOT set here — it is the roving selection Task 7's keyboard
	// manages, on whichever row is active, and a draw-time value here could only ever be
	// wrong the moment a second row became active without a redraw.
	rowEl.setCssProps({ '--pbl-depth': String(row.depth) });

	drawDisclosure(view, rowEl, row, place);

	// A row is a target again — it opens its note. Unconditional but for one thing, on a
	// context row too: opening is not a write, and a context ancestor is a real note the
	// reader may still want to read even though this screen offers no way to edit it.
	//
	// `window.getSelection()?.isCollapsed === false` is the drag-select guard
	// `scopeTree.ts` records: an ORDINARY click collapses the selection on its own
	// `mousedown`, so by the time `click` fires a non-collapsed selection can only mean
	// this pointer-up just finished a drag-select rather than an activation.
	rowEl.addEventListener('click', (evt) => {
		if (window.getSelection()?.isCollapsed === false) return;
		view.opener.open(view.openContext(), row.item, evt);
	});
	rowEl.addEventListener('auxclick', (evt) => {
		// A middle click never fires `click` — the browser sends `auxclick` instead.
		if (evt.button !== 1) return;
		if (evt.target instanceof Element && evt.target.closest('.pbl-twisty') !== null) return;
		view.opener.openIn(view.openContext(), row.item, 'tab');
	});

	drawBadge(rowEl, row);

	const titleEl = rowEl.createSpan({ cls: 'pbl-title', text: row.item.title });
	// Set unconditionally, and nothing measures whether it was needed — `.pbl-row` carries
	// `content-visibility: auto`, so a `scrollWidth` read to decide would lay out a skipped
	// row by itself (`src/view/CLAUDE.md`'s own measured reason).
	setTooltip(titleEl, row.item.title);

	rowEl.createDiv({ cls: 'pbl-row-spacer' });

	drawStateChip(rowEl, row);
	drawNextMarker(rowEl, place.next);
	return rowEl;
}

/** Held on a leaf too — `visibility: hidden`, not absent — so a level's titles share one
 *  x. `aria-expanded` goes on the ROW, and only where there is something to expand. */
function drawDisclosure(view: MyWorkView, rowEl: HTMLElement, row: ScopeRow, place: RowPlace): void {
	const { hasKids, open } = place;
	const twistyEl = rowEl.createEl('button', {
		cls: 'pbl-twisty' + (hasKids ? '' : ' pbl-twisty-leaf'),
		attr: { type: 'button', tabindex: '-1', 'aria-label': t(open ? 'mywork.collapseRow' : 'mywork.expandRow') },
	});
	if (!hasKids) return;
	rowEl.setAttribute('aria-expanded', String(open));
	setIcon(twistyEl, open ? 'chevron-down' : 'chevron-right');
	twistyEl.addEventListener('click', (evt) => {
		// The row's own listener would otherwise open the note behind the fold.
		evt.stopPropagation();
		// Per-row identity for the redraw's focus restore, set BEFORE the render this call
		// triggers — Task 7's keyboard reads exactly this field, the way `activeScopeFile`
		// does for the release scope's own disclosure.
		view.activeRowFile = row.item.file;
		toggleFold(view, MYWORK_FOLD, view.pickedPerson!, row.item.file.path);
	});
}

/**
 * No `!badgeText` guard, unlike `scopeTree.ts`'s own copy of this shape: every row this
 * module ever draws is a `ScopeRow` from `scopeRows.ts`'s walk, which only ever keeps a
 * real `BacklogItem` — never a marker (skipped outright) or a `Resource` (diverted before
 * it is ever an item) — and `displayType` answers a real name for every such item, typed
 * or not (an untyped one still gets the implied rung its position on the ladder gives
 * it). A guard for the empty string here would be unreachable code guarding against a
 * case this walk cannot produce.
 */
function drawBadge(rowEl: HTMLElement, row: ScopeRow): void {
	const badgeText = displayType(row.item);
	const style = badgeStyleFor(badgeText);
	const badgeEl = rowEl.createSpan({ cls: 'pbl-badge' });
	if (style.icon) drawIcon(badgeEl.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
	badgeEl.addClass(style.badge);
	badgeEl.createSpan({ cls: 'pbl-badge-text', text: badgeText });
}

/**
 * The chip gets a column of its own so a row with no state leaves a gap rather than
 * sliding its neighbours left. Static: nothing here writes, so a chip with a hover
 * affordance would make the screen look editable. A CONTEXT row carries no state — it
 * renders, it parents, and that is all.
 *
 * `ownWorkflowReading` already asks the EFFECTIVE key for this row's own item — the
 * requirements key for a plain item, the Deliverable key for a Deliverable, the test key
 * for a catalog member — so a row whose own workflow is unbound draws no chip at all
 * rather than a stale reading through the wrong property.
 */
function drawStateChip(rowEl: HTMLElement, row: ScopeRow): void {
	const stateEl = rowEl.createDiv({ cls: 'pbl-mw-statecol' });
	const reading = ownWorkflowReading(row.item);
	if (row.context || reading.value === null) return;
	const chipEl = stateEl.createDiv({
		cls: 'pbl-state-chip pbl-state-static' + (reading.done ? ' pbl-state-done' : ''),
	});
	drawIcon(chipEl.createSpan({ cls: 'pbl-state-icon' }), reading.done ? 'circle-check' : 'circle');
	chipEl.createSpan({ cls: 'pbl-state-text', text: reading.value });
}

/** What to do next — the first unfinished member in plan order (`nextAssigned`), marked
 *  once per tree. Withheld from a context row by construction: `nextAssigned` never
 *  returns one, so `place.next` is never true there. */
function drawNextMarker(rowEl: HTMLElement, isNext: boolean): void {
	if (!isNext) return;
	const markerEl = rowEl.createSpan({ cls: 'pbl-mw-next', text: t('mywork.next') });
	setTooltip(markerEl, t('mywork.nextTip'));
}
