// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as frontmatter from '../../src/storage/frontmatter';
import * as propertyWrite from '../../src/storage/propertyWrite';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { flush, key, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The increment's central claim used to be **this view writes nothing**; Task 5 of
 * "releases own their creation" narrowed it to what the view actually keeps once it has
 * its own door: **this view creates notes and its own config. It never edits a note that
 * already exists.** Still a CATEGORY claim, so it is still checked at the forbidden thing
 * rather than by listing the paths somebody thought of — narrowing it changed which
 * things are forbidden, not how they are checked. `releaseView.test.ts` drives a named
 * list of interactions and asserts a clean vault after them; that one is a regression
 * guard for the paths that exist. This one puts the check on the calls, which holds for a
 * path nobody has written yet — including the creation path Task 7 has not wired in.
 *
 * **Three layers, and each sees what the one above it cannot.**
 *
 * - The three spies are every function in `storage/` that EDITS a note that already
 *   exists — `applyWrites` and `applyRestores` (the edit and its undo) and
 *   `applyPropertyWrites` (the estimation view's plain key/value batches, the same shape
 *   Task 6's backfill will use). `CLAUDE.md`'s write-boundary rule is that these three
 *   are the whole of the EDIT surface, so a call to one of them from anywhere under
 *   `src/view/release/` fails here whatever screen or gesture reached it. The note
 *   creators — `createBacklogItem`, `createResourceNote`, `createRelease` and
 *   `createAbsenceNote` — are NOT spied here any more: the narrowed claim permits this
 *   view to call them, so an assertion that none of them ran would be re-asserting the
 *   broader claim by accident and would turn red the moment Task 7 wires a creator in,
 *   for a reason that is no longer true. `releaseNeverEdits` is the file's own answer to
 *   which three those are.
 * - `vault.writeLog`, `vault.trashed` and `vault.files` are the boundary the three spies
 *   END at, so they catch an edit that reached a note WITHOUT going through any of them
 *   — a raw `processFrontMatter`, which is exactly the shape a spy on the three cannot
 *   see. That layer was watched failing: a temporary
 *   `this.app.fileManager.processFrontMatter(...)` in `renderIndex.ts` reddened it while
 *   all three spies stayed clean. `writeLog` and `trashed` keep the SAME meaning they had
 *   before narrowing — processFrontMatter and trashFile are still fully banned, whatever
 *   called them — so those two assertions are unchanged. `vault.files.size` is the one
 *   number whose MEANING moved: creation is now permitted, so a legitimate call through
 *   `createRelease` would grow it exactly as a raw, unsanctioned `app.vault.create` would,
 *   and the count alone cannot tell the two apart any more. It still asserts `before + 1`
 *   here, honestly, because nothing this test drives calls a creator — Task 7 wires the
 *   control elsewhere, and this fixed interaction script never clicks it — so what the
 *   assertion still catches is a create reached from a gesture THIS script exercises that
 *   is not supposed to create anything at all. It is narrower than it reads, and that is
 *   the corner to know about rather than round off.
 * - `config.setCalls` is the `.base` itself, the third thing a Bases view can write. The
 *   narrowed claim permits this view to bind its own config (the same shape `runInit`
 *   uses for the tree, and `runEstimationInit` for the estimation view), so this
 *   assertion is no longer "no code anywhere may call config.set" — it is "nothing this
 *   fixed interaction script does calls it," which stays true because nothing driven here
 *   reaches the bind-and-backfill action Task 6 adds.
 *
 * What none of the three sees is a write reached from a module this view does not import
 * yet. `WRITE_BOUNDARY` in `eslint.config.mjs` is that statement for the two arms still
 * banned in `src/view/release/` — `processFrontMatter` and save/loadLocalStorage — with no
 * `ignores` entry loosening either. Its third arm, `vault.create`, is deliberately NOT
 * banned in this directory any more (see the `RELEASE` block there for why); this suite is
 * the only thing left holding the creation-only shape of the claim for a gesture that is
 * not supposed to create anything, which is exactly what the note above says the third
 * bullet is narrower than it reads.
 */
describe('the release view never edits a note that already exists', () => {
	it('reaches no edit entry point, from any interaction on either screen', async () => {
		const applyWrites = vi.spyOn(frontmatter, 'applyWrites');
		const applyRestores = vi.spyOn(frontmatter, 'applyRestores');
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
		expect(applyPropertyWrites).not.toHaveBeenCalled();
		// The spies are the check; these are the belt, and they fail for an edit that
		// reached the vault without going through any of the three. `files.size` no longer
		// polices creation as a category — see the docblock's third bullet for what it still
		// catches and what it cannot.
		expect(vault.writeLog).toEqual([]);
		expect(vault.trashed).toEqual([]);
		// `mountLeaf` adds the `.base` itself and nothing since — none of the gestures above
		// creates a release, because none of them is Task 7's control.
		expect(vault.files.size).toBe(before + 1);
		expect(config.setCalls).toEqual([]);
	});
});
