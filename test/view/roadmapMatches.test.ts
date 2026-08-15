// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { Harness, key, makeView, treeOf, useViewHarness } from '../helpers/view';
import { bucketByName, laneRoadmap, rowFor } from '../helpers/roadmap';

useViewHarness();

const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };
const HORIZONS = { horizonProperty: 'note.horizon' };

/** The match links one surface names, in drawn order. */
function matchesOn(el: HTMLElement | null | undefined): string[] {
	return Array.from(el?.querySelectorAll<HTMLElement>('.pbl-card-match') ?? []).map((l) => l.textContent ?? '');
}

function matchLink(el: HTMLElement | null | undefined, title: string): HTMLElement {
	const link = Array.from(el?.querySelectorAll<HTMLElement>('.pbl-card-match') ?? []).find(
		(l) => l.textContent === title,
	);
	if (!link) throw new Error(`no match link named: ${title}`);
	return link;
}

/**
 * What a ROW's face says instead: the count chip, or '' where none is drawn. A lead cell
 * cannot afford the titles — they are taken out of the row's own name — so the two row
 * surfaces draw one fixed chip and the menu carries the list.
 */
function matchCountOn(el: HTMLElement | null | undefined): string {
	return el?.querySelector<HTMLElement>('.pbl-row-matches')?.textContent ?? '';
}

/**
 * The menu the count chip opens — the row's own menu, which is the path to the matches
 * the chip counts. `matchesFor` (`view/childrenList.ts`) is what puts `Open match …`
 * entries in it on the roadmap, so a case asserting one of those entries is asserting
 * that the chip's count and the menu behind it agree about what was found.
 */
function chipMenu(el: HTMLElement | null | undefined): Menu {
	const chip = el?.querySelector<HTMLElement>('.pbl-row-matches');
	if (!chip) throw new Error('no match count chip drawn');
	chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	if (!Menu.lastShown) throw new Error('the count chip opened no menu');
	return Menu.lastShown;
}

/**
 * A roadmap on whichever axis the caller configures, with the two pieces of working
 * position these cases need: the focus level that puts an ancestor on screen without its
 * descendants, and the base narrowing that makes one of them context.
 */
function roadmap(
	vault: FakeVault,
	cfg: Record<string, unknown>,
	{ focus, only, shelf = true }: { focus?: string; only?: string[]; shelf?: boolean } = {},
): Harness {
	const harness = makeView(vault, cfg, { collapsed: true, focus, only });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(!shelf);
	return harness;
}

/** An epic whose only matching work sits two levels below it, under the focus line. */
function deepVault(epic: Record<string, unknown> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, ...epic } });
	vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
	vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A1' });
	return vault;
}

/** The same shape with the epic assigned, for the band that places a context row. */
function laneVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
	vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
	vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A1' });
	return vault;
}

/** The card the shelf drew, whichever group it landed in. */
function shelfCard(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-shelf .pbl-card');
}

