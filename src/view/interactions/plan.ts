import { Menu } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { isMarkerType } from '../../domain/itemTypes';
import { sameValue } from '../../domain/noteFields';
import { BacklogSettings, horizonMenuValues, optionalKeyFor } from '../../domain/settings';
import { formatCivil } from '../../domain/timeline';
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

/** The two ends a placement can act on, in the order the entry asks for them. */
const BOTH_ENDS = ['start', 'target'] as const;

/**
 * Which ends a placement acts on for THIS item. A milestone answers for its target alone
 * — the type is the stronger statement, and a start it merely ignores is not a date any
 * hand may write or delete.
 *
 * Stated per **type** rather than per control on purpose: the row's Schedule and
 * Unschedule are simply the paths that exist first, and the roadmap's gestures — a shelf
 * card dropped on the grid, a bar dropped back on the shelf, a bar slide, each keyboard
 * equivalent — are specified in siblings still unbuilt. A rule written per control is one
 * control out of date the moment a fourth path is added; a rule written per type is one
 * every new path inherits by asking.
 *
 * Module-private for now: nothing outside this file needs it yet — its outside callers
 * are the roadmap gestures above (specified, not yet built). Export it when the first
 * of those lands, the way `placeMarker` (`domain/roadmap.ts`) waits for its own.
 */
function placementEnds(item: BacklogItem): ('start' | 'target')[] {
	return isMarkerType(item.typeName) ? ['target'] : [...BOTH_ENDS];
}

/**
 * Whether a placement entry has any field to ask for at all — the narrowed ends, against
 * the configured keys. Withheld rather than opened empty: a control that opens onto
 * nothing is the failure the context-row rule and the empty add button both answer by
 * removing the control, not by opening it and apologising.
 *
 * For a work item this is exactly `hasDateAxis`. For a milestone on a start-only vault
 * there is no legal batch left — the target has no key to receive a write and the start is
 * a key this type may not touch — so the entry is absent.
 */
export function canSchedule(settings: BacklogSettings, item: BacklogItem): boolean {
	return placementEnds(item).some((end) => optionalKeyFor(settings, end) !== '');
}

/** True when the note carries a date key this item's placement may take away. */
export function carriesDates(item: BacklogItem): boolean {
	return placementEnds(item).some((end) => item.ownKeys[end]);
}

/**
 * The horizons this row may be given: the declared vocabulary plus the values the
 * results already carry, with the item's own on the end when it is on neither list —
 * a menu that cannot show what the item *is* loses it on the next pick.
 *
 * On the roadmap the BUCKETS LEAD, read off the frame as drawn — the board's rule for
 * Set state, which offers its rendered columns rather than a list rebuilt from the
 * settings that then has to agree with them. It matters here for the same reason: a
 * focus level or a hidden row can remove a value's first carrier, so the order the
 * axis mints its buckets in and the order the model met those values in are not
 * always the same, and the one the user can see is the one to follow. Values no drawn
 * bucket covers still follow, so what is reachable never depends on what is on screen.
 */
function horizonChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	const vocabulary = horizonMenuValues(host.settings, host.model?.observedHorizons ?? []);
	const drawn = host.projection === 'roadmap' ? (host.roadmap?.roadmap.buckets ?? []).map((b) => b.value) : [];
	const values = [...drawn, ...vocabulary.filter((v) => !includesValue(drawn, v))];
	const current = item.horizon.value;
	if (current === null || includesValue(values, current)) return values;
	return [...values, current];
}

/** Placement values match case-insensitively, the same matching that fills the buckets. */
function includesValue(values: string[], value: string): boolean {
	return values.some((v) => sameValue(v, value));
}

/**
 * What picking a horizon does. In roadmap mode it takes the DRAG's own path, so a
 * pick and a drop onto the same bucket are one write, one gate and — the part only
 * this path can supply — one announcement, said once by `performHorizonMove` rather
 * than by each input separately. Elsewhere there is no frame to announce into and
 * the planned write goes straight through the gate. `chooseState` splits on the
 * board for the same reason.
 */
function chooseHorizon(host: BacklogViewHost, item: BacklogItem, value: string | null): Promise<boolean> {
	if (host.projection === 'roadmap' && host.roadmap?.roadmap.axis === 'horizons') {
		return host.performHorizonMove(item, value);
	}
	return host.applySafely(computeHorizonWrites(item, value));
}

