import { Menu, Notice } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { BacklogSettings } from '../../domain/settings';
import { ReleaseRow, ScopeRow } from '../../domain/releases';
import { childTypeChoices, folderForType } from '../../domain/itemTypes';
import { configProblems } from '../../domain/settingsConsistency';
import { ORDER_SPACING } from '../../domain/writePlan';
import { createBacklogItem } from '../../storage/createNote';
import { TitlePromptModal } from '../../ui/prompts';
import { showMenuAtElement, showMenuForClick } from '../interactions/menu';
import { ScopeDraw, foldedPaths, toggleFold } from './scopeTree';

/**
 * The scope tree's one write: **New \<child\> on a row**, which creates a note rather than
 * editing one.
 *
 * That is what makes it legal on a view whose central claim is
 * `test/view/releaseNeverEdits.test.ts`'s — "this view creates notes and its own config;
 * it never edits a note that already exists". Nothing here reaches `applyWrites`,
 * `applyRestores` or `applyPropertyWrites`, and the row the gesture was made from is not
 * touched: the release, the parent link and the rank are all written into the note being
 * born. A context row is therefore as good a parent as a member — the backlog menu's own
 * rule, one screen over (`view/interactions/menu.ts`): `New <child>` is the one mutation
 * still fair game on an ancestor the filter cut, because it writes a DIFFERENT note.
 *
 * **The new note carries this release's membership property in the same write.** Membership
 * is one property on the item's own note and never cascades from a parent
 * ([[The scope of a release as a tree]]), so a child created here without it would be
 * parented correctly, be a member of nothing, and not appear on the screen the gesture was
 * made from — a press that reads as having done nothing.
 *
 * **Two inputs, one method** (`CLAUDE.md`'s "one move, N inputs"): the pointer's
 * `contextmenu` and the keyboard's Menu / Shift+F10 both build the menu through
 * {@link scopeMenu} and create through {@link createMember}, so neither can grow its own
 * idea of what creating a child from a release means.
 *
 * Both listeners are DELEGATED onto `treeEl` rather than wired per row, which is also what
 * keeps `drawRow` inside its parameter budget: it already takes the five
 * `eslint`'s `max-params` allows, so a sixth argument carrying the plan settings could not
 * have reached it. `renderScope.ts` calls this as its third step, beside `wireScopeKeys`
 * and for the same reason — it is the module that already holds both the draw and the
 * settings, so the leaves stay acyclic.
 */
export function wireScopeCreate(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, draw: ScopeDraw): void {
	const { treeEl, rows, rowEls } = draw;
	const menuFor = (row: ScopeRow): Menu => scopeMenu(view, release, settings, row);

	treeEl.addEventListener('contextmenu', (evt) => {
		// `evt.target` is asserted rather than tested: this listener is on `treeEl`, so a
		// dispatched event always reports an element under it, and an `instanceof` guard here
		// would be the unreachable branch this module's neighbours already argue against.
		const rowEl = (evt.target as Element).closest('.pbl-row');
		const row = rows.find((r) => rowEls.get(r.item.file.path) === rowEl);
		if (!row) return;
		// The browser's own menu would otherwise cover this one. Only once a row is found:
		// a right-click on the tree's own padding still gets the pane's menu.
		evt.preventDefault();
		// `showMenuForClick`, never `showAtMouseEvent` — the rule that module states and
		// lint enforces: a synthesized click reports (0, 0) and would drop the menu in the
		// viewport corner.
		showMenuForClick(menuFor(row), evt);
	});

	treeEl.addEventListener('keydown', (evt) => {
		// Both spellings, because a keyboard without a Menu key has only the second — the
		// pair `view/interactions/keyboard.ts` already wires for the backlog's own tree.
		if (evt.key !== 'ContextMenu' && !(evt.key === 'F10' && evt.shiftKey)) return;
		// `activeScopeFile` rather than an index of our own: `scopeKeys.ts` writes it on
		// every move of its roving selection, so reading it here is what stops two
		// controllers on one tree disagreeing about which row is active. Matched on the
		// FILE for that module's own reason — Obsidian mutates a `TFile` in place on rename.
		const file = view.activeScopeFile;
		const row = file === null ? undefined : rows.find((r) => r.item.file === file);
		if (!row) return;
		evt.preventDefault();
		// `!` for `scopeKeys.ts`'s own reason: `row` came out of `rows`, and `rowEls` was
		// built from that same array while drawing it, so the lookup always hits.
		showMenuAtElement(menuFor(row), rowEls.get(row.item.file.path)!);
	});
}

