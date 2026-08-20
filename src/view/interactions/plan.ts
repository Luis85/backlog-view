import { Menu } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { PlacementEnd, placementEnds } from '../../domain/itemTypes';
import { sameValue } from '../../domain/noteFields';
import { BacklogSettings, horizonMenuValues } from '../../domain/settings';
import { optionalKeyFor } from '../../domain/optionalProperties';
import { formatCivil } from '../../domain/timeline';
import { computeHorizonWrites, SchedulePlan } from '../../domain/writePlan';
import { SchedulePromptModal } from '../../ui/prompts';
import { rowVocabulary } from '../projection';
import { t } from '../../i18n/t';

/**
 * Setting the roadmap's placement properties from a row — the horizon it sits in and
 * the dates it is planned for — in whichever projection the row is in.
 *
 * These are the same writes the roadmap's own gestures will plan, reached from the
 * item rather than from the mode: the projections share one model, one gate and one
 * undo history, so a property that could only be set inside roadmap mode would be a
 * projection disagreeing about what the backlog can do. Everything here plans in
 * `domain/writePlan.ts` and reaches the vault through the gate, which is what makes a
 * context row unwritable by construction rather than by remembering.
 *
 * The DATE entries go the last step through `host.performScheduleMove` rather than
 * calling the gate themselves: it is the one place a date batch is planned and the one
 * place it is announced, so the drag, the grips, this prompt and the menu's Unschedule
 * are one move said once. Left on `applySafely`, the row's entry would be a second idea
 * of what scheduling is — which is the drift the rule exists to prevent, and it would
 * show up first as a gesture that announces and a menu action that does not.
 */

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
	return placementEnds(item.typeName, settings.iterationBars).some((end) => optionalKeyFor(settings, end) !== '');
}

/** True when the note carries a date key this item's placement may take away. */
export function carriesDates(item: BacklogItem, settings: BacklogSettings): boolean {
	return placementEnds(item.typeName, settings.iterationBars).some((end) => item.ownKeys[end]);
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
	const vocabulary = horizonMenuValues(host.settings, host.model ? rowVocabulary(host.model, item).observedHorizons : []);
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
 *
 * The condition is spelled here rather than asked of `menusListChildren`
 * (`view/projection.ts`), which reads identically today: that one declares what a card
 * MENU lists and this one decides where a PICK goes, so an axis that changed one answer
 * would silently change the other.
 */
function chooseHorizon(host: BacklogViewHost, item: BacklogItem, value: string | null): Promise<unknown> {
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
			.setTitle(t('plan.clearHorizon'))
			.setIcon('eraser')
			.onClick(() => void chooseHorizon(host, item, null)),
	);
}

/**
 * The ends the entry asks for: only the configured ones, each prefilled with the date
 * the note states. A value the reader refuses arrives BLANK rather than as itself —
 * the field asks for a date and that is not one — so typing a date replaces it and the
 * unreadable value is never carried back to disk.
 *
 * These prefills are also the baseline `planFrom` decides against, which is why they
 * are read ONCE per prompt: an unreadable value and an absent one are the same blank
 * here, so the entry cannot tell them apart afterwards and does not try
 * ([[Horizon and dates from the row]] 4d).
 */
function scheduleFields(
	host: BacklogViewHost,
	item: BacklogItem,
	ends: PlacementEnd[],
): { field: string; name: string; value: string }[] {
	const fields = [];
	for (const field of ends) {
		const key = optionalKeyFor(host.settings, field);
		if (key === '') continue;
		fields.push({ field, name: key, value: statedDate(item, field) });
	}
	return fields;
}

