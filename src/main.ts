import { Plugin } from 'obsidian';
import { CREATE_BACKLOG_COMMAND_ID, promptCreateBacklogBase } from './commands/scaffold';
import { WRITE_README_COMMAND_ID, writeBacklogReadmeCommand } from './commands/readme';
import { rekeyBase } from './storage/viewStateStore';
import { getViewOptions } from './domain/viewOptions';
import { initLocale, t } from './i18n/t';
import { PRODUCT_BACKLOG_VIEW_TYPE, ProductBacklogView } from './view/backlogView';

export default class ProductBacklogPlugin extends Plugin {
	onload(): void {
		// Once, before anything registers a name: Obsidian needs a restart to change its
		// language, so re-reading it per render would be cost with no observable benefit.
		initLocale();
		this.registerBasesView(PRODUCT_BACKLOG_VIEW_TYPE, {
			// The plugin's own NAME, which `Every surface translated` says is never
			// translated: Obsidian prefixes every command with it in the palette and it is
			// this plugin's identity in the community list. Disabled at the line rather
			// than exempting the file, `ui/manualDialog.ts`'s nav heading exactly — a
			// second literal added to this call still fails.
			// eslint-disable-next-line no-restricted-syntax -- the plugin's own name, which this epic says is never translated
			name: 'Product Backlog',
			icon: 'lucide-list-tree',
			factory: (controller, containerEl) => new ProductBacklogView(controller, containerEl),
			options: getViewOptions,
		});
		// View state is keyed on the base's path, so it has to follow the file.
		// The open view re-resolves its own identity when it saves; this covers the
		// bases that are not open, whose entries would otherwise be orphaned and then
		// pruned for naming a path that no longer exists. Not filtered to `.base`
		// files: a folder move renames the folder, not the base inside it, and
		// rekeyBase already ignores a rename that no entry sits under.
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => rekeyBase(this.app, oldPath, file.path)));
		this.addCommand({
			id: CREATE_BACKLOG_COMMAND_ID,
			// Obsidian prefixes command names with the plugin name in the palette.
			name: t('command.createBacklog'),
			callback: () => promptCreateBacklogBase(this.app),
		});
		this.addCommand({
			id: WRITE_README_COMMAND_ID,
			name: t('command.writeReadme'),
			// A check callback, not a plain one: the document is generated from the active
			// view's configuration, so with no such view there is nothing to describe and
			// the command hides rather than writing something from the defaults.
			checkCallback: (checking) => writeBacklogReadmeCommand(this.app, checking),
		});
	}
}
