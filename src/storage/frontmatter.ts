import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { BacklogSettings } from '../domain/settings';
import { ItemWrite } from '../domain/writePlan';

/**
 * The ONLY module that writes frontmatter. Everything upstream decides what a
 * change should be (`domain/writePlan.ts`) and hands the plan here; nothing else
 * in the codebase may call `processFrontMatter` or create a note. Keeping that
 * true is what makes the write-safety rules checkable by reading one file.
 */

/**
 * Apply writes sequentially so concurrent edits of the same file cannot race.
 * `onProgress` reports after each file so a long batch — a backfill over a whole
 * backlog is hundreds of notes — can show how far along it is. Each await yields
 * to the event loop, so the view stays interactive throughout.
 */
export async function applyWrites(
	app: App,
	settings: BacklogSettings,
	writes: ItemWrite[],
	onProgress?: (done: number, total: number) => void,
): Promise<void> {
	let done = 0;
	for (const write of writes) {
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			if (write.removeParentKey) {
				delete fm[settings.parentKey];
			} else if (write.parent !== undefined) {
				if (write.parent !== null) fm[settings.parentKey] = wikilinkTo(app, write.parent, write.file.path);
				// In folder mode a deleted key would just re-infer the folder parent;
				// an explicitly empty value pins the item to the top level instead.
				else if (settings.folderHierarchy) fm[settings.parentKey] = '';
				else delete fm[settings.parentKey];
			}
			if (write.order !== undefined) fm[settings.orderKey] = write.order;
			if (write.typeName !== undefined) fm[settings.typeKey] = write.typeName;
			// The stateKey may be unset (progress tracking off) — never write to an empty key.
			if (write.state !== undefined && settings.stateKey) fm[settings.stateKey] = write.state;
		});
		onProgress?.(++done, writes.length);
	}
}

export interface NewItemSpec {
	folder: string;
	title: string;
	typeName: string;
	parent: TFile | null;
	order: number;
}

/** Create a new backlog note in the configured folder with its hierarchy properties set. */
export async function createBacklogItem(app: App, settings: BacklogSettings, spec: NewItemSpec): Promise<TFile> {
	const trimmed = spec.folder.trim().replace(/^\/+|\/+$/g, '');
	const folder = trimmed ? normalizePath(trimmed) : '';
	await ensureFolder(app, folder);

	const base = sanitizeTitle(spec.title);
	const filePath = (name: string) => (folder ? normalizePath(`${folder}/${name}.md`) : `${name}.md`);
	let path = filePath(base);
	for (let i = 1; app.vault.getAbstractFileByPath(path) !== null; i++) {
		path = filePath(`${base} ${i}`);
	}

	// One atomic write: a create-then-update pair could fail in between and leave
	// a blank note without its hierarchy properties behind.
	const fm: Record<string, unknown> = { [settings.typeKey]: spec.typeName };
	if (spec.parent) fm[settings.parentKey] = wikilinkTo(app, spec.parent, path);
	// In folder mode a missing parent key would let folder inference nest this
	// intentionally top-level note — pin it with an explicitly empty parent.
	else if (settings.folderHierarchy) fm[settings.parentKey] = '';
	fm[settings.orderKey] = spec.order;
	return app.vault.create(path, `---\n${stringifyYaml(fm)}---\n`);
}

/**
 * Always write parents as quoted wikilinks so the metadata cache picks them up
 * as frontmatter links regardless of the user's link format setting.
 */
function wikilinkTo(app: App, target: TFile, sourcePath: string): string {
	return '[[' + app.metadataCache.fileToLinktext(target, sourcePath) + ']]';
}


function sanitizeTitle(title: string): string {
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
