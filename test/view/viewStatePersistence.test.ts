// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { RELEASE_FOLD } from '../../src/view/viewState';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, refresh, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('collapse state persistence', () => {
	interface StoredEntry {
		folds: { collapsed: string[]; expanded: string[]; lanes: string[] };
		prefs?: { release?: string };
	}

	function stored(vault: FakeVault): Record<string, StoredEntry> {
		return (vault.localStorage.get('product-backlog:view-state') ?? {}) as Record<string, StoredEntry>;
	}

	const expandedTitles = ['Epic A', 'Epic B', 'Feature B1', 'Feature B2'];

	it('reopens a base where the last session left it', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		expect(titlesOf(first.containerEl)).toEqual(expandedTitles);
		first.view.onunload();

		expect(stored(vault)['Backlog.base#Backlog'].folds.expanded).toContain('Epic B.md');

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

		expect(stored(vault)['Backlog.base#Backlog'].folds.collapsed).toContain('Epic B.md');
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
		vault.localStorage.set('product-backlog:view-state', {
			'Deleted.base#Backlog': {
				base: 'Deleted.base',
				folds: { collapsed: ['Whatever.md'], expanded: [], lanes: [] },
				prefs: {},
			},
		});
		const { view } = makeView(vault, {}, { base: 'Backlog.base' });
		vault.files.delete('Epic B.md');
		view.onunload();

		const entry = stored(vault)['Backlog.base#Backlog'];
		expect([...entry.folds.collapsed, ...entry.folds.expanded]).not.toContain('Epic B.md');
		// Nothing else will ever enumerate the base that wrote this.
		expect(stored(vault)['Deleted.base#Backlog']).toBeUndefined();
	});

	/**
	 * A saved view's TYPE can change while its stored identity does not (`view/viewState.ts`'s
	 * own comment on `RELEASE_FOLD`): a `.base` view once configured as the release view
	 * accumulates keys shaped `\u0000release:<release path>\u0000<member path>`, and
	 * switching that same saved view to render the BACKLOG loads this exact `ViewState`
	 * over the identity that already holds them. Before `RELEASE_FOLD` joined `notePath`,
	 * the flush below read that whole key as one bare path, found no such file, and
	 * silently deleted the release's own fold on the first data update — this is that
	 * failure driven from the BACKLOG view's own restore/flush, not from `scopeTree.ts`.
	 */
	it('keeps a release’s own fold when the backlog view flushes over the same identity', () => {
		const vault = fixture();
		const releaseFoldKey = `${RELEASE_FOLD}Releases/0.8.md\u0000Epic B.md`;
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [releaseFoldKey], expanded: [], lanes: [] },
				prefs: {},
			},
		});

		const { view } = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		// A write has to be SCHEDULED for `onunload` to flush at all — nothing here has
		// touched a row, so without this the assertion below would pass whether or not the
		// prune below ever ran, exactly the false confidence the repository's own rule
		// against an unchecked comment warns about. `setZoom`'s own value is unrelated; it
		// exists only to put a pending save on the clock, the same way the folded-band test
		// above does.
		view.setZoom('quarter');
		view.onunload();

		expect(stored(vault)['Backlog.base#Backlog'].folds.collapsed).toContain(releaseFoldKey);
	});

	/**
	 * `renamePath`'s walk reaches a release-fold key too, once `notePath` and `scopeOf`
	 * both recognise `RELEASE_FOLD`: the MEMBER path after the last NUL is what
	 * `movedPath` is asked about, and everything up to and including that NUL —
	 * `scopeOf`'s own answer — is what has to survive in front of the renamed member, or
	 * the key would migrate to a bare path and lose which release it was scoped to.
	 */
	it('carries a release’s own fold to a renamed member, keeping it scoped to that release', () => {
		const vault = fixture();
		const releaseFoldKey = `${RELEASE_FOLD}Releases/0.8.md\u0000Epic B.md`;
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [releaseFoldKey], expanded: [], lanes: [] },
				prefs: {},
			},
		});

		const { view } = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		vault.renameFile('Epic B.md', 'Epic B renamed.md');
		view.onunload();

		const renamedKey = `${RELEASE_FOLD}Releases/0.8.md\u0000Epic B renamed.md`;
		const collapsed = stored(vault)['Backlog.base#Backlog'].folds.collapsed;
		expect(collapsed).toContain(renamedKey);
		expect(collapsed).not.toContain(releaseFoldKey);
	});

	/**
	 * `scope`'s rename walk, asked of the second path-valued pref.
	 *
	 * **This assertion has to distinguish a rename from a DELETION, and only the stored
	 * VALUE does.** Both end the same way on screen — the path names no release, so the
	 * view draws the index — so a test that reopened the view and asserted the index was
	 * showing would be green against the broken behaviour it exists to catch. What is
	 * checked is therefore the path itself: it followed the note, rather than staying
	 * stale (unwalked) or going absent (pruned, which `prefs` must never be).
	 */
	it('carries the stored release pick through a rename of the note, and of a folder above it', () => {
		const vault = fixture();
		vault.addFile('releases/0.8.md', { frontmatter: { type: 'Release' } });
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [], expanded: [], lanes: [] },
				prefs: { release: 'releases/0.8.md' },
			},
		});

		// Through the vault's own rename event, which is the only thing that reaches the
		// migration in a vault — the view subscribes to it on the first data update.
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		vault.renameFile('releases/0.8.md', 'releases/0.8.1.md');
		first.view.onunload();
		expect(stored(vault)['Backlog.base#Backlog'].prefs?.release).toBe('releases/0.8.1.md');

		// A folder move reports the FOLDER, never the notes under it — so matching the
		// stored path alone strands every pick inside a folder anybody tidies.
		const second = makeView(vault, {}, { base: 'Backlog.base' });
		vault.renameFolder('releases', 'archive/releases');
		second.view.onunload();
		expect(stored(vault)['Backlog.base#Backlog'].prefs?.release).toBe('archive/releases/0.8.1.md');
	});

	it('ignores stored state it cannot read rather than failing to render', () => {
		const vault = fixture();
		vault.localStorage.set('product-backlog:view-state', 'not an object');
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

	it('persists the shelf collapse, sort and type filter across a reopen', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setShelfCollapsed(false);
		first.view.setShelfSort('title');
		first.view.setShelfHiddenTypes(new Set(['Task']));
		first.view.onunload();

		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(second.view.shelfCollapsed).toBe(false);
		expect(second.view.shelfSort).toBe('title');
		expect(second.view.shelfHiddenTypes).toEqual(new Set(['Task']));
	});

	it('persists a folded resource band, and forgets it when the reader opens it again', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setLaneCollapsed('Dana', true);
		// Folding one already folded is not a change and must not schedule a save.
		first.view.setLaneCollapsed('Dana', true);
		first.view.onunload();

		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(second.view.isLaneCollapsed('Dana')).toBe(true);
		expect(second.view.isLaneCollapsed('Kim')).toBe(false);

		// A band is a NAME, not a path, so nothing prunes it when the vault has no such
		// file — and nothing has to, since opening it again is what takes the entry away.
		second.view.setLaneCollapsed('Dana', false);
		second.view.onunload();
		expect(makeView(vault, {}, { base: 'Backlog.base', collapsed: true }).view.isLaneCollapsed('Dana')).toBe(false);
	});

	it('keeps a folded band and a stored pick when the flush prunes a note that is gone', () => {
		// `folds.lanes` holds resource NAMES and `prefs` holds no key at all. The flush
		// drops fold keys whose FILE is gone, and it may reach neither: a prune that took
		// the whole folds bucket rather than the two path lists would shut nothing and
		// silently reopen every band the reader folded, and one that reached the prefs
		// would throw away every pick the same way.
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setLaneCollapsed('Dana', true);
		first.view.setZoom('quarter');
		vault.files.delete('Epic A.md');
		first.view.onunload();

		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(second.view.isLaneCollapsed('Dana')).toBe(true);
		expect(second.view.zoom).toBe('quarter');
	});

	it('folds a band by the resource, not by the casing the row happened to draw', () => {
		// A band is one band whatever case names it — `deriveLanes` keys its own map on
		// `name.toLowerCase()` — while the name DRAWN is whichever source minted the row:
		// the declared roster, else the first result, else an absence. So the display can
		// change case with no resource changing, and a fold keyed on it would reopen the
		// band and strand the old entry where nothing would ever match it again.
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });

		first.view.setLaneCollapsed('Dana', true);
		expect(first.view.isLaneCollapsed('dana')).toBe(true);
		first.view.onunload();

		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(second.view.isLaneCollapsed('DANA')).toBe(true);
		// And opening it under the other spelling really opens it, rather than adding a
		// second entry beside the one it could not see.
		second.view.setLaneCollapsed('dana', false);
		expect(second.view.isLaneCollapsed('Dana')).toBe(false);
	});

	/**
	 * Folding on click stopped being a `.base` option on 2026-08-11, so the toolbar
	 * toggle is now the only thing that sets it and this is what makes it survive the
	 * view. Asserted through the GESTURE rather than the flag: the reopened view has to
	 * fold on a click, which is the whole reason the value is stored at all.
	 */
	it('reopens folding on click when the last session turned it on, without writing the .base', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setClickFolds(true);
		first.view.onunload();

		// Working position: it goes to local storage and nowhere near the shared file.
		expect(first.config.setCalls.some((c) => c.key === 'clickAction')).toBe(false);

		const second = makeView(vault, {}, { base: 'Backlog.base' });
		expect(second.view.clickFolds).toBe(true);
		rowByTitle(second.containerEl, 'Epic B').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(second.containerEl)).not.toContain('Feature B1');
		expect(vault.opened).toEqual([]);

		// And back off: false is the default, so it clears the field rather than storing it.
		second.view.setClickFolds(false);
		second.view.onunload();
		expect(stored(vault)[Object.keys(stored(vault))[0]]).not.toHaveProperty('clickFolds');
		expect(makeView(vault, {}, { base: 'Backlog.base' }).view.clickFolds).toBe(false);
	});

	/**
	 * The bucket layout, the same way and for the same reason: a habit rather than a
	 * property of the base. Asserted through what the roadmap DRAWS on reopening, not
	 * through the flag alone — the row's class is the whole of what the pick does.
	 */
	it('reopens the buckets in the layout the last session picked, without writing the .base', () => {
		const vault = fixture();
		const first = makeView(vault, { horizonProperty: 'note.horizon' }, { base: 'Backlog.base' });
		first.view.setProjection('roadmap');
		first.view.setBucketGrid(false);
		first.view.onunload();
		expect(first.config.setCalls).toEqual([]);

		const second = makeView(vault, { horizonProperty: 'note.horizon' }, { base: 'Backlog.base' });
		expect(second.view.bucketGrid).toBe(false);
		expect(second.containerEl.querySelector('.pbl-roadmap-buckets.pbl-buckets-list')).not.toBeNull();

		// And back: the grid is the default, so it clears the field rather than storing it.
		second.view.setBucketGrid(true);
		second.view.onunload();
		expect(stored(vault)[Object.keys(stored(vault))[0]]).not.toHaveProperty('bucketList');
	});

	it('reopens focused on the type the last session picked, without writing the .base', () => {
		const vault = fixture();
		const first = makeView(vault, {}, { base: 'Backlog.base' });
		first.view.setFocusLevel('Feature');
		expect(titlesOf(first.containerEl)).toEqual(['Feature B1', 'Feature B2']);
		first.view.onunload();

		// The pick is working position: it goes here and nowhere near the shared file.
		expect(first.config.setCalls.some((c) => c.key === 'focusLevel')).toBe(false);

		// The restore has to happen BEFORE the model is built, or the reopened view
		// draws the whole tree until something else refreshes it.
		const second = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		expect(titlesOf(second.containerEl)).toEqual(['Feature B1', 'Feature B2']);

		// And clearing it clears the stored value rather than storing an empty name.
		second.view.setFocusLevel('');
		second.view.onunload();
		const third = makeView(vault, {}, { base: 'Backlog.base', collapsed: true });
		// The whole tree, restored to the rows the first session left open.
		expect(titlesOf(third.containerEl)).toEqual(expandedTitles);
	});
});
