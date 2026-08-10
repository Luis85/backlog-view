// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, makeView, noOptionalProperties, rowByTitle } from '../helpers/view';
import { cardByTitle } from '../helpers/board';
import { renderToolbar, syncCountLabel } from '../../src/view/render/toolbar';

/**
 * Which workflow tracks an item's state is a property of its TYPE, not of the
 * projection it is drawn in. Every check here drives the TREE — the projection where
 * the projection-based rule was wrong — plus the requirements board, where offering
 * `Deliverable` as a type writes a note that board cannot show.
 */

/** A Deliverable and a PBI, each carrying a value in each workflow's own key. */
function vaultWithBoth(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'In progress', deliverableStatus: 'Draft' },
	});
	vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 20, status: 'In progress', deliverableStatus: 'Draft' } });
	return vault;
}

const CONFIG = {
	stateProperty: 'note.status',
	stateValues: 'To do, In progress, Done',
	deliverableStateProperty: 'note.deliverableStatus',
	deliverableStateValues: 'Concept, Draft, Review, Published',
};

function setStateValues(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const submenu = Menu.lastShown?.item('Set state')?.submenu;
	if (!submenu) throw new Error(`no Set state submenu for ${title}`);
	return submenu.items.map((i) => i.titleText);
}

describe('the workflow an item is tracked by follows its type, not the projection', () => {
	it('offers the Deliverable workflow’s states in the TREE’s Set state for a Deliverable', () => {
		const { containerEl } = makeView(vaultWithBoth(), CONFIG);

		// The reported bug: on the backlog tree a Deliverable's Set state listed the
		// requirements workflow. Both directions, so a fix that simply swapped the two
		// fails this as loudly as the bug did.
		expect(setStateValues(containerEl, 'D')).toEqual(['Concept', 'Draft', 'Review', 'Published']);
		expect(setStateValues(containerEl, 'P')).toEqual(['To do', 'In progress', 'Done']);
	});

	it('checks the entry the Deliverable already holds, in ITS workflow', () => {
		const { containerEl } = makeView(vaultWithBoth(), CONFIG);

		rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set state')?.submenu;
		// `Draft` is what `deliverableStatus` holds; `In progress` is the requirements
		// value sitting on the same note and must not be what the checkmark answers to.
		expect(submenu?.item('Draft')?.checked).toBe(true);
	});

	it('writes the Deliverable key from the tree, never the requirements one', async () => {
		const vault = vaultWithBoth();
		const { containerEl } = makeView(vault, CONFIG);

		rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Review')?.click();
		await flush();

		expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
		expect(vault.fm('D.md')['status']).toBe('In progress');
	});

	it('draws the Deliverable state once, as the chip, never also as a plain value', () => {
		// The row never draws one property twice with only one of them editable
		// (`src/view/CLAUDE.md`). Both state properties are visible here, so both are
		// columns — and the Deliverable's own value is drawn by the chip in its column
		// and nowhere else, which is what a plain value cell beside it would break.
		const { view, containerEl, config } = makeView(vaultWithBoth(), CONFIG);
		config.order = ['note.deliverableStatus', 'note.status'];
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'D');
		expect(
			Array.from(row.querySelectorAll('.pbl-prop-state')).map(
				(cell) => cell.querySelector('.pbl-state-text')?.textContent ?? '',
			),
		).toEqual(['Draft', '']);
		expect(row.querySelector('.pbl-prop-value')).toBeNull();
	});

	it('shows the Deliverable’s own state on the tree’s state chip', () => {
		const { containerEl } = makeView(vaultWithBoth(), CONFIG, {
			order: ['note.status', 'note.deliverableStatus'],
		});

		const chipText = (title: string) =>
			rowByTitle(containerEl, title).querySelector('.pbl-state-text')?.textContent;
		// The chip and the menu it opens must name one workflow — a chip reading
		// "In progress" over a menu offering Concept/Draft/Review is the same defect
		// one click earlier.
		expect(chipText('D')).toBe('Draft');
		expect(chipText('P')).toBe('In progress');
	});
});

