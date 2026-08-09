// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Modal, Notice } from '../helpers/obsidian-mock';
import {
	fixture,
	flush,
	key,
	makeView,
	noOptionalProperties,
	refresh,
	rowByTitle,
	titlesOf,
	treeOf,
	useViewHarness,
} from '../helpers/view';

useViewHarness();

describe('toolbar backfill', () => {
	const initButton = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLElement>('[aria-label="Assign missing properties"]');

	it('backfills missing properties and reports the count', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped.md', { parentLink: 'Epic' });
		const { containerEl } = makeView(vault, noOptionalProperties());

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Untyped.md')['type']).toBe('Feature');
		expect(Notice.messages.some((m) => m.includes('updated 1 item'))).toBe(true);
	});

	it('binds the properties nobody has named, and creates them empty on every item', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// The loop this breaks: a property no note carries cannot be picked in the view
		// options, and a property the options do not name cannot be written to a note.
		const { containerEl, config, view } = makeView(vault);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(config.values).toMatchObject({
			stateProperty: 'note.status',
			startedDateProperty: 'note.started',
			finishedDateProperty: 'note.finished',
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
			riskProperty: 'note.risk',
			dependsOnProperty: 'note.dependsOn',
		});
		// deliverableStateProperty is NOT bound: it now suggests the same key `status`
		// does, `state` is declared first and claims it, and adoptableProperties'
		// existing "don't suggest an already-taken key" guard skips the second
		// suggestion of one already spoken for — leaving the Deliverable workflow to
		// share `status` through its own fallback (`resolvedDeliverableStateKey`)
		// rather than this action writing the same explicit key to both options.
		expect(config.values.deliverableStateProperty).toBeUndefined();
		expect(view.settings.deliverableStateKey).toBe('');
		// Every one of them on the note, empty: the features are usable and nothing was
		// decided for the user — no state, no horizon, no dates. Not deliverableStatus:
		// that stub is scoped to Deliverable-typed items, and this note is an Epic.
		//
		// Nor the prerequisite list, which is bound above and deliberately absent here for
		// a different reason. An empty state is a slot on this note to fill; an empty
		// prerequisite list is a claim about a relationship that does not exist, made on
		// every note at once — and it is the exact state a removal is required never to
		// leave behind, so backfilling one would have this button create what
		// `Remove dependency…` exists to clean up.
		expect(vault.fm('Epic.md')).toEqual({
			type: 'Epic',
			order: 10,
			status: '',
			started: '',
			finished: '',
			horizon: '',
			start: '',
			due: '',
			risk: '',
		});
		expect(view.settings.stateKey).toBe('status');
		expect(
			Notice.messages.some((m) =>
				m.includes('set up status, started, finished, horizon, start, due, risk, dependsOn'),
			),
		).toBe(true);
	});

	it('says where a property it just bound becomes visible', async () => {
		// Binding a property and stubbing it onto every note still shows nothing: the
		// columns are the Bases properties menu, and `BasesViewConfig` has no setter for
		// it. The Notice is the only place that loop is closed.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(Notice.messages.some((m) => m.includes('properties menu'))).toBe(true);
	});

	it('binds nothing a second time, and nothing the user cleared', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl, config, view } = makeView(vault, { horizonProperty: '' });

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		const afterFirst = config.setCalls.length;
		// Nothing refreshes on its own in this harness, and the second press has to be
		// planned against what the first one wrote.
		refresh(view, vault);
		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// A cleared property is a decision this action must not overrule, and a second
		// press has nothing left to bind or to fill.
		expect(config.values['horizonProperty']).toBe('');
		expect(vault.fm('Epic.md')['horizon']).toBeUndefined();
		expect(config.setCalls).toHaveLength(afterFirst);
		expect(Notice.messages.at(-1)).toBe('All items already have the properties this view writes.');
	});

	it('never blanks a value written since the plan was made', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Later.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = makeView(vault);
		// The row that planned this can be a refresh behind the note, so presence is
		// asked of the live note at the write boundary rather than trusted from the plan.
		vault.afterWrite = (path) => {
			if (path === 'Epic.md') vault.fm('Later.md')['status'] = 'Active';
		};

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Later.md')['status']).toBe('Active');
	});

	it('creates the configured placement keys empty, moving nothing on the roadmap', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		const { containerEl, view } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
			riskProperty: 'note.risk',
		});

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The property now exists and is editable in Obsidian's own editor, while the
		// item keeps the placement it had — none. A value here would invent a plan.
		expect(vault.fm('Epic.md')).toMatchObject({ horizon: '', start: '', due: '' });
		expect(view.model?.byPath.get('Epic.md')?.horizon.value).toBeNull();
		// What already had a value keeps it: the button fills gaps, it does not tidy.
		expect(vault.fm('Placed.md')['horizon']).toBe('Now');
	});

	it('says so when every property this view writes is already there', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, noOptionalProperties());

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.includes('already have the properties'))).toBe(true);
	});

	it('claims nothing for a batch that failed partway', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped.md', { parentLink: 'Epic' });
		vault.failWrites.add('Untyped.md');
		const { containerEl } = makeView(vault, noOptionalProperties());

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The failure has already reported itself; a count on top of it would claim
		// the batch landed.
		expect(Notice.messages.some((m) => m.includes('updated'))).toBe(false);
		expect(Notice.messages.some((m) => m.includes('Failed to update'))).toBe(true);
	});

	it('does not claim success when the backfill is blocked', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Untyped.md', { parentLink: 'Epic' });
		const { containerEl, config } = makeView(vault, { orderProperty: 'note.parent' });

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.includes('updated'))).toBe(false);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
		// And the options are left alone too: binding properties into a view whose keys
		// already collide would change the configuration and then refuse every write.
		expect(config.setCalls).toEqual([]);
	});
});

