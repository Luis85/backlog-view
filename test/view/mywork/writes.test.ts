// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../../helpers/obsidian-mock';
import { flush } from '../../helpers/view';
import { makeMyWorkView, mwActive, mwPress, mwRow, myWorkVault, refreshMyWork, treeEl } from '../../helpers/mywork';
import { t } from '../../../src/i18n/t';
import type { MyWorkView } from '../../../src/view/mywork/myWorkView';
import { FakeVault } from '../../helpers/vault';

/**
 * `view/mywork/rowMenu.ts` — Task 9 of [[Assigned work in the sidebar]]: the one write
 * this surface offers, Set state, through the same gate and the same context-row
 * refusals every other projection's Set state goes through.
 *
 * Driven over the shared `myWorkVault()` fixture (`test/helpers/mywork.ts`), whose Ada
 * tree is `Epic.md` (context) -> `Feature.md` (context) -> `PBI Ada.md`, plus
 * `PBI Hidden.md` re-rooted under `Epic.md`. The task brief sketched a `Mine.md`/
 * `Outside.md` fixture that does not exist here — the human settled that an
 * `outsideFilter` ancestor is SKIPPED by the scope walk and so is never drawn as a row,
 * which is why the "no writing action" case below opens the menu on `Epic.md` (an
 * INCLUDED context ancestor, drawn but not a member) rather than on the excluded
 * `Hidden Feature.md`, and the batch-refusal case drives `view.gate.applySafely`
 * directly with `Hidden Feature.md` named in it, since that row is never on screen for a
 * menu to open on.
 */

function menuOn(view: MyWorkView, path: string): void {
	mwRow(view, path).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
}

function labels(menu: Menu | null | undefined): string[] {
	return menu?.items.map((item) => item.titleText) ?? [];
}

function choose(menu: Menu | null, title: string): void {
	const item = menu?.item(title) ?? menu?.item(t('mywork.menu.setState'))?.submenu?.item(title);
	if (!item) throw new Error(`no entry titled ${title}`);
	item.click();
}

