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

	it('claims no selection — this screen still has none — and a disclosure only on a parent', () => {
		// `aria-expanded` moved from "never" to "on every row with children" in Task 3: the
		// Epic (E) has two member children and carries it, the two leaves (F1, F2) do not.
		// `aria-selected` stays absent — no selection until the keyboard task adds one.
		const { containerEl } = openScope();
		const rows = [...containerEl.querySelectorAll('.pbl-row')] as HTMLElement[];
		// Guarded: `some` over an empty list is false, so without this the whole claim passes
		// on a screen that drew no rows at all.
		expect(rows).toHaveLength(3);
		expect(rows.some((el) => el.hasAttribute('aria-selected'))).toBe(false);
		expect(rows.map((el) => el.hasAttribute('aria-expanded'))).toEqual([true, false, false]);
	});

	it('states the member count, which excludes every context row, in the summary strip', () => {
		// The exact number. `toContain('2')` passes on 12 and on 20, which is how a count
		// assertion goes vacuous — the whole point of the figure is that the Epic is not in
		// it, and three rows are on screen. `scopeVault()`'s two members carry no `status`,
		// so the denominator is what this asks: 2, never the 3 rows drawn.
		const { containerEl } = openScope();
		expect(containerEl.querySelectorAll('.pbl-row')).toHaveLength(3);
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain('0 of 2 items done');
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
		// The refusal NAMES its property here, where the index's bare word is enough: the
		// index has a column heading above the cell and this header draws its figures bare.
		// The rule the two screens share is the three-way answer, not the wording.
		expect(header.querySelector('.pbl-rel-unreadable')?.textContent).toBe('Target unreadable');
		// The unbound one draws nothing at all — not an empty span, and not the word above.
		expect(header.querySelector('.pbl-rel-version')).toBeNull();
	});

	it('returns to the index from the back control', () => {
		const { view, containerEl } = openScope();
		click(containerEl.querySelector('.pbl-rel-back') as HTMLElement);
		expect(view.pickedPath).toBeNull();
		expect(containerEl.querySelector('.pbl-rel-bands')).not.toBeNull();
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
		// And no summary strip beside it: with nothing to read, `0 items` would be an answer
		// this screen cannot give.
		expect(containerEl.querySelector('.pbl-rel-summary')).toBeNull();
	});
});

describe('a refusal on the release header names the property it is about', () => {
	useViewHarness();

	it('tells two malformed figures apart', () => {
		// The index can afford a bare "Unreadable": its column heading sits above the cell.
		// This header draws its figures bare and side by side, so two of them would put the
		// same word on screen twice with nothing saying which key to go and fix.
		const vault = new FakeVault();
		vault.addFile('R.md', {
			frontmatter: { type: 'Release', version: { a: 1 }, 'target-date': 'soon', status: 'Planned' },
		});
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');

		const refusals = [...containerEl.querySelectorAll('.pbl-rel-unreadable')].map((el) => el.textContent);
		expect(refusals).toEqual(['Version unreadable', 'Target unreadable']);
		// The readable one is untouched and still draws its own value.
		expect(containerEl.querySelector('.pbl-state-text')?.textContent).toBe('Planned');
	});
});

/**
 * The summary strip (`drawSummary` in `renderScope.ts`): one bar, one percentage, one
 * sentence, drawn from the SAME `ReleaseRow` the index band was drawn from — nothing here
 * is a second derivation, which is what `test/view/releaseIndex.test.ts` and this file
 * agreeing on one release proves rather than assumes.
 */
