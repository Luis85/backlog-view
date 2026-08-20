import { Menu } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost, BoardSnapshot, ColumnScope } from '../host';
import { BoardColumn, columnFoldValue, emptyNoState } from '../../domain/board';
import { showMenuAtElement, showMenuForClick } from './menu';

/**
 * A board column's own menu — its fold, and the working agreement written on it.
 *
 * Its own module rather than a third pair of exports in `interactions/menu.ts`, which is
 * about an ITEM: everything there is built from a note, a type ladder and a write plan,
 * while a column is a value with no note behind it and nothing here plans a write at all.
 * The split happened when the fold joined the menu and `menu.ts` went over its line budget,
 * which is the budget doing its job rather than an inconvenience — the two subjects had
 * been sharing a file since the policy entry was one line.
 */

/**
 * The fold is what makes this menu unconditional. It used to be null on a column with
 * nothing agreed, and that was right while the policy was all it held; now every column has
 * one thing that can be done to it, and this is the KEYBOARD path to it — the header's own
 * disclosure is a `tabindex="-1"` button like every per-row control, so without an entry
 * here the fold would be pointer-only on a stop the arrows already reach. One builder behind
 * both surfaces, so the button and the entry cannot disagree about which way the column
 * currently sits — and, since a review found them disagreeing about something else, they
 * now go dark together while a filter runs. Sharing the STATE was never the whole of
 * agreeing.
 *
 * A policy is text, not an action, so its entry stays disabled: the menu makes the policy
 * reachable without a pointer, and an entry that looked clickable would promise a command
 * that does not exist.
 *
 * Null only with no column at all — an index naming nothing.
 */
function buildColumnMenu(host: BacklogViewHost, scope: ColumnScope, col: BoardColumn | undefined): Menu | null {
	if (!col) return null;
	const menu = new Menu();
	// `false`: this asks, it must not settle. The default has already been taken by the
	// render that drew the column this menu is being opened on — see `columnCollapsed`
	// in `view/viewState.ts`.
	const folded = host.columnCollapsed(scope, columnFoldValue(col), false);
	// The empty no-state strip has no fold to offer, and the header draws it no disclosure
	// for the same reason: it is ALREADY a 44px strip with nothing in it, so folding would
	// swap its dashed frame for a solid one, persist a fold nobody could watch themselves
	// make, and shut the first stateless card that arrives out of sight. `emptyNoState` is
	// one predicate serving both surfaces rather than a second reading beside the first.
	const foldable = folded || !emptyNoState(col);
	if (foldable) addFoldItem(host, menu, scope, { col, folded });
	if (col.policy) menu.addItem((mi) => mi.setTitle(col.policy).setIcon('info').setDisabled(true));
	// Nothing to say: back to reporting no menu, so the keyboard leaves the key to whoever
	// else wants it rather than swallowing it on a stop where nothing happens.
	return foldable || col.policy ? menu : null;
}

/**
 * **Two surfaces over one action have to be AVAILABLE at the same times**, which is a
 * second question from agreeing about the state, and this pair has come apart on it twice.
 * Once on the quick filter, withdrawn on 2026-08-17: `renderChevron` disabled itself while
 * one ran and this entry did not, and because the filter override made `columnCollapsed`
 * answer false, a folded column offered an enabled Collapse that wrote a fold nothing on
 * screen could show. Once on the empty no-state strip above. Both found by review, PR #140.
 *
 * What the second fix does that the first did not is take the chance of a third away:
 * `foldable` above is `emptyNoState`, the same predicate the HEADER draws its disclosure
 * from, so this entry cannot be offered where no disclosure is. Nothing is copied here to
 * drift — which is the whole of the rule the filter case is now only the evidence for. Ask
 * it of any third surface: not "does it say the same thing" but "is it offered exactly when
 * the first one is", and then put the answer somewhere both read.
 */
function addFoldItem(
	host: BacklogViewHost,
	menu: Menu,
	scope: ColumnScope,
	column: { col: BoardColumn; folded: boolean },
): void {
	const { col, folded } = column;
	menu.addItem((mi) => {
		// The key the column HEADER's own disclosure draws from (`render/board.ts`), not a
		// second one saying the same thing: the rule this pair has already come apart on
		// twice is that two surfaces over one action must not be able to disagree, and a
		// second key is exactly a place for them to. `col.label` is the column's value and
		// stays a parameter.
		mi.setTitle(t(folded ? 'fold.expandColumn' : 'fold.collapseColumn', { name: col.label }))
			.setIcon(folded ? 'chevron-down' : 'chevron-right')
			.onClick(() => host.setColumnCollapsed(scope, columnFoldValue(col), !folded));
	});
}

/** The pointer path onto that menu. */
export function showColumnMenu(host: BacklogViewHost, evt: MouseEvent, scope: ColumnScope, col: BoardColumn): void {
	const menu = buildColumnMenu(host, scope, col);
	if (!menu) return;
	evt.preventDefault();
	showMenuForClick(menu, evt);
}

/**
 * The keyboard path onto that same menu, anchored to the column's own header element —
 * the whole of `BacklogViewHost.showColumnMenuFor`, kept there as one delegation on the
 * view so `BacklogViewHost` still resolves to that one class.
 *
 * The scope comes off the snapshot rather than being re-derived from the projection: the
 * render that drew these columns is the one thing that cannot be wrong about which board
 * they belong to.
 */
export function showColumnMenuForIndex(host: BacklogViewHost, board: BoardSnapshot | null, index: number): boolean {
	return showMenuAtElement(board && buildColumnMenu(host, board.scope, board.board.columns[index]), board?.colEls[index] ?? null);
}
