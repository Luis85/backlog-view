// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeEstimationView, scrollReads } from '../../helpers/estimation';
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

function progressOf(cell: Element): string | null {
	return (cell.querySelector('.pbl-est-strip') as HTMLElement | null)?.style.getPropertyValue('--pbl-progress') ?? null;
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

describe('the value and coverage strips', () => {
	it("scales the value strip to the model's declared output range, never to the population", () => {
		// A bar that follows the population moves when somebody adds an item, so an item nobody
		// touched changes appearance because of a neighbour — the argument
		// `docs/requirements/The value against effort matrix.md` already settled for its
		// threshold lines. Driven the only way that distinguishes the two: add a third item and
		// assert the first two strips do not move.
		const base = makeEstimationView(fixture(), configuredValues());
		const before = progressOf(row(base.containerEl, 'Full.md').querySelector('.pbl-est-total')!);

		const wider = fixture();
		wider.addFile('Tiny.md', { frontmatter: { compliance: 1 } });
		const after = progressOf(row(makeEstimationView(wider, configuredValues()).containerEl, 'Full.md').querySelector('.pbl-est-total')!);

		expect(before).not.toBeNull();
		expect(after).toBe(before);
	});

	it('gives coverage a strip and gives confidence and effort none', () => {
		// Measured and cut: at 3px under a right-aligned digit a strip reads as a stray
		// underline, and a negative effort clamps to an EMPTY strip — which says "low" where the
		// truth is "invalid", right beside the cell showing the number the user typed.
		const vault = new FakeVault();
		vault.addFile('Negative.md', { frontmatter: { compliance: 1, confidence: 3, effort: -2 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const r = row(containerEl, 'Negative.md');
		expect(r.querySelector('.pbl-est-coverage .pbl-est-strip')).not.toBeNull();
		expect(r.querySelector('.pbl-est-cell[data-col="confidence"] .pbl-est-strip')).toBeNull();
		expect(r.querySelector('.pbl-est-cell[data-col="effort"] .pbl-est-strip')).toBeNull();
	});

	it('leaves an unanswered cell with its dash and no strip', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const total = row(containerEl, 'Empty.md').querySelector('.pbl-est-total')!;
		expect(total.querySelector('.pbl-est-strip')).toBeNull();
		expect(total.textContent).toBe('');
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
		const chip = row(containerEl, path).querySelector('.pbl-est-chip');
		return { text: chip?.textContent ?? null, stale: chip?.classList.contains('pbl-est-cur-stale') ?? false };
	}

	it('shows the right word for every currency, and marks only stale with pbl-est-cur-stale', () => {
		const { containerEl } = makeEstimationView(currencyFixture(), configuredValues());
		expect(chipOf(containerEl, 'Current.md')).toEqual({ text: 'Current', stale: false });
		expect(chipOf(containerEl, 'Stale.md')).toEqual({ text: 'Needs re-estimation', stale: true });
		expect(chipOf(containerEl, 'Foreign.md')).toEqual({ text: 'Another model', stale: false });
		expect(chipOf(containerEl, 'Handwritten.md')).toEqual({ text: 'Hand-written', stale: false });
		expect(chipOf(containerEl, 'Orphan.md')).toEqual({ text: 'Inputs gone', stale: false });
	});

	it('puts the currency word in a chip INSIDE the cell, so the cell can be a fixed column', () => {
		// The alignment defect's structural cause. One element cannot be both a fixed-width
		// column and a pill sized to its own words: `Needs re-estimation` made its cell 125.8px
		// against `Current`'s 96px, and because the title is the row's only shrinkable item,
		// every numeric column on that row slid 29.8px left of its own header. Geometry is
		// unmeasurable here (jsdom lays nothing out — see `test/CLAUDE.md`), so what is pinned
		// is the structure that makes the fix possible: the cell holds a chip, and the word is
		// never the cell's own text.
		const vault = new FakeVault();
		const model = configured();
		const answers = new Map(Object.entries({ 'strategic-alignment': 5 }));
		const total = computeTotal(model, answers)!;
		vault.addFile('Stale.md', {
			frontmatter: {
				'strategic-alignment': 5,
				'business-value': total.total + 1,
				'business-value-model': stampValue(model, total.coverage),
			},
		});
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const cell = row(containerEl, 'Stale.md').querySelector('.pbl-est-currency')!;
		const chip = cell.querySelector('.pbl-est-chip');
		expect(chip, 'the cell holds a chip').not.toBeNull();
		expect(chip!.classList.contains('pbl-est-cur-stale')).toBe(true);
		// The cell itself carries no text of its own — only the chip does.
		expect(Array.from(cell.childNodes).some((n) => n.nodeType === Node.TEXT_NODE)).toBe(false);
	});

	it('draws no chip at all when there is no stored total to judge', () => {
		// An empty outlined pill beside four marked ones reads as an empty input field. The
		// cell stays, so `:empty::before` still supplies the dash every other absent value uses.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const cell = row(containerEl, 'Empty.md').querySelector('.pbl-est-currency')!;
		expect(cell.querySelector('.pbl-est-chip')).toBeNull();
		expect(cell.textContent).toBe('');
	});

	it('marks the two currencies that need an action with an icon as well as a colour', () => {
		// The Shape-Before-Colour Rule (DESIGN.md): every state that matters survives a
		// monochrome screenshot. `current` deliberately has NO colour class — green means
		// finished in this system, and a fully estimated backlog must stay monochrome.
		const { containerEl } = makeEstimationView(currencyFixture(), configuredValues());

		// Both attention currencies, not just one — and by IDENTITY, not mere presence: the
		// two states carry DIFFERENT icons (a refresh for "re-estimate", a broken link for
		// "the inputs are gone"), so a chip that only proved "some icon exists" would still
		// pass if both currencies collapsed onto the same glyph. `[data-icon]` is the mock's
		// stand-in for Obsidian's `setIcon` (`test/helpers/obsidian-mock.ts`).
		const staleIcon = row(containerEl, 'Stale.md').querySelector('.pbl-est-chip [data-icon]');
		expect(staleIcon?.getAttribute('data-icon')).toBe('refresh-cw');
		const orphanIcon = row(containerEl, 'Orphan.md').querySelector('.pbl-est-chip [data-icon]');
		expect(orphanIcon?.getAttribute('data-icon')).toBe('unlink');

		// The other three currencies carry a colour, if any, but never this icon shape —
		// `current` is the one this rule most needs holding: no colour class AND no icon,
		// so a fully estimated backlog stays monochrome apart from its badges.
		const current = row(containerEl, 'Current.md').querySelector('.pbl-est-chip')!;
		expect(current.className).toBe('pbl-est-chip pbl-est-cur-current');
		expect(current.querySelector('[data-icon]')).toBeNull();
	});
});

describe('keyboard on the estimation table', () => {
	it('starts on the first row already selected, and steps from there', () => {
		// Since Task 9 the first row is selected on a fresh render (`view.selectedPath` is
		// already 'Full.md' here, no click or key needed), so the first ArrowDown steps
		// PAST it rather than landing on it.
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;

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
		// No ArrowDown needed: the first row (Full.md) is already selected on a fresh
		// render since Task 9.
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		key(table, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Full.md', mode: false }]);
	});

	it('Enter opens nothing while no row is selected', () => {
		// Restated for Task 9: a fixture WITH results now always starts with a selection,
		// so "no row is selected" only occurs when the base returns zero results.
		const vault = new FakeVault();
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
	// Restated for Task 9: the stale path is still cleared first (a path from a previous
	// pass this one's model no longer has must never survive), but with results still on
	// screen the same render now auto-selects the first of THEM rather than leaving the
	// reader at null — replacing the withdrawn row's panel with the next best thing
	// instead of an empty track. The old expectation (stays null until the next arrow
	// press) is exactly the placeholder-track gap this task closes, so it is wrong now.
	it('replaces a stale selectedPath with the first remaining row rather than an empty track', () => {
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

		expect(view.selectedPath).toBe('Full.md');
		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-est-panel')).not.toBeNull();
	});

	it('leaves nothing selected when the withdrawn row was the last result', () => {
		const vault = new FakeVault();
		vault.addFile('Only.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		expect(view.selectedPath).toBe('Only.md');

		(view as unknown as { data: unknown }).data = { data: [] };
		view.onDataUpdated();

		expect(view.selectedPath).toBeNull();
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();
	});
});

describe('the table scroll position across a rebuild', () => {
	afterEach(() => vi.restoreAllMocks());

	it('keeps the table scrolled to the same place after a rebuild', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		const table = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		table.scrollTop = 180;

		// A data update stands in for any full rebuild here — a picked score elsewhere on
		// the view included — since none of them is a switch to a different note's own
		// content the way the panel's rebuild can be, so there is no item to compare.
		view.onDataUpdated();

		const rebuilt = containerEl.querySelector('.pbl-est-table') as HTMLElement;
		expect(rebuilt).not.toBe(table);
		expect(rebuilt.scrollTop).toBe(180);
	});

	it('clamps a restored position to the rebuilt table when fewer rows remain', () => {
		const vault = fixture();
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		(containerEl.querySelector('.pbl-est-table') as HTMLElement).scrollTop = 900;

		scrollHeight.mockReturnValue(80);
		(view as unknown as { data: unknown }).data = { data: vault.entries().filter((e) => e.file.path === 'Full.md') };
		view.onDataUpdated();

		expect((containerEl.querySelector('.pbl-est-table') as HTMLElement).scrollTop).toBe(80);
	});

	it('reads the old table’s position while it is still in the document — the ORDER, because jsdom has no layout to check the number against', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const reads = scrollReads(containerEl.querySelector('.pbl-est-table') as HTMLElement);

		view.onDataUpdated();

		// The two tests above assert the restored NUMBER, and both passed over a read taken
		// after `render()` had already emptied `viewEl`: a detached element has no layout
		// box, so a browser answers 0 there however far it was scrolled, while jsdom answers
		// with whatever was last assigned to it. Only the order is checkable here — real
		// layout is still owed a live-vault check.
		expect(reads).toEqual([true]);
	});
});
