// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Catalog } from '../../src/i18n/t';
import { BOARD_WORKFLOW, boardVault, expandColumns, makeBoard } from '../helpers/board';
import { installObsidianDom } from '../helpers/dom';
import { setScopeFlag } from '../../src/view/scopeFolds';
import { makeMyWorkView, myWorkVault } from '../helpers/mywork';
import { horizonVault, laneRoadmap, makeRoadmap, roadmapView } from '../helpers/roadmap';
import { makeReleaseView, RELEASE_CONFIG, releaseVault, scopeVault } from '../helpers/release';
import { countingVault, resourceVault } from '../helpers/resources';
import { beyondPlan } from '../helpers/window';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, fixture, makeView, treeOf } from '../helpers/view';
import { MARK, markedCatalog, useMarkedLocale } from './fixtures';

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
 * remainder would have to enumerate the English still in `view/manual/`, and that list
 * rots on each slice. What is here is the same instrument pointed at the three
 * projections alone, where the remainder is fixture data and nothing else.
 *
 * It said "plus the six `domain/` strings named in `UNSWEPT` below" until 2026-08-22, and
 * there has never been an `UNSWEPT` in this file — the last block DID name one string, in
 * an assertion that read a note title instead. Both are gone with `domain/`'s own sweep;
 * what stands in their place is the block at the end, which drives the three surfaces the
 * tests above render straight past.
 */

/**
 * The WHOLE catalog behind a marker, never a hand-kept list of this slice's keys: a list
 * checks the keys somebody remembered, and `interactions.test.ts` already says its own
 * will rot. Nothing here has to be edited when a key is added.
 *
 * The value keeps its English behind the marker, so `{name}` substitution still runs and
 * a parameter's own text arrives untouched — which is what makes the remainder below
 * readable as data rather than as noise.
 */
const xx: Catalog = markedCatalog();

useMarkedLocale(xx);

/**
 * Every string a projection put where a person could read it — the leaves' text, and the
 * four attributes this view says things through. Attributes are not optional here: most
 * of what `render/` spells is a tooltip or an accessible name, so a check reading
 * `textContent` alone would report a clean tree while every tooltip stayed English.
 */
function drawn(el: HTMLElement): string[] {
	const parts: string[] = [];
	for (const node of Array.from(el.querySelectorAll<HTMLElement>('*'))) {
		// `placeholder` is the fifth and was missing. The shelf's search box sets it beside
		// an `aria-label` and a tooltip carrying the same string, so reverting the
		// placeholder ALONE to English left this check green — the two neighbours covered
		// for it. A collector that reads four of the five ways a view says something speaks
		// for less than it claims to, which is the same defect the view-options collector
		// had with a dropdown's option labels.
		for (const attr of ['aria-label', 'aria-description', 'data-tooltip', 'title', 'placeholder']) {
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

/**
 * The lane surfaces the axis test above does not reach, added 2026-08-21 after review found
 * six English strings that survived this directory's sweep. Each sat where no fixture drew
 * it: a bar has to CROSS an absence for the days-lost pair, and a resource has to be away
 * AHEAD of today for the pill, so `resourceVault` — which has neither — rendered a clean
 * tree over both.
 *
 * That is the limit this construction has and the reason it is worth stating: it asks the
 * category of everything DRAWN, so a surface no fixture reaches is a surface it cannot
 * speak for. Marking the whole catalog does not fix that; only a fixture does.
 */
describe('a lane with absences reads its own words from the catalog', () => {
	it('leaves nothing but dates, names and titles unmarked when a bar crosses an absence', () => {
		// One absence inside the bar's span, one ahead of today: the first draws the
		// days-lost pair on the bar, the second the away pill on the lane's lead.
		//
		// PINNED rather than derived, and the first attempt here got that wrong. `Work` is
		// fixed at 2026-08-01 → 2026-08-10 inside `countingVault`, so an absence derived from
		// today stops INTERSECTING it — `fromToday(3)` drew no days-lost pair and no away
		// flag at all, and the remainder assertion still passed, because a string that is
		// never rendered contributes no unmarked text. The test went quiet instead of red.
		// (Codex, PR #243.) Deriving the absence needs `Work` derived too, which is a shared
		// fixture other suites assert exact dates against; pinning is the smaller answer, and
		// this test's subject is catalogue coverage rather than the calendar.
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
		const vault = countingVault([
			{ title: 'Away', start: '2026-08-04', target: '2026-08-06' },
			{ title: 'Later', start: beyondPlan(), target: beyondPlan(4) },
		]);
		// A MARKER too: its diamond carries the only copy of the span sentence, since it
		// has no row to put one in, and no other fixture on this axis draws one.
		// With a STATE on it, so the diamond takes the sentence's with-state form; the
		// stateless form is what every other fixture on this axis draws.
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 20, assignee: 'Alice', due: '2026-08-08', status: 'Doing' },
		});
		// And one with NO state, so both halves of the diamond's sentence are drawn: the
		// two are a ternary, and a fixture that reaches only one leaves the other's key
		// free to be reverted without a check noticing.
		vault.addFile('Cut.md', {
			frontmatter: { type: 'Milestone', order: 30, assignee: 'Alice', due: '2026-08-09' },
		});
		const { containerEl } = laneRoadmap(vault, { stateProperty: 'note.status' }, { shelf: true });

		expect(remainder(containerEl).filter((text) => !/^\d{4}$/.test(text) && !/^\w{3}$/.test(text))).toEqual([
			// The state VALUES are data — what `status:` holds in the notes.
			'Alice',
			'Doing',
			'Done',
			'Epic',
			'Milestone',
			'Ship',
			// The note titled `Work` in `countingVault` — the fixture's own word, and NOT the
			// legend's workflow heading of the same spelling, which this axis never draws
			// because one configured workflow gets an empty label. The heading has its own
			// fixture below; removing this entry to "fix" the sweep was watched failing here.
			'Work',
		]);
	});
});

