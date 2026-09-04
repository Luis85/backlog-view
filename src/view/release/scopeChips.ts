import { App, Menu, MenuItem, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ownValue, readString } from '../../domain/noteFields';
import { estimateValue } from '../../domain/releaseReadiness';
import { ReleaseSettings } from '../../domain/releaseOptions';
import { ScopeRow } from '../../domain/scopeRows';
import { memberEffortWrites, memberRiskWrites, ReleaseWrite } from '../../domain/releaseWritePlan';
import { ValuePromptModal } from '../../ui/prompts';
import { showMenuForClick } from '../interactions/menu';
import { TreeDraw } from '../scopeKeys';

/**
 * The two values a member can be given from the release screen — its effort and its risk —
 * drawn as the tree's own chip and, since Task 8, writing through the same two functions
 * both the chip's click and the row menu call.
 *
 * **A CONTEXT row draws the cells and neither chip.** It is in no denominator and is never
 * a write target: it renders, it parents, and that is all. The empty cell stays, because
 * every column a row can draw is drawn on every row or the columns after it shift per row
 * (`src/view/CLAUDE.md`).
 *
 * **The gate is NOT the backstop behind that, and reading it as one was a hole.** A context
 * row on THIS screen is a non-member, not a note the base excluded — `scopeRows` walks
 * THROUGH an `outsideFilter` ancestor rather than keeping it — so every row this tree draws
 * is a base result and `ReleaseView`'s own `outsideFilter` predicate can never refuse one.
 * The check is therefore at the forbidden thing instead: {@link applyAndRefocus}, the one
 * funnel both fields and both inputs pass through, refuses a context row itself, so the two
 * gates below decide what is DRAWN and a THIRD INPUT ADDED TO THIS MODULE is covered too,
 * without anyone remembering it. **That claim stops at this module's own boundary and no
 * wider**: `memberEffortWrites` / `memberRiskWrites` (`domain/releaseWritePlan.ts`) and
 * `ReleaseView.applyRelease` are both reachable directly from anywhere else in the
 * codebase, and no lint rule or spy sits on either call — a writer built in another module
 * that reaches them without going through `applyAndRefocus` is not refused by anything
 * written here, and nothing today would fail if one did.
 *
 * **An unset value draws a DASHED chip rather than nothing**, which is the tree's own rule
 * for risk and priority (`src/view/CLAUDE.md`'s label-chip section): absence here is an
 * invitation, not a placement something else already names.
 *
 * `row.item` carries no frontmatter of its own (`BacklogItem` has none) — both readers take
 * the `App` and read `getFileCache(...)?.frontmatter`, the same door `releaseReadiness.ts`'s
 * `estimateOf` reads through, so this can never disagree with the figures the header sums.
 *
 * **One move per field, two inputs each** — the chip and the row menu — the root guide's
 * "one move, N inputs" for this screen: effort plans through `editMemberEffort` either
 * way, and risk plans through `addMemberRiskItems` either way (the chip wraps it in a
 * standalone `Menu`, the row menu in a true submenu — see that function's own header), so
 * a chip's click and the row menu's own entry cannot come to plan a different write. The
 * menu entries are not garnish: both chips are `tabindex="-1"` and the tree is one tab
 * stop, so without them the two fields would be pointer-only.
 */
export function drawReadinessChips(app: App, rowEl: HTMLElement, row: ScopeRow, settings: ReleaseSettings, riskChoices: string[]): void {
	drawChip(rowEl, 'pbl-rel-effortcol', {
		offered: !row.context && settings.estimateKey !== '',
		value: effortText(app, row, settings),
		label: t('release.scope.effortLabel'),
		field: 'effort',
	});
	drawChip(rowEl, 'pbl-rel-riskcol', {
		offered: !row.context && settings.riskKey !== '' && riskChoices.length > 0,
		value: riskText(app, row, settings),
		label: t('release.scope.riskLabel'),
		field: 'risk',
	});
}

interface ChipSpec {
	offered: boolean;
	value: string | null;
	label: string;
	field: 'effort' | 'risk';
}

