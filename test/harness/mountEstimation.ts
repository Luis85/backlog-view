/**
 * Mount the REAL estimation view outside Obsidian — `mount.ts`'s own purpose
 * (`ProductBacklogView`), narrowed to `EstimationView`: nothing here depends on vitest,
 * so the same view bundles into a page (`npm run harness -- test/harness/estimation.ts`)
 * and opens in a browser. It draws; it checks nothing (ADR 0020).
 *
 * No `vault.afterWrite` wiring, unlike `mount.ts`'s. Every write this view makes —
 * `performScore`/`performScale`/`performOrphanCleanup` on a panel pick,
 * `runEstimationInit` on the guided empty state's button — already refreshes itself once
 * its own batch resolves (`estimationView.ts`'s own `if (!this.gate.flushedLastBatch)
 * this.refresh()`), because no data update ever arrives from anywhere else in this
 * harness. `mount.ts`'s timer exists for a Bases update that lands mid-batch from a
 * DIFFERENT write path; there is no such path here to interleave.
 */
import { EstimationView } from '../../src/view/estimation/estimationView';
import { WriteLock } from '../../src/view/writeLock';
import { drawChrome } from './chrome';
import { drawIcons } from './icons';
import { installObsidianDom } from '../helpers/dom';
import { estimationOptions, estimationVault } from '../helpers/fixtures';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { FileView } from '../helpers/obsidian-mock';

/**
 * `?config=` on the page (`estimation.ts`): `empty` mounts with nothing bound (the
 * guided empty state), `problems` binds only the business value property (the
 * config-warning state), anything else binds all thirteen keys.
 */
export type EstimationConfigVariant = 'full' | 'empty' | 'problems';

function configValues(variant: EstimationConfigVariant): Record<string, unknown> {
	if (variant === 'empty') return {};
	if (variant === 'problems') return { valueProperty: 'note.business-value' };
	return estimationOptions();
}

export interface MountedEstimationHarness {
	view: EstimationView;
	vault: FakeVault;
	containerEl: HTMLElement;
}

/**
 * Build the view into `root` against `estimationVault()`. The Bases leaf is real
 * nesting, `mountHarness`'s own reason: the view-state store (this view's sort pick)
 * has no identity to key on without it.
 */
export function mountEstimationHarness(root: HTMLElement, variant: EstimationConfigVariant = 'full'): MountedEstimationHarness {
	installObsidianDom();
	drawChrome();
	drawIcons();
	root.empty();

	const vault = estimationVault();
	const leafEl = root.createDiv('pbl-harness-leaf');
	const containerEl = leafEl.createDiv();
	vault.addLeaf(new FileView(vault.addFile('Estimation demo.base'), leafEl));

	const view = new EstimationView({} as never, containerEl, new WriteLock());
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	const config = new FakeViewConfig(configValues(variant));
	config.name = 'Estimation';
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();

	return { view, vault, containerEl };
}
