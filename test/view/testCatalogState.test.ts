// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, flush, makeView, projectionButton, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Split out of `testCatalog.test.ts` (the `test/**` line budget) rather than staying
 * a describe block there: the test workflow's WRITE path is its own subject, one this
 * task closes — the catalog's chip and Set-state gate already read the test workflow
 * (Task 3); this is what proves the pick lands in the test key rather than the plan's.
 */
function bothFamilies(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
	vault.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
	vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Suite' });
	vault.addFile('Test task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Case' });
	return vault;
}

/** Switch to the catalog through the real toolbar and open everything it drew. */
function catalog(containerEl: HTMLElement): void {
	projectionButton(containerEl, 'Show as test catalog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
	clickExpandAll(containerEl);
}

describe('the test workflow writes through its own key', () => {
	it('writes a catalog row’s state to the TEST key and leaves the plan’s alone', async () => {
		const vault = bothFamilies();
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			testStateProperty: 'note.testStatus',
			testStateValues: 'Draft, Ready, Approved',
		});
		catalog(containerEl);
		rowByTitle(containerEl, 'Case').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Ready')?.clickHandler?.();
		await flush();
		expect(vault.fm('Case.md')['testStatus']).toBe('Ready');
		expect(vault.fm('Case.md')['status']).toBeUndefined();
	});

	it('draws a catalog row’s chip from the test workflow, and marks it done by ITS done values', () => {
		const vault = bothFamilies();
		vault.addFile('Signed off.md', {
			frontmatter: { type: 'Test case', order: 40, status: 'New', testStatus: 'Approved' },
			parentLink: 'Suite',
		});
		const { containerEl } = makeView(
			vault,
			{ stateProperty: 'note.status', testStateProperty: 'note.testStatus', testDoneValues: 'Approved' },
			{ order: ['note.testStatus'] },
		);
		catalog(containerEl);
		const row = rowByTitle(containerEl, 'Signed off');
		expect(row.querySelector('.pbl-state-chip')?.textContent).toBe('Approved');
		// Done by the TEST workflow's own list, while its `status: New` says otherwise.
		expect(row.hasClass('pbl-done')).toBe(true);
		// And still nothing HIDES: the catalog withholds the completed toggle and opts out
		// of the computation behind it, which having a workflow does not change.
		expect(titlesOf(containerEl)).toContain('Signed off');
	});
});

/**
 * The other direction of the same write path, and the one the workflow shipped without:
 * `computeTestStateWrites(item, null)` plans a removal and nothing offered it, because the
 * no-state COLUMN is what offers that everywhere else and the catalog draws no board.
 *
 * Both surfaces are driven for every claim — the row menu's `Set state` submenu and the
 * state chip — since `addStateItems` is the one builder behind them and a fix reaching only
 * one is the defect this repository keeps a rule about.
 */
