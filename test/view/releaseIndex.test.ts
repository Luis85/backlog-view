// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, releaseVault } from '../helpers/release';
import { click } from '../helpers/estimation';
import { flush, useViewHarness } from '../helpers/view';

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

	/** The column-width properties the grid element carries, in the order they were set. */
	const publishedWidths = (grid: HTMLElement): string[] =>
		[...grid.style].filter((name) => name.startsWith('--pbl-rel-w-'));

	/** What each FIGURE cell of one row — or of the heading — points its width at. The name
	 *  cell is skipped: it takes the slack rather than a published width. */
	const widthRefs = (rowEl: HTMLElement): string[] =>
		[...rowEl.children].slice(1).map((cell) => (cell as HTMLElement).style.getPropertyValue('--pbl-rel-w'));

	it('draws one row per release, in the domain module’s order', () => {
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const names = [...containerEl.querySelectorAll('.pbl-rel-name')].map((el) => el.textContent);
		expect(names).toEqual(['0.8', '0.9', 'Someday']);
		// The column widths are the VIEW's, published one custom property per column drawn —
		// which is what lines the figures up now that each row lays out its own cells. Asserted
		// here at the fully configured shape and again below with a column dropped, since a
		// call that never ran leaves the partial's fallback standing and every other assertion
		// in this file green.
		const grid = containerEl.querySelector('.pbl-rel-grid') as HTMLElement;
		expect(publishedWidths(grid)).toEqual(['--pbl-rel-w-0', '--pbl-rel-w-1', '--pbl-rel-w-2', '--pbl-rel-w-3']);
		// Every cell holds a REFERENCE to its column's property, never a number — the tree's
		// own rule in `render/columns.ts`, and what makes the container the single place a
		// width is stated.
		//
		// The HEADING is asserted beside the rows and against the SAME list, because the
		// heading is half the claim `columnWidthVar`'s docstring makes and the half a row
		// assertion cannot see: dropping `sizeCell` from the heading loop leaves every heading
		// at the partial's 96px fallback while the rows sit at 104/132/128/64 — the columns
		// stop lining up with their labels — and tsc, eslint and every other test in this
		// repository still pass. Watched red on 2026-08-23.
		const refs = ['var(--pbl-rel-w-0, 104px)', 'var(--pbl-rel-w-1, 132px)', 'var(--pbl-rel-w-2, 128px)', 'var(--pbl-rel-w-3, 64px)'];
		expect(widthRefs(containerEl.querySelector('.pbl-rel-head') as HTMLElement)).toEqual(refs);
		for (const row of containerEl.querySelectorAll('.pbl-rel-row')) expect(widthRefs(row as HTMLElement)).toEqual(refs);
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

	it('makes every row a real button, so a keyboard can reach and press it', () => {
		// The index-to-scope transition is this view's ENTIRE navigation. A pointer-only
		// row would make the release view unreachable for a keyboard or screen-reader
		// user, which no amount of correct derivation behind it makes acceptable.
		//
		// **jsdom cannot answer whether a row is FOCUSABLE**, and this test does not claim
		// to. jsdom applies no box model, so `display: contents` — which is what closed this
		// screen to the keyboard until 2026-08-23 — is invisible to it, and the test that
		// stood here read `tabIndex` and dispatched `keydown` at the element directly: both
		// pass on an element no user can reach. What is asserted here is what jsdom can
		// honestly see — the ELEMENT, which is what delegates the tab stop, Enter, Space and
		// Space-does-not-scroll to the browser, its accessible name, and that activating it
		// picks the release. Reachability itself was measured in headless Chromium; see
		// `.superpowers/sdd/…/task-11-keyboard-report.md`.
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const rows = [...containerEl.querySelectorAll('.pbl-rel-row')] as HTMLButtonElement[];
		expect(rows).toHaveLength(3);
		expect(rows.map((el) => el.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
		// `type="button"`, or a row nested in a form would submit it.
		expect(rows.map((el) => el.type)).toEqual(['button', 'button', 'button']);
		// The row's own content is its accessible name, so a reader hears the release and its
		// figures rather than an unnamed control.
		expect(rows[0]?.textContent).toBe('0.80.8.02026-09-12In progress0');
		click(containerEl.querySelector('.pbl-rel-row[data-path="0.9.md"]') as HTMLElement);
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
		// BOTH directions, because either alone passes on a report that names the wrong set.
		// `toContain('Version')` alone is satisfied by a note listing every column there is —
		// which is what dropping the `unconfigured` filter produces, and it stayed green.
		const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
		expect(note).toContain('Version');
		for (const drawn of ['Target', 'Status', 'Items']) expect(note).not.toContain(drawn);
		// The dropped column takes its published width with it, or the cells read a column
		// that is not drawn.
		const grid = containerEl.querySelector('.pbl-rel-grid') as HTMLElement;
		expect(publishedWidths(grid)).toEqual(['--pbl-rel-w-0', '--pbl-rel-w-1', '--pbl-rel-w-2']);
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
		const cells = [...row.querySelectorAll(':scope > span')].map((el) => el.textContent);
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

describe('what a release row says, as opposed to what it shows', () => {
	useViewHarness();

	it('names every figure it drew, so the columns survive being spoken', () => {
		// The row is a `<button>`, so its accessible name is its own contents run together:
		// "0.8 0.8.0 2026-09-12 In progress 0" — five values and nothing saying which is
		// which, because the headings are a separate element the button does not reference.
		// The grid gives the eye those pairs through position, which is the one channel a
		// screen reader does not have.
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const label = containerEl.querySelector('.pbl-rel-row[data-path="0.8.md"]')?.getAttribute('aria-label') ?? '';

		expect(label).toContain('0.8');
		// Each figure arrives with its own heading, not bare.
		expect(label).toContain('Version 0.8.0');
		expect(label).toContain('Status In progress');
		expect(label).toContain('Items 0 members');
		// The date is spoken as the cell draws it — the user's own locale, via `formatCivil`.
		expect(label).toMatch(/Target \S/);
	});

	it('says nothing about a column whose cell it drew empty', () => {
		// An announced "Version" with no version is worse than no mention, and the cell for
		// it is blank — so silence is what agrees with the screen.
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const label = containerEl.querySelector('.pbl-rel-row[data-path="Someday.md"]')?.getAttribute('aria-label') ?? '';

		expect(label).toContain('Someday');
		expect(label).not.toContain('Version');
		// The undated target IS spoken, because it is the one absence the row draws: it is
		// why the row sits at the bottom of a list sorted by that column.
		expect(label).toContain('No target date');
	});

	it('drops a column from the spoken name exactly when it drops it from the grid', () => {
		// One list decides both, so an unbound key cannot leave a heading behind in speech.
		const { containerEl } = makeReleaseView(releaseVault(), { ...RELEASE_CONFIG, versionProperty: '' });
		const label = containerEl.querySelector('.pbl-rel-row[data-path="0.8.md"]')?.getAttribute('aria-label') ?? '';

		expect(label).not.toContain('Version');
		expect(label).toContain('Status In progress');
	});
});
