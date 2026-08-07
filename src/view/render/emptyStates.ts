import { setIcon } from 'obsidian';
import { BacklogViewHost } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { runInit } from '../interactions/structure';
import { isDeliverableType } from '../../domain/itemTypes';
import { adoptableProperties, LEVELS, OptionalField } from '../../domain/settings';

/**
 * What the tree shows when it has no rows to show. Each of these runs at most once
 * per render and shares nothing with the per-row path — `renderTree` decides *which*
 * one applies, because that decision reads the model, and calls in here to draw it.
 */

/**
 * The shell every piece of *guidance* shares — icon, title, hint — returned so the
 * caller can add the one action that differs. Written once because the class names are
 * the contract `docs/requirements/One stylesheet per concern.md` maps to this module,
 * and five hand-written copies of them are five places a rename has to land.
 */
function guidanceShell(treeEl: HTMLElement, icon: string, title: string, hint: string): HTMLElement {
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), icon);
	empty.createDiv({ cls: 'pbl-empty-title', text: title });
	empty.createDiv({ cls: 'pbl-empty-hint', text: hint });
	return empty;
}

/**
 * The lighter shell the two *transient* states share — nothing is wrong, something is
 * merely hidden — one line of text and a way back, on its own class so the stylesheet
 * can treat it differently from guidance.
 */
function noticeShell(treeEl: HTMLElement, icon: string, text: string): HTMLElement {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), icon);
	empty.createDiv({ text });
	return empty;
}

/**
 * Shown from construction until Bases delivers the first result set. There is no
 * model to render before that, and a blank pane reads as a broken view rather than
 * a working one — the first render replaces this wholesale.
 */
export function renderLoadingState(treeEl: HTMLElement): void {
	const loading = treeEl.createDiv({ cls: 'pbl-loading', attr: { role: 'status', 'aria-live': 'polite' } });
	setIcon(loading.createDiv({ cls: 'pbl-loading-spinner' }), 'loader-2');
	loading.createDiv({ text: 'Loading backlog…' });
}

export function renderEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const model = host.model;
	const focused = model?.focused ?? false;
	const topLevel = focused && model ? newItemType(host.settings, model) : LEVELS[0];
	const empty = guidanceShell(
		treeEl,
		'list-tree',
		focused ? `No ${topLevel} items` : 'No backlog items',
		emptyHint(host, focused, topLevel),
	);
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	btn.createSpan({ text: `New ${topLevel}` });
	btn.addEventListener('click', () => promptCreateItem(host, [topLevel], null));
}

/**
 * The empty state has to tell the truth about *why* it is empty: a base full of
 * plain notes is a different problem than a base with nothing in it.
 */
function emptyHint(host: BacklogViewHost, focused: boolean, topLevel: string): string {
	if (focused) {
		return `Nothing typed "${topLevel}" matches this view. Switch the focus button in the toolbar back to "All types", or create a ${topLevel}.`;
	}
	const ignored = host.model?.ignoredCount ?? 0;
	if (ignored > 0) {
		return `${ignored} note${ignored === 1 ? '' : 's'} in this base ${ignored === 1 ? 'has' : 'have'} no supported type and no parent, so ${ignored === 1 ? 'it is' : 'they are'} not treated as backlog items. Create your first ${topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.`;
	}
	return `Point this base's filter at your backlog folder, then create your first ${topLevel}. New items automatically get the parent, order and type properties this view needs.`;
}

/**
 * Board mode without a state property: there is no workflow to draw, so this is
 * guidance rather than a board — a board here would be a lie about a workflow that
 * does not exist. The one board case with no columns, and it names the option to
 * set and where, never a blank pane.
 */
export function renderBoardNoWorkflowState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(
		treeEl,
		'square-kanban',
		'No workflow to show',
		'The board is a projection of your workflow, and this view has no state property yet. ' +
			'Set "State property" in the view options — and optionally "Workflow states (in order)" — ' +
			'and the board will draw one column per state.',
	);
	renderSetupCta(host, empty, ['state']);
}

/**
 * The Deliverables board without its own workflow configured — the same "no lie about
 * a workflow that does not exist" rule `renderBoardNoWorkflowState` states, for the
 * second workflow.
 */
export function renderDeliverablesBoardNoWorkflowState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(
		treeEl,
		'square-kanban',
		'No workflow to show',
		'The Deliverables board is a projection of its own workflow, and this view has no ' +
			'Deliverable state property yet. Set "Deliverable state property" in the view ' +
			'options — and optionally "Deliverable workflow states (in order)" — and the ' +
			'board will draw one column per state.',
	);
	renderSetupCta(host, empty, ['deliverableState']);
}