describe('the summary strip', () => {
	useViewHarness();

	/**
	 * Three members under one release, one of them Done — the fixture every test in this
	 * block reads unless it needs a different shape (no members, or a Deliverable). Built
	 * fresh per call, this file's own style for a vault only one describe block needs.
	 */
	function progressVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('P.md', {
			frontmatter: { type: 'Release', version: '1.0.0', 'target-date': '2026-09-12', status: 'In progress' },
		});
		vault.addFile('M1.md', { frontmatter: { type: 'Feature', order: 1, release: '[[P]]', status: 'Done' } });
		vault.addFile('M2.md', { frontmatter: { type: 'Feature', order: 2, release: '[[P]]', status: 'In progress' } });
		vault.addFile('M3.md', { frontmatter: { type: 'Feature', order: 3, release: '[[P]]', status: 'Planned' } });
		return vault;
	}

	it('draws the bar, the percentage and the sentence from ONE row', () => {
		const { view, containerEl } = makeReleaseView(progressVault(), RELEASE_CONFIG);
		view.pick('P.md');
		const strip = containerEl.querySelector('.pbl-rel-summary')!;
		expect(strip.querySelector('.pbl-rel-pct')!.textContent).toBe('33%');
		expect(strip.textContent).toContain('1 of 3 items done');
	});

	it('names the property and the done values in a tooltip on the strip, for a single workflow', () => {
		// The requirement the bar, the percentage and the sentence cannot meet alone: a
		// reader must be able to see WHICH property decided the numerator. On the strip,
		// per the brief — never a fourth header line.
		const { view, containerEl } = makeReleaseView(progressVault(), RELEASE_CONFIG);
		view.pick('P.md');
		const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
		expect(strip.dataset.tooltip).toBe('Progress reads status. Done values: Done, Closed, Completed, and Removed.');
	});

	it('reports the same numbers the index band reported', () => {
		// One `ReleaseRow`, two screens — the rule `domain/releases.ts` states: progress
		// "is computed nowhere else". A second derivation would pass this only by luck.
		const vault = progressVault();
		const { containerEl: indexEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = indexEl.querySelector('[data-path="P.md"]')!.textContent!;
		const { view, containerEl: scopeEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('P.md');
		const strip = scopeEl.querySelector('.pbl-rel-summary')!.textContent!;
		expect(band).toContain('1 of 3');
		expect(strip).toContain('1 of 3');
	});

	it('names an unconfigured progress rather than leaving a gap', () => {
		// Extension 2c: absent AND named, never a silent omission and never a zero.
		const { view, containerEl } = makeReleaseView(progressVault(), { ...RELEASE_CONFIG, stateProperty: '' });
		view.pick('P.md');
		const strip = containerEl.querySelector('.pbl-rel-summary')!;
		expect(strip.querySelector('.pbl-rel-bar')).toBeNull();
		expect(strip.textContent).toContain('3 items');
		expect(strip.textContent!.toLowerCase()).toContain('not configured');
	});

	it('draws no strip for a release with no members', () => {
		// Extension 1a: nothing to count, and nothing reads as zero.
		const vault = new FakeVault();
		vault.addFile('Aurora.md', { frontmatter: { type: 'Release' } });
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('Aurora.md');
		expect(containerEl.querySelector('.pbl-rel-summary')).toBeNull();
	});

	it('counts a Deliverable member by its OWN workflow', () => {
		// `ReleaseRow.done` reads through `ownWorkflowReading`, so a Deliverable answers by
		// its own state property — bound here to a DIFFERENT key from the plan's `status`,
		// so a fallback to the plan's own state key could not pass this by accident. Drawing
		// the row keeps that for free; deriving a second figure from the plan's state key
		// would get it backwards.
		const vault = new FakeVault();
		vault.addFile('Q.md', { frontmatter: { type: 'Release' } });
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', release: '[[Q]]', status: 'Planned', dstatus: 'Done' },
		});
		const { view, containerEl } = makeReleaseView(vault, {
			...RELEASE_CONFIG,
			deliverableStateProperty: 'note.dstatus',
		});
		view.pick('Q.md');
		const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
		expect(strip.textContent).toContain('1 of');
		// The tooltip names the Deliverable's OWN key — not the plan's `status`, which this
		// release's one member never even reads for done-ness.
		expect(strip.dataset.tooltip).toBe('Progress reads dstatus. Done values: Done, Closed, Completed, and Removed.');
	});

	it('names the workflows instead, in a tooltip, when members span more than one', () => {
		// The mixed-population branch [[Summing up a release]]'s 2026-08-28 amendment
		// exists for: a plan member and a Deliverable member on DIFFERENT properties, so no
		// single property decided `done` and the tooltip has to say so rather than pick one.
		const vault = new FakeVault();
		vault.addFile('Q.md', { frontmatter: { type: 'Release' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[Q]]', status: 'Doing' } });
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', release: '[[Q]]', status: 'Planned', dstatus: 'Done' },
		});
		const { view, containerEl } = makeReleaseView(vault, {
			...RELEASE_CONFIG,
			deliverableStateProperty: 'note.dstatus',
		});
		view.pick('Q.md');
		const strip = containerEl.querySelector('.pbl-rel-summary') as HTMLElement;
		expect(strip.dataset.tooltip).toBe('Progress spans more than one workflow: Work and Deliverables.');
	});
});
