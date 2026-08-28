import { setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ownWorkflowReading } from '../../domain/board';
import { ReleaseRow, ScopeRow } from '../../domain/releases';
import { displayType } from '../../domain/itemTypes';
import { badgeStyleFor } from '../render/badges';
import { drawIcon } from '../render/icons';
import { loadViewState, saveViewState } from '../../storage/viewStateStore';
import { resolveViewIdentity, ViewIdentity } from '../../storage/viewIdentity';
import { RELEASE_FOLD } from '../viewState';
import { uniqueElementId } from '../selection';

/**
 * The scope tree's own rows: the disclosure, the fold set and the two row figures the
 * design shows — split out of `renderScope.ts` (Task 3) once that module's own header
 * grew a fourth reason to change on top of the header and the two empty states it still
 * owns. `renderScope.ts` calls {@link drawScopeTree} for the tree and keeps everything
 * else.
 *
 * **Nothing here writes a note.** A fold touches localStorage through the view-state
 * store, and a click opens a note through `OpenController` — neither is a write this
 * view's own rule (`releaseView.ts`, `test/view/releaseNeverEdits.test.ts`) refuses.
 */

/**
 * The release path is IN the key, unlike `view/viewState.ts`'s own `TIMELINE_SCOPE` and
 * `CARD_SCOPE`, because this scope is not one projection but one per release: the
 * question is "is this row open in THIS release's scope", and there are as many of those
 * as the base holds releases. One ancestor can be context in two releases at once, and
 * its disclosure hides two different member populations there — a bare-path key would
 * give those two questions one bit, so folding it in release A would collapse it in
 * release B and expanding either would clear both. `TIMELINE_SCOPE` and `CARD_SCOPE`
 * exist for exactly this failure, over the backlog's own two projections; this scope
 * multiplies it by "however many releases the base holds" instead of by two.
 *
 * `RELEASE_FOLD` itself now lives in `storage/foldKeys.ts`, not here (and is re-exported
 * by `view/viewState.ts`, which is where this module still names it): the backlog view's
 * own `ViewState` has to recognise the prefix too, since a saved view's TYPE can change
 * while its stored identity does not, and a `.base` view switched from this one to the
 * backlog view carries whatever this module wrote under that identity — see that
 * constant's own comment for what silently broke before it moved.
 */

/** `<NUL>release:<release path><NUL>` — everything after it is the member path, and the
 *  NUL is safe as a separator for the same reason it is safe as a prefix: neither path
 *  can contain one. */
function foldPrefix(releasePath: string): string {
	return `${RELEASE_FOLD}${releasePath}\u0000`;
}

/**
 * The session-only fallback {@link readRawFolds}/{@link writeRawFolds} use where there is
 * no view identity — `restorePick`'s own asymmetry (`releaseView.ts`), read from the other
 * end: an embedded base has no identity, so its folds are session-only rather than absent
 * — gone on reload, exactly as the pick is, and the tree is one press from reopening.
 * Keyed on the VIEW, so a remounted view starts fresh, as every other session-only value
 * here does.
 */
const sessionFolds = new WeakMap<ReleaseView, string[]>();

/** Every fold key this view's own entry currently holds, whichever backend answers for
 *  it — the identity-backed store, or the session fallback above. Both read and write
 *  sides work over this one flat list, so which backend is live is decided in exactly
 *  two places. */
function readRawFolds(view: ReleaseView, id: ViewIdentity | null): string[] {
	if (id === null) return sessionFolds.get(view) ?? [];
	return loadViewState(view.app, id).folds.collapsed;
}

function writeRawFolds(view: ReleaseView, id: ViewIdentity | null, all: string[]): void {
	if (id === null) {
		sessionFolds.set(view, all);
		return;
	}
	const state = loadViewState(view.app, id);
	saveViewState(view.app, id, { ...state, folds: { ...state.folds, collapsed: all } });
}

