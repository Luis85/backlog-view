// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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
		expect(derived.children).toHaveLength(1); // value-to-effort needs effort too
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
		expect(derived.children).toHaveLength(2);
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
			expect(derived.children).toHaveLength(1);
			expect(derived.textContent).not.toContain('Infinity');
			expect(derived.textContent).not.toMatch(/-\d/);
		}
	});
});

describe('the decomposition block', () => {
	it('renders one term per answered dimension, each its own element, and wraps coverage with the total as the summary line that follows them', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 4 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		const decomp = containerEl.querySelector('.pbl-est-decomp') as HTMLElement;
		// One <span> per answered dimension — never one run of text a browser wraps by
		// available width, which is what let a dimension and the total share a line.
		const terms = Array.from(decomp.children).filter((el) => el.tagName === 'SPAN');
		expect(terms.map((el) => el.textContent)).toEqual(['Strategic alignment 5 × 20%', 'Customer value 4 × 20%']);

		// Coverage and the total are the summary's own two children, in that order, and
		// the summary itself is the last thing in the block — never two more siblings a
		// term's own line could run into.
		expect(decomp.lastElementChild?.className).toBe('pbl-est-summary');
		const summary = decomp.querySelector('.pbl-est-summary') as HTMLElement;
		expect(Array.from(summary.children).map((el) => el.className)).toEqual(['pbl-est-coverage', 'pbl-est-total']);
		expect(summary.querySelector('.pbl-est-coverage')?.textContent).toBe('2/8');
		const result = computeTotal(configured(), new Map([['strategic-alignment', 5], ['customer-value', 4]]))!;
		expect(summary.querySelector('.pbl-est-total')?.textContent).toBe(String(result.total));
	});
});

describe('the reserved panel column when nothing is selected', () => {
	it('collapses to one track while unselected, and restores the second once a row is picked', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'customer-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const viewEl = containerEl.querySelector('.pbl-est-view') as HTMLElement;

		expect(viewEl.classList.contains('pbl-est-no-panel')).toBe(true);
		expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();

		selectItem(containerEl, 'Item.md');

		expect(viewEl.classList.contains('pbl-est-no-panel')).toBe(false);
		expect(containerEl.querySelector('.pbl-est-panel')).not.toBeNull();
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

describe('the panel scroll position across a rebuild', () => {
	afterEach(() => vi.restoreAllMocks());

	it('keeps the panel scrolled to the same place after a pick on the same item', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		const panel = containerEl.querySelector('.pbl-est-panel') as HTMLElement;
		panel.scrollTop = 240;

		click(pointButton(containerEl, 'strategic-alignment', 4));
		await flush();

		// Rebuilt whole (the ponytail note above states it), not patched — so the scroll
		// position surviving is the fix, not a coincidence of the same node staying put.
		const rebuilt = containerEl.querySelector('.pbl-est-panel') as HTMLElement;
		expect(rebuilt).not.toBe(panel);
		expect(rebuilt.scrollTop).toBe(240);
	});

	it("starts a different item's panel at the top rather than carrying the old scroll position over", () => {
		const vault = new FakeVault();
		vault.addFile('First.md', { frontmatter: { 'strategic-alignment': 3 } });
		vault.addFile('Second.md', { frontmatter: { 'strategic-alignment': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'First.md');
		(containerEl.querySelector('.pbl-est-panel') as HTMLElement).scrollTop = 240;

		selectItem(containerEl, 'Second.md');

		expect((containerEl.querySelector('.pbl-est-panel') as HTMLElement).scrollTop).toBe(0);
	});

	it('clamps a restored position to the rebuilt panel when it comes out shorter', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'customer-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
		(containerEl.querySelector('.pbl-est-panel') as HTMLElement).scrollTop = 900;

		// Clearing the answer removes that row's own clear button and rubric note — the
		// rebuilt panel really is shorter, not just told to act like it for this test.
		scrollHeight.mockReturnValue(120);
		click(clearButton(containerEl, 'customer-value')!);
		await flush();

		expect((containerEl.querySelector('.pbl-est-panel') as HTMLElement).scrollTop).toBe(120);
	});
});
