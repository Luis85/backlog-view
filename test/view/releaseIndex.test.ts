// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, releaseVault } from '../helpers/release';
import { click } from '../helpers/estimation';
import { flush, useViewHarness } from '../helpers/view';
import { en } from '../../src/i18n/en';
import { FakeVault } from '../helpers/vault';

/**
 * The index screen: one BAND per release, the two notes beneath the bands, and the two
 * inputs that open a release.
 *
 * `click` comes from `../helpers/estimation` because that is where it lives — the release
 * helper deliberately re-exports nothing it does not need, and a second copy of a
 * three-line dispatcher is a second thing to keep in step.
 */
describe('the release index', () => {
	useViewHarness();

	it('draws one band per release, in the domain module’s order', () => {
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const names = [...containerEl.querySelectorAll('.pbl-rel-name')].map((el) => el.textContent);
		expect(names).toEqual(['0.8', '0.9', 'Someday']);
		// EVERY chip on this screen is the read-only one, stated as the category rather than
		// as three places: the view offers no write, and
		// `.pbl-state-chip:not(.pbl-state-static):hover` would give a chip that lost the class
		// a hover affordance — the screen would look editable.
		expect(containerEl.querySelectorAll('.pbl-state-chip')).toHaveLength(3);
		expect(containerEl.querySelectorAll('.pbl-state-chip:not(.pbl-state-static)')).toHaveLength(0);
	});

	it('opens a release when its band is clicked', () => {
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		click(containerEl.querySelector('.pbl-rel-band[data-path="0.8.md"]') as HTMLElement);
		expect(view.pickedPath).toBe('0.8.md');
	});

	/**
	 * Codex, PR #206: `pbl-rel-band` joined `FOCUS_HANDLE_CLASSES` so a redraw would put
	 * focus back on the band a reader was on, but the restore took the FIRST element
	 * carrying the class — and unlike every other handle there is one band per release. A
	 * routine metadata refresh therefore moved a keyboard reader silently to the top of the
	 * list. `0.9.md` is deliberately the middle band: matching the first one, or the last,
	 * would both pass on an end.
	 */
	it('puts focus back on the SAME band across a refresh, not the first one', () => {
		const vault = releaseVault();
		const { view, containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector<HTMLElement>('.pbl-rel-band[data-path="0.9.md"]');
		band?.focus();

		// Nothing about this refresh is a press: `render()`'s own restore is the only thing
		// that can put focus anywhere afterwards.
		view.onDataUpdated();

		expect((document.activeElement as HTMLElement | null)?.dataset.path).toBe('0.9.md');
	});

	it('makes every band a real button, so a keyboard can reach and press it', () => {
		// The index-to-scope transition is this view's ENTIRE navigation. A pointer-only
		// band would make the release view unreachable for a keyboard or screen-reader
		// user, which no amount of correct derivation behind it makes acceptable.
		//
		// **jsdom cannot answer whether a band is FOCUSABLE**, and this test does not claim
		// to — see `test/harness/releaseHarness.test.ts` for what a browser answers instead.
		// What is asserted here is what jsdom can honestly see: the ELEMENT, which is what
		// delegates the tab stop, Enter, Space and Space-does-not-scroll to the browser, its
		// accessible name, and that activating it picks the release.
		const { view, containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const bands = [...containerEl.querySelectorAll('.pbl-rel-band')] as HTMLButtonElement[];
		expect(bands).toHaveLength(3);
		expect(bands.map((el) => el.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
		// `type="button"`, or a band nested in a form would submit it.
		expect(bands.map((el) => el.type)).toEqual(['button', 'button', 'button']);
		expect(bands[0]?.getAttribute('aria-label')).toContain('0.8');
		click(containerEl.querySelector('.pbl-rel-band[data-path="0.9.md"]') as HTMLElement);
		expect(view.pickedPath).toBe('0.9.md');
	});

	it('puts no flow content inside a band, whose content model is phrasing', () => {
		// Asked at the FORBIDDEN THING rather than of the elements somebody remembered: a
		// `<button>` may hold phrasing content only, so the check is that a band holds no
		// `div` AT ALL — which covers an element added to the band next year without anyone
		// editing this test. The grid this band replaced used spans for exactly this reason
		// and said so; the sentence was lost with the grid and the band shipped four divs.
		//
		// Layout is not what this pins (jsdom computes none) — a span that is a flex item or
		// is absolutely positioned is blockified, so the swap moved nothing, measured in
		// headless Chromium at 500px. What it pins is the MARKUP being legal.
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const bands = [...containerEl.querySelectorAll('.pbl-rel-band')];
		expect(bands).toHaveLength(3);
		for (const band of bands) expect(band.querySelectorAll('div')).toHaveLength(0);
		// Both directions: a band that drew nothing holds no div either.
		expect(containerEl.querySelectorAll('.pbl-rel-band .pbl-rel-line1')).toHaveLength(3);
	});

	it('names an unconfigured figure ONCE, and never blanks it per row', () => {
		const { containerEl } = makeReleaseView(releaseVault(), { ...RELEASE_CONFIG, versionProperty: '' });
		// Asserted BEFORE the absences, because every assertion below this one passes on a
		// screen that drew nothing at all.
		expect([...containerEl.querySelectorAll('.pbl-rel-name')].map((el) => el.textContent)).toEqual([
			'0.8',
			'0.9',
			'Someday',
		]);
		expect(containerEl.querySelectorAll('.pbl-rel-version')).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-rel-note')).toHaveLength(1);
		// BOTH directions, because either alone passes on a report that names the wrong set.
		const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
		expect(note).toContain('Version');
		for (const drawn of ['Target', 'Status', 'Items', 'Progress']) expect(note).not.toContain(drawn);
	});

	it('names the released date once beneath the list when releasedDateProperty is cleared', () => {
		// Fix round 1, finding 1: without this entry every release reads as in flight
		// (`shipped` is `released.value !== null`, and an unconfigured figure's value is
		// always null) and nothing on screen says why the Shipped grouping never appears.
		const { containerEl } = makeReleaseView(releaseVault(), { ...RELEASE_CONFIG, releasedDateProperty: '' });
		const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
		expect(note).toContain('Released');
		// Every OTHER figure in this fixture is fully configured, so this is the one name
		// the note should carry — not a symptom of a broader break.
		for (const drawn of ['Version', 'Target', 'Status', 'Items', 'Progress']) expect(note).not.toContain(drawn);
	});

	it('says unreadable rather than absent when somebody wrote something there', () => {
		const vault = releaseVault();
		vault.addFile('Bad.md', { frontmatter: { type: 'Release', 'target-date': 'soon' } });
		// A status this view cannot read as a label either — a list rather than a single
		// value, `readLabel`'s own refusal — drawn as a bare unreadable marker rather than
		// the state chip, unlike the ordinary version/target case above.
		vault.addFile('BadStatus.md', { frontmatter: { type: 'Release', status: ['A', 'B'] } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band[data-path="Bad.md"]') as HTMLElement;
		expect(band.querySelector('.pbl-rel-unreadable')).not.toBeNull();
		const badStatus = containerEl.querySelector('.pbl-rel-band[data-path="BadStatus.md"]') as HTMLElement;
		expect(badStatus.querySelector('.pbl-rel-unreadable')?.textContent).toBe(en['release.index.unreadable']);
		expect(badStatus.querySelector('.pbl-state-chip')).toBeNull();
		// A release with the key simply unset is the OTHER answer, in the same render.
		const someday = containerEl.querySelector('.pbl-rel-band[data-path="Someday.md"]') as HTMLElement;
		expect(someday.querySelector('.pbl-rel-unreadable')).toBeNull();
		expect(someday.querySelector('.pbl-rel-undated')).not.toBeNull();
	});

	it('reports the unresolved once, beneath the bands', () => {
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
		click(containerEl.querySelector('.pbl-rel-band') as HTMLElement);
		await flush();
		expect(vault.writeLog).toEqual([]);
	});
});

describe('what turns a band red, and what a shipped one shows', () => {
	useViewHarness();

	it('marks an overdue release and names why', () => {
		const vault = new FakeVault();
		// Far enough in the past that any real "today" this suite runs under is after it —
		// `todayCivil()` reads the real clock here, since it is the VIEW (not `releaseIndex`
		// directly) that supplies `today`, and there is no stub for it at this layer.
		vault.addFile('Late.md', { frontmatter: { type: 'Release', 'target-date': '2020-01-01' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.classList.contains('pbl-rel-overdue')).toBe(true);
		expect(band.querySelector('.pbl-rel-band-note')).not.toBeNull();
		// The overdue NOTE states the fact once — not a second, contradictory "days left"
		// beside the (red) date.
		expect(band.querySelector('.pbl-rel-days')).toBeNull();
	});

	it('shows the released date, not the target, once a release has shipped', () => {
		const vault = new FakeVault();
		vault.addFile('0.8.md', {
			frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12', released: '2026-09-20' },
		});
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.querySelector('.pbl-rel-date')?.textContent).toContain('2026-09-20');
		// Shipped, so never overdue — `domain/releases.ts`'s own rule, whatever the target.
		expect(band.classList.contains('pbl-rel-overdue')).toBe(false);
		// Shipped eight days after the target it was promised.
		expect(band.querySelector('.pbl-rel-band-note')?.textContent).toContain('8 days late');
	});

	it('refuses the overdue treatment and says the released value is unreadable, rather than misreporting a possibly-shipped release as definitely not', () => {
		// Fix round 1, finding 2: `released: 'soon'` is invalid (`readSoleDate` refuses it,
		// same as `target-date: 'soon'` does), so `released.value` is null and the domain's
		// `shipped` reads false — which is a correct statement about the VALUE and an
		// unwarranted one about whether the release actually shipped. A target in the past
		// is what makes `row.overdue` true from the domain alone, so this fixture is the
		// full shape of the bug: before the fix, the band drew the target's bare date with
		// NO unreadable marker, a `.pbl-rel-days` reading "2,428 days left" turned negative
		// by nothing (the guard never saw it), the `.pbl-rel-overdue` class, and a
		// `.pbl-rel-band-note` reading "2,428 days overdue" — a release that may already
		// have shipped painted red as though it definitely had not, with its own malformed
		// released value never mentioned anywhere on the band.
		const vault = new FakeVault();
		vault.addFile('Ambiguous.md', { frontmatter: { type: 'Release', 'target-date': '2020-01-01', released: 'soon' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.classList.contains('pbl-rel-overdue')).toBe(false);
		expect(band.querySelector('.pbl-rel-days')).toBeNull();
		expect(band.querySelector('.pbl-rel-band-note')).toBeNull();
		expect(band.querySelector('.pbl-rel-unreadable')?.textContent).toBe(
			en['release.figureUnreadable'].replace('{label}', en['release.index.column.released']),
		);
		// The label says WHICH date is unreadable, since this band's date position can carry
		// both figures at once — the target's own marker is labelled for the same reason.
		expect(band.querySelector('.pbl-rel-unreadable')?.textContent).toContain('Released');
	});

	it('claims no release overdue while the released date is unbound, whatever the target says', () => {
		// The same uncertainty the unreadable case above is refused for, with the figure
		// ABSENT rather than malformed: with `releasedDateProperty` cleared the view has no
		// way to know whether this release shipped, so the four overdue signals would be a
		// wrong fact told with the confidence of a right one. Every saved release view in
		// existence is in exactly this state on upgrade, since the binding is new.
		const vault = new FakeVault();
		vault.addFile('Late.md', { frontmatter: { type: 'Release', 'target-date': '2020-01-01' } });
		const { containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, releasedDateProperty: '' });
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.classList.contains('pbl-rel-overdue')).toBe(false);
		expect(band.querySelector('.pbl-rel-band-note')).toBeNull();
		// Spoken as well as drawn: the accessible name is its own reading of the same rule
		// (`speakWhen`/`noteText`), so a band silent on screen can still announce the fact.
		expect(band.getAttribute('aria-label')).not.toContain('overdue');
		// And no "days left" in its place — the target HAS passed, so a remaining-days
		// count is negative and reads as an error whether or not the band is painted red.
		expect(band.querySelector('.pbl-rel-days')).toBeNull();
		expect(band.getAttribute('aria-label')).not.toContain('day left');
		expect(band.getAttribute('aria-label')).not.toContain('days left');
		// The date itself still draws — the target is readable and is the only thing this
		// configuration can honestly say about when the release was due.
		expect(band.querySelector('.pbl-rel-date')?.textContent).toContain('2020-01-01');
	});

	it('says a shipped release’s target is unreadable, rather than dropping the figure with the slip', () => {
		// The same tri-state rule as the test above, in the direction the shipped branch
		// LEFT: `drawWhen` returns at the released date, so a malformed `target-date` was
		// never reached, the slip was null (it needs a target to subtract from) and NOTHING
		// on the band said why — while `renderScope.ts` reports that same target as
		// unreadable, so the two screens disagreed about one release.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'Release', 'target-date': 'soon', released: '2026-06-18' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		// The released date still leads — the figure that IS readable is not withheld
		// because its neighbour is not.
		expect(band.querySelector('.pbl-rel-date')?.textContent).toContain('2026-06-18');
		expect(band.querySelector('.pbl-rel-unreadable')?.textContent).toBe(
			en['release.figureUnreadable'].replace('{label}', en['release.index.column.target']),
		);
		// The LABELLED form, not the bare word: this band draws two dates, so which one is
		// unreadable is the whole content of the message.
		expect(band.querySelector('.pbl-rel-unreadable')?.textContent).toContain('Target');
		// Spoken as well as drawn — two readings of one rule, so both have to carry it.
		expect(band.getAttribute('aria-label')).toContain('Target unreadable');
		// The slip is still absent, and that is correct: there is no target to measure one
		// against. What changed is that the band now says why.
		expect(band.querySelector('.pbl-rel-band-note')).toBeNull();
	});

	it('says a release shipped early, and on time, from the same slip', () => {
		const vault = new FakeVault();
		vault.addFile('Early.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-12', released: '2026-09-10' } });
		vault.addFile('OnTime.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-12', released: '2026-09-12' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		expect(
			containerEl.querySelector('.pbl-rel-band[data-path="Early.md"] .pbl-rel-band-note')?.textContent,
		).toContain('2 days early');
		expect(containerEl.querySelector('.pbl-rel-band[data-path="OnTime.md"] .pbl-rel-band-note')?.textContent).toBe(
			en['release.index.shippedOnTime'],
		);
	});
});

describe('what a band says, as opposed to what it shows', () => {
	useViewHarness();

	it('names every figure it drew, so the columns survive being spoken', () => {
		// The band is a `<button>`, so its accessible name is its own contents run together —
		// the grid gave the eye figure pairs through position, which is the one channel a
		// screen reader does not have.
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const label = containerEl.querySelector('.pbl-rel-band[data-path="0.8.md"]')?.getAttribute('aria-label') ?? '';

		expect(label).toContain('0.8');
		// Each figure arrives with its own heading, not bare.
		expect(label).toContain('Version 0.8.0');
		expect(label).toContain('Status In progress');
		// The date is spoken as the band draws it — the user's own locale, via `formatCivil`.
		expect(label).toMatch(/Target \S/);
	});

	it('says nothing about a figure whose cell it drew empty', () => {
		// An announced "Version" with no version is worse than no mention, and the cell for
		// it is blank — so silence is what agrees with the screen.
		const { containerEl } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		const label = containerEl.querySelector('.pbl-rel-band[data-path="Someday.md"]')?.getAttribute('aria-label') ?? '';

		expect(label).toContain('Someday');
		expect(label).not.toContain('Version');
		// The undated target IS spoken, because it is the one absence [[Every release in one
		// list]] 3a puts an undated release at the bottom of its group for.
		expect(label).toContain('No target date');
	});

	it('drops a figure from the spoken name exactly when it drops it from the band', () => {
		// One list decides both, so an unbound key cannot leave a spoken figure behind.
		const { containerEl } = makeReleaseView(releaseVault(), { ...RELEASE_CONFIG, versionProperty: '' });
		const label = containerEl.querySelector('.pbl-rel-band[data-path="0.8.md"]')?.getAttribute('aria-label') ?? '';

		expect(label).not.toContain('Version');
		expect(label).toContain('Status In progress');
	});
});

describe('the two groups and their headings', () => {
	useViewHarness();

	/** Two in flight, two shipped — `releaseIndex` sorts the shipped pair into their own
	 *  tail (Task 5), so the flag changes exactly once down the list. */
	function groupedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Live.md', { frontmatter: { type: 'Release', 'target-date': '2026-12-01' } });
		vault.addFile('Ship1.md', { frontmatter: { type: 'Release', 'target-date': '2026-07-01', released: '2026-07-02' } });
		vault.addFile('Ship2.md', { frontmatter: { type: 'Release', 'target-date': '2026-06-01', released: '2026-06-02' } });
		return vault;
	}

	function headings(containerEl: HTMLElement): string[] {
		return [...containerEl.querySelectorAll('.pbl-rel-group')].map((el) => el.textContent ?? '');
	}

	it('heads each group where shipped-ness changes, with its own count', () => {
		const { containerEl } = makeReleaseView(groupedVault(), RELEASE_CONFIG);

		const texts = headings(containerEl);
		expect(texts).toHaveLength(2);
		expect(texts[0]).toContain(en['release.index.group.inFlight']);
		expect(texts[1]).toContain(en['release.index.group.shipped']);
		// Each count is its OWN group's size, never the list's three.
		expect(texts[0]).toContain('1');
		expect(texts[1]).toContain('2');
	});

	it('draws no heading for a group with no releases in it', () => {
		// An empty "Shipped" label is a claim about a group that does not exist here. The
		// heading falls at a ROW, so a group with no rows has nowhere to draw one.
		const vault = new FakeVault();
		vault.addFile('Live.md', { frontmatter: { type: 'Release', 'target-date': '2026-12-01' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		const texts = headings(containerEl);
		expect(texts).toHaveLength(1);
		expect(texts[0]).toContain(en['release.index.group.inFlight']);
	});

	it('heads the shipped group alone when nothing is in flight', () => {
		// The other end of the same rule: the FIRST row decides the first heading, so a
		// list that opens shipped must not be headed "In flight".
		const vault = new FakeVault();
		vault.addFile('Ship1.md', { frontmatter: { type: 'Release', 'target-date': '2026-07-01', released: '2026-07-02' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		expect(headings(containerEl)).toEqual([
			en['release.index.group.count'].replace('{label}', en['release.index.group.shipped']).replace('{count}', '1'),
		]);
	});

	it('keeps the heading out of the bands, and out of anything that walks them', () => {
		// The heading holds no note: it is not a `<button>`, it carries no `data-path`, and
		// nothing selecting `.pbl-rel-band` picks it up — so it is not a tab stop and never
		// a target of the click that opens a release.
		const { containerEl } = makeReleaseView(groupedVault(), RELEASE_CONFIG);

		expect(containerEl.querySelectorAll('.pbl-rel-band')).toHaveLength(3);
		for (const el of containerEl.querySelectorAll('.pbl-rel-group')) {
			expect(el.tagName).not.toBe('BUTTON');
			expect(el.hasAttribute('data-path')).toBe(false);
			expect(el.hasAttribute('tabindex')).toBe(false);
			expect(el.matches('.pbl-rel-band')).toBe(false);
		}
	});
});

/**
 * The date position at the end of line 1, asked as the PRODUCT of the two figures it
 * reports rather than as the cases somebody thought of.
 *
 * `released` and `target` are independent readings of independent properties, and three
 * separate review findings have landed on the one function that draws them — each fixed by
 * adding a branch, each new branch suppressing something else. Three single-case tests
 * existed and the fourth combination still shipped broken, which is this repository's own
 * rule about a category invariant: check it at the forbidden thing, never by listing the
 * places. So every cell below is a combination, and every cell asserts BOTH readings — what
 * the band draws and what it says — because the two are deliberately written as two
 * statements of one rule and so can drift apart.
 */
describe('the date position, over the product of both figures', () => {
	useViewHarness();

	const SHIP = '2026-06-18';
	/** Far enough either side of any real "today" this suite runs under that the sign of
	 *  `daysToTarget` is fixed: the view reads a real clock (`todayCivil()`), so a near date
	 *  would make a cell's answer depend on the day it is run. */
	const PAST = '2000-01-01';
	const FUTURE = '2099-01-01';
	/** The count is arithmetic against that clock, so the drawn figure is reduced to its
	 *  SENTENCE — the number itself is `release.index.daysLeft`'s own business. */
	const DAYS = 'days left';

	/**
	 * Every sentence this position can carry, spoken. A cell names what it says; everything
	 * else here must be ABSENT from its accessible name, which is what makes a cell an
	 * assertion in both directions rather than a `toContain` a louder band would also pass.
	 */
	const VOCABULARY = [
		'Released unreadable',
		`Released ${SHIP}`,
		'Target unreadable',
		'No target date',
		`Target ${PAST}`,
		`Target ${FUTURE}`,
		DAYS,
	];

	interface Cell {
		released: 'unbound' | 'unreadable' | 'shipped' | 'unset';
		target: 'unbound' | 'unreadable' | 'unset' | 'past' | 'future';
		/** What the position DRAWS, in order — the whole of it, so nothing extra may appear. */
		drawn: string[];
		/** What it SAYS. Every other entry in `VOCABULARY` must not be in the name. */
		spoken: string[];
		/** Present exactly where a figure with something to report is deliberately silent. */
		why?: string;
	}

	const SUPERSEDED = 'Shipped: the ship date has taken the date position, and the days count is arithmetic on the date it replaced.';

	const CELLS: Cell[] = [
		{ released: 'unbound', target: 'unbound', drawn: [], spoken: [] },
		{ released: 'unbound', target: 'unreadable', drawn: ['Target unreadable'], spoken: ['Target unreadable'] },
		{ released: 'unbound', target: 'unset', drawn: ['No target date'], spoken: ['No target date'] },
		{ released: 'unbound', target: 'past', drawn: [PAST], spoken: [`Target ${PAST}`] },
		{ released: 'unbound', target: 'future', drawn: [FUTURE, DAYS], spoken: [`Target ${FUTURE}`, DAYS] },

		{ released: 'unreadable', target: 'unbound', drawn: ['Released unreadable'], spoken: ['Released unreadable'] },
		{
			released: 'unreadable',
			target: 'unreadable',
			drawn: ['Released unreadable', 'Target unreadable'],
			spoken: ['Released unreadable', 'Target unreadable'],
		},
		{
			released: 'unreadable',
			target: 'unset',
			drawn: ['Released unreadable', 'No target date'],
			spoken: ['Released unreadable', 'No target date'],
		},
		{
			released: 'unreadable',
			target: 'past',
			drawn: ['Released unreadable', PAST],
			spoken: ['Released unreadable', `Target ${PAST}`],
		},
		{
			released: 'unreadable',
			target: 'future',
			drawn: ['Released unreadable', FUTURE, DAYS],
			spoken: ['Released unreadable', `Target ${FUTURE}`, DAYS],
		},

		{ released: 'shipped', target: 'unbound', drawn: [`Released ${SHIP}`], spoken: [`Released ${SHIP}`] },
		{
			released: 'shipped',
			target: 'unreadable',
			drawn: [`Released ${SHIP}`, 'Target unreadable'],
			spoken: [`Released ${SHIP}`, 'Target unreadable'],
		},
		{ released: 'shipped', target: 'unset', drawn: [`Released ${SHIP}`], spoken: [`Released ${SHIP}`], why: SUPERSEDED },
		{ released: 'shipped', target: 'past', drawn: [`Released ${SHIP}`], spoken: [`Released ${SHIP}`], why: SUPERSEDED },
		{ released: 'shipped', target: 'future', drawn: [`Released ${SHIP}`], spoken: [`Released ${SHIP}`], why: SUPERSEDED },

		{ released: 'unset', target: 'unbound', drawn: [], spoken: [] },
		{ released: 'unset', target: 'unreadable', drawn: ['Target unreadable'], spoken: ['Target unreadable'] },
		{ released: 'unset', target: 'unset', drawn: ['No target date'], spoken: ['No target date'] },
		{ released: 'unset', target: 'past', drawn: [PAST], spoken: [`Target ${PAST}`] },
		{ released: 'unset', target: 'future', drawn: [FUTURE, DAYS], spoken: [`Target ${FUTURE}`, DAYS] },
	];

	/** One release carrying exactly this cell's two values, under exactly its two bindings —
	 *  "unbound" is a CONFIGURATION state and "unset" a note one, which is the pair of
	 *  absences `ReleaseFigure` exists to keep apart. */
	function bandFor(cell: Cell): HTMLElement {
		const vault = new FakeVault();
		const frontmatter: Record<string, unknown> = { type: 'Release' };
		if (cell.released === 'unreadable') frontmatter.released = 'soon';
		if (cell.released === 'shipped') frontmatter.released = SHIP;
		if (cell.target === 'unreadable') frontmatter['target-date'] = 'soon';
		if (cell.target === 'past') frontmatter['target-date'] = PAST;
		if (cell.target === 'future') frontmatter['target-date'] = FUTURE;
		vault.addFile('R.md', { frontmatter });
		const config = { ...RELEASE_CONFIG };
		if (cell.released === 'unbound') config.releasedDateProperty = '';
		if (cell.target === 'unbound') config.targetDateProperty = '';
		const { containerEl } = makeReleaseView(vault, config);
		return containerEl.querySelector('.pbl-rel-band') as HTMLElement;
	}

	function drawnParts(band: HTMLElement): string[] {
		const whenEl = band.querySelector('.pbl-rel-when') as HTMLElement;
		return [...whenEl.children].map((el) => (el.textContent ?? '').replace(/^[\d,]+ days? /, 'days '));
	}

	it('asks the whole product, not a list of remembered cases', () => {
		// The dimensions themselves: four answers for `released`, five for `target`, every
		// pairing present exactly once. A cell dropped from the table below would otherwise
		// leave the suite looking complete.
		expect(CELLS).toHaveLength(4 * 5);
		expect(new Set(CELLS.map((cell) => `${cell.released}|${cell.target}`)).size).toBe(20);
	});

	it('supersedes a figure only where the design says so, and says why in the table', () => {
		// The one coupling: a ship date takes the date position. Asked of the whole table
		// rather than of the three cells — a `why` appearing anywhere else is a suppression
		// nobody decided, which is exactly how the three findings arrived.
		for (const cell of CELLS) {
			const supersedes = cell.released === 'shipped' && ['unset', 'past', 'future'].includes(cell.target);
			expect(Boolean(cell.why), `${cell.released} × ${cell.target}`).toBe(supersedes);
		}
	});

	for (const cell of CELLS) {
		it(`released ${cell.released} × target ${cell.target}`, () => {
			const band = bandFor(cell);
			expect(drawnParts(band)).toEqual(cell.drawn);
			const label = band.getAttribute('aria-label') ?? '';
			for (const phrase of cell.spoken) expect(label).toContain(phrase);
			for (const phrase of VOCABULARY) if (!cell.spoken.includes(phrase)) expect(label).not.toContain(phrase);
		});
	}
});
