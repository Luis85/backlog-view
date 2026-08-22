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

	// CONTROLLER AMENDMENT 1: a scale with no key bound to it is a different failure from a
	// bound scale nobody has answered.
	it('says a scale is unbound rather than unanswered, when nothing has bound it', () => {
		// Neither confidenceProperty nor effortProperty is bound here — `values()` above
		// binds both, so this test deliberately uses the plain `configuredValues()` instead.
		const { containerEl } = makeEstimationView(fixture(), configuredValues({ indicatorOperands: 'effort', indicatorDivisor: '' }));
		expect(cell(containerEl, 'Full.md').title).toBe('No figure: Effort has no property bound to it yet');
	});

	it('sorts by it, putting the item with no figure last in both directions', () => {
		// A two-item fixture (one valued, one blocked) cannot tell a working sort from no
		// sort at all: the null always pins to the end regardless of direction, and with
		// only ONE comparable value left, any ordering — correct, wrong, or no sort applied
		// — puts it before the null and matches the fixture's own insertion order too. A
		// third, differently-valued item is what makes ascending and descending actually
		// diverge, so a click that fails to re-sort — or sorts by the wrong column — is
		// caught by the valued pair failing to flip.
		//
		// Full.md: strategic-alignment 5, customer-value 4 → counted 1 and 0.75 at weights
		// 20/20 → weighted 35/40 → total = 1 + (35/40)*4 = 4.5. adjustedValue = round2(4.5 *
		// confidence(4) / 5) = round2(3.6) = 3.6. indicator = round2(3.6 / effort(2)) = 1.8.
		// Higher.md: same two dimensions (same total 4.5), confidence 5 and effort 1 →
		// adjustedValue = round2(4.5 * 5 / 5) = 4.5, indicator = round2(4.5 / 1) = 4.5.
		// 1.8 and 4.5 are unambiguously different, so the pair must flip between directions.
		const vault = fixture();
		vault.addFile('Higher.md', {
			frontmatter: { 'strategic-alignment': 5, 'customer-value': 4, confidence: 5, effort: 1 },
		});
		const { containerEl } = makeEstimationView(vault, values());
		const order = (): string[] =>
			[...containerEl.querySelectorAll('.pbl-est-row')].map((row) => (row as HTMLElement).dataset.path as string);
		const header = head(containerEl) as HTMLElement;
		// First click: a non-title column's own first direction is descending (`firstDirection`).
		header.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order()).toEqual(['Higher.md', 'Full.md', 'NoEffort.md']);
		// Second click flips to ascending — the valued pair swaps places, and the blocked
		// item is STILL last.
		(head(containerEl) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order()).toEqual(['Full.md', 'Higher.md', 'NoEffort.md']);
	});
});
