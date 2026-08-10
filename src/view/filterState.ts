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
 * **Descending and MATCHING are two questions, and `member` answers only the second.**
 * The walk goes everywhere `item.children` leads, because that is the real tree and a row
 * this projection draws can sit below one it does not — a `Deliverable` under a
 * `Test case` is a card on the Deliverables board, and a walk that stopped at the catalog
 * never reaches it. But a non-member's TITLE is not a match here, and nothing propagates
 * from it: a needle hitting a `Test case` under a `PBI` must not keep that PBI on the plan
 * with nothing on screen matching, and must not surface the case on a Deliverable's card,
 * where `hiddenMatches` reads this very set.
 *
 * Both halves were learned by getting them backwards in turn. Guarding the descent lost
 * the nested `Deliverable`; guarding neither exposed the nested `Test case`. Neither is a
 * special case of the other, and one predicate placed on the right line answers both.
 */
function indexMatches(roots: BacklogItem[], needle: string, member: (item: BacklogItem) => boolean): MatchIndex {
	const visible = new Set<string>();
	const matches = new Set<string>();
	const markSubtree = (item: BacklogItem): void => {
		visible.add(item.file.path);
		for (const child of item.children) markSubtree(child);
	};
	const visit = (item: BacklogItem): boolean => {
		const selfMatch = member(item) && item.title.toLowerCase().includes(needle);
		if (selfMatch) {
			matches.add(item.file.path);
			markSubtree(item);
		}
		let anyMatch = selfMatch;
		for (const child of item.children) anyMatch = visit(child) || anyMatch;
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
		const member = projectionMember(projection);
		this.focused = indexMatches(roots, needle, member);
		// The `whole` index takes the SAME membership rule and differs only in where it
		// starts: the whole tree rather than this projection's forest, because the
		// Deliverables board's population is deliberately focus-immune. Membership still
		// applies — a `Test case` under a `Deliverable` must not put that card back on
		// screen — and `indexMatches` descends past both regardless, which is what reaches
		// a `Deliverable` nested under a test.
		this.whole = indexMatches(model.realRoots, needle, member);
	}
}
