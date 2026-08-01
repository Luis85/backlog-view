// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Modal, Notice } from '../helpers/obsidian-mock';
import { drag, expandAll, flush, key, rowByTitle, rows, submitPrompt, treeOf, useViewHarness } from '../helpers/view';
import { boardDrag } from '../helpers/dnd';

/**
 * Clear every configured folder, so folder INFERENCE is what runs. Both layers have to
 * go: a type's own folder answers first, and the home folder answers next.
 */
const NO_TYPE_FOLDERS: Record<string, string> = {
	homeFolder: '',
	...Object.fromEntries(['epic', 'feature', 'pbi', 'task', 'issue', 'bug'].map((t) => [`typeFolder.${t}`, ''])),
};

useViewHarness();

describe('moves in a group that holds an outside-filter row', () => {
	/** Epic E over Feature A (context, because its PBI matched) and Feature B (a result). */
	function mixedView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Inference is what this test is about, so the type folders that would answer
		// first are turned off.
		anyView.config = new FakeViewConfig({ ...NO_TYPE_FOLDERS });
		anyView.data = {
			data: vault.entries().filter((e) => ['Feature B.md', 'PBI.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('offers no move commands on a result whose siblings include a context row', () => {
		const { containerEl } = mixedView();

		rowByTitle(containerEl, 'Feature B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move up');
		expect(titles).not.toContain('Move down');
		expect(titles).not.toContain('Move to top');
	});

	it('offers no outdent when it would rank against a context parent', () => {
		const { containerEl } = mixedView();

		rowByTitle(containerEl, 'PBI').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		// Its parent Feature A is context, so outdenting would renumber that group
		expect(titles).not.toContain('Outdent');
	});

	it('writes nothing when Alt+arrow targets such a group', async () => {
		const { view, containerEl, vault } = mixedView();
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Feature B.md') as never);

		key(tree, 'ArrowUp', { altKey: true });
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});

describe('new-item folder inference with context rows', () => {
	it('ignores ancestors that live outside the filtered folder', () => {
		const vault = new FakeVault();
		// A deep chain of ancestors elsewhere would outvote the two real results
		vault.addFile('Elsewhere/Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Elsewhere/Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('Elsewhere/Sub.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });
		vault.addFile('Backlog/A.md', { frontmatter: { type: 'Task' }, parentLink: 'Sub' });
		vault.addFile('Backlog/B.md', { frontmatter: { type: 'Task' }, parentLink: 'Sub' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Inference is what this test is about, so the type folders that would answer
		// first are turned off.
		anyView.config = new FakeViewConfig({ ...NO_TYPE_FOLDERS });
		anyView.data = {
			data: vault.entries().filter((e) => e.file.path.startsWith('Backlog/')),
		};
		view.onDataUpdated();

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Three context ancestors in Elsewhere/ must not outvote two results in Backlog/
		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog"');
		expect(detail).not.toContain('Elsewhere');
	});
});

describe('creating a child under a context parent', () => {
	/** Folder mode, a base scoped to Backlog/, and a parent living outside it. */
	function outsideParentView() {
		const vault = new FakeVault();
		vault.addFile('Projects/Epic/Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Backlog/PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		anyView.config = new FakeViewConfig({ inferFolderHierarchy: true, ...NO_TYPE_FOLDERS });
		anyView.data = { data: vault.entries().filter((e) => e.file.path === 'Backlog/PBI.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('keeps the new note in the results folder, not beside the excluded parent', () => {
		const { containerEl } = outsideParentView();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('Under "Epic"');
		expect(detail).toContain('folder "Backlog"');
		expect(detail).not.toContain('Projects');
	});

	it('still writes the parent link, so the hierarchy survives the different folder', async () => {
		const { containerEl, vault } = outsideParentView();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'New work' });
		await flush();

		expect(vault.fm('Backlog/New work.md')['parent']).toBe('[[Epic]]');
	});

	it('still puts children beside a parent that is a real result', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic/Epic.md', { frontmatter: { type: 'Epic' } });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		anyView.config = new FakeViewConfig({ inferFolderHierarchy: true, ...NO_TYPE_FOLDERS });
		anyView.data = { data: vault.entries() };
		view.onDataUpdated();

		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const detail = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail).toContain('folder "Backlog/Epic"');
	});
});

describe('write safety with context rows, across every entry point', () => {
	/**
	 * Context rows in all three structural positions: above a result (Epic), beside
	 * one (Feature A next to Feature B), and between two (Mid, whose parent Feature B
	 * and child Task are both results). Nine review findings were each one surface of
	 * "a context note got written to"; this asserts the rule itself rather than a
	 * surface, so a new write path fails here without anyone having predicted it.
	 */
	const CONTEXT_PATHS = ['Epic.md', 'Feature A.md', 'Mid.md'];

	function stressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active', tags: ['ctx'] } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10, tags: ['ctx'] }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20, tags: ['a'] }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'New' }, parentLink: 'Feature A' });
		// The context row in the middle is done and the result below it is not, so
		// counting either one in a rollup would show up as a wrong number.
		vault.addFile('Mid.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'Done', tags: ['ctx'] },
			parentLink: 'Feature B',
		});
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Mid' });

		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig({ stateProperty: 'note.status' });
		// The tag column is a write surface too — drive it like every other one.
		config.order = ['note.tags'];
		anyView.config = config;
		anyView.data = {
			data: vault.entries().filter((e) => !CONTEXT_PATHS.includes(e.file.path)),
		};
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl, vault };
	}

	/** Fire every menu command on a row, including the ones nested in submenus. */
	async function triggerEveryCommand(row: HTMLElement): Promise<void> {
		row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		for (const item of Menu.lastShown?.items ?? []) {
			item.clickHandler?.();
			await flush();
			for (const sub of item.submenu?.items ?? []) {
				sub.clickHandler?.();
				await flush();
			}
		}
	}

	it('puts context rows in all three structural positions', () => {
		const { view } = stressView();
		const at = (p: string) => view.model?.byPath.get(p);
		expect(at('Epic.md')?.outsideFilter).toBe(true);
		// Beside a result
		expect(at('Feature A.md')?.outsideFilter).toBe(true);
		expect(at('Feature B.md')?.outsideFilter).toBe(false);
		// Between two results
		expect(at('Mid.md')?.outsideFilter).toBe(true);
		expect(at('Mid.md')?.parent?.file.path).toBe('Feature B.md');
		expect(at('Task.md')?.outsideFilter).toBe(false);
	});

	it('never writes to one, whatever is done to any row', async () => {
		const { containerEl, vault } = stressView();
		const allRows = rows(containerEl);
		expect(allRows).toHaveLength(6);

		// Every drag of every row onto every other row, in all three zones
		for (const from of allRows) {
			for (const to of allRows) {
				if (from === to) continue;
				for (const zone of ['before', 'after', 'inside'] as const) {
					drag(from, to, zone);
					await flush();
				}
			}
		}
		// The "move to top level" strip
		for (const from of allRows) {
			from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
			const strip = containerEl.querySelector<HTMLElement>('.pbl-root-drop');
			strip?.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
			strip?.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
			await flush();
		}
		// Every context-menu command, every state chip, every structural shortcut
		const tree = treeOf(containerEl);
		for (const row of allRows) {
			await triggerEveryCommand(row);
			row.querySelector<HTMLElement>('.pbl-state-chip')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			for (const state of Menu.lastShown?.items ?? []) {
				state.clickHandler?.();
				await flush();
			}
			// Every tag control on the row: the add menu and each remove button
			row.querySelector<HTMLElement>('.pbl-tag-add')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			for (const tag of Menu.lastShown?.items ?? []) {
				tag.clickHandler?.();
				await flush();
			}
			for (const remove of row.querySelectorAll<HTMLElement>('.pbl-tag-remove')) {
				remove.dispatchEvent(new MouseEvent('click', { bubbles: true }));
				await flush();
			}
			row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			for (const key_ of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
				key(tree, key_, { altKey: true });
				await flush();
			}
		}
		// And the backfill, which walks the whole real tree
		containerEl
			.querySelectorAll<HTMLElement>('.pbl-icon-btn')[0]
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		// Undo is a write path too: replay whatever the stress installed, repeatedly.
		// Its batches can only name files a forward batch wrote — so never these rows.
		for (let i = 0; i < 3; i++) {
			key(tree, 'z', { ctrlKey: true });
			await flush();
		}
		containerEl.querySelector<HTMLElement>('.pbl-undo-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		const touched = [...new Set(vault.writeLog.map((w) => w.path))];
		expect(touched.filter((p) => CONTEXT_PATHS.includes(p))).toEqual([]);
		// Not vacuous: the result rows really were written to along the way
		expect(touched.length).toBeGreaterThan(0);
	});
});