describe('every roadmap surface names what the filter found under it', () => {
	it('a bucket card on the horizon axis', () => {
		const vault = deepVault({ horizon: 'Now' });
		const { containerEl, view } = roadmap(vault, { ...HORIZONS }, { focus: 'Epic' });
		view.setFilter('Login');

		const card = bucketByName(containerEl, 'Now').querySelector<HTMLElement>('.pbl-card');
		expect(matchesOn(card)).toEqual(['PBI Login']);
		matchLink(card, 'PBI Login').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// The match, never the card it hangs under — the one note the reader did not click.
		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('a bar row on the dated axis — a COUNT, and the menu behind it', () => {
		const vault = deepVault({ start: '2026-08-01', due: '2026-08-10' });
		const { containerEl, view } = roadmap(vault, { ...DATES }, { focus: 'Epic' });
		view.setFilter('Login');

		const row = rowFor(containerEl, 'Epic A');
		// Never the titles: a lead cell's only shrinkable items are the row's own name and
		// this, so a list here is width taken out of the name. Measured, not preferred.
		expect(matchesOn(row)).toEqual([]);
		expect(matchCountOn(row)).toBe('1');
		const titles = chipMenu(row).items.map((i) => i.titleText);
		expect(titles).toContain('Open in new tab');
		// The count chip's own reachability claim: the menu it opens actually names the
		// match it counted, not merely a menu with something else in it.
		expect(titles).toContain('Open match "PBI Login"');
	});

	it('a shelf card', () => {
		// Undated on the dated axis: the epic is a result the axis cannot place.
		const vault = deepVault();
		const { containerEl, view } = roadmap(vault, { ...DATES }, { focus: 'Epic' });
		view.setFilter('Login');

		const card = shelfCard(containerEl);
		expect(matchesOn(card)).toEqual(['PBI Login']);
		matchLink(card, 'PBI Login').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('a context-strip card', () => {
		// The base returns the PBI alone, so its epic is a focused root outside the
		// filter — with no dates it lands beside the shelf rather than in it.
		const vault = deepVault();
		const { containerEl, view } = roadmap(vault, { ...DATES }, { focus: 'Epic', only: ['PBI Login.md'] });
		view.setFilter('Login');

		const card = containerEl.querySelector<HTMLElement>('.pbl-roadmap-context .pbl-card');
		expect(matchesOn(card)).toEqual(['PBI Login']);
		matchLink(card, 'PBI Login').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
	});

	it('a lane context row on the resources axis — the same count chip', () => {
		const vault = laneVault();
		const { containerEl, view } = laneRoadmap(vault, {}, { only: ['PBI Login.md'], focus: 'Epic' });
		view.setFilter('Login');

		const row = containerEl.querySelector<HTMLElement>('.pbl-lane-context');
		expect(matchesOn(row)).toEqual([]);
		expect(matchCountOn(row)).toBe('1');
		const titles = chipMenu(row).items.map((i) => i.titleText);
		expect(titles).toContain('Open in new tab');
		expect(titles).toContain('Open match "PBI Login"');
	});

	it('opens in a new tab on a middle click, which never fires click at all', () => {
		// A CARD surface, because a row draws no link to middle-click — the shelf card is
		// the same fixture as above with the epic left undated.
		const vault = deepVault();
		const { containerEl, view } = roadmap(vault, { ...DATES }, { focus: 'Epic' });
		view.setFilter('Login');

		const link = matchLink(shelfCard(containerEl), 'PBI Login');
		link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));

		// The row's own auxclick handler must not also fire: stopping only the primary
		// event is a bug the board already shipped once.
		expect(vault.opened.map((o) => o.path)).toEqual(['PBI Login.md']);
		expect(vault.opened[0]?.mode).toBe('tab');
	});
});

describe('a row SUBSTITUTES its count slot, never adds to it', () => {
	/**
	 * A dated epic with two children, one of them the filter's match — and a BROKEN
	 * prerequisite, which is what puts a `.pbl-timeline-dependency-flag` in the same lead
	 * after the count slot. Without it nothing is ever drawn after that slot, and the
	 * placement case below cannot tell a moved chip from an appended one.
	 */
	function countedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-10', dependsOn: 'Ghost' },
		});
		vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A1' });
		return vault;
	}

	/** The dated axis with the dependency property named, so that broken entry is read. */
	const FLAGGED = { ...DATES, dependsOnProperty: 'note.dependsOn' };

	/** What the lead draws around its count slot, in DOM order. */
	function leadOrder(row: HTMLElement | null | undefined): string[] {
		return Array.from(row?.querySelector('.pbl-timeline-lead')?.children ?? [])
			.map((el) => el.className)
			.filter((cls) => cls === 'pbl-row-matches' || cls === 'pbl-timeline-dependency-flag');
	}

	it('shows the rollup with no filter running, exactly as before', () => {
		const { containerEl } = roadmap(countedVault(), { ...FLAGGED }, { focus: 'Epic' });

		const row = rowFor(containerEl, 'Epic A');
		expect(row?.querySelector('.pbl-bar-count')?.textContent).toBe('2');
		expect(row?.querySelector('.pbl-row-matches')).toBeNull();
	});

	it('gives the SAME slot to the matches while one is', () => {
		// The lead is a fixed-width column whose only shrinkable item is the row's title,
		// so anything ADDED to it comes out of the row's name — measured twice in the
		// browser harness, at 34px of title and at a 28.95px overflow. The affordance is
		// therefore a substitution: the count slot is already spent, and a rollup counting
		// every descendant is not what a reader narrowing the view is asking about.
		const { containerEl, view } = roadmap(countedVault(), { ...FLAGGED }, { focus: 'Epic' });
		view.setFilter('Login');

		const row = rowFor(containerEl, 'Epic A');
		expect(matchCountOn(row)).toBe('1');
		expect(row?.querySelector('.pbl-bar-count')).toBeNull();
		// In the slot's own place, not appended after it: everything in the lead is
		// anchored by that slot's `margin-inline-start: auto`, and the dependency flag this
		// fixture's broken entry draws after it would otherwise be left where the rollup
		// used to push it from. Asked of the flag, never of "is it last": a chip appended
		// to a lead that draws nothing after the slot is last either way.
		expect(leadOrder(row)).toEqual(['pbl-row-matches', 'pbl-timeline-dependency-flag']);
	});

	it('keeps announcing the rollup on the row, which costs no width', () => {
		// The visible slot is spent, so the words are the sr-only span's alone — the one
		// place the progress stays reachable while a filter narrows the view.
		const { containerEl, view } = roadmap(countedVault(), { ...FLAGGED }, { focus: 'Epic' });
		view.setFilter('Login');

		const said = Array.from(rowFor(containerEl, 'Epic A')?.querySelectorAll('.pbl-sr-only') ?? []).map(
			(el) => el.textContent,
		);
		expect(said).toContain('2 items');
	});

	it('leaves a row with no rollup slot to append, rather than inventing one', () => {
		// With the rollup off altogether — no workflow and no counts — `rollupReport`
		// returns null and nothing draws the slot, so there is nothing to substitute and
		// the affordance is simply the last thing in the lead.
		const { containerEl, view } = roadmap(countedVault(), { ...FLAGGED, showCounts: false }, { focus: 'Epic' });
		view.setFilter('Login');

		const row = rowFor(containerEl, 'Epic A');
		expect(row?.querySelector('.pbl-bar-count')).toBeNull();
		expect(matchCountOn(row)).toBe('1');
	});
});

