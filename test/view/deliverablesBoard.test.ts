// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardVault, cardByTitle, cardTitles, columnByName, columnNames, expandColumns } from '../helpers/board';
import { flush, makeView, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { cardDrag } from '../helpers/dnd';

useViewHarness();

describe('the Deliverables board', () => {
	it('shows guidance instead of the Deliverables board when no Deliverable state property is configured', () => {
		const vault = boardVault();
		const harness = makeView(vault, {});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('Deliverable state property');
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
	});

	it('shows "no Deliverables yet" when the workflow is configured but nothing is typed Deliverable', () => {
		const vault = boardVault(); // Epics and Features only, no Deliverable
		const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const title = containerEl.querySelector('.pbl-empty-title')?.textContent ?? '';
		expect(title).toContain('deliverable');
	});

	it('shows a Deliverable outside the focused subtree, since the focus level never narrows this board', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		// A top-level Deliverable, outside any Feature subtree — the human's own request
		// is that a focus level set on another projection must never make it invisible
		// here; `model.deliverableResults` is read off the whole, unfocused tree for
		// exactly this reason (`domain/model.ts`).
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' }, { focus: 'Feature' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		expect(containerEl.querySelector('.pbl-empty-title')).toBeNull();
		expect(cardTitles(containerEl)).toContain('D');
	});

	it('shows the same "No deliverables yet" guidance whatever the inherited focus level', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// No Deliverable anywhere in the base — the guidance no longer varies by focus,
		// so a level that used to admit every Deliverable (PBI) and one that used to
		// narrow the board (Feature) must read identically.
		const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' }, { focus: 'PBI' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const title = containerEl.querySelector('.pbl-empty-title')?.textContent ?? '';
		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(title).toContain('deliverable');
		expect(hint).toMatch(/create one/i);

		harness.view.setFocusLevel('Feature');
		const hintAfter = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hintAfter).toBe(hint);
	});

	it('draws the Deliverables board, scoped to Deliverable-typed results, once configured', () => {
		const vault = boardVault(); // Epics and Features, none typed Deliverable
		vault.addFile('D1.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		const harness = makeView(vault, {
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Review, Published',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		expect(columnNames(containerEl)).toEqual(['No state', 'Draft', 'Review', 'Published']);
		expect(cardTitles(columnByName(containerEl, 'Draft'))).toEqual(['D1']);
		// Epics and Features never become cards on this board.
		expect(cardTitles(columnByName(containerEl, 'No state'))).toEqual([]);
	});

	it('renders a card done in its own workflow as done, regardless of the requirements state', () => {
		const vault = boardVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		// Done on the REQUIREMENTS board, not on this one.
		expect(cardByTitle(containerEl, 'D').classList.contains('pbl-done')).toBe(false);
	});

	it('renders a card done in ITS OWN workflow as done, even when the requirements state is not', () => {
		// Found by review: the negative test above alone cannot rule out an
		// implementation that never wires deliverableDone into createCard at all, or
		// hardcodes false — this is the case that requires the positive branch to work.
		const vault = boardVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Open', deliverableStatus: 'Published' },
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableDoneValues: 'Published',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;
		// `Published` is a done value holding nothing but finished work, so this board's
		// own fold default shuts that column — the reader would open it, and so does this.
		expandColumns(containerEl);

		expect(cardByTitle(containerEl, 'D').classList.contains('pbl-done')).toBe(true);
	});

	it('styles a TREE row by the item’s own workflow too, both directions', () => {
		// The board card, the card's child list and the timeline bar all take an item's
		// own workflow; the tree row was the one surface still asking `item.done`, so a
		// Deliverable finished in its own workflow read as unfinished in the tree and one
		// carrying a stale requirements `Done` read as finished. Found by review on the
		// card list, fixed at every surface rather than the reported one.
		const vault = boardVault();
		vault.addFile('Shipped.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Open', deliverableStatus: 'Published' },
		});
		vault.addFile('Open.md', {
			frontmatter: { type: 'Deliverable', order: 20, status: 'Done', deliverableStatus: 'Draft' },
		});
		const { containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableDoneValues: 'Published',
		});

		const rowFor = (path: string) => {
			const el = containerEl.querySelector<HTMLElement>(`.pbl-row[data-path="${path}"]`);
			if (!el) throw new Error(`no tree row for ${path}`);
			return el;
		};
		expect(rowFor('Shipped.md').classList.contains('pbl-done')).toBe(true);
		expect(rowFor('Open.md').classList.contains('pbl-done')).toBe(false);
	});

	it('ignores "Show completed items": a Deliverable done in the requirements workflow still renders here', () => {
		// The requirements board would hide a fully-done, childless item under this
		// setting (`isRowHidden`); the Deliverables board reads `isRowHiddenByFilterOnly`
		// instead, which has no completion concept at all (Scope) — proving this needs a
		// note done in the REQUIREMENTS sense, not the Deliverable one, or a board that
		// wrongly wired in `isRowHidden` would still pass.
		const vault = boardVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
			showCompleted: false,
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		expect(cardTitles(containerEl)).toContain('D');
	});

	it('lists a requirements-done child on a Deliverable card whatever the completed toggle says', () => {
		// Found by review. The CARDS use the filter-only rule, but the disclosure they draw
		// went through `listedChildren` -> `isRowHidden`, which honours the completed-items
		// toggle. So a setting flipped on another projection quietly emptied a Deliverable's
		// child list here — and this board has no toggle of its own to put it back.
		const vault = boardVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'New', deliverableStatus: 'Draft' },
		});
		vault.addFile('T.md', {
			frontmatter: { type: 'Task', order: 10, status: 'Done' },
			parentLink: 'D',
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
			showCompleted: false,
		});
		harness.view.setProjection('deliverables');
		const { containerEl, view } = harness;

		// A card's disclosure is its own bit now, independent of the tree's — `makeView`'s
		// default tree-wide expand no longer opens it, so open it directly.
		view.setCardCollapsed('D.md', false);
		harness.view.render();
		const card = cardByTitle(containerEl, 'D');
		expect(
			Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map((el) => el.textContent),
		).toEqual(['T']);
	});

	it('shows "no deliverables yet" rather than "all done and hidden" for a base with none', () => {
		const vault = boardVault(); // Epics and Features only
		const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const title = containerEl.querySelector('.pbl-empty-title')?.textContent ?? '';
		expect(title).not.toContain('done');
		expect(title).toContain('deliverable');
	});

	it('shows the Deliverables board, not guidance, when only the shared (requirements) key is configured', () => {
		// Deliverables don't need their own dedicated status property — the guidance
		// state must only appear when NEITHER workflow has a state property.
		const vault = boardVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'New' } });
		const harness = makeView(vault, { stateProperty: 'note.status', stateValues: 'New, Active, Done' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		expect(containerEl.querySelector('.pbl-empty-hint')).toBeNull();
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		expect(cardTitles(containerEl)).toContain('D');
	});

	it('moving a card on the Deliverables board under the fallback writes the shared key end to end', async () => {
		const vault = boardVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'New' } });
		const harness = makeView(vault, { stateProperty: 'note.status', stateValues: 'New, Active, Done' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		cardDrag(cardByTitle(containerEl, 'D'), columnByName(containerEl, 'Done'));
		await flush();

		expect(vault.fm('D.md')['status']).toBe('Done');
	});

	it('names the DELIVERABLE workflow-states option in a stray column’s hint, not the requirements one', () => {
		const vault = boardVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Blocked' },
		});
		const harness = makeView(vault, {
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Review',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const stray = columnByName(containerEl, 'Blocked');
		expect(stray.dataset.tooltip).toContain('Deliverable workflow states (in order)');
		expect(stray.dataset.tooltip).not.toContain('"Workflow states (in order)"');
	});
});
