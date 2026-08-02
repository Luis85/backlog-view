import { App, normalizePath, TFile } from 'obsidian';
import { ensureFolder } from './frontmatter';
import { README_FILE_NAME, README_MARKER } from '../domain/backlogReadme';

/**
 * Writing the backlog README — the second vault write that is not a work item, and
 * here for the same reason `baseFile.ts` is: everything that puts bytes in the vault
 * lives in `storage/`, with no exception to remember. `domain/backlogReadme.ts`
 * decides what the file says; this decides whether it may be written at all.
 */

/**
 * What a write did. Four outcomes rather than a boolean, because the interesting
 * ones are the two that wrote nothing: `unchanged` is the repository-friendly no-op
 * (regenerating an identical file must not produce a commit), and `foreign` is the
 * refusal — a file of this name without the marker was written by somebody else and
 * is never replaced.
 */
export type ReadmeOutcome = 'created' | 'updated' | 'unchanged' | 'foreign';

export interface ReadmeWriteResult {
	outcome: ReadmeOutcome;
	path: string;
}

/**
 * The folder as the vault spells it, or '' for the root. Everything here derives from
 * this one answer: a hand-edited or Windows-shaped `homeFolder` (`work\backlog`, a
 * doubled separator) must not have the file created under one spelling while the
 * folder is created under another — which is a create that fails on a parent that
 * exists.
 */
function normalizedFolder(folder: string): string {
	const trimmed = folder.trim().replace(/^\/+|\/+$/g, '');
	return trimmed ? normalizePath(trimmed) : '';
}

/** Where the README for `folder` lives — normalized, and at the vault root for ''. */
export function readmePath(folder: string): string {
	const dir = normalizedFolder(folder);
	return dir ? `${dir}/${README_FILE_NAME}` : README_FILE_NAME;
}

/**
 * Write the generated README into `folder`, creating the folder if it does not exist.
 *
 * The marker check reads the file rather than trusting its name: this plugin's own
 * output may be replaced wholesale, and anything else may not. Reading also answers
 * the no-op question — an identical file is left untouched, so a team keeping the
 * vault in git gets a commit only when the configuration actually changed.
 */
export async function writeBacklogReadme(app: App, folder: string, content: string): Promise<ReadmeWriteResult> {
	const path = readmePath(folder);
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		const current = await app.vault.read(existing);
		if (current === content) return { outcome: 'unchanged', path };
		if (!current.startsWith(README_MARKER)) return { outcome: 'foreign', path };
		await app.vault.modify(existing, content);
		return { outcome: 'updated', path };
	}
	await ensureFolder(app, normalizedFolder(folder));
	await app.vault.create(path, content);
	return { outcome: 'created', path };
}
