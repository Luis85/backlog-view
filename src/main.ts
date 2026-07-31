import { Plugin } from 'obsidian';
import { promptCreateBacklogBase } from './commands/scaffold';
import { getViewOptions } from './domain/settings';
import { PRODUCT_BACKLOG_VIEW_TYPE, ProductBacklogView } from './view/backlogView';

export default class ProductBacklogPlugin extends Plugin {
	onload(): void {
		this.registerBasesView(PRODUCT_BACKLOG_VIEW_TYPE, {
			name: 'Product Backlog',
			icon: 'lucide-list-tree',
			factory: (controller, containerEl) => new ProductBacklogView(controller, containerEl),
			options: getViewOptions,
		});
		this.addCommand({
			id: 'create-backlog',
			// Obsidian prefixes command names with the plugin name in the palette.
			name: 'Create backlog',
			callback: () => promptCreateBacklogBase(this.app),
		});
	}
}
