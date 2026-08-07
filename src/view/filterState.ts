import { BacklogItem, BacklogModel } from '../domain/model';

/**
 * The quick filter's session state: what was typed, which paths it keeps on screen,
 * and which ones it actually matched. Session state in the strictest sense — written
 * to no `.base` and no localStorage, because a search is a thing someone is doing
 * right now, not a property of the view.
 *
 * The two sets are deliberately separate. `visible` is the match PATH — a match plus
 * its ancestors and its whole subtree — and is what decides whether a row renders.
 * `matches` is the matches themselves, which is a different question and the only one
 * that can answer "which of the things under this card did the search actually find".
 * One set could not do both: everything in a match's subtree is visible, and almost
 * none of it matched.
 */
export class FilterState {
	/** The raw input text, kept verbatim so the toolbar can render what was typed. */
	text = '';
	private visible: Set<string> | null = null;
	private matches: Set<string> | null = null;

	/**
	 * True while the filter is actually narrowing — NOT merely "the box has text in
	 * it". Whitespace filters nothing, and the affordances that pause during a filter
	 * (collapse controls, tree dragging) must not pause for a stray space.
	 */
	get active(): boolean {
		return this.visible !== null;
	}

	/** Whether the filter keeps this path on screen: a match, or a relative of one. */
	keeps(path: string): boolean {
		return this.visible?.has(path) ?? false;
	}

	/** Whether the filter matched this path ITSELF, rather than keeping it for a relative. */
	matched(path: string): boolean {
		return this.matches?.has(path) ?? false;
	}

	/**
	 * Recompute against the model. Matches stay visible together with all their
	 * ancestors and descendants — the match-path contract both projections render by,
	 * which is what makes switching projections mid-filter find the same things.
	 *
	 * It has to index **everything it will be asked about**, which is not the same as
	 * the rendered forest. `model.roots` is focus-narrowed, while the Deliverables board
	 * asks about `model.deliverableResults` — built from the whole, unfocused tree
	 * precisely so no focus can hide a Deliverable there. A Deliverable outside the
	 * focused subtree was therefore never visited, so `keeps` answered false for it and
	 * the card vanished the moment anything was typed, its own title matching or not:
	 * the focus restriction that board exists to ignore, reintroduced by the filter.
	 *
	 * The second pass is additive and cannot change what the TREE shows. It only ever
	 * adds paths outside the focused forest, and those are not rendered under a focus —
	 * which is also why it does not simply walk `realRoots` instead: that would let an
	 * out-of-focus ANCESTOR's match mark its whole subtree, revealing focused rows that
	 * matched nothing. `seen` keeps it linear rather than re-walking a subtree per
	 * Deliverable already reached by the first pass.
	 */
	recompute(model: BacklogModel | null): void {
		const needle = this.text.trim().toLowerCase();
		if (!model || needle === '') {
			this.visible = null;
			this.matches = null;
			return;
		}
		const visible = new Set<string>();
		const matches = new Set<string>();
		const seen = new Set<string>();
		const markSubtree = (item: BacklogItem): void => {
			visible.add(item.file.path);
			for (const child of item.children) markSubtree(child);
		};
		const visit = (item: BacklogItem): boolean => {
			seen.add(item.file.path);
			const selfMatch = item.title.toLowerCase().includes(needle);
			if (selfMatch) {
				matches.add(item.file.path);
				markSubtree(item);
			}
			let anyMatch = selfMatch;
			for (const child of item.children) anyMatch = visit(child) || anyMatch;
			if (anyMatch) visible.add(item.file.path);
			return anyMatch;
		};
		for (const root of model.roots) visit(root);
		for (const item of model.deliverableResults) {
			if (!seen.has(item.file.path)) visit(item);
		}
		this.visible = visible;
		this.matches = matches;
	}
}
