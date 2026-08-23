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
		key(containerEl.querySelector('.pbl-rel-row[data-path="0.9.md"]') as HTMLElement, 'Enter');
		expect(view.pickedPath).toBe('0.9.md');
		view.pick(null);
		key(containerEl.querySelector('.pbl-rel-row[data-path="0.9.md"]') as HTMLElement, ' ');
		expect(view.pickedPath).toBe('0.9.md');
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
		// The other three figures are still drawn, so the note names the version column and
		// nothing else — an absence report that swept up a configured column would read the
		// same at this length.
		expect(containerEl.querySelector('.pbl-rel-note')?.textContent).toContain('Version');
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

	it('reports the unresolved once, beneath the rows', () => {
		const vault = releaseVault();
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', release: '[[Nothing]]' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		expect(containerEl.querySelector('.pbl-rel-unresolved')?.textContent).toContain('1');
	});

	it('plans no write', async () => {
		const vault = releaseVault();
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		click(containerEl.querySelector('.pbl-rel-row') as HTMLElement);
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});
