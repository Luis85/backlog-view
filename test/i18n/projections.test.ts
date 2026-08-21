// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, setLocale } from '../../src/i18n/t';
import { BOARD_WORKFLOW, boardVault, expandColumns, makeBoard } from '../helpers/board';
import { installObsidianDom } from '../helpers/dom';
import { horizonVault, laneRoadmap, makeRoadmap, roadmapView } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, fixture, makeView } from '../helpers/view';

installObsidianDom();

/**
 * What the three projections say, driven under a catalog that is not English —
 * `view/render/`, `view/writeGate.ts` and `view/cardMoves.ts`, swept 2026-08-21.
 *
 * **It asks the CATEGORY, not a list of keys.** The other files in this directory each
 * override the keys their slice added and assert those keys arrived; this one marks the
 * WHOLE catalog and asserts that everything a projection rendered UNMARKED is data. That
 * is `menus.test.ts`'s construction — an assertion about the remainder rather than about
 * the members — and it is the only shape that can fail for a call site nobody listed,
 * which is exactly the failure a sweep leaves behind.
 *
 * It earned that shape immediately: the tree's rollup tooltip was
 * `` `${done} of ${total} items done` ``, a template whose first quasi is EMPTY. That is
 * the one shape `UI_TEXT_LITERAL` states it cannot see, and an AST walk over the whole
 * directory missed it too, because every quasi in it is blank or lowercase. Nothing but
 * reading the rendered string back could have found it.
 *
 * **This is not yet the consolidation** that `Every surface translated` defers. That one
 * marks the catalog and drives EVERY surface, and its blocker is unchanged: its expected
 * remainder would have to enumerate the English still in `view/manual/` and `domain/`,
 * and that list rots on each slice. What is here is the same instrument pointed at the
 * three projections alone, where the remainder is fixture data plus the six `domain/`
 * strings named in `UNSWEPT` below — small enough to state, and each one a check that
 * fails when its own sweep lands.
 */

const MARK = 'XX ';
/**
 * The WHOLE catalog behind a marker, never a hand-kept list of this slice's keys: a list
 * checks the keys somebody remembered, and `interactions.test.ts` already says its own
 * will rot. Nothing here has to be edited when a key is added.
 *
 * The value keeps its English behind the marker, so `{name}` substitution still runs and
 * a parameter's own text arrives untouched — which is what makes the remainder below
 * readable as data rather than as noise.
 */
const xx: Catalog = Object.fromEntries(
	Object.entries(en).map(([key, entry]) => [
		key,
		typeof entry === 'string' ? MARK + entry : Object.fromEntries(Object.entries(entry).map(([f, v]) => [f, MARK + v])),
	]),
);

beforeEach(() => setLocale('xx', { xx }));
// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

/**
 * Every string a projection put where a person could read it — the leaves' text, and the
 * four attributes this view says things through. Attributes are not optional here: most
 * of what `render/` spells is a tooltip or an accessible name, so a check reading
 * `textContent` alone would report a clean tree while every tooltip stayed English.
 */
function drawn(el: HTMLElement): string[] {
	const parts: string[] = [];
	for (const node of Array.from(el.querySelectorAll<HTMLElement>('*'))) {
		for (const attr of ['aria-label', 'aria-description', 'data-tooltip', 'title']) {
			const value = node.getAttribute(attr);
			if (value) parts.push(value);
		}
		// Leaves only: an ancestor's textContent is its children concatenated, so a marked
		// parent would hide an unmarked child inside it.
		if (node.children.length === 0) {
			const text = node.textContent?.trim() ?? '';
			if (text !== '') parts.push(text);
		}
	}
	return parts;
}

function unmarked(el: HTMLElement): string[] {
	return [...new Set(drawn(el).filter((text) => !text.startsWith(MARK)))].sort();
}

/**
 * Numbers, and the fixture's own words. A count is DATA presentation and follows the
 * user's locale rather than the catalog's, so it carries no marker by design; the rest
 * are titles, type names, state values and horizon values, every one of them a thing the
 * plugin matches on or writes.
 */
const isData = (text: string): boolean => /^[\d/ ]+$/.test(text);

/**
 * Everything a projection rendered that is neither marked nor a number. Each test names
 * this set exactly, so a call site left spelling its own English fails here whether or not
 * anyone thought to assert on the selector it drew into.
 */
function remainder(el: HTMLElement): string[] {
	return unmarked(el).filter((text) => !isData(text));
}

describe('the tree reads every word it draws from the catalog', () => {
	it('leaves nothing but titles, type names and counts unmarked', () => {
		const { containerEl } = makeView(fixture());
		clickExpandAll(containerEl);

		expect(remainder(containerEl)).toEqual(['Epic', 'Epic A', 'Epic B', 'Feature', 'Feature B1', 'Feature B2']);
	});

	it('draws its chips, markers and add buttons from it too', () => {
		const vault = fixture();
		vault.addFile('Orphan.md', { frontmatter: { type: 'Feature', order: 90, parent: '[[Gone]]' } });
		const { containerEl } = makeView(vault, { ...BOARD_WORKFLOW, riskProperty: 'note.risk', tagsProperty: 'note.tags' });
		clickExpandAll(containerEl);

		// Every tooltip and accessible name on the row — the state chip, the risk chip, the
		// orphan marker, the add button, the badge — reached the DOM through a key.
		expect(remainder(containerEl)).toEqual([
			'Epic',
			'Epic A',
			'Epic B',
			'Feature',
			'Feature B1',
			'Feature B2',
			'Orphan',
		]);
	});
});

