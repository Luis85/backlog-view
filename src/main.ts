import { Plugin } from 'obsidian';
import { CREATE_BACKLOG_COMMAND_ID, promptCreateBacklogBase } from './commands/scaffold';
import { WRITE_README_COMMAND_ID, writeBacklogReadmeCommand } from './commands/readme';
import { rekeyBase, renamePathPrefs } from './storage/viewStateStore';
import { initLocale, t } from './i18n/t';
import { registerBacklogView } from './view/registerBacklogView';
import { registerEstimationView } from './view/estimation/register';
import { registerReleaseView } from './view/release/register';
import { WriteLock } from './view/writeLock';

export default class ProductBacklogPlugin extends Plugin {
	onload(): void {
		// Once, before anything registers a name: Obsidian needs a restart to change its
		// language, so re-reading it per render would be cost with no observable benefit.
		initLocale();
		// ONE lock for the whole plugin: every view's writes serialize against it and
		// the undo slot is the vault's last batch, whichever view wrote it (ADR 0030).
		const lock = new WriteLock();
		registerBacklogView(this, lock);
		registerEstimationView(this, lock);
		// No lock: this view creates notes and its own config but edits none, so it plans
		// no batch and has no gate to build from one (see `registerReleaseView`).
		registerReleaseView(this);
		// View state is keyed on the base's path, so it has to follow the file.
		// The open view re-resolves its own identity when it saves; this covers the
		// bases that are not open, whose entries would otherwise be orphaned and then
		// pruned for naming a path that no longer exists. Not filtered to `.base`
		// files: a folder move renames the folder, not the base inside it, and
		// rekeyBase already ignores a rename that no entry sits under.
		//
		// The same event asked a second question, about what an entry HOLDS rather than
		// which base it belongs to: two stored picks are NOTE paths (the board's iteration
		// scope and the release view's open release), and a stale one resolves to nothing.
		// For the release that is worse than a lost position — the view falls back to its
		// index without a word, so a renamed note reads exactly like a deleted one. Here
		// rather than on a view for `rekeyBase`'s own reason: the pick belongs to a saved
		// view, not to whichever view happens to be loaded, and the release view is
		// normally the only one on screen.
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				rekeyBase(this.app, oldPath, file.path);
				renamePathPrefs(this.app, oldPath, file.path);
			}),
		);
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
