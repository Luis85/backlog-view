import { Menu, Notice } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { BacklogSettings } from '../../domain/settings';
import { ReleaseRow, refusesLiveMembership } from '../../domain/releases';
import { ScopeRow } from '../../domain/scopeRows';
import { childTypeChoices, folderForType, inCatalog } from '../../domain/itemTypes';
import { configProblems } from '../../domain/settingsConsistency';
import { rankablePeers } from '../../domain/dropTargets';
import { dropPlacement, refusalKey } from '../../domain/writePlan';
import { createBacklogItem } from '../../storage/createNote';
import { TitlePromptModal } from '../../ui/prompts';
import { showMenuAtElement, showMenuForClick } from '../interactions/menu';
import { TreeDraw } from '../scopeKeys';
import { releaseFoldedPaths, toggleReleaseFold } from './scopeTree';

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
export function wireScopeCreate(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, draw: TreeDraw): void {
	const { treeEl, rows, rowEls } = draw;
	const menuFor = (row: ScopeRow): Menu | null => scopeMenu(view, release, settings, row);

	treeEl.addEventListener('contextmenu', (evt) => {
		// `evt.target` is asserted rather than tested: this listener is on `treeEl`, so a
		// dispatched event always reports an element under it, and an `instanceof` guard here
		// would be the unreachable branch this module's neighbours already argue against.
		const rowEl = (evt.target as Element).closest('.pbl-row');
		const row = rows.find((r) => rowEls.get(r.item.file.path) === rowEl);
		const menu = row ? menuFor(row) : null;
		// The browser's own menu would otherwise cover this one. Only once there IS a menu:
		// the tree's own padding, and a row this screen may create nothing under, both still
		// get the pane's menu rather than nothing at all.
		if (!menu) return;
		evt.preventDefault();
		// `showMenuForClick`, never `showAtMouseEvent` — the rule that module states and
		// lint enforces: a synthesized click reports (0, 0) and would drop the menu in the
		// viewport corner.
		showMenuForClick(menu, evt);
	});

	treeEl.addEventListener('keydown', (evt) => {
		// Both spellings, because a keyboard without a Menu key has only the second — the
		// pair `view/interactions/keyboard.ts` already wires for the backlog's own tree.
		if (evt.key !== 'ContextMenu' && !(evt.key === 'F10' && evt.shiftKey)) return;
		// `activeRowFile` rather than an index of our own: `scopeKeys.ts` writes it on
		// every move of its roving selection, so reading it here is what stops two
		// controllers on one tree disagreeing about which row is active. Matched on the
		// FILE for that module's own reason — Obsidian mutates a `TFile` in place on rename.
		const file = view.activeRowFile;
		const row = file === null ? undefined : rows.find((r) => r.item.file === file);
		if (!row) return;
		const menu = menuFor(row);
		// Consumed only once there IS a menu — the pointer path's rule, and the keyboard has
		// the same reason to keep it: a catalog row opens none, and swallowing the chord
		// there would leave that reader with neither this menu nor the pane's own. It was
		// written the other way round for one commit, which is the shape of mistake a fix
		// applied to one of two inputs makes (Codex, PR #214).
		if (!menu) return;
		evt.preventDefault();
		// `!` for `scopeKeys.ts`'s own reason: `row` came out of `rows`, and `rowEls` was
		// built from that same array while drawing it, so the lookup always hits.
		showMenuAtElement(menu, rowEls.get(row.item.file.path)!);
	});
}

/**
 * One entry per type the row may hold, and nothing else — the answer to "what else could
 * be on this menu" is `test/view/releaseNeverEdits.test.ts`: every other entry the backlog's
 * own row menu carries edits the row's own frontmatter, which this view does not do.
 *
 * **`null` on a TEST-CATALOG row**, which is the one row this tree draws whose children
 * could not join the release the menu would seed. It is reachable and was found by review
 * (Codex, PR #214): `ladderFor` chains off the parent for a `Task` and a typeless note
 * alone, so an `Epic` parented under a `Test suite` stays on the plan's ladder and can be a
 * member — which draws that suite above it as a context row. `childTypeChoices` answers
 * such a row with its own catalog child (`if (inCatalog(parent)) return [ladderChild]`),
 * and `mayHoldField(type, 'release', settings)` refuses every one of those: a release holds
 * plan work, and the catalog is not the plan's. Offered anyway, the note would be created
 * carrying a link its own reader reports as an unresolved membership and would vanish from
 * the screen it was made on — the exact failure the membership seed exists to prevent,
 * one row over.
 *
 * The question is asked of the ROW and not of each type, because a type NAME cannot answer
 * it: `Task` is on both ladders, so a task under a `Test case` passes `mayHoldField` and is
 * refused by `inPlan` at the reading end. `inCatalog(row.item)` is the same question one
 * step earlier, where the parent that decides the child's ladder is in hand — and it is
 * exactly the branch `childTypeChoices` itself takes to pick what to offer.
 *
 * No other row answers empty: a marker can be neither a member nor a context ancestor (it
 * holds no children to be above), and every plan row offers its own rung plus the extra
 * types, none of which is a marker.
 */
