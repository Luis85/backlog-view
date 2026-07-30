import { App, TFile } from 'obsidian';
import { BacklogItem, BacklogModel } from './model';
import { BacklogSettings, levelForDepth } from './settings';

/** Spacing between freshly assigned order values, leaving room to drop items in between. */
export const ORDER_SPACING = 10;
/** Below this gap between neighbors, sibling orders get renumbered instead of subdivided. */
const MIN_GAP = 0.002;

/** A pending frontmatter update for a single file. Fields left undefined are not touched. */
export interface ItemWrite {
	file: TFile;
	/** New parent note, or null to clear the parent property (top-level item). */
	parent?: TFile | null;
	order?: number;
	typeName?: string;
}

export interface DropTarget {
	parent: BacklogItem | null;
	/** Children of the new parent in visual order, excluding the dragged item. */
	siblings: BacklogItem[];
	/** Position among `siblings` where the dragged item should land. */
	insertIndex: number;
}

/** Apply writes sequentially so concurrent edits of the same file cannot race. */
export async function applyWrites(app: App, settings: BacklogSettings, writes: ItemWrite[]): Promise<void> {
	for (const write of writes) {
		await app.fileManager.processFrontMatter(write.file, (fm: Record<string, unknown>) => {
			if (write.parent !== undefined) {
				if (write.parent === null) delete fm[settings.parentKey];
				else fm[settings.parentKey] = wikilinkTo(app, write.parent, write.file.path);
			}
			if (write.order !== undefined) fm[settings.orderKey] = write.order;
			if (write.typeName !== undefined) fm[settings.typeKey] = write.typeName;
		});
	}
}

/**
 * Compute the frontmatter writes for dropping `dragged` at the given target position.
 * Uses the gap between neighbor orders when possible; falls back to renumbering
 * the whole sibling group when orders are missing or too tightly packed.
 */
export function computeDropWrites(
	dragged: BacklogItem,
	target: DropTarget,
	settings: BacklogSettings,
): ItemWrite[] {
	const { parent, siblings, insertIndex } = target;

	const oldParentPath = dragged.parent?.file.path ?? null;
	const newParentPath = parent?.file.path ?? null;
	// An item whose parent link points outside the view renders as a root while the
	// stale property is still set; placing it at the top level must clear that link,
	// otherwise it would re-nest as soon as the linked note enters the filter.
	const staleRootLink = parent === null && dragged.parent === null && dragged.hasParentValue;
	const parentChanged = oldParentPath !== newParentPath || staleRootLink;
	const parentField: TFile | null | undefined = parentChanged ? (parent ? parent.file : null) : undefined;

	let typeField: string | undefined;
	if (parentChanged && settings.autoType) {
		const newDepth = parent ? parent.depth + 1 : 0;
		const implied = levelForDepth(settings.levels, newDepth);
		if (dragged.typeName === null || dragged.typeName.toLowerCase() !== implied.toLowerCase()) {
			typeField = implied;
		}
	}

	const prev = insertIndex > 0 ? siblings[insertIndex - 1] : null;
	const next = insertIndex < siblings.length ? siblings[insertIndex] : null;
	const prevOrder = prev?.order ?? null;
	const nextOrder = next?.order ?? null;

	let order: number | null = null;
	if (!prev && !next) {
		order = ORDER_SPACING;
	} else if (prev && next) {
		if (prevOrder !== null && nextOrder !== null && nextOrder - prevOrder > MIN_GAP) {
			order = roundOrder(prevOrder + (nextOrder - prevOrder) / 2);
		}
	} else if (prev && !next) {
		if (prevOrder !== null) order = Math.floor(prevOrder) + ORDER_SPACING;
	} else if (next && !prev) {
		if (nextOrder !== null) order = roundOrder(Math.ceil(nextOrder) - ORDER_SPACING);
	}

	if (order !== null) {
		return [{ file: dragged.file, parent: parentField, order, typeName: typeField }];
	}

	// Renumber the whole sibling group, including the dragged item at its new position.
	const sequence = [...siblings];
	sequence.splice(insertIndex, 0, dragged);
	const writes: ItemWrite[] = [];
	sequence.forEach((item, i) => {
		const slot = (i + 1) * ORDER_SPACING;
		if (item === dragged) {
			writes.push({ file: item.file, parent: parentField, order: slot, typeName: typeField });
		} else if (item.order !== slot) {
			writes.push({ file: item.file, order: slot });
		}
	});
	return writes;
}

/**
 * Fill in missing order and type properties across the whole tree without
 * touching values that already exist.
 */
export function computeInitWrites(model: BacklogModel, settings: BacklogSettings): ItemWrite[] {
	const writes: ItemWrite[] = [];
	const visit = (siblings: BacklogItem[]) => {
		let maxOrder = 0;
		for (const item of siblings) {
			if (item.order !== null && item.order > maxOrder) maxOrder = item.order;
		}
		for (const item of siblings) {
			const write: ItemWrite = { file: item.file };
			let needed = false;
			if (item.order === null) {
				maxOrder = Math.floor(maxOrder) + ORDER_SPACING;
				write.order = maxOrder;
				needed = true;
			}
			if (item.typeName === null) {
				write.typeName = levelForDepth(settings.levels, item.depth);
				needed = true;
			}
			if (needed) writes.push(write);
			visit(item.children);
		}
	};
	visit(model.roots);
	return writes;
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
	const folder = spec.folder.trim().replace(/^\/+|\/+$/g, '');
	await ensureFolder(app, folder);

	const base = sanitizeTitle(spec.title);
	let path = folder ? `${folder}/${base}.md` : `${base}.md`;
	for (let i = 1; app.vault.getAbstractFileByPath(path) !== null; i++) {
		path = folder ? `${folder}/${base} ${i}.md` : `${base} ${i}.md`;
	}

	const file = await app.vault.create(path, '');
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm[settings.typeKey] = spec.typeName;
		if (spec.parent) fm[settings.parentKey] = wikilinkTo(app, spec.parent, file.path);
		fm[settings.orderKey] = spec.order;
	});
	return file;
}

/**
 * Always write parents as quoted wikilinks so the metadata cache picks them up
 * as frontmatter links regardless of the user's link format setting.
 */
function wikilinkTo(app: App, target: TFile, sourcePath: string): string {
	return '[[' + app.metadataCache.fileToLinktext(target, sourcePath) + ']]';
}

function roundOrder(value: number): number {
	return Math.round(value * 10000) / 10000;
}

function sanitizeTitle(title: string): string {
	const cleaned = title
		.replace(/[\\/:*?"<>|#^[\]]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^[-\s.]+|[-\s]+$/g, '');
	return cleaned.length > 0 ? cleaned : 'Untitled';
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder) return;
	const parts = folder.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (app.vault.getAbstractFileByPath(current) === null) {
			try {
				await app.vault.createFolder(current);
			} catch (e) {
				// Folder may have been created concurrently; creation of the note will surface real errors.
			}
		}
	}
}
