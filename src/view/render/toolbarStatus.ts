import { BasesQueryResult, setIcon, setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel, iterationResults } from '../../domain/model';
import { displayType, isDeliverableType } from '../../domain/itemTypes';
import { setTextIfChanged } from './toolbarControls';
import { projectionPopulation } from '../projection';

/**
 * The hierarchy is the tree's grouping and the workflow is the board's; a group-by
 * configured on the Base has no effect, and the toolbar note above says so. This
 * detects that there is one to say it about.
 */
export function detectIgnoredGrouping(data: BasesQueryResult | null | undefined): boolean {
	try {
		const groups = data?.groupedData;
		if (!groups || groups.length === 0) return false;
		return groups.length > 1 || groups[0].hasKey();
	} catch {
		return false;
	}
}

/**
 * The toolbar survives content-only renders (the filter keeps its input focus), so
 * the count is synced imperatively per pass. The Base's own results: ancestors
 * loaded for context are not items of this base and must not inflate the number.
 * Collapsed rows still count as shown — only filtering and hiding narrow it,
 * which `isRowHidden` covers both of, in both projections. The Deliverables board is
 * scoped a third way: its population is `model.deliverableResults` — every
 * Deliverable-typed result, regardless of any active focus level, never the whole
 * base — hidden by the filter-only predicate that board itself renders with rather
 * than the "Show completed items" one, since that toggle does not apply there. Also
 * fixes the label's own tooltip, which used to be set once by `renderToolbar` at
 * full-render time and never rescoped here — so it could disagree with the text
 * sitting right next to it.
 *
 * The requirements board is scoped a FOURTH way, for the opposite reason the
 * Deliverables board is scoped at all: Deliverables are managed on their own board now
 * (`renderRequirementsBoard`), so counting one here would claim the board shows more
 * than it does. The tree and the roadmap keep every item — this scoping is the
 * `'board'` projection alone.
 */
export function syncCountLabel(host: BacklogViewHost, barEl: HTMLElement): void {
	const label = barEl.querySelector<HTMLElement>('.pbl-count-label');
	const model = host.model;
	if (!label || !model) return;
	const population = countedPopulation(host, model);
	// `isRowHidden` answers per projection now, the Deliverables board's own exception
	// included, so this asks the one question rather than choosing between two.
	const total = population.length;
	const shown = population.filter((item) => !host.isRowHidden(item)).length;
	setTextIfChanged(label, shown === total ? t('count.items', { count: total }) : t('count.shownOfTotal', { shown, total }));
	// The tooltip is guarded the same way and for a sharper reason than the text: this
	// element is `aria-live`, and `setTooltip` attaches Obsidian's hover handling on every
	// call and has set `aria-label` in some versions — see `syncBusyLabel`, which avoids
	// it entirely for exactly that. The last breakdown is kept in `dataset` because
	// nothing can read a tooltip back off an element, and a `data-` attribute is not a
	// mutation any live region reports.
	const breakdown = levelBreakdown(population);
	if (label.dataset.pblBreakdown === breakdown) return;
	label.dataset.pblBreakdown = breakdown;
	setTooltip(label, breakdown);
}

/**
 * Notes the base returned that aren't backlog items are silently skipped — say so,
 * so a missing note is never a mystery, and point at the option that brings them back.
 */
export function renderIgnoredNote(barEl: HTMLElement, model: BacklogModel): void {
	if (model.ignoredCount === 0) return;
	const n = model.ignoredCount;
	const note = barEl.createDiv({ cls: 'pbl-toolbar-note pbl-ignored-note' });
	setIcon(note.createSpan({ cls: 'pbl-toolbar-note-icon' }), 'filter-x');
	note.createSpan({ text: t('toolbar.ignoredNotes', { count: n }) });
	setTooltip(note, t('toolbar.ignoredTooltip', { count: n }));
}

/**
 * What this projection is counting — its own population, which is not the same question
 * for all six. The Deliverables board draws `model.deliverableResults`; the
 * requirements board draws every result EXCEPT a Deliverable, which it excludes by
 * construction; the test catalog draws its own forest's results; and the tree and the
 * roadmap draw what is left, which is the PLAN's population — `model.results` excludes
 * the catalog already, so the tests leave three of these numbers without a branch here.
 *
 * One function because two toolbar readouts sit beside each other and have to agree:
 * the count label and the completed toggle's "(N hidden)". They did not — the label was
 * scoped and the toggle was not, so the requirements board could report one item while
 * offering to reveal another that pressing the button would never show.
 */
export function countedPopulation(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	if (host.projection === 'deliverables') return model.deliverableResults;
	if (host.projection === 'board') return model.results.filter((item) => !isDeliverableType(item.typeName));
	// This scope's CARRIERS, which `iterationResults` already returns with the excluded
	// ancestors mixed in — they are placement rather than population, so they are dropped
	// here by the same `outsideFilter` test every other count in this codebase makes.
	// `effectiveScope` and not `boardScope`: a stale path draws the product board, and a
	// count that answered otherwise would report zero items over a board full of them.
	if (host.effectiveScope !== null) {
		return iterationResults(model, host.effectiveScope).filter((item) => !item.outsideFilter);
	}
	// The catalog's own RESULTS — the tests and the `Task`s beneath them, no context row.
	// Not "tests and only tests", which is a re-listed population that disagrees with the
	// membership rule about a `Task`; and not "what it draws" either, which would sweep in
	// a `Test case` present only as an excluded ancestor.
	return projectionPopulation(host.projection, model).results;
}

/** e.g. "2 Epic · 4 Feature · 9 PBI · 3 Bug" for the item-count tooltip, over whichever population is passed. */
export function levelBreakdown(items: BacklogItem[]): string {
	const byLevel = new Map<string, number>();
	for (const item of items) {
		const label = displayType(item) || 'Untyped';
		byLevel.set(label, (byLevel.get(label) ?? 0) + 1);
	}
	return [...byLevel].map(([label, n]) => `${n} ${label}`).join(' · ');
}