/**
 * Two tree surfaces the tests above cannot reach, for opposite reasons. The tag cell's
 * tooltip needs a row that HAS tags with the column drawn, and the rollup's bare-count
 * tooltip needs the configuration with counts and NO workflow — the one shape in which
 * the rollup states a number rather than a ratio. `fixture()` has a workflow, so its
 * rollup never takes that branch.
 */
describe('the tree surfaces that need their own configuration', () => {
	it('draws the tag tooltip and the workflow-less rollup from the catalog', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha', 'beta'] } });
		vault.addFile('Child.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		// No `stateProperty`: the rollup counts rather than reporting a ratio, which is the
		// branch whose long form used to be `${label} items` — unpluralizable, and "1 items"
		// on a single child.
		const { containerEl, config, view } = makeView(
			vault,
			{ tagsProperty: 'note.tags', showCounts: true },
			{ widths: { 'note.tags': 280 } },
		);
		// The column has to be in the Base's own order AND fit, or the cell is not drawn at
		// all and its tooltip is unreachable — `columnFit` drops a column whole.
		config.order = ['note.tags'];
		Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 900, configurable: true });
		view.onDataUpdated();
		clickExpandAll(containerEl);

		// 'tags' is the COLUMN's display name, which the Base config supplies — data, like
		// the titles and type names beside it.
		expect(remainder(containerEl)).toEqual(['#alpha', '#beta', 'Child', 'Epic', 'Feature', 'tags']);
	});
});

/**
 * **One string in this slice is held by nothing, and it is named here rather than left to
 * be discovered.** `progressNote` (`render/barProgress.ts`) used to paste a noun onto the
 * rollup label as `${label} items`; it now reads the report's own long form, which the
 * workflow-less branch supplies through `count.items`.
 *
 * Nothing above fails if that is reverted, and the reason is structural rather than a
 * missing fixture: reverting REMOVES a string instead of making one English, and every
 * check in this file asks what rendered UNMARKED. A sentence that disappears is invisible
 * to a remainder. Catching it needs a positive assertion on a timeline bar that has
 * descendants and no workflow — a third fixture shape for one sentence — and an
 * unpluralized "1 items" is the whole of what regressing would cost.
 *
 * Written as a comment rather than as a test on purpose: an `expect` comparing a catalog
 * value to itself would pass forever and read as coverage.
 */

