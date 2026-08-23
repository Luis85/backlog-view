// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, releaseVault } from '../helpers/release';
import { click } from '../helpers/estimation';
import { flush, key, useViewHarness } from '../helpers/view';

/**
 * The index screen: one row per release, the two notes beneath the grid, and the two
 * inputs that open a release.
 *
 * `click` comes from `../helpers/estimation` because that is where it lives — the release
 * helper deliberately re-exports nothing it does not need, and a second copy of a
 * three-line dispatcher is a second thing to keep in step.
 */
describe('the release index', () => {
	useViewHarness();

	it('draws one row per release, in the domain module’s order', () => {
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const names = [...containerEl.querySelectorAll('.pbl-rel-name')].map((el) => el.textContent);
		expect(names).toEqual(['0.8', '0.9', 'Someday']);
		// The grid's track list is the VIEW's, because the column count is — one track per
		// column actually drawn. Asserted here at the fully configured shape and again below
		// with a column dropped, since a call that never ran leaves the partial's fallback
		// standing and every other assertion in this file green.
		const grid = containerEl.querySelector('.pbl-rel-grid') as HTMLElement;
		expect(grid.style.getPropertyValue('--pbl-rel-columns')).toBe('1fr auto auto auto auto');
		// EVERY chip on this screen is the read-only one, stated as the category rather than
		// as three places: the view offers no write, and
		// `.pbl-state-chip:not(.pbl-state-static):hover` would give a chip that lost the class
		// a hover affordance — the screen would look editable.
		expect(containerEl.querySelectorAll('.pbl-state-chip')).toHaveLength(3);
		expect(containerEl.querySelectorAll('.pbl-state-chip:not(.pbl-state-static)')).toHaveLength(0);
	});

	it('opens a release when its row is clicked', () => {
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		click(containerEl.querySelector('.pbl-rel-row[data-path="0.8.md"]') as HTMLElement);
		expect(view.pickedPath).toBe('0.8.md');
	});

	it('opens a release from the keyboard, and puts every row in the tab order', () => {
		// The index-to-scope transition is this view's ENTIRE navigation. A pointer-only
		// row would make the release view unreachable for a keyboard or screen-reader
		// user, which no amount of correct derivation behind it makes acceptable.
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const rows = [...containerEl.querySelectorAll('.pbl-rel-row')] as HTMLElement[];
		expect(rows).toHaveLength(3);
		expect(rows.every((el) => el.tabIndex === 0)).toBe(true);
		expect(rows.every((el) => el.getAttribute('role') === 'button')).toBe(true);
		const entered = key(containerEl.querySelector('.pbl-rel-row[data-path="0.9.md"]') as HTMLElement, 'Enter');
		expect(view.pickedPath).toBe('0.9.md');
		view.pick(null);
		const spaced = key(containerEl.querySelector('.pbl-rel-row[data-path="0.9.md"]') as HTMLElement, ' ');
		expect(view.pickedPath).toBe('0.9.md');
		// Both keys are CONSUMED. Space that activates the row and also reaches the scroller
		// pages the list out from under the reader, which is a keyboard defect the pick
		// landing correctly says nothing about.
		expect([entered.defaultPrevented, spaced.defaultPrevented]).toEqual([true, true]);
	});

	it('names an unconfigured column ONCE, and never blanks it per row', () => {
		const { containerEl } = makeReleaseView(releaseVault(), { ...RELEASE_CONFIG, versionProperty: '' });
		// Asserted BEFORE the absences, because every assertion below this one passes on a
		// screen that drew nothing at all: `toHaveLength(0)` is what a broken render gives
		// too. The rows are what make the two that follow mean "absent" rather than "empty".
		expect([...containerEl.querySelectorAll('.pbl-rel-name')].map((el) => el.textContent)).toEqual([
			'0.8',
			'0.9',
			'Someday',
		]);
		expect(containerEl.querySelectorAll('.pbl-rel-version')).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-rel-note')).toHaveLength(1);
		// BOTH directions, because either alone passes on a report that names the wrong set.
		// `toContain('Version')` alone is satisfied by a note listing every column there is —
		// which is what dropping the `unconfigured` filter produces, and it stayed green.
		const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
		expect(note).toContain('Version');
		for (const drawn of ['Target', 'Status', 'Items']) expect(note).not.toContain(drawn);
		// The dropped column takes its track with it, or four cells spread over five tracks.
		const grid = containerEl.querySelector('.pbl-rel-grid') as HTMLElement;
		expect(grid.style.getPropertyValue('--pbl-rel-columns')).toBe('1fr auto auto auto');
		expect(containerEl.querySelectorAll('.pbl-state-chip')).toHaveLength(3);
	});

	it('says unreadable rather than absent when somebody wrote something there', () => {
		const vault = releaseVault();
		vault.addFile('Bad.md', { frontmatter: { type: 'Release', 'target-date': 'soon' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const row = containerEl.querySelector('.pbl-rel-row[data-path="Bad.md"]') as HTMLElement;
		expect(row.querySelector('.pbl-rel-unreadable')).not.toBeNull();
		// A release with the key simply unset is the OTHER answer, in the same render.
		const someday = containerEl.querySelector('.pbl-rel-row[data-path="Someday.md"]') as HTMLElement;
		expect(someday.querySelector('.pbl-rel-unreadable')).toBeNull();
		expect(someday.querySelector('.pbl-rel-undated')).not.toBeNull();
	});

	it('labels only the absence that moved the row, and leaves the others as an empty cell', () => {
		// The THIRD answer, beside unconfigured and unreadable: a key that is bound and that
		// this note simply does not carry. The register rules on the other two (Releases as
		// their own type 3a/3b) and not on this one, so `renderIndex.ts` states the rule and
		// this is what holds it — see the docstring on `columnSpecs`.
		//
		// `Someday.md` carries a status, no version, no target date and nothing naming it. Only the
		// target date is labelled, because only the target date decided where the row is:
		// extension 3a puts an undated release after every dated one, so a blank cell there
		// would leave the reader no way to explain the position.
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const row = containerEl.querySelector('.pbl-rel-row[data-path="Someday.md"]') as HTMLElement;
		const cells = [...row.querySelectorAll(':scope > div')].map((el) => el.textContent);
		expect(cells).toEqual(['Someday', '', 'No target date', 'Idea', '0']);
	});

	it('reports the unresolved once, beneath the rows', () => {
		const vault = releaseVault();
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', release: '[[Nothing]]' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		// The whole sentence, not `toContain('1')` — that one is satisfied by ELEVEN, and a
		// count arrived at some other way is exactly what this line exists to catch.
		expect(containerEl.querySelector('.pbl-rel-unresolved')?.textContent).toBe(
			'1 item names a release that could not be resolved.',
		);
	});

	it('plans no write', async () => {
		const vault = releaseVault();
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		click(containerEl.querySelector('.pbl-rel-row') as HTMLElement);
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});