function drawChip(rowEl: HTMLElement, columnClass: string, spec: ChipSpec): void {
	const cellEl = rowEl.createDiv({ cls: columnClass });
	if (!spec.offered) return;
	const chipEl = cellEl.createEl('button', {
		cls: 'pbl-state-chip' + (spec.value === null ? ' pbl-state-unset' : ''),
		attr: {
			type: 'button',
			// `tabindex="-1"`: the tree is ONE tab stop and the row menu is this chip's
			// keyboard path (`src/view/CLAUDE.md`, Controls) — Task 8's, not drawn here.
			tabindex: '-1',
			'aria-label': chipName(spec),
		},
	});
	chipEl.dataset.field = spec.field;
	chipEl.createSpan({ cls: 'pbl-state-text', text: spec.value ?? spec.label });
	setTooltip(chipEl, chipName(spec));
	// **After the tooltip, deliberately.** Obsidian's `setTooltip` is reported to implement
	// its tooltip THROUGH `aria-label`, which would take the name built above back off —
	// `renderScope.ts`'s `drawStatus` states this same ordering and its own evidence. Set
	// last, the name wins under both behaviours; the attribute above is kept so the element
	// is never nameless between the two calls.
	chipEl.setAttribute('aria-label', chipName(spec));
}

/**
 * The action and the value it holds, as a whole sentence per FIELD.
 *
 * Never `chip.set`/`chip.change` with the label above spliced in: that pair's `{label}` is
 * the COLUMN's display name — the user's own word, data — and handing it catalog text
 * assembles a message out of two catalog pieces, which is the one thing the i18n rule
 * ("the sentence is the unit") exists to refuse. Four keys is what that costs.
 */
function chipName(spec: ChipSpec): string {
	if (spec.field === 'effort') {
		return spec.value === null ? t('release.scope.effortChipSet') : t('release.scope.effortChipChange', { value: spec.value });
	}
	return spec.value === null ? t('release.scope.riskChipSet') : t('release.scope.riskChipChange', { value: spec.value });
}

function effortText(app: App, row: ScopeRow, settings: ReleaseSettings): string | null {
	const raw: unknown = ownValue(app.metadataCache.getFileCache(row.item.file)?.frontmatter, settings.estimateKey);
	const value = estimateValue(raw);
	return value === null ? null : String(value);
}

function riskText(app: App, row: ScopeRow, settings: ReleaseSettings): string | null {
	const raw: unknown = ownValue(app.metadataCache.getFileCache(row.item.file)?.frontmatter, settings.riskKey);
	return readString(raw);
}

/**
 * The effort dialog — the chip's own click and the row menu's `Set effort` both call this
 * and nothing else, so neither can come to plan a different write.
 *
 * **The KEY is captured here; the VALUE is read at SUBMIT**, and the two are opposite halves
 * of one rule rather than an inconsistency. The capture-before-the-await rule is about the
 * vocabulary that NAMES the write — a `.base` re-pointed while the dialog is open must not
 * land the reader's text on a property they never saw, which `applyRelease` then re-asks
 * through `reconfiguredKey` against the settings as they are at apply time. The member's own
 * value is the opposite question: the prompt outlives the model that opened it
 * (`scopeCreate.ts` re-reads its release for the same reason), so a note that moved while the
 * box was open would otherwise make a retype of the value on screen plan NOTHING — the
 * reader's one edit dropped in silence.
 *
 * Not exported: both inputs that call it — the chip's own click (`wireReadinessChips`) and
 * the row menu's `Set effort` (`addReadinessItems`) — live in this same file.
 */
function editMemberEffort(view: ReleaseView, row: ScopeRow): void {
	const key = view.settings.estimateKey;
	new ValuePromptModal(view.app, {
		title: t('release.scope.effortTitle', { name: row.item.title }),
		fieldName: key,
		placeholder: t('release.scope.effortPlaceholder'),
		ctaLabel: t('release.scope.effortSave'),
		known: [],
		onClosed: () => focusChip(view, row, 'effort'),
		// The member re-read HERE rather than above — see this function's own header.
		onSubmit: (value) =>
			void applyAndRefocus(
				view,
				memberEffortWrites(row.item.file, key, ownValue(view.app.metadataCache.getFileCache(row.item.file)?.frontmatter, key), value),
				row,
				'effort',
			),
	}).open();
}

