import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { BacklogSettings } from '../domain/settings';
import { vaultFolder } from '../domain/settingsResolve';
import { setOwn } from './ownProperty';
import { axisEntries } from './writeKeys';

/**
 * Making a note, as against editing one. The other half of the write boundary
 * `frontmatter.ts` states: nothing outside `storage/` may create a file, and everything
 * that does create one is here — the work item, the path it takes, and the folder it
 * needs to exist first.
 *
 * Split off `frontmatter.ts` on 2026-08-16 because that file had five counted lines of
 * headroom left under the 400-line cap and the growth was landing here: a `NewItemSpec`
 * takes a field per property a creation may carry, so it grows with every optional
 * property, while the editing side grows a row in a list. The boundary is the same one
 * the directory already keeps; what changed is which file the reader opens to check it.
 */

export interface NewItemSpec {
	folder: string;
	title: string;
	typeName: string;
	parent: TFile | null;
	order: number;
	/** The bucket it was created in, when it was created from one. */
	horizon?: string;
}

/** Create a new backlog note in the configured folder with its hierarchy properties set. */
export async function createBacklogItem(app: App, settings: BacklogSettings, spec: NewItemSpec): Promise<TFile> {
	const folder = vaultFolder(spec.folder);
	await ensureFolder(app, folder);
	const path = uniqueNotePath(app, folder, spec.title);

	// One atomic write: a create-then-update pair could fail in between and leave
	// a blank note without its hierarchy properties behind.
	const fm: Record<string, unknown> = { [settings.typeKey]: spec.typeName };
	if (spec.parent) setOwn(fm, settings.parentKey, wikilinkTo(app, spec.parent, path));
	// In folder mode a missing parent key would let folder inference nest this
	// intentionally top-level note — pin it with an explicitly empty parent.
	else if (settings.folderHierarchy) setOwn(fm, settings.parentKey, '');
	setOwn(fm, settings.orderKey, spec.order);
	// A note created from a bucket claims that bucket in the SAME write, through the
	// same axis list the edit path uses — so it is never momentarily a note sitting in
	// a bucket its own frontmatter does not name, and never a write to an unconfigured
	// key. `axisEntries` yields nothing here when the horizon axis is off.
	for (const { key, value } of axisEntries(settings, spec.horizon ? { horizon: spec.horizon } : undefined)) {
		if (value !== null) setOwn(fm, key, value);
	}
	return app.vault.create(path, `---\n${stringifyYaml(fm)}---\n`);
}

/**
 * Always write parents as quoted wikilinks so the metadata cache picks them up
 * as frontmatter links regardless of the user's link format setting.
 *
 * Used by the editing side too (`applyHierarchy` and `applyIteration` in
 * `frontmatter.ts`): a link is spelled the same way whether the note is being made or
 * changed, and one function is what keeps that true.
 */
export function wikilinkTo(app: App, target: TFile, sourcePath: string): string {
	return '[[' + app.metadataCache.fileToLinktext(target, sourcePath) + ']]';
}

/**
 * The path a new note takes: the sanitized title in the folder, suffixed until nothing is
 * there. Shared by both creators in this directory, so an absence and a work item cannot
 * disagree about what a title becomes on disk or about what happens when the name is
 * taken.
 *
 * `self` is the file being RENAMED, and its own path is free rather than taken. A creator
 * passes nothing — there is no file yet — but a rename asks this question about a note
 * that is already on disk, and counting its own path as occupied appends a number to a
 * name it already answers to. That is not a hypothetical: a derived name collides once,
 * lands at `X 1`, and every later rename to the same derived name then finds `X` taken and
 * `X 1` taken by the note itself, so the suffix ratchets (`X 2`, `X 3`) with every edit and
 * rewrites every link naming it. Driven by "leaves a note that already landed on a collided
 * name where it is" in `test/view/resourceAbsences.test.ts`.
 */
export function uniqueNotePath(app: App, folder: string, title: string, self?: TFile): string {
	const base = sanitizeTitle(title);
	const filePath = (name: string) => (folder ? normalizePath(`${folder}/${name}.md`) : `${name}.md`);
	const taken = (path: string) => path !== self?.path && app.vault.getAbstractFileByPath(path) !== null;
	let path = filePath(base);
	for (let i = 1; taken(path); i++) path = filePath(`${base} ${i}`);
	return path;
}

/**
 * What a title becomes on disk, before any collision suffix.
 *
 * Exported for the one caller that has to ask the question WITHOUT taking a path:
 * `absenceSaid` (`view/render/lanes.ts`) compares a note's BASENAME against the name
 * `absenceTitle` derives from its facts, and those are two strings for one file name the
 * moment a resource holds a character this replaces — `A/B away …` is filed as `A-B away
 * …`. Sanitizing the derived side is what makes that comparison ask about the name the
 * note actually has.
 *
 * `view/` may reach `storage/` (the layering is main → commands → view → storage →
 * domain, and `eslint.config.mjs` forbids only view → commands); `domain/` may not, which
 * is why this question is asked in the view rather than beside `absenceTitle`.
 */
export function sanitizeTitle(title: string): string {
	const cleaned = title
		.replace(/[\\/:*?"<>|#^[\]]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^[-\s.]+|[-\s]+$/g, '');
	return cleaned.length > 0 ? cleaned : 'Untitled';
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder) return;
	const parts = folder.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (app.vault.getAbstractFileByPath(current) === null) {
			try {
				await app.vault.createFolder(current);
			} catch {
				// Folder may have been created concurrently; creation of the note will surface real errors.
			}
		}
	}
}
