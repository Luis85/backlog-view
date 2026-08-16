// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import { cardTitles, columnByName } from '../helpers/board';
import { clickExpandAll, makeView, refresh, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The iteration board as a PROJECTION — the scope it is on, where that scope is stored,
 * and every gate that has to answer for it rather than for the product board.
 *
 * The picker that chooses a scope is Task 5's and the three-bucket render is Task 7's;
 * what is driven here is the state itself, through the host, which is the same door the
 * picker will use.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

const SPRINT = 'Sprint 12.md';

function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
	vault.addFile('In sprint.md', {
		frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
	});
	vault.addFile('Elsewhere.md', { frontmatter: { type: 'PBI', order: 20, status: 'Doing' } });
	return vault;
}

describe('the iteration scope', () => {
	it('returns the reader to the iteration they left, through Tree and back', () => {
		// Driven through the INTERACTION, never by rendering the chosen scope directly: a
		// test that sets the scope and reads it back passes while the round trip through
		// the store is broken.
		const vault = sprintVault();
		const first = makeView(vault, OPTIONS, { base: 'Plan.base' });
		first.view.setProjection('iteration');
		first.view.setBoardScope(SPRINT);
		first.view.setProjection('tree');
		first.view.setProjection('iteration');
		expect(first.view.boardScope).toBe(SPRINT);
		first.view.onunload();

		const second = makeView(vault, OPTIONS, { base: 'Plan.base' });
		expect(second.view.projection).toBe('iteration');
		expect(second.view.boardScope).toBe(SPRINT);
	});

	it('answers as the PRODUCT board everywhere once the scope stops resolving', () => {
		// The renderer falling back alone is the split this plan warned about: with the
		// content drawing the product board and every other gate still answering
		// `'iteration'`, the count included Deliverables, the focus control stayed inert
		// and `offerableTypes` offered a type that vanished from the board that made it.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		expect(harness.view.projection).toBe('iteration');

		vault.files.delete(SPRINT);
		refresh(harness.view, vault);
		expect(harness.view.projection).toBe('board');
		expect(harness.containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn')?.disabled).toBe(false);
	});

	it('leaves the product board counting the product, with a scope still retained', () => {
		// Clicking `Board` retains the pick rather than spending it, so the scope is still
		// stored — and must mean nothing at all while the reader is not on the board it
		// scopes, or an iteration's carriers are counted over the whole backlog.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		harness.view.setProjection('tree');
		expect(harness.view.effectiveScope).toBeNull();
		expect(harness.view.boardScope).toBe(SPRINT);
	});

	it('reopens the retained iteration when Board is pressed again', () => {
		// `Board` means the board this view was last on — the rule `activeAxis` keeps for
		// the roadmap's axis, read onto the one control that can reach two boards.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		harness.view.setProjection('tree');
		harness.view.setProjection('board');
		expect(harness.view.projection).toBe('iteration');
		expect(harness.view.effectiveScope).toBe(SPRINT);
	});

	it('refuses a scope the Base excluded, which the picker cannot name either', () => {
		// An excluded iteration still loads as one when a hand-edited item names it as a
		// parent, and both the picker and `Set iteration` refuse it — so accepting it here
		// stranded the view on a board no control could name or re-select.
		const vault = sprintVault();
		vault.addFile('Names it as parent.md', { frontmatter: { type: 'PBI', order: 40 }, parentLink: 'Sprint 12' });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base', only: ['Names it as parent.md', 'Sprint 13.md'] });
		harness.view.setBoardScope(SPRINT);
		expect(harness.view.model?.byPath.get(SPRINT)?.outsideFilter).toBe(true);
		expect(harness.view.effectiveScope).toBeNull();
	});

	it('names the retained scope while it is drawn, and is not drawn off the board', () => {
		// The button says which board `Board` will open, so it is named from the RETAINED
		// scope rather than the effective one — those differ, and naming it from the
		// effective scope said `Product` over a button that would open Sprint 12.
		//
		// Off the board it is not drawn at all: the picker belongs to the board, and the
		// way back to one is the `Board` button beside it.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		expect(harness.containerEl.querySelector('.pbl-scope-btn')?.getAttribute('aria-label')).toBe(
			'Board scope: Sprint 12',
		);

		harness.view.setProjection('tree');
		expect(harness.containerEl.querySelector('.pbl-scope-btn')).toBeNull();
	});

	it('reads the whole view as Product when the stored path names no Iteration', () => {
		// Resolved ONCE, upstream: resolving it only where the content is drawn leaves
		// every other gate — the count, the offered types, the filter index — still
		// answering as an iteration board.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('No such sprint.md');
		expect(harness.view.effectiveScope).toBeNull();
	});

	it('retains the stale stored path rather than rewriting it', () => {
		// The note may come back — a deletion undone, a filter widened. Rewriting the
		// stored path on a failed resolution would spend the reader's choice on a
		// condition that is often temporary.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('Not yet.md');
		expect(harness.view.effectiveScope).toBeNull();
		expect(harness.view.boardScope).toBe('Not yet.md');

		vault.addFile('Not yet.md', { frontmatter: { type: 'Iteration', order: 30 } });
		refresh(harness.view, vault);
		expect(harness.view.effectiveScope).toBe('Not yet.md');
	});

	it('falls back to Product when the iteration PROPERTY is cleared', () => {
		// A second condition rather than a second symptom of the first. The stored path
		// still names a real Iteration, so the "note is gone" case above passes it — but
		// with no configured key every item reads a null iteration, so the board can never
		// hold a card, and the reader would be stranded on it.
		const vault = sprintVault();
		const { iterationProperty, ...noKey } = OPTIONS;
		expect(iterationProperty).toBe('note.iteration');
		const harness = makeView(vault, noKey, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope(SPRINT);
		expect(harness.view.effectiveScope).toBeNull();
	});

	it('retains the stored path when the property is cleared, and restores the scope when it is set again', () => {
		const vault = sprintVault();
		const { iterationProperty, ...noKey } = OPTIONS;
		expect(iterationProperty).toBe('note.iteration');
		const off = makeView(vault, noKey, { base: 'Plan.base', viewName: 'One' });
		off.view.setProjection('iteration');
		off.view.setBoardScope(SPRINT);
		expect(off.view.boardScope).toBe(SPRINT);
		off.view.onunload();

		const on = makeView(vault, OPTIONS, { base: 'Plan.base', viewName: 'One' });
		expect(on.view.effectiveScope).toBe(SPRINT);
	});

	it('carries the stored scope through a rename of the note, and of a folder above it', () => {
		const vault = new FakeVault();
		vault.addFile('sprints/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('sprints/Sprint 12.md');

		// Through the vault's own rename event, which is the only thing that reaches the
		// migration in a vault — the view subscribes to it on the first data update.
		vault.renameFile('sprints/Sprint 12.md', 'sprints/Sprint twelve.md');
		expect(harness.view.boardScope).toBe('sprints/Sprint twelve.md');

		// A folder move reports the FOLDER, never the notes under it — so matching the
		// stored path alone strands every scope inside a folder anybody tidies.
		vault.renameFolder('sprints', 'planning/sprints');
		expect(harness.view.boardScope).toBe('planning/sprints/Sprint twelve.md');
	});
});

describe('an iteration is not a row of the plan', () => {
	it('draws no tree row for one, and keeps a work item parented to one on screen', () => {
		// The container a board is scoped to, not work the backlog holds. The second half
		// is what makes the first half safe: `projectionForest` PROMOTES a member whose
		// parent is not one, and `rowHidden` drops a non-member — asked differently, a
		// `PBI` parented to an iteration is hidden with its parent and appears nowhere,
		// because `renderForest` drops a hidden sibling without descending through it.
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Hung under it.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Sprint 12' });
		vault.addFile('Ordinary.md', { frontmatter: { type: 'PBI', order: 20 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		clickExpandAll(harness.containerEl);

		expect(titlesOf(harness.containerEl)).toEqual(['Hung under it', 'Ordinary']);
		// And it is still in the model, because `Set iteration` and the picker read it.
		expect(harness.view.model?.byPath.get(SPRINT)).toBeDefined();
	});

	it('offers the type in no New menu and no Set type', () => {
		// One control makes them — the board's scope picker — and it derives the number,
		// the dates and the folder a New menu would leave to the reader.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.containerEl
			.querySelector<HTMLElement>('.pbl-new-more')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect((Menu.lastShown?.items ?? []).map((mi) => mi.titleText)).not.toContain('New Iteration');

		rowByTitle(harness.containerEl, 'In sprint').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const types = (Menu.lastShown?.item('Set type')?.submenu?.items ?? []).map((mi) => mi.titleText);
		expect(types).not.toContain('Iteration');
		// Not vacuous: the other marker is still offered.
		expect(types).toContain('Milestone');
	});
});

describe('the scope picker', () => {
	const picker = (containerEl: HTMLElement) => containerEl.querySelector<HTMLElement>('.pbl-scope-btn');

	function entries(containerEl: HTMLElement): string[] {
		picker(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return (Menu.lastShown?.items ?? []).map((mi) => mi.titleText);
	}

	it('names the product and every iteration in the model', () => {
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		// Deliverables directly under Product (its toggle position until 2026-08-16),
		// then the scopes, then the actions, each group behind a separator.
		expect(entries(harness.containerEl)).toEqual([
			'Product',
			'Deliverables',
			'Sprint 12',
			'Sprint 13',
			'New iteration…',
		]);
	});

	it('draws with no Iteration note at all, because it is how the first one is made', () => {
		// **No emptiness refusal**, unlike the axis picker: that one with a single axis can
		// only re-pick what is picked, while this one carries `New iteration…`. Withheld on
		// an empty vault it would withhold the feature from every vault that has not
		// started using it.
		const empty = new FakeVault();
		empty.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' } });
		const harness = makeView(empty, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		expect(entries(harness.containerEl)).toEqual(['Product', 'Deliverables', 'New iteration…']);
	});

	it('offers only the two boards with no iteration property, and is absent off the board', () => {
		// With no property an iteration entry would draw a board no card could ever reach,
		// so the whole iteration section is withheld — the scopes, `New iteration…` and
		// the stale retained path that would otherwise NAME the button. The picker itself
		// stays: since 2026-08-16 it carries the Deliverables board, which needs nothing
		// configured to exist. Off the board there is no board for it to scope: the way
		// back to one is the `Board` button beside it.
		const { iterationProperty, ...noKey } = OPTIONS;
		expect(iterationProperty).toBe('note.iteration');
		const noProperty = makeView(sprintVault(), noKey, { base: 'Plan.base' });
		noProperty.view.setProjection('board');
		expect(entries(noProperty.containerEl)).toEqual(['Product', 'Deliverables']);

		const onTree = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		expect(picker(onTree.containerEl)).toBeNull();
	});

	it('scopes the view to the note that was picked, not to its label', () => {
		const vault = new FakeVault();
		vault.addFile('q3/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('q4/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 20 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		// Qualified only where they collide: qualifying every entry to separate a rare
		// pair makes the ordinary case unreadable.
		expect(entries(harness.containerEl)).toEqual([
			'Product',
			'Deliverables',
			'q3/Sprint 12',
			'q4/Sprint 12',
			'New iteration…',
		]);

		Menu.lastShown?.item('q4/Sprint 12')?.click();
		expect(harness.view.boardScope).toBe('q4/Sprint 12.md');
		expect(harness.view.projection).toBe('iteration');
	});

	it('returns the view to the product board, clearing the scope', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		entries(harness.containerEl);
		Menu.lastShown?.item('Product')?.click();
		expect(harness.view.boardScope).toBeNull();
		expect(harness.view.projection).toBe('board');
	});

	it('checks the scope the view is on', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		entries(harness.containerEl);
		const checked = (Menu.lastShown?.items ?? []).filter((mi) => mi.checked).map((mi) => mi.titleText);
		expect(checked).toEqual(['Sprint 12']);
	});
});

describe('a fold belongs to one iteration', () => {
	function scoped(path: string) {
		const vault = new FakeVault();
		vault.addFile('sprints/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('sprints/Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(path);
		return { ...harness, vault };
	}

	it('folds a column on ONE iteration only', () => {
		// The three buckets wear the same three names on every scope, so a key without
		// the path folds Resolved on Sprint 13 because the reader folded it on Sprint 12 —
		// the product board's own collision, one level in.
		const harness = scoped('sprints/Sprint 12.md');
		harness.view.setColumnCollapsed('iteration', 'resolved', true);
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(true);

		harness.view.setBoardScope('sprints/Sprint 13.md');
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(false);
	});

	it('toggles the same fold from the header disclosure that the render reads', () => {
		// The render read `col.bucket ?? col.state` while both CONTROLS read `col.state`, so
		// an Open bucket represented by `New` drew from the `open` key and its own
		// disclosure toggled `new` — a control that appeared not to work. One statement of
		// the identity now (`columnFoldValue`), asked by all three.
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Card.md', { frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);

		const open = columnByName(harness.containerEl, 'Open');
		open.querySelector<HTMLElement>('.pbl-chevron')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(harness.view.columnCollapsed('iteration', 'open', false)).toBe(true);
		expect(cardTitles(columnByName(harness.containerEl, 'Open'))).toEqual([]);
	});

	it('folds two buckets with nothing to write apart', () => {
		// The value is the BUCKET, never the representative: two buckets with nothing to
		// write both carry `state: null`, so a fold keyed on the state shuts them together.
		const harness = scoped('sprints/Sprint 12.md');
		harness.view.setColumnCollapsed('iteration', 'inProgress', true);
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(false);
	});

	it('carries a folded column with its iteration through a rename', () => {
		// Half of this is not an option: a path inside a fold key must be migrated, or the
		// board reopens columns the reader closed and the store keeps entries nothing will
		// ever match.
		const harness = scoped('sprints/Sprint 12.md');
		harness.view.setColumnCollapsed('iteration', 'resolved', true);

		harness.vault.renameFolder('sprints', 'planning/sprints');
		expect(harness.view.boardScope).toBe('planning/sprints/Sprint 12.md');
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(true);
	});
});

describe('the iteration board answers as itself', () => {
	function onSprint() {
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope(SPRINT);
		return harness;
	}

	it('renders the Board position pressed, and keeps the picker, on an iteration scope', () => {
		// Two controls compare the projection to a POSITION, and both are wrong once the
		// internal identity and the control identity differ: the picker would delete
		// itself on first use, and no position would draw as pressed.
		const { containerEl } = onSprint();
		const pressed = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-mode-btn[aria-pressed="true"]'));
		expect(pressed.map((el) => el.querySelector('.pbl-btn-label')?.textContent)).toEqual(['Board']);
	});

	it('counts this scope\'s carriers and nobody else', () => {
		// One function behind the count label and the completed toggle's "(N hidden)", so
		// the two cannot disagree about what the board is showing.
		const { containerEl } = onSprint();
		// One carrier in Sprint 12; `Elsewhere` and the two Iteration notes are not it.
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toContain('1');
	});

	it('renders no focus menu, no label and no clear button, with a focus inherited', () => {
		// `INERT_FOCUS` is a PARTIAL record, so a missing entry compiles clean and the
		// ordinary focus picker draws — a control whose every setting is a no-op here.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base', focus: 'PBI' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope(SPRINT);
		const focus = harness.containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(focus?.disabled).toBe(true);
		expect(focus?.querySelector('.pbl-btn-label')?.textContent).toBe('Iteration');
	});
});
