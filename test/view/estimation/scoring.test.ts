// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configured, configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';
import { computeTotal, round2, stampValue } from '../../../src/domain/weightedScore';
import type { EstimationItem } from '../../../src/domain/estimationItems';
import { planOrphanCleanup, planScaleWrite, planScoreWrite } from '../../../src/view/estimation/scoring';

/**
 * The panel's write-back (`scoring.ts`'s planners, wired through `estimationView.ts`'s
 * gate) and the orphan cleanup action — Task 7's own scenarios, driven through real
 * clicks on the real panel rather than by calling the planners directly, so the whole
 * path (pick -> plan -> gate -> write -> refresh -> refocus) is what is under test.
 */

function row(containerEl: HTMLElement, path: string): HTMLElement {
	return containerEl.querySelector(`.pbl-est-row[data-path="${path}"]`) as HTMLElement;
}

function selectItem(containerEl: HTMLElement, path: string): void {
	row(containerEl, path).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pointButton(containerEl: HTMLElement, dim: string, value: number): HTMLElement {
	const btn = containerEl.querySelector(`.pbl-est-panel button[data-dim="${dim}"][data-value="${value}"]`);
	if (!btn) throw new Error(`no point button for ${dim}=${value}`);
	return btn as HTMLElement;
}

function clearButton(containerEl: HTMLElement, dim: string): HTMLElement | null {
	return containerEl.querySelector(`.pbl-est-panel button[data-dim="${dim}"][data-value=""]`);
}

function cleanupButton(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector('.pbl-est-panel button[data-action="cleanup"]');
}

function currencyText(containerEl: HTMLElement): string | null {
	return containerEl.querySelector('.pbl-est-row.pbl-selected .pbl-est-currency')?.textContent ?? null;
}

function dimRow(containerEl: HTMLElement, label: string): HTMLElement {
	const found = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-est-panel .pbl-est-dim')).find(
		(el) => el.querySelector('.pbl-est-dim-label')?.textContent === label,
	);
	if (!found) throw new Error(`no dim row labelled ${label}`);
	return found;
}

