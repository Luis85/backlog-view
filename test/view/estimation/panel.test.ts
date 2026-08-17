// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	clearButton,
	click,
	dimRow,
	makeEstimationView,
	pickButton,
	pointButton,
	rowNote,
	selectItem,
} from '../../helpers/estimation';
import { configured, configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';
import { computeTotal, round2 } from '../../../src/domain/weightedScore';

/**
 * What the per-item panel DRAWS for a value already on the note, and where focus lands
 * once a pick has rebuilt it — `panel.ts`'s own subject. What a pick WRITES is
 * `scoring.test.ts`'s.
 */

/**
 * A valid one-dimension model under a user-chosen id. The shipped eight have no row for
 * an id nobody shipped, so the weight and all five rubric sentences have to be declared
 * for the model to be fit to score with at all — which is what lets a test say something
 * about an id a user typed rather than about `reach`.
 */
function soleDimension(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		valueProperty: 'note.business-value',
		stampProperty: 'note.business-value-model',
		dimensions: id,
		[`dimProperty.${id}`]: 'note.answer',
		[`dimWeight.${id}`]: '100',
		...Object.fromEntries([1, 2, 3, 4, 5].map((point) => [`dimRubric.${id}.${point}`, `point ${point}`])),
		...overrides,
	};
}

describe('a stored value the scale cannot name', () => {
	it('a clamped stored value reports itself instead of a rubric sentence, and holds no point active', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 7 } }); // range is 1-5
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		const dim = dimRow(containerEl, 'Strategic alignment');
		expect(rowNote(containerEl, 'Strategic alignment')).toBe('Out of range — read as 5');
		expect(dim.querySelector('button.is-active')).toBeNull();
	});

	it('reports an out-of-range CONFIDENCE, effort and complexity too — no point is active, so silence is the row saying nothing', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 3, confidence: 9, effort: 0, complexity: -1 } });
		const { containerEl } = makeEstimationView(vault, {
			...configuredValues(),
			confidenceProperty: 'note.confidence',
			effortProperty: 'note.effort',
			complexityProperty: 'note.complexity',
		});
		selectItem(containerEl, 'Item.md');

		// Nothing computes a total off a scale, so no arithmetic reports a clamp for one —
		// which is not the same as a note never holding 9 on a five-point scale.
		expect(rowNote(containerEl, 'Confidence')).toBe('Out of range — read as 5');
		expect(rowNote(containerEl, 'Effort')).toBe('Out of range — read as 1');
		expect(rowNote(containerEl, 'Complexity')).toBe('Out of range — read as 1');
		expect(dimRow(containerEl, 'Confidence').querySelector('button.is-active')).toBeNull();
	});

	it('names a fractional answer as between points rather than drawing an empty box', () => {
		const vault = new FakeVault();
		// 2.5 is inside the range, so nothing clamps it and it counts as it stands — but it
		// indexes `rubric[1.5]`, which is `undefined`, and a note of `undefined` renders as
		// an empty div beside a point nobody can see is held.
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 2.5 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		expect(rowNote(containerEl, 'Strategic alignment')).toBe('Between points — counted as 2.5');
	});

	it('says nothing at all for a dimension with no answer', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'customer-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		expect(rowNote(containerEl, 'Strategic alignment')).toBeNull();
	});
});

describe('the two derived lines', () => {
	it('renders each only once its own inputs exist', () => {
		const vault = new FakeVault();
		vault.addFile('Neither.md', { frontmatter: { 'strategic-alignment': 5 } });
		vault.addFile('ConfidenceOnly.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4 } });
		const values = configuredValues({ confidenceProperty: 'note.confidence' }); // effort left unbound
		const { containerEl } = makeEstimationView(vault, values);

		selectItem(containerEl, 'Neither.md');
		expect(containerEl.querySelector('.pbl-est-derived')).toBeNull();

		selectItem(containerEl, 'ConfidenceOnly.md');
		const derived = containerEl.querySelector('.pbl-est-derived') as HTMLElement;
		expect(derived).not.toBeNull();
		expect(derived.querySelectorAll('strong')).toHaveLength(1); // value-to-effort needs effort too
		const model = configured({ confidenceProperty: 'note.confidence' });
		const result = computeTotal(model, new Map([['strategic-alignment', 5]]))!;
		expect(derived.textContent).toContain(String(round2((result.total * 4) / 5)));
	});

	it('adds value-to-effort once effort is answered too', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 2 } });
		const values = configuredValues({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort' });
		const { containerEl } = makeEstimationView(vault, values);
		selectItem(containerEl, 'Item.md');

		const derived = containerEl.querySelector('.pbl-est-derived') as HTMLElement;
		expect(derived.querySelectorAll('strong')).toHaveLength(2);
		const model = configured({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort' });
		const result = computeTotal(model, new Map([['strategic-alignment', 5]]))!;
		const adjusted = round2((result.total * 4) / 5);
		expect(derived.textContent).toContain(String(adjusted));
		expect(derived.textContent).toContain(String(round2(adjusted / 2)));
	});

	it('omits value-to-effort for an effort of zero or less, and prints no ratio for it', () => {
		const vault = new FakeVault();
		vault.addFile('Zero.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 0 } });
		vault.addFile('Negative.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: -2 } });
		const values = configuredValues({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort' });
		const { containerEl } = makeEstimationView(vault, values);

		for (const path of ['Zero.md', 'Negative.md']) {
			selectItem(containerEl, path);
			const derived = containerEl.querySelector('.pbl-est-derived') as HTMLElement;
			// The confidence-adjusted value still stands; the ratio has no meaning to show —
			// zero divides to Infinity and a negative effort prints a negative ratio beside
			// a table showing the number the user actually typed.
			expect(derived.querySelectorAll('strong')).toHaveLength(1);
			expect(derived.textContent).not.toContain('Infinity');
			expect(derived.textContent).not.toMatch(/-\d/);
		}
	});
});

describe('where focus lands once a pick has rebuilt the panel', () => {
	it('a clear puts focus on the row it emptied, not on the body: the control it pressed is gone', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'customer-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(clearButton(containerEl, 'customer-value')!);
		await flush();

		// Clearing removes the clear control with the value, so the pick's own address
		// names nothing on the rebuilt panel — the row's first point is what is left.
		expect(clearButton(containerEl, 'customer-value')).toBeNull();
		expect(document.activeElement).toBe(pointButton(containerEl, 'customer-value', 1));
	});

	it('refocuses a dimension whose id needs escaping — option text, never a selector literal', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { answer: 2 } });
		const id = 'weird"id';
		const { containerEl } = makeEstimationView(vault, soleDimension(id));
		selectItem(containerEl, 'Item.md');

		click(pickButton(containerEl, id, '3')!);
		await flush();

		expect(document.activeElement).toBe(pickButton(containerEl, id, '3'));
	});

	it('refocuses the row that was picked when a dimension and a scale share an id', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { answer: 2, confidence: 2 } });
		// A dimension a user called `confidence`, beside the fixed confidence scale: two
		// rows, two kinds, one `data-dim`. The pick has to name which row it was on.
		const { containerEl } = makeEstimationView(
			vault,
			soleDimension('confidence', { confidenceProperty: 'note.confidence' }),
		);
		selectItem(containerEl, 'Item.md');

		click(pickButton(containerEl, 'confidence', '4', 'scale')!);
		await flush();

		expect(document.activeElement).toBe(pickButton(containerEl, 'confidence', '4', 'scale'));
	});
});
