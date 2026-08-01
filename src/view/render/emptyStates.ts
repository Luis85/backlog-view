import { setIcon } from 'obsidian';
import { BacklogViewHost } from '../host';
import { newItemLevel, promptCreateItem } from '../interactions/create';

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
	const topLevel = focused && model ? newItemLevel(host.settings, model) : host.settings.levels[0];
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
	btn.addEventListener('click', () => promptCreateItem(host, topLevel, null));
}

/**
 * The empty state has to tell the truth about *why* it is empty: a base full of
 * plain notes is a different problem than a base with nothing in it.
 */
function emptyHint(host: BacklogViewHost, focused: boolean, topLevel: string): string {
	if (focused) {
		return `Nothing at the "${topLevel}" level matches this view. Switch the level button in the toolbar back to "All levels", or create a ${topLevel}.`;
	}
	const ignored = host.model?.ignoredCount ?? 0;
	if (ignored > 0) {
		return `${ignored} note${ignored === 1 ? '' : 's'} in this base ${ignored === 1 ? 'has' : 'have'} no supported type and no parent, so ${ignored === 1 ? 'it is' : 'they are'} not treated as backlog items. Create your first ${topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.`;
	}
	return `Point this base's filter at your backlog folder, then create your first ${topLevel}. New items automatically get the parent, order and type properties this view needs.`;
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
