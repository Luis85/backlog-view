// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, rowByTitle, useViewHarness } from '../helpers/view';
import * as menu from '../../src/view/interactions/menu';

useViewHarness();

function oneItem(state: string): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, status: state } });
	return vault;
}

describe('row controls after a data update', () => {
	it('opens the state menu for the item the model holds now, not the one captured at render', () => {
		const { view, containerEl } = makeView(oneItem('Open'), { stateProperty: 'note.status' }, { order: ['note.status'] });
		view.onDataUpdated();
		const before = view.model?.byPath.get('Alpha.md');

		// An UNCHANGED update, deliberately. `buildModel` runs every pass, so the model's
		// object for this path is new while the row's signature is identical — and that is
		// the only shape that exercises a KEPT row once Task 5 lands. Changing the
		// frontmatter would change the signature, rebuild the row, and install a fresh
		// closure, which proves nothing about delegation either before or after.
		//
		// This test PASSES TODAY for a reason that has nothing to do with delegation: every
		// data update still rebuilds every row from scratch, so even a closure captured at
		// render time would be fresh by the time this click fires — there is no rebuild
		// between the second `onDataUpdated()` and the click for a stale closure to survive.
		// It becomes load-bearing only once Task 5 lands row reuse, at which point a captured
		// item WOULD go stale here and this assertion is what catches it. Do not "fix" this
		// test into failing before then, and do not read a pass here as proof delegation
		// works — the delegation was verified by review, not by this test, which cannot
		// distinguish the two shapes until a row can survive an update unrebuilt.
		view.onDataUpdated();

		const spy = vi.spyOn(menu, 'showStateMenu').mockImplementation(() => {});
		rowByTitle(containerEl, 'Alpha').querySelector<HTMLElement>('.pbl-state-chip')?.click();

		expect(spy).toHaveBeenCalledTimes(1);
		const passed = spy.mock.calls[0][2];
		expect(passed).toBe(view.model?.byPath.get('Alpha.md'));
		// The point of the test: NOT the object the first render closed over.
		expect(passed).not.toBe(before);
	});

	it("opens no menu when a context row's static chip is clicked", () => {
		// An outsideFilter row's chips are the same CLASSES on a div — the delegated
		// selector must not reach them. A menu here would offer a write the gate then
		// refuses: a control that says it can do what it cannot.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, status: 'Open' } });
		vault.addFile('Kid.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
		// A base returning only the child pulls the parent in as a context row.
		const { view, containerEl } = makeView(vault, { stateProperty: 'note.status' }, { only: ['Kid.md'], order: ['note.status'] });
		view.onDataUpdated();

		const spy = vi.spyOn(menu, 'showStateMenu').mockImplementation(() => {});
		rowByTitle(containerEl, 'Parent').querySelector<HTMLElement>('.pbl-state-chip')?.click();

		expect(spy).not.toHaveBeenCalled();
	});
});
