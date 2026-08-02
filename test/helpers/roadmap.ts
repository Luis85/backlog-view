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
 * A view already showing the roadmap. The mode is UI state, not a base setting, so
 * it is flipped through the host exactly as the toolbar does — never the config.
 */
export function makeRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...HORIZON_AXIS, ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
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

export function shelfCountOf(containerEl: HTMLElement): string {
	return shelfOf(containerEl)?.querySelector('.pbl-shelf-count')?.textContent ?? '';
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

/** Every milestone line's label text, in the order the header draws them. */
export function labelTexts(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-milestone-label')).map((l) => l.textContent ?? '');
}
