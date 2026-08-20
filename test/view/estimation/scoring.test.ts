// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { clearButton, click, dimRow, makeEstimationView, pointButton, selectItem } from '../../helpers/estimation';
import { configured, configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';
import { computeTotal, stampValue } from '../../../src/domain/weightedScore';
import type { EstimationItem } from '../../../src/domain/estimationItems';
import { planOrphanCleanup, planScaleWrite, planScoreWrite } from '../../../src/domain/estimationWritePlan';

/**
 * What a pick WRITES: `estimationWritePlan.ts`'s planners wired through `estimationView.ts`'s gate,
 * and the orphan cleanup action — driven through real clicks on the real panel rather
 * than by calling the planners directly, so the whole path (pick -> plan -> gate ->
 * write -> refresh) is what is under test. What the panel DRAWS, and where focus lands
 * afterwards, is `panel.test.ts`'s subject.
 */

function cleanupButton(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector('.pbl-est-panel button[data-action="cleanup"]');
}

function currencyText(containerEl: HTMLElement): string | null {
	return containerEl.querySelector('.pbl-est-row.pbl-selected .pbl-est-chip')?.textContent ?? null;
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
		expect(held.getAttribute('aria-checked')).toBe('true');
		expect(document.activeElement).toBe(held);
		expect(dimRow(containerEl, 'Customer value').querySelector('.pbl-est-rubric')?.textContent).toBe(
			'Solves a significant user problem',
		);
		const unheld = pointButton(containerEl, 'customer-value', 3);
		expect(unheld.classList.contains('is-active')).toBe(false);
		expect(unheld.getAttribute('aria-checked')).toBe('false');
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
		await view.gate.undoLast();
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

	it('clears a key the note carries but no reader can parse — the setup action’s own stub, and a typed word', async () => {
		const vault = new FakeVault();
		// '' is exactly what `runEstimationInit` stubs onto every result, and 'soon' is
		// what a hand edit leaves. Both read as no answer, so a clear compared against the
		// VALUE planned nothing and the control the panel drew for the key did nothing.
		vault.addFile('Stubbed.md', { frontmatter: { 'strategic-alignment': '', 'customer-value': 3 } });
		vault.addFile('Garbage.md', { frontmatter: { 'strategic-alignment': 'soon' } });
		const { containerEl } = makeEstimationView(vault, configuredValues());

		selectItem(containerEl, 'Stubbed.md');
		click(clearButton(containerEl, 'strategic-alignment')!);
		await flush();

		expect(vault.fm('Stubbed.md')).toEqual({
			'customer-value': 3,
			'business-value': computeTotal(configured(), new Map([['customer-value', 3]]))!.total,
			'business-value-model': stampValue(configured(), { answered: 1, enabled: 8 }),
		});

		selectItem(containerEl, 'Garbage.md');
		click(clearButton(containerEl, 'strategic-alignment')!);
		await flush();

		expect(vault.fm('Garbage.md')).toEqual({});
	});

	it('undo restores all three keys a pick wrote', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		click(pointButton(containerEl, 'customer-value', 4));
		await flush();
		expect(vault.fm('Item.md')['customer-value']).toBe(4);

		await view.gate.undoLast();

		expect(vault.fm('Item.md')).toEqual({ 'strategic-alignment': 5, 'customer-value': 3 });
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

describe('the write path exposed for other callers', () => {
	it('applySafely writes directly, through the same gate a pick uses, and canUndo follows it', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { view } = makeEstimationView(vault, configuredValues());
		expect(view.gate.canUndo()).toBe(false);

		await view.applySafely([{ file, sets: [{ key: 'strategic-alignment', value: 3 }] }]);

		expect(vault.fm('Item.md')['strategic-alignment']).toBe(3);
		expect(view.gate.canUndo()).toBe(true);
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

	it('skips the extra refresh after a pick when the batch’s own flush already drew this state', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		let release: () => void = () => {};
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		const renderSpy = vi.spyOn(view, 'render');

		click(pointButton(containerEl, 'strategic-alignment', 4));
		// Mid-batch: the flush this triggers rebuilds the view once, synchronously,
		// before performScore's own await resolves.
		view.onDataUpdated();
		release();
		await flush();

		// The flush already drew the settled state — performScore's own unconditional
		// refresh would have been a second full rebuild of the same thing.
		expect(renderSpy).toHaveBeenCalledTimes(1);
	});

	it('still refreshes on its own when no mid-batch update arrived to flush', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');
		const renderSpy = vi.spyOn(view, 'render');

		click(pointButton(containerEl, 'strategic-alignment', 4));
		await flush();

		expect(renderSpy).toHaveBeenCalledTimes(1);
	});

	it('reports no flush for an empty batch, whatever the previous batch left behind', async () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { 'strategic-alignment': 5 } });
		let release: () => void = () => {};
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Item.md');

		// Leave flushedLastBatch true first, the same way the deferred-update test above
		// does, so a stale true is something for the empty call below to fail to reset.
		click(pointButton(containerEl, 'strategic-alignment', 4));
		view.onDataUpdated();
		release();
		await flush();
		expect(view.gate.flushedLastBatch).toBe(true);

		const outcome = await view.gate.applySafely([]);

		expect(outcome).toBeNull();
		expect(view.gate.flushedLastBatch).toBe(false);
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
