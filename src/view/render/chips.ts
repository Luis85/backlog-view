import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { BacklogViewHost, Column } from '../host';
import { showAssigneeMenu, showPriorityMenu, showRiskMenu } from '../interactions/menu';
import { ownWorkflowReading, stateKeyFor } from '../../domain/board';
import { PlacementEnd, placementEnds } from '../../domain/itemTypes';
import { canPlaceHorizon } from '../interactions/plan';
import { BacklogItem } from '../../domain/model';
import { CivilDate, FieldReading } from '../../domain/noteFields';
import { assigneeName } from '../../domain/readItems';
import { shelfLabel } from '../../domain/roadmap';
import { formatCivil } from '../../domain/timeline';

/**
 * The row's inline write surfaces: one chip per property this view can set from the tree.
 *
 * Extracted from `render/columns.ts` on 2026-08-15, when the date chips would have taken
 * that file past its 400-line budget — the seam `writeGate.ts` and `cardMoves.ts` were
 * taken along, and the same one either way: `columns.ts` decides WHICH properties are
 * columns and how wide they are, and this decides what a cell that is more than a value
 * draws. `renderCell` is the one caller and stays there, because dispatching on a
 * column's kind is a question about columns.
 *
 * Every chip here keeps four rules, and they are the reason it is one file rather than
 * five:
 *
 * - it is drawn on the SAME predicate the menu or entry behind it is gated on, stated in
 *   `columnKind`, so a chip whose action could do nothing is not a state either side can
 *   reach alone;
 * - it is that property's own CELL, so the row never draws a value twice with one of the
 *   two inert;
 * - a row the Base excluded gets a static `div` and never a button — absent entirely
 *   where it has nothing to say, rather than a button-shaped invitation to a write the
 *   gate would refuse;
 * - it is a real `<button>` with `tabindex="-1"`: activatable by assistive tech, invisible
 *   to Tab, with the row's context menu as the documented keyboard path.
 */

/**
 * What a chip announces. The verb is ours and stays sentence case; the noun is the
 * property's own display name, so the control says which key it writes rather than which
 * KIND of thing it is.
 */
function chipLabel(label: string, value: string | null): string {
	return value === null ? t('chip.set', { label }) : t('chip.change', { label, value });
}


/**
 * Clickable state chip — the inline write surface for the workflow state.
 *
 * WHOSE state is the item's own question — its type, else its ladder — and the same one
 * `Set state` asks in `interactions/menu.ts`: a Deliverable shows and edits the Deliverable
 * workflow's value and a catalog row the test workflow's, so the chip and the menu it opens
 * can never name different states. Either one under the fallback (no property of its own
 * configured) reads the shared key, so this is the identical value either way.
 */
export function renderStateChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, column: Column): boolean {
	// The CELL is the properties menu's question and the CHIP is the row's own: this
	// column names ONE key, and a row draws into it only when that is the key its
	// workflow writes. With both workflows visible on distinct keys there are two such
	// columns, and every row fills exactly one of them and leaves the other empty —
	// empty rather than absent, or the columns after it would shift on that row alone.
	// `stateKeyFor` is the same function `buildItemMenu` gates Set state on, so the chip
	// and the menu can never disagree about which key this row writes.
	const key = stateKeyFor(host.settings, item);
	if (!key || `note.${key}` !== column.prop) return false;
	const { value, done } = ownWorkflowReading(item);
	const cls = 'pbl-state-chip' + (done ? ' pbl-state-done' : '') + (value === null ? ' pbl-state-unset' : '');

	// A note the Base excluded is context: show the state it has, never offer to
	// write it. An unset one renders nothing at all rather than a "State" button
	// that would look like an invitation.
	if (item.outsideFilter) {
		if (value === null) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillStateChip(chip, done, value);
		setTooltip(chip, t('chip.stateStatic'));
		return true;
	}

	// A native button, so assistive tech can activate it — but no Tab stop: the
	// tree keeps its single-tab-stop model, and the context menu carries the
	// documented keyboard path (Set state).
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(column.label, value),
		},
	});
	fillStateChip(chip, done, value);
	setTooltip(chip, t('chip.stateChange'));
	return true;
}

function fillStateChip(chip: HTMLElement, done: boolean, value: string | null): void {
	const icon = done ? 'circle-check' : value !== null ? 'circle' : 'circle-dashed';
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), icon);
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? t('chip.statePlaceholder') });
}