function click(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** A minimal `EstimationItem` for testing the planners directly — the shapes
 *  `buildEstimationModel` itself never produces (an orphan with no key left to remove)
 *  are exactly what a direct call can construct and a DOM-driven test cannot. */
function makeItem(overrides: Partial<EstimationItem> = {}): EstimationItem {
	return {
		file: new FakeVault().addFile('Direct.md'),
		entry: {} as EstimationItem['entry'],
		title: 'Direct',
		answers: new Map(),
		confidence: null,
		effort: null,
		complexity: null,
		storedTotal: null,
		storedStamp: null,
		result: null,
		currency: 'none',
		ownKeys: new Set(),
		...overrides,
	};
}

/** The default model's full 8/8 profile — the same worked example `weightedScore.test.ts` pins. */
const FULL_ANSWERS = {
	'strategic-alignment': 5,
	'customer-value': 4,
	'business-impact': 4,
	reach: 3,
	'risk-reduction': 2,
	compliance: 1,
	'time-criticality': 4,
	enablement: 3,
};

describe('scoring a dimension', () => {
	it('writes exactly the score, the recomputed total and its stamp in one batch, and refocuses the held point', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(pointButton(containerEl, 'customer-value', 4));
		await flush();

		const model = configured();
		const result = computeTotal(
			model,
			new Map([
				['strategic-alignment', 5],
				['customer-value', 4],
			]),
		)!;
		expect(vault.fm('Item.md')).toEqual({
			'strategic-alignment': 5,
			'customer-value': 4,
			'business-value': result.total,
			'business-value-model': stampValue(model, result.coverage),
		});
		expect(vault.writeLog).toHaveLength(1);

		const held = pointButton(containerEl, 'customer-value', 4);
		expect(held.classList.contains('is-active')).toBe(true);
		expect(held.getAttribute('aria-pressed')).toBe('true');
		expect(document.activeElement).toBe(held);
		expect(dimRow(containerEl, 'Customer value').querySelector('.pbl-est-rubric')?.textContent).toBe(
			'Solves a significant user problem',
		);
		const unheld = pointButton(containerEl, 'customer-value', 3);
		expect(unheld.classList.contains('is-active')).toBe(false);
		expect(unheld.hasAttribute('aria-pressed')).toBe(false);
	});

	it('picking the point already held plans nothing: writeLog and the undo slot are untouched', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		// A real write first, so "the undo slot is untouched" is a claim about something.
		click(pointButton(containerEl, 'customer-value', 4));
		await flush();
		const writesAfterFirst = vault.writeLog.length;

		click(pointButton(containerEl, 'strategic-alignment', 5)); // already held
		await flush();

		expect(vault.writeLog).toHaveLength(writesAfterFirst);
		await view.undoLast();
		// Still the customer-value batch — the no-op never installed anything over it.
		expect(vault.fm('Item.md')).toEqual({ 'strategic-alignment': 5, 'customer-value': 3 });
	});

	it('picking a score on the last unanswered dimension makes the stamp read full coverage', async () => {
		const vault = new FakeVault();
		const { enablement: _enablement, ...rest } = FULL_ANSWERS;
		vault.addFile('Item.md', { frontmatter: rest });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(pointButton(containerEl, 'enablement', 3));
		await flush();

		expect(vault.fm('Item.md')['business-value-model']).toMatch(/^8\/8 /);
	});

	it('clears only while the note carries the key, and clearing the only answer removes score, total and stamp', async () => {
		const vault = new FakeVault();
		const model = configured();
		const result = computeTotal(model, new Map([['customer-value', 3]]))!;
		vault.addFile('Item.md', {
			frontmatter: {
				'customer-value': 3,
				'business-value': result.total,
				'business-value-model': stampValue(model, result.coverage),
			},
		});
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		// No clear affordance for a dimension the note never answered.
		expect(clearButton(containerEl, 'strategic-alignment')).toBeNull();

		click(clearButton(containerEl, 'customer-value')!);
		await flush();

		expect(vault.fm('Item.md')).toEqual({});
	});

	it('undo restores all three keys a pick wrote', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(pointButton(containerEl, 'customer-value', 4));
		await flush();
		expect(vault.fm('Item.md')['customer-value']).toBe(4);

		await view.undoLast();

		expect(vault.fm('Item.md')).toEqual({ 'strategic-alignment': 5, 'customer-value': 3 });
	});

	it('a clamped stored value reports itself instead of a rubric sentence, and holds no point active', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 7 } }); // range is 1-5
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		const dim = dimRow(containerEl, 'Strategic alignment');
		expect(dim.querySelector('.pbl-est-rubric')?.textContent).toBe('Out of range — read as 5');
		expect(dim.querySelector('button.is-active')).toBeNull();
	});
});

describe('a config edit invalidates a stored total without writing anything', () => {
	it('a weight change makes a current total read as another model’s, purely on refresh', () => {
		const vault = new FakeVault();
		const model = configured();
		const result = computeTotal(model, new Map(Object.entries(FULL_ANSWERS)))!;
		vault.addFile('Item.md', {
			frontmatter: { ...FULL_ANSWERS, 'business-value': result.total, 'business-value-model': stampValue(model, result.coverage) },
		});
		const { view, config, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		expect(currencyText(containerEl)).toBe('Current');
		const writesBefore = vault.writeLog.length;

		// Rebalanced, not merely bumped, so the model stays VALID (weights still sum to
		// 100) and the view keeps rendering the table rather than the config-warning.
		config.values['dimWeight.customer-value'] = '10';
		config.values['dimWeight.enablement'] = '15';
		view.refresh();

		// The fingerprint moves with any weight (weightedScore.ts's own stated rule), so
		// this is a FOREIGN stamp, not a stale one — see the brief-snippet correction.
		expect(currencyText(containerEl)).toBe('Another model');
		expect(vault.writeLog).toHaveLength(writesBefore);
	});
});

describe('the orphan action', () => {
	it('reports an orphaned total without removing it on render, and removes it only through the cleanup action', async () => {
		const vault = new FakeVault();
		const model = configured();
		const result = computeTotal(model, new Map(Object.entries(FULL_ANSWERS)))!;
		const stamp = stampValue(model, result.coverage);
		vault.addFile('Item.md', { frontmatter: { ...FULL_ANSWERS, 'business-value': result.total, 'business-value-model': stamp } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		expect(currencyText(containerEl)).toBe('Current');
		expect(cleanupButton(containerEl)).toBeNull();

		// Hand-delete every score key, out of band — an edit this view never made.
		vault.setFrontmatter('Item.md', { 'business-value': result.total, 'business-value-model': stamp });
		const writesBeforeRefresh = vault.writeLog.length;
		view.refresh();

		expect(currencyText(containerEl)).toBe('Inputs gone');
		expect(vault.writeLog).toHaveLength(writesBeforeRefresh); // render alone writes nothing

		click(cleanupButton(containerEl)!);
		await flush();

		expect(vault.fm('Item.md')).toEqual({});
		expect(vault.writeLog).toHaveLength(writesBeforeRefresh + 1);
	});
});

describe('the confidence, effort and complexity rows', () => {
	it('an unbound scale renders a bare label with no points and no clear control', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		expect(dimRow(containerEl, 'Confidence').querySelector('button')).toBeNull();
	});

	it('a confidence pick writes only its own key, and picking the same value again is a no-op', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, confidence: 2 } });
		const values = configuredValues({ confidenceProperty: 'note.confidence' });
		const { containerEl } = makeEstimationView(vault, values);
		selectItem(containerEl, 'Item.md');

		click(pointButton(containerEl, 'confidence', 4));
		await flush();
		expect(vault.fm('Item.md')).toEqual({ 'strategic-alignment': 5, confidence: 4 });
		expect(vault.writeLog).toHaveLength(1);

		click(pointButton(containerEl, 'confidence', 4));
		await flush();
		expect(vault.writeLog).toHaveLength(1);
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
});

