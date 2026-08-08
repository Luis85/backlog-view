import { BacklogItem } from '../domain/model';
import { BacklogSettings } from '../domain/settings';
import { FilterScope, FilterState } from './filterState';

/**
 * Row visibility, with the quick filter itself optionally lifted. One predicate
 * answers for the narrowed board and for the population its counts are measured
 * against, so the two cannot disagree about what "in this column" means —
 * `BacklogViewHost.isRowHidden` and `isRowHiddenUnfiltered` are both this function,
 * `applyFilter` true and false. See [[Rollups and hiding finished work]].
 *
 * Lifting the filter is NOT the same as having no filter: while one is running it
 * suspends the completed-items toggle, and the population a count is "of" has to
 * keep that suspension. Measuring against the cleared board instead would count a
 * matched-but-otherwise-hidden card as "1 of 0" — each number defensible on its own
 * and the pair nonsense. What "of" means is what this filter is choosing among.
 */
export function rowHidden(
	item: BacklogItem,
	filter: FilterState,
	settings: BacklogSettings,
	applyFilter: boolean,
	scope: FilterScope,
): boolean {
	// While filtering, the filter alone decides — a match must be findable even
	// when completed items are hidden, so hiding is suspended.
	if (filter.active) {
		if (applyFilter && !filter.keeps(item.file.path, scope)) return true;
	} else if (hidingCompleted(settings) && item.subtreeDone) {
		return true;
	}
	// A context row is here only to place a result. Once nothing below it is
	// visible it is an empty scaffold, so it goes with them — whatever hid them.
	// One visible child is enough: a context child is itself subject to this rule.
	if (item.outsideFilter) return !item.children.some((child) => !rowHidden(child, filter, settings, applyFilter, scope));
	return false;
}

/**
 * True when the completed-items toggle is actively hiding fully-done subtrees.
 * The filter's own suspension of it is structural — `rowHidden` only consults this
 * on the branch where no filter is in play.
 */
function hidingCompleted(settings: BacklogSettings): boolean {
	return !settings.showCompleted && settings.stateKey !== '';
}