/**
 * Clickable horizon chip — the state chip's shape over the roadmap's placement, so
 * the property a card is dragged between buckets by is settable from the tree too,
 * where most of a backlog is actually read. It opens the same menu the row's own
 * Set horizon does (`addHorizonItems`), which is what keeps every horizon this base
 * can reach reachable from here as well, and checked against the same plan.
 *
 * Rendered on exactly the condition the roadmap draws its bucket axis on
 * (`hasHorizonAxis`) — a property with no declared values is a board without stages,
 * and a chip whose menu could set nothing would be a third opinion about what
 * "configured" means. The COLUMN asks that of the settings (`columns.ts`); the row asks
 * `canPlaceHorizon`, which adds the item's own half — the date chip's exact shape, and the
 * reason is the same one: a type this axis does not place must not draw a control over a
 * key nothing may write for it.
 */
export function renderHorizonChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, label: string): boolean {
	if (!canPlaceHorizon(host.settings, item.typeName)) return false;
	// A value the reader refuses is not a placement: the roadmap shelves such a card
	// with the reason on its face, and the chip says the same thing — unplaced, and
	// why — rather than showing a horizon the axis would not honor.
	const value = item.horizon.value;
	const unplaced = value === null;
	const reason = item.horizon.invalid ? t('chip.horizonUnreadable') : null;
	const cls = 'pbl-horizon-chip' + (unplaced ? ' pbl-horizon-unset' : '');

	// A note the Base excluded is context: show where it sits, never offer to move
	// it. With nothing to show it renders nothing at all, rather than a button-shaped
	// invitation to a write this row cannot take.
	if (item.outsideFilter) {
		if (unplaced) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillHorizonChip(chip, value);
		setTooltip(chip, t('chip.horizonStatic'));
		return true;
	}

	// A native button with no Tab stop, the state chip's bargain: reachable by
	// assistive tech, invisible to Tab, with the context menu as the keyboard path.
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(label, value),
		},
	});
	fillHorizonChip(chip, value);
	setTooltip(chip, reason ?? t('chip.horizonChange'));
	return true;
}

/**
 * The two LABEL chips — the risk level and the assignee — as data rather than as two
 * copies of one renderer. Each carries the icon of the menu it opens, so the chip and
 * the row's Set entry read as one control, and each names the property in its own words:
 * an unset chip is an INVITATION, not a placement, so it says what could go there rather
 * than the horizon's `Unplaced`.
 */
export const LABEL_CHIPS: Record<'risk' | 'priority' | 'assignee', LabelChip> = {
	risk: {
		valueOf: (item) => item.riskValue,
		cls: 'pbl-risk-chip',
		unsetCls: 'pbl-risk-unset',
		icon: 'shield-alert',
		unsetIcon: 'shield',
		placeholder: () => t('chip.riskPlaceholder'),
		staticTip: () => t('chip.riskStatic'),
		changeTip: () => t('chip.riskChange'),
		showMenu: showRiskMenu,
	},
	priority: {
		valueOf: (item) => item.priorityValue,
		cls: 'pbl-priority-chip',
		unsetCls: 'pbl-priority-unset',
		icon: 'flag',
		unsetIcon: 'flag-off',
		placeholder: () => t('chip.priorityPlaceholder'),
		staticTip: () => t('chip.priorityStatic'),
		changeTip: () => t('chip.priorityChange'),
		showMenu: showPriorityMenu,
	},
	assignee: {
		valueOf: (item) => assigneeName(item),
		cls: 'pbl-assignee-chip',
		unsetCls: 'pbl-assignee-unset',
		icon: 'user',
		unsetIcon: 'user-plus',
		placeholder: () => t('chip.assigneePlaceholder'),
		staticTip: () => t('chip.assigneeStatic'),
		changeTip: () => t('chip.assigneeChange'),
		showMenu: showAssigneeMenu,
		// Asked of the ROSTER rather than of the link, because a link that resolves is not
		// the same question as a link that resolves to somebody: `[[Epic B]]` resolves to a
		// real note and `[[Alex]]` resolves to a resource the filter excluded, and both are
		// shelved by the roadmap and offered by no menu entry. Answering from resolution
		// alone drew those two as valid assignments on the row while every other surface
		// treated them as nobody — three surfaces disagreeing about one value. Found by
		// automated review on PR #207.
		broken: (host, item) =>
			item.assigneeEntry !== null &&
			!(host.model?.resources ?? []).some((r) => r.file.path === item.assigneeEntry?.file?.path),
		brokenCls: 'pbl-assignee-broken',
		brokenTip: () => t('chip.assigneeUnresolved'),
	},
};

