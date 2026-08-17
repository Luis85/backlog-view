import { EstimationView } from '../../src/view/estimation/estimationView';
import { WriteLock } from '../../src/view/writeLock';
import { installObsidianDom } from './dom';
import { FakeVault, FakeViewConfig } from './vault';
import { FileView } from './obsidian-mock';

installObsidianDom();

export interface EstimationHarness {
	view: EstimationView;
	config: FakeViewConfig;
	containerEl: HTMLElement;
}

/**
 * The estimation view's own harness — `test/helpers/view.ts`'s `makeView` assignment
 * pattern (`anyView.app/config/data`, then `onDataUpdated()`) narrowed to what this view
 * actually has this task: no toolbar, no collapse state, no focus level to prime.
 */
export function makeEstimationView(
	vault: FakeVault,
	configValues: Record<string, unknown> = {},
	{ lock, base, viewName }: { lock?: WriteLock; base?: string; viewName?: string } = {},
): EstimationHarness {
	// Bases mounts the view inside the leaf showing the .base file, the same nesting
	// `makeView` builds — a later task's persistence needs the real leaf to identify it.
	const leafEl = document.body.createDiv();
	const containerEl = leafEl.createDiv();
	if (base) vault.addLeaf(new FileView(vault.addFile(base), leafEl));
	const view = new EstimationView({} as never, containerEl, lock);
	const config = new FakeViewConfig(configValues);
	if (viewName) config.name = viewName;
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = config;
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	return { view, config, containerEl };
}