/**
 * The paths folded shut in the OPEN release's scope, from the same per-identity entry the
 * pick is stored in. Nothing new is persisted: `folds.collapsed` already exists and this
 * view's identity gives it its own copy.
 *
 * Neither of `ViewStateController`'s two rename walks reaches these keys, and that is not
 * a cost any more: both are methods of a controller this view holds none of — it reads and
 * writes `folds.collapsed` directly through `loadViewState`/`saveViewState` — so the walk
 * that carries a fold here is `renamePathFolds` (`storage/viewStateStore.ts`), over the
 * STORED entries and wired to `vault.on('rename')` at the plugin. Renaming a member, or the
 * open release itself, therefore migrates the fold rather than reopening the row. What made
 * that affordable was moving the key shape DOWN rather than copying it: `notePath`,
 * `scopeOf` and `movedFoldKey` live in `storage/foldKeys.ts`, the layer that stores the key,
 * so `storage/` needs no import from `view/` and there is still exactly one `notePath`.
 */
export function foldedPaths(view: ReleaseView, releasePath: string): Set<string> {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	const prefix = foldPrefix(releasePath);
	// Only THIS release's keys, stripped back to member paths — the caller asks about the
	// rows it is drawing, and a key from another release's scope answers a different
	// question about the same note.
	return new Set(
		readRawFolds(view, id)
			.filter((k) => k.startsWith(prefix))
			.map((k) => k.slice(prefix.length)),
	);
}

/** Write this release's fold set back, keeping every other release's keys — and any
 *  other fold this store already holds — untouched. */
function writeFolds(view: ReleaseView, releasePath: string, folded: ReadonlySet<string>): void {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	const prefix = foldPrefix(releasePath);
	const others = readRawFolds(view, id).filter((k) => !k.startsWith(prefix));
	const mine = [...folded].map((path) => `${prefix}${path}`);
	writeRawFolds(view, id, [...others, ...mine]);
}

/**
 * Flips one row's fold and redraws — one call rather than two repeated at every caller.
 * The disclosure's own click used to pair `toggleFold` with `view.render()` itself, and
 * `scopeKeys.ts`'s keyboard Left/Right need the identical pair; moving the render in here
 * is what lets both call one function instead of each remembering the redraw.
 */
export function toggleFold(view: ReleaseView, releasePath: string, path: string): void {
	const folded = foldedPaths(view, releasePath);
	if (folded.has(path)) folded.delete(path);
	else folded.add(path);
	writeFolds(view, releasePath, folded);
	view.render();
}

/**
 * Fold or unfold every row THIS scope drew, without touching another release's set —
 * `rows` is what makes "exactly this scope" precise rather than "everything".
 *
 * **Collapsing writes a key only for rows `childRows` says have a child** — never for a
 * leaf. A leaf has no disclosure to close, so a leaf's fold key is not a fold anything can
 * ever act on: it sits in `folds.collapsed` forever, indistinguishable from a stale entry
 * `childRows` already has to defend against elsewhere in this module. That would cost
 * nothing on its own if the list were free, but it is not — `folds.collapsed` spends from
 * one `MAX_FOLDS` budget shared across every scope this saved view holds
 * (`storage/viewStateStore.ts`'s `readFolds`), which keeps the FIRST entries read and
 * drops the rest once it runs out. A key per leaf is pure waste against that budget: it
 * cannot be un-collapsed, it cannot be seen, and every one written is a slot a REAL fold —
 * on this release or another — can no longer buy, so folding a row eventually stops
 * working with no error, the redraw simply leaving it open. Expanding needs no such
 * filter: it already writes the empty set.
 *
 * **`rows` here is the caller's FULL `scope.rows`, not the hide-done-filtered rows
 * `drawScopeTree` computes its own `withKids` over** — `scopeToolbar.ts`'s own caller
 * draws before the tree does — so with hide-done ON this can write a key for a row that
 * `drawScopeTree` currently draws as a leaf; accepted rather than threaded through, since
 * the key reads correctly again the moment hide-done goes off and nothing draws a
 * chevron over an empty subtree meanwhile.
 */
