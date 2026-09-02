// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault, setResults } from '../helpers/vault';
import { FuzzySuggestModal, Menu, Modal } from '../helpers/obsidian-mock';
import { drag, flush, itemAt, key, makeView, noTypeFolders, rowByTitle, rows, submitPrompt, treeOf, useViewHarness } from '../helpers/view';
import { computeAssigneeWrites } from '../../src/domain/writePlan';

useViewHarness();

describe('moves in a group that holds an outside-filter row', () => {
	/** Epic E over Feature A (context, because its PBI matched) and Feature B (a result). */
	function mixedView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature A.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A' });
		// Inference is what this test is about, so the type folders that would answer
		// first are turned off.
		const { view, containerEl } = makeView(vault, noTypeFolders(), { only: ['Feature B.md', 'PBI.md'] });
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
		view.selectItem(itemAt(view, 'Feature B.md'));

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
		// Inference is what this test is about, so the type folders that would answer
		// first are turned off.
		const { containerEl } = makeView(
			vault,
			noTypeFolders(),
			{ collapsed: true, only: ['Backlog/A.md', 'Backlog/B.md'] },
		);

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
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		const { view, containerEl } = makeView(
			vault,
			noTypeFolders({ inferFolderHierarchy: true }),
			{ only: ['Backlog/PBI.md'] },
		);
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
		// Type folders off: the rule under test is where a child of a CONTEXT parent
		// lands, which only comes up when the folder is being inferred at all.
		const { containerEl } = makeView(vault, noTypeFolders({ inferFolderHierarchy: true }), { collapsed: true });

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
		vault.addFile('Epic.md', {
			frontmatter: {
				type: 'Epic',
				order: 10,
				status: 'Active',
				tags: ['ctx'],
				risk: '1 - High',
				priority: '1 - Must',
				assignee: 'Dana',
			},
		});
		vault.addFile('Feature A.md', {
			frontmatter: { type: 'Feature', order: 10, tags: ['ctx'], risk: '3 - Low', priority: '3 - Could', assignee: 'Dana' },
			parentLink: 'Epic',
		});
		vault.addFile('Feature B.md', { frontmatter: { type: 'Feature', order: 20, tags: ['a'] }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', status: 'New' }, parentLink: 'Feature A' });
		// The context row in the middle is done and the result below it is not, so
		// counting either one in a rollup would show up as a wrong number.
		vault.addFile('Mid.md', {
			// It also DECLARES a prerequisite: an excluded note may be named and may not
			// do the naming, so this list must produce no edge and no mark at all.
			frontmatter: {
				type: 'PBI',
				order: 10,
				status: 'Done',
				tags: ['ctx'],
				risk: '2 - Normal',
				priority: '2 - Should',
				assignee: 'Dana',
				dependsOn: 'Task',
				// A context row that is IN an iteration, so a `None` pick would have something
				// to remove here rather than nothing to do. What withholds it is the
				// `editable` gate — and that gate is NOT what this sweep proves: dropping it
				// (tried, 2026-08-16) leaves this test green, because `applySafely` then
				// refuses the batch structurally. Two defences, and the sweep asserts the
				// outcome both produce.
				iteration: '[[Sprint 12]]',
			},
			parentLink: 'Feature B',
		});
		// And a result naming a context row, which is the allowed direction.
		vault.addFile('Task.md', {
			frontmatter: { type: 'Task', order: 10, status: 'New', dependsOn: 'Mid' },
			parentLink: 'Mid',
		});
		// A target for `Set iteration`, dated so the pick writes a timeframe as well as a
		// link — three keys through one entry point. A marker hangs from nothing, so it
		// draws as a row of its own and the sweep drags it about like any other.
		vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', order: 30, start: '2026-09-07', due: '2026-09-18' },
		});
		// A resource note for Set assignee's own pick path — the new one this task adds —
		// so the stress sweep's generic menu drive has a real entry to click, beside the
		// targeted refusal below.
		vault.addFile('Robin.md', { frontmatter: { type: 'Resource' } });

		// Both roadmap axes configured, so the placement writes are entry points this
		// sweep drives too — Set horizon, Clear horizon, Schedule, Unschedule.
		const configValues = {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
			// Risk is a write surface too, so Set risk and Clear risk are entry points
			// this sweep drives. The context rows each hold a level, so the removal is
			// offered on them and not merely withheld for having nothing to remove.
			riskProperty: 'note.risk',
			// The second declared ladder, and a second pair of entry points for the same
			// reason: Set priority and Clear priority, each offered on a context row that
			// carries a level, so the removal is refused rather than merely unoffered.
			priorityProperty: 'note.priority',
			// The assignee is a write surface with a vocabulary taken off the RESULTS, so
			// it is two entry points in this sweep at once: Set assignee and Clear
			// assignee on a context row, and — the reason the names below sit on context
			// rows — the check that an excluded note never becomes a name this base
			// offers to the results it does return.
			assigneeProperty: 'note.assignee',
			dependsOnProperty: 'note.dependsOn',
			// `Set iteration` writes a LINK and, with both date keys named above, the
			// iteration's own timeframe with it — the widest single menu write there is, and
			// the one whose targets are notes rather than a declared vocabulary. Without this
			// the entry is withheld everywhere and the sweep drove nothing, which the
			// `commandsDriven` check now refuses to let happen again.
			iterationProperty: 'note.iteration',
		};
		// Every chip is a write surface too, and a chip is drawn by a VISIBLE column, so
		// the sweep only reaches them if the base shows their properties. Without this
		// the state, horizon and risk chips are absent and each `?.dispatchEvent` below
		// drives nothing while still passing.
		const { view, containerEl } = makeView(vault, configValues, {
			except: CONTEXT_PATHS,
			order: [
				'note.tags',
				'note.status',
				'note.horizon',
				'note.risk',
				'note.priority',
				'note.assignee',
				'note.start',
				'note.due',
			],
		});
		return { view, containerEl, vault };
	}

	/**
	 * Which command titles the sweep actually found, for the same reason `chipsDriven`
	 * exists below: an entry withheld because its property is unconfigured leaves this
	 * loop driving nothing while every assertion still passes. A write path that is
	 * offered nowhere in the fixture is not being swept, however many rows it runs over.
	 */
	const commandsDriven = new Set<string>();

	/** Fire every menu command on a row, including the ones nested in submenus. */
	async function triggerEveryCommand(row: HTMLElement): Promise<void> {
		row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		for (const item of Menu.lastShown?.items ?? []) {
			commandsDriven.add(item.titleText);
			item.clickHandler?.();
			await flush();
			// A command that opens a prompt has not written anything yet, so the prompt
			// is part of the entry point: confirm the one that would.
			await confirmSchedulePrompt();
			await chooseFirstSuggestion();
			for (const sub of item.submenu?.items ?? []) {
				sub.clickHandler?.();
				await flush();
			}
		}
	}

	/**
	 * Take the first offer of any suggester the last command opened. A menu entry that
	 * merely OPENS a picker has written nothing yet, so leaving it open would sweep the
	 * entry and not the write behind it.
	 */
	async function chooseFirstSuggestion(): Promise<void> {
		const modal = Modal.lastOpened;
		if (!(modal instanceof FuzzySuggestModal)) return;
		Modal.forget();
		const offered = (modal as FuzzySuggestModal<unknown>).offered();
		if (offered.length > 0) (modal as FuzzySuggestModal<unknown>).choose(offered[0]);
		await flush();
	}

	/** Fill and submit the schedule prompt, if that is what the last command opened. */
	async function confirmSchedulePrompt(): Promise<void> {
		const modal = Modal.lastOpened;
		if (!modal?.titleEl.textContent?.startsWith('Schedule ')) return;
		Modal.forget();
		for (const input of modal.contentEl.querySelectorAll('input')) {
			input.value = '2026-08-03';
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
		modal.contentEl.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
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

	// A real timeout rather than the 5s default, because this is a deliberate COMBINATORIAL
	// sweep — six rows against six rows across three zones, then every command, chip and
	// shortcut on each — and it runs at roughly 4.3s of that budget in isolation under
	// coverage. Adding tests anywhere else in the suite is then enough to tip it over
	// through worker contention alone, which reads as this test breaking and is not: the
	// measurement either side of a change that touched none of this code was 4.24s to
	// 4.33s. Slack, not a licence to grow — a sweep that genuinely needs 20s has stopped
	// being one test.
	it('never writes to one, whatever is done to any row', async () => {
		const { containerEl, vault } = stressView();
		// Six, not seven: `Sprint 12` is in the model as a `Set iteration` target and the
		// tree does not DRAW an iteration, which is what it means for one to be the
		// container of a board rather than a row of the plan.
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
		// `Set iteration`, aimed and asserted BEFORE the sweep: a submenu whose picks all
		// no-op would satisfy `commandsDriven` below while writing nothing anywhere.
		// It cannot be asked after the sweep any more — `Set type` offers `Release`, and a
		// row the sweep has retyped to one is a note whose LIVE type may hold no iteration
		// key (`refusesLiveType`, `src/storage/frontmatter.ts`), so every pick after that
		// is refused exactly as it should be. `Sprint 12` carries two dates, so this is the
		// link and the timeframe through one pick.
		for (const row of allRows) {
			row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			const join = Menu.lastShown?.items.find((item) => item.titleText === 'Set iteration');
			join?.clickHandler?.();
			await flush();
			for (const sub of join?.submenu?.items ?? []) {
				sub.clickHandler?.();
				await flush();
			}
		}
		expect(vault.writeLog.some((w) => w.fm.iteration === '[[Sprint 12]]' && w.fm.start === '2026-09-07')).toBe(true);

		// Every context-menu command, every chip, every structural shortcut
		const tree = treeOf(containerEl);
		// Which chip kinds the sweep actually found. A chip renders only where its
		// property is a visible column, so a query that matched nothing would leave
		// `?.dispatchEvent` driving nothing and every assertion below still passing —
		// checked after the loop rather than trusted.
		const chipsDriven = new Set<string>();
		for (const row of allRows) {
			await triggerEveryCommand(row);
			for (const chipClass of [
				'.pbl-state-chip',
				'.pbl-horizon-chip',
				'.pbl-risk-chip',
				'.pbl-priority-chip',
				'.pbl-assignee-chip',
			]) {
				const chip = row.querySelector<HTMLElement>(chipClass);
				if (!chip) continue;
				chipsDriven.add(chipClass);
				chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
				for (const entry of Menu.lastShown?.items ?? []) {
					entry.clickHandler?.();
					await flush();
				}
			}
			// The DATE chips open a prompt rather than a menu, and there are two of them on
			// a row, so they are swept separately and by `querySelectorAll`. A context row's
			// is a static div that opens nothing, which `confirmSchedulePrompt` reports by
			// finding no Schedule modal to confirm.
			for (const chip of row.querySelectorAll<HTMLElement>('.pbl-date-chip')) {
				chipsDriven.add('.pbl-date-chip');
				chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
				await confirmSchedulePrompt();
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
		// Every write path that reaches the frontmatter through a MENU, named. A property
		// left unconfigured in the fixture withholds its entries, and the sweep then
		// reports safety it never tested — which is exactly what happened to
		// `Set iteration`, offered nowhere here until 2026-08-16.
		for (const command of ['Set state', 'Set type', 'Set risk', 'Set priority', 'Set assignee', 'Set iteration']) {
			expect(commandsDriven).toContain(command);
		}
		expect([...chipsDriven].sort()).toEqual([
			'.pbl-assignee-chip',
			'.pbl-date-chip',
			'.pbl-horizon-chip',
			'.pbl-priority-chip',
			'.pbl-risk-chip',
			'.pbl-state-chip',
		]);
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
	}, 20_000);

	it('refuses an assignee pick that would name a context row', async () => {
		// The editable gate withholds Set assignee from a context row's own menu
		// entirely, so no UI reaches this — which is the point: the last line of defence
		// is structural, exactly as `test/view/contextCardWrites.test.ts` drives for the
		// resources axis's own `performResourceMove`. This is the tree's equivalent,
		// off-axis, where a pick goes straight through `applySafely`.
		const { view, vault } = stressView();
		const mid = view.model?.byPath.get('Mid.md');
		const robin = vault.files.get('Robin.md');
		if (!mid || !robin) throw new Error('fixture missing');

		const applied = await view.applySafely(computeAssigneeWrites(mid, robin));

		expect(applied).toBeNull();
		expect(vault.writeLog).toEqual([]);
	});
});

describe('undo across the filter boundary', () => {
	it('still undoes a write that moved its own target out of the filter', async () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Parent' });
		// A chip is drawn by a VISIBLE column, so the base has to show the property.
		const { view, containerEl } = makeView(vault, { stateProperty: 'note.status' }, { order: ['note.status'] });

		// Mark the parent done through its chip — an ordinary write to a result row.
		rowByTitle(containerEl, 'Parent')
			.querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('Done')?.clickHandler?.();
		await flush();
		expect(vault.fm('Parent.md')['status']).toBe('Done');

		// The base's filter excludes done items, so the requery demotes the parent
		// to a context row above its still-open child.
		setResults(view, vault.entries().filter((e) => e.file.path !== 'Parent.md'));
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
		const { view, containerEl } = makeView(
			vault,
			{ stateProperty: 'note.status' },
			{ except: ['Epic.md'], hideCompleted: !showCompleted },
		);
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
		const { view } = makeView(
			vault,
			{ stateProperty: 'note.status' },
			{ collapsed: true, except: ['Epic.md', 'Feature A.md', 'Mid.md'] },
		);

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
