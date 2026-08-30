// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal, Notice } from '../helpers/obsidian-mock';
import { fixture, flush, makeView, refresh, rowByTitle, submitButton, submitPrompt, useViewHarness } from '../helpers/view';

/**
 * Clear every configured folder, so folder INFERENCE is what runs. Both layers have to
 * go: a type's own folder answers first, and the home folder answers next.
 */
const NO_TYPE_FOLDERS: Record<string, string> = {
	homeFolder: '',
	...Object.fromEntries(['epic', 'feature', 'pbi', 'task', 'issue', 'bug'].map((t) => [`typeFolder.${t}`, ''])),
};

useViewHarness();

describe('item creation', () => {
	it('creates a child via the add button with prompt, inferred folder and properties', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		// Folders by type off: this is the inference path, which only runs when the
		// type being created has no folder of its own.
		const { containerEl } = makeView(vault, { ...NO_TYPE_FOLDERS });

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// An Epic can hold a Feature or any of the extra types, so the modal asks which — and
		// the heading cannot name the type it is in the middle of asking about.
		expect(modal.titleEl.textContent).toBe('New item');
		const typePicker = modal.contentEl.querySelector('select');
		expect([...(typePicker?.options ?? [])].map((o) => o.value)).toEqual(['Feature', 'Issue', 'Bug', 'Idea', 'Deliverable', 'Improvement']);
		expect(typePicker?.value).toBe('Feature');
		// The prompt says where the item will land before anything is written
		expect(modal.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe(
			'Under "Epic A" · in folder "Backlog"',
		);

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		const createBtn = submitButton(modal);
		expect(createBtn?.disabled).toBe(true);
		input.value = 'Login flow';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(createBtn?.disabled).toBe(false);
		createBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Created in the folder most items live in, ranked after its sibling
		const fm = vault.fm('Backlog/Login flow.md');
		expect(fm['type']).toBe('Feature');
		expect(fm['parent']).toBe('[[Epic A]]');
		expect(fm['order']).toBe(1010);
		expect(Notice.messages.some((m) => m.startsWith('Created'))).toBe(true);
	});

	it('creates the extra type picked in the modal, under a parent three rungs up', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, { ...NO_TYPE_FOLDERS });

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		const picker = modal.contentEl.querySelector('select');
		if (!picker) throw new Error('type picker missing');
		picker.value = 'Bug';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		input.value = 'Login times out';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The chosen type is written, not the ladder's own child.
		const fm = vault.fm('Backlog/Login times out.md');
		expect(fm['type']).toBe('Bug');
		expect(fm['parent']).toBe('[[Epic A]]');
	});

	it('files a new item in its type folder, and follows the picker', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');

		// The landing spot is announced for the default type...
		const detail = () => modal.contentEl.querySelector('.pbl-modal-detail')?.textContent ?? '';
		expect(detail()).toBe('Under "Epic A" · in folder "docs/requirements"');

		// ...and must follow the picker, or it tells the user something untrue at the
		// moment they confirm.
		const picker = modal.contentEl.querySelector('select');
		if (!picker) throw new Error('type picker missing');
		picker.value = 'Bug';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		expect(detail()).toBe('Under "Epic A" · in folder "docs/bugs"');

		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('title input missing');
		input.value = 'Login times out';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Filed by type, not beside the items it was created from.
		expect(vault.fm('docs/bugs/Login times out.md')['type']).toBe('Bug');
		expect(vault.fm('docs/bugs/Login times out.md')['parent']).toBe('[[Epic A]]');
	});

	it('files into the shipped folders on a vault with nothing in it yet', () => {
		const { containerEl } = makeView(new FakeVault());

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent).toContain(
			'folder "docs/requirements"',
		);
	});

	it('asks nothing when the row can hold only one type', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Bug A.md', { frontmatter: { type: 'Bug', order: 10 }, parentLink: 'Epic A' });
		const { containerEl } = makeView(vault);

		rowByTitle(containerEl, 'Bug A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// A Bug holds only Tasks, so there is no question to ask and the heading says so.
		expect(modal.titleEl.textContent).toBe('New Task');
		expect(modal.contentEl.querySelector('select')).toBeNull();
	});
});

