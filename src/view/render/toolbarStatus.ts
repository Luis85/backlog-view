import { BasesQueryResult, setIcon, setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel, iterationResults } from '../../domain/model';
import { displayType, isDeliverableType } from '../../domain/itemTypes';
import { setTextIfChanged } from './toolbarControls';
import { projectionPopulation } from '../projection';
import { onThisRoadmap } from '../../domain/roadmap';

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
 * The toolbar survives content-only renders — the shelf's own controls keep their focus
 * and their DOM across one — so the count is synced imperatively per pass rather than
 * rebuilt. The Base's own results: ancestors
 * loaded for context are not items of this base and must not inflate the number.
 * Collapsed rows still count as shown — only membership and the completed toggle narrow
 * it, which `isRowHidden` covers both of, in every projection. The Deliverables board is
 * scoped a third way: its population is `model.deliverableResults` — every
 * Deliverable-typed result, regardless of any active focus level, never the whole
 * base — and `isRowHidden` answers per projection, so the "Show completed items" toggle
 * it does not honour is already off in the one predicate rather than dodged here. Also
 * fixes the label's own tooltip, which used to be set once by `renderToolbar` at
 * full-render time and never rescoped here — so it could disagree with the text
 * sitting right next to it.
 *
 * The requirements board is scoped a FOURTH way, for the opposite reason the
 * Deliverables board is scoped at all: Deliverables are managed on their own board now
 * (`renderRequirementsBoard`), so counting one here would claim the board shows more
 * than it does. The roadmap is scoped a fifth way, by its own population statement
 * (`onThisRoadmap`); the TREE is the one projection that keeps every item.
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
 * construction; the test catalog draws its own forest's results; the roadmap draws every
 * result its axes can place; and the tree draws what is left, which is the PLAN's
 * population — `model.results` excludes the catalog already, so the tests leave that last
 * number without a branch here.
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
	// The ROADMAP is scoped a fifth way, and by the projection's own statement of its
	// population rather than by a rule spelled here: no axis of it places a `Release`
	// (`onThisRoadmap`), so counting one claims the screen holds an item it does not draw.
	// A base of nothing but releases said "1 item" beside an advisory saying the roadmap
	// was empty — and a mixed base inflated both this number and the completed toggle's.
	// The FOCUS is answered elsewhere and must not be answered again here: a focus this
	// roadmap cannot draw is already gone from `settings` (`honouredFocusLevel`), so
	// `model.results` is the right population and re-deriving one would be a second opinion
	// about which rows are on this roadmap.
	if (host.projection === 'roadmap') return model.results.filter(onThisRoadmap);
	// The catalog's own RESULTS — the tests and the `Task`s beneath them, no context row.
	// Not "tests and only tests", which is a re-listed population that disagrees with the
	// membership rule about a `Task`; and not "what it draws" either, which would sweep in
	// a `Test case` present only as an excluded ancestor.
	return projectionPopulation(host.projection, model).results;
}

/**
 * e.g. "2 Epic · 4 Feature · 9 PBI · 3 Bug" for the item-count tooltip, over whichever
 * population is passed.
 *
 * The ` · ` is a separator between readings and NOT a list joined as grammar, which is
 * why it stays a literal here while `list()` exists two modules away: this is a row of
 * labels, not a sentence, and joining it with a conjunction would say "2 Epic, 4 Feature
 * and 9 PBI" about a tooltip that is counting. Each reading is a key, so a locale that
 * puts the count after the type can.
 */
export function levelBreakdown(items: BacklogItem[]): string {
	const byLevel = new Map<string, number>();
	for (const item of items) {
		const label = displayType(item) || t('toolbar.untyped');
		byLevel.set(label, (byLevel.get(label) ?? 0) + 1);
	}
	return [...byLevel].map(([label, n]) => t('toolbar.levelCount', { count: n, type: label })).join(' · ');
}
