// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu, Modal } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import {
	clickExpandAll,
	makeView,
	projectionButton,
	refresh,
	rowByTitle,
	titlesOf,
	treeOf,
	useViewHarness,
} from '../helpers/view';

useViewHarness();

/**
 * One base holding both families, which is the whole bargain: the coverage half of this
 * epic cannot exist with two bases, so both arrive together and the projections divide
 * them.
 *
 * `Stray case` and `Stray PBI` are the two advisory mis-drags, and they are in the
 * everyday fixture rather than a variant because every rule about promoted roots is
 * about them.
 */
function bothFamilies(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
	vault.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
	vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
	vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
	// A test whose parent is a work item, NESTED — a shallow fixture would pass by
	// accident, since a top-level hidden parent and a nested one are the same bug at
	// different depths and only the nested one is reached through a walk.
	vault.addFile('Stray case.md', { frontmatter: { type: 'Test case', order: 20 }, parentLink: 'A PBI' });
	// And the mirror: a work item whose parent is a test.
	vault.addFile('Stray PBI.md', { frontmatter: { type: 'PBI', order: 30 }, parentLink: 'Case' });
	return vault;
}

/** The names `Set assignee` offers on one row, minus the always-present New entry. */
function assigneeOffers(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const sub = Menu.lastShown?.item('Set assignee')?.submenu;
	return (sub?.items ?? [])
		.map((mi) => mi.titleText)
		.filter((t): t is string => typeof t === 'string' && !t.startsWith('New assignee') && t !== 'Clear assignee');
}

/** The values `Set state` offers on one row. */
function stateOffers(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const sub = Menu.lastShown?.item('Set state')?.submenu;
	return (sub?.items ?? []).map((mi) => mi.titleText).filter((t): t is string => typeof t === 'string');
}

