import { App, normalizePath, TFile } from 'obsidian';
import { ensureFolder } from './frontmatter';
import { vaultFolder } from '../domain/settingsResolve';

/**
 * Writing the `.base` file itself — the one vault write that is not a work item.
 * It lives beside the frontmatter writer rather than with the command that calls
 * it, so "everything that puts bytes in the vault is in storage/" stays true
 * without an exception to remember.
 */

export const DEFAULT_BACKLOG_FOLDER = 'docs';
const BASE_FILE_NAME = 'Product Backlog';

/**
 * The content of a ready-to-use .base file: filtered to the backlog folder's
 * markdown notes, opening directly in the Product Backlog view.
 */
export function baseFileContent(folder: string): string {
	// Two escaping layers: the folder inside the formula's string literal, and the
	// whole formula as a double-quoted YAML scalar — a plain scalar would treat
	// " #" in a folder name as the start of a YAML comment and truncate the filter.
	const formulaArg = folder.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return [
		'filters:',
		'  and:',
		`    - ${yamlQuote(`file.inFolder("${formulaArg}")`)}`,
		'    - file.ext == "md"',
		'views:',
		'  - type: product-backlog',
		'    name: Backlog',
		// One line files everything inside the filter written above: the per-type folders
		// default to subfolders of the home folder, so `Roadmap` gives `Roadmap/bugs`
		// without this command having to name each of them — and they keep following if
		// the home folder is moved later.
		`    homeFolder: ${yamlQuote(folder)}`,
		'',
	].join('\n');
}

function yamlQuote(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Create the backlog folder (if needed) and a configured .base file inside it. */
export async function createBacklogBase(app: App, folderInput: string): Promise<TFile> {
	const folder = vaultFolder(folderInput) || DEFAULT_BACKLOG_FOLDER;
	await ensureFolder(app, folder);

	let path = normalizePath(`${folder}/${BASE_FILE_NAME}.base`);
	for (let i = 1; app.vault.getAbstractFileByPath(path) !== null; i++) {
		path = normalizePath(`${folder}/${BASE_FILE_NAME} ${i}.base`);
	}
	return app.vault.create(path, baseFileContent(folder));
}
