import { Menu } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { CivilDate, readDate } from '../../domain/noteFields';
import { axisKeyFor, horizonMenuValues } from '../../domain/settings';
import { computeHorizonWrites, computeScheduleWrites, SchedulePlan } from '../../domain/writePlan';
import { SchedulePromptModal } from '../../ui/prompts';

/**
 * Setting the roadmap's placement properties from a row — the horizon it sits in and
 * the dates it is planned for — in whichever projection the row is in.
 *
 * These are the same writes the roadmap's own gestures will plan, reached from the
 * item rather than from the mode: the projections share one model, one gate and one
 * undo history, so a property that could only be set inside roadmap mode would be a
 * projection disagreeing about what the backlog can do. Everything here plans in
 * `domain/writePlan.ts` and applies through `host.applySafely`, which is what makes
 * a context row unwritable by construction rather than by remembering.
 */

/** True when the note carries either configured date key — what Unschedule can take away. */
export function carriesDates(item: BacklogItem): boolean {
	return item.axisKeys.start || item.axisKeys.target;
}

/**
 * The horizons this row may be given: the declared vocabulary plus the values the
 * results already carry (the buckets the roadmap draws), with the item's own on the
 * end when it is on neither list — a menu that cannot show what the item *is* loses
 * it on the next pick.
 */
function horizonChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	const values = horizonMenuValues(host.settings, host.model?.observedHorizons ?? []);
	const current = item.horizon.value;
	if (current === null || values.some((v) => v.toLowerCase() === current.toLowerCase())) return values;
	return [...values, current];
}

function isCurrentHorizon(item: BacklogItem, value: string): boolean {
	const current = item.horizon.value;
	return current !== null && current.toLowerCase() === value.toLowerCase();
}

/** The Set horizon list: every bucket this base can place a row in, and the way out of them. */
export function addHorizonItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	for (const value of horizonChoices(host, item)) {
		menu.addItem((si) => {
			si.setTitle(value).onClick(() => void host.applySafely(computeHorizonWrites(item, value)));
			if (isCurrentHorizon(item, value)) si.setChecked(true);
		});
	}
	// Offered only while the note carries the key, so no entry here can write nothing —
	// and it removes the key rather than blanking it: untriaged is a state a note
	// returns to, whereas an empty value would render as a bucket named nothing.
	if (!item.axisKeys.horizon) return;
	menu.addSeparator();
	menu.addItem((si) =>
		si
			.setTitle('Clear horizon')
			.setIcon('eraser')
			.onClick(() => void host.applySafely(computeHorizonWrites(item, null))),
	);
}

/** `YYYY-MM-DD`, the shape the prompt asks for and the one every reader here accepts. */
function formatCivil(date: CivilDate): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/**
 * The ends the entry asks for: only the configured ones, each prefilled with the date
 * the note states. A value the reader refuses arrives BLANK rather than as itself —
 * the field asks for a date and that is not one — so confirming replaces it instead
 * of carrying the unreadable value back to disk.
 */
function scheduleFields(host: BacklogViewHost, item: BacklogItem): { field: string; name: string; value: string }[] {
	const ends = [
		{ field: 'start', reading: item.plannedStart },
		{ field: 'target', reading: item.plannedTarget },
	] as const;
	const fields = [];
	for (const end of ends) {
		const key = axisKeyFor(host.settings, end.field);
		if (key === '') continue;
		fields.push({ field: end.field, name: key, value: end.reading.value ? formatCivil(end.reading.value) : '' });
	}
	return fields;
}

/**
 * Why an entry cannot be written, or null. The two refusals are the two the timeline
 * already makes about a note's own dates ([[Bars from two dates]]): a value that
 * spells no calendar date, and a target before its start. A prompt that accepted
 * either would be the view creating the plan it refuses to guess at.
 */
function validateSchedule(values: Record<string, string>): string | null {
	const parsed: Record<string, CivilDate | null> = {};
	for (const [field, value] of Object.entries(values)) {
		if (value === '') {
			parsed[field] = null;
			continue;
		}
		const reading = readDate(value);
		if (reading.value === null) return `"${value}" is not a date. Use YYYY-MM-DD.`;
		parsed[field] = reading.value;
	}
	const start = parsed.start ?? null;
	const target = parsed.target ?? null;
	if (start && target && compareCivil(target, start) < 0) return 'The target date cannot be before the start date.';
	return null;
}

function compareCivil(a: CivilDate, b: CivilDate): number {
	return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** The plan an entry means: a date per configured end, '' meaning that end goes. */
function planFrom(values: Record<string, string>): SchedulePlan {
	const plan: SchedulePlan = {};
	for (const field of ['start', 'target'] as const) {
		const value = values[field];
		if (value === undefined) continue;
		plan[field] = value === '' ? null : value;
	}
	return plan;
}

/** Ask for the item's planned dates, then write the ends that actually changed. */
export function promptSchedule(host: BacklogViewHost, item: BacklogItem): void {
	new SchedulePromptModal(host.app, {
		heading: `Schedule "${item.title}"`,
		description: 'Dates as YYYY-MM-DD. Leave a field empty to remove that date.',
		fields: scheduleFields(host, item),
		validate: validateSchedule,
		onSubmit: (values) => void host.applySafely(computeScheduleWrites(item, planFrom(values))),
	}).open();
}

/** Take the item off the plan: both configured date keys removed in one undoable batch. */
export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	return host.applySafely(computeScheduleWrites(item, { start: null, target: null }));
}