describe('a context row says why it is there, from the catalog', () => {
	/**
	 * The context surfaces are their own case and not a corner of the two above: an
	 * `outsideFilter` row draws a marker, a static chip and no controls at all, and the
	 * roadmap draws a whole strip of its own for them — none of which any fixture that
	 * returns the entire vault can reach. Reverting `shelf.contextTooltip` alone was
	 * watched passing every other test in this file before this one existed.
	 */
	it('draws the tree marker and the static chip from it', () => {
		const { containerEl } = makeView(fixture(), BOARD_WORKFLOW, { only: ['Feature B1.md'] });
		clickExpandAll(containerEl);

		expect(remainder(containerEl)).toEqual(['Epic', 'Epic B', 'Feature', 'Feature B1']);
	});

	it('draws the roadmap context strip and its heading from it', () => {
		// A context card whose horizon would MINT a bucket stands in the strip rather than
		// in one — the one arrangement that draws `.pbl-roadmap-context` at all, so the
		// strip's own heading and tooltip have a surface to be read back from.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Someday' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' }, parentLink: 'Epic' });
		const { containerEl, view } = makeView(vault, { horizonProperty: 'note.horizon', horizonValues: 'Now, Next, Later' }, {
			only: ['F.md'],
			focus: 'Epic',
		});
		view.setProjection('roadmap');
		view.setShelfCollapsed(false);

		expect(containerEl.querySelector('.pbl-roadmap-context')).not.toBeNull();
		expect(remainder(containerEl)).toEqual(['Epic', 'Later', 'Next', 'Now']);
	});
});

describe('the board reads every word it draws from the catalog', () => {
	it('leaves nothing but card titles, type names and state values unmarked', () => {
		const { containerEl } = makeBoard(boardVault(), BOARD_WORKFLOW);
		expandColumns(containerEl);

		// `Active`, `Done` and `New` are the configured workflow — values the plugin writes
		// to frontmatter, so a catalog that translated them would write notes another
		// locale cannot read.
		expect(remainder(containerEl)).toEqual([
			'Active',
			'Done',
			'Epic',
			'Epic A',
			'Epic B',
			'Feature',
			'Feature B1',
			'Feature B2',
			'New',
		]);
	});
});

describe('the roadmap reads every word it draws from the catalog', () => {
	it('leaves nothing but titles, types and horizon values unmarked on the bucket axis', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {});

		expect(remainder(containerEl)).toEqual(['Epic', 'Later', 'Later item', 'Next', 'Now', 'Now item', 'Untriaged']);
	});

	it('leaves nothing but titles, types and dates unmarked on the dated axis', () => {
		const { containerEl } = roadmapView(resourceVault(), { startProperty: 'note.start', targetProperty: 'note.due' });

		// Dates are rendered by `formatCivil` and are data; the legend, the today line and
		// every bar's span sentence came from the catalog.
		expect(remainder(containerEl).filter((text) => !/^\d{4}-\d\d-\d\d$/.test(text) && !/^\w{3}$/.test(text))).toEqual(
			['Alice dated', 'Cased', 'Epic', 'Nobody', 'Stray', 'Undated'],
		);
	});

	it('leaves nothing but titles, types and resource names unmarked on the resources axis', () => {
		const { containerEl } = laneRoadmap(resourceVault(), {}, { shelf: true });

		expect(remainder(containerEl).filter((text) => !/^\d{4}-\d\d-\d\d$/.test(text) && !/^\w{3}$/.test(text))).toEqual(
			['Alice', 'Alice dated', 'Cased', 'Epic', 'Nobody', 'Stray', 'Undated'],
		);
	});
});

describe('what is still English here belongs to domain/, and is named rather than counted', () => {
	/**
	 * The one `view/` surface word this slice could not key: `shelfLabel` is
	 * `domain/roadmap.ts`'s, and keying it in a `view/` slice would be keying somebody
	 * else's string — the rule `ui/`'s own sweep set for the headings it is handed.
	 *
	 * Asserted rather than listed, and in the direction that makes it work: sweeping
	 * `domain/roadmap.ts` makes this string arrive MARKED and fails this test, so the
	 * entry is deleted in the same change that keys it. A list of exceptions nobody has
	 * to maintain is a list that outlives what it excepted.
	 */
	it('still renders the shelf label in English, from domain/roadmap.ts', () => {
		const { containerEl } = makeRoadmap(horizonVault(), {});

		expect(remainder(containerEl)).toContain('Untriaged');
	});
});