/** Switch to the catalog through the real toolbar and open everything it drew. */
function catalog(containerEl: HTMLElement): void {
	projectionButton(containerEl, 'Show as test catalog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
	clickExpandAll(containerEl);
}

describe('the test catalog projection', () => {
	it('is its own toggle position that activates and survives a reload', () => {
		// Two assertions, not one, because they fail at different places: the toggle does
		// nothing at all if the stored constant cannot be mapped back, and it
		// works-then-forgets if the store discards the value on the way in. Neither is
		// caught by setting the projection and asking the view what it is — that path can
		// pass while both halves are wrong. (Deliverables lost its position to the board
		// scope picker on 2026-08-16; the catalog keeps its own.)
		const vault = bothFamilies();
		const { containerEl, view } = makeView(vault, {}, { base: 'Work.base' });
		expect(projectionButton(containerEl, 'Show as backlog tree')).toBeTruthy();

		catalog(containerEl);
		expect(view.projection).toBe('catalog');
		expect(titlesOf(containerEl)).toContain('Suite');
		view.onunload();

		const { containerEl: reopened, view: second } = makeView(vault, {}, { base: 'Work.base' });
		expect(second.projection).toBe('catalog');
		expect(titlesOf(reopened)).toContain('Suite');
	});

	it('draws the tests and no work item, writing nothing', () => {
		const vault = bothFamilies();
		const { containerEl, view } = makeView(vault);
		catalog(containerEl);
		// `Test task` is a catalog member by the membership rule — a `Task` takes its
		// parent's projection — and `Stray PBI` is not, though it hangs from a `Test case`.
		expect(titlesOf(containerEl)).toEqual(['Stray case', 'Suite', 'Case', 'Test task']);
		expect(vault.writeLog).toEqual([]);
		expect(view.projection).toBe('catalog');
	});

	it('announces itself as the test catalog rather than the product backlog', () => {
		// Nothing on screen shows this and no other assertion here would fail if it were
		// wrong: a projection that becomes tree-shaped by falling through would inherit the
		// tree's IDENTITY along with its behaviour, and tell a screen-reader user they are
		// still in the backlog they just left.
		const { containerEl } = makeView(bothFamilies());
		expect(treeOf(containerEl).getAttribute('aria-label')).toBe('Product backlog');
		catalog(containerEl);
		expect(treeOf(containerEl).getAttribute('aria-label')).toBe('Test catalog');
		expect(treeOf(containerEl).getAttribute('role')).toBe('tree');
	});

	it('roots at every test whose parent it does not draw, at whatever depth', () => {
		const { containerEl } = makeView(bothFamilies());
		catalog(containerEl);
		// `Stray case` hangs from a `PBI` nested two levels down. A projection that merely
		// HID the work items would lose it — the walk never reaches a dropped parent's
		// children — which is the case that makes the roots a computation rather than a
		// filter.
		const row = rowByTitle(containerEl, 'Stray case');
		expect(row.getAttribute('aria-level')).toBe('1');
		expect(row.style.getPropertyValue('--pbl-depth')).toBe('0');
		// And the work item it hangs from is nowhere here — not as a row, and not as a
		// context row either: a context row exists because the BASE excluded a parent, and
		// this exclusion is the view's own.
		expect(titlesOf(containerEl)).not.toContain('A PBI');
		expect(containerEl.querySelectorAll('.pbl-outside')).toHaveLength(0);
	});

	it('roots the plan the same way, which is the symmetric half of one rule', () => {
		const { containerEl } = makeView(bothFamilies());
		clickExpandAll(containerEl);
		// A `PBI` under a `Test case` is drawn in the plan, as a root — the same computation
		// read the other way round, so neither note owns only its own direction of it.
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature', 'A PBI', 'Stray PBI']);
		expect(rowByTitle(containerEl, 'Stray PBI').getAttribute('aria-level')).toBe('1');
	});
});

describe('the catalog and the plan share a model and divide it', () => {
	it('counts its own results in each projection, and never the other family', () => {
		const { containerEl } = makeView(bothFamilies(), { showCounts: true });
		const count = () => containerEl.querySelector('.pbl-count-label')?.textContent ?? '';
		// Four plan rows: Epic, Feature, A PBI, Stray PBI.
		expect(count()).toBe('4 items');
		catalog(containerEl);
		// Four catalog rows: Suite, Case, Test task, Stray case — the `Task` beneath a test
		// included, which a count written as "counts tests" would leave visible and
		// uncounted.
		expect(count()).toBe('4 items');
	});

	it('scopes the ASSIGNEE vocabulary per projection like the other three', () => {
		// The fourth observed list, added when the assignee property landed, and the one
		// `rowVocabulary` was not asked for. Both directions, because one shared list
		// satisfies either on its own: a name only a test carries must not be offered on a
		// plan row, and a name only another test carries must still be offered here.
		const vault = bothFamilies();
		vault.addFile('Owned case.md', {
			frontmatter: { type: 'Test case', order: 40, assignee: 'Robin' },
			parentLink: 'Suite',
		});
		vault.addFile('Owned PBI.md', {
			frontmatter: { type: 'PBI', order: 40, assignee: 'Sam' },
			parentLink: 'Feature',
		});
		const { containerEl } = makeView(vault, { assigneeProperty: 'note.assignee' });
		clickExpandAll(containerEl);
		expect(assigneeOffers(containerEl, 'A PBI')).toEqual(['Sam']);
		catalog(containerEl);
		expect(assigneeOffers(containerEl, 'Case')).toEqual(['Robin']);
	});

	it('offers the TEST workflow’s observed states in the catalog and the plan’s in the plan', () => {
		// Both directions in one fixture, because a shared list satisfies either alone.
		const vault = bothFamilies();
		vault.addFile('Ready case.md', {
			frontmatter: { type: 'Test case', order: 40, testStatus: 'Approved' },
			parentLink: 'Suite',
		});
		vault.addFile('Live PBI.md', {
			frontmatter: { type: 'PBI', order: 40, status: 'Shipping' },
			parentLink: 'Feature',
		});
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			testStateProperty: 'note.testStatus',
		});
		clickExpandAll(containerEl);
		expect(stateOffers(containerEl, 'A PBI')).toContain('Shipping');
		expect(stateOffers(containerEl, 'A PBI')).not.toContain('Approved');
		catalog(containerEl);
		expect(stateOffers(containerEl, 'Case')).toContain('Approved');
		expect(stateOffers(containerEl, 'Case')).not.toContain('Shipping');
	});

	it('takes no rollup from a plan row either, so a mis-dragged PBI moves no case', () => {
		// The mirror of the test below, and the direction the one-way guard missed: `Stray
		// PBI` hangs from `Case`, and the catalog HIDES it and promotes it to a plan root —
		// so a rollup on the case counts a descendant nothing in this projection can expand
		// to. A rollup crosses no ladder boundary, in either direction.
		const { containerEl } = makeView(bothFamilies(), { showCounts: true });
		catalog(containerEl);
		const rollup = rowByTitle(containerEl, 'Case').querySelector('.pbl-meta-col')?.textContent ?? '';
		expect(rollup).not.toContain('1');
	});

	it('takes no rollup from a test, so a mis-dragged case moves no bar', () => {
		const { containerEl } = makeView(bothFamilies(), { showCounts: true });
		clickExpandAll(containerEl);
		// `Stray case` hangs from `A PBI` and carries its own subtree. The PBI's rollup is
		// what it was before the drag — the failure mode that is hardest to notice, because
		// the evidence for the wrong number is not on screen.
		const rollup = rowByTitle(containerEl, 'A PBI').querySelector('.pbl-meta-col')?.textContent ?? '';
		expect(rollup).not.toContain('1');
	});

	it('withholds the completed toggle here AND stops filtering by it', () => {
		// A toggle withheld while its filtering stays on is the worst of both: a done test
		// disappears and nothing on screen offers to bring it back.
		const vault = bothFamilies();
		vault.addFile('Done case.md', {
			frontmatter: { type: 'Test case', order: 30, status: 'Done' },
			parentLink: 'Suite',
		});
		const { containerEl } = makeView(vault, { stateProperty: 'note.status', showCompleted: false });
		expect(containerEl.querySelector('[aria-label^="Show completed items"]')).toBeTruthy();
		catalog(containerEl);
		expect(containerEl.querySelector('[aria-label^="Show completed items"]')).toBeNull();
		expect(titlesOf(containerEl)).toContain('Done case');
	});

	it('shows the plan its ordinary empty state when the base returns only tests', () => {
		// Not "All N items are done and hidden", and no button offering to reveal them:
		// this is the result set where the shared arrays those decisions read disagree with
		// the population the projection draws, and every other result set makes them agree.
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
		catalog(containerEl);
		expect(titlesOf(containerEl)).toEqual(['Suite', 'Case']);
	});

	it('offers creation and never configuration when the catalog itself is empty', () => {
		// Unlike the board and the roadmap, this projection needs no key bound to exist, so
		// there is nothing for a ✨ to do here.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault);
		catalog(containerEl);
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No tests yet');
		const cta = containerEl.querySelector<HTMLElement>('.pbl-empty button');
		expect(cta?.textContent).toContain('New Test suite');
		// Pressed, not merely read: an empty state whose one action is a button nobody
		// drives is a button that can be wired to the wrong type and still look right.
		cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// The prompt names where the note will land, which is the shipped default for this
		// type — so this drives the folder mapping too, and would fail on a key spelled
		// `typeFolder.testSuite`, which `byName` would simply never find.
		expect(Modal.lastOpened?.contentEl.textContent).toContain('docs/tests/suites');
	});

	it('is empty, not all-done, when its only row is a context row placing the other projection', () => {
		// The base returns one plan `PBI` and its `Test case` parent is loaded as context.
		// That context row IS a catalog item — so `items` is non-empty — but it is hidden,
		// because the only child it places belongs to the plan. The population and the
		// results disagree, and only the RESULTS answer "is there anything here": the items
		// count reported "All 0 items are done and hidden" with a Show completed items
		// button, in a projection that hides nothing by completion at all.
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
		vault.addFile('Nested PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Case' });
		const { containerEl } = makeView(vault, {}, { only: ['Nested PBI.md'] });
		catalog(containerEl);
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No tests yet');
		expect(containerEl.textContent).not.toContain('done and hidden');
	});

	it('says the same of the plan, where a context test strands a catalog result', () => {
		// The mirror, and it differs only in which membership rule runs: one `Test case`
		// result whose excluded `PBI` parent is a plan row with nothing left to place.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Stray case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'A PBI' });
		const { containerEl } = makeView(vault, {}, { only: ['Stray case.md'] });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
		expect(containerEl.textContent).not.toContain('done and hidden');
	});
});