/**
 * A configured Deliverable workflow with no Deliverable-typed results in the currently
 * shown population — distinct from "everything is done and hidden", which this board
 * has no concept of (Scope): a base full of other work is never reported as complete.
 *
 * **Found by review: `model.results` is narrowed to the focused subtree while a focus
 * is active (Task 16's own note on `renderDeliverablesBoard`), so an unqualified
 * "no deliverables yet" is false the moment a Deliverable exists elsewhere in the base
 * but not under the current focus.** This reuses the same `model.focused` distinction
 * `renderEmptyState`/`emptyHint` (this file, existing) already draw for the identical
 * problem on the tree — word the guidance in terms of the current focus and name the
 * way back, rather than inventing a second "does the WHOLE base have one" query no
 * other empty state here makes either.
 *
 * **A second gap, found by a later review round: the focused guidance must not offer
 * "create one here" as an alternative to clearing focus — except where it truthfully
 * can.** The toolbar's New button creates a Deliverable with no parent
 * (`promptCreateItem(host, ['Deliverable'], null)`); a focus on a LEVEL like
 * `Feature` only admits a new root when the root's own type matches that level
 * (`collectFocusRoots`' `matches`), and a Deliverable never does — UNLESS the focus
 * is `PBI` itself (`extraFocused`, `EXTRA_TYPE_RANK`) or the focus is `Deliverable`
 * BY NAME (`focusExtra` matches `typeName` alone, regardless of subtree position).
 * Both are focuses this same focus picker offers (`ALL_TYPES`-driven, Task 1). So
 * creating from here while focused on `Feature` files a note this very board still
 * would not show — a suggestion that looks like a fix and silently is not one — but
 * creating while focused on `PBI` or `Deliverable` shows it immediately, and telling
 * the user to clear focus first in THAT case is the same kind of wrong claim in the
 * other direction. `admitsNewDeliverable` below names the two focuses that differ.
 *
 * **Found by a later review round still: this check must ask by focus TYPE, not by
 * whether the toolbar's own vocabulary loop needed editing.** `host.settings.focusLevel`
 * is read directly (`itemTypes.ts`'s own `settings.focusLevel.trim().toLowerCase()`
 * pattern) rather than through `model.focused`, which only says THAT a focus is
 * active, never which one.
 */
export function renderNoDeliverablesState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const focused = host.model?.focused ?? false;
	const focusLevel = host.settings.focusLevel.trim().toLowerCase();
	const admitsNewDeliverable = focusLevel === 'pbi' || isDeliverableType(focusLevel);
	guidanceShell(
		treeEl,
		'package',
		focused ? 'No deliverables in this focus' : 'No deliverables yet',
		focused
			? admitsNewDeliverable
				? 'Nothing typed "Deliverable" is in the current focus. Create one from the ' +
					'toolbar\'s New menu — it will appear here — or switch the focus button back ' +
					'to "All types" to see Deliverables elsewhere in the base.'
				: 'Nothing typed "Deliverable" is in the current focus. Switch the focus button ' +
					'in the toolbar back to "All types" to see Deliverables elsewhere in the base — ' +
					'or to create a new one, since one made from here would not appear on this ' +
					'board until you do.'
			: 'Nothing in this base is typed "Deliverable". Create one from the toolbar\'s New ' +
				'menu, or type an existing note as a Deliverable from its Set type menu.',
	);
}

/**
 * Roadmap mode with no axis configured: guidance naming both ways to get one and
 * where each is set. The one roadmap case with no frame — a frame here would be
 * a lie about an axis that does not exist — and when a horizon property is set
 * but its values were cleared, the guidance names the half that is missing
 * rather than inventing a vocabulary.
 */
export function renderRoadmapNoAxisState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const halfConfigured = host.settings.horizonKey !== '' && host.settings.horizonValues.length === 0;
	const horizonHalf = halfConfigured
		? 'A horizon property is set, but "Horizons (in order)" is empty — fill it to get Now-Next-Later buckets'
		: 'Set "Horizon property" and "Horizons (in order)" for Now-Next-Later buckets';
	const empty = guidanceShell(
		treeEl,
		'map',
		'No axis to show',
		'The roadmap draws whichever axis the view options declare — confidence horizons, or dates. ' +
			`${horizonHalf}, or set "Start date property" or "Target date property" for a timeline.`,
	);
	renderSetupCta(host, empty, ['horizon', 'start', 'target']);
}

/**
 * The way out of an unconfigured frame: the same action the toolbar's ✨ runs, which
 * binds the properties this view writes and creates them on the items — not a second
 * idea of what setting the view up means, so what the board and the roadmap offer
 * here cannot drift from what that button does.
 *
 * The press does the whole action, but it is offered only when one of the properties
 * THIS frame is missing can still be bound — `fixes` is that list. Asking whether
 * anything at all is adoptable is not the same question: a user who cleared the state
 * property and never touched the roadmap's would be shown a button on the board that
 * binds three horizon keys and leaves the board saying exactly what it said before.
 * An option someone CLEARED is a decision this must not overrule, so a frame whose own
 * properties are all cleared shows no button — the guidance beside it still names the
 * options to set, which is the honest answer when nothing here can be done for them.
 */
function renderSetupCta(host: BacklogViewHost, empty: HTMLElement, fixes: OptionalField[]): void {
	const adoptable = adoptableProperties(host.config, host.settings);
	if (!adoptable.some((property) => fixes.includes(property.field))) return;
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'sparkles');
	btn.createSpan({ text: 'Add the default properties' });
	btn.addEventListener('click', () => void runInit(host));
}

export function renderFilterEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = noticeShell(treeEl, 'search-x', `No items match "${host.filterText.trim()}".`);
	const btn = empty.createEl('button', { text: 'Clear filter' });
	btn.addEventListener('click', () => {
		host.setFilter('');
		host.focusFilter();
	});
}

/** Everything is done and hidden — celebrate, and offer the way back. */
export function renderAllDoneState(host: BacklogViewHost, treeEl: HTMLElement, total: number): void {
	const empty = noticeShell(treeEl, 'circle-check', `All ${total} item${total === 1 ? ' is' : 's are'} done and hidden.`);
	const btn = empty.createEl('button', { text: 'Show completed items' });
	btn.addEventListener('click', () => host.config.set('showCompleted', true));
}
