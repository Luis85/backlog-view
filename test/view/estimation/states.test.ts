// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EstimationView } from '../../../src/view/estimation/estimationView';
import { WriteLock } from '../../../src/view/writeLock';
import { click, makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { fakeController, FakeVault } from '../../helpers/vault';
import { flush } from '../../helpers/view';
import { viewStateKey } from '../../../src/storage/viewIdentity';

/** Two scored notes, "Bravo" before "Alpha" in the base's own (insertion) order — enough
 *  to tell "the first row drawn" apart from "the first item the base returned" when a
 *  sort is not in play, since a table with one row can never distinguish the two. */
function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Bravo.md', { frontmatter: { 'strategic-alignment': 5 } });
	vault.addFile('Alpha.md', { frontmatter: { 'strategic-alignment': 3 } });
	return vault;
}

/**
 * The render dispatch this task builds: loading (asserted by construction alone — nothing
 * has called `onDataUpdated` yet) → the guided-unconfigured empty state → a config
 * warning naming every problem → a placeholder "configured" frame. The table itself is
 * Task 6's; this suite only pins that the right STATE is chosen and that a warning names
 * the actual problem, never that a table renders rows.
 */
describe('the estimation view renders its own states', () => {
	it('shows the loading text before the first data update', () => {
		// Constructed directly rather than through makeEstimationView, which calls
		// onDataUpdated immediately — this is the one moment before that call, when the
		// view has nothing but the constructor's own placeholder to show.
		const containerEl = document.body.createDiv();
		new EstimationView(fakeController(), containerEl, new WriteLock());
		// `.pbl-est-shell` is the root now (`viewEl`) — no grid exists yet at this point,
		// so the loading text sits directly on the shell.
		expect(containerEl.querySelector('.pbl-est-shell')?.textContent).toBe('Loading estimation view…');
	});

	it('an unconfigured view shows the guided empty state, with the shared shell’s own title class', () => {
		const { view, containerEl } = makeEstimationView(new FakeVault(), {});
		expect(containerEl.querySelector('.pbl-est-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-config-warning')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
		// `guidanceShell` reused rather than hand-copied: the title carries the class
		// every other empty state's does, which the hand-written version never did.
		const title = containerEl.querySelector('.pbl-empty-title');
		expect(title?.textContent).toBe('No estimation model is configured for this view.');
		// A batch in the backlog view fires `syncBusy` on every subscribed gate, this
		// unconfigured estimation view's included — no toolbar drawn here to publish to,
		// so the call must be a genuine no-op rather than a throw.
		expect(() => view.syncBusy()).not.toThrow();
	});

	/**
	 * The config warning is not a dead end, and the scenario is the one the toolbar was
	 * built for: a view that GAINED a dimension after setup. Its key is unbound, which is a
	 * model problem, so the state that most needs the setup action is the one state the
	 * toolbar does not draw in — and Obsidian's picker offers only the properties a vault
	 * HAS, so a key no note carries cannot be bound by hand either (Codex, PR #168).
	 *
	 * Driven end to end rather than asserted as a button: what is owed here is that pressing
	 * it CLEARS the warning it is drawn under, which a presence check would pass for a
	 * control that binds the wrong thing or nothing.
	 */
	it('the config warning carries the setup action, and pressing it binds the dimension the warning named', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const values = configuredValues();
		delete values['dimProperty.reach']; // declared by the model, bound to nothing — a dimension added since setup
		const { containerEl, config } = makeEstimationView(vault, values);
		expect(containerEl.querySelector('.pbl-est-problems')?.textContent).toMatch(/Reach/);

		const btn = containerEl.querySelector<HTMLElement>('.pbl-est-problems button');
		expect(btn?.tagName).toBe('BUTTON');
		// The class is how `syncEstimationToolbar` finds it to disable it mid-batch — the
		// same contract the guided empty state's own button carries.
		expect(btn?.classList.contains('pbl-est-init')).toBe(true);

		click(btn as HTMLElement);
		await flush();

		expect(config.get('dimProperty.reach')).toBe('note.reach');
		expect(vault.fm('A.md').reach).toBe(''); // bound AND backfilled: neither half works alone
		expect(containerEl.querySelector('.pbl-est-problems')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-table')).not.toBeNull();
	});

	it('a half-configured view (value property only) warns and names the missing stamp', () => {
		const { view, containerEl } = makeEstimationView(new FakeVault(), { valueProperty: 'note.business-value' });
		// A block, not the toolbar's inline-flex pill — `estimationView.ts`'s own class.
		expect(containerEl.querySelector('.pbl-config-warning')).toBeNull();
		const warning = containerEl.querySelector('.pbl-est-problems');
		expect(warning).not.toBeNull();
		expect(warning?.textContent).toMatch(/stamp/i);
		expect(containerEl.querySelector('.pbl-est-empty')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
		expect(() => view.syncBusy()).not.toThrow();
	});

	it('the fully configured model (Step 1\'s shape) renders the placeholder table frame', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), configuredValues());
		expect(containerEl.querySelector('.pbl-est-table')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-est-empty')).toBeNull();
		expect(containerEl.querySelector('.pbl-config-warning')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-problems')).toBeNull();
	});

	it('detaches its root element on unload', () => {
		const { view, containerEl } = makeEstimationView(new FakeVault());
		// `.pbl-est-shell` is `viewEl` — the root this task made the shell, not the grid.
		expect(containerEl.querySelector('.pbl-est-shell')).not.toBeNull();
		view.onunload();
		expect(containerEl.querySelector('.pbl-est-shell')).toBeNull();
	});
});

/**
 * `.pbl-est-no-panel` collapses `.pbl-est-view`'s grid to one column — otherwise the
 * second `minmax(320px, 420px)` track sits reserved and empty, which jsdom cannot see
 * (nothing here lays out a grid track) and which the browser harness did: the guided
 * empty state and the config-warning block used to leave it reserved on the right, back
 * when both drew straight into the one element that carried `.pbl-est-view` itself.
 *
 * Since this task, that reservation is structurally impossible for those two states
 * rather than merely defaulted away: `render()` creates NO grid at all until the model is
 * fully configured (`gridEl` stays null, and `contentEl` falls back to the shell), so
 * there is no `.pbl-est-view` element for either state to leave a track reserved on. The
 * two tests below assert exactly that absence. Only the configured state ever has a grid,
 * so it is the only one still checked for the class itself.
 */
describe('the no-panel class the grid layout reads', () => {
	it('the guided empty state draws no grid at all', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), {});
		expect(containerEl.querySelector('.pbl-est-view')).toBeNull();
	});

	it('the config-warning block draws no grid at all', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), { valueProperty: 'note.business-value' });
		expect(containerEl.querySelector('.pbl-est-view')).toBeNull();
	});

	// Since Task 9, a configured table with results always starts with the first drawn row
	// selected, so "nothing selected" no longer occurs there — this now pins the one case
	// where nothing CAN be: a configured base with zero results (`renderRows`' own empty
	// branch, which selects nothing and draws no panel).
	it('stays set when a configured base returns zero results, since nothing can be selected', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), configuredValues());
		expect(containerEl.querySelector('.pbl-est-view')?.classList.contains('pbl-est-no-panel')).toBe(true);
		expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();
	});

	it('is cleared on a configured table with results, since the first row starts selected', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		expect(containerEl.querySelector('.pbl-est-view')?.classList.contains('pbl-est-no-panel')).toBe(false);
	});
});

