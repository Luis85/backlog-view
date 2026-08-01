import { App, Notice } from 'obsidian';
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
		heading: 'Create product backlog',
		description:
			'A folder for your backlog items and a configured .base file will be created here.',
		ctaLabel: 'Create backlog',
		defaultFolder: DEFAULT_BACKLOG_FOLDER,
		onSubmit: (folder) => {
			void (async () => {
				try {
					const file = await createBacklogBase(app, folder);
					await app.workspace.getLeaf(true).openFile(file);
					new Notice(`Created "${file.path}". Add your first epic from the view.`);
				} catch (e) {
					console.error('Product Backlog: failed to scaffold the base', e);
					new Notice('Could not create the backlog. See the developer console for details.');
				}
			})();
		},
	}).open();
}