describe('each workflow gets the column its own property is given', () => {
	const headings = (containerEl: HTMLElement) =>
		Array.from(containerEl.querySelectorAll('.pbl-cols .pbl-col-label')).map((el) => el.textContent);

	it('names every state column after its own property, with no generic word left', () => {
		// One column used to hold both workflows and had to call itself "State", which
		// misidentified the property half the rows below it were showing. Two visible
		// properties are two columns now, each named as the user named it.
		const { containerEl } = makeView(vaultWithBoth(), CONFIG, {
			order: ['note.status', 'note.deliverableStatus'],
		});
		expect(headings(containerEl)).toEqual(['status', 'deliverableStatus', 'Progress']);
	});

	it('draws the column for a Deliverable-only workflow, with a chip on Deliverables alone', () => {
		// The menu offers and writes Deliverable states in this configuration, so a tree
		// showing no chip at all was the menu and the column disagreeing.
		const { containerEl } = makeView(
			vaultWithBoth(),
			{ deliverableStateProperty: 'note.deliverableStatus' },
			{ order: ['note.deliverableStatus'] },
		);

		const cell = (title: string) => rowByTitle(containerEl, title).querySelector('.pbl-prop-state');
		expect(cell('D')?.querySelector('.pbl-state-text')?.textContent).toBe('Draft');
		// The PBI's own workflow has no key, so no chip — but the cell still renders, or
		// every column after it would shift on that row alone.
		expect(cell('P')).not.toBeNull();
		expect(cell('P')?.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('renders no state cell when neither workflow has a key', () => {
		const { containerEl } = makeView(vaultWithBoth(), noOptionalProperties(), {
			order: ['note.deliverableStatus'],
		});
		const row = rowByTitle(containerEl, 'D');
		expect(row.querySelector('.pbl-prop-state')).toBeNull();
		// Visible and claimed by no workflow: an ordinary property column, not nothing.
		expect(row.querySelector('.pbl-prop')).not.toBeNull();
	});
});

describe('the requirements board does not offer a type it cannot show', () => {
	it('withholds Deliverable from Set type on the board, and keeps it in the tree', () => {
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;

		rowByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Set type')?.submenu?.items.map((i) => i.titleText)).toContain('Deliverable');

		harness.view.setProjection('board');
		cardByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const onBoard = Menu.lastShown?.item('Set type')?.submenu?.items.map((i) => i.titleText);
		expect(onBoard).not.toContain('Deliverable');
		// Withheld, not emptied: every other declared type is still offered.
		expect(onBoard).toContain('Bug');
	});

	it('keeps the PRIMARY New button off Deliverable too, under an inherited Deliverable focus', () => {
		// `newItemType` follows the FOCUS target, so a Deliverable focus left active from
		// another projection made the button read "New Deliverable" on the requirements
		// board while the chevron beside it had already withheld that type — a narrower
		// list is decoration if the button beside it does not draw from it.
		const harness = makeView(vaultWithBoth(), CONFIG, { focus: 'Deliverable' });
		const { containerEl } = harness;
		const primary = () => containerEl.querySelector('.pbl-new-btn')?.textContent;

		expect(primary()).toBe('New Deliverable');

		harness.view.setProjection('board');
		expect(primary()).toBe('New Epic');
	});

	it('withholds New Deliverable from a card’s own child creator too', () => {
		// `childTypeChoices` answers about the LADDER — a PBI holds Deliverables — and
		// that is a different question from what this board can show. Found by review:
		// filtering Set type alone left every Epic/Feature/PBI card offering
		// "New Deliverable", the same creation path the toolbar's filter closes.
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'In progress' } });
		const harness = makeView(vault, CONFIG);
		const { containerEl } = harness;

		rowByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('New Deliverable')).toBeDefined();

		harness.view.setProjection('board');
		cardByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('New Deliverable')).toBeUndefined();
		// Withheld, not emptied: the ladder's own child and the other extras remain.
		expect(Menu.lastShown?.item('New Task')).toBeDefined();
		expect(Menu.lastShown?.item('New Bug')).toBeDefined();
	});

	it('never reports a board with no requirements work as "all done"', () => {
		// The advisory was asked of `model.results`, which counts the very Deliverables
		// this board excludes — so a base of Deliverables alone read "All 2 items are
		// done and hidden" beside a "Show completed items" button that would change
		// nothing. Asked of the board's own population it is simply empty.
		const vault = new FakeVault();
		vault.addFile('D1.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('D2.md', { frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' } });
		const harness = makeView(vault, CONFIG);
		harness.view.setProjection('board');

		const advisory = harness.containerEl.querySelector('.pbl-board-advisory')?.textContent ?? '';
		expect(advisory).not.toContain('done and hidden');
		expect(advisory).toContain('No backlog items');
	});

	it('explains a Deliverable focus rather than offering to create another', () => {
		// Every focus root is a type this board excludes, so it is empty by construction.
		// The ordinary empty state would name the focused type and offer a "New
		// Deliverable" CTA — a fifth surface offering the one type this board cannot show.
		const harness = makeView(vaultWithBoth(), CONFIG, { focus: 'Deliverable' });
		harness.view.setProjection('board');
		const advisory = harness.containerEl.querySelector('.pbl-board-advisory');

		expect(advisory?.textContent).toContain('Deliverables are managed on their own board');
		expect(advisory?.textContent).not.toContain('New Deliverable');
		// The way out is the focus, so that is the button.
		const btn = advisory?.querySelector('button');
		expect(btn?.textContent).toBe('Show all types');
		btn?.click();
		expect(harness.view.settings.focusLevel).toBe('');
	});

	it('withholds Deliverable from the focus picker on the board', () => {
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;
		const focusChoices = () => {
			containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.click();
			return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		};

		expect(focusChoices()).toContain('Deliverable');

		harness.view.setProjection('board');
		// Focusing it here narrows the board to roots it excludes — an empty board
		// reachable in one click. Withheld at the source; an inherited one still reads
		// in the button with the clear beside it.
		expect(focusChoices()).not.toContain('Deliverable');
		expect(focusChoices()).toContain('Bug');
	});

	it('withholds New Deliverable from the toolbar’s type picker on the board', () => {
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;
		const pickTitles = () => {
			containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.click();
			return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		};

		expect(pickTitles()).toContain('New Deliverable');

		harness.view.setProjection('board');
		expect(pickTitles()).not.toContain('New Deliverable');
		expect(pickTitles()).toContain('New Bug');
	});
});

