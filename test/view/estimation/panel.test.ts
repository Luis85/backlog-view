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
	scrollReads,
	selectItem,
} from '../../helpers/estimation';
import { configured, configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';
import { computeTotal, round2, stampValue, TotalResult } from '../../../src/domain/weightedScore';

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

/** `table.test.ts`'s own full profile (8 of 8 dimensions, total 3.55) with confidence
 *  bound too, so the header's derived line and the confidence scale row both have
 *  something to render against. */
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
		},
	});
	return vault;
}

describe('the sticky answer header', () => {
	it('puts the answer above the inputs, with the total ahead of its own coverage', () => {
		// The total is what the reader opened the panel for and it used to sit under eleven rows
		// of buttons. `panel.ts` drew coverage first, so the header read "8/8 3.49" — the
		// qualifier ahead of the thing it qualifies.
		const { containerEl } = makeEstimationView(fixture(), configuredValues({ confidenceProperty: 'note.confidence' }));
		selectItem(containerEl, 'Full.md');
		const panel = containerEl.querySelector('.pbl-est-panel')!;
		const header = panel.firstElementChild!;
		expect(header.classList.contains('pbl-est-header')).toBe(true);
		// The three rules deleted in this task address these elements by POSITION, so the
		// structure is the other half of the guarantee — `styleRules.test.ts` can only prove a
		// rule exists, never that it matches. Both halves are needed: what shipped was three
		// correct rules matching nothing.
		expect(header.querySelector(':scope > .pbl-est-title')).not.toBeNull();
		expect(header.querySelector(':scope > .pbl-est-summary')).not.toBeNull();
		expect(header.querySelector(':scope > .pbl-est-derived')).not.toBeNull();
		const summary = header.querySelector('.pbl-est-summary')!;
		const order = Array.from(summary.children).map((el) => el.className.split(' ')[0]);
		expect(order.slice(0, 2)).toEqual(['pbl-est-total', 'pbl-est-coverage']);
	});

	it('states the currency in the panel, beside the total it is about', () => {
		// The panel never said it at all, so selecting a stale row lost the one fact that says
		// its number is wrong. Beside the total rather than after the derived lines: under two
		// sentences it read as a third one.
		// No dimension key at all — every scored input is gone, so `item.result` is null and
		// the stored total reads 'orphan' regardless of what the stamp says
		// (`test/helpers/fixtures.ts`'s own `Orphan total.md`).
		const vault = new FakeVault();
		vault.addFile('Orphan.md', { frontmatter: { 'business-value': 3, 'business-value-model': 'x' } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Orphan.md');
		const summary = containerEl.querySelector('.pbl-est-header .pbl-est-summary')!;
		expect(summary.querySelector('.pbl-est-chip.pbl-est-cur-orphan')).not.toBeNull();
	});

	it('leaves the decomposition holding only its terms', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const decomp = containerEl.querySelector('.pbl-est-decomp')!;
		expect(decomp.querySelector('.pbl-est-summary')).toBeNull();
		expect(decomp.querySelector('.pbl-est-total')).toBeNull();
	});

	it('groups the three fixed scales under one heading, and not under the value dimensions', () => {
		// Nothing computes the total from confidence, so it is not a value dimension — and
		// `panel.ts` draws it between the dimensions and the old "Effort and complexity"
		// heading, so a heading above the first dimension swept it in.
		const { containerEl } = makeEstimationView(fixture(), configuredValues({ confidenceProperty: 'note.confidence' }));
		selectItem(containerEl, 'Full.md');
		const headings = Array.from(containerEl.querySelectorAll('.pbl-est-panel h4')).map((h) => h.textContent);
		expect(headings).toEqual(['Value dimensions', 'Confidence, effort and complexity', 'Why this scored what it scored']);
		const confidenceRow = containerEl
			.querySelector('.pbl-est-panel [data-dim="confidence"][data-kind="scale"]')!
			.closest('.pbl-est-dim')!;
		const scalesHeading = Array.from(containerEl.querySelectorAll('.pbl-est-panel h4')).find(
			(h) => h.textContent === 'Confidence, effort and complexity',
		)!;
		expect(scalesHeading.compareDocumentPosition(confidenceRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

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

	it('adjusts by the confidence the row REPORTS, never by a stored value the scale cannot hold', () => {
		const vault = new FakeVault();
		// 9 on a five-point scale. The confidence row directly above these lines already
		// says it reads as 5, so a derived number computed from the raw 9 prints a value
		// above the model's own maximum, two lines under the warning that it cannot be one.
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, confidence: 9 } });
		const values = configuredValues({ confidenceProperty: 'note.confidence' }); // effort left unbound
		const { containerEl } = makeEstimationView(vault, values);
		selectItem(containerEl, 'Item.md');

		const result = computeTotal(configured(), new Map([['strategic-alignment', 5]]))!;
		expect(rowNote(containerEl, 'Confidence')).toBe('Out of range — read as 5');
		// Read as 5 of 5, so the adjustment is the identity and the line is the total
		// itself — which is the model's own output maximum, so an unclamped 9 shows up as
		// a number no answer on this model could produce.
		expect(containerEl.querySelector('.pbl-est-derived')?.textContent).toBe(`Confidence-adjusted value: ${result.total}`);
	});
});

describe('the decomposition block', () => {
	it('renders one term per answered dimension, each its own element — the coverage and the total moved to the header', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 4 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		const decomp = containerEl.querySelector('.pbl-est-decomp') as HTMLElement;
		// One <span> per answered dimension — never one run of text a browser wraps by
		// available width, which is what let a dimension and the total share a line.
		const terms = Array.from(decomp.children).filter((el) => el.tagName === 'SPAN');
		expect(terms.map((el) => el.textContent)).toEqual(['Strategic alignment 5 × 20%', 'Customer value 4 × 20%']);

		// Coverage and the total left this block entirely (Task 5) — they now live in the
		// header's own `.pbl-est-summary`, total first, checked in `panel.test.ts`'s header
		// describe block below.
		const header = containerEl.querySelector('.pbl-est-header') as HTMLElement;
		const summary = header.querySelector('.pbl-est-summary') as HTMLElement;
		expect(summary.querySelector('.pbl-est-coverage')?.textContent).toBe('2/8');
		const result = computeTotal(configured(), new Map([['strategic-alignment', 5], ['customer-value', 4]]))!;
		expect(summary.querySelector('.pbl-est-total')?.textContent).toBe(String(result.total));
	});

	it('lists the values the total was computed FROM — mirrored where the dimension counts down, clamped where the note is out of range', () => {
		const vault = new FakeVault();
		// `reach` counts down here, so an answer of 2 is worth 4 of 5 to the total, and
		// `compliance` holds 7 on a five-point scale, which the total reads as 5. A term
		// printing either raw describes arithmetic the total did not do, so the terms and
		// the total two lines below them disagree about the same note.
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 4, reach: 2, compliance: 7 } });
		const { containerEl } = makeEstimationView(vault, configuredValues({ 'dimLessIsBetter.reach': true }));
		selectItem(containerEl, 'Item.md');

		const decomp = containerEl.querySelector('.pbl-est-decomp') as HTMLElement;
		const terms = Array.from(decomp.children).filter((el) => el.tagName === 'SPAN');
		expect(terms.map((el) => el.textContent)).toEqual([
			'Strategic alignment 4 × 20%',
			'Reach 4 × 10%',
			'Compliance 5 × 10%',
		]);
	});
});

