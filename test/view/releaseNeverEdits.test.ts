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
 * **The claim this file checks has been narrowed twice.** It was *this view writes
 * nothing*; Task 5 of "releases own their creation" made it *creates notes and its own
 * config, never edits a note that already exists*; and
 * [[Editing a release from its own screen]] (2026-08-29) made it **creates release notes
 * and its own config, edits the RELEASE NOTE it is showing, and writes nothing else** — a
 * status pick and a description are edits to a note that already exists, and they were
 * asked for.
 *
 * So what this file states is no longer a ban on the edit path. It is the narrower,
 * still-load-bearing half of it: **none of the ordinary gestures below writes anything.**
 * Opening a release, walking its rows, right-clicking one, going back — the whole of what
 * a reader does that is not an edit — reaches no writer and no creator. The two gestures
 * that DO write are driven in `test/view/release/releaseEdits.test.ts`, which asserts what
 * they write and, more to the point, what they do not: the release note alone, never a
 * member.
 *
 * That makes `applyPropertyWrites` a spy on a PERMITTED call here, which is exactly the
 * reading the docblock below already insisted on for every assertion in this file: these
 * are not-called assertions taken after a FIXED list of gestures, so they say what this
 * script does and nothing about a gesture it does not make. Still a CATEGORY claim, still
 * checked at the forbidden thing rather than by listing the paths somebody thought of. `releaseView.test.ts` drives a named
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
 *   (the edit and its undo) and `applyPropertyWrites` (the plain key/value batches this
 *   view now plans TOO, for the release note's own status and description) — are the whole
 *   of the batch/gate write surface `CLAUDE.md`'s write-boundary rule names. The first two
 *   are refused anywhere in this directory: the item-batch path is the backlog's, and this
 *   view plans no hierarchy, no state and no placement. The third is refused only of the
 *   gestures below, per the header above. **What the spies
 *   deliver is narrower than that surface**: three not-called assertions taken after a
 *   fixed list of gestures, so a call fails here only where this script reaches it. It was
 *   proven false as written — a well-formed `applyPropertyWrites` call planted in
 *   `writeRelease` (`src/view/release/newRelease.ts`) left this whole file GREEN, because
 *   the script never presses `New release`; `test/view/release/newRelease.test.ts` is what
 *   reddened, at the vault. They stay asserted here because the narrowed claim still says
 *   these gestures write nothing, and the honest reading of that is "no gesture below
 *   reaches a writer".
 *
 *   **Two of `storage/`'s four note creators** — `createResourceNote` and
 *   `createAbsenceNote` — are ALSO still spied and asserted not-called, and staying so is
 *   not an oversight either narrowing missed: a resource and an absence are notes this
 *   view has no business naming at all. `createRelease` and, since the scope tree's row
 *   menu landed, `createBacklogItem` are permitted and are deliberately NOT spied here —
 *   asserting either uncalled would be the same mistake in the other direction,
 *   re-encoding the old broad claim for the two functions the narrowed claim exists to
 *   allow. Both are one press from red for a gesture the claim permits: `New release` on
 *   the index, and `New <child>` on a scope row (`src/view/release/scopeCreate.ts`), whose
 *   own vault assertions live in `test/view/release/scopeCreate.test.ts` for the reason
 *   this one cannot carry them — the script below opens that menu and picks nothing.
 *   Nothing under `src/view/release/` imports either still-banned creator today — this spy
 *   is what makes the next one that does fail here rather than pass silently.
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
 *   binds (`runReleaseInit`) is reached from either the `New release` press or the ✨'s
 *   own, and the script presses neither.
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
describe('the release view writes nothing on the gestures that are not edits', () => {
	it('reaches no writer at all, across the interactions this script drives', async () => {
		const applyWrites = vi.spyOn(frontmatter, 'applyWrites');
		const applyRestores = vi.spyOn(frontmatter, 'applyRestores');
		const applyPropertyWrites = vi.spyOn(propertyWrite, 'applyPropertyWrites');
		const createResourceNote = vi.spyOn(createNote, 'createResourceNote');
		const createAbsenceNote = vi.spyOn(absenceNotes, 'createAbsenceNote');

		const vault = scopeVault();
		const before = vault.files.size;
		const { view, config, containerEl } = makeReleaseView(vault, RELEASE_CONFIG, { base: 'Plan.base' });

		// A fixed subset of what either screen offers, in the order a reader meets them —
		// not every input either screen offers: the scope screen has since grown a
		// disclosure, three toolbar controls (collapse all, expand all, hide done) and the
		// bar's own ✨, none driven here. That is narrower than this script's own name once
		// claimed, and the honest reading is still the one this file's docblock states
		// throughout — a call on a path this fixed script does not drive is invisible to
		// it. The index first: a row is a native `<button>`, so Enter and Space arrive as
		// the click below — the browser synthesizes it, and there is no `keydown` listener
		// in `src/view/release/` for a dispatch to reach. The two `key()` dispatches that
		// stood here were deleted with the handler rather than left: jsdom synthesizes no
		// click either, so they reached nothing and read as coverage of a keyboard path
		// this file does not exercise. A right-click is kept because it IS a distinct
		// gesture — it opens a menu on every OTHER view this plugin ships, and on the SCOPE
		// screen it now opens one here too.
		const indexRow = containerEl.querySelector<HTMLElement>('.pbl-rel-band');
		expect(indexRow).not.toBeNull();
		indexRow?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		(indexRow as HTMLElement).click();
		await flush();

		// The scope screen the click above opened: a row, its keys, its right-click — which
		// since `scopeCreate.ts` landed opens a menu of creates and, unpicked, still writes
		// nothing — and the one control that leaves — plus a data update on the way, which is the path Bases
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
		expect(createResourceNote).not.toHaveBeenCalled();
		expect(createAbsenceNote).not.toHaveBeenCalled();
		// The spies are the check; these are the belt, and they fail for a write that
		// reached the vault without going through any of them — including an edit via
		// `updateAbsenceNote`, which no spy above names (see the docblock's second bullet).
		expect(vault.writeLog).toEqual([]);
		expect(vault.trashed).toEqual([]);
		// `mountLeaf` adds the `.base` itself and nothing since. Two controls on these screens
		// create something and neither is pressed: `.pbl-rel-new` on the index, and the scope
		// row menu's `New <child>` — the right-click below OPENS that menu, which is the whole
		// of what a right-click does, and this script never picks an entry from it.
		expect(vault.files.size).toBe(before + 1);
		expect(config.setCalls).toEqual([]);
	});
});
