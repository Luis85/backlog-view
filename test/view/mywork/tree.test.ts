// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMyWorkView, mwRow, mwTwisty, myWorkVault, refreshMyWork, rowPaths } from '../../helpers/mywork';
import { setScopeFlag } from '../../../src/view/scopeFolds';
import { FakeVault } from '../../helpers/vault';

/**
 * `view/mywork/renderTree.ts` — Task 6 of [[Assigned work in the sidebar]].
 *
 * The vault this suite drives is `myWorkVault()` (`test/helpers/mywork.ts`), not the
 * `Mine.md`-shaped fixture the task brief sketched: it has no such file. Ada's own tree,
 * given the settled skip of an `outsideFilter` ancestor
 * (`domain/scopeRows.ts`'s `scopeRows`):
 *
 *   Epic.md (context) -> Feature.md (context) -> PBI Ada.md (member)
 *                      -> PBI Hidden.md (member, RE-ROOTED here because
 *                         Hidden Feature.md — its real parent — is outsideFilter)
 *
 * `PBI Hidden.md` is what makes the "own level and sibling place" test meaningful: in the
 * BACKLOG's own hierarchy it is level 3 (Epic -> Hidden Feature -> PBI Hidden), but in
 * Ada's own tree it re-roots one level up.
 */

afterEach(() => {
	vi.restoreAllMocks();
});

describe('the my-work tree', () => {
	it('draws a member under its ancestors, with the ancestors marked as context', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		expect(rowPaths(view)).toEqual(['Epic.md', 'Feature.md', 'PBI Ada.md', 'PBI Hidden.md']);
		expect(mwRow(view, 'Epic.md').classList.contains('pbl-mw-context')).toBe(true);
		expect(mwRow(view, 'Feature.md').classList.contains('pbl-mw-context')).toBe(true);
		expect(mwRow(view, 'PBI Ada.md').classList.contains('pbl-mw-context')).toBe(false);
	});

	it('marks exactly one row as what is next', () => {
		// No `stateProperty` value on any note, so every member reads as not done and the
		// FIRST one in plan order — `PBI Ada.md`, ahead of the re-rooted `PBI Hidden.md` —
		// is what is next.
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		const marked = view.viewEl.querySelectorAll('.pbl-mw-next');
		expect(marked).toHaveLength(1);
		expect(marked[0].closest('.pbl-row')?.getAttribute('data-path')).toBe('PBI Ada.md');
	});

	it('marks nothing when everything of theirs is done', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada', status: 'Done' } });
		const { view } = makeMyWorkView(vault, { stateProperty: 'note.status' });
		view.pick('People/Ada.md');

		expect(view.viewEl.querySelector('.pbl-mw-next')).toBeNull();
	});

	it('announces its OWN level and sibling place, not the backlog’s', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		// The backlog's own hierarchy puts `PBI Hidden.md` at level 3, third generation
		// under Epic -> Hidden Feature -> PBI Hidden. This tree skips the excluded
		// ancestor, so it re-roots one level up: level 2, and — sharing depth 1 with
		// `Feature.md` — position 2 of 2 rather than an only child.
		const hidden = mwRow(view, 'PBI Hidden.md');
		expect(hidden.getAttribute('aria-level')).toBe('2');
		expect(hidden.getAttribute('aria-posinset')).toBe('2');
		expect(hidden.getAttribute('aria-setsize')).toBe('2');
	});

	it('folds a row, and it is still folded after a redraw', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwTwisty(view, 'Feature.md').click();
		expect(mwRow(view, 'PBI Ada.md', { optional: true })).toBeNull();
		// `PBI Hidden.md` is not Feature's child (it re-roots directly under Epic), so
		// folding Feature must not take it down too.
		expect(mwRow(view, 'PBI Hidden.md', { optional: true })).not.toBeNull();

		view.render();
		expect(mwRow(view, 'PBI Ada.md', { optional: true })).toBeNull();
	});

	it('opens a note on a click, on a context row too', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		mwRow(view, 'Feature.md').click();
		// `FakeVault.opened` records `{ path, mode }` per `getLeaf().openFile()` — opening is
		// not a write, so a context row is a legitimate target for it.
		expect(vault.opened.map((o) => o.path)).toContain('Feature.md');
	});

	it('does not evict the note the reader is on', () => {
		// The whole point of this surface: it answers "what is mine, what is next" WITHOUT
		// taking over the pane being read. The mode recorded is never the one that replaces
		// the active leaf — `OpenController` reuses a side pane by default (`openIn:
		// 'split'`), and the reader decides otherwise through this view's own option.
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		mwRow(view, 'PBI Ada.md').click();
		expect(vault.opened.at(-1)!.mode).not.toBe(false);
	});

	/**
	 * `src/view/CLAUDE.md`'s own drag-select guard, `scopeTree.ts`'s reason exactly: a
	 * drag that ends on the row still dispatches `click`, which must not open the note out
	 * from under a selection the reader just made.
	 */
	it('opens nothing when the pointer-up left a non-collapsed selection behind', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		const titleEl = mwRow(view, 'PBI Ada.md').querySelector('.pbl-title') as HTMLElement;
		const range = document.createRange();
		range.selectNodeContents(titleEl);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		expect(selection.isCollapsed).toBe(false);

		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([]);
		selection.removeAllRanges();
	});

	/**
	 * A middle click never fires `click` — the browser sends `auxclick` instead — so a
	 * surface wiring only the primary gesture silently loses "open in a new tab". The
	 * disclosure is exempt: it wires no `auxclick` of its own to stop one at.
	 */
	it('a middle click opens the note in a new tab; the disclosure is exempt', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'PBI Ada.md', mode: 'tab' }]);

		mwTwisty(view, 'Feature.md').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'PBI Ada.md', mode: 'tab' }]);
	});

	it('a right click through auxclick opens nothing — only the middle button does', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('auxclick', { button: 2, bubbles: true }));
		expect(vault.opened).toEqual([]);
	});

	it('draws a plain badge with no icon for a declared type that is neither a plan rung nor a named extra type', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		// A supported PARENT keeps it in the hierarchy; the declared type itself is neither
		// a plan rung nor a named extra type — `badgeStyleFor`'s own fallback shape,
		// `pbl-lvl-unknown`, no icon.
		vault.addFile('Odd.md', {
			frontmatter: { type: 'Whatsit', order: 1, assignee: 'Ada' },
			parentLink: 'Epic',
		});
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		const badge = mwRow(view, 'Odd.md').querySelector('.pbl-badge');
		expect(badge).not.toBeNull();
		expect(badge!.querySelector('.pbl-badge-icon')).toBeNull();
	});
});

