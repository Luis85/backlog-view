import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { BacklogItem, BacklogModel, childLevelIndex } from './model';
import { BacklogSettings } from './settings';

/** Spacing between freshly assigned order values, leaving room to drop items in between. */
export const ORDER_SPACING = 10;
/** Below this gap between neighbors, sibling orders get renumbered instead of subdivided. */
const MIN_GAP = 0.002;

/** A pending frontmatter update for a single file. Fields left undefined are not touched. */
export interface ItemWrite {
	file: TFile;
	/** New parent note, or null to make the item top-level (pinned in folder mode). */
	parent?: TFile | null;
	/**
	 * Remove the parent property entirely — in folder mode this hands the item
	 * back to folder-note inference instead of pinning it to the top level.
	 */
	removeParentKey?: boolean;
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
	const parentField = computeParentField(dragged, parent);
	const parentChanged = parentField !== undefined;
	const { typeField, cascade } = computeTypeChanges(dragged, parent, settings, parentChanged);

	const order = computeInsertOrder(siblings, insertIndex);
	if (order !== null) {
		return [{ file: dragged.file, parent: parentField, order, typeName: typeField }, ...cascade];
	}
	return [...renumberWrites(dragged, siblings, insertIndex, { parentField, typeField }), ...cascade];
}

/** The parent frontmatter update, or undefined when the parent is unchanged. */
function computeParentField(dragged: BacklogItem, parent: BacklogItem | null): TFile | null | undefined {
	const oldParentPath = dragged.parent?.file.path ?? null;
	const newParentPath = parent?.file.path ?? null;
	// An item whose parent link points outside the view renders as a root while the
	// stale property is still set; placing it at the top level must clear that link,
	// otherwise it would re-nest as soon as the linked note enters the filter.
	const staleRootLink = parent === null && dragged.parent === null && dragged.hasParentValue;
	const parentChanged = oldParentPath !== newParentPath || staleRootLink;
	return parentChanged ? (parent ? parent.file : null) : undefined;
}

/**
 * With autoType, the dragged item is retyped for its new slot and explicitly
 * typed descendants follow, so a subtree move cannot leave inconsistent
 * hierarchy metadata. Untyped descendants need no write (their level is
 * implied from the parent chain) and custom types outside the configured
 * ladder are deliberate — both are left alone. Exported so parent-link
 * removal ("Use folder position") retypes exactly like a drop would.
 */
export function computeTypeChanges(
	dragged: BacklogItem,
	parent: BacklogItem | null,
	settings: BacklogSettings,
	parentChanged: boolean,
): { typeField?: string; cascade: ItemWrite[] } {
	const cascade: ItemWrite[] = [];
	if (!parentChanged || !settings.autoType) return { cascade };

	const newBaseIdx = childLevelIndex(parent, settings.levels);
	const implied = settings.levels[newBaseIdx];
	let typeField: string | undefined;
	if (dragged.typeName === null || dragged.typeName.toLowerCase() !== implied.toLowerCase()) {
		typeField = implied;
	}

	const lastIdx = settings.levels.length - 1;
	const walk = (node: BacklogItem) => {
		for (const child of node.children) {
			if (child.typeName !== null && child.levelIndex !== -1) {
				const targetLevel = settings.levels[Math.min(newBaseIdx + (child.depth - dragged.depth), lastIdx)];
				if (child.typeName.toLowerCase() !== targetLevel.toLowerCase()) {
					cascade.push({ file: child.file, typeName: targetLevel });
				}
			}
			walk(child);
		}
	};
	walk(dragged);
	return { typeField, cascade };
}

/** The order value for the insertion slot, or null when the group needs renumbering. */
function computeInsertOrder(siblings: BacklogItem[], insertIndex: number): number | null {
	const prev = insertIndex > 0 ? siblings[insertIndex - 1] : null;
	const next = insertIndex < siblings.length ? siblings[insertIndex] : null;
	if (!prev && !next) return ORDER_SPACING;
	if (prev && next) return orderBetween(prev.order, next.order);
	if (prev) return prev.order !== null ? Math.floor(prev.order) + ORDER_SPACING : null;
	return next !== null && next.order !== null ? roundOrder(Math.ceil(next.order) - ORDER_SPACING) : null;
}

/** Halfway between two ordered neighbors; null when a value is missing or the gap is spent. */
function orderBetween(prevOrder: number | null, nextOrder: number | null): number | null {
	if (prevOrder === null || nextOrder === null) return null;
	if (nextOrder - prevOrder <= MIN_GAP) return null;
	return roundOrder(prevOrder + (nextOrder - prevOrder) / 2);
}

/** Renumber the whole sibling group, including the dragged item at its new position. */
function renumberWrites(
	dragged: BacklogItem,
	siblings: BacklogItem[],
	insertIndex: number,
	fields: { parentField: TFile | null | undefined; typeField: string | undefined },
): ItemWrite[] {
	const sequence = [...siblings];
	sequence.splice(insertIndex, 0, dragged);
	const writes: ItemWrite[] = [];
	sequence.forEach((item, i) => {
		const slot = (i + 1) * ORDER_SPACING;
		if (item === dragged) {
			writes.push({ file: item.file, parent: fields.parentField, order: slot, typeName: fields.typeField });
		} else if (item.order !== slot) {
			writes.push({ file: item.file, order: slot });
		}
	});
	return writes;
}

/**
 * Fill in missing order and type properties across the whole hierarchy without
 * touching values that already exist. Walks the real tree, so a focused view
 * still backfills hidden ancestors and branches outside the focus level.
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
			// An unresolved parent link means the item's real level is unknowable —
			// don't write a type derived from its provisional top-level position.
			const levelUnknown = item.parent === null && item.hasParentValue;
			if (item.typeName === null && !levelUnknown) {
				write.typeName = settings.levels[childLevelIndex(item.parent, settings.levels)];
				needed = true;
			}
			if (needed) writes.push(write);
			visit(item.children);
		}
	};
	visit(model.realRoots);
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
