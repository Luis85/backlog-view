import { Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { TitlePromptModal } from '../../ui/prompts';
import { manualLink } from '../../ui/manualDialog';
import { manualSections } from '../manual/sections';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { focusTarget, folderForType } from '../../domain/itemTypes';
import { ORDER_SPACING } from '../../domain/writePlan';
import { createBacklogItem } from '../../storage/frontmatter';
import { BacklogSettings } from '../../domain/settings';
import { configProblems } from '../../domain/settingsConsistency';
import { LEVELS } from '../../domain/typeVocabulary';

/**
 * Type for the primary New button: whatever the view is focused on when it is focused —
 * a level or an extra type, since both can be focused — else the top level. Named for
 * the TYPE it returns rather than the level it used to, because focusing a Bug is now
 * as ordinary as focusing a PBI.
 */
export function newItemType(settings: BacklogSettings, model: BacklogModel): string {
	if (model.focused) {
		const focus = focusTarget(settings);
		if (focus) return focus;
	}
	return LEVELS[0];
}

/**
 * Where a projection asks a new note to land, beyond the hierarchy: the roadmap's
 * buckets create in place, so the bucket's own value rides the creation write.
 * Absent everywhere else — a placement nobody chose is not one to write.
 */
export interface CreatePlacement {
	horizon?: string;
}

/**
 * Ask for a title (and folder, when nothing is configured) and create the note.
 *
 * `choices` is what this parent may hold — one type under a Task, several under a rung
 * that also takes the extra types. The modal only asks when there is something to ask.
 * `placement` is what the surface the user created FROM adds to that note, and it
 * changes nothing else: every rule below — the config gate, the type folders, folder
 * mode, the inference — governs a bucket's new note exactly as it governs the toolbar's.
 */
export function promptCreateItem(
	host: BacklogViewHost,
	choices: string[],
	parentItem: BacklogItem | null,
	placement: CreatePlacement = {},
): void {
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
	// Walked once, not per type: where the backlog already lives does not depend on
	// which type is being created.
	const inferred = hasItems ? inferFolder(host.model) : '';
	/**
	 * Where a new item of this type lands. Folder mode's "beside the parent's folder
	 * note" rule stays on top — there the folder tree IS the hierarchy, and an opt-in
	 * mode should not be quietly overruled by a filing default. Below it the type's own
	 * folder wins over the home folder, so a Bug files itself under `docs/bugs` even in
	 * a base whose items otherwise live together. Where the existing items live is the
	 * last resort before asking, since both folders above are configurable and a
	 * configured folder is an answer where a guess from the vault is not.
	 */
	const chosen = (typeName: string): string => folderForType(typeName, host.settings) || host.settings.homeFolder;
	const folderFor = (typeName: string): string => parentFolder ?? (chosen(typeName) || inferred);
	// Without items or a configured folder there is nothing to infer from, and a note
	// in the vault root would most likely fall outside this base's filter — ask instead.
	// A type that files itself needs no asking, so this only fires when one of the
	// offered types would have nowhere to go.
	// Only when nothing at all can answer: no parent folder, no items to learn from, and
	// no folder configured or defaulted for any type on offer.
	const askFolder = parentFolder === null && !hasItems && choices.every((type) => chosen(type) === '');

	new TitlePromptModal(host.app, {
		// With a choice to make the heading cannot name the type, since the type is the
		// thing being chosen; without one it still says exactly what is being created.
		heading: choices.length > 1 ? 'New item' : `New ${choices[0]}`,
		detail: askFolder ? undefined : (typeName: string) => promptDetail(parentItem, folderFor(typeName)),
		types: choices,
		askFolder,
		// `root: el` — the prompt's own `contentEl`, which is genuinely stable here: unlike
		// the tree and the toolbar, nothing external rebuilds a modal's content while it is
		// open, so the shell this door is drawn into IS the container to resolve it from.
		help: (el) =>
			manualLink(el, host.app, manualSections(), { sectionId: 'creating', label: 'Where will this go?', root: el }),
		onSubmit: ({ title, folder, typeName }) => {
			void createFromPrompt(host, {
				levelName: typeName,
				parentItem,
				title,
				folder: askFolder ? folder ?? '' : folderFor(typeName),
				persistFolder: askFolder,
				horizon: placement.horizon,
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
	horizon?: string;
}

async function createFromPrompt(host: BacklogViewHost, request: CreateRequest): Promise<void> {
	if (request.persistFolder && request.folder) {
		try {
			host.config.set('homeFolder', request.folder);
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
			horizon: request.horizon,
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