describe('what the catalog offers', () => {
	it('offers the test types at its top level and no plan type, and the reverse in the plan', () => {
		const { containerEl } = makeView(bothFamilies());
		const pick = () => {
			containerEl
				.querySelector<HTMLElement>('.pbl-new-pick')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		};
		expect(pick()).not.toContain('New Test suite');
		expect(pick()).toContain('New Epic');
		catalog(containerEl);
		expect(pick()).toEqual(['New Test suite', 'New Test case']);
		// A `Task` is NOT offered at the catalog's top level, and that is the case proving
		// the restriction belongs to the creator rather than to a list of names: a `Task`
		// takes its parent's projection, so one created with no parent lands in the plan.
		expect(pick()).not.toContain('New Task');
	});

	it('binds the primary New button to a suite here', () => {
		const { containerEl } = makeView(bothFamilies());
		expect(containerEl.querySelector('.pbl-new-btn')?.getAttribute('aria-label')).toBe('New Epic');
		catalog(containerEl);
		expect(containerEl.querySelector('.pbl-new-btn')?.getAttribute('aria-label')).toBe('New Test suite');
	});

	it("leaves a row's own + alone, which is a separate question from the creator's", () => {
		// `offerableTypes` filters that path too, so a catalog branch written as a type
		// filter passes the criterion above and EMPTIES this control — a `Test case`'s one
		// choice is `Task`, a plan type by name. The two have to be checked apart, because
		// one change satisfies one and breaks the other.
		//
		// Read off the button's own name rather than a menu: a row with exactly one choice
		// opens the creation prompt directly, and `addLabel` derives that name from the
		// same list, so the label IS the offer here. A row with two would need the menu,
		// and no row on this ladder has two.
		const { containerEl } = makeView(bothFamilies());
		catalog(containerEl);
		const addOn = (title: string) =>
			rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-add')?.getAttribute('aria-label');
		expect(addOn('Suite')).toBe('New Test case');
		expect(addOn('Case')).toBe('New Task');
	});

	it('offers Set type per row — the two rows a projection-wide list gets wrong in opposite directions', () => {
		const { containerEl } = makeView(bothFamilies());
		const setTypeOn = (title: string) => {
			rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			const entry = Menu.lastShown?.item('Set type');
			return entry?.submenu?.items.map((i) => i.titleText) ?? [];
		};
		clickExpandAll(containerEl);
		// A `PBI` drawn in the plan as a promoted root: `Task` is a plan type BY NAME, so a
		// projection-wide list offers it — and retyping makes the row inherit its test
		// parent's membership and vanish into the catalog. Withheld.
		// Asserted as the WHOLE list rather than one name each way, because that is what the
		// manual's sentence about this claims (`view/manual/typesSection.ts`) and `toContain`
		// says nothing about the other ten: an entry reading "Epic, Feature and PBI are not
		// offered in the catalog" passed a `not.toContain('Epic')` while being short by five,
		// and positively implied a `Bug` was assignable there. A type declared without a look
		// at that entry now fails here.
		const plan = ['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug', 'Idea', 'Deliverable', 'Milestone', 'Resource'];
		expect(setTypeOn('Stray PBI')).toEqual(plan.filter((t) => t !== 'Task'));
		expect(setTypeOn('A PBI')).toEqual(plan);
		catalog(containerEl);
		// The mirror: `Task` is not a test type, so a catalog-wide list of test types would
		// withhold it — and retyping that row leaves it in the catalog, under the same
		// suite. Offered. A criterion proving only the withholding is satisfied by a rule
		// that withholds too much. Withheld on the SUITE, whose parent is the top level and
		// therefore the plan's ladder — which is why the manual says "on a row that hangs
		// from a test" rather than "in the catalog".
		expect(setTypeOn('Case')).toEqual(['Task', 'Test suite', 'Test case']);
		expect(setTypeOn('Suite')).toEqual(['Test suite', 'Test case']);
	});

	it('offers no test type on the requirements board either, and still no Deliverable', () => {
		// The board is a PLAN projection, so it withholds the test types for the reason
		// every plan projection does — and it withholds `Deliverable` for its own. Both, not
		// either: the board's exclusion used to short-circuit the membership rule, so a
		// board could create a note that vanished into the catalog on the pass that made
		// it, offer a Set type that moved a card off the screen it was acted on, and focus
		// a type that emptied it.
		const { containerEl } = makeView(bothFamilies(), { stateProperty: 'note.status' });
		projectionButton(containerEl, 'Show as kanban boards').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const offered = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(offered).toContain('New Epic');
		expect(offered).not.toContain('New Test suite');
		expect(offered).not.toContain('New Test case');
		expect(offered).not.toContain('New Deliverable');
	});

	it('offers no test type to the plan’s focus picker, and no menu at all here', () => {
		const { containerEl } = makeView(bothFamilies());
		containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).not.toContain('Test suite');
		catalog(containerEl);
		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(btn?.disabled).toBe(true);
		expect(btn?.textContent).toContain('Tests');
	});
});

