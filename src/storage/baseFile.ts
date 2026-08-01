import { App, normalizePath, TFile } from 'obsidian';
import { DEFAULT_EXTRA_TYPES, DEFAULT_LEVELS, defaultTypeFolder, typeFolderKey } from '../domain/settings';
import { ensureFolder } from './frontmatter';

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
		// Pre-wire every folder this view files into, all under the folder just filtered
		// for, so the first item of any type cannot land outside it. The shipped
		// defaults point at a `docs/` layout this base knows nothing about, and they
		// outrank the home folder, so writing the home folder alone would not be enough.
		`    homeFolder: ${yamlQuote(folder)}`,
		...[...DEFAULT_LEVELS, ...DEFAULT_EXTRA_TYPES].map(
			(type) => `    ${typeFolderKey(type)}: ${yamlQuote(defaultTypeFolder(type, folder))}`,
		),
		'',
	].join('\n');
}

function yamlQuote(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
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