interface LabelChip {
	valueOf: (item: BacklogItem) => string | null;
	cls: string;
	unsetCls: string;
	icon: string;
	unsetIcon: string;
	/** What an unset chip says — the property, not a value, because there is none. */
	placeholder: () => string;
	/** This property's two tooltips, whole: what a context row says, and what a result offers. */
	staticTip: () => string;
	changeTip: () => string;
	showMenu: (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem) => void;
	/**
	 * Whether this item's value names something the view could not resolve — a third state
	 * beside set and unset, and optional because the assignee is the only label property
	 * whose value is a NOTE. [[Broken links still render]]'s rule, one property over: the
	 * view marks, it does not tidy. Drawn as what the note says, under `brokenCls`, so the
	 * reader can see the value and see that it resolves to nobody.
	 */
	broken?: (host: BacklogViewHost, item: BacklogItem) => boolean;
	/** The class that marks the third state. Present exactly when `broken` is. */
	brokenCls?: string;
	/** What the third state's tooltip says. Present exactly when `broken` is. */
	brokenTip?: () => string;
}

/**
 * Clickable label chip — the state chip's shape, over a plain value the note declares.
 * Each kind is drawn on the same test the row menu's own Set entry is gated on
 * (`columnKind` states which, per kind), so a chip whose menu could set nothing is not a
 * state either side can reach alone, and it opens that menu's own builder through
 * `showMenu` rather than a second list.
 */
export function renderLabelChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, label: string, spec: LabelChip): boolean {
	const value = spec.valueOf(item);
	// The third state, beside set and unset: a value the view could not resolve against
	// its roster. Marked with its own class so the reader can see both the value AND that
	// it names nobody, rather than either hiding the note's own text or drawing it as an
	// ordinary, valid assignment.
	const broken = spec.broken?.(host, item) ?? false;
	const cls = spec.cls + (value === null ? ` ${spec.unsetCls}` : '') + (broken ? ` ${spec.brokenCls}` : '');

	// A note the Base excluded is context: show what it claims, never offer to change
	// it. With nothing to show it renders nothing at all, rather than a button-shaped
	// invitation to a write this row cannot take.
	if (item.outsideFilter) {
		if (value === null) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillLabelChip(chip, value, spec);
		setTooltip(chip, broken ? (spec.brokenTip as () => string)() : spec.staticTip());
		return true;
	}

	// A native button with no Tab stop, the state chip's bargain: reachable by
	// assistive tech, invisible to Tab, with the context menu as the keyboard path.
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(label, value),
		},
	});
	fillLabelChip(chip, value, spec);
	setTooltip(chip, broken ? (spec.brokenTip as () => string)() : spec.changeTip());
	return true;
}

/**
 * A label chip's face. An EMPTY value — the stub the backfill leaves — is a key with
 * nothing in it, so it says the same thing absence does; the menu's Clear entry is still
 * what takes the key away.
 */
function fillLabelChip(chip: HTMLElement, value: string | null, spec: LabelChip): void {
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? spec.unsetIcon : spec.icon);
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? spec.placeholder() });
}

/**
 * The chip's face. Unplaced is named with the roadmap's own word for it — the shelf
 * is where such a row sits there — rather than with the property's name: the chip
 * states a placement, and "not placed yet" is one. What pressing it does is in the
 * accessible name, which is where the state chip puts it too.
 */
function fillHorizonChip(chip: HTMLElement, value: string | null): void {
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? 'inbox' : 'milestone');
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? shelfLabel() });
}

/**
 * The two DATE chips — the ends of the plan — as data, the label chips' own shape.
 *
 * They differ from every chip above in what an unset one SAYS. `LABEL_CHIPS` carries a
 * fixed placeholder because risk and the assignee each have one obvious noun; neither
 * date end has one. The field is `target` internally, the key this view suggests for it
 * is `due`, and the key a given vault uses is whatever its owner named — so a fixed word
 * would put a third name on screen beside those two, and a chip reading `Due` in a vault
 * whose property is `deadline` would be naming a key that vault does not have. The
 * placeholder is therefore the COLUMN's display name, which is the string the header
 * directly above the cell already shows and the one `chipLabel` puts in the accessible
 * name under its own rule.
 *
 * Not worth retrofitting onto risk and the assignee: their fixed word and their display
 * name agree in every configuration that reaches them.
 */