describe('the write path exposed for other callers', () => {
	it('applySafely writes directly, through the same gate a pick uses, and canUndo follows it', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { view } = makeEstimationView(vault, configuredValues());
		expect(view.canUndo()).toBe(false);

		await view.applySafely([{ file, sets: [{ key: 'strategic-alignment', value: 3 }] }]);

		expect(vault.fm('Item.md')['strategic-alignment']).toBe(3);
		expect(view.canUndo()).toBe(true);
	});

	it('marks the pane aria-busy while a batch is applying, and clears it after', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		let release: () => void = () => {};
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		const pane = containerEl.querySelector('.pbl-est-view') as HTMLElement;

		click(pointButton(containerEl, 'strategic-alignment', 4));
		expect(pane.getAttribute('aria-busy')).toBe('true');

		release();
		await flush();
		expect(pane.hasAttribute('aria-busy')).toBe(false);
	});

	it('defers a data update that arrives mid-batch, and flushes it once the batch settles', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		let release: () => void = () => {};
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(pointButton(containerEl, 'strategic-alignment', 4));
		// A Bases update arrives while that write is still in flight — deferred rather
		// than rebuilding against a half-applied note.
		view.onDataUpdated();

		release();
		await flush();

		expect(pointButton(containerEl, 'strategic-alignment', 4).classList.contains('is-active')).toBe(true);
	});
});

describe('the planners, called directly for their own edge cases', () => {
	it('planScoreWrite returns null for a dimension id the model does not have', () => {
		expect(planScoreWrite(configured(), makeItem(), 'not-a-real-dimension', 3)).toBeNull();
	});

	it('planScaleWrite returns null when the scale key is unbound', () => {
		expect(planScaleWrite(configured(), makeItem(), 'confidence', 3)).toBeNull(); // unbound by default
	});

	it('planOrphanCleanup returns null for anything but an orphan', () => {
		expect(planOrphanCleanup(configured(), makeItem({ currency: 'none' }))).toBeNull();
	});

	it('planOrphanCleanup claims no write when the note carries neither key to remove', () => {
		// A state `buildEstimationModel` itself never produces — an orphan's own
		// definition implies the total key is present — exercised directly, as the
		// planner's own guarantee that it never claims a write that changes nothing.
		expect(planOrphanCleanup(configured(), makeItem({ currency: 'orphan', ownKeys: new Set() }))).toBeNull();
	});
});

describe('the panel click delegation', () => {
	it('does nothing when a click lands on the panel but not on a button', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(containerEl.querySelector('.pbl-est-panel .pbl-est-title') as HTMLElement);
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('ignores a button carrying neither a pick nor the cleanup action', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		const panel = containerEl.querySelector('.pbl-est-panel') as HTMLElement;

		click(panel.createEl('button', { text: 'rogue' }));
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('the view guards its own orphan action', () => {
	it('performOrphanCleanup writes nothing when the item is not orphaned', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md');
		const { view } = makeEstimationView(vault, configuredValues());
		const item = view.model!.byPath.get('Item.md')!;
		expect(item.currency).toBe('none');

		await view.performOrphanCleanup(item);

		expect(vault.writeLog).toHaveLength(0);
	});
});