/**
 * The risk choices, built into whatever container they are handed — `addRiskItems`'s own
 * shape (`interactions/labels.ts`): a standalone `Menu` for the chip's own click
 * (`showMemberRiskMenu`, below) and a true submenu, via `submenuOf`, for the row menu's
 * `Set risk` entry (`addReadinessItems`). One content builder either way, so the two
 * inputs cannot offer different values or disagree about which is checked — the "one
 * move, two inputs" rule is about the WRITE, and stays one method; the CONTAINER is each
 * caller's own, the same split every sibling entry in this plugin (Set risk, Set
 * priority, Set assignee, Set state, Set horizon, Set iteration, Set release, all in
 * `interactions/menu.ts` and `interactions/labels.ts`) already makes.
 *
 * **The checkmark is asked of the PLAN** — an entry is checked exactly when picking it
 * would write nothing — never a comparison written beside the plan. `Clear risk` is offered
 * only where the note carries a readable value, the presence gate every removal in this
 * plugin uses (`releaseEdits.ts`'s own `Clear status`): an action that would write nothing
 * is not an action.
 *
 * **`current` is read when the menu is BUILT, and that is deliberate** — the opposite half
 * of {@link editMemberEffort}'s own correction. Both entries and checkmarks are decided from
 * one reading, so re-reading per pick would let the offer and the plan disagree about the
 * same note; and a menu's lifetime is a click, not a reader typing into a box, so the window
 * a stale value could survive is as narrow as every other menu in this plugin already lives
 * with.
 */
function addMemberRiskItems(view: ReleaseView, menu: Menu, row: ScopeRow, riskChoices: string[]): void {
	const key = view.settings.riskKey;
	const current = riskText(view.app, row, view.settings);
	for (const choice of riskChoices) {
		const writes = memberRiskWrites(row.item.file, key, current, choice);
		menu.addItem((mi) =>
			mi
				.setTitle(choice)
				.setChecked(writes.length === 0)
				.onClick(() => void applyAndRefocus(view, writes, row, 'risk')),
		);
	}
	if (current !== null) {
		menu.addSeparator();
		menu.addItem((mi) =>
			mi
				.setTitle(t('release.scope.clearRisk'))
				.setIcon('eraser')
				.onClick(() => void applyAndRefocus(view, memberRiskWrites(row.item.file, key, current, null), row, 'risk')),
		);
	}
}

/** The chip's own click — a standalone menu, shown at the click. Not exported:
 *  `wireReadinessChips`, this file's own, is the one caller. */
function showMemberRiskMenu(view: ReleaseView, evt: MouseEvent, row: ScopeRow, riskChoices: string[]): void {
	const menu = new Menu();
	addMemberRiskItems(view, menu, row, riskChoices);
	showMenuForClick(menu, evt);
}

/**
 * `setSubmenu` is missing from the published obsidian typings, not from the app —
 * `interactions/menu.ts`'s own `submenuOf` states the identical reason: submenus predate
 * the 1.12.0 this plugin requires, so the cast asserts what is always there rather than
 * guarding against its absence.
 */