/**
 * The three surfaces `domain/` alone draws the words for, swept 2026-08-22. Each is here
 * because the tests above rendered a clean tree over it: a shelf REASON needs a note the
 * axis refuses to read, the legend's workflow heading needs TWO workflows configured, and
 * the iteration board is a scope no fixture above enters.
 *
 * That is this construction's stated limit, met three times in one slice — it asks the
 * category of everything DRAWN, so a surface no fixture reaches is a surface it cannot
 * speak for. Marking the whole catalog does not fix that; only a fixture does.
 *
 * This block REPLACES one that claimed `domain/roadmap.ts`'s shelf label was still
 * English and asserted `toContain('Untriaged')` — the fixture's own note title, which is
 * data and renders unmarked whatever the catalog says. The label had been keyed three
 * days earlier (`placement.unplaced`, 2026-08-19) and nothing noticed, because the
 * assertion never read the label at all. A positive `toContain` on a remainder is the
 * shape that can pass for the wrong reason; the `toEqual`s above cannot.
 */
/**
 * The text at one selector, asserted to be there AND to be marked. The remainder alone
 * cannot hold these three: a heading that stops being drawn REMOVES a string rather than
 * making one English, and every `toEqual` in this file asks what rendered unmarked, so a
 * fixture that quietly drew no legend section at all would pass. The comment above
 * `progressNote` names that shape; here it is cheap enough to close.
 */
function markedAt(el: HTMLElement, selector: string): string[] {
	const texts = Array.from(el.querySelectorAll<HTMLElement>(selector), (node) => node.textContent?.trim() ?? '');
	expect(texts.every((text) => text.startsWith(MARK))).toBe(true);
	return texts;
}

describe('what only domain/ can say, said from the catalog', () => {
	it('names a shelved card its reason, from domain/roadmap.ts', () => {
		// A horizon the axis cannot read: the shelf draws the reason under the card and
		// repeats it as the card's tooltip. `horizonVault`'s untriaged note shelves with no
		// reason at all, which is why that fixture never reached this string.
		const vault = horizonVault();
		// An OBJECT, not a list: `readPlacement` takes a list's first entry, so `['Now',
		// 'Later']` places in `Now` and reaches no reason at all.
		vault.addFile('Unreadable.md', { frontmatter: { type: 'Epic', order: 40, horizon: { when: 'soon' } } });
		const { containerEl } = makeRoadmap(vault, {});

		expect(markedAt(containerEl, '.pbl-shelf-reason')).toHaveLength(1);
		expect(remainder(containerEl)).toEqual(['Epic', 'Later', 'Later item', 'Next', 'Now', 'Now item', 'Unreadable', 'Untriaged']);
	});

	it('names a shelved bar its three reasons, from domain/bars.ts', () => {
		// One per branch of `placeItem`: an unreadable start, an unreadable target, and a
		// pair the right way round in the note and the wrong way round in time.
		const vault = new FakeVault();
		vault.addFile('Bad start.md', { frontmatter: { type: 'Epic', order: 10, start: ['not', 'a date'], due: '2026-08-10' } });
		vault.addFile('Bad due.md', { frontmatter: { type: 'Epic', order: 20, start: '2026-08-01', due: ['not', 'a date'] } });
		vault.addFile('Backwards.md', { frontmatter: { type: 'Epic', order: 30, start: '2026-08-10', due: '2026-08-01' } });
		const { containerEl } = roadmapView(vault, { startProperty: 'note.start', targetProperty: 'note.due' });

		expect(new Set(markedAt(containerEl, '.pbl-shelf-reason'))).toHaveLength(3);
		expect(remainder(containerEl).filter((text) => !/^\d{4}-\d\d-\d\d$/.test(text) && !/^\w{3}$/.test(text))).toEqual([
			'Backwards',
			'Bad due',
			'Bad start',
			'Epic',
		]);
	});

	it('heads each legend section with its workflow name, from domain/board.ts', () => {
		// TWO workflows, which is the only configuration that draws the headings at all:
		// `statePalettes` gives a lone palette an empty label and the legend draws no
		// section for it, so every other fixture in this file renders past them.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing', start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('Doc.md', {
			frontmatter: { type: 'Deliverable', order: 20, stage: 'Draft', start: '2026-08-01', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, {
			startProperty: 'note.start',
			targetProperty: 'note.due',
			stateProperty: 'note.status',
			stateValues: 'New, Doing, Done',
			deliverableStateProperty: 'note.stage',
			deliverableStateValues: 'Draft, Published',
			deliverableDoneValues: 'Published',
		});

		expect(markedAt(containerEl, '.pbl-legend-group')).toHaveLength(2);
		// The state VALUES of both workflows, and the type names beside them. The two
		// headings ABOVE them — `Work` and `Deliverables` — are what `markedAt` just read.
		expect(remainder(containerEl).filter((text) => !/^\d{4}-\d\d-\d\d$/.test(text) && !/^\w{3}$/.test(text))).toEqual([
			'Deliverable',
			'Doing',
			'Done',
			'Draft',
			'Epic',
			'Published',
		]);
	});

	it('names the three iteration buckets from it, in domain/board.ts', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Ready.md', { frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' } });
		const { containerEl, view } = makeView(
			vault,
			{
				stateProperty: 'note.status',
				stateValues: 'New, Doing, Done',
				iterationProperty: 'note.iteration',
				iterationOpenStates: 'New',
				iterationResolvedStates: 'Done',
			},
			{ base: 'Plan.base' },
		);
		view.setBoardScope('Sprint 12.md');

		// The three column names are not data: a bucket writes the state its representative
		// names, never its own label. What is left is the iteration's title, the card's, and
		// its type.
		expect(markedAt(containerEl, '.pbl-board-col-name')).toHaveLength(3);
		expect(remainder(containerEl)).toEqual(['PBI', 'Ready', 'Sprint 12']);
	});
});

