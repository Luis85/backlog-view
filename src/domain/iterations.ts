import { statedEnds } from './bars';
import { isIterationType } from './itemTypes';
import { ITERATION_TYPE } from './typeVocabulary';
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
 * The `Iteration` a path names, or null — the one test for "is this a scope anything may
 * be on", asked by every surface that has a scope in hand.
 *
 * Three refusals and the third is the one that was missing: the note must be in the
 * model, it must be typed `Iteration`, and it must **not be a context row**. An excluded
 * iteration still loads as one when a hand-edited item names it as a parent, and the
 * scope picker and `Set iteration` both exclude it from what they offer — so a view that
 * accepted it was stranded on a board the picker could neither name nor re-select. Found
 * by review (Codex, PR #154).
 */
export function selectableIteration(items: Iterable<BacklogItem>, path: string | null): BacklogItem | null {
	if (path === null) return null;
	for (const item of items) {
		if (item.file.path === path) return isIterationType(item.typeName) && !item.outsideFilter ? item : null;
	}
	return null;
}

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
 * What the create dialog prefills the NAME with: the next index, then the word.
 *
 * The index is one past the highest numeric prefix any iteration already carries — read
 * off the NAMES rather than off a count, because a vault that deletes Sprint 3 must not
 * mint a second one, and a base that filters some out must not renumber over them. A
 * vault with no numbered iteration starts at 1.
 *
 * The prefix is what makes a folder of iterations sort in the order they run: a note
 * called `Iteration` sorts beside `Iteration 10` and nowhere near `2 - Iteration`. It is
 * a PREFILL like every other value in this dialog — a reader who wants `Q3 hardening`
 * types it over.
 */
export function nextIterationName(items: Iterable<BacklogItem>): string {
	let highest = 0;
	for (const item of items) {
		if (!isIterationType(item.typeName) || item.outsideFilter) continue;
		const index = leadingIndex(item.title);
		if (index > highest) highest = index;
	}
	return `${highest + 1} - ${ITERATION_TYPE}`;
}

/**
 * The note name a new iteration takes: the confirmed name, then the confirmed goal.
 *
 * `1 - Iteration - Ship the board` rather than `1 - Iteration`, so a folder of sprints
 * says what each one was FOR without opening it. The goal is the name's tail rather than
 * its head, because the numeric prefix is what makes the folder sort in the order they
 * run (`nextIterationName` above) and a goal in front of it would break that.
 *
 * Appended, never substituted: the name field is still what the reader typed, and a blank
 * goal — or a goal property nobody configured, which draws no field at all — leaves the
 * name exactly as it was.
 *
 * Capped, because a goal is free text and a file name is not: the vault refuses a name
 * over the file system's limit, so an essay typed into the goal would fail the create
 * that the name is for. Illegal characters are NOT dealt with here — `sanitizeTitle`
 * (`storage/createNote.ts`) is the one place a title becomes a file name, and this layer
 * may not reach it.
 */
export function iterationNoteName(name: string, goal: string): string {
	const tail = goal.trim().slice(0, GOAL_NAME_MAX);
	return tail === '' ? name : `${name} - ${tail}`;
}

/** How much of a goal a note name carries. A file name is limited; a goal is not. */
const GOAL_NAME_MAX = 60;

/**
 * The number a title LEADS with, or 0 for one that leads with none. Deliberately blind to
 * a number anywhere else: `Sprint 12 - review of 3` leads with nothing, and reading the
 * `3` out of it would number the next iteration from a word.
 */
function leadingIndex(title: string): number {
	const found = /^\s*(\d+)/.exec(title);
	return found === null ? 0 : Number(found[1]);
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