describe('the quick filter reaches every Deliverable, focus or no focus', () => {
	/** A Deliverable hanging off the Epic, so a `Feature` focus never walks to it. */
	function outsideFocus(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Widget.md', {
			frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' },
			parentLink: 'Epic',
		});
		return vault;
	}

	it('keeps a matching Deliverable outside the focused subtree', () => {
		// `FilterState.recompute` walked `model.roots`, which a focus narrows — while this
		// board's population is `model.deliverableResults`, built from the whole unfocused
		// tree. So the card rendered fine until anything was typed and then vanished, its
		// path never having been indexed: the focus restriction this board exists to
		// ignore, reintroduced by the filter.
		const harness = makeView(outsideFocus(), CONFIG, { focus: 'Feature' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;
		expect(cardByTitle(containerEl, 'Widget')).toBeDefined();

		harness.view.setFilter('Widget');
		expect(cardByTitle(containerEl, 'Widget')).toBeDefined();
	});

	it('still hides a Deliverable the filter does not match', () => {
		// The other direction, so a fix that simply indexed everything as visible fails
		// this as loudly as the bug failed the one above.
		const harness = makeView(outsideFocus(), CONFIG, { focus: 'Feature' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		harness.view.setFilter('nothing matches this');
		expect(containerEl.querySelectorAll('.pbl-card').length).toBe(0);
	});
});

describe('the requirements board draws no column only a Deliverable could fill', () => {
	it('keeps a Deliverable-only state out of the UNCONFIGURED workflow’s columns', () => {
		// With no `stateValues` declared the columns fall back to the observed values, and
		// that fallback read `model.observedStates` — every result, Deliverables included.
		// So a value only a Deliverable carried opened a column on a board that excludes
		// every card that could ever sit in it. Scoping the stray pass alone left this
		// open: it is the same defect through the other door.
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'In progress' } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 20, status: 'Shipped' } });
		const harness = makeView(vault, { stateProperty: 'note.status' });
		harness.view.setProjection('board');

		const columns = [...harness.containerEl.querySelectorAll('.pbl-board-col-name')].map((el) => el.textContent);
		expect(columns).toContain('In progress');
		expect(columns).not.toContain('Shipped');
	});
});