/**
 * The Set horizon list: every bucket this base can place a row in, and the way out of
 * them.
 *
 * An entry is checked exactly when picking it would write NOTHING — asked of the
 * planner itself rather than by a comparison written beside it and expected to agree.
 * Those two drift the moment either side learns a case the other has not, and the
 * failure is silent in the worst direction: an entry that reads as current whose pick
 * still writes, spending the one undo slot on a change nobody asked for. Set state
 * follows the same rule against `computeStateWrites`.
 */
export function addHorizonItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	for (const value of horizonChoices(host, item)) {
		menu.addItem((si) => {
			si.setTitle(value).onClick(() => void chooseHorizon(host, item, value));
			if (computeHorizonWrites(item, value).length === 0) si.setChecked(true);
		});
	}
	// Offered only while the note carries the key, so no entry here can write nothing —
	// and it removes the key rather than blanking it: untriaged is a state a note
	// returns to, whereas an empty value would render as a bucket named nothing.
	if (!item.ownKeys.horizon) return;
	menu.addSeparator();
	menu.addItem((si) =>
		si
			.setTitle('Clear horizon')
			.setIcon('eraser')
			.onClick(() => void chooseHorizon(host, item, null)),
	);
}

/**
 * The ends the entry asks for: only the configured ones, each prefilled with the date
 * the note states. A value the reader refuses arrives BLANK rather than as itself —
 * the field asks for a date and that is not one — so confirming replaces it instead
 * of carrying the unreadable value back to disk.
 */
function scheduleFields(host: BacklogViewHost, item: BacklogItem): { field: string; name: string; value: string }[] {
	const fields = [];
	for (const field of placementEnds(item)) {
		const key = optionalKeyFor(host.settings, field);
		if (key === '') continue;
		const reading = field === 'start' ? item.plannedStart : item.plannedTarget;
		fields.push({ field, name: key, value: reading.value ? formatCivil(reading.value) : '' });
	}
	return fields;
}

/**
 * Why an entry cannot be written, or null.
 *
 * One refusal, not two. The timeline makes two about a note's own dates
 * ([[Bars from two dates]]) — a value that spells no calendar date, and a target
 * before its start — and the first is no longer a question a prompt can be asked:
 * the fields are native date inputs, which hand back `YYYY-MM-DD` or nothing at all.
 * The planner keeps its own backstop for a value that arrives from anywhere else.
 *
 * That is also what makes the comparison a string comparison: zero-padded ISO dates
 * order lexically exactly as the calendar orders them, and these two can be nothing
 * else.
 *
 * The span rule narrows by itself: `placementEnds` decides which fields exist, so a
 * milestone's values carry no `start` and the comparison below cannot fire. There is no
 * second place to keep in step, which is what "per type, not per control" buys.
 */
function validateSchedule(values: Record<string, string>): string | null {
	const start = values.start ?? '';
	const target = values.target ?? '';
	if (start !== '' && target !== '' && target < start) return 'The target date cannot be before the start date.';
	return null;
}

/**
 * The plan an entry means: a date per configured end, and a blank field meaning that
 * end goes.
 *
 * A blank field only removes something the note actually STATES — a date, or a value
 * the reader refuses (which confirming replaces rather than writes back). A field that
 * *arrived* blank states nothing, so confirming the prompt untouched writes nothing,
 * even where the key exists holding an empty value: the backfill creates exactly that
 * stub, and opening the entry on one and pressing Save must not delete it and spend
 * the undo slot. Unschedule is the deliberate way to take a key away, and it still is.
 */
function planFrom(item: BacklogItem, values: Record<string, string>): SchedulePlan {
	const plan: SchedulePlan = {};
	for (const field of ['start', 'target'] as const) {
		const value = values[field];
		if (value === undefined) continue;
		if (value !== '') {
			plan[field] = value;
			continue;
		}
		const reading = field === 'start' ? item.plannedStart : item.plannedTarget;
		if (reading.value !== null || reading.invalid) plan[field] = null;
	}
	return plan;
}

/** Ask for the item's planned dates, then write the ends that actually changed. */
export function promptSchedule(host: BacklogViewHost, item: BacklogItem): void {
	new SchedulePromptModal(host.app, {
		heading: `Schedule "${item.title}"`,
		description: 'Pick a date for each end, or clear a field to remove that date.',
		fields: scheduleFields(host, item),
		validate: validateSchedule,
		onSubmit: (values) => void host.applySafely(computeScheduleWrites(item, planFrom(item, values))),
	}).open();
}

/** Take the item off the plan: every date key its own type answers for, in one undoable batch. */
export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	const plan: SchedulePlan = {};
	for (const field of placementEnds(item)) plan[field] = null;
	return host.applySafely(computeScheduleWrites(item, plan));
}
