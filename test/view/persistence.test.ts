// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, refresh, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('collapse state persistence', () => {
	interface StoredEntry {
		collapsed: string[];
		expanded: string[];
	}

	function stored(vault: FakeVault): Record<string, StoredEntry> {
		return (vault.localStorage.get('product-backlog:collapse') ?? {}) as Record<string, StoredEntry>;
	}

	const expandedTitles = ['Epic A', 'Epic B', 'Feature B1', 'Feature B2'];

	it('reopens a base where the last session left it', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(first.containerEl)).toEqual(expandedTitles);
		first.view.onunload();

		expect(stored(vault)['Backlog.base#Backlog'].expanded).toContain('Epic B.md');

		// `collapsed: true` skips the harness's expand-all, so an expanded tree here
		// is the restore doing it — not the test.
		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(second.containerEl)).toEqual(expandedTitles);
	});

	it('still opens collapsed with nothing stored', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('remembers a row that was shut, not just ones that were opened', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		rowByTitle(first.containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(first.containerEl)).toEqual(['Epic A', 'Epic B']);
		first.view.onunload();

		expect(stored(vault)['Backlog.base#Backlog'].collapsed).toContain('Epic B.md');
		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(second.containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('keeps two bases out of one another’s state', () => {
		const vault = fixture();
		const a = makeView(vault, {}, { base: 'A.base' });
		a.view.onunload();

		const b = makeView(vault, {}, { base: 'B.base', collapsed: true });
		// A's expanded rows must not open B, which nobody has touched.
		expect(titlesOf(b.containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(Object.keys(stored(vault))).toEqual(['A.base#Backlog']);
	});

	it('separates two views of one base by name', () => {
		const vault = fixture();
		const a = makeView(vault, {}, { base: 'Shared.base', viewName: 'Planning' });
		a.view.onunload();
		expect(Object.keys(stored(vault))).toEqual(['Shared.base#Planning']);

		const b = makeView(vault, {}, { base: 'Shared.base', viewName: 'Triage', collapsed: true });
		expect(titlesOf(b.containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('keeps an expanded parent open when the note is renamed', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(containerEl)).toEqual(expandedTitles);

		// Renaming is an edit to the same row. The refresh that follows must not treat
		// the new path as a parent nobody has ruled on and shut it.
		vault.renameFile('Epic B.md', 'Epic B renamed.md');
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B renamed', 'Feature B1', 'Feature B2']);
	});

	it('keeps rows open when the folder above them is moved', () => {
		const vault = new FakeVault();
		vault.folders.add('Work');
		vault.addFile('Work/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Work/Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		const { containerEl, view } = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);

		// Obsidian reports the folder, not each note inside it, so matching on the
		// renamed path alone would leave every row behind under the old prefix.
		vault.renameFolder('Work', 'Archive/Work');
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);
	});

	it('carries a collapsed row to its new path too', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault, {}, { base: 'Backlog.base' });
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		vault.renameFile('Epic B.md', 'Epic B renamed.md');
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B renamed']);
	});

	it('migrates the stored entry when the view itself is renamed', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Backlog' });
		first.view.onunload();
		expect(Object.keys(stored(vault))).toHaveLength(1);

		// Reopen, rename the view, and close without touching a row — the state is
		// unchanged but belongs under a different key now.
		const second = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Backlog', collapsed: true });
		second.config.name = 'Planning';
		second.view.onunload();

		const keys = Object.keys(stored(vault));
		expect(keys).toHaveLength(1);
		expect(decodeURIComponent(keys[0].split('#')[1])).toBe('Planning');

		// And the renamed view reopens where it was left, rather than at its defaults.
		const third = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Planning', collapsed: true });
		expect(titlesOf(third.containerEl)).toEqual(expandedTitles);
	});

	it('follows the base when it is renamed under an open view', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });

		// The file explorer moves the base while the view is open. The view resolves
		// its identity again when it saves, so the state lands under the new path
		// rather than under a key nothing will look up again.
		const leaf = vault.leaves[0].view as { file: { path: string; extension: string } };
		vault.files.delete('Backlog.base');
		vault.addFile('Archive/Backlog.base');
		leaf.file = { path: 'Archive/Backlog.base', extension: 'base' };
		first.view.onunload();

		const keys = Object.keys(stored(vault));
		expect(keys).toHaveLength(1);
		expect(decodeURIComponent(keys[0].split('#')[0])).toBe('Archive/Backlog.base');
	});

	it('stays session-only for a base embedded in a note', () => {
		const vault = fixture();
		// An embedded base is drawn inside the host note's leaf, so the only file on
		// offer is the note. Two embeds in one note would then share a key and
		// overwrite each other — worse than forgetting, so it forgets.
		const { view, containerEl } = makeView(vault, {}, { base: 'Notes/Plan.md' });

		expect(titlesOf(containerEl)).toEqual(expandedTitles);
		view.onunload();
		expect(vault.localStorage.size).toBe(0);
	});

	it('stays session-only when the base cannot be identified', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		// No leaf owns this element, so there is no key. Sharing one would be worse
		// than not persisting: bases would inherit each other's rows.
		expect(titlesOf(containerEl)).toEqual(expandedTitles);
		view.onunload();
		expect(vault.localStorage.size).toBe(0);
	});

	it('survives a view name containing the key separator', () => {
		const vault = fixture();
		// "Sprint #3" is an ordinary view name. The base path is carried in the entry
		// rather than parsed back out of the key, so a `#` in either half cannot make
		// one view's save mistake another's entry for a base that no longer exists.
		const first = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Sprint #3' });
		first.view.onunload();

		// Saving from any other view is when stale entries get pruned — the moment a
		// misparsed base path turns a live entry into one whose base "no longer exists".
		const other = makeView(vault, {}, { base: 'Other.base' });
		other.view.onunload();

		const reopened = makeView(vault, {}, { base: 'Backlog.base', viewName: 'Sprint #3', collapsed: true });
		expect(titlesOf(reopened.containerEl)).toEqual(expandedTitles);
	});

	it('forgets paths whose note is gone, and entries whose base is gone', () => {
		const vault = fixture();
		vault.localStorage.set('product-backlog:collapse', {
			'Deleted.base#Backlog': { base: 'Deleted.base', collapsed: ['Whatever.md'], expanded: [] },
		});
		const { view } = makeView(vault, {}, { base: 'Backlog.base' });
		vault.files.delete('Epic B.md');
		view.onunload();

		const entry = stored(vault)['Backlog.base#Backlog'];
		expect([...entry.collapsed, ...entry.expanded]).not.toContain('Epic B.md');
		// Nothing else will ever enumerate the base that wrote this.
		expect(stored(vault)['Deleted.base#Backlog']).toBeUndefined();
	});

	it('ignores stored state it cannot read rather than failing to render', () => {
		const vault = fixture();
		vault.localStorage.set('product-backlog:collapse', 'not an object');
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('coalesces the writes instead of saving once per row', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base' });
		const save = vi.spyOn(vault.app, 'saveLocalStorage');

		containerEl
			.querySelector<HTMLElement>('[aria-label="Collapse all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// Settling every parent is one loop; serializing the whole list per row
		// would be quadratic on a real backlog.
		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(400);
		expect(save).toHaveBeenCalledTimes(1);
	});
});
