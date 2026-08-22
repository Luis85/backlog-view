// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { flush, makeView, refresh, submitButton, useViewHarness } from '../helpers/view';
import { laneRoadmap } from '../helpers/roadmap';
import { promptNewResource } from '../../src/view/interactions/resourceNotes';

useViewHarness();

/**
 * Making a `Resource` note from the roadmap's resources axis: the prompt, its two config
 * gates, the folder ladder, and the consequence [[A resource is not a backlog item]]
 * already guarantees — a created note draws nowhere.
 *
 * There is no on-screen control yet (Task 4 wires the toolbar button), so every test
 * calls `promptNewResource(host)` directly, the same way it will be called once that
 * control exists.
 */

/** Type a name into the open prompt and press its call to action. */
function submitResource(name: string): void {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('prompt not opened');
	const input = modal.contentEl.querySelector('input');
	if (!input) throw new Error('no name field');
	input.value = name;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('creating a resource', () => {
	it('writes one note carrying only the type key, in the configured resource folder', async () => {
		const vault = new FakeVault();
		const { view } = makeView(vault, { resourceFolder: 'People' });

		promptNewResource(view);
		submitResource('Alex');
		await flush();

		expect(vault.fm('People/Alex.md')).toEqual({ type: 'Resource' });
	});

	it('falls back to the home folder when the resource folder is cleared', async () => {
		const vault = new FakeVault();
		const { view } = makeView(vault, { resourceFolder: '', homeFolder: 'notes' });

		promptNewResource(view);
		submitResource('Alex');
		await flush();

		expect(vault.fm('notes/Alex.md')['type']).toBe('Resource');
	});

	it('is blocked by the config gate before the form opens', () => {
		const vault = new FakeVault();
		const { view } = makeView(vault, { orderProperty: 'note.parent' });

		promptNewResource(view);

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('re-asks the gate at submit, so a config narrowed under the open form writes nothing', async () => {
		// The render gate withholds the toolbar control (Task 4), but the form outlives the
		// config it opened under — Obsidian's options pane stays reachable while a modal is
		// up — the same reason `promptAddAbsence`'s own gate is asked twice.
		const vault = new FakeVault();
		const harness = makeView(vault, {});
		const before = vault.files.size;

		promptNewResource(harness.view);
		harness.config.values['orderProperty'] = 'note.parent';
		refresh(harness.view, vault);
		submitResource('Alex');
		await flush();

		expect(vault.files.size).toBe(before);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('writes nothing on cancel', async () => {
		const vault = new FakeVault();
		const { view } = makeView(vault, {});
		const before = vault.files.size;

		promptNewResource(view);
		Modal.lastOpened?.close();
		await flush();

		expect(vault.files.size).toBe(before);
	});

	it('reports the note’s own name, which may differ from what was typed', async () => {
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		const { view } = makeView(vault, { resourceFolder: '', homeFolder: '' });

		promptNewResource(view);
		submitResource('Alex');
		await flush();

		expect(vault.files.has('Alex 1.md')).toBe(true);
		expect(Notice.messages).toContain('Created the resource "Alex 1".');
	});

	it('warns on a name already in the roster, and creates the note anyway', async () => {
		// 3a: guides rather than arbitrates. `known` is the drawn roadmap lanes (skipping
		// the markers lane), the declared `resourceNames` and every observed assignee,
		// merged case-insensitively — `assigneeChoices`' own three sources.
		const vault = new FakeVault();
		const harness = laneRoadmap(vault, { resourceFolder: '', homeFolder: '' });

		promptNewResource(harness.view);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no name field');
		const warningEl = () => modal.contentEl.querySelector('.pbl-modal-warning');

		input.value = 'alice';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(warningEl()?.textContent).toBe('Someone with this name is already on the roster.');

		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('alice.md')['type']).toBe('Resource');
	});

	it('warns on a name drawn only from an absence, with no item assigned and no declared entry', () => {
		// The DRAWN-LANE term, isolated from BOTH the others: `deriveLanes` mints a lane
		// for an absence's subject even with nothing assigned to them (the absence pass in
		// `deriveLanes`, `laneNamed(absence.resource, ...)`), while `collectObservedAssignees`
		// only reads `item.assigneeValue` over the plan's ITEMS and never sees an `Absence`
		// note at all (it is excluded from `items` the same way a `Resource` is). An
		// undeclared, unassigned name reachable only through an absence is the one case that
		// cannot pass through `resourceNames` or `observedAssignees` by accident — an
		// undeclared ASSIGNEE (tried first here and reverted) is drawn by `deriveLanes` too,
		// but `collectObservedAssignees` reads that same item's `assigneeValue`, so deleting
		// either term alone still left it green.
		const vault = new FakeVault();
		vault.addFile('Dana is away.md', {
			frontmatter: { type: 'Absence', assignee: 'Dana', start: '2026-08-10', due: '2026-08-14' },
		});
		const harness = laneRoadmap(vault, { resourceFolder: '', homeFolder: '' });

		promptNewResource(harness.view);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no name field');
		const warningEl = () => modal.contentEl.querySelector('.pbl-modal-warning');

		input.value = 'dana';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(warningEl()?.textContent).toBe('Someone with this name is already on the roster.');
	});

	it('warns on a name observed only on an undated (shelved) item, with no lane drawn for it', () => {
		// The OBSERVED-ASSIGNEE term, isolated: `placeAssigned` → `placeBar` shelves an
		// undated item WITHOUT calling the lane thunk (`placeBar`'s own `if (placement.kind
		// === 'shelf') { …; return; }`, before `lane()` runs), so Erin never mints a row —
		// `assignableLanes` cannot see them. `collectObservedAssignees` has no such gate: it
		// reads every plan item's `assigneeValue` regardless of placement, dated or not.
		const vault = new FakeVault();
		vault.addFile('Untimed work.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Erin' } });
		const harness = laneRoadmap(vault, { resourceFolder: '', homeFolder: '' });

		promptNewResource(harness.view);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no name field');
		const warningEl = () => modal.contentEl.querySelector('.pbl-modal-warning');

		input.value = 'erin';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(warningEl()?.textContent).toBe('Someone with this name is already on the roster.');
	});

	it('warns on a name only in the declared roster, with no roadmap drawn to draw a lane at all', () => {
		// The DECLARED half of `known`, isolated: with no roadmap render `host.roadmap` is
		// null (`assignableLanes` answers `[]`), so nothing is drawn — the case a union
		// built from the drawn lanes alone cannot warn against.
		const vault = new FakeVault();
		const { view } = makeView(vault, { resourceNames: 'Alice, Bob' });

		promptNewResource(view);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no name field');
		const warningEl = () => modal.contentEl.querySelector('.pbl-modal-warning');

		input.value = 'alice';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(warningEl()?.textContent).toBe('Someone with this name is already on the roster.');
	});

	it('produces no item, no row and no count once the base returns it', async () => {
		// The consequence [[A resource is not a backlog item]] guarantees, driven from this
		// use case's own acceptance criterion rather than restated as a second rule: the
		// gate in `readItems` is what refuses it, not anything here.
		//
		// `hierarchyOnly: false` is what makes this test able to fail: ON (the shipped
		// default), a parentless, untyped-to-this-vocabulary note is ALSO dropped by
		// `pruneOutsideHierarchy`'s scope prune, so a check written without this override
		// would pass with the readItems gate deleted — `test/domain/itemTypes.test.ts`'s own
		// "produces NO item" test states the same trap.
		const vault = new FakeVault();
		vault.addFile('Onboarding.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { view, containerEl } = makeView(vault, { hierarchyOnly: false });

		promptNewResource(view);
		submitResource('Alex');
		await flush();
		refresh(view, vault);

		expect(containerEl.querySelectorAll('.pbl-row')).toHaveLength(1);
		expect(Array.from(containerEl.querySelectorAll('.pbl-title')).map((el) => el.textContent)).toEqual([
			'Onboarding',
		]);
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('reports a write it could not make, rather than failing silently', async () => {
		const vault = new FakeVault();
		const { view } = makeView(vault, {});
		vi.spyOn(vault.app.vault, 'create').mockRejectedValue(new Error('disk full'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		promptNewResource(view);
		submitResource('Alex');
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not create the resource'))).toBe(true);
	});
});