describe('toolbar controls', () => {
	it('offers every type in the New picker and opens the right prompt', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const picker = Menu.lastShown;
		// Every declared type: this menu is the one place a top-level item of any type
		// can be made.
		expect(picker?.items.map((i) => i.titleText)).toEqual([
			'New Epic',
			'New Feature',
			'New PBI',
			'New Task',
			'New Issue',
			'New Bug',
			'New Idea',
			'New Deliverable',
			'New Milestone',
		]);

		picker?.item('New PBI')?.click();
		expect(Modal.lastOpened?.titleEl.textContent).toBe('New PBI');
	});

	it('collapses and expands everything from the toolbar', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		containerEl
			.querySelector<HTMLElement>('[aria-label="Collapse all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		containerEl
			.querySelector<HTMLElement>('[aria-label="Expand all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		// Neither control writes to the base file.
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
	});
});

describe('toolbar controls are reachable without a mouse', () => {
	/** Every control the toolbar renders, by the label a user would hear. */
	function controlsByLabel(containerEl: HTMLElement): Map<string, HTMLElement> {
		const toolbar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
		if (!toolbar) throw new Error('toolbar not rendered');
		const found = new Map<string, HTMLElement>();
		for (const el of Array.from(toolbar.querySelectorAll<HTMLElement>('[aria-label]'))) {
			found.set(el.getAttribute('aria-label') ?? '', el);
		}
		return found;
	}

	it('renders every activatable toolbar control as a real button', () => {
		const vault = fixture();
		vault.addFile('Done.md', { frontmatter: { type: 'Epic', order: 30, status: 'Done' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' }, { focus: 'Feature' });
		const controls = controlsByLabel(containerEl);

		// The full set a keyboard user has to be able to reach. Anything that only
		// responds to a click is invisible to Tab, so a div here is a real defect.
		for (const label of [
			'New item of another type',
			'Assign missing properties',
			'Expand all',
			'Collapse all',
			'Hide completed items',
			'Filter items',
			'Show all types',
		]) {
			const el = controls.get(label);
			expect(el, `no toolbar control labelled "${label}"`).toBeDefined();
			expect(el?.tagName, `"${label}" is not keyboard-activatable`).toMatch(/^(BUTTON|INPUT)$/);
		}
	});

	it('activates a toolbar button from the keyboard', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const collapse = controlsByLabel(containerEl).get('Collapse all');

		// What Enter or Space on a focused <button> does: a plain click, no pointer.
		collapse?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('keeps the clear buttons out of the tab order until they apply', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const clear = () => containerEl.querySelector<HTMLElement>('.pbl-filter-clear');

		// Hidden by `display: none` until the filter is active — which removes it
		// from the tab order too, so Tab does not stop on a control that does nothing.
		expect(clear()?.tagName).toBe('BUTTON');
		expect(containerEl.querySelector('.pbl-filter')?.classList.contains('pbl-filter-active')).toBe(false);

		view.setFilter('Feature');
		expect(containerEl.querySelector('.pbl-filter')?.classList.contains('pbl-filter-active')).toBe(true);
	});

	it('gives each row an add button assistive tech can activate, off the tab order', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const add = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-add');

		// Same bargain as the state chip: a real button, but the tree keeps its
		// single tab stop — one stop per row would bury the tree itself.
		expect(add?.tagName).toBe('BUTTON');
		expect(add?.getAttribute('tabindex')).toBe('-1');
		expect(add?.getAttribute('aria-label')).toBe('New child item');
	});
});

describe('menus opened without a pointer', () => {
	/** Enter or Space on a focused button: a click carrying no coordinates. */
	function pressButton(el: HTMLElement, rect: { left: number; bottom: number }): void {
		el.getBoundingClientRect = () =>
			({ ...rect, top: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
		el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	it('anchors the type picker to its button, not the viewport corner', () => {
		const { containerEl } = makeView(fixture());
		const pick = containerEl.querySelector<HTMLElement>('.pbl-new-pick');
		if (!pick) throw new Error('type picker not rendered');

		pressButton(pick, { left: 40, bottom: 24 });
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('New Epic');
		expect(Menu.lastPosition).toEqual({ x: 40, y: 24 });
	});

	it('anchors the focus-level picker to its button', () => {
		const { containerEl } = makeView(fixture());
		const btn = containerEl.querySelector<HTMLElement>('.pbl-focus-btn');
		if (!btn) throw new Error('focus picker not rendered');

		pressButton(btn, { left: 12, bottom: 30 });
		expect(Menu.lastPosition).toEqual({ x: 12, y: 30 });
	});

	it('still follows the pointer when there is one', () => {
		const { containerEl } = makeView(fixture());
		containerEl
			.querySelector<HTMLElement>('.pbl-new-pick')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 80 }));

		// A real pointer position beats the button's box.
		expect(Menu.lastShown).not.toBeNull();
		expect(Menu.lastPosition).toBeNull();
	});
});

describe('long operations stay legible and non-blocking', () => {
	/** Four items with no order or type — enough writes for a batch to be visible. */
	function backfillFixture(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F1.md', { parentLink: 'Epic' });
		vault.addFile('F2.md', { parentLink: 'Epic' });
		vault.addFile('F3.md', { parentLink: 'Epic' });
		return vault;
	}

	function runBackfill(containerEl: HTMLElement): void {
		containerEl
			.querySelector<HTMLElement>('[aria-label="Assign missing properties"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	/** Run `probe` after each file the next batch writes. */
	function onEachWrite(vault: FakeVault, probe: () => void): void {
		const original = vault.app.fileManager.processFrontMatter;
		vault.app.fileManager.processFrontMatter = async (file, fn) => {
			await original(file, fn);
			probe();
		};
	}

	function busyLabel(containerEl: HTMLElement): string | null {
		const el = containerEl.querySelector<HTMLElement>('.pbl-busy');
		return el?.classList.contains('pbl-busy-on') ? (el.querySelector('.pbl-busy-label')?.textContent ?? '') : null;
	}

	/**
	 * The count as the TITLE carries it — the visible counter is `aria-hidden`, so this is
	 * the form a screen reader can still reach. The label reads one of two words for every
	 * batch of any size so that no tick can change the row's width, and the per-file
	 * number lives in the label's `title`. `null` when the indicator is off or the batch
	 * carries no count. See `syncBusyLabel`.
	 */
	function busyCount(containerEl: HTMLElement): string | null {
		const el = containerEl.querySelector<HTMLElement>('.pbl-busy');
		if (!el?.classList.contains('pbl-busy-on')) return null;
		return el.querySelector('.pbl-busy-label')?.getAttribute('title') ?? null;
	}

	it('shows a loading state until the first result set arrives', () => {
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);

		// Bases constructs the view and delivers data separately; the gap must not
		// look like a broken view.
		expect(containerEl.querySelector('.pbl-loading')?.textContent).toContain('Loading backlog');

		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = fixture().app;
		anyView.config = new FakeViewConfig({});
		anyView.data = { data: [] };
		view.onDataUpdated();
		expect(containerEl.querySelector('.pbl-loading')).toBeNull();
	});

	it('counts a batch off file by file, then clears', async () => {
		const vault = backfillFixture();
		const { containerEl } = makeView(vault);
		const seen: (string | null)[] = [];
		const drawn = new Set<string | null>();
		onEachWrite(vault, () => {
			seen.push(busyCount(containerEl));
			drawn.add(busyLabel(containerEl));
		});

		expect(busyCount(containerEl)).toBeNull();
		runBackfill(containerEl);
		await flush();

		// The probe runs as each file lands, just before that file's progress tick,
		// so it reads one behind: the point is that it counts up per file and that
		// the total is known from the start.
		expect(seen).toEqual(['Updating 0 of 4…', 'Updating 1 of 4…', 'Updating 2 of 4…', 'Updating 3 of 4…']);
		// …while the LABEL never moved. The count beside it does move — that is the
		// point of it — and what stops a moving count moving the ROW is the reservation
		// asserted in `toolbarFit.test.ts`, not this line. What this holds is that the
		// constant part is constant: the label is chosen from the batch's SIZE, which no
		// tick changes.
		expect([...drawn]).toEqual(['Updating']);
		// The indicator belongs to the batch, not to the view.
		expect(busyLabel(containerEl)).toBeNull();
	});

	it('does not put a count on a single-file write', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);
		const seen: (string | null)[] = [];
		const counts: (string | null)[] = [];
		onEachWrite(vault, () => {
			seen.push(busyLabel(containerEl));
			counts.push(busyCount(containerEl));
		});

		const tree = treeOf(containerEl);
		view.selectItem(view.model!.byPath.get('Feature B2.md')!);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();

		// A single-file write keeps the ellipsis, because nothing follows it to read as
		// the continuation — which is also the one thing the label alone can say about
		// batch size. The count's ABSENCE is the check that matters, though: it is what
		// stays true if that styling choice is ever revisited.
		expect(seen).toEqual(['Updating…']);
		expect(counts).toEqual([null]);
	});

	it('rebuilds once after a batch, not once per file it writes', async () => {
		const vault = backfillFixture();
		const { containerEl, view } = makeView(vault, noOptionalProperties());
		let renders = 0;
		const real = view.render.bind(view);
		(view as unknown as { render: () => void }).render = () => {
			renders++;
			real();
		};
		// Every file a batch touches comes back as its own data update. Rebuilding
		// the model and every row for each one is the thing that actually stalls.
		onEachWrite(vault, () => view.onDataUpdated());

		runBackfill(containerEl);
		await flush();

		expect(vault.writeLog).toHaveLength(4);
		expect(renders).toBe(1);
		// Deferred, not dropped: the tree ends up showing what landed on disk.
		expect(titlesOf(containerEl)).toEqual(['Epic', 'F1', 'F2', 'F3']);
	});

	it('withholds the backfill command while a batch is already running', async () => {
		const vault = backfillFixture();
		const { containerEl } = makeView(vault, noOptionalProperties());
		const initBtn = containerEl.querySelector<HTMLButtonElement>('.pbl-write-ctl');
		const seen: boolean[] = [];
		onEachWrite(vault, () => seen.push(initBtn?.disabled ?? false));

		expect(initBtn?.disabled).toBe(false);
		runBackfill(containerEl);
		await flush();

		// Disabled for the whole batch, released at the end — a control that would be
		// refused should not be offered in the first place.
		expect(seen.every(Boolean)).toBe(true);
		expect(containerEl.querySelector<HTMLButtonElement>('.pbl-write-ctl')?.disabled).toBe(false);
	});

	it('keeps the tree interactive while a batch is in flight', async () => {
		const vault = backfillFixture();
		const { containerEl, view } = makeView(vault);
		let collapsedMidBatch: string[] | null = null;
		onEachWrite(vault, () => {
			if (collapsedMidBatch) return;
			// Reading and navigating the tree must keep working during the writes.
			view.setFilter('F');
			collapsedMidBatch = titlesOf(containerEl);
			view.setFilter('');
		});

		runBackfill(containerEl);
		await flush();

		expect(collapsedMidBatch).toEqual(['Epic', 'F1', 'F2', 'F3']);
		expect(treeOf(containerEl).getAttribute('aria-busy')).toBeNull();
	});
});

describe('grouping advisory', () => {
	it('flags a configured group-by as having no effect', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();

		(view as unknown as { data: unknown }).data = {
			data: vault.entries(),
			groupedData: [{ hasKey: () => true, entries: [] }],
		};
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-grouping-note')?.textContent).toBe('Grouping ignored');
	});

	it('stays quiet for the implicit single ungrouped group', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		(view as unknown as { data: unknown }).data = {
			data: vault.entries(),
			groupedData: [{ hasKey: () => false, entries: [] }],
		};
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-grouping-note')).toBeNull();
	});
});

