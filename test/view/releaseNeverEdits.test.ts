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
 * guard for the paths that exist. This one names the forbidden CALLS rather than reading
 * the vault after the fact — which is a better statement of the rule and not a wider
 * reach: it is still a fixed gesture script, and a call on a path the script does not
 * drive is invisible to it. A check that held for a path nobody has written yet would
 * have to be a lint rule, and these three functions have none.
 *
 * **The creation path Task 7 wired in is not one of them, and this file does not drive
 * it.** `New release` is on the index screen this script renders, and the script never
 * presses it; what that gesture puts in the vault is asserted where it is driven, in
 * `test/view/release/newRelease.test.ts`, against `writeLog` and `trashed` for this same
 * claim. So every assertion below narrows to the script below — the spies as much as the
 * vault and config readings. All of them say what these gestures did and nothing about a
 * gesture this file does not make.
 *
 * **Three layers, and each sees what the one above it cannot.**
 *
 * - The first spies on two disjoint sets, both asserted not-called, for two different
 *   reasons. **The three EDIT-BATCH entry points** — `applyWrites` and `applyRestores`
 *   (the edit and its undo) and `applyPropertyWrites` (the estimation view's plain
 *   key/value batches — a shape this view's own bind deliberately never took, since
 *   backfilling is editing a note that already exists) — are the whole of the
 *   batch/gate write surface `CLAUDE.md`'s write-boundary rule names. **What the spies
 *   deliver is narrower than that surface**: three not-called assertions taken after a
 *   fixed list of gestures, so a call fails here only where this script reaches it. It was
 *   proven false as written — a well-formed `applyPropertyWrites` call planted in
 *   `writeRelease` (`src/view/release/newRelease.ts`) left this whole file GREEN, because
 *   the script never presses `New release`; `test/view/release/newRelease.test.ts` is what
 *   reddened, at the vault. They stay banned here because the narrowed claim still forbids
 *   editing a note that already exists, and the honest reading of that ban is "no gesture
 *   below reaches one".
 *
 *   **Three of `storage/`'s four note creators** — `createBacklogItem`,
 *   `createResourceNote` and `createAbsenceNote` — are ALSO still spied and asserted
 *   not-called, and staying so is not an oversight the narrowing missed: "creates notes"
 *   in the new claim means this view creates RELEASES, the one type it has any business
 *   naming, not that it may call any creator in `storage/`. `createRelease` alone is
 *   permitted and is deliberately NOT spied here — asserting it uncalled would be the
 *   same mistake in the other direction, re-encoding the old broad claim for the one
 *   function the narrowed claim exists to allow. Task 7 has since wired it into the
 *   `New release` control, so such a spy would now be one press from red for a gesture the
 *   claim permits. Nothing under `src/view/release/`
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
 *   here too, and the reason is now narrower than it was: this fixed interaction script
 *   (index row click and right-click, scope row, back, `pick`, `unload`) does not press
 *   `.pbl-rel-new`, the one control on either screen that reaches a creator at all.
 * - `config.setCalls` is the `.base` itself, the third thing a Bases view can write. The
 *   narrowed claim permits this view to bind its own config (the same shape `runInit`
 *   uses for the tree, and `runEstimationInit` for the estimation view), so this
 *   assertion is no longer "no code anywhere may call config.set" — it is "nothing this
 *   fixed interaction script does calls it," which stays true because the one action that
 *   binds (`runReleaseInit`) is reached from the `New release` press alone, and the script
 *   never presses it.
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
	it('reaches no edit entry point, across the interactions this script drives', async () => {
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
		// presses `.pbl-rel-new`, the only control on either screen that creates anything.
		expect(vault.files.size).toBe(before + 1);
		expect(config.setCalls).toEqual([]);
	});
});
