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

	it('warns on a name a Resource note already carries, and creates the note anyway', async () => {
		// 3a: guides rather than arbitrates. `known` is the `Resource` notes the base
		// returned — the notes themselves now, rather than a roster gathered off the
		// roadmap's rows and settings.
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
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

	it('does not warn on a name only observed, declared or drawn — a resource is a note now', () => {
		// The three-source union — drawn lanes, the declared roster, observed assignees —
		// is deleted (Task 4): none of those makes a name exist, so none of them earns a
		// warning any more. This is the same three cases the deleted tests isolated (an
		// absence's subject, an undated item's own assignee, a declared name with no
		// roadmap drawn), now asserted together as the one thing they have in common:
		// none of them is a `Resource` note.
		const vault = new FakeVault();
		vault.addFile('Dana is away.md', {
			frontmatter: { type: 'Absence', assignee: 'Dana', start: '2026-08-10', due: '2026-08-14' },
		});
		vault.addFile('Untimed work.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Erin' } });
		const harness = laneRoadmap(vault, { resourceFolder: '', homeFolder: '' });

		promptNewResource(harness.view);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('no name field');
		const warningEl = () => modal.contentEl.querySelector('.pbl-modal-warning');

		for (const name of ['dana', 'erin', 'alice']) {
			input.value = name;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			expect(warningEl()?.textContent).toBe('');
		}
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
