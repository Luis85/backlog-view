/** Fixtures and accessors for the board projection, shared by the board view suites. */
import { FakeVault } from './vault';
import { Harness, makeView } from './view';

export function columnsOf(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-board-col'));
}

export function columnNames(containerEl: HTMLElement): string[] {
	return columnsOf(containerEl).map((c) => c.querySelector('.pbl-board-col-name')?.textContent ?? '');
}

export function columnByName(containerEl: HTMLElement, name: string): HTMLElement {
	const col = columnsOf(containerEl).find((c) => c.querySelector('.pbl-board-col-name')?.textContent === name);
	if (!col) throw new Error(`column not found: ${name}`);
	return col;
}

export function cardTitles(el: HTMLElement): string[] {
	return Array.from(el.querySelectorAll<HTMLElement>('.pbl-card')).map(
		(c) => c.querySelector('.pbl-card-title')?.textContent ?? '',
	);
}

export function cardByTitle(containerEl: HTMLElement, title: string): HTMLElement {
	const card = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card')).find(
		(c) => c.querySelector('.pbl-card-title')?.textContent === title,
	);
	if (!card) throw new Error(`card not found: ${title}`);
	return card;
}

export function countOf(col: HTMLElement): string {
	return col.querySelector('.pbl-board-col-count')?.textContent ?? '';
}

/** The workflow the board suites configure: three states, `status` as the property. */
export const BOARD_WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done' };

/** Two epics and two features, spread across the workflow — one of them stateless. */
export function boardVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

/**
 * A view already showing the board. The mode is UI state, not a base setting, so it
 * is flipped through the host exactly as the toolbar does — never through the config.
 */
export function makeBoard(
	vault: FakeVault,
	extra: Record<string, unknown> = {},
	{
		focus,
		folds,
		foldedColumns,
		hideCompleted,
	}: { focus?: string; folds?: boolean; foldedColumns?: boolean; hideCompleted?: boolean } = {},
): Harness {
	const harness = makeView(vault, { ...BOARD_WORKFLOW, ...extra }, { collapsed: true, focus, folds, hideCompleted });
	harness.view.setProjection('board');
	if (!foldedColumns) expandColumns(harness.containerEl);
	return harness;
}

/**
 * Open every column that came up folded — `makeView`'s own `collapsed` rule, applied to
 * the board: a done column holding no open work starts shut, so a suite about anything
 * else would otherwise be asserting against a fold it never asked for. Opt back in with
 * `{ foldedColumns: true }`, exactly as a tree test opts into `{ collapsed: true }`.
 *
 * Through the real disclosure, and re-queried after every click, because the toggle
 * rebuilds the whole projection and the button pressed no longer exists. Bounded rather
 * than looping until clean: a click that failed to change the state would otherwise hang
 * the suite instead of failing it.
 */
export function expandColumns(containerEl: HTMLElement): void {
	for (let i = 0; i < 50; i++) {
		const shut = containerEl.querySelector<HTMLElement>('.pbl-board-col .pbl-chevron[aria-expanded="false"]');
		if (!shut) return;
		shut.click();
	}
	throw new Error('columns would not open');
}
