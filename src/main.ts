import { Plugin } from 'obsidian';
import { CREATE_BACKLOG_COMMAND_ID, promptCreateBacklogBase } from './commands/scaffold';
import { WRITE_README_COMMAND_ID, writeBacklogReadmeCommand } from './commands/readme';
import { rekeyBase } from './storage/viewStateStore';
import { initLocale } from './i18n/t';
import { registerBacklogView } from './view/registerBacklogView';
import { registerEstimationView } from './view/estimation/register';
import { WriteLock } from './view/writeLock';

export default class ProductBacklogPlugin extends Plugin {
	onload(): void {
		initLocale();
		// ONE lock for the whole plugin: every view's writes serialize against it and
		// the undo slot is the vault's last batch, whichever view wrote it (ADR 0030).
		const lock = new WriteLock();
		registerBacklogView(this, lock);
		registerEstimationView(this, lock);
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
			name: 'Create backlog',
			callback: () => promptCreateBacklogBase(this.app),
		});
		this.addCommand({
			id: WRITE_README_COMMAND_ID,
			name: 'Write backlog readme',
			// A check callback, not a plain one: the document is generated from the active
			// view's configuration, so with no such view there is nothing to describe and
			// the command hides rather than writing something from the defaults.
			checkCallback: (checking) => writeBacklogReadmeCommand(this.app, checking),
		});
	}
}
