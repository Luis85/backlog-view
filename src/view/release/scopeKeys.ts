import type { ReleaseView } from './releaseView';
import { ScopeDraw, toggleFold } from './scopeTree';

/**
 * The scope tree's keyboard: one tab stop on the container and a roving
 * `aria-activedescendant`, which is what `src/view/CLAUDE.md` requires of a composite
 * widget — a tree whose every row was a stop would take one Tab per item to cross.
 *
 * **Its own controller rather than `view/selection.ts`.** That module is built around a
 * `BacklogViewHost` and the projections' own selection, so reusing it would mean
 * satisfying a host interface in order to withhold most of it — the same call
 * `renderScope.ts` already made about `render/rows.ts`, for the same reason.
 *
 * The row ids are minted per view instance, because two saved views can sit in split
 * panes over the same notes and `aria-activedescendant` resolves a DOCUMENT id.
 *
 * `rowEls` is `drawScopeTree`'s own path → element index, built while it draws each
 * row rather than queried back out of `treeEl` here: `src/view/CLAUDE.md`'s `TREE_SCAN`
 * bans exactly that scan, on the tree's own stated cost reason — a row is reached by
 * lookup, and `show()` below runs on every arrow key, not once per render.
 *
 * `releasePath` is `release.path` from the ONE caller, `renderScope.ts` — a plain
 * argument rather than read back off `view.pickedPath` in here, which would need a
 * runtime null guard for a case the caller already rules out: `renderScope` reaches this
 * call only once a release is open, the same guarantee `drawScopeTree` already ran on
 * moments earlier in that same sequence. `rows` and `rowEls` carry the identical
 * guarantee — this module has one call site, and `show()` below trusts what it draws
 * from rather than re-checking it, the same "look for the dead branch before writing the
 * test" the coverage config states for exactly this shape of guard. `ScopeDraw` itself is defined
 * in `scopeTree.ts`, not here — that module has no reason to import this one back, which
 * is what keeps the pair a DAG (`renderScope.ts` calls `drawScopeTree` and this function
 * in sequence) rather than the cycle `npm run analyze` refuses.
 */