function submenuOf(item: MenuItem): Menu {
	return (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();
}

/**
 * The row menu's own two entries — `scopeCreate.ts`'s `scopeMenu` calls this after its type
 * entries and returns the built menu when EITHER half added something. Withheld whole on a
 * CONTEXT row, which is what keeps a catalog row (always context here — it can never be a
 * release member) from offering either without a second check for it.
 *
 * `Set risk` is a true submenu (`submenuOf`), never a second `showMenuAtElement` popup —
 * the shape `addMemberRiskItems`'s own header states, and the one every sibling entry in
 * this plugin already uses.
 */
export function addReadinessItems(view: ReleaseView, menu: Menu, row: ScopeRow, riskChoices: string[]): boolean {
	if (row.context) return false;
	let added = false;
	if (view.settings.estimateKey !== '') {
		added = true;
		menu.addItem((mi) =>
			mi
				.setTitle(t('release.scope.setEffort'))
				.setIcon('ruler')
				.onClick(() => editMemberEffort(view, row)),
		);
	}
	if (view.settings.riskKey !== '' && riskChoices.length > 0) {
		added = true;
		menu.addItem((mi) => {
			mi.setTitle(t('release.scope.setRisk')).setIcon('shield-alert');
			addMemberRiskItems(view, submenuOf(mi), row, riskChoices);
		});
	}
	return added;
}

/**
 * The chip's own delegated listener — ONE on `treeEl`, never per row
 * (`src/view/CLAUDE.md`: a data update rebuilds rows without rebuilding listeners, so a
 * captured item goes stale). The row is resolved by the enclosing `.pbl-row`'s `data-path`
 * against `draw.rows`, never captured from the render that drew it.
 *
 * **Must not also open the note.** `wireRowOpen` (`scopeRow.ts`) already refuses to open a
 * note for a click that began on ANY button inside the row — this chip included, since
 * `drawChip` draws a real `<button>` — so nothing here has to repeat that guard.
 *
 * `settings` is read once per click rather than trusted from the closure alone: a chip only
 * exists on screen because its field was configured when the tree was drawn, but the guard
 * costs nothing and keeps this listener honest about the same gate `drawReadinessChips`
 * draws by.
 */
export function wireReadinessChips(view: ReleaseView, draw: TreeDraw, settings: ReleaseSettings, riskChoices: string[]): void {
	draw.treeEl.addEventListener('click', (evt) => {
		const chipEl = evt.target instanceof Element ? evt.target.closest<HTMLElement>('.pbl-state-chip') : null;
		if (!chipEl) return;
		const field = chipEl.dataset.field;
		if (field !== 'effort' && field !== 'risk') return;
		if (field === 'effort' && settings.estimateKey === '') return;
		if (field === 'risk' && settings.riskKey === '') return;
		const path = chipEl.closest('.pbl-row')?.getAttribute('data-path');
		const row = draw.rows.find((r) => r.item.file.path === path);
		if (!row) return;
		if (field === 'effort') editMemberEffort(view, row);
		else showMemberRiskMenu(view, evt, row, riskChoices);
	});
}

/**
 * Apply the batch and put focus back on the chip that opened it — `releaseEdits.ts`'s own
 * `save`, over a per-ROW control rather than one per screen.
 *
 * **And refuse a CONTEXT row here, which is the whole of what keeps a member write off
 * one THROUGH THIS MODULE.** This is the single funnel every input in `scopeChips.ts` for
 * either field passes through, so the rule is stated at the write rather than at the two
 * places that withhold a control — the check that holds for a fourth input added HERE,
 * which is what the module header's own paragraph on the gate explains this cannot borrow
 * from `ReleaseView`. **It is not a check on the write planners or on `applyRelease`
 * themselves** — see that same paragraph for what reaching either directly, from outside
 * this module, is not stopped by. Unreachable from the screen as it stands, so it says so
 * to the console rather than to the reader: a Notice would be a sentence nobody can
 * produce.
 */
async function applyAndRefocus(view: ReleaseView, writes: ReleaseWrite[], row: ScopeRow, field: 'effort' | 'risk'): Promise<void> {
	if (row.context) {
		console.error('Product Backlog: refused a readiness write aimed at a context row', row.item.file.path);
		return;
	}
	await view.applyRelease(writes);
	focusChip(view, row, field);
}

/**
 * The chip that opened the write, looked up FRESH after the await — never captured, since
 * the write's own redraw replaces every element it drew. `releaseEdits.ts`'s `focusControl`
 * is the shape this follows; there is one control per SCREEN there and one per ROW here, so
 * the lookup matches on the row's own `data-path` plus the field rather than on a class
 * alone.
 */
function focusChip(view: ReleaseView, row: ScopeRow, field: 'effort' | 'risk'): void {
	const path = row.item.file.path;
	const chip = Array.from(view.viewEl.querySelectorAll<HTMLElement>('.pbl-state-chip')).find(
		(el) => el.dataset.field === field && el.closest('.pbl-row')?.getAttribute('data-path') === path,
	);
	chip?.focus({ preventScroll: true });
}
