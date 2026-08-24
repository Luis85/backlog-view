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
 * - The first spies on two disjoint sets, both asserted not-called, for two different
 *   reasons. **The three EDIT-BATCH entry points** — `applyWrites` and `applyRestores`
 *   (the edit and its undo) and `applyPropertyWrites` (the estimation view's plain
 *   key/value batches, the same shape Task 6's backfill will use) — are the whole of the
 *   batch/gate write surface `CLAUDE.md`'s write-boundary rule names, so a call to one of
 *   them from anywhere under `src/view/release/` fails here whatever screen or gesture
 *   reached it. They stay banned because the narrowed claim still forbids editing a note
 *   that already exists.
 *
 *   **Three of `storage/`'s four note creators** — `createBacklogItem`,
 *   `createResourceNote` and `createAbsenceNote` — are ALSO still spied and asserted
 *   not-called, and staying so is not an oversight the narrowing missed: "creates notes"
 *   in the new claim means this view creates RELEASES, the one type it has any business
 *   naming, not that it may call any creator in `storage/`. `createRelease` alone is
 *   permitted and is deliberately NOT spied here — asserting it uncalled would be the
 *   same mistake in the other direction, re-encoding the old broad claim for the one
 *   function the narrowed claim exists to allow, and it would turn red the moment Task 7
 *   wires it into a gesture this file does not drive. Nothing under `src/view/release/`
 *   imports any of the three still-banned creators today, and neither Task 6 nor Task 7
 *   introduces one — this spy is what makes the next one that does fail here rather than
 *   pass silently.
 * - `vault.writeLog`, `vault.trashed` and `vault.files` are the boundary those spies END
 *   at, so they catch a write that reached a note WITHOUT going through any of them — a
 *   raw `processFrontMatter` or `vault.create`, which is exactly the shape a spy on
 *   named functions cannot see. That layer was watched failing: a temporary
 *   `this.app.fileManager.processFrontMatter(...)` in `renderIndex.ts` reddened it while
 *   every spy stayed clean. `writeLog` asserts what it always has —
 *   `processFrontMatter` is still fully banned in this directory (see `WRITE_BOUNDARY` in
 *   `eslint.config.mjs`, which carries no exemption for it here), so an empty log is
 *   still sufficient evidence that no edit reached the vault, whatever called it. The
 *   sentence it does NOT prove on its own is "every EDIT function is spied" —
 *   `updateAbsenceNote` (`storage/absenceNotes.ts`) also edits an existing note through
 *   `processFrontMatter` and is not one of the three above; `writeLog` is what still
 *   catches a call to it, not a fourth spy. `vault.files.size` still asserts `before + 1`
 *   here too, for the same reason it always did: nothing this fixed interaction script
 *   drives (index click, scope row, back, pick, unload) is Task 7's control, so no
 *   creator — permitted or still-banned — is reachable from it.
 * - `config.setCalls` is the `.base` itself, the third thing a Bases view can write. The
 *   narrowed claim permits this view to bind its own config (the same shape `runInit`
 *   uses for the tree, and `runEstimationInit` for the estimation view), so this
 *   assertion is no longer "no code anywhere may call config.set" — it is "nothing this
 *   fixed interaction script does calls it," which stays true because nothing driven here
 *   reaches the bind-and-backfill action Task 6 adds.
 *
 * What none of the three sees is a write reached from a module this view does not import
 * yet. `WRITE_BOUNDARY` in `eslint.config.mjs` is that statement, unchanged by this
 * narrowing: it bans `processFrontMatter`, `vault.create` and `load/saveLocalStorage`
 * across the whole of `src/view/`, `src/view/release/` included, with no `ignores` entry
 * loosening any of the three there. `createRelease` reaches `app.vault.create` from
 * inside `storage/`, which the rule has never named — the boundary was never about this
 * view calling a sanctioned creator, only about it reaching the vault directly, and that
 * stays refused exactly as it was before Task 5.
 */
describe('the release view never edits a note that already exists', () => {
	it('reaches no edit entry point, from any interaction on either screen', async () => {
		const applyWrites = vi.spyOn(frontmatter, 'applyWrites');
		const applyRestores = vi.spyOn(frontmatter, 'applyRestores');
		const applyPropertyWrites = vi.spyOn(propertyWrite, 'applyPropertyWrites');
		const createBacklogItem = vi.spyOn(createNote, 'createBacklogItem');
		const createResourceNote = vi.spyOn(createNote, 'createResourceNote');
		const createAbsenceNote = vi.spyOn(absenceNotes, 'createAbsenceNote');

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
		expect(createBacklogItem).not.toHaveBeenCalled();
		expect(createResourceNote).not.toHaveBeenCalled();
		expect(createAbsenceNote).not.toHaveBeenCalled();
		// The spies are the check; these are the belt, and they fail for a write that
		// reached the vault without going through any of them — including an edit via
		// `updateAbsenceNote`, which no spy above names (see the docblock's second bullet).
		expect(vault.writeLog).toEqual([]);
		expect(vault.trashed).toEqual([]);
		// `mountLeaf` adds the `.base` itself and nothing since — none of the gestures above
		// creates a release, because none of them is Task 7's control.
		expect(vault.files.size).toBe(before + 1);
		expect(config.setCalls).toEqual([]);
	});
});