describe('a match keeps its whole subtree, focus or no focus', () => {
	function underAnEpic(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Widget Platform.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feat.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Widget Platform' });
		vault.addFile('Spec.md', {
			frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' },
			parentLink: 'Widget Platform',
		});
		return vault;
	}
	const cards = (containerEl: HTMLElement) => containerEl.querySelectorAll('.pbl-card').length;

	it('keeps a Deliverable whose out-of-focus ANCESTOR matched', () => {
		// The filter contract is a match plus its whole subtree, and this board ignores
		// the focus level — so typing the Epic's title has to keep its Deliverable either
		// way. Indexing each missed Deliverable in isolation kept it unfocused and dropped
		// it under a focus: the same focus-dependence one layer up from the last fix.
		const unfocused = makeView(underAnEpic(), CONFIG);
		unfocused.view.setProjection('deliverables');
		unfocused.view.setFilter('Widget');
		expect(cards(unfocused.containerEl)).toBe(1);

		const focused = makeView(underAnEpic(), CONFIG, { focus: 'Feature' });
		focused.view.setProjection('deliverables');
		focused.view.setFilter('Widget');
		expect(cards(focused.containerEl)).toBe(1);
	});

	it('still drops one no ancestor and nothing below it matched', () => {
		const focused = makeView(underAnEpic(), CONFIG, { focus: 'Feature' });
		focused.view.setProjection('deliverables');
		focused.view.setFilter('nothing matches this');
		expect(cards(focused.containerEl)).toBe(0);
	});
});

describe('the Deliverables filter pass never writes a focused row', () => {
	/** A Task under a Deliverable: under Task focus the Task is a focus ROOT while its
	 *  Deliverable parent is not, so the pass meets the focused forest from below. */
	function taskUnderDeliverable(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Handbook.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('Write it.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Handbook' });
		return vault;
	}

	it('keeps the Deliverable card without revealing its focused Task', () => {
		const harness = makeView(taskUnderDeliverable(), CONFIG, { focus: 'Task' });
		const { containerEl } = harness;
		harness.view.setFilter('Handbook');

		// The tree is the focused forest, and nothing in it matched — marking the
		// Deliverable's subtree freely would put this Task on screen for a match the
		// user cannot even see, since the Deliverable itself is not rendered here.
		expect(containerEl.querySelectorAll('.pbl-row').length).toBe(0);

		// The board it was all for still keeps the card.
		harness.view.setProjection('deliverables');
		expect(containerEl.querySelectorAll('.pbl-card').length).toBe(1);
	});

	it('still shows the focused Task when the TASK is what matched', () => {
		const harness = makeView(taskUnderDeliverable(), CONFIG, { focus: 'Task' });
		const { containerEl } = harness;
		harness.view.setFilter('Write');
		expect(containerEl.querySelectorAll('.pbl-row').length).toBe(1);
	});
});

