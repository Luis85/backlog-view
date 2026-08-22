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
		// The plugin's own NAME, which `Every surface translated` says is never translated:
		// Obsidian prefixes every command with it in the palette and it is this plugin's
		// identity in the community list. Disabled at the line rather than exempting the
		// file, `ui/manualDialog.ts`'s nav heading exactly — a second literal added to this
		// call still fails, and `view/estimation/register.ts`'s own `name` is ordinary UI
		// text rather than a second exemption, for exactly that reason.
		// eslint-disable-next-line no-restricted-syntax -- the plugin's own name, which this epic says is never translated
		name: 'Product Backlog',
		icon: 'lucide-list-tree',
		factory: (controller, containerEl) => new ProductBacklogView(controller, containerEl, lock),
		options: getViewOptions,
	});
}