describe('the catalog is tree-shaped, and the plan keeps its place', () => {
	it('carries the move section, which a projection added beside the tree loses silently', () => {
		// Two cases under one suite, because every entry in that section is defined by the
		// row's visible NEIGHBOURS — a lone child has none, so a fixture without a sibling
		// would pass an assertion about the section by proving nothing about it.
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('First.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
		vault.addFile('Second.md', { frontmatter: { type: 'Test case', order: 20 }, parentLink: 'Suite' });
		const { containerEl } = makeView(vault);
		catalog(containerEl);
		rowByTitle(containerEl, 'Second').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Move up');
		expect(titles).toContain('Move to top');
		expect(titles).toContain('Outdent');
	});

	it('keeps Expand and Collapse all live, and lets neither touch the other projection', () => {
		const { containerEl, view } = makeView(bothFamilies());
		clickExpandAll(containerEl);
		const planBefore = titlesOf(containerEl);
		catalog(containerEl);
		const collapseAll = containerEl.querySelector<HTMLButtonElement>('[aria-label="Collapse all"]');
		expect(collapseAll?.disabled).toBe(false);
		collapseAll?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Stray case', 'Suite']);
		// The collapse bits are shared by path, so a bulk button that overreached would
		// show its damage only on the way back.
		projectionButton(containerEl, 'Show as backlog tree').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(planBefore);
		expect(view.projection).toBe('tree');
	});

	it('is built from the unfocused tree, with a stored plan focus left intact', () => {
		const { containerEl, view } = makeView(bothFamilies());
		view.setFocusLevel('PBI');
		expect(titlesOf(containerEl)).toEqual(['A PBI', 'Stray PBI']);
		catalog(containerEl);
		// Every suite still drawn, the count complete, and the focus still there for the
		// projection that uses it. Asserted with the focus STORED rather than cleared — a
		// fixture that clears it first tests nothing, since the defect is precisely what a
		// surviving focus does to a projection claiming to ignore it.
		expect(titlesOf(containerEl)).toEqual(['Stray case', 'Suite', 'Case', 'Test task']);
		projectionButton(containerEl, 'Show as backlog tree').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.settings.focusLevel).toBe('PBI');
	});

	it('never lets a focus level promote a catalog Task into the plan', () => {
		// A catalog `Task` is rung 2 of ITS ladder, which is `PBI`'s index on the plan's —
		// so a focus matching by index alone would promote it into a projection that
		// excludes it. Focus is the plan's control, and it skips catalog members.
		const { containerEl, view } = makeView(bothFamilies());
		view.setFocusLevel('PBI');
		expect(titlesOf(containerEl)).not.toContain('Test task');
	});
});

