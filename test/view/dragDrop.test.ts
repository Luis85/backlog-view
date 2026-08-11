// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import {
	drag,
	fixture,
	flush,
	key,
	makeView,
	refresh,
	rowByTitle,
	stubRect,
	titlesOf,
	treeOf,
	useViewHarness,
} from '../helpers/view';

useViewHarness();

interface FakeTransfer {
	data: Record<string, string>;
	setData(type: string, value: string): void;
	effectAllowed: string;
	dropEffect: string;
}

/**
 * jsdom's drag events carry no `dataTransfer`, which is why every branch that guards
 * for one went unexercised. This supplies the object the browser would.
 */
function transferEvent(type: string, init: MouseEventInit = {}): { evt: MouseEvent; transfer: FakeTransfer } {
	const data: Record<string, string> = {};
	const transfer: FakeTransfer = {
		data,
		setData: (key, value) => {
			data[key] = value;
		},
		effectAllowed: '',
		dropEffect: '',
	};
	const evt = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
	Object.defineProperty(evt, 'dataTransfer', { value: transfer });
	return { evt, transfer };
}

describe('drag and drop', () => {
	it('re-ranks when dropping before a sibling', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Epic A'), 'before');
		await flush();

		expect(vault.fm('Epic B.md')['order']).toBe(0);
		expect(vault.fm('Epic B.md')['parent']).toBeUndefined();
	});

	it('re-parents without re-typing when dropping into a row', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Feature B2'), 'inside');
		await flush();

		const fm = vault.fm('Epic A.md');
		expect(fm['parent']).toBe('[[Feature B2]]');
		expect(fm['order']).toBe(10);
		// An Epic two rungs below where the ladder would put it, and left as one: the drop
		// writes the parent and the rank, and a type is the note's own statement.
		expect(fm['type']).toBe('Epic');
	});

	it('refuses to drop an ancestor into its own subtree', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Feature B1'), 'inside');
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('marks the moved row pending until the data refreshes', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Epic A'), 'before');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-pending')).toBe(true);

		await flush();
		view.onDataUpdated(); // the Bases refresh re-renders the tree
		expect(containerEl.querySelector('.pbl-pending')).toBeNull();
	});

	it('clears the pending mark when the write is rejected', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(containerEl.querySelector('.pbl-pending')).toBeNull();
		expect(vault.writeLog).toHaveLength(0);
	});

	it('shows the drop indicator on the hovered row', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));

		expect(to.classList.contains('pbl-drop-before')).toBe(true);
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(true);
	});

	it('clears a stale parent link when the last orphaned root is dropped on the tree background', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { type: 'Epic', order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		expect(vault.fm('Orphan.md')['parent']).toBe('[[Missing]]');
		const tree = treeOf(containerEl);

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		expect('parent' in vault.fm('Orphan.md')).toBe(false);
	});
});

describe('drag state details', () => {
	it('expands a collapsed row after hovering over it during a drag', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		const to = rowByTitle(containerEl, 'Epic B');
		stubRect(to);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		// The pending expansion is signaled on the row while the timer runs
		expect(to.classList.contains('pbl-hover-expanding')).toBe(true);
		vi.advanceTimersByTime(700);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('drops the hover-expand cue when the drag moves off the row', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const to = rowByTitle(containerEl, 'Epic B');
		stubRect(to);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		expect(to.classList.contains('pbl-hover-expanding')).toBe(true);

		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
		expect(to.classList.contains('pbl-hover-expanding')).toBe(false);
		vi.advanceTimersByTime(700);
		// The cancelled timer must not expand the row anyway
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('clears the indicator when the drag leaves the row', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		expect(to.classList.contains('pbl-drop-before')).toBe(true);

		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
		expect(to.classList.contains('pbl-drop-before')).toBe(false);
	});

	it('drops on the tree background to move an item to the top level', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		const fm = vault.fm('Feature B1.md');
		expect('parent' in fm).toBe(false);
		expect(fm['order']).toBe(30);
	});

	it('clears all drag state on dragend', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const row = rowByTitle(containerEl, 'Epic A');
		row.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(true);
		expect(row.classList.contains('pbl-drag-source')).toBe(true);

		row.dispatchEvent(new MouseEvent('dragend', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(false);
		expect(row.classList.contains('pbl-drag-source')).toBe(false);
	});

	// A sibling collapse mid-drag rebuilds the dragged row's group via refreshRowChildren,
	// which detaches it WITHOUT a full render (no onRenderStart) — the source element is
	// gone from the tree, but the drag session still targets it directly. `document`'s
	// dragend listener is the one that fires here (the detached row has no path to bubble
	// through), so this is also the "never touched a row" cleanup path.
	it('still clears the drag-source class after the row is detached mid-drag by a sibling refresh', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const source = rowByTitle(containerEl, 'Feature B1');
		source.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		expect(source.classList.contains('pbl-drag-source')).toBe(true);

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.contains(source)).toBe(false);

		document.dispatchEvent(new MouseEvent('dragend'));
		expect(source.classList.contains('pbl-drag-source')).toBe(false);
	});
});

