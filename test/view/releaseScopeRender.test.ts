// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { click } from '../helpers/estimation';
import { useViewHarness } from '../helpers/view';
import { badgeStyleFor } from '../../src/view/render/badges';
import { FakeVault } from '../helpers/vault';

/**
 * One release's screen: the header's facts, and the members drawn as the tree they
 * already are.
 *
 * `click` comes from `../helpers/estimation` because that is where it lives — the release
 * helper deliberately re-exports nothing it does not need.
 */
describe("a release's scope on screen", () => {
	useViewHarness();

	function openScope(): { view: ReturnType<typeof makeReleaseView>['view']; containerEl: HTMLElement } {
		const { view, containerEl } = makeReleaseView(scopeVault(), RELEASE_CONFIG);
		view.pick('R.md');
		return { view, containerEl };
	}

	it('indents by its own depth and marks the context ancestor', () => {
		const { containerEl } = openScope();
		const rows = [...containerEl.querySelectorAll('.pbl-row')] as HTMLElement[];
		expect(rows.map((el) => el.dataset.path)).toEqual(['E.md', 'F1.md', 'F2.md']);
		// The scope's OWN depth, which re-roots at the release: the Epic is 0 here whatever
		// the backlog would call it.
		expect(rows.map((el) => el.style.getPropertyValue('--pbl-depth'))).toEqual(['0', '1', '1']);
		// Both directions. A renderer that marked every row would pass the first assertion
		// alone, and that is the mutation the class exists to fail.
		expect(rows.map((el) => el.classList.contains('pbl-rel-context'))).toEqual([true, false, false]);
	});

	it('marks the context row with a sentence that is TRUE of it', () => {
		// A release-scope context ancestor is IN the base's filter — `releaseScope` skips an
		// `outsideFilter` ancestor outright, so every context row it can draw is an included
		// row. The tree's own marker says the opposite ("Not in this base's filter"), so
		// reusing its sentence here mislabels every row it is on, and reusing its styling
		// without a sentence leaves the icon unlabelled. Asserting the element exists is what
		// let the wrong label through; the LABEL is the assertion.
		const { containerEl } = openScope();
		const rows = [...containerEl.querySelectorAll('.pbl-row')] as HTMLElement[];
		const marker = rows[0].querySelector('.pbl-outside-marker') as HTMLElement;
		expect(marker.dataset.tooltip).toBe('In this base, but not in this release — shown to keep the hierarchy');
		expect(marker.getAttribute('aria-label')).toBe(marker.dataset.tooltip);
		// A member is not scaffolding and carries no marker.
		expect(rows[1].querySelector('.pbl-outside-marker')).toBeNull();
	});

	it('gives no row in the tree a state chip or a count', () => {
		// This view binds no item state property at all, so a chip on a row could only ever
		// be a number or a value derived from something the screen cannot read. The release's
		// OWN status is a chip in the header, which is why this asks the tree rather than the
		// container — an assertion over the whole screen would pass with the header's chip
		// gone.
		const { containerEl } = openScope();
		const tree = containerEl.querySelector('.pbl-tree') as HTMLElement;
		expect(tree.querySelectorAll('.pbl-state-chip')).toHaveLength(0);
		expect(tree.querySelectorAll('.pbl-count')).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-rel-header .pbl-state-chip')).toHaveLength(1);
	});

	it('announces the hierarchy, not just an indent', () => {
		// `--pbl-depth` is styling and says nothing to a screen reader. Without these the
		// scope is announced as a flat list of divs, on the one screen whose whole promise
		// is the shape of the work.
		const { containerEl } = openScope();
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('tree');
		const rows = [...containerEl.querySelectorAll('.pbl-row')];
		expect(rows.map((el) => el.getAttribute('role'))).toEqual(rows.map(() => 'treeitem'));
		expect(rows.map((el) => el.getAttribute('aria-level'))).toEqual(['1', '2', '2']);
		// Position is among SIBLINGS at that level, never the index in the flat row list —
		// which is why the fixture holds two members: with one, the two readings agree and
		// this says nothing. Flat indices would be 1/2/3 of 3.
		expect(rows.map((el) => el.getAttribute('aria-posinset'))).toEqual(['1', '1', '2']);
		expect(rows.map((el) => el.getAttribute('aria-setsize'))).toEqual(['1', '2', '2']);
	});

	it('closes a sibling group when the tree comes back up a level', () => {
		// TWO context Epics with two members each, because `scopeVault()` has one parent and
		// cannot see the rule at all: with a single group, "close the open group when a
		// shallower row arrives" is unexercised, and deleting the line that does it leaves
		// every other assertion in this file green. Under that mutation the four members
		// share one group and announce `1..4 of 4`.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E1.md', { frontmatter: { type: 'Epic', order: 1 } });
		vault.addFile('E2.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', parent: 'E1', order: 1, release: '[[R]]' } });
		vault.addFile('A2.md', { frontmatter: { type: 'Feature', parent: 'E1', order: 2, release: '[[R]]' } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', parent: 'E2', order: 1, release: '[[R]]' } });
		vault.addFile('B2.md', { frontmatter: { type: 'Feature', parent: 'E2', order: 2, release: '[[R]]' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		const rows = [...containerEl.querySelectorAll('.pbl-row')] as HTMLElement[];
		expect(rows.map((el) => el.dataset.path)).toEqual(['E1.md', 'A1.md', 'A2.md', 'E2.md', 'B1.md', 'B2.md']);
		expect(rows.map((el) => el.getAttribute('aria-posinset'))).toEqual(['1', '1', '2', '2', '1', '2']);
		expect(rows.map((el) => el.getAttribute('aria-setsize'))).toEqual(['2', '2', '2', '2', '2', '2']);
	});

	it('badges each row with its own type', () => {
		// The badge is what says a Feature is a Feature on a screen with no columns at all.
		// Nothing else in this file looks at it, so without this the whole block can be
		// deleted with the suite green.
		const { containerEl } = openScope();
		const rows = [...containerEl.querySelectorAll('.pbl-row')] as HTMLElement[];
		expect(rows.map((el) => el.querySelector('.pbl-badge-text')?.textContent)).toEqual([
			'Epic',
			'Feature',
			'Feature',
		]);
		// The class and the icon come off `badgeStyleFor`, so a badge drawn with neither
		// would still read correctly and colour as nothing.
		const badge = rows[0].querySelector('.pbl-badge') as HTMLElement;
		expect(badge.classList.contains(badgeStyleFor('Epic').badge)).toBe(true);
		expect(badge.querySelector('.pbl-badge-icon')?.dataset.icon).toBe(badgeStyleFor('Epic').icon);
	});

	it('names the tree after the release and tooltips every title', () => {
		// Both were stated in a comment and neither was checked. The tree's name is what a
		// reader arriving at it hears; the tooltip is set unconditionally because measuring a
		// row to decide would lay out a `content-visibility: auto` row by itself.
		const { containerEl } = openScope();
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('aria-label')).toBe('R');
		const titles = [...containerEl.querySelectorAll('.pbl-title')] as HTMLElement[];
		expect(titles.map((el) => el.dataset.tooltip)).toEqual(titles.map((el) => el.textContent));
		expect(titles.map((el) => el.textContent)).toEqual(['E', 'F1', 'F2']);
	});

	it('claims no selection and no collapse, because it offers neither', () => {
		const { containerEl } = openScope();
		const rows = [...containerEl.querySelectorAll('.pbl-row')];
		// Guarded: `some` over an empty list is false, so without this the whole claim passes
		// on a screen that drew no rows at all.
		expect(rows).toHaveLength(3);
		expect(rows.some((el) => el.hasAttribute('aria-selected'))).toBe(false);
		expect(rows.some((el) => el.hasAttribute('aria-expanded'))).toBe(false);
	});

	it('states the member count, which excludes every context row', () => {
		// The exact number. `toContain('2')` passes on 12 and on 20, which is how a count
		// assertion goes vacuous — the whole point of the figure is that the Epic is not in
		// it, and three rows are on screen.
		const { containerEl } = openScope();
		expect(containerEl.querySelectorAll('.pbl-row')).toHaveLength(3);
		expect(containerEl.querySelector('.pbl-rel-facts .pbl-rel-members')?.textContent).toBe('2 items');
	});

	it('names the release, its version and its status in the header', () => {
		const { containerEl } = openScope();
		const header = containerEl.querySelector('.pbl-rel-header') as HTMLElement;
		expect(header.querySelector('h2')?.textContent).toBe('R');
		expect(header.querySelector('.pbl-rel-version')?.textContent).toBe('1.0.0');
		expect(header.querySelector('.pbl-state-chip.pbl-state-static')?.textContent).toBe('In progress');
	});

	it('repeats the index’s answers about a figure, rather than a second opinion', () => {
		// Three answers, not two: an unbound key is absent from the header entirely, and a
		// bound key holding something no reader will guess at says so. The screens would be
		// describing one release differently otherwise.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', 'target-date': 'soon' } });
		const { view, containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, versionProperty: '' });
		view.pick('R.md');
		const header = containerEl.querySelector('.pbl-rel-header') as HTMLElement;
		expect(header.querySelector('.pbl-rel-unreadable')?.textContent).toBe('Unreadable');
		// The unbound one draws nothing at all — not an empty span, and not the word above.
		expect(header.querySelector('.pbl-rel-version')).toBeNull();
	});

	it('returns to the index from the back control', () => {
		const { view, containerEl } = openScope();
		click(containerEl.querySelector('.pbl-rel-back') as HTMLElement);
		expect(view.pickedPath).toBeNull();
		expect(containerEl.querySelector('.pbl-rel-grid')).not.toBeNull();
	});

	it('makes the back control a real button, so a keyboard can reach and press it', () => {
		// The only way out of a release: a pointer-only back control strands a keyboard user
		// on the scope screen, which is worse than a pointer-only row — that merely blocks
		// entry. A real `<button>` is what makes Enter and Space the browser's job rather
		// than a handler somebody has to remember, so the ELEMENT is the guarantee and is
		// what this asserts — the index's rows are the same element for the same reason.
		const { containerEl } = openScope();
		const back = containerEl.querySelector('.pbl-rel-back') as HTMLButtonElement;
		expect(back.tagName).toBe('BUTTON');
		expect(back.type).toBe('button');
		expect(back.tabIndex).toBe(0);
		expect(back.getAttribute('aria-label')).toBe('Back to all releases');
	});

	it('says an empty release is empty, and names it', () => {
		const vault = new FakeVault();
		vault.addFile('Aurora.md', { frontmatter: { type: 'Release' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('Aurora.md');
		// A name nothing else on screen spells, so the assertion cannot pass on a fixed
		// sentence that never read the release.
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toContain('Aurora');
		expect(containerEl.querySelectorAll('.pbl-row')).toHaveLength(0);
		// Still a way back: an empty release must not be a dead end.
		expect(containerEl.querySelector('.pbl-rel-back')).not.toBeNull();
	});

	it('draws no tree and names the option when membership is unconfigured', () => {
		const { view, containerEl } = makeReleaseView(scopeVault(), { ...RELEASE_CONFIG, membershipProperty: '' });
		view.pick('R.md');
		expect(containerEl.querySelectorAll('.pbl-row')).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-empty-hint')?.textContent).toContain('membership');
		// And no member count beside it: with nothing to read, `0 items` would be an answer
		// this screen cannot give.
		expect(containerEl.querySelector('.pbl-rel-members')).toBeNull();
	});
});
