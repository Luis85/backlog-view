import { Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { TitlePromptModal } from '../../ui/prompts';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { ORDER_SPACING } from '../../domain/writePlan';
import { createBacklogItem } from '../../storage/frontmatter';
import { BacklogSettings, configProblems } from '../../domain/settings';

/** Level for the primary New button: the focus level when active, else the top level. */
export function newItemLevel(settings: BacklogSettings, model: BacklogModel): string {
	if (model.focused && settings.focusLevel) {
		const idx = settings.levels.findIndex((l) => l.toLowerCase() === settings.focusLevel.toLowerCase());
		if (idx >= 0) return settings.levels[idx];
	}
	return settings.levels[0];
}

/**
 * Ask for a title (and folder, when nothing is configured) and create the note.
 *
 * `choices` is what this parent may hold — one type under a Task, several under a rung
 * that also takes the extra types. The modal only asks when there is something to ask.
 */
export function promptCreateItem(host: BacklogViewHost, choices: string[], parentItem: BacklogItem | null): void {
	// Creation writes frontmatter too — the same config guard as applySafely.
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(`Fix the view options first: ${problems[0]}`);
		return;
	}
	// Judge existence and infer folders from the FULL tree — a focused view with no
	// matching rows still knows where the hidden items live.
	const hasItems = (host.model?.realRoots.length ?? 0) > 0;
	// In folder mode, children belong next to their parent's folder note — unless that
	// parent is only here as context, because its folder is where the Base's filter
	// isn't: the new note would vanish on the next refresh. Its explicit parent link
	// keeps the hierarchy right wherever it lands, so fall back to the usual folder.
	const parentFolder =
		host.settings.folderHierarchy && parentItem && !parentItem.outsideFilter
			? normalizeFolder(parentItem.file.parent?.path)
			: null;
	const inferredFolder =
		parentFolder ?? (host.settings.newItemFolder || (hasItems ? inferFolder(host.model) : ''));
	// Without items or a configured folder there is nothing to infer from, and a note
	// in the vault root would most likely fall outside this base's filter — ask instead.
	const askFolder = parentFolder === null && !hasItems && host.settings.newItemFolder === '';

	new TitlePromptModal(host.app, {
		// With a choice to make the heading cannot name the type, since the type is the
		// thing being chosen; without one it still says exactly what is being created.
		heading: choices.length > 1 ? 'New item' : `New ${choices[0]}`,
		detail: askFolder ? undefined : promptDetail(parentItem, inferredFolder),
		types: choices,
		askFolder,
		onSubmit: ({ title, folder, typeName }) => {
			void createFromPrompt(host, {
				levelName: typeName,
				parentItem,
				title,
				folder: askFolder ? folder ?? '' : inferredFolder,
				persistFolder: askFolder,
			});
		},
	}).open();
}

/** Where the new item will land, e.g. `Under "Epic X" · in folder "Backlog"`. */
function promptDetail(parentItem: BacklogItem | null, folder: string): string {
	const where = folder ? `in folder "${folder}"` : 'in the vault root';
	return parentItem ? `Under "${parentItem.title}" · ${where}` : `${where[0].toUpperCase()}${where.substring(1)}`;
}

interface CreateRequest {
	levelName: string;
	parentItem: BacklogItem | null;
	title: string;
	folder: string;
	persistFolder: boolean;
}

async function createFromPrompt(host: BacklogViewHost, request: CreateRequest): Promise<void> {
	if (request.persistFolder && request.folder) {
		try {
			host.config.set('newItemFolder', request.folder);
		} catch (e) {
			console.error('Product Backlog: could not save folder to the view options', e);
		}
	}
	// The new child has to be visible under its parent, collapsed or not.
	const parentItem = request.parentItem;
	if (parentItem) host.setCollapsed(parentItem.file.path, false);

	try {
		const file = await createBacklogItem(host.app, host.settings, {
			folder: request.folder,
			title: request.title,
			typeName: request.levelName,
			parent: parentItem?.file ?? null,
			// Parentless items rank among the real top level, not the focus rows.
			order: endOfSiblingsOrder(parentItem ? parentItem.children : host.model?.realRoots ?? []),
		});
		new Notice(`Created "${file.basename}".`);
	} catch (e) {
		console.error('Product Backlog: failed to create item', e);
		new Notice('Could not create the item. See the developer console for details.');
	}
}

/** An order value placing a new item after every ranked sibling. */
function endOfSiblingsOrder(siblings: BacklogItem[]): number {
	let maxOrder = 0;
	for (const s of siblings) {
		if (s.order !== null && s.order > maxOrder) maxOrder = s.order;
	}
	return Math.floor(maxOrder) + ORDER_SPACING;
}

function normalizeFolder(path: string | undefined): string {
	return !path || path === '/' ? '' : path;
}

/** Without a configured folder, place new items where most existing items live. */
function inferFolder(model: BacklogModel | null): string {
	const counts = new Map<string, number>();
	const visit = (items: BacklogItem[]) => {
		for (const item of items) {
			// Ancestors loaded from outside the filter live wherever they live — often
			// outside the base's folder entirely. Counting them would aim new notes
			// there, straight out of the view they were created from.
			if (!item.outsideFilter) {
				const path = item.file.parent?.path ?? '';
				counts.set(path, (counts.get(path) ?? 0) + 1);
			}
			visit(item.children);
		}
	};
	visit(model?.realRoots ?? []);
	let best = '';
	let bestCount = 0;
	for (const [path, count] of counts) {
		if (count > bestCount) {
			best = path;
			bestCount = count;
		}
	}
	return best === '/' ? '' : best;
}
