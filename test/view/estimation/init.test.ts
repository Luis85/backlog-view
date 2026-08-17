// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';
import { SUGGESTED_KEYS } from '../../../src/domain/defaultModel';
import { runEstimationInit } from '../../../src/view/estimation/init';

/**
 * The guided empty state's setup action (`init.ts`): bind every suggested key nobody
 * has touched, then stub the bound keys onto every result — Task 8's own two scenarios,
 * `runInit`'s shape (`interactions/structure.ts`) narrowed to this view's own table and
 * gate. Driven through the real button where the button itself is under test, and
 * through `runEstimationInit` directly for the scenarios that are about what it DOES
 * rather than about the wiring — `scoring.test.ts`'s own split between DOM-driven and
 * direct-planner cases. `boundKeys` itself is `domain/scoringModel.ts`'s own pure
 * function and is tested in `test/domain/scoringModel.test.ts` — no vault, no DOM, so
 * no reason to pay for jsdom to check it.
 */

function useDefaultsButton(containerEl: HTMLElement): HTMLElement {
	const btn = containerEl.querySelector('.pbl-est-empty button');
	if (!btn) throw new Error('no button in the guided empty state');
	return btn as HTMLElement;
}

describe('the guided empty state’s setup action', () => {
	it('renders a real, Tab-reachable button', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), {});
		const btn = useDefaultsButton(containerEl);
		expect(btn.tagName).toBe('BUTTON');
		expect(btn.textContent).toBe('Use recommended defaults');
		expect(btn.getAttribute('tabindex')).toBeNull(); // ordinary UI zone, not a per-row control
	});

	it('binds all 13 suggested options, stubs the keys onto every result, leaves an existing value alone, and lands in the table', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		vault.addFile('B.md', { frontmatter: { 'business-value': 4 } });
		const { containerEl, config } = makeEstimationView(vault, {});

		useDefaultsButton(containerEl).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// (a) every suggestion bound, byte for byte
		expect(config.setCalls).toHaveLength(SUGGESTED_KEYS.length);
		for (const { option, suggested } of SUGGESTED_KEYS) expect(config.get(option)).toBe(`note.${suggested}`);

		// (b) stubbed onto both notes
		const keys = SUGGESTED_KEYS.map((k) => k.suggested);
		for (const key of keys) {
			if (key === 'business-value') continue; // (c) below
			expect(vault.fm('A.md')[key]).toBe('');
			expect(vault.fm('B.md')[key]).toBe('');
		}

		// (c) the pre-set value survives — ifMissing never overwrites an answer that is there
		expect(vault.fm('B.md')['business-value']).toBe(4);

		// (d) re-rendered into the table state
		expect(containerEl.querySelector('.pbl-est-table')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-est-empty')).toBeNull();
	});

	it('adopts every suggestion except an option the user CLEARED, and stops before stubbing while the pair stays unmatched', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const { view, config } = makeEstimationView(vault, { valueProperty: '' }); // cleared, not merely unset

		await runEstimationInit(view);

		// Cleared is a decision: never rebound, and never among the recorded set() calls.
		expect(config.get('valueProperty')).toBe('');
		expect(config.setCalls.some((c) => c.key === 'valueProperty')).toBe(false);
		expect(config.setCalls).toHaveLength(SUGGESTED_KEYS.length - 1);
		// Its pair partner is untouched and still gets adopted — nothing about the value
		// property being cleared stops the stamp property from binding.
		expect(config.get('stampProperty')).toBe('note.business-value-model');

		// valueKey stays '' while stampKey is now bound: modelProblems' pair rule fires, so
		// the config gate stops the action before a single stub is written.
		expect(vault.fm('A.md')).toEqual({});
	});

	it('pressing it twice binds nothing the second time', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const { view, config } = makeEstimationView(vault, {});

		await runEstimationInit(view);
		const boundAfterFirst = config.setCalls.length;
		expect(boundAfterFirst).toBe(SUGGESTED_KEYS.length);

		await runEstimationInit(view);

		expect(config.setCalls).toHaveLength(boundAfterFirst);
	});

	it('is one gated batch: canUndo follows it, and undoing removes the stubs — keys deleted, not blanked', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const { view } = makeEstimationView(vault, {});
		expect(view.canUndo()).toBe(false);

		await runEstimationInit(view);

		expect(view.canUndo()).toBe(true);
		expect(vault.fm('A.md')).not.toEqual({});

		const undone = await view.undoLast();

		expect(undone).toBe(true);
		expect(vault.fm('A.md')).toEqual({});
	});
});