/** What the note says for one end, as the entry spells a date, or '' for absent and unreadable alike. */
function statedDate(item: BacklogItem, field: PlacementEnd): string {
	const reading = field === 'start' ? item.plannedStart : item.plannedTarget;
	return reading.value ? formatCivil(reading.value) : '';
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
function validateSchedule(values: Record<string, string>, unshown: Partial<Record<PlacementEnd, string>>): string | null {
	const start = values.start ?? unshown.start ?? '';
	const target = values.target ?? unshown.target ?? '';
	if (start === '' || target === '' || target >= start) return null;
	// Name the end the entry did NOT show. A one-end entry is refused against a date the
	// reader cannot see, and "cannot be before the start date" about a field that is not on
	// screen reads as a bug rather than as a rule.
	if (values.start === undefined) return `The target date cannot be before this item's start date (${start}).`;
	if (values.target === undefined) return `The start date cannot be after this item's target date (${target}).`;
	return 'The target date cannot be before the start date.';
}

/**
 * The ends this item HAS that the entry is not showing, with the dates the note states —
 * the baseline the span rule is checked against when only one end is on screen.
 *
 * Narrowed by `placementEnds` first, which is what keeps a marker's stale start out of it:
 * that end is one this type may only ignore, so comparing a target against it would refuse
 * a date the type says is the only one it has.
 *
 * This is the ONE thing here decided from the model rather than from the form, and the
 * departure is deliberate rather than overlooked — `planFrom` below says at length why a
 * WRITE may not be. The direction of the failure is what makes it safe: a model a refresh
 * behind can only make this wrongly REFUSE, which is visible, recoverable, and leaves the
 * reader holding their input since the prompt stays open on what they entered. The defect
 * that rule was written for could wrongly DELETE a value another editor had just fixed.
 */
function unshownEnds(
	item: BacklogItem,
	ends: PlacementEnd[],
	settings: BacklogSettings,
): Partial<Record<PlacementEnd, string>> {
	const unshown: Partial<Record<PlacementEnd, string>> = {};
	for (const field of placementEnds(item.typeName, settings.iterationBars)) {
		if (ends.includes(field)) continue;
		const stated = statedDate(item, field);
		if (stated !== '') unshown[field] = stated;
	}
	return unshown;
}

/**
 * The plan an entry means, decided from the FORM: a field the user changed states a
 * request, a field they left as they found it states nothing. Emptied, that request is
 * a removal; filled or edited, it is that date.
 *
 * One rule, asked of what the entry showed and what came back — never of the item.
 * `prefill` is what `scheduleFields` put in the inputs, so "did this change?" is a
 * question about the dialog and answerable without reading the note at all. That
 * matters twice over:
 *
 * - the model can be a refresh behind, and this was the last place on any date path
 *   that still decided a write from it. An unreadable value arrives blank exactly as an
 *   absent one does, so deciding from `reading.invalid` meant every Save planned a
 *   removal for a field nobody had touched — and an editor who corrected that value
 *   while the prompt sat open had the correction deleted. See
 *   [[planFrom decides a removal from the model, not the form]].
 * - a dialog entry is absolute and so states no baseline (`from`) the writer could check
 *   it against, which is why a stale request cannot be caught downstream. Not making one
 *   is the whole defence.
 *
 * The cost, accepted: an unreadable value can no longer be cleared by the entry ALONE.
 * Typing a date replaces it, and **Unschedule** removes it — taking the other end with
 * it. What is gone is a deletion nobody could ask for anyway: it fired on every Save,
 * whether or not the reader meant it, and a blank field cannot tell them whether it is
 * blank because the note says nothing or because the note says something unreadable.
 */
function planFrom(prefill: Record<string, string>, values: Record<string, string>): SchedulePlan {
	const plan: SchedulePlan = {};
	for (const field of ['start', 'target'] as const) {
		const value = values[field];
		// Absent, not blank: a field the entry never offered (a marker has no start).
		// Untouched is the same answer by a different route, and both state nothing.
		if (value === undefined || value === (prefill[field] ?? '')) continue;
		plan[field] = value === '' ? null : value;
	}
	return plan;
}

/**
 * Ask for the item's planned dates, then write the ends that actually changed.
 *
 * `from` is deliberately not passed: it scopes to a RELATIVE gesture ("one day further
 * than this"), and a dialog entry is absolute — the user typed that date meaning that
 * date, so a live change to the base is not a reason to refuse it.
 */
export function promptSchedule(
	host: BacklogViewHost,
	item: BacklogItem,
	ends: PlacementEnd[] = placementEnds(item.typeName, host.settings.iterationBars),
): void {
	const fields = scheduleFields(host, item, ends);
	// Narrowed to one end by a date CHIP, which writes the end it names and nothing else.
	// It is the same modal, the same planner and the same host method as the two-field
	// entry — a one-end prompt is this field list with one row in it, not a second idea of
	// what scheduling is.
	const unshown = unshownEnds(item, ends, host.settings);
	// What the inputs were opened with, kept so the submitted values can be compared
	// against what the reader was actually SHOWN. Built here rather than inside
	// `planFrom` so there is one reading of the item per prompt: read it again at submit
	// and the two could disagree, which is the defect this shape exists to remove.
	const prefill = Object.fromEntries(fields.map((entry) => [entry.field, entry.value]));
	new SchedulePromptModal(host.app, {
		heading: t('plan.scheduleHeading', { title: item.title }),
		description: t('plan.scheduleDescription'),
		fields,
		validate: (values) => validateSchedule(values, unshown),
		onSubmit: (values) => void host.performScheduleMove(item, planFrom(prefill, values)),
	}).open();
}

/**
 * Every date key a placement answers for, as a plan that removes them. Ends default
 * to the item's own CURRENT type — right for the menu's Unschedule and the row entry,
 * which have no captured shape to disagree with. A caller holding one from earlier in
 * a gesture — the dated axis's shelf drop, mid-hold — passes it explicitly, so the
 * plan removes what the gesture actually promised rather than whatever the item now
 * answers for; the writer is what catches the two having drifted apart.
 */
export function unschedulePlan(
	item: BacklogItem,
	settings: BacklogSettings,
	ends: PlacementEnd[] = placementEnds(item.typeName, settings.iterationBars),
): SchedulePlan {
	const plan: SchedulePlan = {};
	for (const field of ends) plan[field] = null;
	return plan;
}

/** Take the item off the plan: every date key its own type answers for, in one undoable batch. */
export function unschedule(host: BacklogViewHost, item: BacklogItem): Promise<boolean> {
	return host.performScheduleMove(item, unschedulePlan(item, host.settings));
}
