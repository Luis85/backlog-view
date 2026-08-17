import { Plugin } from 'obsidian';
import { getViewOptions } from '../domain/viewOptions';
import { PRODUCT_BACKLOG_VIEW_TYPE, ProductBacklogView } from './backlogView';
import { WriteLock } from './writeLock';

/**
 * The backlog view's own registration — one file per view, so adding a
 * capability adds a file rather than a branch in main (ADR 0030,
 * [[A view type per capability]]). The lock arrives from main because the
 * write path is the one piece of plugin-wide runtime state.
 */
export function registerBacklogView(plugin: Plugin, lock: WriteLock): void {
	plugin.registerBasesView(PRODUCT_BACKLOG_VIEW_TYPE, {
		name: 'Product Backlog',
		icon: 'lucide-list-tree',
		factory: (controller, containerEl) => new ProductBacklogView(controller, containerEl, lock),
		options: getViewOptions,
	});
}