describe('a catalog row can take its test state back off', () => {
	/** A case carrying a test state, a plan state and a finished date, on distinct keys. */
	function drafted(): FakeVault {
		const vault = bothFamilies();
		vault.addFile('Drafted.md', {
			frontmatter: { type: 'Test case', order: 30, status: 'New', testStatus: 'Draft', finished: '2026-01-01' },
			parentLink: 'Suite',
		});
		return vault;
	}

	const workflow = {
		stateProperty: 'note.status',
		stateValues: 'New, Active, Done',
		testStateProperty: 'note.testStatus',
		testStateValues: 'Draft, Ready, Approved',
		finishedDateProperty: 'note.finished',
	};

	/** The `Set state` submenu's entry titles for a row, from the row menu. */
	function setStateTitles(containerEl: HTMLElement, title: string): string[] {
		rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set state')?.submenu;
		if (!submenu) throw new Error(`no Set state submenu on ${title}`);
		return submenu.items.map((i) => i.titleText);
	}

	/** The same list from the row's state chip, which opens the same builder. */
	function chipTitles(containerEl: HTMLElement, title: string): string[] {
		const chip = rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-state-chip');
		if (!chip) throw new Error(`no state chip on ${title}`);
		chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error(`no chip menu on ${title}`);
		return menu.items.map((i) => i.titleText);
	}

	it('offers the removal on both surfaces', () => {
		const { containerEl } = makeView(drafted(), workflow, { order: ['note.testStatus'] });
		catalog(containerEl);
		expect(setStateTitles(containerEl, 'Drafted')).toContain('Clear test state');
		expect(chipTitles(containerEl, 'Drafted')).toContain('Clear test state');
	});

	it('deletes the key rather than blanking it, and stamps no date doing it', async () => {
		const vault = drafted();
		const { containerEl } = makeView(vault, workflow, { order: ['note.testStatus'] });
		catalog(containerEl);
		rowByTitle(containerEl, 'Drafted').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Clear test state')?.click();
		await flush();

		expect('testStatus' in vault.fm('Drafted.md')).toBe(false);
		// Through `computeTestStateWrites`, so the requirements workflow's key and its date
		// stamps are untouched: routed through `computeStateWrites` instead, the same click
		// would take `status` off and clear the finished date with it.
		expect(vault.fm('Drafted.md')['status']).toBe('New');
		expect(vault.fm('Drafted.md')['finished']).toBe('2026-01-01');
	});

	it('withholds the removal from a catalog row carrying no test state', () => {
		// `Case` carries neither key, so a removal here would write nothing — the rule every
		// other Clear in this menu keeps, asked of the same planner the pick would run.
		const { containerEl } = makeView(drafted(), workflow, { order: ['note.testStatus'] });
		catalog(containerEl);
		expect(setStateTitles(containerEl, 'Case')).not.toContain('Clear test state');
		expect(chipTitles(containerEl, 'Case')).not.toContain('Clear test state');
	});

	it('leaves the plan’s and the Deliverable’s Set state exactly as they were', () => {
		const vault = drafted();
		vault.addFile('Ship it.md', { frontmatter: { type: 'Deliverable', order: 40, status: 'Active' } });
		const { containerEl } = makeView(vault, workflow, { order: ['note.status'] });
		clickExpandAll(containerEl);

		// The gap is the catalog's alone: the other two workflows reach their no-state target
		// through a board column, so an entry added to them would be a second way to say it.
		for (const title of ['A PBI', 'Ship it']) {
			expect(setStateTitles(containerEl, title)).toEqual(['New', 'Active', 'Done']);
			expect(chipTitles(containerEl, title)).toEqual(['New', 'Active', 'Done']);
		}
	});
});

/**
 * Grouped here rather than in `testCatalog.test.ts` (already at the `test/**` line
 * budget) and not as its own file: this fixture and the `catalog()` helper above are
 * exactly what it needs, and it is a fact about the same state-key-configured catalog
 * the block above writes through — a state property drawing a chip on catalog rows but
 * withholding the rollup those same rows have none of.
 */
describe('the catalog draws no rollup column', () => {
	it('draws no rollup column, because it has no rollups to put in one', () => {
		// The catalog's rows carry no descendant counts by design (`Tests stay out of the
		// plan` 3c), so a Progress header over an empty column on every row is the control
		// outliving the computation behind it — and it costs every test title the width.
		const { containerEl } = makeView(bothFamilies(), { showCounts: true, stateProperty: 'note.status' });
		clickExpandAll(containerEl);
		// The plan draws it, which is what makes the assertion below about the CATALOG
		// rather than about the fixture.
		expect(containerEl.querySelector('.pbl-meta-col')).not.toBeNull();

		catalog(containerEl);
		expect(containerEl.querySelector('.pbl-meta-col')).toBeNull();
		expect(containerEl.querySelector('.pbl-cols')?.textContent ?? '').not.toContain('Progress');
	});
});