describe('write safety with context rows, across the board’s entry points', () => {
	/**
	 * The stress fixture projected as a board, focused where its context rows sit on
	 * the focus level — so the context PBI renders as an inert context card among
	 * live cards, and every board gesture can be aimed at it.
	 */
	function boardStressView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20, status: 'New' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 5, status: 'New' }, parentLink: 'Feature B' });
		// Context, between results: its parent and the Task below it are both results.
		vault.addFile('Mid.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Feature B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Mid' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({
			stateProperty: 'note.status',
			stateValues: 'New, Active, Done',
			focusLevel: 'PBI',
		});
		anyView.data = { data: vault.entries().filter((e) => !['Epic.md', 'Mid.md'].includes(e.file.path)) };
		view.onDataUpdated();
		view.setProjection('board');
		return { view, containerEl, vault };
	}

	it('never writes to a context card, whatever is dropped wherever', async () => {
		const { containerEl, vault } = boardStressView();
		const cards = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card'));
		const columns = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-board-col'));
		expect(cards.length).toBeGreaterThan(1);

		// Every card dragged onto every column — the context card is not draggable
		// (never wired), so its gestures fall on the floor rather than into a plan.
		for (const card of cards) {
			for (const column of columns) {
				boardDrag(card, column);
				await flush();
			}
		}
		const touched = [...new Set(vault.writeLog.map((w) => w.path))];
		expect(touched).not.toContain('Mid.md');
		// Not vacuous: the live cards really were written along the way.
		expect(touched).toContain('PBI.md');
	});

	it('refuses the whole batch if a board write ever names a context item', async () => {
		const { view, vault } = boardStressView();
		const mid = view.model?.byPath.get('Mid.md');
		expect(mid?.outsideFilter).toBe(true);

		// No UI produces this — that is the point: the last line of defence is
		// structural, so a future entry point cannot reopen the hole by omission.
		const applied = await view.performBoardDrop(mid as never, 'New');

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});
});

