// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from 'obsidian';
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
