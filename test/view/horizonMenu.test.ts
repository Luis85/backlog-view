// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { cardByTitle } from '../helpers/board';
import { bucketByName, makeRoadmap, roadmapView, shelfOf } from '../helpers/roadmap';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

useViewHarness();

/**
 * The horizon board's card menu carries no children section — asked for directly
 * (2026-08-17): no Show/Hide children toggle and no `Open child "…"` entries, on a
 * bucket card and a shelf card alike. The card's own face disclosure still lists the
 * children; what is withheld is the menu's copy of it. Its own file rather than
 * `cardChildren.test.ts`'s tail, because that file is at its line budget and this is
 * the one projection exempt from the rules it asserts.
 *
 * What that costs is stated in the task note (`docs/tasks/Drop the children section
 * from the horizon board's card menu.md`): on this board the face disclosure has no
 * keyboard path, and under a focus an unmatched, uncarded child is reachable only
 * from the other projections. The DATED axis keeps everything — its chevron folds
 * rows, which is the whole feature there — and the last case pins that boundary.
 */
describe('the horizon board’s card menu carries no children section', () => {
	/** An epic in a bucket with two features under it, one of them placed itself. */
	function bucketFamilyVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('Feature A2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic A' });
		return vault;
	}

	/**
	 * Every card lookup here goes through a helper that THROWS on a miss, and the type
	 * of this parameter is the other half of that. Both were hand-rolled until
	 * 2026-08-17 — `querySelector('.pbl-card')` and a `find` over `.pbl-shelf .pbl-card`
	 * by path, each answering a miss with `null`, which this function then turned into
	 * `[]`: three of the four cases below assert that a title is NOT in the list, so a
	 * lookup that found nothing would have satisfied every one of them. They were all
	 * finding their card — checked by removing the gate and watching the three fail on
	 * real menus — but nothing here said so, and a renamed class would have taken the
	 * evidence away silently rather than loudly.
	 */
	const menuTitles = (card: HTMLElement): string[] => {
		card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
	};

	/** A card on the shelf, by title — scoped, because "on the shelf" is the claim. */
	function shelfCard(containerEl: HTMLElement, title: string): HTMLElement {
		const shelf = shelfOf(containerEl);
		if (!shelf) throw new Error('no shelf rendered');
		return cardByTitle(shelf, title);
	}

	it('offers no toggle on a bucket card that draws a disclosure', () => {
		const { containerEl, view } = makeRoadmap(bucketFamilyVault());
		const card = cardByTitle(bucketByName(containerEl, 'Now'), 'Epic A');

		// The control half: the face DOES list children — the section is withheld from
		// the menu, not missing because nothing drew a disclosure.
		expect(view.cardChildrenShown.has('Epic A.md')).toBe(true);
		const titles = menuTitles(card);
		expect(titles).not.toContain('Show children');
		expect(titles).not.toContain('Hide children');
	});

	it('offers no Open child entries under a focus, where the child has no card', () => {
		const { containerEl } = makeRoadmap(bucketFamilyVault(), {}, { focus: 'Epic' });
		const titles = menuTitles(cardByTitle(bucketByName(containerEl, 'Now'), 'Epic A'));

		expect(titles.filter((t) => t.startsWith('Open child'))).toEqual([]);
		expect(titles).not.toContain('Show children');
		expect(titles).not.toContain('Hide children');
	});

	it('offers no toggle on a shelf card either — the rule is the board’s, not the bucket’s', () => {
		const vault = bucketFamilyVault();
		vault.addFile('Untriaged parent.md', { frontmatter: { type: 'Epic', order: 30 } });
		vault.addFile('Untriaged child.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Untriaged parent' });
		const { containerEl, view } = makeRoadmap(vault);
		const card = shelfCard(containerEl, 'Untriaged parent');

		expect(view.cardChildrenShown.has('Untriaged parent.md')).toBe(true);
		const titles = menuTitles(card);
		expect(titles).not.toContain('Show children');
		expect(titles).not.toContain('Hide children');
	});

	it('keeps the dated axis’s shelf card toggle — the exemption is the horizon board’s alone', () => {
		const vault = new FakeVault();
		vault.addFile('Dated epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' } });
		vault.addFile('Shelf parent.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Shelf child.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Shelf parent' });
		const { containerEl } = roadmapView(vault, { startProperty: 'note.start', targetProperty: 'note.due' });

		expect(menuTitles(shelfCard(containerEl, 'Shelf parent'))).toContain('Show children');
	});
});
