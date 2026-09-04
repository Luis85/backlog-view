import { setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseRow } from '../../domain/releases';
import { childRows, rowsAfterHideDone, ScopeRow, siblingPlaces, visibleRows } from '../../domain/scopeRows';
import { riskValuesOf } from '../../domain/releaseReadiness';
import { drawIcon } from '../render/icons';
import { foldedPaths, scopeFlag, setAllFolds, setScopeFlag, toggleFold } from '../scopeFolds';
import { TreeDraw } from '../scopeKeys';
import { drawScopeBadge, drawScopeStateChip, wireRowOpen } from '../scopeRow';
import { drawReadinessChips } from './scopeChips';
import { RELEASE_FOLD } from '../viewState';
import { uniqueElementId } from '../selection';

/**
 * The scope tree's own rows: the disclosure and the two row figures the design shows —
 * split out of `renderScope.ts` (Task 3) once that module's own header grew a fourth
 * reason to change on top of the header and the two empty states it still owns.
 * `renderScope.ts` calls {@link drawScopeTree} for the tree and keeps everything else.
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
 * `RELEASE_FOLD` itself lives in `storage/foldKeys.ts`, not here (and is re-exported by
 * `view/viewState.ts`, which is where this module still names it): the backlog view's
 * own `ViewState` has to recognise the prefix too, since a saved view's TYPE can change
 * while its stored identity does not, and a `.base` view switched from this one to the
 * backlog view carries whatever this module wrote under that identity — see that
 * constant's own comment for what silently broke before it moved.
 *
 * The fold set itself, and the hide-done flag beside it, are `view/scopeFolds.ts`'s own
 * (Task 5 of [[Assigned work in the sidebar]]): this module asks the identical questions
 * per release that the assigned-work tree asks per person, and the whole of what varied
 * was the key prefix — `releaseFoldedPaths`, `toggleReleaseFold` and `setAllReleaseFolds`
 * below are each a one-line call into that shared module with `RELEASE_FOLD` and the open
 * release's path. Named apart from `scopeFolds.ts`'s own `foldedPaths`/`toggleFold`/
 * `setAllFolds` rather than re-exported under those names (fix round 1, 2026-08-31):
 * `hideDoneOn`/`setHideDone` already took this shape for the flag pair, and a fallow
 * duplicate-export finding is what made the fold trio follow suit — two files exporting
 * the same name is the fingerprint of an incomplete extraction even where every caller
 * names an explicit path and no collision is reachable today.
 */

/**
 * The paths folded shut in the OPEN release's scope. See `view/scopeFolds.ts`'s own
 * `foldedPaths` for the shape and the identity/session-fallback split.
 */
export function releaseFoldedPaths(view: ReleaseView, releasePath: string): Set<string> {
	return foldedPaths(view, RELEASE_FOLD, releasePath);
}

/**
 * Flips one row's fold and redraws — `view/scopeFolds.ts`'s own `toggleFold`, scoped to
 * this release.
 */
export function toggleReleaseFold(view: ReleaseView, releasePath: string, path: string): void {
	toggleFold(view, RELEASE_FOLD, releasePath, path);
}

/**
 * Fold or unfold every row THIS scope drew — `view/scopeFolds.ts`'s own `setAllFolds`,
 * scoped to this release. See that function's own comment for why a leaf gets no key and
 * why `rows` must be the caller's FULL scope rather than a hide-done-filtered subset.
 */
export function setAllReleaseFolds(view: ReleaseView, releasePath: string, rows: ScopeRow[], folded: boolean): void {
	setAllFolds(view, RELEASE_FOLD, releasePath, rows, folded);
}

/**
 * Whether the scope screen is hiding finished subtrees — `view/scopeFolds.ts`'s own
 * `scopeFlag`, asked with this screen's own preference key.
 */