export function wireScopeKeys(view: ReleaseView, treeEl: HTMLElement, releasePath: string, draw: ScopeDraw): void {
	const { rows, kids, rowEls, folded } = draw;
	let active = 0;
	// The one element currently marked, cleared by reference rather than by a fresh scan
	// of every row — the same reason `rowEls` replaces a `querySelector` per lookup.
	let selectedEl: HTMLElement | null = null;
	const show = (): void => {
		// `rows` is never empty — the top-level row can never be hidden by a fold — and
		// `rowEls` is built from that same array, so both reads below always hit.
		const row = rows[active];
		if (selectedEl) {
			selectedEl.removeAttribute('aria-selected');
			selectedEl.classList.remove('pbl-selected');
		}
		const el = rowEls.get(row.item.file.path)!;
		el.setAttribute('aria-selected', 'true');
		// The ARIA half alone is correct for a screen reader and invisible to everyone
		// else: `styles/tree.css` paints `.pbl-row.pbl-selected` and
		// `.pbl-tree:focus-visible.pbl-has-selection`, and neither rule fires without
		// these two classes — `view/selection.ts`'s own pattern for the same widget
		// shape (`selectItem`/`syncActiveDescendant`), borrowed here rather than the
		// module itself, which this controller has its own header explaining why not.
		el.classList.add('pbl-selected');
		treeEl.toggleClass('pbl-has-selection', true);
		selectedEl = el;
		treeEl.setAttribute('aria-activedescendant', el.id);
		view.activeScopeFile = row.item.file;
		// `content-visibility: auto` on a row means a skipped row has no layout box, so a
		// row reached by the keyboard has to be scrolled to rather than assumed visible.
		el.scrollIntoView({ block: 'nearest' });
	};
	const moveTo = (next: number): void => {
		if (next < 0 || next >= rows.length) return;
		active = next;
		show();
	};
	treeEl.addEventListener('keydown', (evt) => {
		const row = rows[active];
		// `draw.folded` — the fold set `drawScopeTree` already computed for THIS render —
		// never a fresh `foldedPaths` call here: this listener is rebuilt on every render
		// (`toggleFold`/`setHideDone` both call `view.render()`), so the value cannot go
		// stale between renders, and asking again on every keydown was a full
		// `loadViewState` JSON parse and validation paid on every ArrowDown of a
		// key-repeat rather than once per render. See `ScopeDraw.folded`'s own comment.
		const open = !folded.has(row.item.file.path);
		// Asked of the RENDERED tree, never of the fold set. A path can sit in
		// `folds.collapsed` long after the row it names has lost every scoped child — a
		// refresh that moved them, or hide-done taking them off screen — and reading fold
		// membership as evidence of children then makes a leaf answer as a parent, so
		// ArrowRight toggles a phantom fold instead of doing nothing. `drawScopeTree`
		// already knows which rows it drew a disclosure on; it passes that set in.
		const hasKids = kids.has(row.item.file.path);
		switch (evt.key) {
			case 'ArrowDown':
				moveTo(active + 1);
				break;
			case 'ArrowUp':
				moveTo(active - 1);
				break;
			case 'ArrowRight':
				// Step IN, never step NEXT. A leaf has nothing to enter, and moving here
				// would make one key mean two things depending on where it landed.
				if (hasKids && !open) toggleFold(view, releasePath, row.item.file.path);
				else if (hasKids) moveTo(active + 1);
				else return;
				break;
			case 'ArrowLeft':
				// Fold what is open; only a CLOSED row steps out, to the nearest shallower
				// row above it — which is its parent, since the walk is pre-order.
				if (hasKids && open) toggleFold(view, releasePath, row.item.file.path);
				else {
					const up = rows.slice(0, active).reduce((found, r, i) => (r.depth < row.depth ? i : found), -1);
					if (up === -1) return;
					moveTo(up);
				}
				break;
			case 'Home':
				moveTo(0);
				break;
			case 'End':
				moveTo(rows.length - 1);
				break;
			case 'Enter':
			case ' ':
				view.opener.open(view.openContext(), row.item, evt);
				break;
			default:
				// Unhandled keys reach the pane — no `preventDefault` on this path.
				return;
		}
		evt.preventDefault();
	});
	treeEl.addEventListener('focus', show);
	// The active row SURVIVES the re-render, and the tree takes focus back when it was the
	// thing focused before. `toggleFold` calls `view.render()`, which `empty()`s `viewEl` —
	// detaching the focused tree and building this controller again from scratch. Without
	// these two lines, pressing Right to unfold a row moves focus to the body and drops the
	// active row to the first: the next arrow key reaches no listener at all, and a
	// keyboard reader is stranded one press into the tree. The view's own scroll restore
	// exists for the same re-render and is not enough, because focus is not scroll.
	// Matched on the FILE, never on a captured path: Obsidian mutates the one `TFile` in
	// place on a rename, so renaming the active member (or a folder above it) leaves this
	// still naming the row the reader is on, where a path comparison found nothing and
	// dropped them to the first row. See `ReleaseView.activeScopeFile`.
	const wanted = view.activeScopeFile;
	const restored = wanted === null ? -1 : rows.findIndex((r) => r.item.file === wanted);
	// A row that has GONE must not take the keyboard with it. A refresh can drop the active
	// member out of the scope — its membership edited elsewhere, the base's filter narrowed
	// — and returning here without focusing would leave the reader Tabbing back in, which is
	// the same stranding the restore exists to prevent. Falling back to the first row is the
	// honest answer: the row they were on is not there to return to.
	if (restored !== -1 || (view.scopeHadFocus && rows.length > 0)) {
		active = restored === -1 ? 0 : restored;
		show();
		if (view.scopeHadFocus) treeEl.focus();
	}
}