describe('the two scopes, at the cases one index kept missing', () => {
	/** Epic > PBI > (Deliverable), and Epic > Deliverable — so a focus can land above,
	 *  below or beside the Deliverable depending on the level chosen. */
	function deepTree(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Widget Platform.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature X.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Widget Platform' });
		vault.addFile('Slice.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature X' });
		vault.addFile('Manual.md', {
			frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' },
			parentLink: 'Slice',
		});
		vault.addFile('Chapter.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Manual' });
		return vault;
	}
	const cards = (el: HTMLElement) => el.querySelectorAll('.pbl-card').length;
	const board = (focus?: string) => {
		const harness = makeView(deepTree(), CONFIG, focus ? { focus } : {});
		harness.view.setProjection('deliverables');
		return harness;
	};

	it('keeps an IN-focus Deliverable whose ancestor ABOVE the focus root matched', () => {
		// Under PBI focus the Deliverable is inside the focused forest, so a pass that
		// skipped everything already indexed never asked whether the Epic above the focus
		// root matched. The `whole` index has no such boundary: the Epic matches and its
		// whole subtree comes with it.
		expect(cards(board().containerEl)).toBe(1);
		const focused = board('PBI');
		focused.view.setFilter('Widget');
		expect(cards(focused.containerEl)).toBe(1);
	});

	it('keeps a Deliverable whose DESCENDANT across the focus boundary matched', () => {
		// Under Task focus the Task is a focus root and its Deliverable parent is not, so
		// a guarded pass stopped at the boundary and never learned the Task had matched —
		// dropping the card that is meant to expose matches below it.
		const focused = board('Task');
		focused.view.setFilter('Chapter');
		expect(cards(focused.containerEl)).toBe(1);
	});

	it('still hides a Deliverable nothing in its line matched', () => {
		const focused = board('PBI');
		focused.view.setFilter('nothing matches this');
		expect(cards(focused.containerEl)).toBe(0);
	});
});

describe('the Deliverables board offers only the type it can show', () => {
	it('withholds New Task and Set type from a Deliverable card', () => {
		// The other half of the rule the requirements board already keeps. A Task created
		// from here is legitimate work that this board cannot draw, so it vanishes on the
		// pass that writes it — exactly what `New Deliverable` did on the board next door.
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;

		rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('New Task')).toBeDefined();
		expect(Menu.lastShown?.item('Set type')).toBeDefined();

		harness.view.setProjection('deliverables');
		cardByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('New Task')).toBeUndefined();
		// Absent rather than inert: the only offerable type is the one the card carries,
		// so every entry the submenu could hold would write nothing.
		expect(Menu.lastShown?.item('Set type')).toBeUndefined();
		// Still a menu — the state and navigation entries are untouched.
		expect(Menu.lastShown?.item('Set state')).toBeDefined();
		expect(Menu.lastShown?.item('Open in new tab')).toBeDefined();
	});
});

describe('the Deliverables board can be set up from its own empty state', () => {
	it('offers the setup button when only the SHARED property is adoptable', () => {
		// A fresh view: `adoptableProperties` gives `status` to `state` first and drops
		// `deliverableState` as a duplicate suggestion, so naming only the Deliverable
		// field hid the press that would configure this board through the fallback —
		// guidance naming an option while withholding the button that sets it.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const harness = makeView(vault, {});
		harness.view.setProjection('deliverables');

		const empty = harness.containerEl.querySelector('.pbl-empty');
		expect(empty?.textContent).toContain('No workflow to show');
		expect(empty?.querySelector('button')?.textContent).toContain('Add the default properties');
		// The press binds `status` to the REQUIREMENTS property here, so the hint has to
		// name that one too: guidance naming only the Deliverable property sends the user
		// looking for a setting the button they just pressed did not touch.
		expect(empty?.textContent).toContain('"Deliverable state property"');
		expect(empty?.textContent).toContain('"State property"');
	});

	it('withholds it when the shared property was deliberately CLEARED', () => {
		// Clearing an option is a decision, and `adoptableProperties` asks the config
		// rather than the settings precisely so this stays true.
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const harness = makeView(vault, noOptionalProperties());
		harness.view.setProjection('deliverables');

		const empty = harness.containerEl.querySelector('.pbl-empty');
		expect(empty?.textContent).toContain('No workflow to show');
		expect(empty?.querySelector('button')).toBeNull();
	});
});

