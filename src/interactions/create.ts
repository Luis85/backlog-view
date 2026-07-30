import { Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { TitlePromptModal } from '../modal';
import { BacklogItem, BacklogModel } from '../model';
import { createBacklogItem, ORDER_SPACING } from '../ops';
import { BacklogSettings, configProblems } from '../settings';

/** Level for the primary New button: the focus level when active, else the top level. */
export function newItemLevel(settings: BacklogSettings, model: BacklogModel): string {
	if (model.focused && settings.focusLevel) {
		const idx = settings.levels.findIndex((l) => l.toLowerCase() === settings.focusLevel.toLowerCase());
		if (idx >= 0) return settings.levels[idx];
	}
	return settings.levels[0];
}

/** Ask for a title (and folder, when nothing is configured) and create the note. */
export function promptCreateItem(host: BacklogViewHost, levelName: string, parentItem: BacklogItem | null): void {
	// Creation writes frontmatter too — the same config guard as applySafely.
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(`Fix the view options first: ${problems[0]}`);
		return;
	}
	const hasItems = (host.model?.items.length ?? 0) > 0;
	// In folder mode, children belong next to their parent's folder note.
	const parentFolder =
		host.settings.folderHierarchy && parentItem ? normalizeFolder(parentItem.file.parent?.path) : null;
	const inferredFolder =
		parentFolder ?? (host.settings.newItemFolder || (hasItems ? inferFolder(host.model) : ''));
	// Without items or a configured folder there is nothing to infer from, and a note
	// in the vault root would most likely fall outside this base's filter — ask instead.
	const askFolder = parentFolder === null && !hasItems && host.settings.newItemFolder === '';

	new TitlePromptModal(host.app, {
		heading: `New ${levelName}`,
		askFolder,
		onSubmit: ({ title, folder }) => {
			void createFromPrompt(host, {
				levelName,
				parentItem,
				title,
				folder: askFolder ? folder ?? '' : inferredFolder,
				persistFolder: askFolder,
			});
		},
	}).open();
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
	const parentItem = request.parentItem;
	if (parentItem && host.setCollapsed(parentItem.file.path, false)) host.persistCollapsedState();

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
	for (const item of model?.items ?? []) {
		const path = item.file.parent?.path ?? '';
		counts.set(path, (counts.get(path) ?? 0) + 1);
	}
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