describe('what a surface already shows, it does not name twice', () => {
	/** A direct child of the epic, matching, with no row of its own. */
	function directVault(epic: Record<string, unknown> = {}): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, ...epic } });
		vault.addFile('Feature Login.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		return vault;
	}

	it('a bar row draws no disclosure, so its own matching child IS counted', () => {
		// The case an unconditional subtraction ate: a timeline row lists nothing on its
		// face, so subtracting its listed children would delete the one match it has.
		const vault = directVault({ start: '2026-08-01', due: '2026-08-10' });
		const { containerEl, view } = roadmap(vault, { ...DATES }, { focus: 'Epic' });
		view.setFilter('Login');

		const row = rowFor(containerEl, 'Epic A');
		expect(matchCountOn(row)).toBe('1');
		expect(chipMenu(row).items.map((i) => i.titleText)).toContain('Open in new tab');
	});

	it('a bucket card lists that same child, so it is not named a second time', () => {
		const vault = directVault({ horizon: 'Now' });
		const { containerEl, view } = roadmap(vault, { ...HORIZONS }, { focus: 'Epic' });
		view.setFilter('Login');

		const card = bucketByName(containerEl, 'Now').querySelector<HTMLElement>('.pbl-card');
		// Named once, by the disclosure the card draws on its own face.
		expect(card?.querySelector('.pbl-card-kids')).not.toBeNull();
		expect(matchesOn(card)).toEqual([]);
	});
});

describe('the row menu carries the same matches, asked of matchesFor', () => {
	/**
	 * `Feature Login` is Epic A's direct child and its own match, over a wholly undated
	 * branch — `PBI B`, then `Task Login`, a match three levels down. Nothing in that
	 * branch states or inherits a date, so none of it mounts a bar or a shelf card of its
	 * own (with the shelf collapsed) and the walk from Epic A reaches every one of them
	 * unblocked. `Login Sibling` is a SEPARATE dated child, on no branch the other three
	 * are on: it is what gives Epic A's row a chevron at all (a nested bar beneath it),
	 * without ever standing between Epic A and the branch this case is about — a dated
	 * sibling ON that branch would itself mount a bar and block the walk at the first
	 * rung, the failure this fixture is built to avoid.
	 */
	function menuVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('Feature Login.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('PBI B.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature Login' });
		vault.addFile('Task Login.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI B' });
		vault.addFile('Login Sibling.md', {
			frontmatter: { type: 'Feature', order: 20, start: '2026-08-02', due: '2026-08-03' },
			parentLink: 'Epic A',
		});
		return vault;
	}

	it('offers a match three levels down on a TIMELINE ROW, and its direct child once — as a child, never as a match too', () => {
		// No `focus` here — the second structural fact this fixture leans on, undocumented
		// until now. Under focus, `deriveBars` only ever sees `model.roots`: Epic A would BE
		// the only root, so `Feature Login` could never draw as a nested bar beneath it, and
		// this case needs exactly that — a chevron from a nested bar, not from a listed child.
		const { containerEl, view } = roadmap(menuVault(), { ...DATES }, { shelf: false });
		view.setFilter('Login');

		const titles = chipMenu(rowFor(containerEl, 'Epic A')).items.map((i) => i.titleText);

		expect(titles).toContain('Open match "Task Login"');
		// The row lists no children on its own face, so its menu names the direct child
		// through `cardChildrenShown` — as a child, asserting the "Open match" spelling
		// here would contradict this.
		expect(titles).toContain('Open child "Feature Login"');
		expect(titles).not.toContain('Open match "Feature Login"');
		// No note appears twice in one menu — the case an unconditional subtraction (or
		// an unconditional non-subtraction) would fail.
		expect(titles.filter((t) => t.includes('Feature Login')).length).toBe(1);
	});

	it('does NOT offer a direct child as a match on a BUCKET CARD — its own disclosure already lists it', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('Feature Login.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		const { containerEl, view } = roadmap(vault, { ...HORIZONS }, { focus: 'Epic' });
		view.setFilter('Login');

		const card = bucketByName(containerEl, 'Now').querySelector<HTMLElement>('.pbl-card');
		card?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];

		expect(titles).not.toContain('Open match "Feature Login"');
		expect(titles).toContain('Open child "Feature Login"');
	});

	it('offers navigation and no write action on a CONTEXT ROW’s menu, matches included', () => {
		const vault = deepVault();
		const { containerEl, view } = roadmap(vault, { ...DATES }, { focus: 'Epic', only: ['PBI Login.md'] });
		view.setFilter('Login');

		const card = containerEl.querySelector<HTMLElement>('.pbl-roadmap-context .pbl-card');
		card?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];

		expect(titles).toContain('Open match "PBI Login"');
		expect(titles).toContain('Open in new tab');
		expect(titles).not.toContain('Set type');
	});
});