describe('toolbar count breakdown', () => {
	it('summarizes items per level in the count tooltip', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const count = containerEl.querySelector<HTMLElement>('.pbl-count-label');

		expect(count?.textContent).toBe('4 items');
		expect(count?.dataset.tooltip).toBe('2 Epic · 2 Feature');
		// Filter changes to the count are announced to assistive tech
		expect(count?.getAttribute('aria-live')).toBe('polite');
	});

	/**
	 * That `aria-live` is exactly why this test exists. A live region announces on
	 * MUTATION, not on a changed value — and `setText` assigns `textContent`, which
	 * destroys the text node and builds a new one even when the string is identical.
	 * `syncCountLabel` runs on every content render, so filtering to something every item
	 * matches queued an announcement of "4 items" per keystroke.
	 *
	 * Node identity is the whole claim, and comparing `textContent` cannot reach it: that
	 * assertion is true of the broken code. The tooltip is checked the same way through a
	 * sentinel, because `setTooltip` writing the same string back is equally invisible to
	 * a value comparison — and it is the write that carries Obsidian's hover handling and,
	 * in some versions, an `aria-label` for this element.
	 */
	it('rewrites neither the text node nor the tooltip when nothing about the count changed', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const count = () => containerEl.querySelector<HTMLElement>('.pbl-count-label');
		const label = count();
		const node = label?.firstChild;
		if (!label || !node) throw new Error('the count label is missing its text');
		label.dataset.tooltip = 'untouched';

		// A content-only render — the toolbar itself is not rebuilt, which is what makes
		// the element identity below meaningful — leaving the number exactly as it was:
		// every item in the fixture matches `e`.
		view.setFilter('e');

		expect(count()).toBe(label);
		expect(label.textContent).toBe('4 items');
		expect(label.firstChild).toBe(node);
		expect(label.dataset.tooltip).toBe('untouched');
	});
});

// The Deliverables board's own toolbar behavior (its toggle, its count scoping, its
// New button and its reduced focus control) lives in deliverablesToolbar.test.ts —
// split out to keep this file under its line budget, and because it is one subject.