describe('creation flows', () => {
	it('asks for a folder on an empty view and persists the choice', async () => {
		const vault = new FakeVault();
		// The prompt only asks when the type being created has nowhere to go: no folder
		// of its own, none configured, and no items to infer from.
		const { containerEl, config } = makeView(vault, { ...NO_TYPE_FOLDERS });

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// With the folder still a user choice there is no landing spot to announce
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')).toBeNull();
		submitPrompt({ title: 'First Epic', folder: 'Backlog' });
		await flush();

		expect(config.values['homeFolder']).toBe('Backlog');
		expect(vault.folders.has('Backlog')).toBe(true);
		expect(vault.fm('Backlog/First Epic.md')['type']).toBe('Epic');
	});

	it('describes the vault root as the landing spot for rootless backlogs', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { ...NO_TYPE_FOLDERS });

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail')?.textContent).toBe('In the vault root');
	});

	it('ranks top-level creations against the real roots in focus mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic 1.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Epic 2.md', { frontmatter: { type: 'Epic', order: 200 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic 1' });
		const { containerEl } = makeView(vault, NO_TYPE_FOLDERS, { focus: 'Feature' });

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Fresh Feature' });
		await flush();

		// After the real epics (order 200), not squeezed between the focus rows
		expect(vault.fm('Fresh Feature.md')['order']).toBe(1200);
	});

	it('infers the folder from hidden items when a focused view is empty', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// Focused on Feature, nothing matches — but the full tree knows the folder
		const { containerEl } = makeView(vault, NO_TYPE_FOLDERS, { focus: 'Feature' });
		expect(containerEl.querySelector('.pbl-empty')).not.toBeNull();

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('prompt not opened');
		// No folder question: the location is known
		expect(modal.contentEl.querySelectorAll('input')).toHaveLength(1);
		submitPrompt({ title: 'Fresh Feature' });
		await flush();

		expect(vault.fm('Backlog/Fresh Feature.md')['type']).toBe('Feature');
	});

	it('creates children beside the parent folder note in folder mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic X/Epic X.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, { inferFolderHierarchy: true });

		rowByTitle(containerEl, 'Epic X')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Fast checkout' });
		await flush();

		const fm = vault.fm('Backlog/Epic X/Fast checkout.md');
		expect(fm['type']).toBe('Feature');
		expect(fm['parent']).toBe('[[Epic X]]');
	});

	/**
	 * A rank is one number over the whole population now, so a creation asks
	 * `orderForTarget` the same question every drop asks — and inherits its refusals.
	 * A note created at a fallback rank is worse than no note: the number may be taken,
	 * and it is nowhere near the slot the user asked for.
	 */
	describe('when the rank refuses', () => {
		it('creates nothing when the parent was deleted while the prompt was open', async () => {
			const vault = new FakeVault();
			vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
			const { view, containerEl } = makeView(vault, NO_TYPE_FOLDERS);

			rowByTitle(containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			// The prompt is modal and the model rebuilds under it.
			vault.files.delete('Backlog/Epic A.md');
			refresh(view, vault);
			submitPrompt({ title: 'Orphan' });
			await flush();

			expect(vault.fm('Backlog/Orphan.md')).toEqual({});
			expect(Notice.messages).toContain('That item’s parent no longer exists, so nothing was created.');
		});

		it('creates a child after the model rebuilt under the open prompt', async () => {
			const vault = new FakeVault();
			vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
			const { view, containerEl } = makeView(vault, NO_TYPE_FOLDERS);

			rowByTitle(containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			// The captured parent is an object from the OLD model; the placement has to
			// find the live one by PATH or every creation refuses on a healthy vault.
			refresh(view, vault);
			submitPrompt({ title: 'Fresh' });
			await flush();

			expect(vault.fm('Backlog/Fresh.md')['order']).toBe(2000);
		});

		it('places a child in a legacy vault through the same fallback a drop uses', async () => {
			const vault = new FakeVault();
			// Sibling-scoped ranks, which is what every vault holds before Seed ships: Epic A
			// and its first child both carry 10. A drop reorders this vault fine (the peer
			// fallback), so a creation that refused would leave a vault that can be dragged
			// around but not added to.
			vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('Backlog/A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
			vault.addFile('Backlog/A2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic A' });
			vault.addFile('Backlog/Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
			const { containerEl } = makeView(vault, NO_TYPE_FOLDERS);

			rowByTitle(containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			submitPrompt({ title: 'A3' });
			await flush();

			const order = vault.fm('Backlog/A3.md')['order'];
			expect(order).toBe(1020);
			// The fallback's own rule: a peer-scoped number is only taken when the population
			// does not already hold it.
			const others = [...vault.files.keys()]
				.filter((path) => path !== 'Backlog/A3.md')
				.map((path) => vault.fm(path)['order']);
			expect(others).not.toContain(order);
		});

		it('creates nothing under a parent whose neighbour has no rank yet', async () => {
			const vault = new FakeVault();
			// A vault nobody has run the set-up button over: absence is not a low rank, so
			// there is no position to place a new note relative to.
			vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic' } });
			const { containerEl } = makeView(vault, NO_TYPE_FOLDERS);

			rowByTitle(containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			submitPrompt({ title: 'Nowhere' });
			await flush();

			expect(vault.fm('Backlog/Nowhere.md')).toEqual({});
			expect(Notice.messages).toContain(
				'That item has no rank yet. Use the toolbar’s set-up button to fill in the missing ones.',
			);
		});

		it('leaves a collapsed parent collapsed when the placement refuses', async () => {
			// **Asserted on the collapse STATE, not on the rendered rows.** Nothing re-renders
			// in this harness, so a row list reads the same either way and would pass against
			// the defect — the trap `cardMoves.ts`'s identical fix was caught by.
			const squeezed = new FakeVault();
			squeezed.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
			squeezed.addFile('Backlog/F1.md', { frontmatter: { type: 'Feature', order: 2 }, parentLink: 'Epic A' });
			squeezed.addFile('Backlog/Epic B.md', { frontmatter: { type: 'Epic', order: 2.000001 } });
			const refused = makeView(squeezed, NO_TYPE_FOLDERS, { collapsed: true });
			expect(refused.view.isCollapsed('Backlog/Epic A.md')).toBe(true);

			rowByTitle(refused.containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			submitPrompt({ title: 'Squeezed' });
			await flush();

			expect(refused.view.isCollapsed('Backlog/Epic A.md')).toBe(true);

			// The control, or "never reveal" would pass this too: the same gesture with room
			// left DOES open the parent, because the new child has to be visible.
			const roomy = new FakeVault();
			roomy.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
			roomy.addFile('Backlog/F1.md', { frontmatter: { type: 'Feature', order: 2 }, parentLink: 'Epic A' });
			roomy.addFile('Backlog/Epic B.md', { frontmatter: { type: 'Epic', order: 1000 } });
			const accepted = makeView(roomy, NO_TYPE_FOLDERS, { collapsed: true });

			rowByTitle(accepted.containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			submitPrompt({ title: 'Roomy' });
			await flush();

			expect(accepted.view.isCollapsed('Backlog/Epic A.md')).toBe(false);
		});

		it('creates nothing when there is no room left for the rank', async () => {
			const vault = new FakeVault();
			vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
			vault.addFile('Backlog/F1.md', { frontmatter: { type: 'Feature', order: 2 }, parentLink: 'Epic A' });
			// The next row in the global population sits a rounding step above F1, so
			// there is no six-decimal number strictly between them.
			vault.addFile('Backlog/Epic B.md', { frontmatter: { type: 'Epic', order: 2.000001 } });
			const { containerEl } = makeView(vault, NO_TYPE_FOLDERS);

			rowByTitle(containerEl, 'Epic A')
				.querySelector<HTMLElement>('.pbl-add')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			submitPrompt({ title: 'Squeezed' });
			await flush();

			expect(vault.fm('Backlog/Squeezed.md')).toEqual({});
			expect(Notice.messages).toContain(
				'No room left between those two items. Run "Respace ranks" from the command palette.',
			);
		});
	});

	it('surfaces creation failures as a notice', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const vault = fixture();
		const { containerEl } = makeView(vault);
		(vault.app.vault as { create: unknown }).create = async () => {
			throw new Error('disk full');
		};

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Doomed' });
		await flush();

		expect(Notice.messages.some((m) => m.startsWith('Could not create the item'))).toBe(true);
	});
});
