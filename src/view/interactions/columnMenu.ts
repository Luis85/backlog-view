import { Menu } from 'obsidian';
import { BacklogViewHost, ColumnScope } from '../host';
import { BoardColumn } from '../../domain/board';
import { showMenuForClick } from './menu';

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
 * currently sits.
 *
 * A policy is text, not an action, so its entry stays disabled: the menu makes the policy
 * reachable without a pointer, and an entry that looked clickable would promise a command
 * that does not exist.
 *
 * Null only with no column at all — an index naming nothing.
 */
export function buildColumnMenu(host: BacklogViewHost, scope: ColumnScope, col: BoardColumn | undefined): Menu | null {
	if (!col) return null;
	const menu = new Menu();
	// `false`: this asks, it must not settle. The default has already been taken by the
	// render that drew the column this menu is being opened on — see `columnCollapsed`
	// in `view/collapseState.ts`.
	const folded = host.columnCollapsed(scope, col.state, false);
	menu.addItem((mi) =>
		mi
			.setTitle(folded ? `Expand ${col.label}` : `Collapse ${col.label}`)
			.setIcon(folded ? 'chevron-down' : 'chevron-right')
			.onClick(() => host.setColumnCollapsed(scope, col.state, !folded)),
	);
	if (col.policy) menu.addItem((mi) => mi.setTitle(col.policy).setIcon('info').setDisabled(true));
	return menu;
}

/** The pointer path onto that menu. */
export function showColumnMenu(host: BacklogViewHost, evt: MouseEvent, scope: ColumnScope, col: BoardColumn): void {
	const menu = buildColumnMenu(host, scope, col);
	if (!menu) return;
	evt.preventDefault();
	showMenuForClick(menu, evt);
}
