import { Plugin } from 'obsidian';
import { CREATE_BACKLOG_COMMAND_ID, promptCreateBacklogBase } from './commands/scaffold';
import { rekeyBase } from './storage/collapseStore';
import { getViewOptions } from './domain/viewOptions';
import { PRODUCT_BACKLOG_VIEW_TYPE, ProductBacklogView } from './view/backlogView';

export default class ProductBacklogPlugin extends Plugin {
	onload(): void {
		this.registerBasesView(PRODUCT_BACKLOG_VIEW_TYPE, {
			name: 'Product Backlog',
			icon: 'lucide-list-tree',
			factory: (controller, containerEl) => new ProductBacklogView(controller, containerEl),
			options: getViewOptions,
		});
		// Collapse state is keyed on the base's path, so it has to follow the file.
		// The open view re-resolves its own identity when it saves; this covers the
		// bases that are not open, whose entries would otherwise be orphaned and then
		// pruned for naming a path that no longer exists. Not filtered to `.base`
		// files: a folder move renames the folder, not the base inside it, and
		// rekeyBase already ignores a rename that no entry sits under.
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => rekeyBase(this.app, oldPath, file.path)));
		this.addCommand({
			id: CREATE_BACKLOG_COMMAND_ID,
			// Obsidian prefixes command names with the plugin name in the palette.
			name: 'Create backlog',
			callback: () => promptCreateBacklogBase(this.app),
		});
	}
}
