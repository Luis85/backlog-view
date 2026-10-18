import { bucketOf } from './board';
import { BacklogItem } from './model';
import { CivilDate } from './noteFields';
import { assigneeName } from './readItems';
import { BacklogSettings } from './settings';
import { daysBetween } from './timeline';
import { compareText } from '../i18n/t';

/**
 * What the daily asks of an iteration: where the timebox is, how far the work has got,
 * who holds it, and which cards need a word. Pure — `today` is an argument, because this
 * layer reads no clock and a test pins a day instead of faking one.
 */

export type Timebox =
	| { kind: 'none' }
	| { kind: 'startOnly'; start: CivilDate }
	| { kind: 'targetOnly'; target: CivilDate }
	| { kind: 'upcoming'; start: CivilDate; target: CivilDate; startsIn: number }
	| { kind: 'running'; start: CivilDate; target: CivilDate; day: number; length: number; left: number }
	| { kind: 'ended'; start: CivilDate; target: CivilDate; endedAgo: number };

/**
 * Both ends count, so a one-day box has length 1. A target before its start is an invalid
 * span and reads as the target alone: it gets no day count.
 */
export function timebox(start: CivilDate | null, target: CivilDate | null, today: CivilDate): Timebox {
	if (start !== null && target !== null && daysBetween(start, target) >= 0) {
		if (daysBetween(today, start) > 0) return { kind: 'upcoming', start, target, startsIn: daysBetween(today, start) };
		if (daysBetween(target, today) > 0) return { kind: 'ended', start, target, endedAgo: daysBetween(target, today) };
		return {
			kind: 'running',
			start,
			target,
			day: daysBetween(start, today) + 1,
			length: daysBetween(start, target) + 1,
			left: daysBetween(today, target),
		};
	}
	if (target !== null) return { kind: 'targetOnly', target };
	if (start !== null) return { kind: 'startOnly', start };
	return { kind: 'none' };
}

/** The bucket an item reads into — the reading `iterationBuckets` uses. */
function bucketFor(item: BacklogItem, settings: BacklogSettings) {
	return bucketOf(settings.stateKey ? item.stateValue : null, settings);
}

export interface IterationProgress {
	open: number;
	inProgress: number;
	resolved: number;
	total: number;
}

/** Counts the whole population, hidden rows included: progress is about the sprint, not the screen. */
export function iterationProgress(population: BacklogItem[], settings: BacklogSettings): IterationProgress {
	const progress: IterationProgress = { open: 0, inProgress: 0, resolved: 0, total: 0 };
	for (const item of population) {
		if (item.outsideFilter) continue;
		progress[bucketFor(item, settings)]++;
		progress.total++;
	}
	return progress;
}

/** `name` null is the Unassigned group, whose key is ''. */
export interface BoardPerson {
	key: string;
	name: string | null;
	count: number;
}

/** A resolved assignee is keyed by its note's path, an unresolved one by the text written. */
export function personKey(item: BacklogItem): string {
	return item.assigneeEntry?.file?.path ?? item.assigneeEntry?.raw ?? '';
}

/** People by name, Unassigned last and only when somebody is in it. */
export function boardPeople(population: BacklogItem[]): BoardPerson[] {
	const byKey = new Map<string, BoardPerson>();
	for (const item of population) {
		if (item.outsideFilter) continue;
		const key = personKey(item);
		const person = byKey.get(key) ?? { key, name: key === '' ? null : assigneeName(item), count: 0 };
		person.count++;
		byKey.set(key, person);
	}
	const named = [...byKey.values()].filter((p) => p.key !== '');
	named.sort((a, b) => compareText(a.name ?? '', b.name ?? ''));
	const unassigned = byKey.get('');
	return unassigned ? [...named, unassigned] : named;
}

export interface CardSignals {
	blockedBy: BacklogItem | null;
	overdueDays: number;
}

/** A context row or a resolved item has nothing to flag. */
export function cardSignals(item: BacklogItem, settings: BacklogSettings, today: CivilDate): CardSignals {
	if (item.outsideFilter || bucketFor(item, settings) === 'resolved') return { blockedBy: null, overdueDays: 0 };
	const blockedBy = item.prerequisites.find((p) => bucketFor(p, settings) !== 'resolved') ?? null;
	const target = item.plannedTarget.value;
	return { blockedBy, overdueDays: target === null ? 0 : Math.max(0, daysBetween(target, today)) };
}
