// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_TIMELINE_DAYS } from '../../../src/domain/timeline';
import { loadViewState } from '../../../src/storage/viewStateStore';
import { button, makeReleaseView, noReleaseVault, RELEASE_CONFIG, releaseVault, scopeVault } from '../../helpers/release';
import { FakeVault } from '../../helpers/vault';
import { useViewHarness } from '../../helpers/view';
import { beyondPlan } from '../../helpers/window';

useViewHarness();

/** `makeReleaseView` with a `.base` leaf names the view `Backlog` under `Releases.base`. */
const ID = { base: 'Releases.base', view: 'Backlog' };
const STORE_KEY = 'product-backlog:view-state';

function onMap(vault: FakeVault, config: Record<string, unknown> = RELEASE_CONFIG) {
	const harness = makeReleaseView(vault, config, { base: 'Releases.base' });
	harness.view.setTab('map');
	return harness;
}

function release(vault: FakeVault, path: string, frontmatter: Record<string, unknown>): void {
	vault.addFile(path, { frontmatter: { type: 'Release', ...frontmatter } });
}

const paths = (el: HTMLElement, selector: string) =>
	Array.from(el.querySelectorAll<HTMLElement>(selector), (node) => node.dataset.path);
const texts = (el: Element, selector: string) => Array.from(el.querySelectorAll(selector), (node) => node.textContent);
const cssPx = (el: Element | null | undefined, name: string) =>
	parseFloat((el as HTMLElement | null | undefined)?.style.getPropertyValue(name) ?? 'NaN');
const rowOf = (el: HTMLElement, path: string) => el.querySelector<HTMLElement>(`.pbl-relmap-row[data-path="${path}"]`);