describe('the toolbar counts one population, not two', () => {
	/** A done Deliverable beside open requirements work. */
	function doneDeliverable(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'In progress' } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 20, status: 'Done', docStatus: 'Draft' } });
		return vault;
	}
	// Completed items HIDDEN — the suffix only exists while the toggle offers to show them.
	const CONFIG_DONE = { ...CONFIG, doneValues: 'Done', showCompleted: false };

	it('never offers to reveal a hidden card the requirements board would not show', () => {
		// `subtreeDone` is the requirements workflow's, and this Deliverable satisfies it —
		// but it is not a card here at all, so counting it offered to reveal something
		// pressing the button cannot produce. The label beside it was already scoped; the
		// toggle was not, so the two readouts disagreed about the same board.
		const harness = makeView(doneDeliverable(), CONFIG_DONE);
		const { containerEl } = harness;
		const toggleLabel = () => containerEl.querySelector('.pbl-completed-toggle')?.getAttribute('aria-label');

		// The tree counts every result, so it still names the hidden Deliverable.
		expect(toggleLabel()).toContain('(1 hidden)');

		harness.view.setProjection('board');
		expect(toggleLabel()).not.toContain('hidden');
	});

	it('paints the FIRST render’s count and tooltip from the same population syncCountLabel uses', () => {
		// `renderToolbar` used to count `model.results` directly instead of calling
		// `countedPopulation` like `syncCountLabel` and `renderCompletedToggle` — a second
		// source of truth that painted an unscoped number the very next line corrected.
		// Calling the two functions directly (instead of going through the full render
		// pipeline) is what makes the first paint observable at all: `render()` calls
		// `syncCountLabel` synchronously right after `renderToolbar`, so nothing ever
		// shows the intermediate DOM otherwise.
		const harness = makeView(doneDeliverable(), CONFIG);
		harness.view.setProjection('board');

		const scratch = document.createElement('div');
		renderToolbar(harness.view, scratch);
		const firstText = scratch.querySelector('.pbl-count-label')?.textContent;
		const firstTooltip = (scratch.querySelector('.pbl-count-label') as HTMLElement | null)?.dataset.tooltip;

		syncCountLabel(harness.view, scratch);
		const syncedText = scratch.querySelector('.pbl-count-label')?.textContent;
		const syncedTooltip = (scratch.querySelector('.pbl-count-label') as HTMLElement | null)?.dataset.tooltip;

		// The requirements board excludes the Deliverable, so the correct answer is "1
		// item" (the PBI alone) — a regression would paint "2 items" here first.
		expect(firstText).toBe('1 item');
		expect(firstText).toBe(syncedText);
		// Anchored absolutely, not only against `syncCountLabel`: agreeing with a readout
		// that itself regressed is agreement about the wrong number.
		expect(firstTooltip).toBe('1 PBI');
		expect(firstTooltip).toBe(syncedTooltip);
	});
});

describe('a context Deliverable is never a source of this board’s vocabulary', () => {
	it('mints no column from an excluded ancestor’s own state', () => {
		// The root context-row rule: an `outsideFilter` row is never a source of anything
		// derived from the Base's results, state vocabulary included. `firstSeen` already
		// enforces it for every collector, so this pins the behaviour rather than fixing
		// it — the case is easy to reintroduce by collecting outside that helper.
		const vault = new FakeVault();
		vault.addFile('Old handbook.md', { frontmatter: { type: 'Deliverable', order: 10, docStatus: 'Archived' } });
		vault.addFile('Live spec.md', { frontmatter: { type: 'Deliverable', order: 20, docStatus: 'Draft' } });
		const harness = makeView(vault, CONFIG);
		// The excluded ancestor is in the vault and out of the Base's results.
		const anyView = harness.view as unknown as Record<string, unknown>;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Old handbook.md') };
		harness.view.onDataUpdated();
		harness.view.setProjection('deliverables');

		const columns = [...harness.containerEl.querySelectorAll('.pbl-board-col-name')].map((el) => el.textContent);
		expect(columns).toContain('Draft');
		expect(columns).not.toContain('Archived');
	});
});
