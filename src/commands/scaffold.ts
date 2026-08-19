import { App, Notice } from 'obsidian';
import { t } from '../i18n/t';
import { createBacklogBase, DEFAULT_BACKLOG_FOLDER } from '../storage/baseFile';
import { FolderPromptModal } from '../ui/prompts';

/**
 * The command's id, beside the flow it runs. It is persisted in the user's hotkey
 * assignments, so renaming it silently unbinds whatever they had — which is why it is a
 * named value rather than a literal at the registration site.
 */
export const CREATE_BACKLOG_COMMAND_ID = 'create-backlog';

/** Command entry point: ask for the folder, scaffold the Base, and open it. */
export function promptCreateBacklogBase(app: App): void {
	new FolderPromptModal(app, {
		heading: t('scaffold.heading'),
		description: t('scaffold.folderDesc'),
		ctaLabel: t('scaffold.cta'),
		defaultFolder: DEFAULT_BACKLOG_FOLDER,
		onSubmit: (folder) => {
			void (async () => {
				try {
					const file = await createBacklogBase(app, folder);
					await app.workspace.getLeaf(true).openFile(file);
					new Notice(t('scaffold.created', { path: file.path }));
				} catch (e) {
					console.error('Product Backlog: failed to scaffold the base', e);
					new Notice(t('scaffold.failed'));
				}
			})();
		},
	}).open();
}