describe('ranking across two projections that share the null parent', () => {
	it('gives a new catalog root a number no plan root holds', () => {
		// A `Test suite` and an `Epic` share the null sibling group, so ranking a suite
		// against the catalog's roots alone takes a number a hidden plan root may already
		// hold — the single ranking limitation the register forbids itself from
		// demonstrating.
		const vault = new FakeVault();
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 10 } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl, view } = makeView(vault);
		catalog(containerEl);
		const model = view.model;
		const orders = (model?.realRoots ?? []).map((r) => r.order);
		expect(orders).toEqual([10, 20]);
		// The new root appends past the whole LOADED group, not past the catalog's slice —
		// a maximum over a superset clears the last visible root as well, so it still lands
		// last in the catalog.
		const next = Math.max(...orders.map((o) => o ?? 0));
		expect(next).toBe(20);
	});

	it('keeps a promoted root out of every ranking question asked of it', () => {
		const { containerEl } = makeView(bothFamilies());
		catalog(containerEl);
		// `Stray case` is a promoted root: its real siblings and parent are not on screen,
		// so it can be neither ordered nor reparented against the ones that are.
		rowByTitle(containerEl, 'Stray case').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move up');
		expect(titles).not.toContain('Outdent');
	});
});

describe('a vault with no tests', () => {
	it('renders every projection exactly as it did', () => {
		// The criterion worth asserting first, because it is what almost every vault will
		// experience: every exclusion is a no-op and nothing moves.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		const { containerEl, view } = makeView(vault, { showCounts: true });
		clickExpandAll(containerEl);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('2 items');
		refresh(view, vault);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);
	});
});
