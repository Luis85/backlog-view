// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EstimationView } from '../../../src/view/estimation/estimationView';
import { WriteLock } from '../../../src/view/writeLock';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

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
		new EstimationView({} as never, containerEl, new WriteLock());
		expect(containerEl.querySelector('.pbl-est-view')?.textContent).toBe('Loading estimation view…');
	});

	it('an unconfigured view shows the guided empty state, with the shared shell’s own title class', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), {});
		expect(containerEl.querySelector('.pbl-est-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-config-warning')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
		// `guidanceShell` reused rather than hand-copied: the title carries the class
		// every other empty state's does, which the hand-written version never did.
		const title = containerEl.querySelector('.pbl-empty-title');
		expect(title?.textContent).toBe('No estimation model is configured for this view.');
	});

	it('a half-configured view (value property only) warns and names the missing stamp', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), { valueProperty: 'note.business-value' });
		// A block, not the toolbar's inline-flex pill — `estimationView.ts`'s own class.
		expect(containerEl.querySelector('.pbl-config-warning')).toBeNull();
		const warning = containerEl.querySelector('.pbl-est-problems');
		expect(warning).not.toBeNull();
		expect(warning?.textContent).toMatch(/stamp/i);
		expect(containerEl.querySelector('.pbl-est-empty')).toBeNull();
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
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
		expect(containerEl.querySelector('.pbl-est-view')).not.toBeNull();
		view.onunload();
		expect(containerEl.querySelector('.pbl-est-view')).toBeNull();
	});
});
