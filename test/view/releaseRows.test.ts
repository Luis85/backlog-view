// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';
import { makeRoadmap, shelfTitles } from '../helpers/roadmap';
import { cardByTitle } from '../helpers/board';

useViewHarness();

/**
 * Where a `Release` is a row, and where it is not — asked of the READERS rather than of
 * the filter, because every defect this file covers was a reader that never heard the
 * population had changed. The rule itself is two clauses, each stated once: no axis of
 * the roadmap places a release (`onThisRoadmap`, `domain/roadmap.ts`), and no projection
 * draws a release the Base excluded (`inPlan`, `domain/model.ts`).
 *
 * Five readers, five tests: the toolbar's count, the roadmap's row source under a focus,
 * a CARD's listed children, the tree's context row, and the empty state's creation type. A
 * sixth — the bucket header's `+`, whose type follows the same focus — is asserted where it
 * already lived, in `roadmapMoves.test.ts`.
 */

/** The count label's own text — the readout that has to agree with the advisory. */
function countText(containerEl: HTMLElement): string {
	return containerEl.querySelector<HTMLElement>('.pbl-count-label')?.textContent ?? '';
}

/** A vault holding one release and nothing else. */
function releaseOnly(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', order: 10 } });
	return vault;
}

describe('a release on the roadmap', () => {
	/**
	 * The toolbar counts what the projection can DRAW. A base holding one release draws
	 * no roadmap row at all, so the advisory says the roadmap is empty — and a count
	 * measured over `model.results` said there was one item in it, on the same screen.
	 */
	it('counts nothing where the roadmap draws nothing', () => {
		const { containerEl } = makeRoadmap(releaseOnly());

		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
		expect(countText(containerEl)).toBe('0 items');
	});

	/**
	 * A `Release` focus is a state the roadmap's own picker does not offer, so the
	 * roadmap does not honour it: the model is rebuilt unfocused on the way in.
	 *
	 * Without that, `roadmapRows` filtered the FOCUS ROOTS — `model.roots` is a forest
	 * where `model.results` is a flat walk, so the same one-line filter dropped a row in
	 * one branch and a root plus its whole subtree in the other. The hand-nested `PBI`
	 * below the release was drawn nowhere, while `eligibleResults` counted it, and the
	 * roadmap announced that all the work was done and hidden.
	 */
	it('ignores a focus it does not offer, and keeps the work under it', () => {
		const vault = releaseOnly();
		vault.addFile('Hand nested.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'R' });
		const { containerEl } = makeRoadmap(vault, {}, { focus: 'Release' });

		expect(shelfTitles(containerEl)).toEqual(['Hand nested']);
		// Nothing is hidden, so nothing may say so — that notice offers Show completed
		// items, which would not have brought the row back.
		expect(containerEl.querySelector('.pbl-empty-filter')).toBeNull();
		expect(countText(containerEl)).toBe('1 item');
	});

	/**
	 * **The clause in `projectionMember` is what every other roadmap reader inherits**, and
	 * this is the assertion under that sentence. `listedChildren` asks `isRowHidden`, which
	 * asks that predicate — so a release hand-hung under an epic is off the card's face for
	 * the same reason it is off the frame, rather than because anything here remembered it.
	 *
	 * The disclosure's LABEL is the reading, not the count: two children of different types
	 * have no common name and degrade to `2 children`, so the number and the type name move
	 * together and either alone would pass on the broken code.
	 */
	it('is no listed child on a card, which is where the shared predicate is felt', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 20 }, parentLink: 'Epic' });
		const { containerEl } = makeRoadmap(vault);

		const toggle = cardByTitle(containerEl, 'Epic').querySelector('.pbl-card-kids-toggle');
		expect(toggle?.textContent).toContain('1 pbi');
	});

	/**
	 * The empty state's creation type follows the focus, and the focus is what the
	 * projection honours — so a roadmap that honours no `Release` focus cannot offer
	 * `New Release` from it. The button used to create a note the same roadmap filtered
	 * out on the pass that made it, while the toolbar's own creator and the focus picker
	 * beside it were already withholding that type.
	 */
	it('offers no New Release from its empty state', () => {
		const { containerEl } = makeRoadmap(releaseOnly(), {}, { focus: 'Release' });

		expect(containerEl.querySelector('.pbl-empty button')?.textContent).toBe('New Epic');
	});
});

describe('a release the Base excluded', () => {
	/**
	 * `Releases as their own type` 4a: a filtered release appears as no row anywhere, a
	 * context row included. Its child still names it, so the edge stays — cutting it
	 * would strand the subtree from the rollup walk, which traverses THROUGH a row it
	 * does not count. The row goes; the child is promoted and keeps its place.
	 */
	it('is no context row in the tree, and its child stays', () => {
		const vault = new FakeVault();
		vault.addFile('Rel.md', { frontmatter: { type: 'Release', order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Rel' });
		const { containerEl } = makeView(vault, {}, { only: ['Child.md'] });

		expect(titlesOf(containerEl)).toEqual(['Child']);
	});
});

describe('a release row in the tree', () => {
	/**
	 * The horizon chip is a CONTROL over the horizon key, and `canPlaceHorizon` is the
	 * one predicate that answers both halves of whether it may exist: the axis has to be
	 * configured, and the type has to be one the axis places. A release fails the second
	 * half, so the row draws the column and no chip in it — a control whose menu could
	 * only write a key the roadmap refuses to read.
	 *
	 * Asserted as a DIFFERENCE, not an absence: the Epic beside it draws the chip from
	 * the same column in the same pass, so an unconfigured axis cannot pass this.
	 */
	it('draws no horizon chip, where an epic beside it draws one', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', order: 10, horizon: 'Now' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		const { containerEl } = makeView(vault, { horizonProperty: 'note.horizon' }, { order: ['note.horizon'] });

		expect(rowByTitle(containerEl, 'E').querySelector('.pbl-horizon-chip')).not.toBeNull();
		expect(rowByTitle(containerEl, 'R').querySelector('.pbl-horizon-chip')).toBeNull();
		// The column itself is still there, so this is a chip the row refused and not a
		// column the view dropped.
		expect(rowByTitle(containerEl, 'R').querySelectorAll('.pbl-prop').length).toBe(1);
	});
});
