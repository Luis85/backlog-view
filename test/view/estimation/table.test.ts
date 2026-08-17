// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configured, configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { key } from '../../helpers/view';
import { computeTotal, stampValue } from '../../../src/domain/weightedScore';

/**
 * A full profile (8 of 8, total 3.55 — the PRD worked example `weightedScore.test.ts`
 * pins), a partial one (2 of 8, renormalized to 4), and a note with nothing at all —
 * the three shapes Step 4 of the task brief asks the table to draw correctly. None of
 * the three has a stored total or stamp yet, so every one reads `none` for currency.
 */
function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', {
		frontmatter: {
			'strategic-alignment': 5,
			'customer-value': 4,
			'business-impact': 4,
			reach: 3,
			'risk-reduction': 2,
			compliance: 1,
			'time-criticality': 4,
			enablement: 3,
		},
	});
	vault.addFile('Partial.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
	vault.addFile('Empty.md');
	return vault;
}

function row(containerEl: HTMLElement, path: string): HTMLElement {
	return containerEl.querySelector(`.pbl-est-row[data-path="${path}"]`) as HTMLElement;
}

describe('the estimation table', () => {
	it('renders one row per result', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		expect(containerEl.querySelectorAll('.pbl-est-row')).toHaveLength(3);
	});

	it("shows the full profile's rounded total and its 8/8 coverage", () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const full = row(containerEl, 'Full.md');
		expect(full.querySelector('.pbl-est-total')?.textContent).toBe('3.55');
		expect(full.querySelector('.pbl-est-coverage')?.textContent).toBe('8/8');
	});

	it("shows the partial profile's renormalized total and its 2/8 coverage", () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const partial = row(containerEl, 'Partial.md');
		expect(partial.querySelector('.pbl-est-total')?.textContent).toBe('4');
		expect(partial.querySelector('.pbl-est-coverage')?.textContent).toBe('2/8');
	});

	it("shows the none currency as an empty chip — the CSS-drawn dash every other empty cell in the row gets, not a hand-written one", () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const empty = row(containerEl, 'Empty.md');
		const currency = empty.querySelector('.pbl-est-currency') as HTMLElement;
		expect(currency.textContent).toBe('');
		expect(currency.matches(':empty')).toBe(true);
		const total = empty.querySelector('.pbl-est-total') as HTMLElement;
		expect(total.textContent).toBe('');
		// The dash on screen is `styles/estimation.css`'s `:empty::before` rule; this proves
		// the cell qualifies for that selector rather than rendering a literal dash itself —
		// the deferred assertion from Task 2.
		expect(total.matches(':empty')).toBe(true);
	});

	it('clicking a row selects it: pbl-selected and aria-selected both follow', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const partial = row(containerEl, 'Partial.md');
		expect(partial.classList.contains('pbl-selected')).toBe(false);

		partial.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.selectedPath).toBe('Partial.md');
		expect(partial.classList.contains('pbl-selected')).toBe(true);
		expect(partial.getAttribute('aria-selected')).toBe('true');
	});

	it('clicking a second row moves pbl-selected off the first', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const full = row(containerEl, 'Full.md');
		const partial = row(containerEl, 'Partial.md');
		full.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		partial.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(full.classList.contains('pbl-selected')).toBe(false);
		expect(full.getAttribute('aria-selected')).toBe('false');
		expect(partial.classList.contains('pbl-selected')).toBe(true);
	});

	it('renders the results empty state in place of rows when the base returns nothing', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), configuredValues());
		expect(containerEl.querySelectorAll('.pbl-est-row')).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-est-table')?.textContent).toContain('No results to estimate.');
	});

	it('keeps the selection across a rebuild: the row renders pre-selected and the pane points at it', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		row(containerEl, 'Partial.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.selectedPath).toBe('Partial.md');

		// A fresh Bases pass over the same vault — the whole table is rebuilt from
		// scratch, the way every data update rebuilds this view (Task 5's contract).
		view.onDataUpdated();

		const rebuilt = row(containerEl, 'Partial.md');
		expect(rebuilt.classList.contains('pbl-selected')).toBe(true);
		expect(rebuilt.getAttribute('aria-selected')).toBe('true');
		const table = containerEl.querySelector('.pbl-est-table');
		expect(table?.getAttribute('aria-activedescendant')).toBe(rebuilt.id);
	});
});

