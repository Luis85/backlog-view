// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, refresh, useViewHarness } from '../helpers/view';

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
