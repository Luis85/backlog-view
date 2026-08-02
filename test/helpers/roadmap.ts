/** Accessors for the roadmap projection, shared by the roadmap view suites. */

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
