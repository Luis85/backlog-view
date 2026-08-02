import { setIcon } from 'obsidian';
import { BacklogViewHost } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { LEVELS } from '../../domain/settings';

/**
 * What the tree shows when it has no rows to show. Each of these runs at most once
 * per render and shares nothing with the per-row path — `renderTree` decides *which*
 * one applies, because that decision reads the model, and calls in here to draw it.
 */

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
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), 'list-tree');
	empty.createDiv({
		cls: 'pbl-empty-title',
		text: focused ? `No ${topLevel} items` : 'No backlog items',
	});
	empty.createDiv({ cls: 'pbl-empty-hint', text: emptyHint(host, focused, topLevel) });
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
export function renderBoardNoWorkflowState(treeEl: HTMLElement): void {
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), 'square-kanban');
	empty.createDiv({ cls: 'pbl-empty-title', text: 'No workflow to show' });
	empty.createDiv({
		cls: 'pbl-empty-hint',
		text:
			'The board is a projection of your workflow, and this view has no state property yet. ' +
			'Set "State property" in the view options — and optionally "Workflow states (in order)" — ' +
			'and the board will draw one column per state.',
	});
}

/**
 * Roadmap mode with no axis configured: guidance naming both ways to get one and
 * where each is set. The one roadmap case with no frame — a frame here would be
 * a lie about an axis that does not exist — and when a horizon property is set
 * but its values were cleared, the guidance names the half that is missing
 * rather than inventing a vocabulary.
 */
export function renderRoadmapNoAxisState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), 'map');
	empty.createDiv({ cls: 'pbl-empty-title', text: 'No axis to show' });
	const halfConfigured = host.settings.horizonKey !== '' && host.settings.horizonValues.length === 0;
	const horizonHalf = halfConfigured
		? 'A horizon property is set, but "Horizons (in order)" is empty — fill it to get Now-Next-Later buckets'
		: 'Set "Horizon property" and "Horizons (in order)" for Now-Next-Later buckets';
	empty.createDiv({
		cls: 'pbl-empty-hint',
		text:
			'The roadmap draws whichever axis the view options declare — confidence horizons, or dates. ' +
			`${horizonHalf}, or set "Start date property" or "Target date property" for a timeline.`,
	});
}

export function renderFilterEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), 'search-x');
	empty.createDiv({ text: `No items match "${host.filterText.trim()}".` });
	const btn = empty.createEl('button', { text: 'Clear filter' });
	btn.addEventListener('click', () => {
		host.setFilter('');
		host.focusFilter();
	});
}

/** Everything is done and hidden — celebrate, and offer the way back. */
export function renderAllDoneState(host: BacklogViewHost, treeEl: HTMLElement, total: number): void {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), 'circle-check');
	empty.createDiv({ text: `All ${total} item${total === 1 ? ' is' : 's are'} done and hidden.` });
	const btn = empty.createEl('button', { text: 'Show completed items' });
	btn.addEventListener('click', () => host.config.set('showCompleted', true));
}
