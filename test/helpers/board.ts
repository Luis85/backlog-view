/** Accessors for the board projection, shared by the board view suites. */

export function columnsOf(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-board-col'));
}

export function columnNames(containerEl: HTMLElement): string[] {
	return columnsOf(containerEl).map((c) => c.querySelector('.pbl-board-col-name')?.textContent ?? '');
}

export function columnByName(containerEl: HTMLElement, name: string): HTMLElement {
	const col = columnsOf(containerEl).find((c) => c.querySelector('.pbl-board-col-name')?.textContent === name);
	if (!col) throw new Error(`column not found: ${name}`);
	return col;
}

export function cardTitles(el: HTMLElement): string[] {
	return Array.from(el.querySelectorAll<HTMLElement>('.pbl-card')).map(
		(c) => c.querySelector('.pbl-card-title')?.textContent ?? '',
	);
}

export function cardByTitle(containerEl: HTMLElement, title: string): HTMLElement {
	const card = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card')).find(
		(c) => c.querySelector('.pbl-card-title')?.textContent === title,
	);
	if (!card) throw new Error(`card not found: ${title}`);
	return card;
}

export function countOf(col: HTMLElement): string {
	return col.querySelector('.pbl-board-col-count')?.textContent ?? '';
}
