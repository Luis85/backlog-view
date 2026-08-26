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

/**
 * The design's own layout: a bar, a counted phrase folding the member count in, and the
 * two ways progress can legitimately draw nothing (no members at all; a state property
 * that is unbound). Each test builds its own small vault rather than `releaseVault()`,
 * which has no members and is shared with `test/i18n/projections.test.ts` and
 * `test/domain/bars.test.ts` — files outside this task's whitelist.
 */
describe('the band’s progress line', () => {
	useViewHarness();

	it('draws a bar and the counted phrase when membership and state are both bound', () => {
		const vault = new FakeVault();
		vault.addFile('0.8.md', {
			frontmatter: { type: 'Release', version: '0.8.0', 'target-date': '2026-09-12', status: 'In progress' },
		});
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Doing' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;
		expect(band.querySelector('.pbl-rel-bar')).not.toBeNull();
		expect(band.querySelector('.pbl-rel-progress')?.textContent).toBe(
			en['column.rollupTooltip'].other.replace('{done}', '1').replace('{count}', '2'),
		);
		expect(band.querySelector('.pbl-state-chip')?.textContent).toContain('In progress');
	});

	it('says a member is done, singular, at exactly one of one', () => {
		// The whole reason `column.rollupTooltip` is reused rather than a release-specific
		// key with `{total}`: a key that cannot accept a parameter named `count` cannot
		// select this form at all (see the catalog's own comment at the key).
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);

		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;
		expect(band.querySelector('.pbl-rel-progress')?.textContent).toBe(
			en['column.rollupTooltip'].one.replace('{done}', '1').replace('{count}', '1'),
		);
	});

	it('says there is nothing to count rather than drawing an empty bar', () => {
		const vault = new FakeVault();
		vault.addFile('0.9.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-12' } });
		const { containerEl } = makeReleaseView(vault, RELEASE_CONFIG);
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.textContent).toContain(en['release.index.noMembers']);
		expect(band.querySelector('.pbl-rel-bar')).toBeNull();
	});

	it('leaves the bar and the phrase absent when membership is bound but the state property is not, and names it once beneath the list', () => {
		// Extension 2a's own case: a done count with no state property to read is a
		// configuration to fix, not a truthful zero.
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release', version: '0.8.0' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', release: '[[0.8]]', status: 'Done' } });
		const { containerEl } = makeReleaseView(vault, { ...RELEASE_CONFIG, stateProperty: '' });
		const band = containerEl.querySelector('.pbl-rel-band') as HTMLElement;

		expect(band.querySelector('.pbl-rel-bar')).toBeNull();
		expect(band.querySelector('.pbl-rel-progress')).toBeNull();
		// Not the "no members" reading either — this release DOES have one.
		expect(band.querySelector('.pbl-rel-nomembers')).toBeNull();
		const note = containerEl.querySelector('.pbl-rel-note')?.textContent ?? '';
		expect(note).toContain('Progress');
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
		// Fix round 1, finding 2: `released: 'soon'` is invalid (`readTarget` refuses it,
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
		// The label says WHICH date is unreadable — not the bare, ambiguous word the target
		// branch uses, since this band could show either date.
		expect(band.querySelector('.pbl-rel-unreadable')?.textContent).toContain('Released');
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