export function setAllFolds(view: ReleaseView, releasePath: string, rows: ScopeRow[], folded: boolean): void {
	if (!folded) {
		writeFolds(view, releasePath, new Set());
		return;
	}
	const withKids = childRows(rows);
	writeFolds(view, releasePath, new Set(rows.filter((row) => withKids.has(row.item.file.path)).map((row) => row.item.file.path)));
}

/**
 * The session-only fallback for {@link hideDoneOn}/{@link setHideDone}, `sessionFolds`'s
 * own reason: an embedded base has no identity, so the toggle is session-only there —
 * gone on reload, exactly as the pick and the folds are.
 */
const sessionHideDone = new WeakMap<ReleaseView, boolean>();

/**
 * Whether the scope screen is hiding finished subtrees — ONE flag for the whole view,
 * never scoped per release the way {@link foldedPaths} is: a fold set has to answer "is
 * THIS row open" for as many releases as the base holds, but hiding is a single working
 * preference the reader carries from one release's screen to the next, `bucketList`'s own
 * shape (`storage/viewStateStore.ts`). Read through the same per-identity entry the pick
 * and the folds use, so it survives exactly as they do and no further.
 */
export function hideDoneOn(view: ReleaseView): boolean {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) return sessionHideDone.get(view) ?? false;
	return loadViewState(view.app, id).prefs.releaseHideDone === true;
}

/**
 * Whether the tree should actually act on the hide-done preference for THIS release —
 * the stored flag gated on `release.done.unconfigured`, the same question
 * `scopeToolbar.ts` asks to decide whether to draw the control at all.
 *
 * Not a second opinion beside `hideDoneOn`: the preference is the reader's own standing
 * choice and must outlive any one release (a reader who turns it on must find it still on
 * the next release where progress works), but its EFFECT has to stop exactly where the
 * toggle does — `release.done.unconfigured` withholds the button, and applying the stored
 * flag anyway on that release hides rows with no control left on screen to bring them
 * back. One function so the tree's own hiding and the all-done check below can never
 * answer this differently about the same release.
 */
export function effectiveHideDone(view: ReleaseView, release: ReleaseRow): boolean {
	return hideDoneOn(view) && !release.done.unconfigured;
}

/** Flip the toggle and redraw — `toggleFold`'s own pairing, for the identical reason:
 *  every caller wants the write and the render together rather than remembering both. */