/**
 * Correction 3: `view.settings.stateKey` alone is the wrong question. Task 3b made the
 * Deliverable and test state keys bindable independently of the requirements one, so a
 * vault with `stateProperty` cleared and `deliverableStateProperty` set is a supported
 * configuration whose Deliverable rows read their done-ness perfectly well — gating hide
 * done, or the Next marker, on `stateKey` alone would call that configuration blind.
 */
describe('hide done and the Next marker ask the EFFECTIVE key, not the requirements one', () => {
	it('hides a done Deliverable when only its own key is bound, and never calls it Next', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Deliv.md', {
			frontmatter: { type: 'Deliverable', order: 10, assignee: 'Ada', delivStatus: 'Done' },
		});
		// `stateProperty` explicitly CLEARED (its own default is `status`, a real value —
		// `clearablePropKey`'s own reason for needing the empty string spelled out rather
		// than merely left absent), `deliverableStateProperty` bound instead.
		const { view } = makeMyWorkView(vault, { stateProperty: '', deliverableStateProperty: 'note.delivStatus' });
		view.pick('People/Ada.md');
		setScopeFlag(view, 'myWorkHideDone', true);

		expect(mwRow(view, 'Deliv.md', { optional: true })).toBeNull();
		expect(view.viewEl.querySelector('.pbl-mw-next')).toBeNull();
	});

	it('cannot hide anything, and marks no Next, when no workflow anywhere has a configured key', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Deliv.md', {
			frontmatter: { type: 'Deliverable', order: 10, assignee: 'Ada', delivStatus: 'Done' },
		});
		// Every workflow unbound: `stateProperty` cleared, and neither secondary property
		// is ever set, so `deliverableStateKey`/`testStateKey` keep their own empty
		// default. With no key anywhere, `ownWorkflowReading` reports every item as not
		// done — turning hide done on must do nothing, and the row must not read as Next
		// either, because this tree cannot tell what is finished.
		const { view } = makeMyWorkView(vault, { stateProperty: '' });
		view.pick('People/Ada.md');
		setScopeFlag(view, 'myWorkHideDone', true);

		expect(mwRow(view, 'Deliv.md', { optional: true })).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-mw-next')).toBeNull();
	});
});

/**
 * Fix round 1, finding 1: the global `anyWorkflowConfigured` gate is right for hide done
 * (a row whose doneness is unknowable is not KNOWN done, so leaving it visible is
 * correct) and wrong for the Next marker, which is a POSITIVE claim about ONE row. A
 * workflow being configured somewhere in the tree says nothing about whether THIS row's
 * own effective key (`stateKeyFor`) is bound.
 */
describe('the Next marker asks the PER-ROW key, not whether any workflow anywhere is bound', () => {
	it('skips a member whose own key is unbound, even though another workflow in the tree is configured', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		// Ordered BEFORE the test item — plan order would pick this one first if its own
		// key were readable at all.
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada' } });
		// A catalog member, whose own effective key falls back to `testStateProperty`
		// rather than to the (cleared) requirements one — `resolvedTestStateKey`'s own rule.
		vault.addFile('TestItem.md', { frontmatter: { type: 'Test case', order: 2, assignee: 'Ada' } });
		// `stateProperty` cleared — the PBI's own effective key (`stateKeyFor` reads the
		// requirements key for a plain item) is unbound, so its doneness is unknowable.
		// `testStateProperty` bound — the test item's own key IS configured, even though no
		// note carries a value for it yet (a real, readable "not done", not an unknowable one).
		const { view } = makeMyWorkView(vault, { stateProperty: '', testStateProperty: 'note.status' });
		view.pick('People/Ada.md');

		const marked = view.viewEl.querySelectorAll('.pbl-mw-next');
		expect(marked).toHaveLength(1);
		expect(marked[0].closest('.pbl-row')?.getAttribute('data-path')).toBe('TestItem.md');
	});
});

