/** Fixtures and accessors for the roadmap projection, shared by its view suites. */
import { FakeVault } from './vault';
import { Harness, makeView } from './view';

/** The horizon axis the roadmap suites configure: `horizon` as the property. */
const HORIZON_AXIS = { horizonProperty: 'note.horizon' };

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

export function barOf(row: HTMLElement): HTMLElement {
	const bar = row.querySelector<HTMLElement>('.pbl-bar');
	if (!bar) throw new Error('bar not rendered');
	return bar;
}

/** The timeline row for a given title, or null when it is not on the grid at all. */
export function rowFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	return timelineRows(containerEl).find((r) => r.querySelector('.pbl-card-title')?.textContent === title) ?? null;
}

/** The bar inside the timeline row for a given title. */
export function barFor(containerEl: HTMLElement, title: string): HTMLElement {
	const row = rowFor(containerEl, title);
	if (!row) throw new Error(`row not found: ${title}`);
	return barOf(row);
}

/** One of a bar's grips, by which hold it is. */
export function gripOf(containerEl: HTMLElement, title: string, hold: 'body' | 'start' | 'end'): HTMLElement {
	const el = barFor(containerEl, title).parentElement?.querySelector<HTMLElement>(`[data-pbl-hold="${hold}"]`);
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