/**
 * One entry per type the row may hold, and nothing else — the answer to "what else could
 * be on this menu" is `test/view/releaseNeverEdits.test.ts`: every other entry the backlog's
 * own row menu carries edits the row's own frontmatter, which this view does not do.
 *
 * **There is no empty-menu guard**, and that is a fact about this tree rather than an
 * omission: `childTypeChoices` answers the empty list for a MARKER alone, and a marker can
 * be neither a member (`membershipTarget` refuses every carrier `inPlan` excludes) nor a
 * context ancestor (it holds no children to be above). Every other row — the bottom rung of
 * either ladder included — still offers the extra types that hang from it. A guard here
 * would be the unreachable branch this module's neighbours argue against; if a marker ever
 * does reach this tree, the symptom is an empty menu and the fix belongs at whatever let it
 * in.
 */
function scopeMenu(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, row: ScopeRow): Menu {
	const types = childTypeChoices(row.item);
	const menu = new Menu();
	for (const type of types) {
		// One entry per type rather than one entry that then asks, the backlog menu's own
		// reason: a menu is already a list of choices, so naming them here is a click
		// shorter than a picker in the modal.
		menu.addItem((mi) =>
			mi
				.setTitle(t('menu.newChild', { type }))
				.setIcon('plus')
				.onClick(() => promptNewMember(view, release, settings, row, type)),
		);
	}
	return menu;
}

/**
 * Ask for the title, then create — the gate first, because creation writes frontmatter and
 * every write path in this plugin goes through `configProblems` (`CLAUDE.md`'s write
 * boundary). Asked BEFORE the prompt rather than at submit: a dialog that collects a title
 * and then refuses has spent the user's typing on a configuration they could have been told
 * about at the press.
 *
 * **No folder is ever asked for.** The backlog's own prompt has an `askFolder` branch for a
 * vault where nothing can answer; here the parent row's own folder always can, so the chain
 * below cannot run out and the extra field would be a question with a known answer. The
 * type's own configured folder wins over it, so a `Bug` files itself under the bugs folder
 * from this screen as it does from every other — `view/interactions/create.ts`'s own order,
 * minus its home-folder rung: that option is the BACKLOG view's, offered nowhere in this
 * view's settings, so reading it here would be the stale-mapping hazard `ReleaseView.draw`
 * states for the model keys wearing a folder.
 */
function promptNewMember(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, row: ScopeRow, typeName: string): void {
	const problems = configProblems(settings);
	if (problems.length > 0) {
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return;
	}
	// The row's OWN folder spelled the way `view/interactions/create.ts`'s `normalizeFolder`
	// spells it — the vault root as `''`, not `'/'` — so the detail line below can tell the
	// root from a folder. `parent` is asserted: a `TFile` in a vault always sits in one.
	const own = row.item.file.parent!.path;
	const folder = folderForType(typeName, settings) ?? (own === '/' ? '' : own);
	new TitlePromptModal(view.app, {
		heading: t('create.headingType', { type: typeName }),
		// The detail line names the parent, which is the whole of what this gesture adds
		// over the backlog's own `New <child>`: the reader is on a release screen and the
		// row they right-clicked is what the new note will hang from.
		detail: () =>
			folder
				? t('create.detailUnderInFolder', { parent: row.item.title, folder })
				: t('create.detailUnderRoot', { parent: row.item.title }),
		types: [typeName],
		onSubmit: ({ title }) => void createMember(view, release, settings, row, { title, typeName, folder }),
	}).open();
}

interface NewMember {
	title: string;
	typeName: string;
	folder: string;
}

/**
 * The one place a note is created from this screen — both inputs above land here.
 *
 * The rank is `ORDER_SPACING` past the highest ranked child of the parent ROW's own
 * children, read from the model rather than from the tree: a scope row draws only this
 * release's members and their ancestors, so ranking against what is on screen would put a
 * new child on top of a sibling that belongs to another release and is merely not drawn
 * here. Same shape as `endOfSiblingsOrder` in `view/interactions/create.ts`, over the
 * item's full child list for that reason.
 *
 * Unfolding is done AFTER the create and only when the parent is actually folded: a new
 * child under a closed row would otherwise land somewhere the reader cannot see it.
 * `toggleFold` re-renders, which is also how the tree picks the note up once the base's
 * next pass returns it.
 */
async function createMember(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, row: ScopeRow, spec: NewMember): Promise<void> {
	try {
		const file = await createBacklogItem(view.app, settings, {
			folder: spec.folder,
			title: spec.title,
			typeName: spec.typeName,
			parent: row.item.file,
			order: endOfChildrenOrder(row),
			release: release.item.file,
		});
		new Notice(t('create.created', { name: file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to create item', e);
		new Notice(t('create.failed'));
		return;
	}
	const parentPath = row.item.file.path;
	if (foldedPaths(view, release.path).has(parentPath)) toggleFold(view, release.path, parentPath);
}

/** An order value placing the new child after every ranked child the parent already has. */
function endOfChildrenOrder(row: ScopeRow): number {
	let maxOrder = 0;
	for (const child of row.item.children) {
		if (child.order !== null && child.order > maxOrder) maxOrder = child.order;
	}
	return Math.floor(maxOrder) + ORDER_SPACING;
}