/**
 * The release view, swept 2026-08-23 — the fourth surface this instrument is pointed at,
 * and the first whose keys were held by nothing but the lint bans and a reading. Both
 * shapes the bans cannot see are live here: `renderScope` hands its empty-state sentences
 * to `guidanceShell` as positional ARGUMENTS, and every heading in `renderIndex` is
 * returned from a helper rather than spelled at a setter.
 *
 * Both screens AND all four empty states, because this view's screens are chosen rather
 * than switched: an empty state is the whole render, so a fixture that draws one draws
 * nothing else, and the index and the scope never appear together.
 */
describe('the release view reads every word it draws from the catalog', () => {
	it('leaves nothing but names, versions, dates and status values unmarked on the index', () => {
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);

		// Every one of these is what a note HOLDS: two release titles and an undated third,
		// the `version` strings, the formatted target dates, and the `status` values a
		// catalog that translated them would make unwritable in another locale.
		expect(remainder(containerEl)).toEqual([
			'0.8',
			'0.8.0',
			'0.9',
			'0.9.0',
			'2026-09-12',
			'2026-10-24',
			'Idea',
			'In progress',
			'Planned',
			'Someday',
		]);
	});

	it("leaves nothing but the release's own facts and its rows' titles unmarked on the scope", () => {
		const vault = scopeVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');

		// The header's own count, the context ancestor's marker and every badge came from
		// the catalog; the title, the version, the date, the status and the type names on
		// the badges are the notes' own.
		expect(containerEl.querySelector('.pbl-rel-context')).not.toBeNull();
		expect(remainder(containerEl)).toEqual(['1.0.0', '2026-09-12', 'E', 'Epic', 'F1', 'F2', 'Feature', 'In progress', 'R']);
	});

	it('draws all four empty states from it, and the unresolved note beside one', () => {
		// Each is the WHOLE render, so each needs its own mount. `Release` and `Feature` are
		// TYPE names — what a note's `type` key holds — and are data wherever they appear.
		const noType = makeReleaseView(releaseVault(), { typeProperty: '' });
		expect(markedAt(noType.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(noType.containerEl)).toEqual([]);

		// No release, and a work item naming one: the empty state AND the count of
		// memberships that resolved to nothing, which is this base's whole information.
		const empty = new FakeVault();
		empty.addFile('F.md', { frontmatter: { type: 'Feature', order: 1, release: '[[Missing]]' } });
		const noReleases = makeReleaseView(empty, RELEASE_CONFIG);
		expect(markedAt(noReleases.containerEl, '.pbl-rel-unresolved')).toHaveLength(1);
		expect(remainder(noReleases.containerEl)).toEqual([]);

		// A release open with no membership property bound: the header still stands, so its
		// facts are the remainder and the two sentences beneath it are marked.
		const unbound = makeReleaseView(scopeVault(), { ...RELEASE_CONFIG, membershipProperty: '' });
		unbound.view.pick('R.md');
		expect(markedAt(unbound.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(unbound.containerEl)).toEqual(['1.0.0', '2026-09-12', 'In progress', 'R']);

		// And a release nothing is in — whose title is a PARAMETER inside the sentence, so
		// its own name arrives unmarked from inside a marked string.
		const nobody = new FakeVault();
		nobody.addFile('R.md', { frontmatter: { type: 'Release' } });
		const bare = makeReleaseView(nobody, RELEASE_CONFIG);
		bare.view.pick('R.md');
		expect(markedAt(bare.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(bare.containerEl)).toEqual(['R']);
	});
});

/**
 * The my-work view (Task 6 of [[Assigned work in the sidebar]]), the fifth surface this
 * instrument is pointed at. Its own row is the release scope's shape again — the disclosure
 * aria-label is `release.scope.collapse`/`release.scope.expand` reused rather than a second
 * pair of keys — so nothing here is a new shape for this instrument to catch; what earns it
 * a block is the one new sentence this task lands, `mywork.next`/`mywork.nextTip`.
 */
describe('the my-work view reads every word it draws from the catalog', () => {
	it('leaves nothing but titles and type names unmarked, and marks the Next label', () => {
		const { view, containerEl } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		expect(markedAt(containerEl, '.pbl-mw-next')).toHaveLength(1);
		// Every title and every type badge is the notes' own data; nothing else is drawn
		// unmarked — no state chip, since none of these notes carry a configured state.
		// `Bo` joins the remainder here (Task 8): the toolbar's own person picker names
		// every `Resource` the base returned, and an option's TEXT is a person's name —
		// data, the same as `Ada` already was from the tree's own `aria-label`.
		expect(remainder(containerEl)).toEqual(['Ada', 'Bo', 'Epic', 'Feature', 'PBI', 'PBI Ada', 'PBI Hidden']);
	});

	it('draws its state chip from the catalog too, on a done member', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada', status: 'Done' } });
		const { view, containerEl } = makeMyWorkView(vault, { stateProperty: 'note.status' });
		view.pick('People/Ada.md');

		// The state VALUE is data — what `status:` holds in the note — but the icon beside
		// it carries no text, and nothing marks nothing: a done member with no Next marker
		// (it is the only member, and it is finished) draws only its title, its type and its
		// state value unmarked.
		expect(remainder(containerEl)).toEqual(['Ada', 'Done', 'PBI']);
	});

	it('draws every empty state from the catalog', () => {
		// No roster at all.
		const noRoster = makeMyWorkView(myWorkVault({ resources: false }));
		expect(markedAt(noRoster.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(noRoster.containerEl)).toEqual([]);

		// A roster, nobody picked yet — the toolbar (Task 8) draws its picker here too,
		// naming both `Resource` notes in `myWorkVault()`'s own roster.
		const noPick = makeMyWorkView(myWorkVault());
		expect(markedAt(noPick.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(noPick.containerEl)).toEqual(['Ada', 'Bo']);

		// Picked, nothing assigned to them. Only Ada is on this roster, so the picker
		// names just her.
		const noWorkVault = new FakeVault();
		noWorkVault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		const noWork = makeMyWorkView(noWorkVault);
		noWork.view.pick('People/Ada.md');
		expect(markedAt(noWork.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(noWork.containerEl)).toEqual(['Ada']);

		// Everything of theirs is done and hidden.
		const allDoneVault = new FakeVault();
		allDoneVault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		allDoneVault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada', status: 'Done' } });
		const allDone = makeMyWorkView(allDoneVault, { stateProperty: 'note.status' });
		allDone.view.pick('People/Ada.md');
		setScopeFlag(allDone.view, 'myWorkHideDone', true);
		expect(markedAt(allDone.containerEl, '.pbl-empty-title')).toHaveLength(1);
		expect(remainder(allDone.containerEl)).toEqual(['Ada']);
	});
});