/**
 * Fix round 1, finding 2: the fifth exit `drawMyWorkTree` returns `null` for (no work / all
 * done) is reachable from a DATA UPDATE, not only from a fresh pick — a Bases refresh that
 * removes the picked person's last assignment redraws straight into it. Task 4's own
 * capture -> empty() -> draw() -> restoreFocus() structure exists precisely so a new exit
 * like this one cannot lose focus to `document.body`; nothing before this fix round drove
 * a redraw INTO this exit while focus was inside the tree.
 */
describe('a data update that empties the tree does not strand focus on the body', () => {
	it('keeps focus somewhere in the view, and does not throw, when the last assignment disappears', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada' } });
		const { view, containerEl } = makeMyWorkView(vault);
		view.pick('People/Ada.md');
		const treeEl = containerEl.querySelector<HTMLElement>('.pbl-mw-tree')!;
		treeEl.focus();
		expect(document.activeElement).toBe(treeEl);

		// The note stays in the base but is no longer Ada's — same shape a real Bases
		// refresh takes when an item is reassigned or unassigned.
		vault.setFrontmatter('PBI.md', { type: 'PBI', order: 1 });
		expect(() => refreshMyWork(view, vault)).not.toThrow();

		expect(document.activeElement).not.toBeNull();
		expect(document.activeElement).not.toBe(document.body);
	});
});

/**
 * Two people, one basename. `namedTargets` is what tells them apart, and
 * `BacklogModel.resourceLabels` is the index built from it — the picker reads that index,
 * so a tree naming the bare basename disagrees with the control that chose it. A screen
 * reader gets the whole of "which person is this" from the tree's `aria-label`, so the two
 * have to be the same answer.
 *
 * Found by review (PR #234, round 5). Watched failing against `person.title`: both trees
 * came back labelled `Ada`.
 */
describe('the tree names the person the way the picker does', () => {
	const twoAdas = (): FakeVault => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Archive/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Current.md', {
			frontmatter: { type: 'PBI', order: 1, assignee: '[[People/Ada|Ada]]' },
		});
		vault.addFile('Old.md', { frontmatter: { type: 'PBI', order: 2, assignee: '[[Archive/Ada|Ada]]' } });
		return vault;
	};

	it('labels each of two same-named resources distinguishably', () => {
		const vault = twoAdas();
		const { view, containerEl } = makeMyWorkView(vault);
		const labelFor = (path: string): string => {
			view.pick(path);
			return containerEl.querySelector<HTMLElement>('.pbl-mw-tree')!.getAttribute('aria-label')!;
		};

		const current = labelFor('People/Ada.md');
		const archived = labelFor('Archive/Ada.md');

		// The rule is that they DIFFER, not what the disambiguation spells: `namedTargets`
		// owns that, and asserting its exact output here would restate it in a second place.
		expect(current).not.toBe(archived);
		expect(view.model!.resourceLabels.get('Archive/Ada.md')).toBe(archived);
	});
});

/**
 * `.pbl-tree` is the scroll container itself (`styles/tree.css`), and `render()` detaches
 * it on every redraw — a state write's own refresh, and every ordinary Bases update. A
 * reader scrolled down a long tree was returned to the top by each one. The keyboard hid
 * it, because `wireScopeKeys` scrolls the active row back into view; a pointer user has no
 * active row to be scrolled to.
 *
 * Stubbed on the PROTOTYPE, `test/view/releaseView.test.ts`'s own shape: jsdom lays nothing
 * out, so `scrollHeight` is 0 on the redrawn element as well as the detached one, and the
 * clamp would swallow the very behaviour under test.
 *
 * Found by review (PR #234, round 6). Watched failing before the capture: 0, not 120.
 */
describe('a redraw keeps the reader where they were', () => {
	it('restores the tree scroll offset', () => {
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(400);
		const { view, containerEl } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const treeEl = containerEl.querySelector<HTMLElement>('.pbl-mw-tree')!;
		treeEl.scrollTop = 120;

		view.render();

		const redrawn = containerEl.querySelector<HTMLElement>('.pbl-mw-tree')!;
		expect(redrawn).not.toBe(treeEl);
		expect(redrawn.scrollTop).toBe(120);
	});

	it('clamps to the fresh height when the redraw is shorter', () => {
		const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(400);
		const { view, containerEl } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		containerEl.querySelector<HTMLElement>('.pbl-mw-tree')!.scrollTop = 380;

		// The redraw is shorter — an item reassigned away, hide-done switched on — so the
		// offset must come back to the new last row rather than park below it.
		scrollHeight.mockReturnValue(90);
		view.render();

		expect(containerEl.querySelector<HTMLElement>('.pbl-mw-tree')!.scrollTop).toBe(90);
	});
});