describe('what the browser is told about the drag', () => {
	it('puts the dragged note on the drag session and asks for a move', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const to = rowByTitle(containerEl, 'Feature B2');
		stubRect(to);

		const start = transferEvent('dragstart');
		rowByTitle(containerEl, 'Epic A').dispatchEvent(start.evt);
		expect(start.transfer.data['text/plain']).toBe('Epic A.md');
		expect(start.transfer.effectAllowed).toBe('move');

		const over = transferEvent('dragover', { clientY: 15 });
		to.dispatchEvent(over.evt);
		expect(over.transfer.dropEffect).toBe('move');
	});

	it('asks for a move over the tree background too', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));

		const overTree = transferEvent('dragover');
		treeOf(containerEl).dispatchEvent(overTree.evt);
		expect(overTree.transfer.dropEffect).toBe('move');
	});
});

describe('the drop indicator follows the pointer', () => {
	it('offers nothing over the row being dragged', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const row = rowByTitle(containerEl, 'Epic B');
		stubRect(row);

		row.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		row.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		expect(row.className).not.toMatch(/pbl-drop-/);

		row.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 3 }));
		await flush();
		expect(vault.writeLog).toHaveLength(0);
	});

	it('leaves no indicator behind on the row the pointer just left', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const first = rowByTitle(containerEl, 'Epic B');
		const second = rowByTitle(containerEl, 'Feature B1');
		stubRect(first);
		stubRect(second);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		first.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 28 }));
		expect(first.classList.contains('pbl-drop-after')).toBe(true);

		second.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		expect(first.className).not.toMatch(/pbl-drop-/);
		expect(second.classList.contains('pbl-drop-before')).toBe(true);
	});

	it('survives the pointer crossing into the row own children', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));

		// dragleave fires for every element boundary inside the row, not just its edge.
		const inner = to.querySelector('.pbl-title');
		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true, relatedTarget: inner }));
		expect(to.classList.contains('pbl-drop-before')).toBe(true);
	});

	it('drops into a row the browser has not measured', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		// No stubbed rect: jsdom reports a zero-height row, and the zone falls back to
		// the middle rather than dividing by zero.
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		const to = rowByTitle(containerEl, 'Epic B');
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 0 }));
		to.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 0 }));
		await flush();

		expect(vault.fm('Epic A.md')['parent']).toBe('[[Epic B]]');
	});
});

describe('hover to expand', () => {
	function collapsedParent(): { containerEl: HTMLElement; target: HTMLElement } {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const target = rowByTitle(containerEl, 'Epic B');
		stubRect(target);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		return { containerEl, target };
	}

	it('keeps one timer running while the pointer stays on the row', () => {
		vi.useFakeTimers();
		const { containerEl, target } = collapsedParent();

		target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		vi.advanceTimersByTime(400);
		// A second dragover on the same row must not restart the wait, or a stationary
		// pointer over a row would never reach 600 ms.
		target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		vi.advanceTimersByTime(300);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('gives up the wait when the pointer moves to the edge of the same row', () => {
		vi.useFakeTimers();
		const { containerEl, target } = collapsedParent();

		target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		expect(target.classList.contains('pbl-hover-expanding')).toBe(true);

		// Still the same row, but now aimed past it rather than into it.
		target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 28 }));
		expect(target.classList.contains('pbl-hover-expanding')).toBe(false);
		vi.advanceTimersByTime(700);
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});
});

describe('the tree background', () => {
	it('ignores a drop that lands on a row group rather than the background', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const group = containerEl.querySelector<HTMLElement>('.pbl-children');
		if (!group) throw new Error('child group missing');

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		group.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		group.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(vault.fm('Feature B1.md')['parent']).toBe('[[Epic B]]');
	});

	it('ignores a drag that did not start in the tree', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		// A file dragged in from outside Obsidian reaches the same listeners with no
		// drag of ours in flight.
		const overTree = transferEvent('dragover');
		treeOf(containerEl).dispatchEvent(overTree.evt);
		expect(overTree.evt.defaultPrevented).toBe(false);

		treeOf(containerEl).dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		const row = rowByTitle(containerEl, 'Epic A');
		stubRect(row);
		row.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		await flush();

		expect(row.className).not.toMatch(/pbl-drop-/);
		expect(vault.writeLog).toHaveLength(0);
	});

	it('offers no top-level drop for an item already last at the top level', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));

		const over = transferEvent('dragover');
		treeOf(containerEl).dispatchEvent(over.evt);

		// Not accepting the drag is what tells the browser this is a no-op.
		expect(over.evt.defaultPrevented).toBe(false);
		expect(over.transfer.dropEffect).toBe('');
	});
});

describe('a drag whose note leaves the model', () => {
	it('forgets the drag rather than acting on a path that is gone', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);
		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));

		// The note is deleted elsewhere in the vault while the pointer is still down.
		vault.files.delete('Feature B1.md');
		refresh(view, vault);

		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		expect(to.className).not.toMatch(/pbl-drop-/);

		to.dispatchEvent(new MouseEvent('drop', { bubbles: true, clientY: 3 }));
		await flush();
		expect(vault.writeLog).toHaveLength(0);
	});
});