const DATE_CHIPS: Record<'start' | 'target', DateChip> = {
	start: {
		end: 'start',
		readingOf: (item) => item.plannedStart,
		staticTip: () => t('chip.startStatic'),
		changeTip: () => t('chip.startChange'),
		unreadable: () => t('chip.startUnreadable'),
	},
	target: {
		end: 'target',
		readingOf: (item) => item.plannedTarget,
		staticTip: () => t('chip.targetStatic'),
		changeTip: () => t('chip.targetChange'),
		unreadable: () => t('chip.targetUnreadable'),
	},
};

interface DateChip {
	/** Which end this chip writes — the one the prompt is narrowed to, and the one the type must use. */
	end: PlacementEnd;
	readingOf: (item: BacklogItem) => FieldReading<CivilDate>;
	/** This end's three tooltips, whole: the context row's, the result's, and the refusal. */
	staticTip: () => string;
	changeTip: () => string;
	unreadable: () => string;
}

/**
 * Clickable date chip — the state chip's shape over one end of the plan, so a date can be
 * set where the backlog is actually read rather than only on the timeline or through a
 * two-field dialog.
 *
 * Pressing it opens the row menu's own entry narrowed to this end — the delegated
 * handler (`wireChipEvents` in `render/rows.ts`) calls `promptSchedule(host, item,
 * [end])`, which lands on `host.performScheduleMove` like the grid drag, the grips and
 * Unschedule — so a chip cannot plan a write beside them, and
 * `test/view/planAgreement.test.ts` holds it to the same batch.
 *
 * Drawn on the end's KEY alone, never on `hasDateAxis`: the entry behind this chip needs
 * no declared vocabulary, so there is no second half to pair with — the assignee's own
 * reasoning rather than the horizon's.
 */
export function renderDateChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, label: string, spec: DateChip): boolean {
	// The TYPE decides which ends exist. A marker states one date and has no span, so its
	// start cell draws nothing at all rather than a control over a key this type may only
	// ignore — the rule stated from the type's side in `docs/requirements/Milestones as
	// their own type.md`, reaching the chip through the same `placementEnds` call every
	// other date path asks. The cell itself is still rendered by `renderPropCells`, so the
	// columns after it stay under their headers on that row.
	if (!placementEnds(item.typeName, host.settings.iterationBars).includes(spec.end)) return false;
	// A value the reader refuses is not a date: the timeline shelves such a bar with the
	// reason on its face, and the chip says the same thing — nothing, and why — rather
	// than showing a date the axis would not honor. So unset and unreadable wear one face
	// and differ by tooltip, exactly as they do on the horizon chip.
	const reading = spec.readingOf(item);
	const value = reading.value === null ? null : formatCivil(reading.value);
	const reason = reading.invalid ? spec.unreadable() : null;
	const cls = 'pbl-date-chip' + (value === null ? ' pbl-date-unset' : '');

	if (item.outsideFilter) {
		if (value === null) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillDateChip(chip, value, label);
		setTooltip(chip, spec.staticTip());
		return true;
	}

	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(label, value),
		},
	});
	fillDateChip(chip, value, label);
	setTooltip(chip, reason ?? spec.changeTip());
	// Which end this chip writes, read back by the delegated handler
	// (`wireChipEvents` in `render/rows.ts`) — a modal takes no event to carry it, so
	// it travels on the element instead. Not inferred from the label: the label is the
	// column's own display name and says nothing about which of the two ends this is.
	chip.dataset.end = spec.end;
	return true;
}

/** The chip for one column, or null where the column is not a date end. */
export function dateChipFor(kind: 'start' | 'target'): DateChip {
	return DATE_CHIPS[kind];
}

/**
 * A date chip's face. The placeholder is the column's own name rather than a fixed word —
 * see `DATE_CHIPS` — and an unset end takes the icon that says one could be added, the
 * label chips' invitation rather than the horizon's `Unplaced`.
 */
function fillDateChip(chip: HTMLElement, value: string | null, label: string): void {
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? 'calendar-plus' : 'calendar');
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? label });
}
