import { statedEnds } from './bars';
import { isIterationType } from './itemTypes';
import { BacklogItem } from './model';
import { CivilDate } from './noteFields';
import { addDays, daysBetween, formatCivil } from './timeline';

/**
 * Where the NEXT iteration falls — the two questions the create dialog prefills from,
 * and nothing else. Every value here is a PREFILL: what gets written is what the reader
 * confirmed, never a rule re-applied at write time that they could not see.
 *
 * Its own module rather than a corner of `board.ts`, because none of it is about columns:
 * this is arithmetic over the iterations a vault holds, and the board is one caller.
 */

/**
 * The iteration a new one FOLLOWS: the one ending latest, ties broken by start and then
 * by path so the answer is total and cannot depend on the order the vault loaded in.
 *
 * Never the chosen scope, which is the tempting reading and the wrong one — creating from
 * Sprint 8 while Sprint 12 exists would silently make an iteration overlapping every
 * sprint between them.
 *
 * Read off the items the caller hands over, which is the MODEL's population: a base that
 * filters an iteration out leaves it out here too. That is the same limit the picker and
 * `Set iteration` already have, and a base hiding iterations hides the picker this is
 * reached from, so it can never be reached in the state where the limit would bite.
 */
export function previousIteration(items: BacklogItem[]): BacklogItem | null {
	let best: { item: BacklogItem; target: CivilDate; start: CivilDate | null } | null = null;
	for (const item of items) {
		if (!isIterationType(item.typeName)) continue;
		const ends = statedEnds(item);
		const target = ends.target.value;
		// A predecessor is one with an END. An undated iteration says nothing about when
		// the next one begins, and treating it as the latest would start every new sprint
		// from today whatever the plan already says.
		if (target === null) continue;
		const start = ends.start.value;
		if (best === null || later({ target, start, path: item.file.path }, { ...best, path: best.item.file.path })) {
			best = { item, target, start };
		}
	}
	return best?.item ?? null;
}

/** Whether `a` sorts after `b` — target, then start, then path, so the order is total. */
function later(
	a: { target: CivilDate; start: CivilDate | null; path: string },
	b: { target: CivilDate; start: CivilDate | null; path: string },
): boolean {
	const byTarget = daysBetween(b.target, a.target);
	if (byTarget !== 0) return byTarget > 0;
	// An absent start sorts first: a predecessor that states only its end is the weaker
	// claim of the two, and it must not displace one that states both.
	if (a.start === null || b.start === null) return b.start === null && a.start !== null;
	const byStart = daysBetween(b.start, a.start);
	return byStart !== 0 ? byStart > 0 : a.path > b.path;
}

/**
 * The span a new iteration takes: the day after the predecessor's target, running for the
 * configured length.
 *
 * **Abutting rather than overlapping** — start is the previous target PLUS ONE DAY,
 * because a target is the last day of its own iteration and two sprints sharing a day is
 * a day of work committed twice.
 *
 * **Inclusive** — target is start + length − 1, so fourteen days beginning on a Monday
 * end on the second Sunday rather than on the Monday after it.
 *
 * With no dated predecessor the start is TODAY, which is the only honest guess: there is
 * no plan to follow, and the reader is about to confirm both fields anyway.
 */
export function nextIterationDates(
	previous: BacklogItem | null,
	today: CivilDate,
	lengthDays: number,
): { start: string; target: string } {
	const after = previous === null ? null : statedEnds(previous).target.value;
	const start = after === null ? today : addDays(after, 1);
	return { start: formatCivil(start), target: formatCivil(addDays(start, lengthDays - 1)) };
}
