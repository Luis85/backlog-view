// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { click, makeEstimationView, pointButton, selectItem } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Scored.md', { frontmatter: { 'strategic-alignment': 5, compliance: 1 } });
	vault.addFile('Bare.md', { frontmatter: {} });
	return vault;
}

describe("the estimation view's toolbar", () => {
	it('selection writes nothing: a fresh render never spends the undo slot', () => {
		// The rule `renderTable.ts`'s own comment and the spec both state — a pick is a
		// click on a point button, so auto-selecting the first row must be no more a write
		// surface than a clicked one.
		const { view } = makeEstimationView(fixture(), configuredValues());
		expect(view.gate.canUndo()).toBe(false);
	});

	it('states how many of the results are scored, as one quantity in two parts', () => {
		// The filtered count's own idiom ("3 of 12"): never two quantities joined by a
		// separator, which is what "2 items - 1 scored" was.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		expect(containerEl.querySelector('.pbl-est-count')!.textContent).toBe('1 of 2 scored');
	});

	it('offers undo only once there is something to take back', () => {
		// `WriteGate.canUndo()` had no production caller at all before this toolbar.
		const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
		const undo = containerEl.querySelector('.pbl-est-undo') as HTMLButtonElement;
		expect(undo.disabled).toBe(true);
		expect(view.gate.canUndo()).toBe(false);
	});

	it('disables both write controls while a batch is running, and re-enables undo to the slot it left', async () => {
		const vault = fixture();
		let release: () => void = () => {};
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Scored.md');

		// A REAL batch, not a poked field: `WriteGate.writing` reads `this.lock.applying`,
		// the injected `WriteLock`'s own flag — not a field on the gate a test could set
		// directly and expect either button to notice.
		click(pointButton(containerEl, 'strategic-alignment', 4));
		expect((containerEl.querySelector('.pbl-est-init') as HTMLButtonElement).disabled).toBe(true);
		expect((containerEl.querySelector('.pbl-est-undo') as HTMLButtonElement).disabled).toBe(true);
		expect(containerEl.querySelector('.pbl-est-shell')!.getAttribute('aria-busy')).toBe('true');

		release();
		await flush();
		// The batch installed an inverse, so undo re-enables to THAT slot's state, not
		// merely to "a batch finished" — the backlog toolbar's own rule for this button.
		expect((containerEl.querySelector('.pbl-est-init') as HTMLButtonElement).disabled).toBe(false);
		expect((containerEl.querySelector('.pbl-est-undo') as HTMLButtonElement).disabled).toBe(false);
	});

	it('runs the guided setup action from its own ✨, not only from the empty state’s', async () => {
		// `runEstimationInit` used to be reachable only from the guided empty state's own
		// button — this is the toolbar's own click handler, over a view that is already
		// past that state.
		const vault = fixture();
		const { containerEl, view } = makeEstimationView(vault, configuredValues());

		click(containerEl.querySelector('.pbl-est-init') as HTMLButtonElement);
		await flush();

		// Every bound key stubbed onto the bare note that held none of them.
		expect(vault.fm('Bare.md')['customer-value']).toBe('');
		expect(view.gate.canUndo()).toBe(true);
	});

	it('takes back the last effective batch from its own undo button', async () => {
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Scored.md');

		click(pointButton(containerEl, 'strategic-alignment', 4));
		await flush();
		expect(vault.fm('Scored.md')['strategic-alignment']).toBe(4);

		click(containerEl.querySelector('.pbl-est-undo') as HTMLButtonElement);
		await flush();

		expect(vault.fm('Scored.md')['strategic-alignment']).toBe(5);
	});

	it("keeps the table and the panel as the grid's own children, not the shell's", () => {
		// The toolbar makes `viewEl` a flex column with a grid inside it. `.pbl-est-view`'s
		// track sizing applies to DIRECT children, so a table nested one div deeper than the
		// grid lands in its single first cell — the defect `estimationView.ts`'s own header
		// warns about for exactly this reason. No explicit selection needed: auto-selection
		// lands on the first drawn row (`Scored.md`) so the panel is already on screen.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const grid = containerEl.querySelector('.pbl-est-view')!;
		expect(grid.querySelector(':scope > .pbl-est-table')).not.toBeNull();
		expect(grid.querySelector(':scope > .pbl-est-panel')).not.toBeNull();
		expect(grid.previousElementSibling!.classList.contains('pbl-toolbar')).toBe(true);
	});
});
