import { App, normalizePath, Notice, TFile } from 'obsidian';
import { FolderPromptModal } from './modal';
import { ensureFolder } from './ops';

const DEFAULT_BACKLOG_FOLDER = 'Backlog';
const BASE_FILE_NAME = 'Product Backlog';

/**
 * The content of a ready-to-use .base file: filtered to the backlog folder's
 * markdown notes, opening directly in the Product Backlog view.
 */
export function baseFileContent(folder: string): string {
	const quoted = folder.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return [
		'filters:',
		'  and:',
		`    - file.inFolder("${quoted}")`,
		'    - file.ext == "md"',
		'views:',
		'  - type: product-backlog',
		'    name: Backlog',
		// Pre-wire the creation folder so the first "New Epic" cannot land
		// outside the filter — the view reads this option via config.get.
		`    newItemFolder: "${quoted}"`,
		'',
	].join('\n');
}

/** Create the backlog folder (if needed) and a configured .base file inside it. */
export async function createBacklogBase(app: App, folderInput: string): Promise<TFile> {
	const trimmed = folderInput.trim().replace(/^\/+|\/+$/g, '');
	const folder = trimmed ? normalizePath(trimmed) : DEFAULT_BACKLOG_FOLDER;
	await ensureFolder(app, folder);

	let path = normalizePath(`${folder}/${BASE_FILE_NAME}.base`);
	for (let i = 1; app.vault.getAbstractFileByPath(path) !== null; i++) {
		path = normalizePath(`${folder}/${BASE_FILE_NAME} ${i}.base`);
	}
	return app.vault.create(path, baseFileContent(folder));
}

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