describe('modelled but not drawn — the register is read, never predicted', () => {
	/** A dated epic whose undated child shelves. */
	function shelvedChildVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic A' });
		return vault;
	}

	it('a shelf card on screen is reached by itself, so its ancestor stays quiet', () => {
		const { containerEl, view } = roadmap(shelvedChildVault(), { ...DATES });
		view.setFilter('Login');

		expect(shelfCard(containerEl)?.querySelector('.pbl-card-title')?.textContent).toBe('PBI Login');
		expect(matchCountOn(rowFor(containerEl, 'Epic A'))).toBe('');
	});

	it('a COLLAPSED shelf draws none of them, so the ancestor names it', () => {
		// `renderShelf` has no filter term: collapsing is not overridden by an active
		// filter, unlike a lane fold, so the match really is off screen.
		const { containerEl, view } = roadmap(shelvedChildVault(), { ...DATES }, { shelf: false });
		view.setFilter('Login');

		expect(shelfCard(containerEl)).toBeNull();
		expect(matchCountOn(rowFor(containerEl, 'Epic A'))).toBe('1');
	});

	it('an expanded shelf whose type filter hides the group counts it too', () => {
		const { containerEl, view } = roadmap(shelvedChildVault(), { ...DATES });
		view.setShelfHiddenTypes(new Set(['PBI']));
		view.setFilter('Login');

		expect(shelfCard(containerEl)).toBeNull();
		expect(matchCountOn(rowFor(containerEl, 'Epic A'))).toBe('1');
	});
});

describe('a folded band reopens under a filter', () => {
	function bandVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Feature A1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('PBI Login.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature A1' });
		return vault;
	}

	it('its rows draw, register and name their own matches', () => {
		// `isLaneCollapsed` is `!filter.active && …`, so a filter reopens the band. The
		// rows are back on screen, which is the only thing that lets them name anything.
		const { containerEl, view } = laneRoadmap(bandVault(), {}, { focus: 'Epic' });
		view.setLaneCollapsed('Alice', true);
		expect(rowFor(containerEl, 'Epic A')).toBeNull();

		view.setFilter('Login');
		expect(matchCountOn(rowFor(containerEl, 'Epic A'))).toBe('1');
	});
});

describe('the lane context row those links sit on', () => {
	/**
	 * Match links are `tabindex="-1"`, so the row menu is their keyboard path — which a
	 * row nothing can select does not have. This row was in neither the walk nor the
	 * activation wiring until this increment; see
	 * `docs/bugs/A lane context row could not be reached.md`.
	 */
	it('is in the keyboard walk, where Enter opens its note', () => {
		const vault = laneVault();
		const { containerEl } = laneRoadmap(vault, {}, { only: ['PBI Login.md'], focus: 'Epic' });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected')?.classList.contains('pbl-lane-context')).toBe(true);
		key(tree, 'Enter');
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md']);
	});

	it('opens on a click and carries the row menu', () => {
		const vault = laneVault();
		const { containerEl } = laneRoadmap(vault, {}, { only: ['PBI Login.md'], focus: 'Epic' });
		const row = containerEl.querySelector<HTMLElement>('.pbl-lane-context');

		row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md']);
	});
});
