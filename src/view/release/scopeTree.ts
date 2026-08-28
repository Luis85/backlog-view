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
 * `RELEASE_FOLD` itself now lives in `view/viewState.ts`, not here: the backlog view's
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
 * Neither the rename walk over `folds.collapsed` (`notePath` in `view/viewState.ts`) nor
 * `renameScoped`'s in-memory one reaches these keys — the former strips back to a bare
 * path at the FIRST NUL it finds, never a second one, so a key shaped
 * `foldPrefix(release) + member` reads as belonging to a note named by everything after
 * that first NUL, which is neither path; this view holds no `ViewStateController` for the
 * latter to migrate at all. Renaming a member, or the open release itself, therefore
 * reopens the row rather than migrating its fold — the accepted cost stated at the call
 * site rather than built around: duplicating `notePath`'s NUL-splitting and this scope's
 * own path-plus-member key into `storage/` would buy a migration for a fold set that
 * already forgets nothing worse than "reopened".
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

/** Fold or unfold every row THIS scope drew, without touching another release's set —
 *  `rows` is what makes "exactly this scope" precise rather than "everything". */
export function setAllFolds(view: ReleaseView, releasePath: string, rows: ScopeRow[], folded: boolean): void {
	writeFolds(view, releasePath, folded ? new Set(rows.map((row) => row.item.file.path)) : new Set());
}

/**
 * The rows a fold set leaves on screen, in the same pre-order the walk produced.
 *
 * A row is hidden by an ANCESTOR being folded, never by its own state, so the test is
 * "is any open fold shallower than me still in force" — the same shape `siblingPlaces`
 * uses to close a sibling group, and for the same reason: `rows` carries its own depth
 * and nothing else says who a row's parent was.
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
	const withKids = childRows(rows);
	const visible = visibleRows(rows, folded);
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
	return { treeEl, rows: visible, kids: withKids, rowEls };
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

	// A row is a target again — it opens its note. Unconditional, including on a context
	// row: opening is not a write, and a context ancestor is a real note the reader may
	// still want to read even though this screen refuses every action that would edit it.
	rowEl.addEventListener('click', (evt) => view.opener.open(view.openContext(), row.item, evt));
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

	drawStateChip(rowEl, row);
	drawRollup(rowEl, row);
	drawContextMarker(rowEl, row);
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
 */
function drawRollup(rowEl: HTMLElement, row: ScopeRow): void {
	const metaEl = rowEl.createDiv({ cls: 'pbl-meta-col' });
	if (row.context || row.memberTotal === 0) return;
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