describe('the reserved panel column when nothing is selected', () => {
	// Since Task 9, a base with results always starts with the first row selected, so
	// "unselected, then restored once a row is picked" no longer occurs there — a click
	// has nothing left to restore. The surviving case is a zero-result base, where there
	// is nothing to auto-select, against a base with results, where the second track is
	// already filled before any click.
	it('collapses to one track only when there is nothing to select; a base with results starts with it filled', () => {
		const { containerEl: emptyContainer } = makeEstimationView(new FakeVault(), configuredValues());
		const emptyViewEl = emptyContainer.querySelector('.pbl-est-view') as HTMLElement;
		expect(emptyViewEl.classList.contains('pbl-est-no-panel')).toBe(true);
		expect(emptyContainer.querySelector('.pbl-est-panel')).toBeNull();

		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'customer-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const viewEl = containerEl.querySelector('.pbl-est-view') as HTMLElement;

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

	it('reads the old panel’s position while it is still in the document — the ORDER, because jsdom has no layout to check the number against', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 3 } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		const reads = scrollReads(containerEl.querySelector('.pbl-est-panel') as HTMLElement);

		view.onDataUpdated();

		// The three tests above assert the restored NUMBER, and every one of them passed
		// over a read taken after `render()` had already emptied `viewEl` — jsdom answers
		// `scrollTop` with whatever was assigned whether the node is connected or not, so
		// the number cannot tell a working restore from one a browser answers 0 to. This
		// is the part that is checkable here; real layout is still owed a vault check.
		expect(reads).toEqual([true]);
	});
});