describe('the first row is selected on a fresh render', () => {
	it('selects the first row so the panel is on screen without a click', () => {
		// The reader lands on a scored panel that teaches the view by being it. Selection writes
		// nothing — a pick is a click on a point button — so an auto-selected row is no more a
		// write surface than a clicked one.
		const { containerEl, view } = makeEstimationView(fixture(), configuredValues());
		expect(view.selectedPath).not.toBeNull();
		expect(containerEl.querySelector('.pbl-est-panel')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-est-row.pbl-selected')).not.toBeNull();
	});

	it('selects nothing when the base returned nothing', () => {
		const { containerEl, view } = makeEstimationView(new FakeVault(), configuredValues());
		expect(view.selectedPath).toBeNull();
		expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();
		expect(containerEl.textContent).toContain('No results to estimate.');
	});

	it('follows the active sort rather than the base order', () => {
		// `items` is this pass's sorted order, so "the first row" is the first row DRAWN —
		// which only differs from the base order (Bravo, Alpha) once a sort is actually in
		// effect on the FIRST render. A sort applied by a later click can't tell this apart
		// from base order, since auto-selection only fires while `selectedPath` is still
		// null (`renderTable`'s guard) — so the pick has to be pre-seeded through the same
		// store `restoreSort` reads, exactly as `sort.test.ts`'s persistence suite does.
		const vault = fixture();
		const id = { base: 'Plan.base', view: 'Prioritized' };
		vault.localStorage.set('product-backlog:view-state', {
			[viewStateKey(id)]: { base: 'Plan.base', folds: {}, prefs: { estimationSort: 'title:asc' } },
		});
		const { containerEl, view } = makeEstimationView(vault, configuredValues(), { base: 'Plan.base', viewName: 'Prioritized' });
		const firstDrawn = containerEl.querySelector('.pbl-est-row') as HTMLElement;
		expect(firstDrawn.dataset.path).toBe('Alpha.md'); // title:asc puts Alpha before Bravo, base order's opposite
		expect(view.selectedPath).toBe(firstDrawn.dataset.path);
	});
});