describe('the my-work row menu writes', () => {
	it('sets a state through the gate, and stamps it', async () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault, { stateProperty: 'note.state', finishedDateProperty: 'note.finished' });
		view.pick('People/Ada.md');

		menuOn(view, 'PBI Ada.md');
		choose(Menu.lastShown, 'Done');
		await flush();

		expect(vault.fm('PBI Ada.md').state).toBe('Done');
		expect(vault.fm('PBI Ada.md').finished).toBeTruthy();
	});

	it('offers NO writing action on a context row', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		// `Epic.md` is a context ancestor of Ada's own tree — drawn, but never a member —
		// and an INCLUDED note (the base's own result set carries it), unlike
		// `Hidden Feature.md`, which the scope walk skips entirely and never draws a row
		// for at all.
		menuOn(view, 'Epic.md');
		expect(labels(Menu.lastShown)).toEqual([t('mywork.menu.open'), t('mywork.menu.openTab')]);
	});

	it('refuses the WHOLE batch if any write names an excluded note', async () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);

		await view.gate.applySafely([
			{ file: vault.files.get('PBI Ada.md')!, state: 'Done' },
			// `Hidden Feature.md` is this fixture's own `outsideFilter` note — never drawn
			// as a row, so this batch is built by hand rather than through the menu.
			{ file: vault.files.get('Hidden Feature.md')!, state: 'Done' },
		]);
		await flush();

		expect(vault.fm('Hidden Feature.md').status).toBeUndefined();
		// Rejected, never filtered: the WHOLE batch is refused, so the legitimate write
		// alongside the excluded one never lands either.
		expect(vault.fm('PBI Ada.md').status).toBeUndefined();
	});

	it('checks the entry the plan would write nothing for', async () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault, { stateProperty: 'note.state', stateValues: 'Open, Done' });
		view.pick('People/Ada.md');

		// Give `PBI Ada.md` a state the plan already agrees with, through the gate rather
		// than by hand-editing the vault — the same write path the menu itself uses. A
		// write updates the vault but nothing refreshes on its own (`test/CLAUDE.md`), so
		// the model is rebuilt by hand before the menu is asked what it already holds.
		await view.gate.applySafely([{ file: vault.files.get('PBI Ada.md')!, state: 'Done' }]);
		await flush();
		refreshMyWork(view, vault);

		menuOn(view, 'PBI Ada.md');
		const submenu = Menu.lastShown?.item(t('mywork.menu.setState'))?.submenu;
		// Asked of the PLAN, not of a value comparison beside it: `Open` would write
		// something (unchecked) and `Done` would write nothing (checked).
		expect(submenu?.item('Open')?.checked).toBe(false);
		expect(submenu?.item('Done')?.checked).toBe(true);
	});

	it('opens the note through the configured target', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		menuOn(view, 'PBI Ada.md');
		Menu.lastShown?.item(t('mywork.menu.open'))?.click();
		// `MyWorkSettings.openIn` defaults to `'split'` — the row's OWN configured target,
		// never a hard-coded one.
		expect(vault.opened.at(-1)).toEqual({ path: 'PBI Ada.md', mode: 'split' });
	});

	it('opens the note in a new tab', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		menuOn(view, 'PBI Ada.md');
		Menu.lastShown?.item(t('mywork.menu.openTab'))?.click();
		expect(vault.opened.at(-1)).toEqual({ path: 'PBI Ada.md', mode: 'tab' });
	});

	it('opens the same menu from the keyboard, anchored at the roving row', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		// The tree is one tab stop and rows are reached through `aria-activedescendant`
		// (`src/view/CLAUDE.md`), so DOM focus never leaves `treeEl` — the context menu is
		// the documented keyboard route to a row, not a pointer-only convenience.
		mwPress(view, 'ArrowDown'); // Epic.md -> Feature.md
		mwPress(view, 'ArrowDown'); // Feature.md -> PBI Ada.md
		expect(mwActive(view)).toBe('PBI Ada.md');

		Menu.forget();
		mwPress(view, 'ContextMenu');

		expect(labels(Menu.lastShown)).toEqual([t('mywork.menu.open'), t('mywork.menu.openTab'), t('mywork.menu.setState')]);
	});

	it('offers no action when the pointer never lands on a row', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		// Dispatched on the tree itself, never on a `.pbl-row` descendant — the browser's
		// own context menu should be left alone rather than this view drawing an empty one.
		Menu.forget();
		treeEl(view).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown).toBeNull();
	});

	// Dispatch is by the item's OWN workflow, never the requirements one — the human's own
	// correction to this task's brief. A Deliverable's Set state must read and write its
	// own `deliverableState` property, never `stateKey`, and carry no started/finished
	// stamp (Scope: the Deliverables board keeps none).
	it('dispatches a Deliverable row through its OWN workflow', async () => {
		const vault = new FakeVault();
		vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Deliv.md', { frontmatter: { type: 'Deliverable', order: 1, assignee: 'Dana', delivState: 'Draft' } });
		const { view } = makeMyWorkView(vault, { deliverableStateProperty: 'note.delivState', deliverableStateValues: 'Shipped' });
		view.pick('Dana.md');

		menuOn(view, 'Deliv.md');
		const submenu = Menu.lastShown?.item(t('mywork.menu.setState'))?.submenu;
		// `Draft` is the note's own CURRENT value and is not in the configured list — it
		// still earns an entry, drawn checked, so the current state always renders as one.
		expect(labels(submenu)).toEqual(['Shipped', 'Draft']);
		expect(submenu?.item('Draft')?.checked).toBe(true);
		expect(submenu?.item('Shipped')?.checked).toBe(false);

		submenu?.item('Shipped')?.click();
		await flush();
		expect(vault.fm('Deliv.md').delivState).toBe('Shipped');
		expect(vault.fm('Deliv.md').finished).toBeUndefined();
	});

	// The test catalog is the third workflow this tree's own membership predicate admits
	// (`assignedWork.ts`) — a Test case reads and writes `testState`, never `stateKey`.
	it('dispatches a test-catalog row through its OWN workflow', async () => {
		const vault = new FakeVault();
		vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 1 } });
		vault.addFile('Case.md', {
			frontmatter: { type: 'Test case', order: 1, assignee: 'Dana' },
			parentLink: 'Suite',
		});
		const { view } = makeMyWorkView(vault, { testStateProperty: 'note.testState', testStateValues: 'Ready, Passed' });
		view.pick('Dana.md');

		menuOn(view, 'Case.md');
		choose(Menu.lastShown, 'Passed');
		await flush();

		expect(vault.fm('Case.md').testState).toBe('Passed');
		expect(vault.fm('Case.md').finished).toBeUndefined();
	});

	it('blocks every write while the settings have a problem', async () => {
		const vault = myWorkVault();
		// Two unrelated optional properties pointed at the same key is a collision
		// `configProblems` reports — the gate refuses the whole batch before anything is
		// touched, never only the offending part.
		const { view } = makeMyWorkView(vault, { startedDateProperty: 'note.dup', finishedDateProperty: 'note.dup' });
		view.pick('People/Ada.md');

		menuOn(view, 'PBI Ada.md');
		choose(Menu.lastShown, 'Done');
		await flush();

		expect(vault.fm('PBI Ada.md').status).toBeUndefined();
	});
});