function scopeMenu(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, row: ScopeRow): Menu | null {
	// A catalog row's children are catalog notes, and a release holds plan work.
	if (inCatalog(row.item)) return null;
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
 * The rank comes from `dropPlacement` — the same question the backlog's own creation and
 * every drop ask, with a null `dragged` because the note does not exist yet. This screen
 * used to compute it itself: one spacing past the highest ranked child of the parent row.
 * That was right while `order` was a rank within a sibling group and became a duplicate
 * generator the day it became one rank over the population, because both halves of it are
 * functions of the PEER values alone — two subtrees whose children end at the same number
 * are handed the same next number, and a note ranked between the peers is exactly where a
 * peer midpoint lands.
 *
 * The PEERS are still the item's full child list read from the model rather than from the
 * tree: a scope row draws only this release's members and their ancestors, so a peer group
 * taken from the screen would put a new child on top of a sibling that belongs to another
 * release and is merely not drawn here.
 *
 * **A refused rank refuses the note**, the same trade `view/interactions/create.ts` makes:
 * a note at a number another row already holds, nowhere near the slot the reader asked
 * for, is worse than no note. The remedies the notices name — the backlog toolbar's ✨,
 * `Respace ranks` — are not on THIS screen, which is the honest state of it: they act on
 * the same vault from one pane over.
 *
 * Unfolding is done AFTER the create and only when the parent is actually folded: a new
 * child under a closed row would otherwise land somewhere the reader cannot see it.
 * `toggleReleaseFold` re-renders, which is also how the tree picks the note up once the base's
 * next pass returns it.
 *
 * **The release is re-read here, not trusted from the row** — `refusesLiveMembership`, the
 * identical guard `applyWrites` puts in front of every membership EDIT, asked at the moment
 * of writing rather than at the moment of offering. The window this closes is longer than a
 * batch's: the prompt stays open for as long as the reader takes to type, and the release
 * can be deleted or retyped in another pane meanwhile. Without it the new note would be
 * born naming a note the vault no longer calls a release — reported by
 * [[The scope of a release as a tree]] 1b as an unresolved membership, which is a fair
 * report of a note that should never have been made that way. Found by review
 * (Codex, PR #214), the same finding PR #201 made against the edit path.
 *
 * **The settings are deliberately not re-read beside it** —
 * `docs/issues/A creation outlives what it was planned against.md` states why the release
 * is the one that earned a guard: the edit path already had this exact function, so the
 * creation path was inconsistent with a rule already written down.
 *
 * The PARENT was on that list too until the rank became global. It is re-resolved now, and
 * for a different reason than the release's: not "may this note still be written" but
 * "where does the new note rank", which is a question about the LIVE population. The file
 * written as the parent link is still the captured one; only the anchor is re-read. See
 * the comment at the lookup.
 */
async function createMember(view: ReleaseView, release: ReleaseRow, settings: BacklogSettings, row: ScopeRow, spec: NewMember): Promise<void> {
	if (refusesLiveMembership(view.app, release.item.file, settings)) {
		new Notice(t('release.scope.staleRelease'));
		return;
	}
	// **Routing a caller through a shared helper transfers the helper's REQUIREMENTS, not
	// only its behaviour**, and this is the third place that lesson has been learnt on this
	// branch. `dropPlacement` finds its anchor by IDENTITY (`ranked.indexOf`), so the row
	// the menu closed over is the wrong object the moment a Bases pass rebuilds the model
	// under the open modal: it scores -1, and a fully ranked vault refuses `unranked` —
	// a notice sending the reader to a backfill with nothing to fill. Re-resolved by path,
	// with the peers AND the population read off that same live model.
	// `view.model` is asserted, the way `row.item.file.parent` is two functions up: this runs
	// from a menu on a row the scope tree DREW, and there is no tree before there is a model.
	const model = view.model!;
	const parent = model.byPath.get(row.item.file.path);
	// A parent that no longer resolves is not a root request. The write below still names
	// the CAPTURED file, so ranking it among the roots would make a note parented to
	// something gone and ranked nowhere near it.
	if (!parent) {
		new Notice(t(refusalKey('parentGone')));
		return;
	}
	// `rankablePeers` (`domain/dropTargets.ts`, own comment): a trailing unranked context
	// row among the parent's real children is not a peer to append past.
	const peers = rankablePeers(parent.children);
	const placed = dropPlacement(null, { parent, peers, insertIndex: peers.length }, model.ranked);
	if ('refusal' in placed) {
		new Notice(t(refusalKey(placed.refusal)));
		return;
	}
	try {
		const file = await createBacklogItem(view.app, settings, {
			folder: spec.folder,
			title: spec.title,
			typeName: spec.typeName,
			parent: row.item.file,
			order: placed.order,
			release: release.item.file,
		});
		new Notice(t('create.created', { name: file.basename }));
	} catch (e) {
		console.error('Product Backlog: failed to create item', e);
		new Notice(t('create.failed'));
		return;
	}
	const parentPath = row.item.file.path;
	if (releaseFoldedPaths(view, release.path).has(parentPath)) toggleReleaseFold(view, release.path, parentPath);
}

