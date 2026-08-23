// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, releaseVault } from '../helpers/release';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

useViewHarness();

describe('the release view', () => {
	it('says which option to bind when no type property is mapped', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		const { containerEl } = makeReleaseView(vault, { typeProperty: '' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('type property');
		expect(containerEl.querySelector('.pbl-rel-grid')).toBeNull();
	});

	it('draws an empty list, not a warning, when the base holds no release', () => {
		const vault = new FakeVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const { containerEl } = makeReleaseView(vault, { typeProperty: 'note.type' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('No releases');
		// No create button on THIS view. The backlog toolbar's own New menu still offers
		// `New Release`, which is a different view's existing creator and is asserted there.
		expect(containerEl.querySelector('.pbl-empty button')).toBeNull();
	});

	it('opens the index with nothing picked, and a release once one is', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
		view.pick('0.8.md');
		expect(containerEl.querySelector('.pbl-rel-header')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-rel-grid')).toBeNull();
	});

	it('leaves nothing behind when the view unloads', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		expect(containerEl.querySelector('.pbl-rel-view')).not.toBeNull();
		view.onunload();
		// The container is Bases', and it is reused by whatever view comes next.
		expect(containerEl.querySelector('.pbl-rel-view')).toBeNull();
	});

	it('keeps a session-only pick across a data update in an embedded base', () => {
		const vault = releaseVault();
		// No `base`, so `mountLeaf` builds no leaf and `resolveViewIdentity` answers null —
		// the embedded case, where the pick is session-only rather than absent.
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('0.8.md');
		view.onDataUpdated();
		expect(view.pickedPath).toBe('0.8.md');
		expect(containerEl.querySelector('.pbl-rel-header')).not.toBeNull();
	});

	it('remembers the pick per saved view, and restores it on the next open', () => {
		const vault = releaseVault();
		const first = makeReleaseView(vault, RELEASE_CONFIG, { base: 'Plan.base' });
		first.view.pick('0.9.md');
		first.view.onunload();

		const second = makeReleaseView(vault, RELEASE_CONFIG, { base: 'Plan.base' });
		expect(second.view.pickedPath).toBe('0.9.md');
		expect(second.containerEl.querySelector('.pbl-rel-header')).not.toBeNull();
	});

	/**
	 * The class docstring claims this view WRITES NOTHING, and a claim in a comment is
	 * evidence of intent and of nothing else — so it is checked at the forbidden thing
	 * rather than by listing the paths somebody thought of.
	 *
	 * The vault is where the check sits, because that is the boundary every write path
	 * ends at: `applyWrites`, `applyPropertyWrites`, `createNote` and `absenceNotes` all
	 * reach a note through `processFrontMatter` (`writeLog`) or `vault.create` (`files`),
	 * and the `.base` is written through `config.set`. So a write added to this view by
	 * code nobody has written yet — Tasks 8 and 9 render into it — fails this without
	 * anyone predicting its surface.
	 */
	it('writes to no note and to no .base, whatever it is driven through', () => {
		const vault = releaseVault();
		const before = vault.files.size;
		const { view, config } = makeReleaseView(vault, RELEASE_CONFIG, { base: 'Plan.base' });
		view.pick('0.8.md');
		view.onDataUpdated();
		view.pick(null);
		view.onunload();

		expect(vault.writeLog).toEqual([]);
		expect(vault.trashed).toEqual([]);
		// `mountLeaf` adds the `.base` itself and nothing since.
		expect(vault.files.size).toBe(before + 1);
		expect(config.setCalls).toEqual([]);
	});

	it('returns to the index when the remembered release is gone', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('Vanished.md');
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')).toBeNull();
	});
});
