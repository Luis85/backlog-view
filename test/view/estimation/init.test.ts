// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { Notice } from '../../helpers/obsidian-mock';
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

	it('binds NOTHING when the bindings it would make leave the model broken, and says why', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const { view, config } = makeEstimationView(vault, { valueProperty: '' }); // cleared, not merely unset
		Notice.reset(); // this file installs no per-test harness, so the slate is made here

		await runEstimationInit(view);

		// Cleared is a decision: never rebound. Binding the stamp property beside it would
		// leave the pair half named — so the gate runs against the model the bindings WOULD
		// produce, before the configuration is touched at all. Binding twelve properties
		// and then having every write refused leaves the view worse than it found it, which
		// is the rule `runInit` keeps and this action's own comment claimed to keep while
		// running the loop first (the outcome pinned here until 2026-08-17).
		expect(config.get('valueProperty')).toBe('');
		expect(config.setCalls).toHaveLength(0);
		expect(config.get('stampProperty')).toBeUndefined();
		expect(vault.fm('A.md')).toEqual({});
		// Not silent: an action that does nothing has to say so, or the button is dead.
		expect(Notice.messages.at(-1)).toMatch(/business value property/i);
	});

	it('asks what is already bound of the same config it asks what is untouched', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const { view, config } = makeEstimationView(vault, {});
		Notice.reset();
		// Bound in the config AFTER the view resolved its settings — the mix
		// `adoptCandidates` documents as a defect: `strategic-alignment` now holds the very
		// key `confidenceProperty` is about to be offered, and only the live config knows.
		config.set('dimProperty.strategic-alignment', 'note.confidence');

		await runEstimationInit(view);

		// `confidence` is spoken for, so the confidence scale is left unbound — an unbound
		// scale is no problem at all, and every dimension still gets a key of its own.
		// Reading `taken` off the stale snapshot instead offered `confidence` twice, and
		// the collision check refused the whole action: a refusal that has to keep working
		// (the test above it) and that this must never need.
		expect(Notice.messages.some((m) => m.includes('Fix the estimation model'))).toBe(false);
		expect(config.get('confidenceProperty')).toBeUndefined();
		expect(config.get('dimProperty.reach')).toBe('note.reach');
		expect(vault.fm('A.md')['reach']).toBe('');
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
		expect(view.gate.canUndo()).toBe(false);

		await runEstimationInit(view);

		expect(view.gate.canUndo()).toBe(true);
		expect(vault.fm('A.md')).not.toEqual({});

		const undone = await view.gate.undoLast();

		expect(undone).toBe(true);
		expect(vault.fm('A.md')).toEqual({});
	});
});