export function hideDoneOn(view: ReleaseView): boolean {
	return scopeFlag(view, 'releaseHideDone');
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
 *
 * **A third conjunct, since Task 11: `view.criterionFilter === null`.** The PREFERENCE is
 * untouched — a reader who turned hiding on keeps it on once the narrowing clears — and
 * only its EFFECT pauses while a criterion is narrowed. A member can be DONE and still be
 * outstanding on a criterion (a finished item nobody estimated), so hiding it while the
 * reader is being shown exactly the rows failing that criterion is the dead end this whole
 * feature exists to remove.
 */
export function effectiveHideDone(view: ReleaseView, release: ReleaseRow): boolean {
	return hideDoneOn(view) && !release.done.unconfigured && view.criterionFilter === null;
}

/** Flip the toggle and redraw — `view/scopeFolds.ts`'s own `setScopeFlag`. */
export function setHideDone(view: ReleaseView, next: boolean): void {
	setScopeFlag(view, 'releaseHideDone', next);
}

/**
 * `TreeDraw` plus the one thing this tree's own draw computes that the shared shape has
 * no field for — the risk vocabulary the row menu's `Set risk` needs too (Task 8 review
 * finding 2). Kept as an EXTENSION of the shared type here, in this release-only module,
 * rather than added to `TreeDraw` itself in `scopeKeys.ts`: that type is drawn by the
 * my-work tree as well, which has no risk chip and nothing to put in the field, so a
 * shared type carrying a release-only value would either force a meaningless empty array
 * out of the other producer or go optional and need a null check at every reader here.
 */
export interface ScopeTreeDraw extends TreeDraw {
	readonly riskChoices: string[];
}

/**
 * What `scopeKeys.ts`'s `wireScopeKeys` needs of a finished draw — `TreeDraw`, defined in
 * that shared module rather than here (Task 7 of [[Assigned work in the sidebar]] moved
 * it out of this file, where it used to be `ScopeDraw`): `scopeTree.ts` has no reason to
 * import `scopeKeys.ts` back and neither does `scopeKeys.ts` import this file — the type
 * lives below both, so `drawScopeTree` returns it and `renderScope.ts` (which already
 * imports both tree modules) wires the keyboard as a second step, which is what keeps the
 * two release-tree modules a DAG rather than a cycle `npm run analyze` refuses.
 *
 * Returns `ScopeTreeDraw`, not the bare `TreeDraw`: `wireScopeKeys` only asks for the
 * shared shape and is handed the wider object structurally, while `renderScope.ts` reads
 * `draw.riskChoices` straight off it for `wireScopeCreate` and `wireReadinessChips` —
 * computed exactly ONCE, here, rather than a second call re-walking the same rows.
 */
export function drawScopeTree(view: ReleaseView, release: ReleaseRow, rows: ScopeRow[]): ScopeTreeDraw {
	// Named by the release, so a reader arriving at the tree hears which one it is. The
	// name is vault content rather than text — it goes nowhere near the catalog.
	// `tabindex="0"` makes the CONTAINER the tab stop — a composite widget's own rule
	// (`src/view/CLAUDE.md`) — with `scopeKeys.ts` moving a roving selection inside it.
	const treeEl = view.viewEl.createDiv({
		cls: 'pbl-tree',
		attr: { role: 'tree', 'aria-label': release.name, tabindex: '0' },
	});
	const folded = releaseFoldedPaths(view, release.path);
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
	// Computed ONCE here, never per row: a per-row union would re-walk the members on every
	// row drawn. Over `afterHide` (hide-done applied, folding not) rather than `visible`, so
	// a folded-away member's risk value still keeps the column offered on the rows left on
	// screen — a column that could vanish as a side effect of a collapse would be exactly
	// the columns-shift-per-row hazard the tree's own layout rule refuses.
	const riskChoices = computeRiskChoices(view, afterHide);
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
				riskChoices,
			}),
		);
	}
	// `visible`, never `rows`: arrowing onto a row a fold hid would move the active
	// descendant to an element that is not in the DOM. `withKids` is the rendered tree's
	// own answer too — see `scopeKeys.ts`'s own comment on why the fold set cannot stand in.
	return { treeEl, rows: visible, kids: withKids, rowEls, folded, riskChoices };
}

/** A row's place in its sibling group plus its own fold state — one bag rather than four
 *  positional booleans and numbers, which is what pushed `drawRow` over the parameter
 *  budget the moment folding joined `pos`/`count`. */
interface RowPlace {
	pos: number;
	count: number;
	hasKids: boolean;
	open: boolean;
	/** The risk vocabulary this draw offers a chip against — one array, shared by every row,
	 *  computed once in `drawScopeTree` rather than re-walked per row. Carried here rather
	 *  than as a sixth `drawRow` parameter: that function is already at the `max-params`
	 *  budget, which is `RowPlace`'s own reason for existing. */
	riskChoices: string[];
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

	wireRowOpen(view, rowEl, row);

	drawScopeBadge(rowEl, row);

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

	drawScopeStateChip(rowEl, row, 'pbl-rel-statecol');
	drawReadinessChips(view.app, rowEl, row, view.settings, place.riskChoices);
	drawRollup(rowEl, row, release);
	return rowEl;
}

/**
 * The union `drawReadinessChips` gates the risk column's OFFER on: what this vault has
 * declared critical or addressed, plus whatever value the members themselves actually
 * carry — the same "declared or observed" shape the roadmap's own horizon vocabulary
 * keeps, so a value nobody named in the options is still enough to draw the column.
 *
 * Unconfigured whole on no risk key, matching `drawReadinessChips`'s own gate: a walk over
 * every member's frontmatter for a key this view never reads would be work spent to answer
 * a question the chip has already refused.
 *
 * Not exported: `drawScopeTree` is the one caller, and hands the result out on
 * `ScopeTreeDraw.riskChoices` rather than a second module re-deriving it (Task 8 review
 * finding 2) — see that field's own comment.
 */
function computeRiskChoices(view: ReleaseView, rows: ScopeRow[]): string[] {
	const settings = view.settings;
	if (settings.riskKey === '') return [];
	const values = new Set<string>();
	for (const value of settings.criticalRiskValues) values.add(value);
	for (const value of settings.addressedRiskValues) values.add(value);
	for (const row of rows) {
		if (row.context) continue;
		for (const value of riskValuesOf(view.app, row.item, settings).values) values.add(value);
	}
	return [...values];
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
		view.activeRowFile = row.item.file;
		toggleReleaseFold(view, release.path, row.item.file.path);
	});
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
