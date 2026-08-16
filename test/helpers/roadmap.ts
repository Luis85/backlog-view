/** Fixtures and accessors for the roadmap projection, shared by its view suites. */
import { FakeVault } from './vault';
import { Harness, makeView } from './view';

/** The horizon axis the roadmap suites configure: `horizon` as the property. */
const HORIZON_AXIS = { horizonProperty: 'note.horizon' };

/** The three properties the resources axis reads, absences through them as well. */
const RESOURCE_AXIS = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/** Three epics across the declared vocabulary, one of them not triaged at all. */
export function horizonVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Now item.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
	vault.addFile('Later item.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Later' } });
	vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 30 } });
	return vault;
}

/**
 * One long-spanning item (so the dated axis's window has enough days to pan across)
 * beside several undated epics (so the shelf renders a band with real content) — the
 * fixture the frame's scroll-box and zoom-anchor tests share.
 */
export function shelfHeavyVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Anchor.md', { frontmatter: { type: 'Epic', order: 5, start: '2026-08-01', due: '2027-08-01' } });
	for (let i = 1; i <= 6; i++) {
		vault.addFile(`Undated ${i}.md`, { frontmatter: { type: 'Epic', order: i * 10 } });
	}
	return vault;
}

/**
 * A view already showing the roadmap. The mode is UI state, not a base setting, so
 * it is flipped through the host exactly as the toolbar does — never the config.
 * The shelf itself opens collapsed by default (Task 3) — expanded here unless the
 * caller passes `shelfCollapsed: true` to assert on the collapsed state itself, the
 * same escape hatch `makeView`'s `collapsed` param gives the tree.
 */
export function makeRoadmap(
	vault: FakeVault,
	extra: Record<string, unknown> = {},
	{ shelfCollapsed = false, focus }: { shelfCollapsed?: boolean; focus?: string } = {},
): Harness {
	const harness = makeView(vault, { ...HORIZON_AXIS, ...extra }, { collapsed: true, focus });
	harness.view.setProjection('roadmap');
	if (!shelfCollapsed) harness.view.setShelfCollapsed(false);
	return harness;
}

/**
 * `makeRoadmap`'s sibling for the suites that configure their own axis rather than
 * taking the horizon one: everything about the view comes from `cfg`, and nothing is
 * merged in behind it. The shelf is always opened — no caller of this one asserts on
 * the collapsed state, and `makeRoadmap`'s `shelfCollapsed` is where that escape
 * hatch already lives.
 */
export function roadmapView(vault: FakeVault, cfg: Record<string, unknown>, { base }: { base?: string } = {}): Harness {
	const harness = makeView(vault, cfg, { collapsed: true, base });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(false);
	return harness;
}

/**
 * A roadmap opened on the RESOURCES axis, with Alice and Bob declared — shared by the two
 * absence view suites, which must drive the same axis the same way or the wash one asserts
 * and the mark the other asserts are describing two different grids.
 *
 * `only` narrows what the Base returns, so everything else in the vault loads as a context
 * row, and `focus` is what puts such a row in the roadmap's row set at all — unfocused, that
 * set is `model.results`, which holds none. Both are working position rather than config
 * (ADR 0011), so they go to the harness beside `collapsed` and never into the view options.
 *
 * `shelf` opens it, which the two MOVE suites need and no absence test does: a shelf card
 * is a drag source and the shelf itself is the target that un-assigns.
 *
 * `resourceLanes.test.ts` keeps a near-twin of this deliberately: that one takes an
 * `expanded` flag driving the real expand-all control after the axis is picked, which no
 * suite here wants.
 */
export function laneRoadmap(
	vault: FakeVault,
	extra: Record<string, unknown> = {},
	{ only, focus, shelf }: { only?: string[]; focus?: string; shelf?: boolean } = {},
): Harness {
	const harness = makeView(vault, { ...RESOURCE_AXIS, resourceNames: 'Alice, Bob', ...extra }, {
		collapsed: true,
		only,
		focus,
	});
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	if (shelf) harness.view.setShelfCollapsed(false);
	return harness;
}

/** The header for a resource, which is one element of that resource's band. */
export function laneHead(containerEl: HTMLElement, name: string): HTMLElement {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	if (!head) throw new Error(`no row for ${name}`);
	return head;
}

export function bucketsOf(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-bucket'));
}

export function bucketNames(containerEl: HTMLElement): string[] {
	return bucketsOf(containerEl).map((b) => b.querySelector('.pbl-bucket-name')?.textContent ?? '');
}

export function bucketByName(containerEl: HTMLElement, name: string): HTMLElement {
	const bucket = bucketsOf(containerEl).find((b) => b.querySelector('.pbl-bucket-name')?.textContent === name);
	if (!bucket) throw new Error(`bucket not found: ${name}`);
	return bucket;
}

export function bucketCountOf(bucket: HTMLElement): string {
	return bucket.querySelector('.pbl-bucket-count')?.textContent ?? '';
}

export function shelfOf(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-shelf');
}

/**
 * True when the shelf is holding nothing and takes no space — the strip that only
 * a live drag can reach. Asserting the class rather than the layout on purpose:
 * jsdom applies no stylesheet, so whether it is out of the way is a vault check —
 * the class is what the rule turns on, and it is what a test can see.
 */