describe('the release map', () => {
	it('draws one row per dated release in date order, and the undated one on the shelf', () => {
		const { view } = onMap(releaseVault());
		expect(paths(view.viewEl, '.pbl-relmap-rows .pbl-relmap-row')).toEqual(['0.8.md', '0.9.md']);
		expect(paths(view.viewEl, '.pbl-relmap-shelf .pbl-relmap-row')).toEqual(['Someday.md']);
		expect(view.viewEl.querySelector('.pbl-relmap-shelf h2')?.textContent).toBe('Not scheduled (1)');
		expect(view.viewEl.querySelector('.pbl-rel-bands')).toBeNull();
	});

	it('draws a band only where a start was derived, and names it as derived', () => {
		const { view } = onMap(releaseVault());
		const first = rowOf(view.viewEl, '0.8.md');
		const second = rowOf(view.viewEl, '0.9.md');
		expect(first?.querySelector('.pbl-relmap-lead')).toBeNull();
		expect(first?.getAttribute('aria-label')).not.toContain('derived');
		const lead = second?.querySelector('.pbl-relmap-lead');
		expect(lead?.getAttribute('data-tooltip')).toBe('Start derived from the previous release');
		expect(second?.getAttribute('aria-label')).toContain('Start derived from the previous release');
		// The band runs from the first row's marker to the second row's.
		expect(cssPx(lead, '--pbl-relmap-x')).toBe(cssPx(first?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x'));
		expect(cssPx(lead, '--pbl-relmap-x') + cssPx(lead, '--pbl-relmap-w')).toBe(
			cssPx(second?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x'),
		);
	});

	it('draws no band for a release ending the same day as the one before it', () => {
		const vault = new FakeVault();
		release(vault, 'A.md', { 'target-date': '2026-10-01', order: 1 });
		release(vault, 'B.md', { 'target-date': '2026-10-01', order: 2 });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-lead')).toBeNull();
		expect(rowOf(view.viewEl, 'B.md')?.getAttribute('aria-label')).not.toContain('derived');
	});

	it('draws a slip as a tick at the target and a stub in the colour of its direction', () => {
		const vault = new FakeVault();
		release(vault, 'Late.md', { 'target-date': '2026-08-01', released: '2026-08-08' });
		release(vault, 'Early.md', { 'target-date': '2026-08-20', released: '2026-08-15' });
		release(vault, 'OnTime.md', { 'target-date': '2026-08-25', released: '2026-08-25' });
		const { view } = onMap(vault);

		const late = rowOf(view.viewEl, 'Late.md');
		expect(late?.classList.contains('pbl-relmap-shipped')).toBe(true);
		const lateTick = cssPx(late?.querySelector('.pbl-relmap-tick'), '--pbl-relmap-x');
		// Late: the stub starts at the tick and runs forward to the marker.
		expect(cssPx(late?.querySelector('.pbl-relmap-slip.pbl-relmap-late'), '--pbl-relmap-x')).toBe(lateTick);
		expect(lateTick).toBeLessThan(cssPx(late?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x'));

		// Early: the stub starts at the marker and runs forward to the tick.
		const early = rowOf(view.viewEl, 'Early.md');
		const earlyMarker = cssPx(early?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x');
		expect(cssPx(early?.querySelector('.pbl-relmap-slip.pbl-relmap-early'), '--pbl-relmap-x')).toBe(earlyMarker);
		expect(cssPx(early?.querySelector('.pbl-relmap-tick'), '--pbl-relmap-x')).toBeGreaterThan(earlyMarker);

		const onTime = rowOf(view.viewEl, 'OnTime.md');
		expect(onTime?.querySelector('.pbl-relmap-tick')).toBeNull();
		expect(onTime?.querySelector('.pbl-relmap-slip')).toBeNull();
	});

	it("draws the card's facts and headline scope from the list's own figures", () => {
		const { view } = onMap(scopeVault());
		const card = rowOf(view.viewEl, 'R.md')?.querySelector('.pbl-relmap-card');
		if (!card) throw new Error('no card for R.md');
		expect(card.querySelector('.pbl-relmap-name')?.textContent).toBe('R');
		expect(card.querySelector('.pbl-rel-version')?.textContent).toBe('1.0.0');
		expect(card.querySelector('.pbl-state-text')?.textContent).toBe('In progress');
		expect(card.querySelector('.pbl-rel-date')?.textContent).toBe('2026-09-12');
		expect(card.querySelector('.pbl-rel-days')?.textContent).toBe('12 days left');
		expect(card.querySelector('.pbl-rel-progress')?.textContent).toBe('0 of 2 items done');
		// The scope's one root is the context Epic holding both members in place.
		expect(texts(card, '.pbl-relmap-scope-item')).toEqual(['E']);
		expect(card.querySelector('.pbl-relmap-more')).toBeNull();
	});

	it('lists three headline items and counts the rest', () => {
		const vault = new FakeVault();
		release(vault, 'R.md', { 'target-date': '2026-09-12' });
		for (let i = 1; i <= 5; i++) vault.addFile(`P${i}.md`, { frontmatter: { type: 'PBI', order: i, release: '[[R]]' } });
		const { view } = onMap(vault);
		expect(texts(view.viewEl, '.pbl-relmap-scope-item')).toEqual(['P1', 'P2', 'P3']);
		expect(view.viewEl.querySelector('.pbl-relmap-more')?.textContent).toBe('+2 more');
	});

	it('paints a row overdue exactly where the list would', () => {
		const vault = new FakeVault();
		release(vault, 'Late.md', { 'target-date': '2026-08-20' });
		const bound = onMap(vault);
		expect(rowOf(bound.view.viewEl, 'Late.md')?.classList.contains('pbl-rel-overdue')).toBe(true);
		expect(rowOf(bound.view.viewEl, 'Late.md')?.querySelector('.pbl-rel-band-note')?.textContent).toBe('11 days overdue');

		const unbound = onMap(vault, { ...RELEASE_CONFIG, releasedDateProperty: '' });
		expect(rowOf(unbound.view.viewEl, 'Late.md')?.classList.contains('pbl-rel-overdue')).toBe(false);
	});

	it('opens a release on a click, and Back returns to the map', () => {
		const { view } = onMap(scopeVault());
		button(view, '.pbl-relmap-row[data-path="R.md"]').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).toBeNull();
		button(view, '.pbl-rel-back').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
		expect(loadViewState(view.app, ID).prefs.release).toBeUndefined();
	});

	it('opens a shelved release on a click too', () => {
		const { view } = onMap(releaseVault());
		button(view, '.pbl-relmap-shelf-row[data-path="Someday.md"]').click();
		expect(view.viewEl.querySelector('.pbl-relmap')).toBeNull();
		expect(loadViewState(view.app, ID).prefs.release).toBe('Someday.md');
	});

	it('reports the unresolved memberships beneath the map', () => {
		const vault = releaseVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 1, release: '[[Gone]]' } });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-scroll .pbl-rel-unresolved')).not.toBeNull();
	});

	it('writes nothing to a note or to the .base', () => {
		const { view, vault, config } = onMap(scopeVault());
		const files = vault.files.size;
		button(view, '.pbl-relmap-row[data-path="R.md"]').click();
		button(view, '.pbl-rel-back').click();
		view.setTab('list');
		expect(vault.writeLog).toEqual([]);
		expect(vault.files.size).toBe(files);
		expect(config.setCalls).toEqual([]);
	});
});

describe('the inputs most likely to surprise the map', () => {
	it('with no dated release at all, draws the ruler and puts every release on the shelf', () => {
		const vault = new FakeVault();
		release(vault, 'A.md', { order: 1 });
		release(vault, 'B.md', { order: 2 });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-rows .pbl-relmap-row')).toBeNull();
		expect(paths(view.viewEl, '.pbl-relmap-shelf .pbl-relmap-row')).toEqual(['A.md', 'B.md']);
		expect(view.viewEl.querySelectorAll('.pbl-relmap-cell').length).toBeGreaterThan(0);
	});

	it('with every release shipped, draws no shelf', () => {
		const vault = new FakeVault();
		release(vault, 'A.md', { 'target-date': '2026-07-01', released: '2026-07-02' });
		release(vault, 'B.md', { 'target-date': '2026-08-01', released: '2026-08-01' });
		const { view } = onMap(vault);
		expect(view.viewEl.querySelector('.pbl-relmap-shelf')).toBeNull();
	});

	it('shelves a release whose target nobody can read, and says so on its card', () => {
		const vault = new FakeVault();
		release(vault, 'Bad.md', { 'target-date': 'soon' });
		const { view } = onMap(vault);
		const card = view.viewEl.querySelector('.pbl-relmap-shelf .pbl-relmap-row[data-path="Bad.md"]');
		expect(card?.querySelector('.pbl-rel-unreadable')?.textContent).toBe('Target unreadable');
	});

	it('pins a release past the drawable window to its edge, marks it clipped, and still states its date', () => {
		const vault = new FakeVault();
		release(vault, 'Far.md', { 'target-date': beyondPlan() });
		const { view } = onMap(vault);
		const row = rowOf(view.viewEl, 'Far.md');
		expect(row?.classList.contains('pbl-relmap-clipped')).toBe(true);
		expect(cssPx(row?.querySelector('.pbl-relmap-marker'), '--pbl-relmap-x')).toBe((MAX_TIMELINE_DAYS - 1) * 4);
		expect(row?.querySelector('.pbl-rel-date')?.textContent).toBe(beyondPlan());
	});
});

describe('the tab is view state', () => {
	it('restores the map from the store on the next data update', () => {
		const { view } = onMap(releaseVault());
		expect(loadViewState(view.app, ID).prefs.releaseTab).toBe('map');
		view.tab = 'list';
		view.onDataUpdated();
		expect(view.tab).toBe('map');
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
	});

	it('draws the list for a stored tab it does not recognise', () => {
		const { view, vault } = onMap(releaseVault());
		const [key, entry] = Object.entries(vault.localStorage.get(STORE_KEY) as Record<string, Record<string, unknown>>)[0];
		vault.localStorage.set(STORE_KEY, { [key]: { ...entry, prefs: { releaseTab: 'Map' } } });
		view.onDataUpdated();
		expect(view.viewEl.querySelector('.pbl-relmap')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-rel-bands')).not.toBeNull();
	});

	it('keeps the tab for the session on an embedded base', () => {
		const { view } = makeReleaseView(releaseVault(), RELEASE_CONFIG);
		view.setTab('map');
		view.onDataUpdated();
		expect(view.viewEl.querySelector('.pbl-relmap')).not.toBeNull();
	});

	it.each([
		['no type property', releaseVault, { ...RELEASE_CONFIG, typeProperty: '' }],
		['no release', noReleaseVault, RELEASE_CONFIG],
	] as const)('draws the same empty state on both tabs with %s', (_, vaultOf, config) => {
		const { view } = makeReleaseView(vaultOf(), config, { base: 'Releases.base' });
		const list = view.viewEl.innerHTML;
		view.setTab('map');
		expect(view.viewEl.innerHTML).toBe(list);
	});
});
