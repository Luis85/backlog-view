// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configured, configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { computeTotal, stampValue } from '../../../src/domain/weightedScore';
import { viewStateKey } from '../../../src/storage/viewIdentity';

/**
 * Full (total 3.55), Partial (total 4, renormalized) and Empty (nothing answered at
 * all) — `table.test.ts`'s own three shapes, reused here because they already pin two
 * distinct non-null totals apart and give Empty.md a genuinely null total, confidence
 * and effort to test the null partition against. Confidence and effort are answered on
 * the two non-empty notes only (2/5 and 4/1), so Empty.md stays null on every numeric
 * column and its title ('Empty') sorts alphabetically between the other two either way.
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
			confidence: 2,
			effort: 5,
		},
	});
	vault.addFile('Partial.md', {
		frontmatter: { 'strategic-alignment': 5, 'customer-value': 3, confidence: 4, effort: 1 },
	});
	vault.addFile('Empty.md');
	return vault;
}

function values(): Record<string, unknown> {
	return configuredValues({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort' });
}

function rowOrder(containerEl: HTMLElement): string[] {
	return [...containerEl.querySelectorAll('.pbl-est-row')].map((row) => (row as HTMLElement).dataset.path as string);
}

function header(containerEl: HTMLElement, column: string): HTMLElement {
	return containerEl.querySelector(`.pbl-est-sort[data-col="${column}"]`) as HTMLElement;
}

function click(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('sorting the prioritized list', () => {
	it('renders every header as a real button, unsorted (Base order) before any click', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		for (const column of ['title', 'total', 'coverage', 'confidence', 'effort', 'currency']) {
			const btn = header(containerEl, column);
			expect(btn.tagName).toBe('BUTTON');
			expect(btn.hasAttribute('aria-sort')).toBe(false);
		}
		expect(rowOrder(containerEl)).toEqual(['Full.md', 'Partial.md', 'Empty.md']);
	});

	it('sorts a number column descending on the first click, marks it with aria-sort, and puts the unanswered row last', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total'));
		expect(rowOrder(containerEl)).toEqual(['Partial.md', 'Full.md', 'Empty.md']);
		expect(header(containerEl, 'total').getAttribute('aria-sort')).toBe('descending');
		expect(header(containerEl, 'title').hasAttribute('aria-sort')).toBe(false);
	});

	it('flips to ascending on a second click of the same column — the unanswered row stays last', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total'));
		click(header(containerEl, 'total'));
		expect(rowOrder(containerEl)).toEqual(['Full.md', 'Partial.md', 'Empty.md']);
		expect(header(containerEl, 'total').getAttribute('aria-sort')).toBe('ascending');
	});

	it('sorts the title column ascending on the first click', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'title'));
		expect(rowOrder(containerEl)).toEqual(['Empty.md', 'Full.md', 'Partial.md']);
		expect(header(containerEl, 'title').getAttribute('aria-sort')).toBe('ascending');
	});

	it('switching to a different column starts it at its OWN first direction, and moves aria-sort off the old one', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total')); // total:desc
		click(header(containerEl, 'confidence')); // a fresh column starts over at desc
		expect(rowOrder(containerEl)).toEqual(['Partial.md', 'Full.md', 'Empty.md']); // confidence 4 > 2, Empty null last
		expect(header(containerEl, 'confidence').getAttribute('aria-sort')).toBe('descending');
		expect(header(containerEl, 'total').hasAttribute('aria-sort')).toBe(false);
	});

	it('puts the unanswered row last on effort too, ascending and descending alike', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'effort')); // desc: Full(5), Partial(1), Empty(null)
		expect(rowOrder(containerEl)).toEqual(['Full.md', 'Partial.md', 'Empty.md']);
		click(header(containerEl, 'effort')); // asc: Partial(1), Full(5) — Empty stays last, not first
		expect(rowOrder(containerEl)).toEqual(['Partial.md', 'Full.md', 'Empty.md']);
	});

	it('orders currency current, stale, foreign, handwritten, orphan, none — the documented stable order', () => {
		const model = configured();
		const answers = new Map([['strategic-alignment', 5]]);
		const result = computeTotal(model, answers)!;
		const vault = new FakeVault();
		const base = { 'strategic-alignment': 5 };
		vault.addFile('Current.md', {
			frontmatter: { ...base, 'business-value': result.total, 'business-value-model': stampValue(model, result.coverage) },
		});
		vault.addFile('Stale.md', {
			frontmatter: {
				...base,
				'business-value': result.total + 1,
				'business-value-model': stampValue(model, result.coverage),
			},
		});
		const foreignModel = structuredClone(model);
		foreignModel.outputMax = 10;
		vault.addFile('Foreign.md', {
			frontmatter: {
				...base,
				'business-value': result.total,
				'business-value-model': stampValue(foreignModel, result.coverage),
			},
		});
		vault.addFile('Handwritten.md', { frontmatter: { ...base, 'business-value': result.total } });
		vault.addFile('Orphan.md', {
			frontmatter: { 'business-value': result.total, 'business-value-model': stampValue(model, result.coverage) },
		});
		vault.addFile('None.md', { frontmatter: { ...base } });

		const { containerEl } = makeEstimationView(vault, configuredValues());
		click(header(containerEl, 'currency')); // desc first
		click(header(containerEl, 'currency')); // flip to ascending — the documented order itself
		expect(rowOrder(containerEl)).toEqual([
			'Current.md',
			'Stale.md',
			'Foreign.md',
			'Handwritten.md',
			'Orphan.md',
			'None.md',
		]);
	});
});

describe('the sort pick, persisted per saved view', () => {
	it('survives a second view over the same base and view name', () => {
		const vault = fixture();
		const first = makeEstimationView(vault, values(), { base: 'Plan.base', viewName: 'Prioritized' });
		click(header(first.containerEl, 'total'));
		expect(rowOrder(first.containerEl)).toEqual(['Partial.md', 'Full.md', 'Empty.md']);

		// A fresh view instance over the SAME vault and the same base/view name — the
		// harness's stand-in for closing and reopening the pane.
		const second = makeEstimationView(vault, values(), { base: 'Plan.base', viewName: 'Prioritized' });
		expect(rowOrder(second.containerEl)).toEqual(['Partial.md', 'Full.md', 'Empty.md']);
		expect(header(second.containerEl, 'total').getAttribute('aria-sort')).toBe('descending');
	});

	it('is session-only without an identifiable base: the pick still sorts on screen and touches no store entry', () => {
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, values()); // no base/viewName — resolveViewIdentity finds no leaf
		click(header(containerEl, 'total'));
		expect(rowOrder(containerEl)).toEqual(['Partial.md', 'Full.md', 'Empty.md']);
		expect(vault.localStorage.size).toBe(0);
	});

	it('ignores an unrecognized stored value defensively and falls back to Base order', () => {
		const vault = fixture();
		const id = { base: 'Plan.base', view: 'Prioritized' };
		vault.localStorage.set('product-backlog:view-state', {
			[viewStateKey(id)]: { base: 'Plan.base', folds: {}, prefs: { estimationSort: 'value:desc' } },
		});

		const { containerEl } = makeEstimationView(vault, values(), { base: 'Plan.base', viewName: 'Prioritized' });
		expect(rowOrder(containerEl)).toEqual(['Full.md', 'Partial.md', 'Empty.md']);
		expect(header(containerEl, 'total').hasAttribute('aria-sort')).toBe(false);
	});
});

describe('the sort direction has a shape and a name', () => {
	it('draws no direction element on a header nobody has sorted by', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		expect(header(containerEl, 'total').querySelector('.pbl-est-sort-dir')).toBeNull();
	});

	it('draws a DIFFERENT glyph for each direction, so the two are not visually identical', () => {
		// The defect: `aria-sort` was the only difference between ascending and descending, and
		// it is not a supported attribute on a button in a `role="listbox"` — so the direction
		// survived neither a colour screenshot nor a screen reader. `data-icon` is what the
		// harness's `setIcon` records (`test/helpers/obsidian-mock.ts`).
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total'));
		const descending = header(containerEl, 'total').querySelector<HTMLElement>('.pbl-est-sort-dir')?.dataset.icon;
		click(header(containerEl, 'total'));
		const ascending = header(containerEl, 'total').querySelector<HTMLElement>('.pbl-est-sort-dir')?.dataset.icon;
		expect(descending).toBe('chevron-down');
		expect(ascending).toBe('chevron-up');
		expect(ascending).not.toBe(descending);
	});

	it('states the direction in the header button\'s accessible name', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		click(header(containerEl, 'total'));
		expect(header(containerEl, 'total').getAttribute('aria-label')).toContain('descending');
		click(header(containerEl, 'total'));
		expect(header(containerEl, 'total').getAttribute('aria-label')).toContain('ascending');
		// `aria-sort` stays: it is the stylesheet's state hook and this file's own direction
		// hook, and the attribute a move to real column-header roles would already have. What
		// it is NOT is a thing any assistive technology reads on a button in a listbox, which
		// is why the name above is added rather than the attribute trusted.
		expect(header(containerEl, 'total').getAttribute('aria-sort')).toBe('ascending');
	});

	it('puts the label in its own span so the direction is never what truncates', () => {
		// The four numeric columns are a fixed 72px and `Confidence` is the widest header word,
		// leaving about 10px of slack — so a glyph beside a bare text node pushes the label into
		// the cell's own ellipsis at some widths and in most translations. The label shrinks;
		// `.pbl-est-sort-dir` is `flex: 0 0 auto`.
		const { containerEl } = makeEstimationView(fixture(), values());
		const label = header(containerEl, 'confidence').querySelector('.pbl-est-sort-label');
		expect(label?.textContent).toBe('Confidence');
	});
});
