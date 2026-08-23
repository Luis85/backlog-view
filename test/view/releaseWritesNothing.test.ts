// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as absenceNotes from '../../src/storage/absenceNotes';
import * as createNote from '../../src/storage/createNote';
import * as frontmatter from '../../src/storage/frontmatter';
import * as propertyWrite from '../../src/storage/propertyWrite';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { flush, key, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The increment's central claim — **this view writes nothing** — and it is a CATEGORY
 * claim, so it is checked at the forbidden thing rather than by listing the paths somebody
 * thought of. `releaseView.test.ts` drives a named list of interactions and asserts a clean
 * vault after them; that one is a regression guard for the paths that exist. This one puts
 * the check on the calls, which holds for a path nobody has written yet.
 *
 * **Three layers, and each sees what the one above it cannot.**
 *
 * - The five spies are every function in `storage/` that may put bytes in a note —
 *   `applyWrites` and `applyRestores` (the edit and its undo), `createBacklogItem` and
 *   `createAbsenceNote` (the two note creators) and `applyPropertyWrites` (the estimation
 *   view's plain key/value batches). `CLAUDE.md`'s write-boundary rule is that these
 *   modules are the whole of it, so a call to one of them from anywhere under
 *   `src/view/release/` fails here whatever screen or gesture reached it.
 * - `vault.writeLog` and `vault.files` are the boundary those five END at, so they catch a
 *   write that reached a note WITHOUT going through any of them — a raw
 *   `processFrontMatter` or `vault.create`, which is exactly the shape a spy on the five
 *   cannot see. That layer was watched failing: a temporary
 *   `this.app.fileManager.processFrontMatter(...)` in `renderIndex.ts` reddened it while
 *   all five spies stayed clean.
 * - `config.setCalls` is the `.base` itself, the third thing a Bases view can write.
 *
 * What none of the three sees is a write reached from a module this view does not import
 * yet. `WRITE_BOUNDARY` in `eslint.config.mjs` is that statement — it bans
 * `processFrontMatter`, `vault.create` and `load/saveLocalStorage` across `src/view/`, with
 * no `ignores` entry for this directory — and it is a lint rule rather than a test because
 * it holds for code not yet written.
 */
describe('the release view writes nothing', () => {
	it('reaches no write entry point, from any interaction on either screen', async () => {
		const applyWrites = vi.spyOn(frontmatter, 'applyWrites');
		const applyRestores = vi.spyOn(frontmatter, 'applyRestores');
		const createBacklogItem = vi.spyOn(createNote, 'createBacklogItem');
		const createAbsenceNote = vi.spyOn(absenceNotes, 'createAbsenceNote');
		const applyPropertyWrites = vi.spyOn(propertyWrite, 'applyPropertyWrites');

		const vault = scopeVault();
		const before = vault.files.size;
		const { view, config, containerEl } = makeReleaseView(vault, RELEASE_CONFIG, { base: 'Plan.base' });

		// Every input either screen offers, in the order a reader meets them. The index
		// first: a row is a native `<button>`, so Enter and Space arrive as the click below —
		// the browser synthesizes it, and there is no `keydown` listener in
		// `src/view/release/` for a dispatch to reach. The two `key()` dispatches that stood
		// here were deleted with the handler rather than left: jsdom synthesizes no click
		// either, so they reached nothing and read as coverage of a keyboard path this file
		// does not exercise. A right-click is kept because it IS a distinct gesture — it opens
		// a menu on every OTHER view this plugin ships.
		const indexRow = containerEl.querySelector<HTMLElement>('.pbl-rel-row');
		expect(indexRow).not.toBeNull();
		indexRow?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		(indexRow as HTMLElement).click();
		await flush();

		// The scope screen the click above opened: a row, its keys, its right-click, and the
		// one control that leaves — plus a data update on the way, which is the path Bases
		// itself drives and the one a stale batch would land on.
		const scopeRow = containerEl.querySelector<HTMLElement>('.pbl-row');
		expect(scopeRow).not.toBeNull();
		scopeRow?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		key(scopeRow as HTMLElement, 'Enter');
		(scopeRow as HTMLElement).click();
		view.onDataUpdated();
		await flush();
		containerEl.querySelector<HTMLElement>('.pbl-rel-back')?.click();
		await flush();

		// And the two the view offers itself rather than through an element.
		view.pick('R.md');
		view.pick(null);
		view.onunload();
		await flush();

		expect(applyWrites).not.toHaveBeenCalled();
		expect(applyRestores).not.toHaveBeenCalled();
		expect(createBacklogItem).not.toHaveBeenCalled();
		expect(createAbsenceNote).not.toHaveBeenCalled();
		expect(applyPropertyWrites).not.toHaveBeenCalled();
		// The spies are the check; these are the belt, and they fail for a write path that
		// reached the vault without going through any of the five.
		expect(vault.writeLog).toEqual([]);
		expect(vault.trashed).toEqual([]);
		// `mountLeaf` adds the `.base` itself and nothing since.
		expect(vault.files.size).toBe(before + 1);
		expect(config.setCalls).toEqual([]);
	});
});