export function shelfIsEmptyStrip(containerEl: HTMLElement): boolean {
	return shelfOf(containerEl)?.hasClass('pbl-shelf-empty') ?? false;
}

export function shelfTitles(containerEl: HTMLElement): string[] {
	return Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-card-title') ?? []).map(
		(t) => t.textContent ?? '',
	);
}

export function shelfGroupHeaders(containerEl: HTMLElement): string[] {
	return Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-shelf-group-name') ?? []).map(
		(h) => h.textContent ?? '',
	);
}

export function shelfCountOf(containerEl: HTMLElement): string {
	return containerEl.querySelector('.pbl-shelf-count')?.textContent ?? '';
}

export function timelineRows(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
}

export function lanesOf(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head'));
}

export function laneNames(containerEl: HTMLElement): string[] {
	return lanesOf(containerEl).map((el) => el.querySelector('.pbl-lane-name')?.textContent ?? '');
}

export function laneCountOf(lane: HTMLElement): string {
	return lane.querySelector('.pbl-lane-count')?.textContent ?? '';
}

/** The away pill's text, or '' where the header draws none. */
export function laneAwayOf(lane: HTMLElement): string {
	return lane.querySelector('.pbl-lane-away')?.textContent ?? '';
}

/**
 * Every drawn row of the resources axis in order, headers included — what the reader's
 * eye walks down. A header reads as `lane:<name>` so one assertion can state both the
 * grouping and the order within a group, which two separate lists cannot.
 */
export function laneOrder(containerEl: HTMLElement): string[] {
	const rows = containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row');
	return Array.from(rows).map((el) =>
		el.classList.contains('pbl-lane-head')
			? `lane:${el.querySelector('.pbl-lane-name')?.textContent ?? ''}`
			: (el.querySelector('.pbl-card-title')?.textContent ?? ''),
	);
}

/** The titles the grid drew, in row order — what a disclosure adds to and takes away. */
export function timelineTitles(containerEl: HTMLElement): string[] {
	return timelineRows(containerEl).map((row) => row.querySelector('.pbl-card-title')?.textContent ?? '');
}

export function barOf(row: HTMLElement): HTMLElement {
	const bar = row.querySelector<HTMLElement>('.pbl-bar');
	if (!bar) throw new Error('bar not rendered');
	return bar;
}

/** The timeline row for a given title, or null when it is not on the grid at all. */
export function rowFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	return timelineRows(containerEl).find((r) => r.querySelector('.pbl-card-title')?.textContent === title) ?? null;
}

/**
 * The milestones' own shared row, on EITHER grid axis — null where no marker placed and the
 * row was therefore never minted.
 */
export function markersLane(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-lane-markers');
}

/**
 * One marker's diamond in that row, by title — what replaced its bar ROW on both grid axes.
 * Found by the mark's own visually hidden CONTENT rather than by its path, because that is
 * the fact a reader gets and the one every projection has to keep. Content and not a label:
 * `.pbl-bar` is a plain div, where ARIA prohibits an accessible name.
 */
export function markFor(containerEl: HTMLElement, title: string): HTMLElement {
	const marks = Array.from(markersLane(containerEl)?.querySelectorAll<HTMLElement>('.pbl-bar') ?? []);
	const mark = marks.find((el) => el.querySelector('.pbl-sr-only')?.textContent?.startsWith(`${title} — `));
	if (!mark) throw new Error(`no marker diamond for ${title}`);
	return mark;
}

/** The bar inside the timeline row for a given title. */
export function barFor(containerEl: HTMLElement, title: string): HTMLElement {
	const row = rowFor(containerEl, title);
	if (!row) throw new Error(`row not found: ${title}`);
	return barOf(row);
}

/**
 * One of a bar's grips, by which hold it is — off its bar row, or off its diamond in the
 * milestones' shared row, which is where a marker lives on both grid axes.
 *
 * Asked of the MARK rather than of its parent, which is the shared track for a marker and
 * would hand back whichever diamond drew first.
 */
export function gripOf(containerEl: HTMLElement, title: string, hold: 'body' | 'start' | 'end'): HTMLElement {
	const mark = rowFor(containerEl, title) !== null ? barFor(containerEl, title) : markFor(containerEl, title);
	// The body hold IS the bar element on every grid; the edge grips are its children.
	const el = mark.dataset.pblHold === hold ? mark : mark.querySelector<HTMLElement>(`[data-pbl-hold="${hold}"]`);
	if (!el) throw new Error(`no ${hold} grip on ${title}`);
	return el;
}

/** Which holds a bar actually offers, in drawn order. */
export function gripNames(containerEl: HTMLElement, title: string): string[] {
	const row = rowFor(containerEl, title);
	return Array.from(row?.querySelectorAll<HTMLElement>('[data-pbl-hold]') ?? []).map((el) => el.dataset.pblHold ?? '');
}

/** Every milestone line's label text, in the order the header draws them. */
export function labelTexts(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-milestone-label')).map((l) => l.textContent ?? '');
}

/** Every header cell's text across BOTH tiers, in drawn order — super tier first. */
export function cellLabels(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-cell')).map((c) => c.textContent ?? '');
}