describe('undo across the filter boundary', () => {
	it('still undoes a write that moved its own target out of the filter', async () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Parent' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status' });
		anyView.data = { data: vault.entries() };
		view.onDataUpdated();
		expandAll(containerEl);

		// Mark the parent done through its chip — an ordinary write to a result row.
		rowByTitle(containerEl, 'Parent')
			.querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('Done')?.clickHandler?.();
		await flush();
		expect(vault.fm('Parent.md')['status']).toBe('Done');

		// The base's filter excludes done items, so the requery demotes the parent
		// to a context row above its still-open child.
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Parent.md') };
		view.onDataUpdated();
		expect(view.model?.byPath.get('Parent.md')?.outsideFilter).toBe(true);

		// The replay-time context-row verdict would refuse exactly this restore;
		// authorization is decided at capture time, when the row was a result the
		// user acted on — so the change that demoted it can be taken back.
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		expect(vault.fm('Parent.md')['status']).toBe('Active');
	});
});

describe('toolbar figures describe the Base results', () => {
	function filteredWithState(showCompleted = true) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 20, status: 'New' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status', showCompleted });
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		expandAll(containerEl);
		return { view, containerEl };
	}

	it('breaks down levels without the context ancestor', () => {
		const { containerEl } = filteredWithState();
		const tooltip = containerEl.querySelector<HTMLElement>('.pbl-count-label')?.dataset.tooltip;

		// The Epic is scaffolding, not one of this base's two PBIs
		expect(tooltip).toBe('2 PBI');
	});

	it('counts only results as hidden in the completed toggle', () => {
		const { containerEl } = filteredWithState(false);
		const label = containerEl.querySelector('.pbl-completed-toggle')?.getAttribute('aria-label');

		expect(label).toBe('Show completed items (1 hidden)');
	});
});

describe('rollups describe the Base results only', () => {
	/** Reuses the stress fixture: context rows above, beside and between results. */
	interface Node {
		children: Node[];
		outsideFilter: boolean;
		done: boolean;
		descendantCount: number;
		doneDescendants: number;
	}

	it('never counts a context row, anywhere in the tree', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'New' }, parentLink: 'Feature A' });
		vault.addFile('Mid.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Feature B' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'Mid' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({ stateProperty: 'note.status' });
		anyView.data = {
			data: vault.entries().filter((e) => !['Epic.md', 'Feature A.md', 'Mid.md'].includes(e.file.path)),
		};
		view.onDataUpdated();

		// Stated from the rule, not from the implementation: a rollup counts the
		// results below an item, and nothing else.
		const results = (item: Node): number =>
			item.children.reduce((n, c) => n + (c.outsideFilter ? 0 : 1) + results(c), 0);
		const doneResults = (item: Node): number =>
			item.children.reduce((n, c) => n + (!c.outsideFilter && c.done ? 1 : 0) + doneResults(c), 0);

		const items = (view.model?.items ?? []) as unknown as Node[];
		expect(items.length).toBe(6);
		for (const item of items) {
			expect(item.descendantCount).toBe(results(item));
			expect(item.doneDescendants).toBe(doneResults(item));
		}
		// Not vacuous: the done context row and the open result under it are both there
		const featureB = view.model?.byPath.get('Feature B.md');
		expect(featureB?.descendantCount).toBe(1);
		expect(featureB?.doneDescendants).toBe(0);
	});
});
