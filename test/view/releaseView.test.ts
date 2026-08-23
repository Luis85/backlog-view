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

	/**
	 * The state this reports in is the one a base with NO release is in for every membership
	 * value it holds: nothing exists for any of them to resolve to. That is why the fixture
	 * is exactly that state and not a nearby one — a vault with a release beside the broken
	 * link renders the index, which has reported the unresolved since Task 4, so it would
	 * pin nothing about the empty state at all.
	 *
	 * `render` returned before `releaseIndex` was ever called, so the count was never
	 * computed: the screen said "no releases" and hid every broken assignment in the base.
	 * [[The scope of a release as a tree]] 1b's ruling is that such an item is reported among
	 * the unresolved "rather than silently dropped", and this is the only screen it can be
	 * seen on.
	 */
	it('still reports the unresolved memberships when the base holds no release at all', () => {
		const vault = new FakeVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 1, release: '[[Missing]]' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('No releases');
		expect(containerEl.querySelector('.pbl-rel-unresolved')?.textContent).toContain('1 item');
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
	 * evidence of intent and of nothing else — so this drives the three paths this FILE's
	 * own harness reaches and asserts a clean vault after them: `pick`, `onDataUpdated`
	 * and `onunload`.
	 *
	 * The vault is where the check sits, because that is the boundary every write path
	 * ends at: `applyWrites`, `applyPropertyWrites`, `createNote` and `absenceNotes` all
	 * reach a note through `processFrontMatter` (`writeLog`) or `vault.create` (`files`),
	 * and the `.base` is written through `config.set`.
	 *
	 * **It is a list of paths, and it says so** — narrower than the category claim, which
	 * is why it is not the whole of the check. The one asked AT THE FORBIDDEN THING is
	 * `test/view/releaseWritesNothing.test.ts`: it spies on the five functions in
	 * `storage/` that may put bytes in a note, so a call to one of them from anywhere under
	 * `src/view/release/` fails whatever gesture reached it, and it drives both screens
	 * rather than the three methods here. The guarantee that holds for code nobody has
	 * written yet is neither of the two: `WRITE_BOUNDARY` in `eslint.config.mjs` bans
	 * `processFrontMatter`, `vault.create` and `load/saveLocalStorage` across the whole of
	 * `src/view/`, whose block carries `src/view/release/` in none of its `ignores`, so
	 * every one of them fails lint in this directory from its first commit.
	 *
	 * What this one is still FOR, beside the other two: the `.base` — `config.setCalls` is
	 * a surface no lint rule names and no `storage/` spy sees.
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

	/**
	 * The three model mappings passed to `buildModel` are this view's own, and the comment
	 * beside them says so — which is evidence of intent and of nothing else until a test
	 * fails without them. `resolveSettings` reads the same option keys through `propKey`,
	 * which returns its fallback for a CLEARED option, while `resolveReleaseSettings` uses
	 * `clearablePropKey` and returns `''`. So the two resolvers agree on every configured
	 * value and part company on exactly the cleared one, which is what this drives.
	 *
	 * **Two of the three overrides are what this reaches, and the third cannot be.** With
	 * `parentProperty` cleared the spread alone nests `F.md` under the release, and with
	 * `orderProperty` cleared it re-ranks the roots by a key the options screen says is
	 * off — both observable on the public `model`. A cleared `typeProperty` never reaches
	 * `buildModel` at all: `render`'s own guard answers the noType empty state above this
	 * line, so the `typeKey` override is unobservable here and is left stating the rule
	 * rather than checked by it.
	 */
	it("builds the model with this view's own mappings, so a cleared property stays cleared", () => {
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release', order: 2 } });
		vault.addFile('0.9.md', { frontmatter: { type: 'Release', order: 1 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 1 }, parentLink: '0.8' });
		const { view } = makeReleaseView(vault, { typeProperty: 'note.type', parentProperty: '', orderProperty: '' });

		// `parentKey: ''` — nothing is nested. The backlog resolver's `parent` would make
		// `F.md` a child of the release and the scope would go on nesting rows by it.
		expect(view.model?.byPath.get('F.md')?.parent).toBeNull();
		// `orderKey: ''` — the Base's own order stands. The backlog resolver's `order`
		// would rank `0.9.md` first, by a property this view reports as unbound.
		expect(view.model?.realRoots.map((item) => item.file.path)).toEqual(['0.8.md', '0.9.md', 'F.md']);
	});

	it('returns to the index when the remembered release is gone', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('Vanished.md');
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')).toBeNull();
	});
});
