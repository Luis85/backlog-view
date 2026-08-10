import { BacklogItem, BacklogModel } from '../domain/model';
import { Projection } from './host';
import { FilterScope, projectionMember, projectionPopulation } from './projection';

/**
 * The quick filter's session state: what was typed, which paths it keeps on screen,
 * and which ones it actually matched. Session state in the strictest sense — written
 * to no `.base` and no localStorage, because a search is a thing someone is doing
 * right now, not a property of the view.
 */

/**
 * One filtered reading of one forest. The two sets are deliberately separate:
 * `visible` is the match PATH — a match plus its ancestors and its whole subtree — and
 * is what decides whether a row renders; `matches` is the matches themselves, which is
 * a different question and the only one that can answer "which of the things under this
 * card did the search actually find". One set could not do both: everything in a
 * match's subtree is visible, and almost none of it matched.
 */
interface MatchIndex {
	visible: Set<string>;
	matches: Set<string>;
}


/**
 * The match-path contract, over whatever forest it is handed. The whole rule, stated
 * once — every scope is this function applied to a different set of roots, so a change
 * to what "matching" means lands on both at the same time.
 *
 * **The roots are half of "this projection's forest"; `member` is the other half.** The
 * walk below descends `item.children`, which is the REAL tree and holds rows this
 * projection does not draw — so handing it the right roots and letting it walk through
 * everything under them indexes the wrong thing: a needle matching a `Test case` beneath
 * a `PBI` marks that PBI and its whole ancestor chain visible, and the plan then shows
 * three rows with nothing on screen matching and the text still in the box. Stopping at a
 * non-member loses nothing, because a member below one is a root of this forest in its own
 * right and is visited through that.
 */
function indexMatches(roots: BacklogItem[], needle: string, member: (item: BacklogItem) => boolean): MatchIndex {
	const visible = new Set<string>();
	const matches = new Set<string>();
	const markSubtree = (item: BacklogItem): void => {
		visible.add(item.file.path);
		for (const child of item.children) if (member(child)) markSubtree(child);
	};
	const visit = (item: BacklogItem): boolean => {
		const selfMatch = item.title.toLowerCase().includes(needle);
		if (selfMatch) {
			matches.add(item.file.path);
			markSubtree(item);
		}
		let anyMatch = selfMatch;
		for (const child of item.children) if (member(child)) anyMatch = visit(child) || anyMatch;
		if (anyMatch) visible.add(item.file.path);
		return anyMatch;
	};
	for (const root of roots) visit(root);
	return { visible, matches };
}

export class FilterState {
	/** The raw input text, kept verbatim so the toolbar can render what was typed. */
	text = '';
	private focused: MatchIndex | null = null;
	private whole: MatchIndex | null = null;

	/**
	 * True while the filter is actually narrowing — NOT merely "the box has text in
	 * it". Whitespace filters nothing, and the affordances that pause during a filter
	 * (collapse controls, tree dragging) must not pause for a stray space.
	 */
	get active(): boolean {
		return this.focused !== null;
	}

	/** Whether the filter keeps this path on screen: a match, or a relative of one. */
	keeps(path: string, scope: FilterScope): boolean {
		return this.index(scope)?.visible.has(path) ?? false;
	}

	/** Whether the filter matched this path ITSELF, rather than keeping it for a relative. */
	matched(path: string, scope: FilterScope): boolean {
		return this.index(scope)?.matches.has(path) ?? false;
	}

	private index(scope: FilterScope): MatchIndex | null {
		return scope === 'whole' ? this.whole : this.focused;
	}

	/**
	 * Recompute against the model: one index per scope, each the same rule over its own
	 * forest. Matches stay visible together with all their ancestors and descendants,
	 * which is what makes switching projections mid-filter find the same things.
	 *
	 * With no focus the two forests ARE the same one, so the second index is the first
	 * rather than a second walk — and the scopes coincide, which is exactly right: a
	 * distinction that only exists under a focus should cost nothing without one.
	 */
	recompute(model: BacklogModel | null, projection: Projection): void {
		const needle = this.text.trim().toLowerCase();
		if (!model || needle === '') {
			this.focused = null;
			this.whole = null;
			return;
		}
		// The SAME forest the renderer draws, which is the projection-roots rule reaching
		// one more consumer rather than a rule of its own — and the consumer where being
		// wrong looks most like a working feature, since rows do appear and one of them
		// did match something. Indexed from `model.roots` regardless, a needle matching a
		// hidden `PBI` marks its whole subtree, so a `Test case` beneath it stays on
		// screen in the catalog while nothing in the catalog matched at all; the inverse
		// happens in the plan.
		const roots = projectionPopulation(projection, model).roots;
		this.focused = indexMatches(roots, needle, projectionMember(projection));
		// The `whole` index walks the WHOLE tree and is deliberately unguarded, which is
		// not an oversight beside the line above it. Its one consumer is the Deliverables
		// board, whose population is decided by TYPE elsewhere (`deliverableResults`) — so
		// membership is not this index's question, and a catalog row can never be a card
		// there to be let in by the omission. Guarding it costs a real case instead: a
		// `Deliverable` nested under a `Test case` IS on that board, and a walk stopping at
		// the catalog path never reaches it, so an exact-title filter hid a card on screen.
		this.whole = indexMatches(model.realRoots, needle, () => true);
	}
}
