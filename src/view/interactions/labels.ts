import { Menu } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { sameValue } from '../../domain/noteFields';
import { computeAssigneeWrites, computeRiskWrites, ItemWrite } from '../../domain/writePlan';
import { ValuePromptModal } from '../../ui/prompts';
import { rowVocabulary } from '../projection';

/**
 * What the row offers for the two LABEL properties — the risk level, and who the item is
 * assigned to. Both are one plain value chosen from a list, set from a submenu whose foot
 * clears the key, so they sit together rather than beside the state and placement actions
 * in `menu.ts`, which is what the ROW is offered rather than what a label means.
 *
 * Where they differ is the only interesting thing about them, and it is the list: risk's
 * vocabulary is DECLARED in the view options, the assignee's is OBSERVED off the results
 * and extended by typing. That difference is stated in `riskChoices` and
 * `assigneeChoices` and nowhere else — the writes, the checkmarks and the clear entries
 * are the same two rules for both.
 */

/**
 * What Set risk offers: the DECLARED levels, plus the item's own value when that list
 * does not name it, so the current one can always render checked.
 *
 * Declared alone, deliberately — not the horizon's declared ∪ observed union. That union
 * exists because an undeclared horizon is a bucket a drag can already drop into, so a
 * menu offering less than the roadmap could reach would be the one input that goes quiet.
 * Risk feeds no projection, so it has no second surface to fall short of, and an
 * unexpected value on one note is not a vocabulary this base recommends to the rest.
 */
function riskChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	const values = host.settings.riskValues;
	const current = item.riskValue;
	// The empty key the ✨ backfill leaves behind adds no nameless entry here, and that
	// is `readString`'s doing rather than this line's: it answers null for a blank, so
	// `riskValue` is a level or nothing and never the empty string. Guarding for `''`
	// beside this would be a second, unreachable statement of a rule the reader already
	// keeps — the shape `stateChoices` has, for the same reason.
	if (current === null || values.some((v) => sameValue(v, current))) return values;
	return [...values, current];
}

/**
 * What Set assignee offers: every name the RESULTS carry, plus the item's own when the
 * base has no other note naming it — the tag menu's rule, over a single value.
 *
 * There is no declared list to prefer here and none to fall back to, which is why the
 * observed names are the whole of it rather than a union like the horizon's: nobody
 * configures who exists. A name this base has never seen is still reachable, through
 * **New assignee...** below, and that is what keeps an empty vocabulary from being an
 * empty menu — the reason this feature needs only a key named, where risk needs a key
 * and a list.
 */
function assigneeChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	// Through `rowVocabulary` like the state, horizon and tag menus, and for their reason:
	// a vocabulary is scoped to the population of the projection that offers it. Read off
	// the model directly — which is what this did until review — a name only a test carries
	// is offered on every plan row, and a catalog row cannot reuse a name observed on
	// another test. Per ROW rather than per projection, because both directions of a
	// projection-wide answer are wrong: see `rowVocabulary`'s own comment.
	const values = host.model ? rowVocabulary(host.model, item).observedAssignees : [];
	const current = item.assigneeValue;
	if (current === null || values.some((v) => sameValue(v, current))) return values;
	return [...values, current];
}

/**
 * Render one label menu's offers, checking the one the item already holds, and the way
 * back out of them.
 *
 * Checked is asked of the PLAN — an entry is checked exactly when picking it would write
 * nothing — never by a comparison written beside the plan and expected to agree with it.
 * The Clear entry appears only while the note carries the key (`ownKeys`, presence not
 * value), so no entry here can write nothing, and it removes the key rather than blanking
 * it: unassigned and unjudged are states a note returns to, and a blank value would read
 * as a name or a level with nothing in it.
 */
function addLabelItems(
	menu: Menu,
	host: BacklogViewHost,
	item: BacklogItem,
	spec: {
		choices: string[];
		writes: (value: string | null) => ItemWrite[];
		present: boolean;
		clearTitle: string;
		/** Drawn after the choices and before the clear entry — the assignee's way to type one. */
		extra?: () => void;
	},
): void {
	for (const value of spec.choices) {
		menu.addItem((si) => {
			si.setTitle(value).onClick(() => void host.applySafely(spec.writes(value)));
			if (spec.writes(value).length === 0) si.setChecked(true);
		});
	}
	spec.extra?.();
	if (!spec.present) return;
	menu.addSeparator();
	menu.addItem((si) =>
		si
			.setTitle(spec.clearTitle)
			.setIcon('eraser')
			.onClick(() => void host.applySafely(spec.writes(null))),
	);
}

/** Set risk's entries — the declared levels, then the way to clear the key. */
export function addRiskItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	addLabelItems(menu, host, item, {
		choices: riskChoices(host, item),
		writes: (value) => computeRiskWrites(item, value),
		present: item.ownKeys.risk,
		clearTitle: 'Clear risk',
	});
}

/**
 * Set assignee's entries — the observed names, the way to type one that is not there
 * yet, and the way to clear the key.
 *
 * The **New assignee...** entry sits between the names and the clear, and it is what
 * makes this menu safe to draw on a named key alone: with nothing observed the list is
 * empty, and a menu that could then set nothing is exactly what the risk menu's absence
 * when its levels are cleared exists to prevent.
 */
export function addAssigneeItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	addLabelItems(menu, host, item, {
		choices: assigneeChoices(host, item),
		writes: (value) => computeAssigneeWrites(item, value),
		present: item.ownKeys.assignee,
		clearTitle: 'Clear assignee',
		extra: () =>
			menu.addItem((si) =>
				si
					.setTitle('New assignee...')
					.setIcon('plus')
					.onClick(() => promptNewAssignee(host, item)),
			),
	});
}

/** Free-text entry, suggesting the names already in use so spellings stay consistent. */
function promptNewAssignee(host: BacklogViewHost, item: BacklogItem): void {
	new ValuePromptModal(host.app, {
		title: 'Assign item',
		fieldName: 'Assignee',
		placeholder: 'Alex',
		ctaLabel: 'Assign',
		known: assigneeChoices(host, item),
		onSubmit: (value) => void host.applySafely(computeAssigneeWrites(item, value.trim())),
	}).open();
}
