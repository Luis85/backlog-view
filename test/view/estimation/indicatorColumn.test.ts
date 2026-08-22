// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', {
		frontmatter: { 'strategic-alignment': 5, 'customer-value': 4, confidence: 4, effort: 2 },
	});
	vault.addFile('NoEffort.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4 } });
	return vault;
}

function values(over: Record<string, unknown> = {}): Record<string, unknown> {
	return configuredValues({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort', ...over });
}

function cell(containerEl: HTMLElement, path: string): HTMLElement {
	return containerEl.querySelector(`.pbl-est-row[data-path="${path}"] [data-col="indicator"]`) as HTMLElement;
}

function head(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector('.pbl-est-head [data-col="indicator"]');
}

describe('the indicator column', () => {
	it('draws a figure, and leaves a blocked cell empty with the operand in its tooltip', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		expect(cell(containerEl, 'Full.md').textContent).not.toBe('');
		expect(cell(containerEl, 'NoEffort.md').textContent).toBe('');
		expect(cell(containerEl, 'NoEffort.md').title).toBe('No figure: Effort is not answered');
	});

	it('says which failure blocked it, not "not answered" for all three', () => {
		const vault = fixture();
		vault.addFile('ZeroEffort.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 0 } });
		const { containerEl } = makeEstimationView(vault, values({ indicatorOperands: 'nosuchthing' }));
		expect(cell(containerEl, 'Full.md').title).toBe('No figure: nothing in this model is called nosuchthing');
		const divided = makeEstimationView(vault, values());
		expect(cell(divided.containerEl, 'ZeroEffort.md').title).toBe('No figure: Effort has to be above zero to divide by');
	});

	it('heads the column with the configured name, and its formula as the tooltip', () => {
		const { containerEl } = makeEstimationView(fixture(), values({ indicatorLabel: 'RICE' }));
		expect(head(containerEl)?.textContent).toBe('RICE');
		expect(head(containerEl)?.title).toContain('Adjusted value ÷ Effort');
	});

	it('falls back to a generic word, never to the formula, when nothing has named it', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		expect(head(containerEl)?.textContent).toBe('Indicator');
		expect(head(containerEl)?.title).toBe('Adjusted value ÷ Effort');
	});

	it('draws no column at all when no operand is named', () => {
		const { containerEl } = makeEstimationView(fixture(), values({ indicatorOperands: '' }));
		expect(head(containerEl)).toBeNull();
		expect(containerEl.querySelectorAll('[data-col="indicator"]')).toHaveLength(0);
	});

	it('ignores a stored sort naming the column when no indicator is drawn', () => {
		const { containerEl } = makeEstimationView(fixture(), values({ indicatorOperands: '' }));
		// Nothing is drawn for the indicator, so nothing can show or change that pick — the
		// pass falls back to Base order rather than sorting by a column that is not there.
		expect([...containerEl.querySelectorAll('.pbl-est-row')].map((row) => (row as HTMLElement).dataset.path)).toEqual([
			'Full.md',
			'NoEffort.md',
		]);
		expect(containerEl.querySelector('[aria-sort]')).toBeNull();
	});

	it('sorts by it, putting the item with no figure last in both directions', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		const order = (): string[] =>
			[...containerEl.querySelectorAll('.pbl-est-row')].map((row) => (row as HTMLElement).dataset.path as string);
		const header = head(containerEl) as HTMLElement;
		header.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order()).toEqual(['Full.md', 'NoEffort.md']);
		(head(containerEl) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order()).toEqual(['Full.md', 'NoEffort.md']);
	});
});
