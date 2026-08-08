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
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { horizonVault, makeRoadmap, shelfTitles } from '../helpers/roadmap';

useViewHarness();

function collapseCtls(containerEl: HTMLElement): HTMLButtonElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl'));
}

/** `iconButton` puts the label in `aria-label`; the button's own text is an icon. */
function collapseCtl(containerEl: HTMLElement, label: string): HTMLButtonElement | undefined {
	return collapseCtls(containerEl).find((b) => b.getAttribute('aria-label') === label);
}

function kidTitlesOf(card: HTMLElement): (string | null)[] {
	return Array.from(card.querySelectorAll('.pbl-card-kid-title')).map((el) => el.textContent);
}

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
		});
		// Every one of them on the note, empty: the features are usable and nothing was
		// decided for the user — no state, no horizon, no dates.
		expect(vault.fm('Epic.md')).toEqual({
			type: 'Epic',
			order: 10,
			status: '',
			started: '',
			finished: '',
			horizon: '',
			start: '',
			due: '',
		});
		expect(view.settings.stateKey).toBe('status');
		expect(Notice.messages.some((m) => m.includes('set up status, started, finished, horizon, start, due'))).toBe(
			true,
		);
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

describe('the bulk collapse controls reach cards', () => {
	it('offers Expand all and Collapse all on the board, driving the cards', () => {
		const { containerEl } = makeBoard(boardVault());
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(kidTitlesOf(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	it('drives the roadmap’s cards too', () => {
		// A horizon roadmap: its bucket cards and shelf cards both come through
		// `renderCardBody`, so they carry disclosures exactly as board cards do.
		const vault = horizonVault();
		vault.addFile('Feature N1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Now item' });
		const { containerEl } = makeRoadmap(vault);
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(kidTitlesOf(cardByTitle(containerEl, 'Now item'))).toEqual(['Feature N1']);
	});

	// Half the original gate's reason survives: on a projection that drew no disclosure
	// these buttons change nothing on screen and still write collapse state, which then
	// surprises the tree. Disabled, not absent, and on the property rather than in CSS.
	it('disables them on a board that drew no cards at all', () => {
		// No configured workflow, so the board draws guidance rather than columns.
		const { containerEl } = makeBoard(boardVault(), { stateProperty: '', stateValues: '' });
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('disables them on a dated roadmap whose only rows are timeline rows', () => {
		const DATED_AXIS = { startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' };
		const vault = new FakeVault();
		// BOTH dated, so both draw bars and neither is unplaceable: the shelf stays
		// empty, no card body is drawn anywhere in the projection, and there is
		// genuinely nothing to collapse. This is the case a board-only test cannot
		// reach — cards exist on screen, and none of them is a card body.
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Dated feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-09-01', due: '2026-10-01' },
			parentLink: 'Dated epic',
		});
		const { containerEl } = makeRoadmap(vault, DATED_AXIS);

		// Confirm the fixture really is timeline-only before trusting the verdict.
		expect(shelfTitles(containerEl)).toEqual([]);
		// Presence FIRST, and not as ceremony: `[].every(...)` is true, so a bare
		// `every` check would pass against an implementation that omitted the controls
		// altogether — the one outcome the spec rules out, since disabled-and-present is
		// what keeps them from vanishing as the projection changes.
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
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

	it('really disables the collapse controls while a filter overrides them', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		expect(collapseCtls(containerEl)).toHaveLength(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(false);

		// Dimming them with CSS was enough while they were unreachable divs; a
		// focusable button has to refuse the press itself.
		view.setFilter('Feature');
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);

		view.setFilter('');
		expect(collapseCtls(containerEl).some((b) => b.disabled)).toBe(false);
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
		onEachWrite(vault, () => seen.push(busyLabel(containerEl)));

		expect(busyLabel(containerEl)).toBeNull();
		runBackfill(containerEl);
		await flush();

		// The probe runs as each file lands, just before that file's progress tick,
		// so it reads one behind: the point is that it counts up per file and that
		// the total is known from the start.
		expect(seen).toEqual(['Updating 0 of 4…', 'Updating 1 of 4…', 'Updating 2 of 4…', 'Updating 3 of 4…']);
		// The indicator belongs to the batch, not to the view.
		expect(busyLabel(containerEl)).toBeNull();
	});

	it('does not put a count on a single-file write', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);
		const seen: (string | null)[] = [];
		onEachWrite(vault, () => seen.push(busyLabel(containerEl)));

		const tree = treeOf(containerEl);
		view.selectItem(view.model!.byPath.get('Feature B2.md')!);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();

		expect(seen).toEqual(['Updating…']);
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
});