export function setHideDone(view: ReleaseView, next: boolean): void {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) {
		sessionHideDone.set(view, next);
	} else {
		const state = loadViewState(view.app, id);
		// `undefined` for the default rather than `false`: absence IS the off state, and a
		// stored `false` would be a value meaning "none" — `readPrefs`'s own rule
		// (`storage/viewStateStore.ts`).
		saveViewState(view.app, id, { ...state, prefs: { ...state.prefs, releaseHideDone: next ? true : undefined } });
	}
	view.render();
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
function visibleRows(rows: ScopeRow[], folded: ReadonlySet<string>): ScopeRow[] {
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
function siblingPlaces(rows: ScopeRow[]): { row: ScopeRow; pos: number; count: number }[] {
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
function childRows(rows: ScopeRow[]): Set<string> {
	const withKids = new Set<string>();
	for (let i = 0; i < rows.length - 1; i++) {
		if (rows[i + 1].depth > rows[i].depth) withKids.add(rows[i].item.file.path);
	}
	return withKids;
}

/**
 * What `scopeKeys.ts`'s `wireScopeKeys` needs of a finished draw, produced here rather
 * than in that module: `scopeTree.ts` has no reason to import `scopeKeys.ts` back —
 * `drawScopeTree` returns this and `renderScope.ts` (which already imports both) wires
 * the keyboard as a second step, which is what keeps the two release-tree modules a DAG
 * rather than a cycle `npm run analyze` refuses.
 */
export interface ScopeDraw {
	readonly treeEl: HTMLElement;
	/** The rows the tree actually DREW, in order — `visibleRows`' own output, never the
	 *  full walk (a folded-away row is not in the DOM to arrow onto). */
	readonly rows: ScopeRow[];
	/** The paths `drawScopeTree` drew a disclosure on — the rendered tree's own answer,
	 *  never the fold set's (a stale fold entry must not make a leaf answer as a parent). */
	readonly kids: ReadonlySet<string>;
	/** Path → element, built while drawing rather than queried back out of the DOM —
	 *  `src/view/CLAUDE.md`'s `TREE_SCAN` bans exactly that scan. */
	readonly rowEls: ReadonlyMap<string, HTMLElement>;
	/**
	 * The fold set this draw was computed against — `drawScopeTree`'s own call to
	 * {@link foldedPaths}, handed out rather than left for a caller to ask again. It
	 * cannot change during the controller's life: `toggleFold` and `setHideDone` both
	 * call `view.render()`, which rebuilds this whole listener from a fresh draw, so a
	 * value that answers for the WHOLE render pass can be read once here instead of
	 * asked fresh on every keydown. `scopeKeys.ts` used to call {@link foldedPaths}
	 * itself at the top of every keydown — including the ones that do nothing — which is
	 * `resolveViewIdentity` plus `loadViewState`'s full JSON parse and validation of
	 * every stored view entry, paid on every ArrowDown of a key-repeat rather than once
	 * per render.
	 */
	readonly folded: ReadonlySet<string>;
}

export function drawScopeTree(view: ReleaseView, release: ReleaseRow, rows: ScopeRow[]): ScopeDraw {
	// Named by the release, so a reader arriving at the tree hears which one it is. The
	// name is vault content rather than text — it goes nowhere near the catalog.
	// `tabindex="0"` makes the CONTAINER the tab stop — a composite widget's own rule
	// (`src/view/CLAUDE.md`) — with `scopeKeys.ts` moving a roving selection inside it.
	const treeEl = view.viewEl.createDiv({
		cls: 'pbl-tree',
		attr: { role: 'tree', 'aria-label': release.name, tabindex: '0' },
	});
	const folded = foldedPaths(view, release.path);
	// Hide-done first, fold second — `rowsAfterHideDone`'s own comment on why this is two
	// passes rather than one: `withKids` has to answer "does this row still have a child"
	// AFTER a finished subtree has gone, or a parent whose children all hid would keep the
	// disclosure its own fold state says it should, over a subtree that is not there.
	//
	// `effectiveHideDone`, never the raw `hideDoneOn` preference: the toolbar withholds the
	// control on `release.done.unconfigured` and the tree must withhold its EFFECT on the
	// same gate, or a reader who turned hiding on for a release where progress works opens
	// one where it does not and finds rows gone with nothing on screen to bring them back.
	const afterHide = rowsAfterHideDone(rows, effectiveHideDone(view, release));
	const withKids = childRows(afterHide);
	const visible = visibleRows(afterHide, folded);
	// Built WHILE drawing rather than queried from `treeEl` afterwards — the cost rule
	// every tree in this plugin keeps (`src/view/CLAUDE.md`'s `TREE_SCAN`): a row is
	// reached by lookup, never by scanning the DOM for it, and `scopeKeys.ts`'s own
	// selection moves on every arrow key rather than once per render.
	const rowEls = new Map<string, HTMLElement>();
	// The walk hands back each row joined to its own place, rather than a parallel array this
	// loop would index into — an index lookup would need a fallback for a case that cannot
	// happen, which is the unreachable branch this module's own header argues against.
	for (const { row, pos, count } of siblingPlaces(visible)) {
		rowEls.set(
			row.item.file.path,
			drawRow(view, release, treeEl, row, {
				pos,
				count,
				hasKids: withKids.has(row.item.file.path),
				open: !folded.has(row.item.file.path),
			}),
		);
	}
	// `visible`, never `rows`: arrowing onto a row a fold hid would move the active
	// descendant to an element that is not in the DOM. `withKids` is the rendered tree's
	// own answer too — see `scopeKeys.ts`'s own comment on why the fold set cannot stand in.
	return { treeEl, rows: visible, kids: withKids, rowEls, folded };
}

/** A row's place in its sibling group plus its own fold state — one bag rather than four
 *  positional booleans and numbers, which is what pushed `drawRow` over the parameter
 *  budget the moment folding joined `pos`/`count`. */
interface RowPlace {
	pos: number;
	count: number;
	hasKids: boolean;
	open: boolean;
}

/** Returns the row's own element — `drawScopeTree`'s way of building its path → element
 *  index without a second walk of the DOM (`TREE_SCAN`'s own reason, `scopeKeys.ts`). */
function drawRow(view: ReleaseView, release: ReleaseRow, treeEl: HTMLElement, row: ScopeRow, place: RowPlace): HTMLElement {
	const rowEl = treeEl.createDiv({
		cls: 'pbl-row' + (row.context ? ' pbl-rel-context' : ''),
		attr: {
			role: 'treeitem',
			// From 1, over the SCOPE's own depth, which re-roots at the release: a member drawn
			// at top level is level 1 here even where the backlog would call it level 3. That is
			// correct — the tree being announced is this screen's.
			'aria-level': String(row.depth + 1),
			'aria-posinset': String(place.pos),
			'aria-setsize': String(place.count),
			'data-path': row.item.file.path,
			// Minted per view instance (`scopeKeys.ts`'s own comment): `aria-activedescendant`
			// resolves a DOCUMENT id, and two saved views can sit in split panes over one note.
			id: uniqueElementId('pbl-rel-row'),
		},
	});
	// `aria-selected` is NOT set here — it is the roving selection `scopeKeys.ts` manages,
	// on whichever row is active, and a draw-time value here could only ever be wrong the
	// moment a second row became active without a redraw. `aria-expanded` is not: see the
	// disclosure below, which is a fact about the ROW rather than about the keyboard.
	rowEl.setCssProps({ '--pbl-depth': String(row.depth) });

	drawDisclosure(view, release, rowEl, row, place);

	// A row is a target again — it opens its note. Unconditional but for one thing, on a
	// context row too: opening is not a write, and a context ancestor is a real note the
	// reader may still want to read even though this screen refuses every action that
	// would edit it.
	//
	// **Carried finding 5.** `.pbl-rel-view .pbl-row` restores `user-select: auto`
	// (`styles/releaseScope.css`) so a reader can copy a title on a read-only screen — and
	// that is what makes a plain `click` wrong here: dragging across the title and
	// releasing the pointer still dispatches `click` on the row, so without this guard the
	// reader who wanted the text got navigated away instead. The backlog tree never needed
	// one, because `.pbl-row` there is `user-select: none` and a drag selects nothing.
	//
	// `window.getSelection()?.isCollapsed === false` is the question to ask, and asking it
	// HERE — in the click handler, not at `mousedown`/`mouseup` coordinates and not a drag
	// flag set between them — is what makes it correct rather than merely plausible: an
	// ORDINARY click collapses the selection on its own `mousedown` (the pointer lands and
	// the caret moves there), so by the time `click` fires a non-collapsed selection can
	// only mean this pointer-up just finished a drag-select. A coordinate or a flag would
	// have to reconstruct that same fact by hand.
	//
	// The KEYBOARD path is untouched on purpose: Enter and Space open the active row through
	// `scopeKeys.ts`, and a reader driving the tree from the keyboard may well have text
	// selected somewhere else on the page — that selection says nothing about THIS
	// activation, so only the pointer path asks the question.
	rowEl.addEventListener('click', (evt) => {
		if (window.getSelection()?.isCollapsed === false) return;
		view.opener.open(view.openContext(), row.item, evt);
	});
	rowEl.addEventListener('auxclick', (evt) => {
		// A middle click never fires `click` — the browser sends `auxclick` instead, so the
		// listener above never sees it (`src/view/CLAUDE.md`'s own stated rule, and the pair
		// every other row wires it as: `render/rows.ts`, `cardChildren.ts`, `board.ts`). The
		// disclosure is excluded by hand rather than through `stopPropagation`, because
		// unlike its `click` handler it wires no `auxclick` of its own to stop one at.
		if (evt.button !== 1) return;
		if (evt.target instanceof Element && evt.target.closest('.pbl-twisty') !== null) return;
		view.opener.openIn(view.openContext(), row.item, 'tab');
	});

	drawBadge(rowEl, row);

	const titleEl = rowEl.createSpan({ cls: 'pbl-title', text: row.item.title });
	// Set unconditionally, and NOTHING measures whether it was needed. `.pbl-row` carries
	// `content-visibility: auto`, so a `scrollWidth` read to decide would lay out a skipped
	// row by itself — the tree's own measured reason (5320ms against 12ms), inherited here
	// with the class. A tooltip repeating a title that already fits is the whole price.
	setTooltip(titleEl, row.item.title);

	drawContextMarker(rowEl, row);

	// Carried finding 3: without this, the state chip and rollup packed against whichever
	// title happened to be short instead of anchoring at the row's end, reading ragged
	// down the tree — found by building the harness and looking (`.pbl-title` is
	// `flex: 0 1 auto` and never grows on its own). `.pbl-row-spacer` is
	// `styles/propertyColumns.css`'s own flexible middle, the same class the backlog
	// tree's own rows push their end columns with (`render/rows.ts`'s `renderRowColumns`),
	// drawn in the identical position: after the title and its markers, before the
	// trailing columns.
	rowEl.createDiv({ cls: 'pbl-row-spacer' });

	drawStateChip(rowEl, row);
	drawRollup(rowEl, row, release);
	return rowEl;
}

/**
 * Held on a leaf too — `visibility: hidden`, not absent — so a level's titles share one x.
 * `aria-expanded` goes on the ROW, and only where there is something to expand: on a leaf
 * it would announce an interaction that does not exist, which is why `renderScope.ts` had
 * none of it while the tree could not fold at all.
 */
function drawDisclosure(view: ReleaseView, release: ReleaseRow, rowEl: HTMLElement, row: ScopeRow, place: RowPlace): void {
	const { hasKids, open } = place;
	const twistyEl = rowEl.createEl('button', {
		cls: 'pbl-twisty' + (hasKids ? '' : ' pbl-twisty-leaf'),
		attr: { type: 'button', tabindex: '-1', 'aria-label': t(open ? 'release.scope.collapse' : 'release.scope.expand') },
	});
	if (!hasKids) return;
	rowEl.setAttribute('aria-expanded', String(open));
	setIcon(twistyEl, open ? 'chevron-down' : 'chevron-right');
	twistyEl.addEventListener('click', (evt) => {
		// The row's own listener would otherwise open the note behind the fold.
		evt.stopPropagation();
		// Per-row identity for the redraw's focus restore, set BEFORE the render this
		// call triggers. `render()` cannot work it out afterwards: it identifies a
		// surviving control by a stable class, and every row's disclosure wears
		// `.pbl-twisty`, so a class-keyed restore would land on the FIRST disclosure in
		// the tree rather than this one — worse than the body it currently falls to.
		// `wireScopeKeys`'s own restore reads exactly this field.
		view.activeScopePath = row.item.file.path;
		toggleFold(view, release.path, row.item.file.path);
	});
}

function drawBadge(rowEl: HTMLElement, row: ScopeRow): void {
	const badgeText = displayType(row.item);
	if (!badgeText) return;
	const style = badgeStyleFor(badgeText);
	const badgeEl = rowEl.createSpan({ cls: 'pbl-badge' });
	if (style.icon) drawIcon(badgeEl.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
	badgeEl.addClass(style.badge);
	badgeEl.createSpan({ cls: 'pbl-badge-text', text: badgeText });
}

/**
 * The chip gets a column of its own so a row with no state leaves a gap rather than sliding
 * its neighbours left. Static, like every chip in this view: nothing here writes, so a
 * chip with a hover affordance would make the screen look editable. A CONTEXT row carries
 * no state — it renders, it parents, and that is all.
 */
function drawStateChip(rowEl: HTMLElement, row: ScopeRow): void {
	const stateEl = rowEl.createDiv({ cls: 'pbl-rel-statecol' });
	const reading = ownWorkflowReading(row.item);
	if (row.context || reading.value === null) return;
	const chipEl = stateEl.createDiv({ cls: 'pbl-state-chip pbl-state-static' });
	chipEl.createSpan({ cls: 'pbl-state-text', text: reading.value });
}

/**
 * `.pbl-meta-col` and `.pbl-progress` are `styles/columns.css`'s own vocabulary — the
 * backlog tree's rollup, reused whole rather than restyled, so one lane width and one
 * pinned bar serve both trees. The lane is drawn even when empty, so the column stays
 * straight down rows that have no rollup. A CONTEXT row carries no numbers — it renders,
 * it parents, and that is all.
 *
 * **Carried finding 2: withheld whole when progress is not computable, on `release.done`'s
 * OWN gate — never a second copy of that question.** With the gate unconfigured, a row
 * still drew `0/n` here while the header above said progress could not be computed — an
 * absence presented as a measured zero, the same defect the summary strip already avoids
 * (`renderScope.ts`'s own `release.figureUnconfigured` branch). `release.done.unconfigured`
 * is that ONE answer, computed once in `domain/releases.ts` and read here rather than
 * re-derived: `memberDone`/`memberTotal` themselves stay correct even when unconfigured
 * (every unbound workflow reads `ownWorkflowReading` as not-done, never a thrown error),
 * which is exactly why drawing them regardless would look like a real, if bleak, number.
 */
function drawRollup(rowEl: HTMLElement, row: ScopeRow, release: ReleaseRow): void {
	const metaEl = rowEl.createDiv({ cls: 'pbl-meta-col' });
	if (row.context || row.memberTotal === 0 || release.done.unconfigured) return;
	const progEl = metaEl.createDiv({
		cls: 'pbl-progress' + (row.memberDone === row.memberTotal ? ' pbl-complete' : ''),
	});
	const barEl = progEl.createDiv({ cls: 'pbl-progress-bar' });
	barEl.createDiv({ cls: 'pbl-progress-fill' }).setCssProps({
		'--pbl-progress': `${Math.round((100 * row.memberDone) / row.memberTotal)}%`,
	});
	progEl.createSpan({
		cls: 'pbl-progress-label',
		text: t('release.scope.rollup', { done: row.memberDone, total: row.memberTotal }),
	});
}

/**
 * The tree's marker STYLING with a different sentence, because a different fact is being
 * stated. `row.contextMarker` says a row is outside the base's filter, which is false of
 * every row here: `releaseScope` skips an `outsideFilter` ancestor outright, so a context
 * row on this screen is in the base and is merely not a member of this release.
 */
function drawContextMarker(rowEl: HTMLElement, row: ScopeRow): void {
	if (!row.context) return;
	const markerEl = rowEl.createSpan({
		cls: 'pbl-outside-marker',
		attr: { 'aria-label': t('release.scope.contextMarker') },
	});
	drawIcon(markerEl, 'corner-left-down');
	setTooltip(markerEl, t('release.scope.contextMarker'));
}
