// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollReads } from '../helpers/estimation';
import { makeReleaseView, RELEASE_CONFIG, releaseVault, scopeVault } from '../helpers/release';
import { ReleaseView } from '../../src/view/release/releaseView';
import { WriteLock } from '../../src/view/writeLock';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

useViewHarness();

describe('the release view', () => {
	it('shows the loading text before the first data update', () => {
		// Constructed directly rather than through `makeReleaseView`, which calls
		// `onDataUpdated` immediately — this is the one moment before that call, when the
		// view has nothing but the constructor's own placeholder to show. The estimation
		// view's own state test says the same thing about the same moment.
		const containerEl = document.body.createDiv();
		const view = new ReleaseView({} as never, containerEl, new WriteLock());
		expect(containerEl.querySelector('.pbl-rel-view')?.textContent).toBe('Loading releases…');
		view.onunload();
	});

	it('says which option to bind when no type property is mapped', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		const { containerEl } = makeReleaseView(vault, { typeProperty: '' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('type property');
		expect(containerEl.querySelector('.pbl-rel-bands')).toBeNull();
	});

	it('draws an empty list, not a warning, when the base holds no release', () => {
		const vault = new FakeVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const { containerEl } = makeReleaseView(vault, { typeProperty: 'note.type' });
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('No releases');
		// This state DOES carry the create button, and it is the second of the two entry
		// points onto one creation function — `draw` returns here before `renderIndex` ever
		// runs, so without it a base with no release would have no door at all. What the
		// gesture then does is `test/view/release/newRelease.test.ts`'s subject; the claim
		// here is only that the state offers it.
		expect(containerEl.querySelector('.pbl-empty .pbl-rel-new')).not.toBeNull();
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
		expect(containerEl.querySelector('.pbl-rel-bands')).not.toBeNull();
		view.pick('0.8.md');
		expect(containerEl.querySelector('.pbl-rel-header')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-rel-bands')).toBeNull();
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
	 * `test/view/releaseNeverEdits.test.ts` — narrowed by Task 5 of "releases own their
	 * creation" from the writes-nothing claim this file's own comment above still names, to
	 * what actually survives once this view has its own door: it creates notes and its own
	 * config, and never edits a note that already exists. It spies on SIX functions in
	 * `storage/` — the three EDIT paths (`applyWrites`, `applyRestores`,
	 * `applyPropertyWrites`) and three of the four creators (`createBacklogItem`,
	 * `createResourceNote`, `createAbsenceNote`), `createRelease` being the one this view
	 * is permitted — so a call to any of them from anywhere under `src/view/release/` fails
	 * whatever gesture reached it, and it drives both screens rather than the three methods
	 * here. The guarantee that holds for code nobody has written yet is neither of the two:
	 * `WRITE_BOUNDARY` in `eslint.config.mjs` bans `processFrontMatter`, `vault.create` and
	 * `load/saveLocalStorage` across the whole of `src/view/`, `src/view/release/`
	 * included, with **no carve-out for any of the three**. This paragraph claimed a
	 * `vault.create` exception for this directory until 2026-08-25 and there has never been
	 * one: `eslint.config.mjs`'s own comment records it as considered and refused, because
	 * `createRelease` is a plain function call no arm of the rule matches, so nothing had to
	 * be given up to permit it. Planting `view.app.vault.create(…)` in
	 * `src/view/release/newRelease.ts` fails `npx eslint` — which is how the claim was
	 * found false, and the direction it misled in is the one that costs a contributor a
	 * failed lint on a rule they were told did not apply.
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
		expect(containerEl.querySelector('.pbl-rel-bands')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')).toBeNull();
	});

	/**
	 * Finding 1 of Task 7: `pbl-rel-band` was absent from `FOCUS_HANDLE_CLASSES`, so a band
	 * held focus and `pick()`'s own `render()` — called synchronously off the band's click
	 * handler — detached it with `focusedControlClass()` answering null, dropping focus on
	 * `document.body`.
	 *
	 * The band never gets an EXACT match back — activating one changes SCREEN (index →
	 * scope), so no band exists once this render finishes. What the fix buys is narrower:
	 * `focusedControlClass()` stops returning null for a focused band, which lets `render()`'s
	 * own fallback fire — the redrawn screen's first focusable control, the scope's own Back
	 * button — instead of leaving focus nowhere at all.
	 */
	it('lands focus on the redrawn screen, not on the body, when a band is activated', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector<HTMLButtonElement>('.pbl-rel-band[data-path="0.8.md"]');
		if (!band) throw new Error('no band to activate');
		// A real press focuses the control before it activates; jsdom's `.click()` does not,
		// so this states that explicitly rather than pretending the click alone did it — the
		// same convention `scopeTree.test.ts`'s disclosure test uses for the identical reason.
		band.focus();
		expect(document.activeElement).toBe(band);

		view.pick('0.8.md');

		expect(document.activeElement).not.toBe(document.body);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-rel-back'));
	});
});

/**
 * What jsdom can and cannot say about the restore, stated once for the four tests below
 * rather than repeated in each.
 *
 * The restored NUMBER is not checkable here and an assertion on it is worse than none: a
 * detached element has no layout box, so a browser's `scrollTop` getter answers 0 however
 * far the reader had scrolled, while jsdom answers with whatever was last assigned to it —
 * connected or not. So a capture taken AFTER the teardown, which cannot work in a vault,
 * passes a number assertion here. `scrollHeight` is 0 for the same reason, which is why
 * these mock it: without that the clamp reduces every restore to 0 and the test would be
 * asserting the bug.
 *
 * Two things ARE checkable, and between them they are the behaviour: the ORDER (the read
 * happens while the old scroller is still in the document) and the KEY (whether a restore
 * is attempted at all across a given event). The number that comes back is owed a live
 * vault. `test/view/estimation/table.test.ts` reaches the same limit and `scrollReads` is
 * its instrument, reused here rather than copied.
 */
describe('the release view keeps the reader’s place', () => {
	afterEach(() => vi.restoreAllMocks());

	it('reads the old scroller while it is still in the document', () => {
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const reads = scrollReads(containerEl.querySelector('.pbl-rel-list') as HTMLElement);

		view.onDataUpdated();

		// Exactly one read, and `true` is that the node was still in the document when it
		// happened. `[false]` is the shape the estimation view's own version of this can
		// take — it holds its scroller in a FIELD, so a capture moved below the teardown
		// still reads a detached node and still answers a number in jsdom while answering 0
		// in a browser. This view cannot reach that shape, because `scrollerEl` re-queries
		// the pane and answers null once it is empty: moving the capture below `empty()`
		// makes this `[]` and reddens the three number tests too, watched. So what stands
		// between this view and that trap is the query, and this test is what would notice a
		// refactor to a field putting the trap back.
		expect(reads).toEqual([true]);
	});

	it('restores the index position across a data update', () => {
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		const listEl = containerEl.querySelector('.pbl-rel-list') as HTMLElement;
		listEl.scrollTop = 180;

		view.onDataUpdated();

		const rebuilt = containerEl.querySelector('.pbl-rel-list') as HTMLElement;
		expect(rebuilt).not.toBe(listEl);
		expect(rebuilt.scrollTop).toBe(180);
	});

	it('clamps the restored position to the rebuilt screen', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		(containerEl.querySelector('.pbl-rel-list') as HTMLElement).scrollTop = 900;

		// Two of the three releases leave the base's results, so the list is shorter than
		// the offset the reader left behind.
		scrollHeight.mockReturnValue(60);
		(view as unknown as { data: unknown }).data = { data: vault.entries().filter((e) => e.file.path === '0.8.md') };
		view.onDataUpdated();

		expect((containerEl.querySelector('.pbl-rel-list') as HTMLElement).scrollTop).toBe(60);
	});

	/**
	 * The KEY, which is the half a number assertion cannot reach: the two screens scroll
	 * different elements over different content, so a pick must start at the top in BOTH
	 * directions. Dropping the `drawnKey === previousKey` test leaves the two assertions
	 * above green and makes this one fail — watched, in both directions.
	 */
	it('starts at the top when the pick changes screens, in either direction', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		(containerEl.querySelector('.pbl-rel-list') as HTMLElement).scrollTop = 200;

		view.pick('R.md');
		const treeEl = containerEl.querySelector('.pbl-tree') as HTMLElement;
		expect(treeEl.scrollTop).toBe(0);

		// And back: the scope's own offset is not carried onto the index either.
		treeEl.scrollTop = 150;
		view.pick(null);
		expect((containerEl.querySelector('.pbl-rel-list') as HTMLElement).scrollTop).toBe(0);
	});

	it('restores one release’s tree across a data update', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		view.pick('R.md');
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		const treeEl = containerEl.querySelector('.pbl-tree') as HTMLElement;
		treeEl.scrollTop = 140;

		view.onDataUpdated();

		const rebuilt = containerEl.querySelector('.pbl-tree') as HTMLElement;
		expect(rebuilt).not.toBe(treeEl);
		expect(rebuilt.scrollTop).toBe(140);
	});
});
