import { App, setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { ownValue, readString } from '../../domain/noteFields';
import { estimateValue } from '../../domain/releaseReadiness';
import { ReleaseSettings } from '../../domain/releaseOptions';
import { ScopeRow } from '../../domain/scopeRows';

/**
 * The two values a member can be given from the release screen — its effort and its risk —
 * drawn as the tree's own chip and, in Task 8, opening the same writes the row menu does.
 *
 * **A CONTEXT row draws the cells and neither chip.** An excluded ancestor is scaffolding:
 * it is in no denominator and is never a write target, so a control on it would offer a
 * write the gate refuses whole. The empty cell stays, because every column a row can draw
 * is drawn on every row or the columns after it shift per row (`src/view/CLAUDE.md`).
 *
 * **An unset value draws a DASHED chip rather than nothing**, which is the tree's own rule
 * for risk and priority (`src/view/CLAUDE.md`'s label-chip section): absence here is an
 * invitation, not a placement something else already names.
 *
 * `row.item` carries no frontmatter of its own (`BacklogItem` has none) — both readers take
 * the `App` and read `getFileCache(...)?.frontmatter`, the same door `releaseReadiness.ts`'s
 * `estimateOf` reads through, so this can never disagree with the figures the header sums.
 *
 * This task DRAWS and wires nothing: both buttons carry no click listener, and their
 * keyboard path (the row menu) is Task 8's.
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

/** The action and the value it holds — the tree's own two chip names, both halves DATA. */
function chipName(spec: ChipSpec): string {
	return spec.value === null ? t('chip.set', { label: spec.label }) : t('chip.change', { label: spec.label, value: spec.value });
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
