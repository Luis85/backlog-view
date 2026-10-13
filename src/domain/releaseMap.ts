import { CivilDate } from './noteFields';
import { ReleaseIndex, ReleaseRow } from './releases';
import { ScopeRow } from './scopeRows';
import { DateSpan, daysBetween, timelineWindow, TimelineWindow } from './timeline';

/**
 * The release map (`docs/requirements/Every release on a map.md`): the index's rows put on
 * a time axis. Every figure a card shows is the `ReleaseRow` the list draws, so the map and
 * the list cannot disagree about one release. The one value derived here and stored
 * nowhere is a row's START, and the view draws it labelled as derived.
 */

/** How many top-level scope items a card names before it counts the rest. */
const HEADLINE_CAP = 3;

/** One release as a card: its row, and the head of its scope. */
export interface MapCard {
	release: ReleaseRow;
	/** Titles of the scope's top-level rows, in scope order, at most {@link HEADLINE_CAP}. */
	headline: string[];
	/** How many top-level rows the headline left out. */
	more: number;
}

/** A card with a place on the axis. */
export interface MapRow extends MapCard {
	/** The released date once shipped, else the target. */
	end: CivilDate;
	/**
	 * DERIVED: the end of the row before this one. Null where no lead-in is drawn — the
	 * first row, and a row that ends on the same day as the row before it.
	 */
	start: CivilDate | null;
	/** The target of a shipped release whose slip is not zero, for its tick; else null. */
	slipTarget: CivilDate | null;
}

export interface ReleaseMap {
	rows: MapRow[];
	/** In-flight releases with no readable target, in the index's own order. */
	shelf: MapCard[];
	window: TimelineWindow;
	/** The day the map was derived against, for the today line. */
	today: CivilDate;
}

/**
 * `scopeOf` is `releaseScope(...).rows` for one release path.
 *
 * ponytail: one scope walk per release, O(items × releases). One pass over the model that
 * buckets members by release is the upgrade, if a vault with many releases feels it.
 */
export function releaseMap(index: ReleaseIndex, scopeOf: (path: string) => ScopeRow[], today: CivilDate): ReleaseMap {
	const dated: Array<{ release: ReleaseRow; end: CivilDate }> = [];
	const shelf: MapCard[] = [];
	for (const release of index.rows) {
		const end = release.released.value ?? release.target.value;
		if (end === null) shelf.push(card(release, scopeOf));
		else dated.push({ release, end });
	}
	// `sort` is stable, so two equal ends keep the index's order: rank, then path.
	dated.sort((a, b) => daysBetween(b.end, a.end));
	const rows = dated.map(({ release, end }, i): MapRow => {
		const previous = i === 0 ? null : dated[i - 1].end;
		return {
			...card(release, scopeOf),
			end,
			start: previous !== null && daysBetween(previous, end) > 0 ? previous : null,
			slipTarget: release.slip !== null && release.slip !== 0 ? release.target.value : null,
		};
	});
	const spans: DateSpan[] = rows.flatMap((row) => [
		{ start: row.start ?? row.end, target: row.end },
		...(row.slipTarget === null ? [] : [{ start: row.slipTarget, target: row.slipTarget }]),
	]);
	return { rows, shelf, window: timelineWindow(spans, today), today };
}

function card(release: ReleaseRow, scopeOf: (path: string) => ScopeRow[]): MapCard {
	const roots = scopeOf(release.path).filter((row) => row.depth === 0);
	return {
		release,
		headline: roots.slice(0, HEADLINE_CAP).map((row) => row.item.title),
		more: Math.max(0, roots.length - HEADLINE_CAP),
	};
}