/** One note under the shipped model, at whatever currency its own frontmatter earns. */
function vaultWith(path: string, frontmatter: Record<string, unknown>): FakeVault {
	const vault = new FakeVault();
	vault.addFile(path, { frontmatter });
	return vault;
}

describe('the panel offers a restamp where the currency reports a stamp problem', () => {
	const ANSWER = { 'strategic-alignment': 5 };
	const fresh = (): TotalResult => computeTotal(configured(), new Map(Object.entries(ANSWER)))!;
	const restampButton = (containerEl: HTMLElement): HTMLElement | null =>
		containerEl.querySelector('.pbl-est-panel button[data-action="restamp"]');
	const cleanupButton = (containerEl: HTMLElement): HTMLElement | null =>
		containerEl.querySelector('.pbl-est-panel button[data-action="cleanup"]');

	it('offers it on a stale total and writes the recomputed pair', async () => {
		// Neither the total the one answer produces nor its coverage, so BOTH keys are wrong
		// and both have to be rewritten — a fixture whose stamp already agreed would let a
		// planner that touched the total alone pass.
		const vault = vaultWith('Stale.md', {
			...ANSWER,
			'business-value': 1,
			'business-value-model': stampValue(configured(), { answered: 2, enabled: 8 }),
		});
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Stale.md');

		const button = restampButton(containerEl);
		expect(button).not.toBeNull();
		click(button!);
		await flush();

		// The total the answers produce, through the gate — not merely "something changed".
		expect(vault.fm('Stale.md')['business-value']).toBe(fresh().total);
		expect(vault.fm('Stale.md')['business-value-model']).toBe(stampValue(configured(), fresh().coverage));
		expect(vault.writeLog).toHaveLength(1);
	});

	it('offers it on a foreign stamp too, and restamps to this model’s own fingerprint', async () => {
		// A well-formed stamp from a model this is not: the answers on the note are still
		// what the restamp scores, so the action is the same one.
		const vault = vaultWith('Foreign.md', {
			...ANSWER,
			'business-value': fresh().total,
			'business-value-model': '1/8 deadbeef',
		});
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Foreign.md');

		click(restampButton(containerEl)!);
		await flush();

		expect(vault.fm('Foreign.md')['business-value-model']).toBe(stampValue(configured(), fresh().coverage));
	});

	// Each absence for its own reason: `current` has nothing to fix, and `handwritten` is a
	// person's number this action must not replace (`currencyOf` asks the stamp first for
	// exactly that).
	it('offers nothing on a current total', () => {
		const vault = vaultWith('Current.md', {
			...ANSWER,
			'business-value': fresh().total,
			'business-value-model': stampValue(configured(), fresh().coverage),
		});
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Current.md');

		expect(restampButton(containerEl)).toBeNull();
	});

	it('offers nothing on a hand-written total', () => {
		const { containerEl } = makeEstimationView(vaultWith('Typed.md', { ...ANSWER, 'business-value': 3 }), configuredValues());
		selectItem(containerEl, 'Typed.md');

		expect(restampButton(containerEl)).toBeNull();
	});

	it('still offers the orphan cleanup rather than a restamp on an orphan', () => {
		// No answer at all under a stamped total: nothing to restamp FROM, so the two
		// controls are alternatives rather than a pair.
		const vault = vaultWith('Orphan.md', {
			'business-value': 3,
			'business-value-model': stampValue(configured(), { answered: 1, enabled: 8 }),
		});
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Orphan.md');

		expect(restampButton(containerEl)).toBeNull();
		expect(cleanupButton(containerEl)).not.toBeNull();
	});
});