describe('the currency chip', () => {
	const model = configured();
	const fullAnswers = Object.entries({
		'strategic-alignment': 5,
		'customer-value': 4,
		'business-impact': 4,
		reach: 3,
		'risk-reduction': 2,
		compliance: 1,
		'time-criticality': 4,
		enablement: 3,
	});
	const result = computeTotal(model, new Map(fullAnswers))!;

	function currencyFixture(): FakeVault {
		const vault = new FakeVault();
		const answers = Object.fromEntries(fullAnswers);
		vault.addFile('Current.md', {
			frontmatter: { ...answers, 'business-value': result.total, 'business-value-model': stampValue(model, result.coverage) },
		});
		vault.addFile('Stale.md', {
			frontmatter: { ...answers, 'business-value': result.total + 1, 'business-value-model': stampValue(model, result.coverage) },
		});
		const otherModel = structuredClone(model);
		otherModel.outputMax = 10;
		vault.addFile('Foreign.md', {
			frontmatter: { ...answers, 'business-value': result.total, 'business-value-model': stampValue(otherModel, result.coverage) },
		});
		vault.addFile('Handwritten.md', { frontmatter: { ...answers, 'business-value': result.total } });
		vault.addFile('Orphan.md', {
			frontmatter: { 'business-value': result.total, 'business-value-model': stampValue(model, result.coverage) },
		});
		return vault;
	}

	function chipOf(containerEl: HTMLElement, path: string): { text: string | null; stale: boolean } {
		const chip = row(containerEl, path).querySelector('.pbl-est-currency');
		return { text: chip?.textContent ?? null, stale: chip?.classList.contains('pbl-est-stale') ?? false };
	}

	it('shows the right word for every currency, and marks only stale with pbl-est-stale', () => {
		const { containerEl } = makeEstimationView(currencyFixture(), configuredValues());
		expect(chipOf(containerEl, 'Current.md')).toEqual({ text: 'Current', stale: false });
		expect(chipOf(containerEl, 'Stale.md')).toEqual({ text: 'Needs re-estimation', stale: true });
		expect(chipOf(containerEl, 'Foreign.md')).toEqual({ text: 'Another model', stale: false });
		expect(chipOf(containerEl, 'Handwritten.md')).toEqual({ text: 'Hand-written', stale: false });
		expect(chipOf(containerEl, 'Orphan.md')).toEqual({ text: 'Inputs gone', stale: false });
	});
});

describe('keyboard on the estimation table', () => {
	it('ArrowDown selects the first row, then steps to the next', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;

		key(table, 'ArrowDown');
		expect(view.selectedPath).toBe('Full.md');
		key(table, 'ArrowDown');
		expect(view.selectedPath).toBe('Partial.md');
		key(table, 'ArrowUp');
		expect(view.selectedPath).toBe('Full.md');
	});

	it('holds at the last row rather than wrapping', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		for (let i = 0; i < 5; i++) key(table, 'ArrowDown');
		expect(view.selectedPath).toBe('Empty.md');
	});

	it('holds at the first row rather than wrapping', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'ArrowUp');
		expect(view.selectedPath).toBe('Full.md');
		key(table, 'ArrowUp');
		expect(view.selectedPath).toBe('Full.md');
	});

	it('opens the selected note on Enter', () => {
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'ArrowDown');
		key(table, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Full.md', mode: false }]);
	});

	it('Enter opens nothing while no row is selected', () => {
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'Enter');
		expect(vault.opened).toEqual([]);
	});

	it('does nothing on an empty table — no result to hold a selection', () => {
		const { view, containerEl } = makeEstimationView(new FakeVault(), configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'ArrowDown');
		expect(view.selectedPath).toBeNull();
		key(table, 'ArrowUp');
		expect(view.selectedPath).toBeNull();
	});

	describe('bringing the new row into view', () => {
		afterEach(() => vi.restoreAllMocks());

		it('scrolls the newly selected row into view on an arrow step, never on a click', () => {
			const { containerEl } = makeEstimationView(fixture(), configuredValues());
			const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
			const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;

			key(table, 'ArrowDown');
			expect(scrollIntoView).toHaveBeenCalledTimes(1);
			expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

			scrollIntoView.mockClear();
			row(containerEl, 'Partial.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));
			// Already visible to the pointer that clicked it — nothing to bring into view.
			expect(scrollIntoView).not.toHaveBeenCalled();
		});
	});
});

describe('the selection when its own row leaves the results', () => {
	it('clears a stale selectedPath instead of teleporting the next arrow press to row 0', () => {
		const vault = fixture();
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		row(containerEl, 'Partial.md').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.selectedPath).toBe('Partial.md');

		// The selected note leaves the base's results — deleted, or filtered out — the
		// same "onDataUpdated with a narrower set" shape a real vault change has.
		(view as unknown as { data: unknown }).data = {
			data: vault.entries().filter((e) => e.file.path !== 'Partial.md'),
		};
		view.onDataUpdated();

		expect(view.selectedPath).toBeNull();
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();

		// Honest afterwards too: nothing is selected, so the next arrow press means what
		// it always means for that state — select the first row — not a teleport away
		// from a row the reader still believed was held.
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'ArrowDown');
		expect(view.selectedPath).toBe('Full.md');
	});
});
